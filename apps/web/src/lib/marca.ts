/**
 * A marca do sítio, em traços, escrita uma vez só.
 *
 * Um coreto de traço simples — telhado, remate, colunas, guarda e estrado —
 * desenhado numa grelha de 24 por 24. Vive aqui, e não dentro do componente
 * que o desenha, porque tem dois leitores: o `BandstandMark`, que o põe inline
 * nas páginas a herdar a cor do texto, e o `scripts/gerar-icones.mjs`, que o
 * rasteriza para o favicon, para os ícones da aplicação e para o cartão de
 * partilha. Desenhado duas vezes, era o género de coisa que diverge sem
 * ninguém dar por ela — e depois o ícone no ecrã do telemóvel deixa de ser a
 * marca que está no cabeçalho.
 */

/** O lado da grelha em que a marca está desenhada. */
export const MARCA_GRELHA = 24;

/**
 * O traço da marca, tal como aparece no sítio.
 *
 * As medidas do desenho, para quem precisar de o centrar: a tinta ocupa de
 * `x = 2,5` a `x = 21,5` e de `y = 1,8` a `y = 20,2`. Não está centrada na
 * grelha — sobra mais em baixo do que em cima —, e é por isso que o gerador de
 * ícones a desloca em vez de a encostar ao meio da caixa.
 */
export const MARCA_TRACOS = [
  // O telhado, e o remate que lhe sai do cume.
  'M2.5 9.5 12 3l9.5 6.5',
  'M12 3V1.8',
  // As duas colunas.
  'M5.5 10v10.2M18.5 10v10.2',
  // A guarda, com os balaústres.
  'M5.5 14.5h13M8.75 14.5v3.4M12 14.5v3.4M15.25 14.5v3.4',
  // O estrado e a base.
  'M4 17.9h16',
  'M2.5 20.2h19',
] as const;

/**
 * A mesma marca sem o que se fecha a dezasseis pixéis.
 *
 * Num favicon de 16 px, os três balaústres e as duas linhas de baixo caem
 * dentro de dois pixéis e fundem-se num borrão cinzento. O que sobra é o que
 * ainda se lê a esse tamanho: o telhado, as colunas e a base. Não é outra
 * marca — é a mesma, à distância a que já não se vêem os pormenores.
 */
export const MARCA_TRACOS_MIUDOS = [
  'M2.5 9.5 12 3l9.5 6.5',
  'M5.5 10v10.2M18.5 10v10.2',
  'M2.5 20.2h19',
] as const;

/**
 * As duas cores do toldo, escritas uma vez.
 *
 * O toldo é `--color-brand` em `globals.css`; o que está aqui é a mesma cor
 * para quem não lê CSS — o `theme-color` que o telemóvel pinta antes de haver
 * folha de estilos, e o manifesto, que é JSON. São duas porque há dois sítios:
 * as regiões vestem o turquesa da casa; a montra — a página do produto, em
 * `coreto.org` e em qualquer anfitrião que não é de ninguém — veste vermelho,
 * para não se confundir com a agenda de uma região. Quem mudar uma cor aqui
 * muda-a também no `@theme` ou no âmbito `[data-paleta='montra']` de
 * `globals.css`: é o mesmo valor em dois alfabetos.
 */
export const CORES_DO_TOLDO = {
  cim: '#40c0c4',
  montra: '#c2281c',
} as const;
