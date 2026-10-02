/**
 * O cartaz de um evento como imagem de fundo.
 *
 * A capa desenhada foi feita para aguentar a morte dos endereços: quase todos
 * os eventos publicados apontam para uma imagem alojada em casa de quem
 * organiza — vinte e um servidores de câmaras e de juntas —, e num gestor de
 * conteúdos municipal esses endereços morrem: muda-se o tema, arruma-se a
 * pasta do ano, e o cartaz de julho deixa de responder. Quando isso acontece
 * devia ficar a capa tipográfica que está por baixo, limpa.
 *
 * Não ficava. Com o cartaz num `<img>`, o Chromium desenha o ícone de imagem
 * partida por cima da capa — e desenha-o mesmo com `alt=""`, o que foi medido
 * neste browser e não presumido. O `alt` vazio impede que o texto alternativo
 * seja pintado por cima; não impede o ícone.
 *
 * Um `background-image` que falha não desenha coisa nenhuma. É a semântica
 * que esta capa precisa, e é também a arrumação certa: estas imagens são
 * decorativas de ponta a ponta — a capa inteira é `aria-hidden`, e o título
 * do evento está sempre escrito ao lado. Uma imagem decorativa pertence ao
 * CSS; era o `<img>` que estava fora do sítio.
 */

/** Só endereços de rede. Um `javascript:` ou um `data:` não é um cartaz. */
const ENDERECO_DE_REDE = /^https?:\/\//i;

/**
 * `url("…")` pronto a entrar em `background-image`, ou `undefined`.
 *
 * As aspas e as barras invertidas vão escapadas: sem isso um endereço com
 * aspas fecha a cadeia e o browser deita fora a declaração inteira — o cartaz
 * desaparecia por causa de um caractere. Quebras de linha e caracteres de
 * controlo saem fora pela mesma razão.
 */
export function posterBackground(url: string | null | undefined): string | undefined {
  if (!url || !ENDERECO_DE_REDE.test(url)) return undefined;

  const limpo = url.replace(/[\u0000-\u001f\u007f]/g, '');
  if (!ENDERECO_DE_REDE.test(limpo)) return undefined;

  return `url("${limpo.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
}

/**
 * O rácio a partir do qual um cartaz é «deitado»: um quinto mais largo do que
 * alto. Os quadrados ficam de fora de propósito — são, quase sempre,
 * publicações de rede social com texto até às bordas, e cortá-los cortava
 * palavras.
 */
const DEITADO = 1.2;

/**
 * Um cartaz deitado enche a moldura dos cartões, em vez de ficar numa faixa
 * estreita entre dois borrões (C1-009).
 *
 * A regra da casa é nunca cortar um cartaz, e serve os cartazes ao alto, que
 * são quase todos: a moldura é 3:4 e eles cabem. Um deitado — uma fotografia
 * de paisagem, uma faixa de 1200 × 630 — ocupava o terço do meio, e os dois
 * terços à volta eram o próprio cartaz desfocado. Esses são, quase sempre,
 * fotografias e não cartazes com texto, e numa fotografia o corte ao centro
 * não tira nada que se leia. A ficha mostra-o sempre inteiro.
 *
 * Só com as duas medidas (0126): sem elas não se adivinha, e o cartaz fica
 * inteiro, como sempre ficou.
 */
export function cartazDeitado(
  largura: number | null | undefined,
  altura: number | null | undefined,
): boolean {
  if (!largura || !altura || largura <= 0 || altura <= 0) return false;
  return largura / altura >= DEITADO;
}
