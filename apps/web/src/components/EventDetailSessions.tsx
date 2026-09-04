import { formatTime, formatWeekdayDate } from '@/src/lib/format';
import type { EventSession } from '@/src/lib/queries/types';

interface Props {
  sessions: EventSession[];
  /** Data de hoje em Lisboa, para distinguir o que já decorreu. */
  today: string;
  /**
   * O evento é um período — uma exposição patente —, não uma lista de
   * compromissos. Num período as sessões são o dia de abrir e o de fechar, e
   * não terem hora não é uma falta: o horário de abertura não é a hora de uma
   * sessão. A ficha nem chega a listar as sessões nesse caso, mas a regra
   * fica aqui, onde se decide o que se mostra.
   */
  isOngoing?: boolean;
}

/**
 * Todas as sessões, incluindo as canceladas e as que já passaram.
 *
 * Esconder uma sessão cancelada parece arrumado e é a pior coisa que a agenda
 * pode fazer: quem já tinha bilhete vem cá confirmar e sai convencido de que
 * o espetáculo se mantém. Uma sessão cancelada fica na lista, marcada.
 */
export function EventDetailSessions({ sessions, today, isOngoing = false }: Props) {
  if (sessions.length === 0) return null;

  return (
    <ol className="mt-3 space-y-2">
      {sessions.map((session) => {
        const time = formatTime(session.start_time);
        const endTime = formatTime(session.end_time);
        const isPast = session.session_date < today;
        const dateTime = session.start_time
          ? `${session.session_date}T${session.start_time.slice(0, 5)}`
          : session.session_date;

        return (
          <li
            key={`${session.session_date}-${session.start_time ?? 'sem-hora'}`}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-2 last:border-b-0"
          >
            <time
              dateTime={dateTime}
              className={
                session.is_cancelled
                  ? 'font-medium text-muted line-through'
                  : isPast
                    ? 'text-muted'
                    : 'font-medium'
              }
            >
              {formatWeekdayDate(session.session_date)}
              {time ? ` · ${time}` : ''}
              {time && endTime ? `–${endTime}` : ''}
            </time>

            {/*
              Uma sessão sem hora ficava só com a data, como se a hora não
              fosse coisa que se esperasse ali. A dúvida diz-se com o mesmo
              sinal em toda a casa — «Data por confirmar», «Local por
              confirmar» — e aqui faltava. Não se diz de uma sessão cancelada
              nem de uma que já passou: nessas a hora já não é a pergunta.
            */}
            {!time && !isOngoing && !session.is_cancelled && !isPast ? (
              <span className="text-xs text-muted">hora por confirmar</span>
            ) : null}

            {session.is_cancelled ? (
              <span className="rounded bg-accent-soft px-2 py-0.5 text-xs font-semibold text-highlight">
                Cancelada
              </span>
            ) : isPast ? (
              <span className="text-xs text-muted">já decorreu</span>
            ) : null}

            {session.location_override ? (
              <span className="text-sm text-muted">{session.location_override}</span>
            ) : null}

            {session.notes ? (
              <span className="w-full text-sm text-muted">{session.notes}</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
