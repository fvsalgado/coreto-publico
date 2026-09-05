import {
  eventFilterSchema,
  janelaDaSemana,
  janelaDeHoje,
  janelaDoFimDeSemana,
  type EventFilter,
  type JanelaDeDatas,
} from '@coreto/core';
import { formatShortDate, formatWeekdayDate } from './format';

/**
 * A parte da agenda que não fala com a base nem com o React.
 *
 * Estava tudo dentro de `app/[regiao]/agenda/page.tsx` e não tinha um único
 * teste — não por desleixo, mas porque importar a página arrasta o `next/cache`
 * e o cliente do Supabase, e a partir daí não há teste que corra. Aqui é código
 * puro: entra um filtro, sai um endereço ou uma decisão.
 *
 * É o que permite travar a regressão que interessa — que o endereço de um
 * atalho seja **exactamente** o canónico da vista a que ele leva.
 */

export const PATH = '/agenda';

/** Os defaults do schema, para não repetir números mágicos por aqui. */
export const DEFAULTS = eventFilterSchema.parse({});

export const FILTER_KEYS = [
  'municipality',
  'category',
  'from',
  'to',
  'free',
  'accessible',
  'venue',
  'series',
  'q',
  'page',
  'limit',
] as const;

/** Os campos que se mostram como fichas removíveis. `page` e `limit` não são filtros. */
export type FilterKey =
  'q' | 'from' | 'to' | 'municipality' | 'category' | 'venue' | 'series' | 'free' | 'accessible';

export type SearchParams = Record<string, string | string[] | undefined>;

/** Um parâmetro repetido no endereço vale pela primeira ocorrência. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Lê os filtros do endereço.
 *
 * Um formulário GET submete também os campos que ficaram por preencher
 * («from=»), e uma data vazia não passa no schema — daí limpar os vazios antes
 * de validar, senão bastava um campo em branco para o botão «Filtrar» deixar
 * de funcionar. Um parâmetro inválido cai nos defaults em vez de rebentar: quem
 * escreveu o endereço à mão vê a agenda, não uma página de erro.
 */
export function readFilter(searchParams: SearchParams): EventFilter {
  const raw: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = firstValue(searchParams[key])?.trim();
    if (value) raw[key] = value;
  }

  const parsed = eventFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULTS;
}

/**
 * Reconstrói o endereço a partir dos filtros já validados — nunca do que veio
 * em bruto.
 *
 * `omit` tira um filtro e leva de volta à primeira página: quem larga o
 * concelho estava na página 3 de uma lista que agora tem trinta, e cair num
 * «sem resultados» que é só uma página vazia seria dar-lhe a entender que
 * alargar o filtro tirou eventos.
 *
 * Aceita mais do que um campo porque um recorte de tempo são dois — `from` e
 * `to` — e larga-se inteiro: tirar só metade de uma janela deixava a agenda
 * «até domingo», que não é um filtro que alguém tenha pedido.
 */
export function buildHref(
  filter: EventFilter,
  page: number,
  omit?: FilterKey | readonly FilterKey[],
): string {
  const params = new URLSearchParams();
  const fora = new Set<FilterKey>(
    omit === undefined ? [] : typeof omit === 'string' ? [omit] : omit,
  );
  const keep = (key: FilterKey): boolean => !fora.has(key);

  if (filter.q && keep('q')) params.set('q', filter.q);
  if (filter.from && keep('from')) params.set('from', filter.from);
  if (filter.to && keep('to')) params.set('to', filter.to);
  if (filter.municipality && keep('municipality')) params.set('municipality', filter.municipality);
  if (filter.category && keep('category')) params.set('category', filter.category);
  if (filter.venue && keep('venue')) params.set('venue', filter.venue);
  if (filter.series && keep('series')) params.set('series', filter.series);
  if (filter.free && keep('free')) params.set('free', '1');
  if (filter.accessible && keep('accessible')) params.set('accessible', '1');
  if (filter.limit !== DEFAULTS.limit) params.set('limit', String(filter.limit));
  if (page > 1) params.set('page', String(page));

  const query = params.toString();
  return query ? `${PATH}?${query}` : PATH;
}

/**
 * Os três recortes de tempo que a agenda oferece num clique.
 *
 * A ordem é a da distância: hoje, o fim de semana, a semana. É também a ordem
 * pela qual as perguntas se fazem.
 */
export const ATALHOS = [
  { id: 'hoje', rotulo: 'Hoje', janela: janelaDeHoje },
  { id: 'fim-de-semana', rotulo: 'Este fim de semana', janela: janelaDoFimDeSemana },
  { id: 'semana', rotulo: 'Esta semana', janela: janelaDaSemana },
] as const satisfies readonly {
  id: string;
  rotulo: string;
  janela: (hoje: string) => JanelaDeDatas;
}[];

export type AtalhoId = (typeof ATALHOS)[number]['id'];

export interface AtalhoDeData {
  id: AtalhoId;
  rotulo: string;
  href: string;
  activo: boolean;
}

/**
 * Qual dos recortes está a valer, se algum.
 *
 * Compara-se o **valor** e não a proveniência: quem escreveu as duas datas à
 * mão nos campos e calhou no fim de semana vê o atalho aceso, e está certo —
 * é o mesmo recorte, e dizer-lhe que não era seria mentir sobre o que está a
 * ver.
 */
export function janelaActiva(filter: EventFilter, hoje: string): AtalhoId | null {
  for (const atalho of ATALHOS) {
    const janela = atalho.janela(hoje);
    if (filter.from === janela.from && filter.to === janela.to) return atalho.id;
  }
  return null;
}

/**
 * Os atalhos, já com endereço.
 *
 * Construídos com o `buildHref` da própria página, e não com um
 * `URLSearchParams` à parte: é o que faz o endereço sair **byte a byte igual**
 * ao canónico da vista a que leva, e o que preserva os filtros que já estavam
 * a valer — incluindo o `venue` e a `series`, que só existem como campos
 * escondidos e que um endereço escrito à mão deitaria fora sem ninguém
 * perceber porquê.
 */
export function atalhosDeData(filter: EventFilter, hoje: string): AtalhoDeData[] {
  const activo = janelaActiva(filter, hoje);
  return ATALHOS.map((atalho) => ({
    id: atalho.id,
    rotulo: atalho.rotulo,
    href: buildHref({ ...filter, ...atalho.janela(hoje) }, 1),
    activo: activo === atalho.id,
  }));
}

/** As datas escolhidas, por extenso — «a sábado, 5 de setembro», «de 5 a 12 set». */
export function descreverDatas(from?: string, to?: string, hoje?: string): string | null {
  if (from && to) {
    // Um recorte com nome diz o nome. «Agenda: a sexta-feira, 11 de setembro»
    // é a mesma vista que «Agenda: hoje», e a segunda é a que se lê.
    if (hoje) {
      const atalho = janelaActiva({ from, to } as EventFilter, hoje);
      if (atalho) return ATALHOS.find((item) => item.id === atalho)?.rotulo.toLowerCase() ?? null;
    }
    if (from === to) return `a ${formatWeekdayDate(from)}`;
    return `de ${formatShortDate(from)} a ${formatShortDate(to)}`;
  }
  if (from) return `a partir de ${formatWeekdayDate(from)}`;
  if (to) return `até ${formatWeekdayDate(to)}`;
  return null;
}

/**
 * A parte de `deixaIndexar` que não precisa de ir à base.
 *
 * Cada combinação de filtros é um endereço, e há mais combinações do que
 * eventos. As três primeiras regras estão explicadas em `deixaIndexar`; esta
 * quarta é das datas, e é a mais recente:
 *
 * **Um intervalo de datas não é uma vista estável.**
 * `/agenda?from=2026-09-11&to=2026-09-13` é um endereço novo por semana, para
 * sempre — e, pior, é um endereço que **passa a mentir**: indexado em setembro,
 * é servido em novembro com o título a prometer «de 11 a 13 set» e uma lista
 * vazia por baixo. A regra do total só o apanha depois de o fim de semana
 * passar e depois de o rastreador voltar, e desindexar é fácil mas voltar ao
 * índice é lento.
 *
 * Está aqui em separado, e antes da leitura, por uma razão prática: assim uma
 * vista com datas nem sequer chega a pedir o total à base.
 */
export function filtroIndexavel(filter: EventFilter): boolean {
  if (filter.q || filter.venue || filter.series) return false;
  if (filter.from || filter.to) return false;
  return true;
}
