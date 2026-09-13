/**
 * O tipo de letra que quem embebe indica.
 *
 * A primeira ideia era «herdar a letra do sítio anfitrião», e não dá: um
 * `iframe` tem documento próprio e o CSS não atravessa a fronteira. Prometer
 * herança seria prometer uma coisa que nunca aconteceria — a caixa ficaria com
 * a letra desta casa e ninguém perceberia porquê.
 *
 * O que dá, e é o que resolve o problema a sério, é a câmara **dizer** qual é:
 * quem mantém o sítio sabe que ele corre em Open Sans, e escreve-o.
 *
 * Uma família de letra vai parar dentro de uma declaração de estilo, e por isso
 * isto é uma lista branca e não uma lista negra. Cada nome tem de ser letras,
 * dígitos, espaços ou hífenes — tudo o resto sai fora, incluindo o ponto e
 * vírgula que fecharia a declaração e as chavetas que abririam outra regra.
 * Não se tenta limpar um nome estranho: descarta-se.
 */

/** Um nome de família: letras (com acentos), dígitos, espaços, hífenes. */
const NOME = /^[\p{L}\p{N} -]{1,40}$/u;

/** As genéricas do CSS, que entram sem aspas. */
const GENERICAS = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
]);

/** Quantas famílias aceitar. Uma pilha de reserva não precisa de mais. */
const MAX_FAMILIAS = 6;

/**
 * Uma pilha de `font-family` segura, ou nada.
 *
 * O valor devolvido já leva as aspas onde são precisas e termina numa
 * genérica: se a câmara escrever só «Open Sans» e a letra não estiver
 * instalada em quem visita, o navegador precisa de saber para onde cair.
 */
export function lerTipoDeLetra(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const bruto = valor.trim();
  if (bruto.length === 0 || bruto.length > 200) return null;

  const familias: string[] = [];
  let temGenerica = false;

  for (const parte of bruto.split(',')) {
    // As aspas que a pessoa tenha escrito saem, e voltam a ser postas por nós
    // — assim uma aspa a mais ou a menos não desequilibra a declaração.
    const nome = parte
      .trim()
      .replace(/^["']|["']$/g, '')
      .trim();
    if (nome.length === 0) continue;

    const minusculo = nome.toLowerCase();
    if (GENERICAS.has(minusculo)) {
      familias.push(minusculo);
      temGenerica = true;
    } else if (NOME.test(nome)) {
      familias.push(`"${nome}"`);
    } else {
      // Um nome que não passa não estraga os outros — salta-se.
      continue;
    }

    if (familias.length >= MAX_FAMILIAS) break;
  }

  if (familias.length === 0) return null;
  if (!temGenerica) familias.push('sans-serif');
  return familias.join(', ');
}
