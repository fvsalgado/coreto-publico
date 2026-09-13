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
 * Onde cada grupo cai na coluna: o que já decorre à frente de todos os dias,
 * o que não tem data no fim, os dias no meio — e esses entre si por data.
 */
function ordemDoGrupo(key: string): number {
  if (key === ONGOING) return 0;
  if (key === UNDATED) return 2;
  return 1;
}

/**
 * Agrupa por dia de visita, não por dia de estreia — e separa o que já abriu.
 *
 * Uma exposição que abriu em maio e fecha em janeiro tem de aparecer hoje:
 * quem está a ver a agenda hoje pode lá ir hoje. Só que atirá-la para dentro
 * do grupo «Hoje» punha-a a fingir que estreava hoje — e como a lista vinha
 * então ordenada por data de início, as temporadas ficavam todas por cima
 * do que acontece mesmo hoje. A primeira página da agenda eram três exposições
 * abertas há meses e nem um concerto.
 *
 * Passam a ter grupo próprio, «A decorrer», à frente dos dias — porque estão
 * mesmo a decorrer — mas dito com todas as letras. Dentro do grupo ordenam-se
 * pelo fim: o que fecha primeiro é o que tem pressa.
 *
 * Os grupos saem ordenados aqui, e não pela ordem em que os eventos chegam.
 * Durante muito tempo bastou a ordem de chegada, porque a lista vinha
 * ordenada por `date_start` e agrupava-se por `date_start`. A migração 0053
 * pôs a consulta a ordenar por `agenda_date` — `coalesce(date_end,
 * date_start)` — e a premissa caiu: um evento de vários dias chega pelo dia
 * em que acaba e agrupa-se pelo dia em que começa. Na entrada do Médio Tejo,
 * a quinta 10 de setembro saía depois do domingo 13 e o «A decorrer» ficava
 * entalado no meio dos dias.
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

  groups.sort((a, b) => ordemDoGrupo(a.key) - ordemDoGrupo(b.key) || a.key.localeCompare(b.key));

  return groups;
}
