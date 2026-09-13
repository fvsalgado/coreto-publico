/**
 * O antes e o depois de uma ação de moderação, campo a campo.
 *
 * **O que estava mal.** A ficha da região promete, a quem está a gravar, que a
 * auditoria guarda «o antes e o depois de cada campo». A promessa estava
 * cumprida na base desde a 0006 e a consulta não lia as duas colunas; depois
 * passou a lê-las e a página despejava os dois JSON inteiros lado a lado. Ler
 * dois objetos de trinta chaves para encontrar a que mudou é a mesma coisa que
 * não ter a informação — só que com mais scroll.
 *
 * O que uma pessoa quer saber é **o que mudou**. Esta função responde a isso e
 * a mais nada.
 */

/** Uma linha da diferença: o campo, o que lá estava, e o que ficou. */
export interface CampoMudado {
  campo: string;
  antes: string | null;
  depois: string | null;
}

/**
 * O que nunca entra na diferença, por ser volume e não informação.
 *
 * O `raw_text` de um email tem parágrafos; o `payload` de uma submissão é o
 * candidato inteiro; o `raw_headers` são dezenas de linhas de protocolo. Numa
 * gaveta de auditoria são ruído que esconde a linha que interessa — e o
 * `raw_text` ainda por cima repete o que já está no `payload`.
 *
 * Não é censura: quem precisa do bruto abre a submissão. É a diferença entre
 * um registo legível e um despejo.
 */
export const CAMPOS_VOLUMOSOS = new Set([
  'raw_text',
  'raw_headers',
  'raw_subject',
  'payload',
  'ocr_text',
  'description',
]);

/** Os que mudam em toda a ação e não dizem nada sobre ela. */
export const CAMPOS_DE_RELOGIO = new Set(['updated_at', 'created_at', 'reviewed_at']);

const LIMITE = 160;

function escrever(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string')
    return valor.length > LIMITE ? `${valor.slice(0, LIMITE)}…` : valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  const texto = JSON.stringify(valor);
  return texto.length > LIMITE ? `${texto.slice(0, LIMITE)}…` : texto;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * A diferença entre o antes e o depois, só com o que mudou.
 *
 * **Um campo que não mudou não aparece.** É a regra inteira: uma ação que toca
 * numa `tagline` mostra uma linha, e não trinta iguais com uma diferente no
 * meio.
 *
 * **Uma das pontas em falta não é erro.** `approve` cria do nada e não tem
 * `before`; `set_status` guarda o estado anterior e põe no `after` só o que
 * decidiu. Nos dois casos a ponta que falta escreve-se como ausente (`null`), e
 * quem lê vê «não havia» em vez de um vazio ambíguo.
 */
export function diferenca(before: unknown, after: unknown): CampoMudado[] {
  const antes = ehObjeto(before) ? before : {};
  const depois = ehObjeto(after) ? after : {};

  const campos = [...new Set([...Object.keys(antes), ...Object.keys(depois)])]
    .filter((campo) => !CAMPOS_VOLUMOSOS.has(campo) && !CAMPOS_DE_RELOGIO.has(campo))
    .sort((a, b) => a.localeCompare(b, 'pt'));

  return campos
    .map((campo) => ({
      campo,
      antes: escrever(antes[campo]),
      depois: escrever(depois[campo]),
    }))
    .filter((linha) => linha.antes !== linha.depois);
}

/**
 * Quantos campos ficaram de fora por serem volume.
 *
 * Diz-se o número em vez de o esconder: «e mais 2 campos de texto longo» é
 * honesto, e um silêncio sobre eles fazia a gaveta parecer completa quando não
 * é.
 */
export function volumososOmitidos(before: unknown, after: unknown): string[] {
  const antes = ehObjeto(before) ? before : {};
  const depois = ehObjeto(after) ? after : {};

  return [...new Set([...Object.keys(antes), ...Object.keys(depois)])]
    .filter((campo) => CAMPOS_VOLUMOSOS.has(campo))
    .filter((campo) => JSON.stringify(antes[campo]) !== JSON.stringify(depois[campo]))
    .sort((a, b) => a.localeCompare(b, 'pt'));
}

/**
 * Onde é que a entidade de uma ação se vai ver, ou `null` quando não há sítio.
 *
 * Só as duas que têm ficha própria no painel. Um evento não tem — a lista de
 * eventos não filtra por identificador — e uma secção do sítio não é uma coisa
 * com endereço. Nesses, o identificador mostra-se **por inteiro** em vez de
 * cortado aos oito carateres: cortado não serve nem para procurar.
 */
export function ondeVerAEntidade(entityType: string, entityId: string): string | null {
  if (entityType === 'submission') return `/admin/fila/${entityId}`;
  if (entityType === 'region') return `/admin/regioes/${entityId}`;
  return null;
}
