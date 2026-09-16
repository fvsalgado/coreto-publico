/**
 * De que região é este pedido — decidido pelo Host, no middleware.
 *
 * O contrato do multi-inquilino é: cada região tem o seu domínio
 * (`regions.domain`), e um pedido a esse domínio vê essa região. O middleware
 * lê o cabeçalho Host, traduz para o identificador da região e reescreve o
 * caminho para o segmento interno `/[regiao]/…` — nunca `headers()` numa
 * página, que mataria o ISR.
 *
 * A regra de degradação está testada e mudou de degrau — é a decisão central
 * deste módulo. Durante muito tempo **tudo o que não se reconhecia valia a
 * região de omissão**: um preview do Vercel, localhost, um Host esquisito, o
 * mapa indisponível. Mantinha o sítio de pé, mas ao preço de mostrar a agenda
 * de uma CIM real — o promotor, os logótipos, os concelhos dela — a quem
 * batia a um endereço que ninguém lhe atribuiu. E o preço piorava quando a
 * leitura do mapa falhava numa instância que ainda não o tinha lido: fica
 * vazio trinta segundos, e nesse intervalo TODOS os hosts são desconhecidos —
 * ou seja, quem visitasse o domínio de uma CIM via lá dentro a agenda de
 * outra. O comentário de `queries/events.ts` diz que servir a agenda de uma
 * CIM no domínio de outra não tem preço que o pague; era exatamente isso que a
 * omissão andava a comprar.
 *
 * Agora um Host que não corresponde a nenhuma região não vale região nenhuma:
 * vale `null`, e o middleware serve-lhe a página estática do produto
 * (`app/pagina-do-produto`), que não toca na base de dados — é de propósito a
 * página que aguenta a base em baixo e o mapa por ler. Continua a degradar-se
 * em vez de rebentar; o que mudou é que o degrau deixou de ser a casa de
 * outra pessoa.
 */

/**
 * A região principal deste deployment — a que herda a identidade dele.
 *
 * É o papel que a maior parte da casa pede a esta variável: o `urlDoSitio`
 * (esta região descreve-se pelo `NEXT_PUBLIC_SITE_URL`, as outras pelo seu
 * domínio), o painel `/admin`, o intake, os feeds, e a região que um build sem
 * base de dados pré-gera. Todos precisam de um identificador de região válido,
 * sempre — daí ter valor por omissão e nunca ser nulo.
 */
export const REGIAO_PRINCIPAL = process.env.REGIAO_DE_OMISSAO?.trim() || 'medio-tejo';

/**
 * A escotilha do deployment: a região com que se servem os hosts que o mapa
 * não conhece, ou `null` quando não se serve nenhuma.
 *
 * Uma variável, dois papéis, e o que os separa é isto: acima responde-se «qual
 * é a região principal deste deployment», que tem sempre resposta; aqui
 * responde-se «um host que não é de ninguém chega a ver alguma agenda?» — e a
 * resposta por omissão passou a ser não. Os dois têm nomes distintos porque,
 * com um nome só, mudar a resposta a uma pergunta mudava calada a resposta à
 * outra: os sítios que precisam de saber qual é a região principal são muitos
 * e não têm nada que ver com quem serve um anfitrião desconhecido.
 *
 * É por ser explícita que a escotilha é honesta. Enquanto o único endereço
 * onde o Coreto respondia era um `*.vercel.app` — e, em desenvolvimento,
 * `localhost` — era `REGIAO_DE_OMISSAO=medio-tejo` que mantinha o Médio Tejo a
 * servir nesses hosts; com cada região no seu domínio, o que a variável decide
 * é só quem responde por um anfitrião desconhecido — a montra
 * (`vale-do-coreto`), que é o que `docs/VERCEL.md` prescreve, ou ninguém.
 *
 * Não é `NEXT_PUBLIC_` de propósito: nenhum componente de cliente a lê (o
 * middleware e as páginas de servidor chegam-lhe pelo processo), e assim a
 * mudança não depende de rebuild de bundles.
 */
export const REGIAO_PARA_HOSTS_DESCONHECIDOS = process.env.REGIAO_DE_OMISSAO?.trim() || null;

/** Quanto tempo o mapa domínio→região vale antes de se voltar a perguntar. */
export const VALIDADE_DO_MAPA_MS = 5 * 60 * 1000;

/** Depois de uma falha, volta-se a tentar depressa — sem martelar. */
const VALIDADE_APOS_FALHA_MS = 30 * 1000;

/**
 * Dois segundos, e depois disso o mapa velho serve.
 *
 * **Um pedido sem prazo aqui é um sítio inteiro sem prazo.** Isto corre no
 * middleware, à frente de todos os pedidos públicos de todas as regiões, e
 * não tinha tempo limite nenhum: se o `/api/regioes` respondesse devagar — a
 * base a arrastar-se, uma função fria, um soluço de rede entre a Vercel e o
 * Supabase — cada visita ficava parada à espera dele. Não é a agenda de uma
 * região a ficar lenta: são todos os domínios ao mesmo tempo, e nenhuma
 * página chega sequer a ser desenhada.
 *
 * Dois segundos é muito mais do que a leitura demora (uma tabela com meia
 * dúzia de linhas, servida de cache incremental) e muito menos do que a
 * paciência de quem espera. Esgotado o prazo, o `catch` de baixo faz o que já
 * fazia por uma falha de rede: serve o mapa que já tinha, e volta a tentar
 * daqui a trinta segundos.
 */
const PRAZO_DO_MAPA_MS = 2000;

/**
 * O Host tal como chega, reduzido ao nome: sem porto, em minúsculas.
 *
 * `coreto.mediotejo.pt:443` e `Coreto.MedioTejo.PT` são o mesmo sítio; um
 * IPv6 entre parêntesis retos (`[::1]:3000`) fica `[::1]`, que nunca está no
 * mapa e por isso não é de região nenhuma — que é o que se quer de um pedido
 * feito por endereço.
 */
export function normalizarHost(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  const semEspacos = hostHeader.trim().toLowerCase();
  if (semEspacos.length === 0) return null;
  if (semEspacos.startsWith('[')) {
    const fecho = semEspacos.indexOf(']');
    return fecho === -1 ? semEspacos : semEspacos.slice(0, fecho + 1);
  }
  const doisPontos = semEspacos.indexOf(':');
  return doisPontos === -1 ? semEspacos : semEspacos.slice(0, doisPontos);
}

/**
 * A tradução Host→região, pura: um mapa `dominio → id`, e `null` para quem não
 * estiver lá.
 *
 * A comparação é exata — `www.` ou um subdomínio a mais não é o domínio da
 * região, e adivinhar seria servir a agenda de uma CIM num endereço que
 * ninguém lhe atribuiu. Quem não está no mapa vale o que a escotilha disser:
 * uma região, quando o deployment a define, e `null` — a página do produto —
 * quando não define. A escotilha entra por parâmetro, com o valor do ambiente
 * por omissão, para os testes poderem provar os dois mundos sem mexer no
 * processo.
 */
export function regiaoDoHost(
  hostHeader: string | null,
  dominios: Readonly<Record<string, string>>,
  escotilha: string | null = REGIAO_PARA_HOSTS_DESCONHECIDOS,
): string | null {
  const host = normalizarHost(hostHeader);
  if (!host) return escotilha;
  return dominios[host] ?? escotilha;
}

interface MapaGuardado {
  dominios: Record<string, string>;
  redirecionamentos: Record<string, string>;
  /**
   * As regiões com barreira de senha (0157), por identificador.
   *
   * Vem do mesmo `/api/regioes` e guarda-se no mesmo mapa — uma leitura só.
   * **Sobrevive a uma falha de leitura como os outros dois**, e isso é a parte
   * que interessa: uma região que se sabia tapada continua tapada enquanto o
   * mapa não voltar, em vez de se abrir sozinha no minuto em que a API tosse.
   *
   * A janela que fica é o arranque a frio com a API em baixo: aí não há mapa
   * nenhum, `dominios` está vazio, e um Host desconhecido leva a página do
   * produto — não a agenda de ninguém. Só uma instalação com
   * `REGIAO_DE_OMISSAO` no ambiente serviria a região principal nesse estado,
   * e essa escotilha existe para o CI e para quem bate por endereço IP.
   */
  barreiras: Record<string, boolean>;
  expira: number;
}

let guardado: MapaGuardado | null = null;

/** Só para os testes: esquece o mapa guardado. */
export function esquecerMapaDeDominios(): void {
  guardado = null;
}

/**
 * As duas caras do mapa, com uma leitura só e memória de módulo.
 *
 * Vem de `/api/regioes` — a rota ISR com a etiqueta `regions` — e fica
 * guardado cinco minutos por instância do middleware: uma região nova entra
 * em produção sem deploy, com no máximo cinco minutos de espera. Uma falha
 * devolve o vazio (nada redireciona, e todos os hosts passam a desconhecidos
 * — a página do produto, nunca a agenda de outra região) e volta a tentar-se
 * em segundos.
 *
 * Um domínio canónico entra em `dominios` (serve a sua região); um alias
 * (0111) entra em `redirecionamentos` (manda para o canónico e nunca serve —
 * dois endereços com o mesmo conteúdo era conteúdo duplicado).
 *
 * A leitura tem prazo (`PRAZO_DO_MAPA_MS`) e o prazo é a parte que faltava:
 * uma resposta que nunca chega não é uma falha do ponto de vista do `fetch`,
 * e sem `signal` ficava a segurar todos os pedidos de todos os domínios.
 * Esgotado o prazo, o `AbortSignal.timeout` atira e cai no mesmo `catch` de
 * sempre — que serve o mapa velho, se existir, e o vazio se não.
 */
async function carregarMapa(
  origem: string,
  buscar: typeof fetch,
  agora: () => number,
): Promise<MapaGuardado> {
  if (guardado && guardado.expira > agora()) return guardado;

  try {
    const resposta = await buscar(`${origem}/api/regioes`, {
      signal: AbortSignal.timeout(PRAZO_DO_MAPA_MS),
    });
    if (!resposta.ok) throw new Error(`estado ${resposta.status}`);
    const linhas = (await resposta.json()) as Array<{
      id: string;
      domain: string;
      aliases?: string[];
      barreira?: boolean;
    }>;
    const dominios: Record<string, string> = {};
    const redirecionamentos: Record<string, string> = {};
    const barreiras: Record<string, boolean> = {};
    for (const linha of linhas) {
      const host = normalizarHost(linha.domain);
      if (!host || !linha.id) continue;
      dominios[host] = linha.id;
      if (linha.barreira === true) barreiras[linha.id] = true;
      for (const alias of linha.aliases ?? []) {
        const hostDoAlias = normalizarHost(alias);
        if (hostDoAlias && hostDoAlias !== host) redirecionamentos[hostDoAlias] = host;
      }
    }
    guardado = { dominios, redirecionamentos, barreiras, expira: agora() + VALIDADE_DO_MAPA_MS };
  } catch {
    guardado = {
      dominios: guardado?.dominios ?? {},
      redirecionamentos: guardado?.redirecionamentos ?? {},
      barreiras: guardado?.barreiras ?? {},
      expira: agora() + VALIDADE_APOS_FALHA_MS,
    };
  }
  return guardado;
}

/** O mapa domínio canónico → região. */
export async function dominiosDasRegioes(
  origem: string,
  buscar: typeof fetch = fetch,
  agora: () => number = Date.now,
): Promise<Record<string, string>> {
  return (await carregarMapa(origem, buscar, agora)).dominios;
}

/** As regiões com barreira de senha, por identificador (0157). */
export async function barreirasDasRegioes(
  origem: string,
  buscar: typeof fetch = fetch,
  agora: () => number = Date.now,
): Promise<Record<string, boolean>> {
  return (await carregarMapa(origem, buscar, agora)).barreiras;
}

/** O mapa alias → domínio canónico, para o middleware redirecionar (308). */
export async function redirecionamentosDosDominios(
  origem: string,
  buscar: typeof fetch = fetch,
  agora: () => number = Date.now,
): Promise<Record<string, string>> {
  return (await carregarMapa(origem, buscar, agora)).redirecionamentos;
}
