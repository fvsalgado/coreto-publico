/**
 * O estado da casa, em números que se podem publicar.
 *
 * Isto responde a uma pergunta concreta e a uma só: **a agenda desta região
 * está a ser alimentada?** Não responde a «o sítio está de pé» — essa não se
 * responde de dentro do sítio, e a página que usa este módulo diz-lo por
 * extenso em vez de fingir que sim.
 *
 * O que aqui está é lógica pura, sem base de dados e sem React, porque é isto
 * que decide se uma CIM lê «está tudo bem» ou «há três fontes paradas». Um
 * limiar errado aqui não estraga um ecrã: dá sossego a quem devia estar
 * preocupado.
 */

/**
 * Duas noites. É o limiar, e vem da máquina e não do gosto.
 *
 * A recolha corre uma vez por dia (`.github/workflows/scrape.yml`, 03:20 UTC).
 * Uma fonte lida ontem está em dia; uma fonte que não é lida com sucesso há
 * mais de dois dias falhou **duas** rondas seguidas, e duas rondas seguidas já
 * não é o portal da câmara a estar em manutenção uma noite.
 */
export const DIAS_ATE_ATRASO = 2;

/**
 * Uma semana sem uma leitura boa é uma fonte parada, não uma fonte lenta.
 *
 * O disjuntor da recolha pausa uma fonte ao fim de cinco falhas seguidas
 * (`FALHAS_ATE_PAUSA`, em `@coreto/core`) e volta a tentar 24 horas depois.
 * Sete dias é esse ciclo inteiro a não dar resultado — o sítio mudou de forma,
 * mudou de endereço, ou deixou de existir. Nenhuma dessas se resolve
 * esperando mais.
 */
export const DIAS_ATE_PARAGEM = 7;

export type SaudeDaFonte = 'em-dia' | 'atrasada' | 'parada' | 'por-estrear';

/** O que uma página precisa de saber de uma fonte para dizer como ela está. */
export interface FonteVigiada {
  id: string;
  name: string;
  is_enabled: boolean;
  last_success_at: string | null;
  /**
   * Quando foi tentada, com ou sem sucesso (concedida ao público na 0128).
   *
   * A saúde não se decide por aqui — decide-se pela última leitura **boa** —,
   * mas a frase sim, e é uma diferença que importa a quem lê: uma fonte que
   * ninguém tenta ler há cinco dias é um cron parado; uma fonte lida todas as
   * noites que não traz nada é uma câmara que mudou de tema. As duas
   * aparecem como «atrasada», e só esta coluna as separa.
   */
  last_run_at: string | null;
  /**
   * O leitor que sabe ler esta fonte, público desde a 0139 — e `null` quando
   * quem chama não o tem (a `/fontes` não precisa dele).
   *
   * Não decide saúde nenhuma: decide se oito avarias são oito ou uma.
   */
  adapter?: string | null;
}

/** Dias inteiros entre dois instantes. Trunca: meio dia não é um dia. */
function diasDesde(instante: string, agora: Date): number {
  const quando = new Date(instante).getTime();
  if (Number.isNaN(quando)) return Number.POSITIVE_INFINITY;
  return Math.floor((agora.getTime() - quando) / 86_400_000);
}

/**
 * Como está uma fonte, pela última vez que foi lida com sucesso.
 *
 * **`por-estrear` não é `parada`**, e a distinção é o que evita um alarme
 * falso de cada vez que uma CIM nasce: uma fonte acabada de ligar no painel
 * ainda não tem leitura nenhuma, e dizer que está parada é dizer que está
 * avariada uma coisa que nunca chegou a arrancar. Quem lê a página precisa de
 * saber qual dos dois é — a primeira espera-se, a segunda arranja-se.
 */
export function saudeDaFonte(ultimaLeitura: string | null, agora: Date): SaudeDaFonte {
  if (!ultimaLeitura) return 'por-estrear';
  const dias = diasDesde(ultimaLeitura, agora);
  if (dias <= DIAS_ATE_ATRASO) return 'em-dia';
  if (dias <= DIAS_ATE_PARAGEM) return 'atrasada';
  return 'parada';
}

export interface FonteComSaude extends FonteVigiada {
  saude: SaudeDaFonte;
  /** Dias desde a última leitura boa; `null` numa fonte por estrear. */
  dias: number | null;
}

export interface EstadoDaRecolha {
  /** Só as fontes ligadas: uma fonte desligada no painel não está avariada. */
  vigiadas: FonteComSaude[];
  emDia: FonteComSaude[];
  atrasadas: FonteComSaude[];
  paradas: FonteComSaude[];
  porEstrear: FonteComSaude[];
}

/**
 * As fontes ligadas, arrumadas pelo tempo que levam sem uma leitura boa.
 *
 * **As desligadas não entram, e não é para melhorar o número.** Uma fonte
 * desligada é uma decisão de quem administra — o portal fechou, o município
 * pediu, a câmara passou a publicar noutro sítio. Contá-la como parada era
 * transformar todas essas decisões em avarias por publicar, e uma página de
 * estado que grita por coisas que ninguém vai arranjar é uma página que se
 * deixa de ler.
 */
export function avaliarRecolha(
  fontes: readonly FonteVigiada[],
  agora: Date = new Date(),
): EstadoDaRecolha {
  const vigiadas: FonteComSaude[] = fontes
    .filter((fonte) => fonte.is_enabled)
    .map((fonte) => ({
      ...fonte,
      saude: saudeDaFonte(fonte.last_success_at, agora),
      dias: fonte.last_success_at ? diasDesde(fonte.last_success_at, agora) : null,
    }));

  const das = (saude: SaudeDaFonte) => vigiadas.filter((fonte) => fonte.saude === saude);

  return {
    vigiadas,
    emDia: das('em-dia'),
    atrasadas: das('atrasada'),
    paradas: das('parada'),
    porEstrear: das('por-estrear'),
  };
}

/**
 * A frase que descreve uma fonte, escrita uma vez e usada nas duas páginas.
 *
 * Existe porque as duas discordavam. A `/estado` classificava pela última
 * leitura boa; a `/fontes` escrevia «Lida com sucesso a …» a partir da mesma
 * coluna sem a classificar, e por isso dizia a mesma coisa de uma fonte lida
 * ontem e de uma fonte parada há três semanas — só mudava a data, que ninguém
 * compara com o dia de hoje de cabeça. Duas páginas a ler a mesma coluna e a
 * dizer coisas diferentes sobre ela é como se perde a confiança nas duas.
 *
 * O texto do erro não entra aqui, e é uma decisão. O `sources.last_error`
 * guarda o diário da recolha — endereços, cabeçalhos, mensagens do servidor
 * da câmara — e está fechado à chave pública desde a 0049. O que uma página
 * pública deve dizer é o **estado**, e o estado diz-se com duas datas.
 *
 * Recebe a data por parâmetro (`formatarData`) para não arrastar o
 * formatador — e com ele o `Intl` — para um módulo que é lógica pura e é
 * testado sem ele.
 */
export function fraseDaFonte(fonte: FonteComSaude, formatarData: (iso: string) => string): string {
  const lidaEm = fonte.last_run_at ? formatarData(fonte.last_run_at.slice(0, 10)) : null;
  const boaEm = fonte.last_success_at ? formatarData(fonte.last_success_at.slice(0, 10)) : null;

  if (fonte.saude === 'em-dia' && boaEm) return `Lida com sucesso a ${boaEm}.`;

  // O caso que a coluna nova existe para dizer: a fonte é lida e não traz
  // nada. Antes disto, a página escrevia «Lida com sucesso a 2 de setembro» e
  // ficava por aí, semanas a fio, com o concelho sem agenda nenhuma.
  if (boaEm && lidaEm) return `Lida a ${lidaEm}, mas sem eventos legíveis desde ${boaEm}.`;
  if (boaEm) return `Sem uma leitura com sucesso desde ${boaEm}.`;
  if (lidaEm) return `Lida a ${lidaEm}, e ainda sem eventos legíveis.`;
  return 'Ainda não foi lida.';
}

export interface EstadoDaAgenda {
  /** Eventos por vir na região inteira. */
  total: number;
  /** Os concelhos sem nada marcado, pelo nome, por ordem alfabética. */
  vazios: string[];
}

/**
 * A agenda que está para vir, e os concelhos que estão a zero.
 *
 * É a outra metade da pergunta, e a que apanha o que a primeira deixa passar:
 * uma fonte pode ser lida todas as noites com sucesso e trazer zero eventos
 * porque a câmara mudou o desenho da página. A recolha diz «li»; só a
 * contagem diz «li e não veio nada».
 */
export function avaliarAgenda(
  concelhos: ReadonlyArray<{ id: string; name: string }>,
  contagens: Readonly<Record<string, number>>,
): EstadoDaAgenda {
  return {
    total: concelhos.reduce((soma, concelho) => soma + (contagens[concelho.id] ?? 0), 0),
    vazios: concelhos
      .filter((concelho) => (contagens[concelho.id] ?? 0) === 0)
      .map((concelho) => concelho.name)
      .sort((a, b) => a.localeCompare(b, 'pt')),
  };
}

export type Grau = 'bom' | 'atencao' | 'mau';

export interface Veredito {
  grau: Grau;
  frase: string;
}

/**
 * A frase do topo — a única coisa que muita gente vai ler.
 *
 * A ordem é a da gravidade e não a da comodidade: primeiro o que está partido,
 * depois o que está a ficar, e só no fim o sossego. Uma página de estado que
 * abre com «tudo bem» e esconde o problema num parágrafo mais abaixo é um
 * painel verde por cima de uma luz vermelha.
 *
 * **Uma agenda vazia é `mau` mesmo com as fontes todas em dia**, porque é
 * exatamente esse o caso que ninguém apanha: as leituras correm, os números
 * de erro estão a zero, e não há nada para mostrar a quem visita.
 */
export function veredito(recolha: EstadoDaRecolha, agenda: EstadoDaAgenda): Veredito {
  if (recolha.vigiadas.length === 0) {
    return { grau: 'atencao', frase: 'Não há nenhuma fonte ligada nesta região.' };
  }

  if (agenda.total === 0) {
    return { grau: 'mau', frase: 'Não há um único evento marcado daqui para a frente.' };
  }

  if (recolha.paradas.length > 0) {
    const quantas = recolha.paradas.length;
    return {
      grau: 'mau',
      frase:
        quantas === 1
          ? 'Há uma fonte sem ser lida com sucesso há mais de uma semana.'
          : `Há ${quantas} fontes sem serem lidas com sucesso há mais de uma semana.`,
    };
  }

  if (recolha.atrasadas.length > 0) {
    const quantas = recolha.atrasadas.length;
    return {
      grau: 'atencao',
      frase:
        quantas === 1
          ? 'Há uma fonte que falhou as últimas rondas.'
          : `Há ${quantas} fontes que falharam as últimas rondas.`,
    };
  }

  return {
    grau: 'bom',
    frase: 'Todas as fontes ligadas foram lidas com sucesso nas últimas 48 horas.',
  };
}

/**
 * Quantas fontes daquele leitor estão caladas para o caso valer uma frase.
 *
 * Duas. Uma fonte calada é uma fonte calada; duas do mesmo produto na mesma
 * noite já é um padrão, e é o padrão que muda o que se faz a seguir.
 */
export const CALADAS_ATE_PADRAO = 2;

export interface FamiliaCalada {
  /** O nome do leitor, tal como a base o guarda. */
  adapter: string;
  /** Fontes ligadas que correm este leitor. */
  total: number;
  /** Dessas, as que foram tentadas depois da última leitura boa. */
  caladas: number;
  /** Os nomes das caladas, por ordem, para a página as poder dizer. */
  nomes: string[];
}

/**
 * Os leitores cujas fontes se calaram quase todas ao mesmo tempo.
 *
 * **Porquê.** A 12 e 13 de setembro de 2026, oito fontes do Médio Tejo não
 * responderam a um único pedido nas duas noites, enquanto as 26 juntas de
 * freguesia responderam a todos. Sete das oito correm o mesmo leitor; a oitava
 * é o CAMINHOS. Nos catorze dias anteriores, nenhuma. A `/estado` mostrava
 * oito linhas de «sem leitura com sucesso desde 11 de setembro» e deixava a
 * quem lê o trabalho de descobrir o que elas tinham em comum.
 *
 * Oito domínios a calarem-se na mesma noite não são oito avarias: é uma, e
 * quase de certeza do lado de lá. A diferença não é cosmética — oito avarias
 * mandam abrir oito adaptadores, uma avaria manda escrever a um fornecedor.
 *
 * **Porque é que a saúde não serve aqui, e foi uma fixture que mo mostrou.**
 * `saudeDaFonte` só chama «atrasada» a uma fonte ao terceiro dia sem leitura
 * boa — `DIAS_ATE_ATRASO` é 2, e é tolerância deliberada para uma noite falhada
 * não acender a página. No caso real, as oito estavam mudas há duas noites e a
 * `/estado` chamava-lhes «em dia»: a tolerância que serve para uma fonte
 * esconde exatamente o padrão de oito.
 *
 * Por isso o sinal daqui é outro, e é o que a 0128 pôs na base de propósito:
 * **tentada depois da última leitura boa**. `last_run_at` > `last_success_at` é
 * a fonte a ter sido lida e a não ter trazido nada, e diz-se na primeira noite,
 * não na terceira. O que impede o ruído não é o tempo — é a família: duas, e
 * metade do leitor.
 *
 * **O que isto não faz.** Não diz de quem é a culpa nem propõe dar a volta. A
 * regra da casa é anterior a esta função: contornar um bloqueio não é
 * recolher. O que aqui se produz é o nome do padrão, para quem decide o poder
 * ver.
 */
export function tentadaESemTrazerNada(fonte: FonteVigiada): boolean {
  if (!fonte.last_run_at) return false;
  if (!fonte.last_success_at) return true;
  return new Date(fonte.last_run_at).getTime() > new Date(fonte.last_success_at).getTime();
}

export function familiasCaladas(recolha: EstadoDaRecolha): FamiliaCalada[] {
  const porLeitor = new Map<string, { total: number; caladas: FonteComSaude[] }>();

  for (const fonte of recolha.vigiadas) {
    const leitor = fonte.adapter;
    // Sem o nome do leitor não há família: uma fonte que não o traz não conta
    // para nenhum lado, em vez de fazer família com as outras que também não
    // o trazem.
    if (!leitor) continue;
    const entrada = porLeitor.get(leitor) ?? { total: 0, caladas: [] };
    entrada.total += 1;
    if (tentadaESemTrazerNada(fonte)) entrada.caladas.push(fonte);
    porLeitor.set(leitor, entrada);
  }

  return (
    [...porLeitor.entries()]
      .filter(([, dados]) => dados.caladas.length >= CALADAS_ATE_PADRAO)
      // Metade do leitor calado, ou mais. Duas em vinte e seis é ruído normal
      // de dois sítios em baixo; duas em três é o produto.
      .filter(([, dados]) => dados.caladas.length * 2 >= dados.total)
      .map(([adapter, dados]) => ({
        adapter,
        total: dados.total,
        caladas: dados.caladas.length,
        nomes: dados.caladas.map((fonte) => fonte.name),
      }))
      .sort((a, b) => b.caladas - a.caladas || a.adapter.localeCompare(b.adapter, 'pt'))
  );
}
