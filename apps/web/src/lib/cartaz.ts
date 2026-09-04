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
