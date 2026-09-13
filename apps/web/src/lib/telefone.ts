/**
 * O telefone de um espaço, tal como se mostra e tal como se marca.
 *
 * São duas coisas diferentes e a página tratava-as como uma só: pegava no que
 * está na base de dados e tirava-lhe os espaços para fazer o `href`. Resultado
 * em três espaços do catálogo — a biblioteca de Mação, a de Ourém e o museu de
 * Ourém — `tel:+351241577200(ext.249)`, que nenhum telemóvel sabe marcar, e
 * `tel:+351249540900/+351919585003`, que é dois números colados num.
 *
 * A extensão e o segundo número são informação boa: quem liga quer saber o
 * número da extensão e quer poder escolher o telemóvel em vez do fixo. O que
 * não se pode é enfiá-los no `href`. Por isso, o que se mostra fica inteiro e
 * o que se marca é só a parte marcável.
 *
 * O formato de origem é o que a migração 0050 garante: `+351 NNN NNN NNN`,
 * números adicionais depois de ` / `, extensão em ` (ext. …)` no fim. Um valor
 * fora do formato não se perde nem se inventa — sai como está, e o `href` leva
 * o que dele restar sem espaços.
 */

/** Um número: o que se lê e o que se marca. */
export interface Telefone {
  /** O número como está escrito, extensão incluída. */
  etiqueta: string;
  /** `tel:` só com a parte que um telemóvel sabe marcar. */
  href: string;
}

/** A parte marcável: o número, e nada do que venha a seguir. */
const MARCAVEL = /^\+?[\d\s]*\d/;

export function telefones(phone: string | null | undefined): Telefone[] {
  if (!phone) return [];

  // ` / ` com espaços dos dois lados separa números. O `/` de `(ext. 6841/6842)`
  // não tem espaços, e é por isso que fica onde está.
  return phone
    .split(' / ')
    .map((parte) => parte.trim())
    .filter((parte) => parte.length > 0)
    .map((parte) => {
      const marcavel = MARCAVEL.exec(parte)?.[0] ?? parte;
      return { etiqueta: parte, href: `tel:${marcavel.replace(/\s+/g, '')}` };
    });
}
