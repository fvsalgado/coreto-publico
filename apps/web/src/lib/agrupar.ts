/**
 * Como se arruma uma lista de eventos por dia.
 *
 * Vive à parte da lista que a desenha porque é a parte que se pode enganar
 * sozinha — e a que se pode testar: o `vitest` desta casa não resolve o
 * atalho `@/`, e um módulo sem dependências é um módulo com testes.
 */

/** Um evento, do pouco que este módulo precisa de saber sobre ele. */
export interface EventoAgrupavel {
  date_start: string | null;
  date_end: string | null;
}

export interface DayGroup<T> {
  key: string;
  events: T[];
}

export const UNDATED = 'sem-data';
export const ONGOING = 'a-decorrer';

/** O que ordena por último quando não há data de fim. */
const SEM_FIM = '9999-12-31';

/**
 * Agrupa por dia de visita, não por dia de estreia — e separa o que já abriu.
 *
 * Uma exposição que abriu em maio e fecha em janeiro tem de aparecer hoje:
 * quem está a ver a agenda hoje pode lá ir hoje. Só que atirá-la para dentro
 * do grupo «Hoje» punha-a a fingir que estreava hoje — e como a lista vem
 * ordenada por data de início, as temporadas ficavam todas por cima do que
 * acontece mesmo hoje. A primeira página da agenda eram três exposições
 * abertas há meses e nem um concerto.
 *
 * Passam a ter grupo próprio, «A decorrer», à frente dos dias — porque estão
 * mesmo a decorrer — mas dito com todas as letras. Dentro do grupo ordenam-se
 * pelo fim: o que fecha primeiro é o que tem pressa.
 *
 * Os grupos de dia saem por ordem crescente sem ser preciso reordenar nada,
 * porque a lista já vem ordenada por data de início.
 */
export function groupByDay<T extends EventoAgrupavel>(
  events: readonly T[],
  today: string,
): Array<DayGroup<T>> {
  const groups: Array<DayGroup<T>> = [];
  const index = new Map<string, DayGroup<T>>();

  for (const event of events) {
    const start = event.date_start;
    const key = start === null ? UNDATED : start < today ? ONGOING : start;
    const existing = index.get(key);
    if (existing) {
      existing.events.push(event);
    } else {
      const group: DayGroup<T> = { key, events: [event] };
      index.set(key, group);
      groups.push(group);
    }
  }

  const emCurso = index.get(ONGOING);
  if (emCurso) {
    emCurso.events.sort((a, b) => (a.date_end ?? SEM_FIM).localeCompare(b.date_end ?? SEM_FIM));
  }

  return groups;
}
