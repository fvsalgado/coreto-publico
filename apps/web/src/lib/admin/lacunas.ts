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
   * lacuna. Uma por lacuna, e o teste que acompanha isto recusa que a vista
   * ganhe uma coluna sem lacuna ou uma lacuna sem coluna.
   */
  coluna: ColunaDeQualidade;
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
  // A lista acabou aqui, e falta-lhe uma que cá esteve.
  //
  // **«Sem sítio nenhum» era um filtro que não podia devolver nada.** Estava
  // no selector de `/admin/eventos` — «nem espaço do catálogo, nem texto
  // solto» — e a consulta que o servia era `venue_id is null and
  // location_name is null`. A restrição `events_has_location`, da 0004, exige
  // que pelo menos um dos dois esteja preenchido: a condição é falsa para
  // todas as linhas que a base aceita gravar, e sempre foi.
  //
  // Zero em produção, e não por o trabalho estar feito — por não poder haver
  // trabalho. Quem abrisse esse filtro via «Nenhum evento com estes filtros» e
  // concluía que estava tudo bem, quando o que estava era uma pergunta cuja
  // resposta a base decide desde o primeiro dia.
  //
  // Sai, e o teste que acompanha isto verifica que a restrição continua lá:
  // no dia em que alguém a largar, a pergunta volta a fazer sentido e este
  // comentário é onde está escrito porquê.
];

/**
 * As lacunas que têm coluna no painel, pela ordem em que a tabela as mostra.
 *
 * Hoje são todas — a única que não tinha era «sem sítio nenhum», e essa saiu
 * por não poder devolver nada. O apelido fica, e o tipo com ele: é o que
 * marca a diferença entre «uma lacuna com percentagem» e «uma lacuna», para o
 * dia em que houver uma segunda sem coluna.
 */
export const LACUNAS_COM_COLUNA: readonly (Lacuna & { coluna: ColunaDeQualidade })[] = LACUNAS;

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
