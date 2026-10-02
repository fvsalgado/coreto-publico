/**
 * O glossário interno de `docs/NARRATIVA.md` §9 — as palavras com que a casa
 * fala de si própria, e que nunca se escrevem a quem visita.
 *
 * Vive num ficheiro só porque são dois os guiões que o aplicam, a duas coisas
 * diferentes: o `verificar-afirmacoes.mjs` ao código (o texto que os
 * componentes escrevem), e o `verificar-regioes.mjs` ao que o sítio serve de
 * facto — onde entra também o que vem da base, que é por onde a palavra
 * «montra» chegou ao lema e às «Informações» da demonstração (C1-005, C2-042).
 * Duas listas escritas à mão divergem, e a que ficasse para trás deixava
 * passar o termo que a outra já apanhava.
 */
export const GLOSSARIO_INTERNO = [
  'montra',
  'toldo',
  'lambrequim',
  'goteira',
  'sobrancelha',
  'gaveta',
  'disjuntor',
  'impressão digital',
  'multi-inquilino',
  'deriva de layout',
];

/**
 * Uma palavra inteira, e não um pedaço de identificador.
 *
 * O `ct-goteira` é um nome de classe, o `data-paleta="montra"` é um atributo e
 * o `./montra` é um caminho de módulo: nenhum deles é texto que alguém leia. O
 * que os separa de uma palavra escrita numa frase é o que vem imediatamente
 * antes e depois.
 */
export function palavraInteira(termo) {
  return new RegExp(`(?<![\\p{L}\\p{N}_"'\`\\-/])${termo}(?![\\p{L}\\p{N}_\\-])`, 'iu');
}
