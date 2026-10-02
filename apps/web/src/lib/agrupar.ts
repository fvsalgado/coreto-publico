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
  /** Um período (exposição patente) e não uma lista de sessões. */
  is_ongoing?: boolean;
  /**
   * Os dias das sessões de pé, de hoje (ou do início da janela) em diante —
   * os que `withCardTimes` lê. Sem eles, decide a data de início, como antes.
   */
  dias?: readonly string[];
  /** A hora do dia em que o evento cai, quando se sabe (`withCardTimes`). */
  start_time?: string | null;
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
 * O dia em que o evento entra na lista.
 *
 * **Uma lista de sessões entra pelo dia da próxima** — a primeira dentro da
 * janela. Um coro com sessões a 4 e a 12 entrava sempre pelo dia 4, e no dia
 * 5 passava a «a decorrer», como se fosse uma exposição aberta; é o dia 12.
 *
 * **Um período que já abriu fica em cartaz**, e não no dia de hoje: atirá-lo
 * para o grupo «Hoje» punha-o a fingir que estreava hoje. E «já abriu» conta
 * contra o início da janela, e não contra hoje: num recorte de sexta a domingo
 * visto à quinta, a feira que abriu na quinta não é «Hoje» — hoje nem está no
 * recorte (C2-046). Num recorte de dias que já passaram, o que aconteceu
 * nesses dias fica no seu dia, e não em cartaz (C2-016).
 */
function diaDoEvento(evento: EventoAgrupavel, inicio: string): string {
  if (evento.date_start === null) return UNDATED;
  if (!evento.is_ongoing && evento.dias && evento.dias.length > 0) {
    return evento.dias.find((dia) => dia >= inicio) ?? (evento.dias.at(-1) as string);
  }
  return evento.date_start < inicio ? ONGOING : evento.date_start;
}

/**
 * A ordem dentro de um dia: pela hora, e o que não a tem no fim (C2-001).
 *
 * Os dias saíam pela ordem da consulta, que é a do fim de cada evento e depois
 * a do título: num domingo lia-se 21h, 11h, 16h — e quem procurava a sessão da
 * manhã para as crianças encontrava-a depois da da noite. Sem hora, os de um
 * dia só vêm antes dos de vários dias, que são os que menos dependem dele. O
 * resto do empate fica pela ordem de chegada (a ordenação é estável).
 */
function ordemNoDia(a: EventoAgrupavel, b: EventoAgrupavel): number {
  const horaA = a.start_time ?? null;
  const horaB = b.start_time ?? null;
  if (horaA !== null && horaB !== null) return horaA.localeCompare(horaB);
  if (horaA !== null) return -1;
  if (horaB !== null) return 1;
  const variosA = a.date_end !== null && a.date_end !== a.date_start ? 1 : 0;
  const variosB = b.date_end !== null && b.date_end !== b.date_start ? 1 : 0;
  return variosA - variosB;
}

/**
 * Agrupa por dia de visita, não por dia de estreia — e põe o que tem dia e
 * hora à frente do que está em cartaz há semanas.
 *
 * O que já estava aberto tinha grupo próprio, «A decorrer», **à frente** dos
 * dias. Na entrada do Médio Tejo eram treze cartões — exposições até janeiro,
 * campanhas de turismo, um desafio de quilómetros — e «Hoje» só aparecia aos
 * 3 700 píxeis; num recorte de fim de semana, o primeiro evento com dia
 * aparecia ao fim de dois ecrãs e meio (C1-001, C2-046). A pergunta de quem
 * abre a agenda é «o que há hoje, o que há no fim de semana», e a resposta
 * estava por baixo de uma parede de coisas que estão sempre lá.
 *
 * A ordem passa a ser esta: o primeiro dia, o que está em cartaz (que a lista
 * desenha como uma prateleira compacta), os outros dias, e o que não tem data.
 * O primeiro dia à cabeça — e não a prateleira — porque é o que responde; a
 * prateleira logo a seguir porque continua a ser verdade que aquilo se pode
 * ir ver hoje. Dentro dos dias, pela hora; dentro do que está em cartaz, pelo
 * fim — o que fecha primeiro é o que tem pressa.
 *
 * Os grupos saem ordenados aqui, e não pela ordem em que os eventos chegam: a
 * consulta ordena por `agenda_date` — `coalesce(date_end, date_start)`, desde a
 * 0053 —, e um evento de vários dias chega pelo dia em que acaba.
 */
export function groupByDay<T extends EventoAgrupavel>(
  events: readonly T[],
  today: string,
  /**
   * O primeiro dia da janela que a lista mostra — o `from` do filtro. Sem
   * filtro é hoje, que é o que a agenda mostra por omissão.
   */
  inicio: string = today,
): Array<DayGroup<T>> {
  const index = new Map<string, DayGroup<T>>();

  for (const event of events) {
    const key = diaDoEvento(event, inicio);
    const existing = index.get(key);
    if (existing) existing.events.push(event);
    else index.set(key, { key, events: [event] });
  }

  const emCartaz = index.get(ONGOING);
  if (emCartaz) {
    emCartaz.events.sort((a, b) => (a.date_end ?? SEM_FIM).localeCompare(b.date_end ?? SEM_FIM));
  }

  const dias = [...index.values()]
    .filter((grupo) => grupo.key !== ONGOING && grupo.key !== UNDATED)
    .sort((a, b) => a.key.localeCompare(b.key));
  for (const dia of dias) dia.events.sort(ordemNoDia);

  const semData = index.get(UNDATED);
  return [
    ...dias.slice(0, 1),
    ...(emCartaz ? [emCartaz] : []),
    ...dias.slice(1),
    ...(semData ? [semData] : []),
  ];
}
