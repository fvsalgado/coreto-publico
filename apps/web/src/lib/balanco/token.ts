import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * O segredo que abre o balanço de uma região.
 *
 * **O segredo em claro nunca chega à base de dados.** É gerado aqui, dito uma
 * vez a quem o pediu, e o que se guarda é o sha256 — não está numa coluna,
 * não passa por parâmetro de função, não pode aparecer num plano de consulta
 * nem num registo de consultas lentas. A 0151 escreve a mesma frase do lado
 * de lá.
 *
 * **Sha256 e não scrypt, e é uma escolha.** O `password.ts` do painel usa
 * `scrypt` porque uma palavra-passe humana tem pouca entropia e o custo de
 * derivação é o que a defende. Isto são 32 bytes aleatórios: a força bruta
 * não é viável contra eles a hash nenhuma, e um custo de derivação por pedido
 * só atrasaria quem tem o direito de entrar.
 */

/** 32 bytes em base64url — 43 caracteres, e nenhum precisa de escape num endereço. */
export const COMPRIMENTO_DO_SEGREDO = 43;

const FORMA = /^[A-Za-z0-9_-]{43}$/;

/** Um segredo novo. Dito uma vez, guardado nunca. */
export function gerarSegredo(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * O sha256 do segredo, em hexadecimal minúsculo.
 *
 * É o que a 0151 guarda e o que ela compara. A forma é validada antes de se
 * calcular seja o que for: um parâmetro estranho não tem que ir passear pelo
 * índice, e devolver `null` faz o chamador tratá-lo como «não abre» — a mesma
 * resposta que um segredo errado. Distinguir os dois dizia a quem tenta se
 * acertou na forma.
 */
export function impressaoDoSegredo(segredo: string | null | undefined): string | null {
  if (!segredo || !FORMA.test(segredo)) return null;
  return createHash('sha256').update(segredo, 'utf8').digest('hex');
}

/**
 * Comparação em tempo constante, para quando houver dois segredos para
 * comparar do lado do sítio.
 *
 * Hoje quem compara é a base, pelo índice único, e por isso isto não está no
 * caminho de pedido nenhum. Fica escrito para o dia em que alguém precise de
 * comparar dois segredos aqui e a tentação for o `===`, que responde mais
 * depressa quando os primeiros caracteres diferem.
 */
export function segredosIguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
