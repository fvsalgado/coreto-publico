import 'server-only';
import { reportarErro } from '../registo';
import { requireAdminClient } from '../supabase/server';

/**
 * Leituras da página de estatísticas.
 *
 * Usam a chave de serviço como o resto do backoffice. Podiam usar a chave
 * pública — os contadores são legíveis por quem quiser —, mas a página mostra
 * também eventos que já não estão publicados, e esses a chave pública não vê.
 *
 * Nada disto passa por cache: um painel de números em cache é um painel que
 * mente sobre o que aconteceu na última hora.
 */

export interface EventStatRow {
  eventId: string;
  slug: string;
  title: string;
  municipalityId: string;
  dateStart: string | null;
  views: number;
  ticketClicks: number;
  icalDownloads: number;
  shares: number;
  clicks: number;
}

export interface MunicipalityStatRow {
  municipalityId: string;
  municipalityName: string;
  eventsCounted: number;
  views: number;
  ticketClicks: number;
  icalDownloads: number;
  shares: number;
  clicks: number;
}

export interface StatTotals {
  eventsCounted: number;
  views: number;
  ticketClicks: number;
  icalDownloads: number;
  shares: number;
  clicks: number;
}

export interface StatsOverview {
  topByViews: EventStatRow[];
  topByClicks: EventStatRow[];
  byMunicipality: MunicipalityStatRow[];
  total: StatTotals;
}

/** Quantos eventos por tabela. Chega para responder «o que correu melhor». */
export const TOP_LIMIT = 25;

interface EmbeddedEvent {
  slug: string;
  title: string;
  municipality_id: string;
  date_start: string | null;
}

interface StatsQueryRow {
  event_id: string;
  views: number;
  ticket_clicks: number;
  ical_downloads: number;
  shares: number;
  clicks: number;
  events: EmbeddedEvent | EmbeddedEvent[] | null;
}

interface MunicipalityQueryRow {
  municipality_id: string;
  municipality_name: string;
  events_counted: number;
  views: number;
  ticket_clicks: number;
  ical_downloads: number;
  shares: number;
  clicks: number;
}

const STATS_FIELDS =
  'event_id, views, ticket_clicks, ical_downloads, shares, clicks, events!inner(slug, title, municipality_id, date_start)';

function toEventStatRow(row: StatsQueryRow): EventStatRow | null {
  // Uma relação de um para um chega como objeto; em versões diferentes do
  // PostgREST pode chegar como lista de um elemento. Aceitar as duas formas
  // custa três linhas e evita uma página vazia sem explicação.
  const event = Array.isArray(row.events) ? row.events[0] : row.events;
  if (!event) return null;

  return {
    eventId: row.event_id,
    slug: event.slug,
    title: event.title,
    municipalityId: event.municipality_id,
    dateStart: event.date_start,
    views: row.views,
    ticketClicks: row.ticket_clicks,
    icalDownloads: row.ical_downloads,
    shares: row.shares,
    clicks: row.clicks,
  };
}

async function topEvents(
  column: 'views' | 'clicks',
  municipalityId: string | null,
): Promise<EventStatRow[]> {
  const supabase = requireAdminClient();

  let query = supabase.from('event_stats').select(STATS_FIELDS).gt(column, 0);
  if (municipalityId) query = query.eq('events.municipality_id', municipalityId);

  const { data, error } = await query.order(column, { ascending: false }).limit(TOP_LIMIT);

  if (error) {
    reportarErro('topEvents', error);
    return [];
  }

  return ((data ?? []) as unknown as StatsQueryRow[])
    .map(toEventStatRow)
    .filter((row): row is EventStatRow => row !== null);
}

async function statsByMunicipality(): Promise<MunicipalityStatRow[]> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase.rpc('event_stats_by_municipality');

  if (error) {
    reportarErro('event_stats_by_municipality', error);
    return [];
  }

  return ((data ?? []) as MunicipalityQueryRow[]).map((row) => ({
    municipalityId: row.municipality_id,
    municipalityName: row.municipality_name,
    eventsCounted: row.events_counted,
    views: row.views,
    ticketClicks: row.ticket_clicks,
    icalDownloads: row.ical_downloads,
    shares: row.shares,
    clicks: row.clicks,
  }));
}

function sumTotals(rows: MunicipalityStatRow[]): StatTotals {
  return rows.reduce<StatTotals>(
    (total, row) => ({
      eventsCounted: total.eventsCounted + row.eventsCounted,
      views: total.views + row.views,
      ticketClicks: total.ticketClicks + row.ticketClicks,
      icalDownloads: total.icalDownloads + row.icalDownloads,
      shares: total.shares + row.shares,
      clicks: total.clicks + row.clicks,
    }),
    { eventsCounted: 0, views: 0, ticketClicks: 0, icalDownloads: 0, shares: 0, clicks: 0 },
  );
}

/**
 * Tudo o que a página mostra, numa ida só.
 *
 * `municipalityId` filtra as duas tabelas de topo; os totais por concelho são
 * sempre os onze, para que um concelho a zero continue à vista mesmo quando
 * se está a olhar para outro.
 */
export async function eventStatsOverview(municipalityId: string | null): Promise<StatsOverview> {
  const [topByViews, topByClicks, byMunicipality] = await Promise.all([
    topEvents('views', municipalityId),
    topEvents('clicks', municipalityId),
    statsByMunicipality(),
  ]);

  return { topByViews, topByClicks, byMunicipality, total: sumTotals(byMunicipality) };
}
