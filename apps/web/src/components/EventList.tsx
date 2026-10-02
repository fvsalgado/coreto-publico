import Link from 'next/link';
import { addDays } from '@coreto/core/dates';
import { ONGOING, UNDATED, groupByDay } from '@/src/lib/agrupar';
import { formatEventDates, formatRelativeDay } from '@/src/lib/format';
import { Capa } from './Capa';
import { EventCard } from './EventCard';
import type { EventCard as EventCardData } from '@/src/lib/queries/types';

type Evento = EventCardData & { start_time?: string | null; dias?: readonly string[] };

interface Props {
  events: Evento[];
  /** Data de hoje em Lisboa, para os rótulos «Hoje» e «Amanhã». */
  today: string;
  /**
   * O primeiro dia da janela que a lista mostra — o `from` do filtro. Decide o
   * que «já abriu» (e vai para a prateleira) e o dia de cada lista de sessões.
   * Sem filtro é hoje.
   */
  inicio?: string;
  /** A janela inteira já passou: a prateleira diz que esteve, e não que está. */
  janelaPassada?: boolean;
  municipalityNames?: Record<string, string>;
  venueNames?: Record<string, string>;
  showMunicipality?: boolean;
  /** O nível do cabeçalho de dia acompanha a página onde a lista entra. */
  dayHeadingLevel?: 2 | 3;
  /** Distingue os `id` dos cabeçalhos quando há mais de uma lista na página. */
  idPrefix?: string;
  /**
   * Os eventos cujo acesso a cadeiras de rodas é o do espaço — o evento não
   * declara nada (`eventosComAcessoDoEspaco`). O cartão di-lo (C2-011); sem
   * isto, diz «Acessível», como dizia.
   */
  acessoDoEspaco?: ReadonlySet<string>;
}

/*
 * O cabeçalho de um dia: na letra dos títulos, em caixa de frase e a tinta.
 *
 * Era cinzento, em maiúsculas espaçadas a 14 píxeis — «HOJE» pesava o mesmo
 * que «QUARTA-FEIRA, 7 OUT», lia-se letra a letra, e o leitor de ecrã recebia
 * as maiúsculas do `text-transform` (C1-004, C2-041, C3-019). O ponto à
 * esquerda é da cor de destaque em «Hoje» e «Amanhã», e apagado nos outros:
 * é o ritmo da semana, à vista.
 */
const CABECALHO = 'font-display flex items-center gap-3 text-lg leading-tight font-semibold';

function Marca({ perto }: { perto: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`ct-octagon size-2.5 shrink-0 ${perto ? 'bg-highlight' : 'bg-field'}`}
    />
  );
}

const Traco = () => <span aria-hidden="true" className="ct-rule min-w-8 flex-1" />;

/**
 * Lista de eventos agrupada por dia, com o que está em cartaz numa prateleira.
 *
 * Cada dia é uma `section` com o seu cabeçalho — quem navega por cabeçalhos
 * salta de dia para dia —, mas sem nome acessível: com nome, cada dia era
 * também um marco, e a entrada tinha onze marcos a mais na lista de quem
 * navega por regiões (C3-019).
 *
 * A partir da secretária, os cartões vão aos pares (C1-003): uma coluna de 992
 * píxeis tinha o texto a acabar a meio e uma faixa branca à direita, e cabiam
 * três cartões e meio por ecrã.
 */
export function EventList({
  events,
  today,
  inicio = today,
  janelaPassada = false,
  municipalityNames,
  venueNames,
  showMunicipality = true,
  dayHeadingLevel = 2,
  idPrefix = 'dia',
  acessoDoEspaco,
}: Props) {
  const groups = groupByDay(events, today, inicio);
  const Cabecalho = dayHeadingLevel === 2 ? 'h2' : 'h3';
  const nivel = dayHeadingLevel === 2 ? 3 : 4;
  // «Hoje» e «Amanhã» levam o ponto aceso; os outros dias, apagado.
  const perto = new Set([today, addDays(today, 1)]);

  return (
    <div className="space-y-9">
      {groups.map((group) => {
        const headingId = `${idPrefix}-${group.key}`;

        if (group.key === ONGOING) {
          return (
            <EmCartaz
              key={group.key}
              id={headingId}
              Cabecalho={Cabecalho}
              nivel={nivel}
              eventos={group.events}
              today={today}
              passado={janelaPassada}
              venueNames={venueNames}
              municipalityNames={municipalityNames}
            />
          );
        }

        const label =
          group.key === UNDATED ? 'Data por confirmar' : formatRelativeDay(group.key, today);
        // `<time dateTime="sem-data">` não é uma data: só os grupos que são
        // mesmo um dia levam `time`.
        const heading = group.key === UNDATED ? label : <time dateTime={group.key}>{label}</time>;

        return (
          <section key={group.key}>
            <Cabecalho id={headingId} className={CABECALHO}>
              <Marca perto={perto.has(group.key)} />
              {heading}
              <Traco />
            </Cabecalho>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {group.events.map((event) => (
                <EventCard
                  today={today}
                  inicio={inicio}
                  nivel={nivel}
                  key={event.id}
                  event={event}
                  municipalityName={municipalityNames?.[event.municipality_id]}
                  venueName={event.venue_id ? venueNames?.[event.venue_id] : undefined}
                  showMunicipality={showMunicipality}
                  acessoDoEspaco={acessoDoEspaco?.has(event.id) ?? false}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * O que está em cartaz há dias — exposições, temporadas, programas de verão —,
 * numa prateleira compacta e não em cartões de lista (C1-001, C2-046).
 *
 * Continua a ser verdade que se pode ir lá hoje, e por isso está logo a seguir
 * ao primeiro dia; mas é uma linha de capas que desliza, e não uma parede de
 * cartões iguais à frente do que acontece mesmo hoje. Cada capa é uma
 * ligação, e nada mais: guardar e partilhar estão na ficha.
 */
function EmCartaz({
  id,
  Cabecalho,
  nivel,
  eventos,
  today,
  passado,
  venueNames,
  municipalityNames,
}: {
  id: string;
  Cabecalho: 'h2' | 'h3';
  nivel: 3 | 4;
  eventos: Evento[];
  today: string;
  passado: boolean;
  venueNames?: Record<string, string>;
  municipalityNames?: Record<string, string>;
}) {
  const Titulo = nivel === 4 ? 'h4' : 'h3';
  return (
    <section>
      <Cabecalho id={id} className={CABECALHO}>
        <Marca perto={false} />
        <span>
          {passado ? 'Estava em cartaz' : 'Também em cartaz'}
          <span className="font-sans text-base font-normal text-muted"> · {eventos.length}</span>
        </span>
        <Traco />
      </Cabecalho>
      <p className="mt-1 text-sm text-muted">
        {passado
          ? 'Exposições e outros que já estavam abertos nesses dias.'
          : 'Exposições e outros que já abriram — cada um até à sua data.'}
      </p>
      <div className="ct-shelf-wrap mt-3">
        <ul className="ct-rail gap-3 pb-2">
          {eventos.map((evento) => {
            const onde =
              (evento.venue_id ? venueNames?.[evento.venue_id] : null) ??
              evento.location_name ??
              municipalityNames?.[evento.municipality_id] ??
              null;
            return (
              <li key={evento.id} className="w-38 shrink-0 snap-start">
                <article className="ct-lift relative flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-2">
                  <Capa event={evento} today={today} className="w-full" semTitulo />
                  <p className="text-sm font-medium text-highlight">
                    <time dateTime={evento.date_end ?? evento.date_start ?? undefined}>
                      {formatEventDates(evento.date_start, evento.date_end, today)}
                    </time>
                  </p>
                  <Titulo className="font-display line-clamp-3 text-base leading-snug font-semibold">
                    <Link
                      href={`/evento/${evento.slug}`}
                      className="underline-offset-4 hover:underline after:absolute after:inset-0 after:content-['']"
                    >
                      {evento.title}
                    </Link>
                  </Titulo>
                  {onde ? <p className="line-clamp-2 text-sm text-muted">{onde}</p> : null}
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
