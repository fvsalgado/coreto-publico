import { formatDateRange, formatEventDates } from './format';

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

// ---------------------------------------------------------------------------
// O índice: quando foi, quando é
// ---------------------------------------------------------------------------

/** Do primeiro ao último dia de um conjunto de datas, `AAAA-MM-DD`. */
export interface PeriodoDoCiclo {
  de: string;
  ate: string;
}

/** O que o índice dos ciclos sabe de cada um, sem ir buscar os eventos. */
export interface ContagemDoCiclo {
  /** Tudo o que o ciclo tem registado, incluindo o que já passou. */
  total: number;
  /** Só o que ainda está publicado — o que está para vir. */
  porAcontecer: number;
  /** Do primeiro ao último dia do que está para vir; `null` quando já passou tudo. */
  aVir: PeriodoDoCiclo | null;
  /**
   * A edição mais recente das que já aconteceram: o ano, e do primeiro ao
   * último dia dela. É o que deixa o índice dizer «a última foi em maio de
   * 2026» em vez de «dez datas, todas já passadas» e mais nada (C2-023).
   */
  ultimaEdicao: (PeriodoDoCiclo & { ano: string }) | null;
}

/** Uma linha da consulta: o mínimo de cada evento de um ciclo. */
export interface LinhaDeCiclo {
  series_id: string | null;
  status: string;
  date_start: string | null;
  date_end: string | null;
}

function alargar(periodo: PeriodoDoCiclo | null, de: string, ate: string): PeriodoDoCiclo {
  if (!periodo) return { de, ate };
  return { de: de < periodo.de ? de : periodo.de, ate: ate > periodo.ate ? ate : periodo.ate };
}

/**
 * As contagens e as datas de todos os ciclos, numa passagem.
 *
 * «Por acontecer» é o que ainda está publicado — o arquivador passa a
 * `archived` o que acabou, e essa é a mesma regra da página do ciclo. Uma
 * data sem dia conta para o total e não entra em período nenhum: um ciclo com
 * uma data por confirmar não pode inventar-lhe um mês.
 */
export function contagensDosCiclos(
  linhas: readonly LinhaDeCiclo[],
): Record<string, ContagemDoCiclo> {
  const contagens: Record<string, ContagemDoCiclo> = {};

  for (const linha of linhas) {
    if (!linha.series_id) continue;
    const contagem = (contagens[linha.series_id] ??= {
      total: 0,
      porAcontecer: 0,
      aVir: null,
      ultimaEdicao: null,
    });
    contagem.total += 1;
    const publicado = linha.status === 'published';
    if (publicado) contagem.porAcontecer += 1;

    if (!linha.date_start) continue;
    const de = linha.date_start;
    const ate = linha.date_end && linha.date_end > de ? linha.date_end : de;

    if (publicado) {
      contagem.aVir = alargar(contagem.aVir, de, ate);
      continue;
    }
    const ano = de.slice(0, 4);
    const ultima = contagem.ultimaEdicao;
    if (!ultima || ano > ultima.ano) contagem.ultimaEdicao = { ano, de, ate };
    else if (ano === ultima.ano) contagem.ultimaEdicao = { ano, ...alargar(ultima, de, ate) };
  }

  return contagens;
}

/**
 * Quando é, ou quando foi — a frase por baixo do nome no índice (C2-023).
 *
 * O índice dizia «10 datas, todas já passadas» e deixava o leitor sem saber
 * se tinham passado há um mês ou há três anos; os ciclos sem datas eram um
 * nome sem mais nada. O que está para vir diz-se com as datas, como na
 * agenda; o que passou diz o ano e o intervalo da última edição; o que nunca
 * teve datas diz isso mesmo — sem adivinhar uma época que ninguém escreveu.
 */
export function quandoDoCiclo(contagem: ContagemDoCiclo | undefined, hoje: string): string {
  if (!contagem || contagem.total === 0) return 'Sem datas registadas';

  const passadas = contagem.total - contagem.porAcontecer;
  if (contagem.porAcontecer > 0) {
    const quantas = contagem.porAcontecer === 1 ? 'Uma data' : `${contagem.porAcontecer} datas`;
    const quando = contagem.aVir
      ? `: ${formatEventDates(contagem.aVir.de, contagem.aVir.ate, hoje)}`
      : '';
    const antes =
      passadas === 0 ? '' : passadas === 1 ? ' (e uma já passada)' : ` (e ${passadas} já passadas)`;
    return `${quantas} por acontecer${quando}${antes}`;
  }

  const quantas =
    contagem.total === 1 ? 'Uma data, já passada' : `${contagem.total} datas, todas já passadas`;
  const ultima = contagem.ultimaEdicao;
  if (!ultima) return quantas;
  return `${quantas} — a última edição foi em ${ultima.ano} (${formatDateRange(ultima.de, ultima.ate)})`;
}

/**
 * A ordem do índice: o que está para vir primeiro, pelo dia em que começa; a
 * seguir o que já aconteceu, do mais recente para o mais antigo; e o nome
 * para desempatar — a ordem da pergunta «o que há para ver?», e não a do
 * alfabeto.
 */
export function ordemDosCiclos<T extends { id: string; name: string }>(
  contagens: Readonly<Record<string, ContagemDoCiclo>>,
): (a: T, b: T) => number {
  return (a, b) => {
    const ca = contagens[a.id];
    const cb = contagens[b.id];
    const vemA = ca?.aVir?.de ?? null;
    const vemB = cb?.aVir?.de ?? null;
    if (vemA && vemB && vemA !== vemB) return vemA < vemB ? -1 : 1;
    if (vemA && !vemB) return -1;
    if (!vemA && vemB) return 1;
    const foiA = ca?.ultimaEdicao?.ate ?? '';
    const foiB = cb?.ultimaEdicao?.ate ?? '';
    if (foiA !== foiB) return foiA > foiB ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt');
  };
}
