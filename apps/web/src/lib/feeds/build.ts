import { formatDateRange } from '../format';
import type { EventCard } from '../queries/types';
import type { FeedSession } from './data';
import type { CalendarEntry } from './ical';
import type { RssItem } from './rss';

/**
 * De linhas da base de dados a entradas de feed.
 *
 * Aqui não se lê nada e não se escreve nada: recebe-se o que as consultas
 * trouxeram e devolve-se o que os geradores sabem escrever. É a camada que se
 * pode ler de uma ponta à outra para perceber o que é que um subscritor vê.
 */

/**
 * Acima disto, as sessões deixam de ser compromissos e passam a ser «está em
 * cartaz». Uma exposição publicada dia a dia traz sessenta sessões; sessenta
 * entradas na agenda de alguém não é informação, é ruído — e é a maneira mais
 * rápida de perder um subscritor.
 *
 * É a rede de segurança e não a regra: a regra é o `is_ongoing` aqui em baixo,
 * que diz o que a fonte afirmou em vez de o deduzir de uma contagem. Este
 * número só apanha o que escapar — uma fonte que publique mesmo uma sessão por
 * dia, ou uma recorrência expandida.
 */
const SESSIONS_AS_APPOINTMENTS = 12;

export interface FeedContext {
  /** A origem pública da região — é dela que saem as ligações dos feeds. */
  siteUrl: string;
  /**
   * O espaço de nomes permanente dos UID (`regions.ical_uid_domain`). Nunca
   * muda depois de haver subscritores; é por isso coluna própria e não o
   * domínio do momento.
   */
  uidDomain: string;
  municipalityNames: Readonly<Record<string, string>>;
  venueNames: Readonly<Record<string, string>>;
  categoryNames: Readonly<Record<string, string>>;
  sessions: Readonly<Record<string, FeedSession[]>>;
  /** `updated_at` de cada evento, indexado pelo `id`. */
  timestamps: Readonly<Record<string, string>>;
}

export function eventUrl(origem: string, slug: string): string {
  return `${origem}/evento/${slug}`;
}

/**
 * O caminho do calendário de um evento — e há um teste a guardá-lo.
 *
 * Esteve errado desde que existe: a ficha oferecia `/evento/<endereço>.ics` e a
 * rota chama-se `/evento/<endereço>/agenda.ics`. O botão «Adicionar ao
 * calendário» de todas as fichas dava 404, e o `<link rel="alternate">` que diz
 * aos leitores de calendário onde subscrever apontava para o mesmo sítio
 * nenhum. Um endereço escrito à mão em dois ficheiros diferentes é o que torna
 * isto possível — por isso passa a ser escrito aqui, uma vez, e
 * `build.test.ts` confirma que o ficheiro da rota existe mesmo no caminho que
 * esta função devolve.
 */
export function eventCalendarPath(slug: string): string {
  return `/evento/${slug}/agenda.ics`;
}

function placeLabel(
  event: EventCard,
  context: FeedContext,
  override: string | null = null,
): string | null {
  const venueName = event.venue_id ? context.venueNames[event.venue_id] : undefined;
  const place = override ?? venueName ?? event.location_name;
  const municipality = context.municipalityNames[event.municipality_id];

  if (place && municipality) return `${place}, ${municipality}`;
  return place ?? municipality ?? null;
}

function priceLabel(event: EventCard): string | null {
  if (event.is_free) return 'Entrada livre';
  return event.price_display;
}

function categoryLabels(event: EventCard, context: FeedContext): string[] {
  if (!event.category_slug) return [];
  return [context.categoryNames[event.category_slug] ?? event.category_slug];
}

function updatedAt(event: EventCard, context: FeedContext): Date | null {
  const stamp = context.timestamps[event.id];
  if (!stamp) return null;
  const parsed = Date.parse(stamp);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

export function toRssItems(events: readonly EventCard[], context: FeedContext): RssItem[] {
  return events.map((event) => {
    const facts = [
      formatDateRange(event.date_start, event.date_end),
      placeLabel(event, context),
      priceLabel(event),
    ].filter((part): part is string => Boolean(part));

    const summary = facts.join(' · ');
    const description = event.description_short
      ? `${summary}\n\n${event.description_short}`
      : summary;

    return {
      title: event.title,
      link: eventUrl(context.siteUrl, event.slug),
      description,
      pubDate: updatedAt(event, context),
      categories: categoryLabels(event, context),
    };
  });
}

function calendarDescription(event: EventCard, url: string): string {
  const parts = [event.description_short, priceLabel(event), `Mais informação: ${url}`];
  return parts.filter((part): part is string => Boolean(part)).join('\n\n');
}

export function toCalendarEntries(
  events: readonly EventCard[],
  context: FeedContext,
): CalendarEntry[] {
  const entries: CalendarEntry[] = [];

  for (const event of events) {
    // O domínio do `uid` é um espaço de nomes, não uma morada: nunca é
    // resolvido por ninguém. Mas é permanente — mudá-lo faz um calendário que
    // já esteja subscrito tratar tudo como eventos novos e duplicar a agenda
    // inteira. Vem de `regions.ical_uid_domain`, que nasce igual ao domínio
    // e nunca mais muda; `build.test.ts` prende o do Médio Tejo letra a letra.

    const sessions = context.sessions[event.id] ?? [];
    const url = eventUrl(context.siteUrl, event.slug);
    const shared = {
      summary: event.title,
      description: calendarDescription(event, url),
      url,
      categories: categoryLabels(event, context),
      lastModified: context.timestamps[event.id] ?? null,
    };

    /*
     * Um período é um compromisso só, e é o `is_ongoing` que o diz.
     *
     * Uma exposição chega aqui com duas sessões — o dia em que abre e o dia em
     * que fecha —, e duas sessões passam à vontade por baixo do tecto de
     * `SESSIONS_AS_APPOINTMENTS`. O calendário escrevia então dois `VEVENT`:
     * quem subscrevesse ficava com «Exposição X» marcada a 3 de junho e outra
     * vez a 27 de setembro, e os quase quatro meses do meio — que são a
     * exposição — em branco. Duas marcações falsas onde a informação era um
     * intervalo.
     *
     * Com a marca da fonte lida, sai um `VEVENT` de dia inteiro de `date_start`
     * a `date_end`, que é o que um calendário sabe desenhar como uma barra ao
     * longo dos dias.
     */
    if (!event.is_ongoing && sessions.length > 0 && sessions.length <= SESSIONS_AS_APPOINTMENTS) {
      for (const session of sessions) {
        const timeKey = session.start_time?.replace(/:/g, '') ?? 'dia';
        entries.push({
          ...shared,
          uid: `${event.id}-${session.session_date}-${timeKey}@${context.uidDomain}`,
          date: session.session_date,
          startTime: session.start_time,
          endTime: session.end_time,
          location: placeLabel(event, context, session.location_override),
          cancelled: session.is_cancelled,
        });
      }
      continue;
    }

    // Em cartaz, sem sessões, ou com sessões de mais: um só compromisso de dia
    // inteiro a cobrir o período. Um evento sem data nenhuma não entra — um
    // calendário não sabe o que fazer com ele e ninguém o quer lá.
    if (!event.date_start) continue;
    entries.push({
      ...shared,
      uid: `${event.id}@${context.uidDomain}`,
      date: event.date_start,
      endDate: event.date_end,
      location: placeLabel(event, context),
    });
  }

  return entries;
}
