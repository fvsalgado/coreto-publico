import 'server-only';
import { unstable_cache } from 'next/cache';
import { publicClient } from '../supabase/server';
import { CACHE_TAGS } from '../queries/events';
import { degradarForaDaCache, exigirLeitura } from '../queries/falhas';

/**
 * As leituras que só os feeds precisam.
 *
 * As listagens do site trazem as colunas do cartão e mais nada — e é assim que
 * têm de ser. Um feed precisa de duas coisas a mais: as sessões (um `VEVENT`
 * por sessão, não por evento) e a data da última alteração (é o `pubDate` do
 * RSS, e é o que faz um leitor perceber que uma entrada mudou). Vivem aqui
 * para não engordar `CARD_EVENT_FIELDS` por causa de duas rotas.
 *
 * As três seguem a regra de `queries/falhas.ts` — um erro de leitura lança de
 * dentro da cache, para o vazio do erro não ficar guardado uma hora — e cada
 * uma diz por que lado caiu. Estavam fora do inventário do defeito por
 * viverem noutra pasta, e são exatamente o mesmo defeito: `console.error` e
 * vazio, dentro de `unstable_cache` com uma hora de validade.
 */

const REVALIDATE_SECONDS = 3600;

/**
 * Tecto de linhas de sessões por pedido.
 *
 * Uma exposição publicada dia a dia traz sessenta sessões sozinha; cinquenta
 * eventos assim estouravam qualquer limite. O corte é generoso e a ordenação é
 * por data, por isso o que se perde é sempre o mais distante.
 */
const SESSION_ROW_LIMIT = 1500;

export interface FeedSession {
  event_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  location_override: string | null;
  is_cancelled: boolean;
}

async function fetchSessions(
  eventIds: string[],
  from: string,
): Promise<Record<string, FeedSession[]>> {
  if (eventIds.length === 0) return {};
  const supabase = publicClient();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from('event_sessions')
    .select('event_id, session_date, start_time, end_time, location_override, is_cancelled')
    .in('event_id', eventIds)
    .gte('session_date', from)
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true })
    .limit(SESSION_ROW_LIMIT);

  /*
   * **Propaga**, e a razão está no `uid` que o `feeds/build.ts` compõe.
   *
   * Sem sessões, um evento sai do `.ics` como um compromisso único de dia
   * inteiro, com `uid` `<id>@<dominio>`; com elas, sai um `VEVENT` por sessão,
   * com `uid` `<id>-<data>-<hora>@<dominio>`. São identificadores diferentes,
   * e o comentário desse ficheiro explica porque é que isso é grave: um `uid`
   * é permanente, e quem já subscreveu o calendário fica com as duas versões
   * lado a lado — a falsa a ocupar o mês inteiro e as verdadeiras por cima.
   * Guardar isto uma hora era sujar os calendários de quem nos segue, e um
   * calendário sujo não se limpa a partir daqui.
   */
  exigirLeitura('listFeedSessions', error);

  const grouped: Record<string, FeedSession[]> = {};
  for (const row of (data ?? []) as unknown as FeedSession[]) {
    (grouped[row.event_id] ??= []).push(row);
  }
  return grouped;
}

export function listFeedSessions(
  eventIds: string[],
  from: string,
): Promise<Record<string, FeedSession[]>> {
  return unstable_cache(fetchSessions, ['feed-sessions'], {
    tags: [CACHE_TAGS.events],
    revalidate: REVALIDATE_SECONDS,
  })(eventIds, from);
}

async function fetchTimestamps(eventIds: string[]): Promise<Record<string, string>> {
  if (eventIds.length === 0) return {};
  const supabase = publicClient();
  if (!supabase) return {};

  const { data, error } = await supabase.from('events').select('id, updated_at').in('id', eventIds);

  exigirLeitura('listFeedTimestamps', error);

  const rows = (data ?? []) as unknown as Array<{ id: string; updated_at: string }>;
  return Object.fromEntries(rows.map((row) => [row.id, row.updated_at]));
}

/**
 * **Degrada.** É a única das três que só dá um carimbo: sem ela, o `pubDate`
 * do RSS e o `LAST-MODIFIED` do `.ics` saem vazios (`updatedAt` já devolve
 * `null` quando o carimbo falta, e o `build.ts` sabe lidar com isso). O feed
 * continua a listar tudo o que há, com as datas certas — o que se perde é o
 * sinal «esta entrada mudou», e não uma entrada.
 */
export function listFeedTimestamps(eventIds: string[]): Promise<Record<string, string>> {
  return degradarForaDaCache(
    'listFeedTimestamps',
    unstable_cache(fetchTimestamps, ['feed-timestamps'], {
      tags: [CACHE_TAGS.events],
      revalidate: REVALIDATE_SECONDS,
    }),
    () => ({}),
  )(eventIds);
}

export interface SitemapEvent {
  slug: string;
  /** O concelho, para o mapa do sítio poder datar cada página de concelho. */
  municipality_id: string;
  date_start: string | null;
  updated_at: string;
}

async function fetchSitemapEvents(
  regiao: string,
  limit: number,
  from: string,
): Promise<SitemapEvent[]> {
  const supabase = publicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('events')
    .select('slug, municipality_id, date_start, updated_at, municipalities!inner()')
    .eq('municipalities.region_id', regiao)
    .eq('status', 'published')
    .eq('is_canonical', true)
    .or(`date_end.gte.${from},date_start.gte.${from}`)
    .order('date_start', { ascending: true, nullsFirst: false })
    .limit(limit);

  /*
   * **Propaga**: são as fichas dos eventos, e o comentário do
   * `sitemap-xml/route.ts` diz que são elas o que interessa a um motor de
   * busca neste ficheiro. Um sitemap vazio não é um sitemap por preencher —
   * é a declaração de que a região deixou de ter páginas de evento, entregue
   * a quem indexa e guardada uma hora. Um 500 é «volte daqui a pouco», que é
   * a verdade.
   */
  exigirLeitura('listSitemapEvents', error);
  return (data ?? []) as unknown as SitemapEvent[];
}

export function listSitemapEvents(
  regiao: string,
  limit: number,
  from: string,
): Promise<SitemapEvent[]> {
  return unstable_cache(fetchSitemapEvents, ['sitemap-events'], {
    tags: [CACHE_TAGS.events],
    revalidate: REVALIDATE_SECONDS,
  })(regiao, limit, from);
}
