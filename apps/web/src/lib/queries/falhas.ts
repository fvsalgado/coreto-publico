import 'server-only';
import { reportarErro } from '../registo';

/**
 * «Não há nada» e «não consegui saber» são duas respostas diferentes.
 *
 * Durante muito tempo foram a mesma coisa: cerca de vinte leituras desta
 * pasta faziam `console.error` e devolviam `[]`, `{}` ou `null` quando a
 * consulta ao Supabase errava. Visto de fora, o vazio de um erro era
 * indistinguível do vazio de uma agenda sem eventos — e as páginas, que só
 * veem o valor, tratavam-nos igual.
 *
 * Isso, sozinho, ainda era só uma imprecisão. O que a torna grave é que estas
 * leituras vivem todas dentro de `unstable_cache` com uma hora de validade:
 * **o vazio do erro ficava guardado uma hora como se fosse verdade**. Um
 * soluço de dois segundos na base de dados comprava sessenta minutos de
 * mentira — a agenda a dizer «Sem resultados para estes filtros: alargue o
 * intervalo de datas», que culpa quem visita por uma falha nossa e dá um
 * conselho que não pode funcionar; `/concelho/<id>` a responder 404 nos onze
 * concelhos, e com eles os feeds, o `.ics` e os widgets já embebidos nos
 * sítios das câmaras; e, no pior dos casos, o domínio inteiro de uma CIM a
 * responder 404 porque a linha da região não se leu — 404 que o ISR guarda.
 *
 * A saída está numa propriedade do `unstable_cache` que foi confirmada no
 * código instalado (Next 16.3.3, em
 * `node_modules/next/dist/server/web/spec-extension/unstable-cache.js`): a
 * escrita na cache (`cacheNewResult`, linhas 232 e 270) só acontece **depois**
 * do `await` da callback (linhas 224 e 266). Uma callback que lança nunca lá
 * chega: o erro sai por cima e não fica guardado nada. E quando já existe uma
 * entrada velha, a revalidação em erro devolve o valor velho em vez de o
 * substituir (linhas 193-198) — servir o de ontem é degradação honesta, e
 * também não guarda o erro. `falhas.test.ts` prova isto a correr contra o
 * `unstable_cache` real, porque uma decisão de arquitetura assente na leitura
 * do código de terceiros tem de ser uma decisão verificada.
 *
 * Daí a regra da casa, agora:
 *
 * 1. **Dentro da função cacheada, um erro de leitura lança.** Sempre, e é
 *    `exigirLeitura` que o garante. Nunca se devolve vazio por causa de um
 *    erro, porque esse vazio é o que a cache guarda.
 * 2. **Degradar continua a ser a regra — mas decide-se de fora.** Quem chama
 *    envolve a função já cacheada em `degradarForaDaCache` e escolhe o valor
 *    de recurso. O erro é apanhado fora da cache, portanto não se guarda: o
 *    pedido seguinte volta a tentar, e recupera assim que a base voltar.
 *
 * O que **não** muda, e não é para mudar: sem base de dados configurada
 * (`publicClient()` devolve `null`), cada leitura continua a devolver vazio
 * sem erro nenhum. Isso não é uma falha — é uma instalação sem credenciais, o
 * CI, um fork, um `next build` sem segredos — e o sítio serve na mesma. A
 * lição desta casa é degradar em vez de rebentar; o que se corrige aqui é
 * degradar **e guardar a degradação**, que é outra coisa e não estava
 * decidida por ninguém.
 */

/**
 * O erro de uma leitura que não chegou a acontecer.
 *
 * Tem tipo próprio por duas razões. A primeira é o registo: o nome da leitura
 * viaja com o erro, e quem o apanha três camadas acima continua a saber qual
 * foi a consulta que falhou. A segunda é o teste: com um tipo próprio, um
 * teste pode afirmar «isto rebentou» em vez de «isto devolveu vazio» — que é
 * exatamente a distinção que este ficheiro existe para fazer.
 */
export class ErroDeLeitura extends Error {
  constructor(
    /** O nome da leitura, tal como aparece nos registos. */
    readonly leitura: string,
    causa: string,
  ) {
    super(`${leitura}: ${causa}`);
    this.name = 'ErroDeLeitura';
  }
}

/**
 * O guarda de cada consulta, na linha a seguir ao `await`.
 *
 * Um `error` do Supabase deixa de ser um valor que se regista e se ignora e
 * passa a ser uma exceção. Chama-se `exigir…` como o `exigirRegiao` e o
 * `exigirSeccao`: à frente dele, o resto da função já pode confiar nos dados.
 */
export function exigirLeitura(leitura: string, erro: { message: string } | null | undefined): void {
  if (erro) throw new ErroDeLeitura(leitura, erro.message);
}

/**
 * O código com que o PostgREST recusa um intervalo que começa depois do fim.
 *
 * Vem de `Error.hs` do PostgREST e chega em `error.code`, com um 416 por
 * estado. É o único erro desta casa que **não** é uma avaria: significa que a
 * pergunta foi bem feita e a resposta é «não há nada aí».
 */
const ALEM_DO_FIM = 'PGRST103';

/**
 * Uma página além do fim, que é uma pergunta com resposta e não um erro.
 *
 * `/agenda?page=99` numa região com três páginas respondia 500 — um endereço
 * que qualquer rastreador constrói sozinho a partir da paginação, e que ia
 * parar ao registo de erros ao lado das avarias a sério. A resposta certa é a
 * lista vazia com o total verdadeiro: a agenda tem 128 eventos e a página 99
 * não tem nenhum.
 *
 * Distingue-se pelo código e não pela mensagem, que muda com a versão e com a
 * língua. Quem chama decide o que fazer com o total — a lista vazia por si só
 * não o traz, porque o supabase-js só lê a contagem do cabeçalho de uma
 * resposta com sucesso.
 */
export function ehPaginaAlemDoFim(erro: { code?: string } | null | undefined): boolean {
  return erro?.code === ALEM_DO_FIM;
}

/**
 * Degradar sem guardar a degradação.
 *
 * Envolve uma leitura **já cacheada**: o erro vem de dentro da cache — onde,
 * por ter lançado, não ficou guardado — e é aqui, do lado de fora, que se
 * decide devolver o valor de recurso. É a mesma degradação silenciosa de
 * sempre, com um tempo de vida de zero em vez de uma hora.
 *
 * A escolha de a usar (ou de deixar o erro subir até à fronteira de
 * `app/[regiao]/error.tsx`) é caso a caso, e cada caso tem a sua razão
 * escrita ao lado. A regra que as separa: degrada o que só dá nome, número ou
 * contorno ao que já está na página; propaga o que é o assunto da página, ou
 * a lista fechada por onde se valida — porque aí o vazio faz a página mentir
 * ou desaparecer, e uma página de erro honesta é melhor do que uma agenda
 * vazia falsa.
 *
 * O recurso entra como função e não como valor por uma razão pequena: um `[]`
 * ou um `{}` partilhado por todas as chamadas é um objeto que um dia alguém
 * altera sem reparar, e o engano seria invisível.
 *
 * O `NoInfer` no recurso não é um floreado de tipos: sem ele, um `() => ({})`
 * arrastava o tipo de saída para `{}` e o dicionário de nomes de espaços
 * deixava de se poder indexar por `string` do outro lado. Quem manda no tipo é
 * a leitura; o recurso só tem de caber nele.
 */
export function degradarForaDaCache<A extends unknown[], T>(
  leitura: string,
  cacheada: (...args: A) => Promise<T>,
  recurso: () => NoInfer<T>,
): (...args: A) => Promise<T> {
  return async (...args: A): Promise<T> => {
    try {
      return await cacheada(...args);
    } catch (erro) {
      // A mensagem do `ErroDeLeitura` já traz o nome da consulta que falhou;
      // o nome de quem degradou vai à frente, e assim o registo diz as duas
      // pontas — quem pediu e o que não veio.
      reportarErro(leitura, erro);
      return recurso();
    }
  };
}
