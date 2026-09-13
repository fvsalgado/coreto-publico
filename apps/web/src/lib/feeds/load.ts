import 'server-only';
import { todayInLisbon, type EventFilter } from '@coreto/core';
import { SITE_URL } from '../env';
import { listCategories, listEvents, listMunicipalities, listVenueNames } from '../queries/events';
import { urlDoSitio, type Regiao } from '../regiao';
import type { EventCard, EventDetail, Municipality } from '../queries/types';
import type { FeedContext } from './build';
import { listFeedSessions, listFeedTimestamps, type FeedSession } from './data';

/**
 * O carregamento que todas as rotas de feed partilham.
 *
 * São cinco leituras, todas em cache com etiquetas: um pico de leitores de
 * feeds à hora certa não chega à base de dados. As três consultas de nomes
 * (concelhos, espaços, categorias) existem porque um `.ics` sem o nome do
 * sítio é inútil — «Concerto» não diz a ninguém onde é.
 */

export interface FeedPayload {
  events: EventCard[];
  context: FeedContext;
  total: number;
}

function namesById(rows: ReadonlyArray<{ id: string; name: string }>): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.id, row.name]));
}

/**
 * Resolve o segmento de um feed por concelho.
 *
 * O App Router não deixa um segmento dinâmico ter sufixo — `[municipality].ics`
 * seria lido como um nome de pasta literal — por isso a extensão vem dentro do
 * próprio valor e é aqui que se descasca. `/feed/tomar.xml` e `/feed/tomar`
 * dão o mesmo, que é o que quem escreve o endereço à mão espera.
 *
 * A validação é por lista fechada: o que não é um concelho da região não
 * chega à consulta.
 */
export async function resolveMunicipality(
  regiao: string,
  segment: string,
  extension: string,
): Promise<Municipality | null> {
  const decoded = decodeURIComponent(segment).toLowerCase();
  const id = decoded.endsWith(extension) ? decoded.slice(0, -extension.length) : decoded;
  const municipalities = await listMunicipalities(regiao);
  return municipalities.find((municipality) => municipality.id === id) ?? null;
}

export async function loadFeed(regiao: Regiao, filter: EventFilter): Promise<FeedPayload> {
  const from = filter.from ?? todayInLisbon();
  const [result, municipalities, categories, venueNames] = await Promise.all([
    listEvents(regiao.id, filter),
    listMunicipalities(regiao.id),
    listCategories(),
    listVenueNames(regiao.id, filter.municipality),
  ]);

  const ids = result.events.map((event) => event.id);
  const [sessions, timestamps] = await Promise.all([
    listFeedSessions(ids, from),
    listFeedTimestamps(ids),
  ]);

  return {
    events: result.events,
    total: result.total,
    context: {
      ...identidadeDosFeeds(regiao),
      municipalityNames: namesById(municipalities),
      venueNames,
      categoryNames: Object.fromEntries(
        categories.map((category) => [category.slug, category.name]),
      ),
      sessions,
      timestamps,
    },
  };
}

/**
 * O mesmo contexto para um evento só.
 *
 * A ficha já traz as sessões consigo, por isso não se volta à base de dados
 * para as buscar — só se lhes junta o `event_id` que a ficha não precisa de
 * repetir sessenta vezes e o gerador de calendário precisa de saber.
 */
export async function loadEventContext(regiao: Regiao, event: EventDetail): Promise<FeedContext> {
  const [municipalities, categories, venueNames] = await Promise.all([
    listMunicipalities(regiao.id),
    listCategories(),
    listVenueNames(regiao.id, event.municipality_id),
  ]);

  const sessions: FeedSession[] = event.sessions.map((session) => ({
    event_id: event.id,
    session_date: session.session_date,
    start_time: session.start_time,
    end_time: session.end_time,
    location_override: session.location_override,
    is_cancelled: session.is_cancelled,
  }));

  return {
    ...identidadeDosFeeds(regiao),
    municipalityNames: namesById(municipalities),
    venueNames,
    categoryNames: Object.fromEntries(categories.map((category) => [category.slug, category.name])),
    sessions: { [event.id]: sessions },
    timestamps: { [event.id]: event.updated_at },
  };
}

/**
 * A identidade que viaja em todos os feeds da região: a origem das ligações
 * e o espaço de nomes dos UID. A região de recurso não tem nenhum dos dois —
 * deriva-se da origem do deployment, que é o único nome que esse mundo tem.
 */
function identidadeDosFeeds(regiao: Regiao): { siteUrl: string; uidDomain: string } {
  const siteUrl = urlDoSitio(regiao, SITE_URL);
  return {
    siteUrl,
    uidDomain: regiao.dominioDosUid || new URL(siteUrl).host,
  };
}
