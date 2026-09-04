import { ONGOING, UNDATED, groupByDay } from '@/src/lib/agrupar';
import { formatRelativeDay } from '@/src/lib/format';
import { EventCard } from './EventCard';
import type { EventCard as EventCardData } from '@/src/lib/queries/types';

interface Props {
  events: EventCardData[];
  /** Data de hoje em Lisboa, para os rótulos «Hoje» e «Amanhã». */
  today: string;
  municipalityNames?: Record<string, string>;
  venueNames?: Record<string, string>;
  showMunicipality?: boolean;
  /** O nível do cabeçalho de dia acompanha a página onde a lista entra. */
  dayHeadingLevel?: 2 | 3;
  /** Distingue os `id` dos cabeçalhos quando há mais de uma lista na página. */
  idPrefix?: string;
}

/**
 * Lista de eventos agrupada por dia.
 *
 * Cada dia é uma `section` com nome acessível: quem navega por regiões ou por
 * cabeçalhos salta de dia para dia sem ter de percorrer os cartões todos.
 */
export function EventList({
  events,
  today,
  municipalityNames,
  venueNames,
  showMunicipality = true,
  dayHeadingLevel = 2,
  idPrefix = 'dia',
}: Props) {
  const groups = groupByDay(events, today);
  const headingClass =
    'flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted';
  const marker = <span aria-hidden="true" className="ct-octagon size-2 shrink-0 bg-highlight" />;
  const tail = <span aria-hidden="true" className="ct-rule min-w-8 flex-1" />;

  return (
    <div className="space-y-9">
      {groups.map((group) => {
        const headingId = `${idPrefix}-${group.key}`;
        const label =
          group.key === UNDATED
            ? 'Data por confirmar'
            : group.key === ONGOING
              ? 'A decorrer'
              : formatRelativeDay(group.key, today);
        // `<time dateTime="a-decorrer">` não é uma data: só os grupos que
        // são mesmo um dia levam `time`.
        const heading =
          group.key === UNDATED || group.key === ONGOING ? (
            label
          ) : (
            <time dateTime={group.key}>{label}</time>
          );

        return (
          <section key={group.key} aria-labelledby={headingId}>
            {dayHeadingLevel === 2 ? (
              <h2 id={headingId} className={headingClass}>
                {marker}
                {heading}
                {tail}
              </h2>
            ) : (
              <h3 id={headingId} className={headingClass}>
                {marker}
                {heading}
                {tail}
              </h3>
            )}

            <div className="mt-3 grid gap-3">
              {group.events.map((event) => (
                <EventCard
                  today={today}
                  key={event.id}
                  event={event}
                  municipalityName={municipalityNames?.[event.municipality_id]}
                  venueName={event.venue_id ? venueNames?.[event.venue_id] : undefined}
                  showMunicipality={showMunicipality}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
