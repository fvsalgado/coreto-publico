/**
 * Um ciclo agrupa-se por edição, e uma edição é um ano.
 *
 * «Edição» é a palavra que quem programa usa — o CAMINHOS de 2026 é uma coisa
 * e o de 2027 será outra —, e é por isso que este agrupamento existe em vez de
 * uma lista corrida por data. Vive aqui, e não dentro da página, porque uma
 * regra de agrupamento é a espécie de código que se parte em silêncio: ordena
 * ao contrário, engole os eventos sem data, ou passa a chamar «edição» a duas
 * coisas diferentes. Um módulo sem React lê-se num teste de milissegundos.
 */

/** O mínimo que este módulo precisa de saber sobre um evento. */
export interface EventoDeCiclo {
  date_start: string | null;
  status: string;
}

export interface Edicao<T> {
  /** O ano, `AAAA`. */
  ano: string;
  eventos: T[];
  /** Nenhum dos eventos desta edição está publicado — ela já aconteceu toda. */
  passou: boolean;
}

/**
 * Agrupa por ano, da edição mais recente para a mais antiga.
 *
 * Um evento sem data fica de fora: um ciclo com uma data por confirmar não
 * pode inventar-lhe um ano só para ela caber numa gaveta. A ordem dentro de
 * cada edição é a que entrou — quem chama já ordenou por data.
 */
export function edicoesDoCiclo<T extends EventoDeCiclo>(eventos: readonly T[]): Edicao<T>[] {
  const porAno = new Map<string, T[]>();

  for (const evento of eventos) {
    if (!evento.date_start) continue;
    const ano = evento.date_start.slice(0, 4);
    const lista = porAno.get(ano) ?? [];
    lista.push(evento);
    porAno.set(ano, lista);
  }

  return [...porAno.entries()]
    .map(([ano, lista]) => ({
      ano,
      eventos: lista,
      passou: lista.every((evento) => evento.status !== 'published'),
    }))
    .sort((a, b) => b.ano.localeCompare(a.ano));
}
