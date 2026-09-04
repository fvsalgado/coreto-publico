/**
 * Sobre que espaços é que se pode escrever «por confirmar».
 *
 * O levantamento dos coretos tem registos que não se conseguiram verificar, e
 * cada um deles aponta — quando aponta — para um espaço do catálogo. A tentação
 * é pendurar a dúvida no espaço apontado, e é errada: **a dúvida é sobre o
 * coreto, não sobre o lugar onde ele estaria.**
 *
 * O Coreto do Jardim Municipal de Torres Novas está por confirmar; o Jardim
 * Municipal de Torres Novas existe, tem morada e tem fotografia verificada.
 * A ficha do jardim abria com «Este registo está por confirmar» e a sua página
 * na lista levava o selo da dúvida — sobre um jardim que ninguém duvida que
 * exista. O que é verdade é outra coisa: há um coreto por confirmar naquele
 * jardim.
 *
 * A regra corrigiu-se uma vez em `/espacos` e ficou por corrigir em `/concelho`
 * e na ficha do espaço, que continuaram a olhar só para `is_confirmed`. Vive
 * aqui para não haver uma quarta cópia com uma quarta opinião.
 *
 * E a decisão de **quais** coretos têm ficha de espaço deixou de ser caso a
 * caso (era por acaso: Alvega, confirmado e fotografado, não tinha ficha; o
 * Carril, sem fonte nenhuma, tinha). A regra está na migração 0081 e as suas
 * asserções fazem-na cumprir: um coreto tem ficha própria quando alguma fonte
 * lhe dá um sítio — confirmado fica ativo, por confirmar fica provisório com
 * este selo. Sem sítio documentado, a pergunta vive só no levantamento; e
 * quando a marca vive dentro de um espaço que já tem ficha (o jardim
 * municipal), a ligação é a esse espaço.
 */

/** O mínimo que esta regra precisa de saber de um coreto. */
export interface CoretoDuvidoso {
  is_confirmed: boolean;
  venue_id: string | null;
}

/** E de um espaço. */
export interface EspacoComTipo {
  id: string;
  kind: string;
}

/**
 * Os espaços sobre os quais se pode escrever «por confirmar».
 *
 * Um espaço só entra se for ele próprio um coreto (`kind === 'bandstand'`) e
 * se o registo do coreto que lhe aponta estiver por confirmar. Um jardim, um
 * cine-teatro ou um largo que alberguem um coreto duvidoso ficam de fora: o
 * que está em dúvida não são eles.
 */
export function espacosPorConfirmar(
  coretos: readonly CoretoDuvidoso[],
  espacos: readonly EspacoComTipo[],
): Set<string> {
  const tipoPorEspaco = new Map(espacos.map((espaco) => [espaco.id, espaco.kind]));

  return new Set(
    coretos
      .filter(
        (coreto) =>
          !coreto.is_confirmed &&
          coreto.venue_id !== null &&
          tipoPorEspaco.get(coreto.venue_id) === 'bandstand',
      )
      .map((coreto) => coreto.venue_id as string),
  );
}
