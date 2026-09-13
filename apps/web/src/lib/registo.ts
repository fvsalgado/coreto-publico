import 'server-only';

/**
 * Onde é que os erros deste sítio vão dar.
 *
 * Havia quarenta e duas chamadas a `console.error` espalhadas, e todas
 * terminavam no mesmo sítio: os registos de runtime da Vercel, com retenção
 * curta, sem agrupamento, sem contagem e sem alerta. Para a maior parte do
 * software isso seria uma preguiça tolerável. Aqui não é, e a razão está na
 * própria filosofia da casa: **degradar em vez de partir**. O limitador de
 * tráfego deixa passar quando a base cai; `listRegionsAdmin` devolve vazio;
 * `receiveSubmission` regista e segue. Nada disto tem sintoma visível — é
 * exatamente o desenho em que um defeito vive semanas sem ninguém dar por ele.
 *
 * Degradar sem contar é degradar às escuras. Este módulo é onde se conta.
 *
 * **O que faz.** Escreve uma linha por erro, em JSON, no `stderr` — uma linha
 * por evento, para um agregador a poder ler sem adivinhar onde acaba o
 * registo anterior. E, se houver `ERROS_WEBHOOK_URL` configurada, manda-lhe o
 * mesmo objeto. Serve um ntfy, um Sentry por trás de um proxy, uma função de
 * borda que reencaminhe — o que estiver do outro lado é decisão de operação,
 * não de código.
 *
 * **O que não faz, de propósito.** Não traz SDK nenhum. Um `@sentry/nextjs`
 * instalado sem DSN é uma dependência a mais no pacote e um passo a mais na
 * compilação, a fazer nada; e com DSN no cliente obrigava a mexer na CSP (o
 * mesmo erro silencioso já documentado para o PostHog) e tornava falsa a
 * frase da política de privacidade sobre não correr ferramentas de terceiros.
 * O que este módulo garante é a **costura**: no dia em que o Sentry entrar, é
 * aqui — numa função, não em quarenta e dois sítios.
 *
 * **A regra que não se quebra:** isto nunca lança. É chamado de dentro de
 * blocos `catch`, e um relator que rebenta a relatar transforma uma
 * degradação silenciosa num 500 — que é precisamente o contrário do que se
 * quer.
 *
 * **O que fica de fora, e é uma lacuna conhecida:** as três fronteiras de erro
 * do navegador (`app/global-error.tsx`, `app/[regiao]/error.tsx`,
 * `app/admin/error.tsx`) continuam a fazer `console.error`. São componentes de
 * cliente, e este módulo é `server-only` de propósito — mandá-lo para o
 * navegador punha o `ERROS_WEBHOOK_URL` no pacote de toda a gente. Cobrir o
 * lado do cliente é uma decisão diferente, com CSP e política de privacidade
 * pelo meio, e toma-se de propósito e não de passagem.
 */

/** O que acompanha um erro sem nunca ser um segredo — ver `sanear`. */
export type ContextoDoErro = Record<string, string | number | boolean | null | undefined>;

interface RegistoDeErro {
  nivel: 'erro';
  operacao: string;
  mensagem: string;
  tipo?: string;
  pilha?: string;
  contexto?: ContextoDoErro;
  em: string;
}

/**
 * O endereço para onde os erros também vão, quando existe.
 *
 * Lido a cada chamada e não no arranque do módulo: em desenvolvimento a
 * variável aparece com o servidor já a correr, e um valor capturado uma vez
 * ficava desatualizado sem sintoma.
 */
function webhook(): string | null {
  const url = process.env.ERROS_WEBHOOK_URL?.trim();
  return url ? url : null;
}

/**
 * A mensagem de uma coisa que foi atirada, seja ela o que for.
 *
 * Um `catch` em TypeScript apanha `unknown`, e o que lá chega tanto é um
 * `Error` como a string de um `PostgrestError` como, num mau dia, `undefined`.
 */
function mensagemDe(causa: unknown): string {
  if (causa instanceof Error) return causa.message;
  if (typeof causa === 'string') return causa;
  if (causa && typeof causa === 'object' && 'message' in causa) {
    return String((causa as { message: unknown }).message);
  }
  return String(causa);
}

/**
 * Corta o contexto ao que é seguro escrever num registo.
 *
 * Duas regras. Os valores longos são truncados, porque um registo com o corpo
 * inteiro de um email lá dentro deixa de ser um registo e passa a ser uma
 * cópia dos dados de quem submeteu. E qualquer chave cujo nome cheire a
 * credencial sai — não porque alguém a vá lá pôr de propósito, mas porque um
 * dia alguém passa o objeto todo em vez do campo, e a diferença entre um
 * registo e uma fuga é essa distração.
 */
const CHAVES_PROIBIDAS = /(secret|token|password|passe|key|chave|authorization|cookie)/i;
const LIMITE_DO_VALOR = 200;

function sanear(contexto: ContextoDoErro | undefined): ContextoDoErro | undefined {
  if (!contexto) return undefined;
  const limpo: ContextoDoErro = {};
  for (const [chave, valor] of Object.entries(contexto)) {
    if (valor === undefined) continue;
    if (CHAVES_PROIBIDAS.test(chave)) {
      limpo[chave] = '[omitido]';
      continue;
    }
    limpo[chave] =
      typeof valor === 'string' && valor.length > LIMITE_DO_VALOR
        ? `${valor.slice(0, LIMITE_DO_VALOR)}…`
        : valor;
  }
  return Object.keys(limpo).length > 0 ? limpo : undefined;
}

/**
 * Manda o registo para o webhook sem segurar a resposta de ninguém.
 *
 * `after()` é o que a Vercel precisa para não matar o pedido antes de o envio
 * sair — sem ele, um `fetch` largado numa função sem servidor morre com a
 * resposta. Mas `after()` só existe dentro de um pedido, e este módulo também
 * é chamado no arranque (ver `env.ts`): daí o `try`. Falhar a enviar nunca é
 * motivo para falhar o que estava a acontecer.
 */
function enviar(registo: RegistoDeErro, destino: string): void {
  const entregar = async (): Promise<void> => {
    try {
      await fetch(destino, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registo),
        // Um relator que espera trinta segundos por um coletor em baixo é um
        // relator que passa a ser o problema.
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Sem segunda tentativa e sem registo do falhanço: um erro a relatar o
      // erro de relatar um erro é um ciclo, e a linha no stderr já saiu.
    }
  };

  void import('next/server')
    .then(({ after }) => {
      try {
        after(entregar());
      } catch {
        void entregar();
      }
    })
    .catch(() => {
      void entregar();
    });
}

/**
 * Regista um erro que não interrompeu nada — o caso normal desta casa.
 *
 * `operacao` é o nome de quem falhou, e é o que agrupa: a mesma cadeia em
 * todas as chamadas do mesmo sítio, para um agregador poder contar «isto
 * falhou trezentas vezes desde as duas da manhã» em vez de mostrar trezentas
 * linhas diferentes. É por isso que são nomes de função e de RPC —
 * `listSiteSections`, `rate_limit_hit` — e não frases.
 */
export function reportarErro(operacao: string, causa: unknown, contexto?: ContextoDoErro): void {
  try {
    const registo: RegistoDeErro = {
      nivel: 'erro',
      operacao,
      mensagem: mensagemDe(causa),
      em: new Date().toISOString(),
    };

    if (causa instanceof Error) {
      registo.tipo = causa.name;
      if (causa.stack) registo.pilha = causa.stack;
    }

    const limpo = sanear(contexto);
    if (limpo) registo.contexto = limpo;

    // Uma linha, e JSON: é o que um log drain consegue ler sem adivinhar onde
    // acaba o registo anterior. Continua legível a olho, que é o que faz falta
    // às três da manhã na consola da Vercel.
    console.error(JSON.stringify(registo));

    const destino = webhook();
    if (destino) enviar(registo, destino);
  } catch {
    // O último recurso: se nem isto correr, ao menos fica o nome.
    try {
      console.error(`erro a registar «${operacao}»`);
    } catch {
      /* não há mais nada a fazer aqui */
    }
  }
}
