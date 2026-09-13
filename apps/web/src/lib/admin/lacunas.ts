/**
 * As lacunas do catálogo, num sítio só.
 *
 * `/admin/qualidade` mede-as em percentagem, coluna a coluna; `/admin/eventos`
 * abre a lista dos que faltam, filtro a filtro. São o mesmo facto visto de
 * dois lados, e antes desta lista eram duas listas escritas à mão em ficheiros
 * diferentes: o painel tinha seis colunas e o selector tinha quatro das seis
 * mais uma que não era coluna nenhuma. Quem via 62% no «Preço» não tinha para
 * onde clicar, porque a lista de trabalho não conhecia a palavra.
 *
 * Agora a percentagem **é** a ligação para a lista, e por isso as duas pontas
 * têm de contar a mesma população. A 0143 alinhou o lado da base (a descrição
 * vazia contava para um lado e para o outro ao mesmo tempo); este ficheiro
 * alinha o lado do sítio, e o teste que o acompanha recusa uma coluna de
 * qualidade que não tenha filtro e um filtro que prometa uma coluna que não
 * existe.
 *
 * A `ressalva` existe para o único caso em que as duas pontas **não** contam a
 * mesma coisa e não devem contar: ver `hora`.
 */

/** As colunas que a vista de qualidade conta. Uma por lacuna com célula. */
export type ColunaDeQualidade =
  | 'with_time'
  | 'with_venue'
  | 'with_description'
  | 'with_image'
  | 'with_price'
  | 'with_coordinates';

export interface Lacuna {
  /** O valor de `?falta=` no endereço da lista de trabalho. */
  chave: string;
  /**
   * A coluna de `event_quality_by_*` que conta os que **não** têm esta
   * lacuna. `null` quando a lacuna não tem célula no painel — ver `sitio`.
   */
  coluna: ColunaDeQualidade | null;
  /** O cabeçalho da coluna no painel de qualidade. */
  rotulo: string;
  /** O que a coluna conta, palavra a palavra. */
  ajuda: string;
  /** O rótulo da opção no selector de `/admin/eventos`. */
  filtro: string;
  /**
   * Escrita quando a lista de trabalho abre menos do que a percentagem mede.
   * O painel mostra-a ao lado do número, em vez de deixar quem clica descobrir
   * a diferença a contar linhas.
   */
  ressalva?: string;
}

export const LACUNAS: readonly Lacuna[] = [
  {
    chave: 'hora',
    coluna: 'with_time',
    rotulo: 'Hora',
    ajuda: 'Eventos com hora de início em pelo menos uma sessão',
    filtro: 'Sem hora, dos que estão para vir',
    // A percentagem conta o catálogo todo; a vista `events_without_time` da
    // 0118 deixa de fora o que já passou, e tem razão para isso — corrigir a
    // hora de um evento que já aconteceu não leva ninguém a lado nenhum. As
    // duas contagens divergem de propósito, e é por isso que se diz.
    ressalva: 'A lista abre só os que ainda vão acontecer; a percentagem conta o catálogo todo.',
  },
  {
    chave: 'espaco',
    coluna: 'with_venue',
    rotulo: 'Espaço',
    ajuda: 'Eventos ligados a um espaço do catálogo, e não a texto solto',
    filtro: 'Sem espaço do catálogo',
  },
  {
    chave: 'descricao',
    coluna: 'with_description',
    rotulo: 'Descrição',
    ajuda: 'Eventos com texto além do título',
    filtro: 'Sem descrição',
  },
  {
    chave: 'imagem',
    coluna: 'with_image',
    rotulo: 'Imagem',
    ajuda: 'Eventos com cartaz ou fotografia',
    filtro: 'Sem imagem',
  },
  {
    chave: 'preco',
    coluna: 'with_price',
    rotulo: 'Preço',
    ajuda: 'Eventos que dizem se é pago ou gratuito',
    filtro: 'Sem dizer se é pago ou gratuito',
  },
  {
    chave: 'mapa',
    coluna: 'with_coordinates',
    rotulo: 'Mapa',
    ajuda: 'Eventos com coordenadas',
    filtro: 'Sem coordenadas',
  },
  // Sem célula: é um recorte mais apertado do «Espaço», para quem quer
  // primeiro os que não dizem sítio nenhum — nem espaço do catálogo, nem
  // texto solto. Uma coluna própria no painel repetia a mesma medida.
  {
    chave: 'sitio',
    coluna: null,
    rotulo: 'Sítio',
    ajuda: 'Eventos que não dizem onde são, nem por espaço nem por escrito',
    filtro: 'Sem sítio nenhum',
  },
];

/** As lacunas que têm coluna no painel, pela ordem em que a tabela as mostra. */
export const LACUNAS_COM_COLUNA = LACUNAS.filter(
  (l): l is Lacuna & { coluna: ColunaDeQualidade } => l.coluna !== null,
);

/**
 * O endereço da lista de trabalho de uma lacuna.
 *
 * `estado=catalogo` e não `estado=todos`, e a diferença é o ponto todo: a
 * percentagem do painel conta publicados mais por publicar — é isso que a
 * recolha produz —, e `todos` traz também escondidos, cancelados e
 * arquivados, que são decisões de uma pessoa e não lacunas de recolha. Com
 * `todos` a lista abria mais linhas do que o número prometia.
 */
export function listaDeTrabalho(
  chave: string,
  recorte: { concelho?: string; fonte?: string } = {},
): string {
  const params = new URLSearchParams({ falta: chave, estado: 'catalogo' });
  if (recorte.concelho) params.set('concelho', recorte.concelho);
  if (recorte.fonte) params.set('fonte', recorte.fonte);
  return `/admin/eventos?${params.toString()}`;
}
