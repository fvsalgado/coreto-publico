/**
 * O cartaz A4 da semana de um concelho: o que entra, em que dia, a que horas
 * (C2-032, C4-022; plano 05, medida 14).
 *
 * É a folha para a porta do café, da junta, da biblioteca e do lar — «o único
 * formato em que a cultura circula mesmo no interior», nas palavras do plano.
 * Vive à parte da página que a desenha pela razão de `agrupar.ts`: é a parte
 * que se pode enganar sozinha, e um módulo sem dependências tem teste.
 *
 * **Não é a lista da agenda impressa.** A lista arruma cada evento pelo dia da
 * próxima sessão, e uma vez só: no ecrã, quem quer ver o resto abre a ficha.
 * Numa folha afixada não há ficha para abrir, e um coro que canta na sexta e
 * no domingo tem de estar nos dois dias — quem passa à porta no sábado e lê
 * «domingo» tem de o encontrar lá. Por isso a folha sai das **sessões**: uma
 * linha por dia em que o evento acontece, com as horas desse dia.
 *
 * Três regras, pela ordem em que se aplicam:
 *
 * - **um período fica à parte**, em «Durante a semana»: uma exposição patente
 *   não acontece num dia, está aberta — e repeti-la nos sete dias enchia a
 *   folha de uma coisa só;
 * - **com sessões, a sessão manda**: uma linha por dia da semana em que há
 *   sessão de pé; as canceladas não entram (a folha não tem como as riscar e
 *   quem as lesse ia à porta fechada);
 * - **sem sessões lidas, vale a data**: um dia só entra nesse dia; vários dias
 *   seguidos sem sessões são um período, e vão para «Durante a semana» com as
 *   datas.
 *
 * O que não cabe na semana não se corta para caber a folha: a semana sai em
 * duas folhas, e a página diz quantos eventos são (o plano: «cortar é editar,
 * e editar é uma escolha que esta casa não faz em nome de quem programa»).
 */
import { horaDeInicioConhecida } from '@coreto/core/dates';

/** O pouco que a folha precisa de saber de um evento. */
export interface EventoDoCartaz {
  id: string;
  slug: string;
  title: string;
  date_start: string | null;
  date_end: string | null;
  is_ongoing: boolean;
  is_free: boolean;
  price_display: string | null;
  venue_id: string | null;
  location_name: string | null;
}

/** Uma sessão, como `listFeedSessions` a devolve. */
export interface SessaoDoCartaz {
  session_date: string;
  start_time: string | null;
  end_time?: string | null;
  is_cancelled: boolean;
}

/** Uma linha da folha: o evento, as horas do dia (já por ordem), o sítio e o preço. */
export interface LinhaDoCartaz {
  slug: string;
  titulo: string;
  /** `HH:MM`, por ordem e sem repetições; vazio quando a fonte não deu hora. */
  horas: string[];
  onde: string | null;
  /** «Entrada livre», o preço que a fonte escreveu, ou nada. */
  preco: string | null;
}

export interface DiaDoCartaz {
  /** `AAAA-MM-DD`. */
  dia: string;
  linhas: LinhaDoCartaz[];
}

/** Um período: aberto durante a semana, com as datas dele. */
export interface PeriodoDoCartaz extends LinhaDoCartaz {
  de: string | null;
  ate: string | null;
}

export interface CartazDaSemana {
  de: string;
  ate: string;
  /** Só os dias com alguma coisa — um dia vazio na folha é papel deitado fora. */
  dias: DiaDoCartaz[];
  periodos: PeriodoDoCartaz[];
  /** Quantos eventos diferentes a folha leva. */
  eventos: number;
  /** Quantas linhas a folha leva, contando cada dia de cada evento. */
  linhas: number;
}

function precoDoEvento(evento: EventoDoCartaz): string | null {
  if (evento.is_free) return 'Entrada livre';
  const preco = evento.price_display?.trim();
  return preco ? preco : null;
}

/** As horas de um dia: as conhecidas, por ordem, sem repetir. */
function horasDoDia(sessoes: readonly SessaoDoCartaz[]): string[] {
  const horas = sessoes
    .map((sessao) => horaDeInicioConhecida(sessao.start_time, sessao.end_time ?? null))
    .filter((hora): hora is string => Boolean(hora))
    .map((hora) => hora.slice(0, 5));
  return [...new Set(horas)].sort();
}

/** A ordem num dia: pela primeira hora, o que não a tem no fim, e depois pelo título. */
function ordemNoDia(a: LinhaDoCartaz, b: LinhaDoCartaz): number {
  const horaA = a.horas[0] ?? null;
  const horaB = b.horas[0] ?? null;
  if (horaA !== horaB) {
    if (horaA === null) return 1;
    if (horaB === null) return -1;
    return horaA.localeCompare(horaB);
  }
  return a.titulo.localeCompare(b.titulo, 'pt');
}

export function montarCartazDaSemana(
  eventos: readonly EventoDoCartaz[],
  sessoes: Readonly<Record<string, readonly SessaoDoCartaz[]>>,
  janela: { from: string; to: string },
  nomesDosEspacos: Readonly<Record<string, string>> = {},
): CartazDaSemana {
  const { from, to } = janela;
  const porDia = new Map<string, LinhaDoCartaz[]>();
  const periodos: PeriodoDoCartaz[] = [];
  const contados = new Set<string>();

  for (const evento of eventos) {
    const linha: LinhaDoCartaz = {
      slug: evento.slug,
      titulo: evento.title,
      horas: [],
      onde:
        (evento.venue_id ? nomesDosEspacos[evento.venue_id] : undefined) ?? evento.location_name,
      preco: precoDoEvento(evento),
    };
    const fim = evento.date_end ?? evento.date_start;
    const tocaNaSemana =
      evento.date_start !== null && evento.date_start <= to && fim !== null && fim >= from;

    const proprias = sessoes[evento.id] ?? [];
    const naSemana = proprias.filter(
      (sessao) => !sessao.is_cancelled && sessao.session_date >= from && sessao.session_date <= to,
    );

    if (evento.is_ongoing) {
      if (!tocaNaSemana) continue;
      periodos.push({ ...linha, de: evento.date_start, ate: evento.date_end });
      contados.add(evento.id);
      continue;
    }

    if (naSemana.length > 0) {
      const dias = [...new Set(naSemana.map((sessao) => sessao.session_date))];
      for (const dia of dias) {
        const doDia = naSemana.filter((sessao) => sessao.session_date === dia);
        const linhas = porDia.get(dia) ?? [];
        linhas.push({ ...linha, horas: horasDoDia(doDia) });
        porDia.set(dia, linhas);
      }
      contados.add(evento.id);
      continue;
    }

    // Sessões lidas e nenhuma de pé na semana: canceladas, ou noutros dias. A
    // folha não tem como dizer «cancelado», e por isso cala-se.
    if (proprias.length > 0 || !tocaNaSemana) continue;

    if (evento.date_start !== null && fim === evento.date_start) {
      const linhas = porDia.get(evento.date_start) ?? [];
      linhas.push(linha);
      porDia.set(evento.date_start, linhas);
    } else {
      periodos.push({ ...linha, de: evento.date_start, ate: evento.date_end });
    }
    contados.add(evento.id);
  }

  const dias = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, linhas]) => ({ dia, linhas: [...linhas].sort(ordemNoDia) }));
  periodos.sort((a, b) => (a.ate ?? '9999-12-31').localeCompare(b.ate ?? '9999-12-31'));

  return {
    de: from,
    ate: to,
    dias,
    periodos,
    eventos: contados.size,
    linhas: dias.reduce((soma, dia) => soma + dia.linhas.length, 0) + periodos.length,
  };
}
