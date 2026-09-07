/**
 * Datas em português.
 *
 * As agendas municipais escrevem datas de todas as maneiras: «10 de maio de
 * 2026», «10 MAI», «10 a 12 de junho», «Sáb 10 maio | 21h30», «10/05/2026».
 * Ler mal uma data é o pior erro que esta casa pode cometer — leva alguém a
 * uma porta fechada — por isso o critério é: na dúvida, devolver `null`.
 * Uma data em falta corrige-se na moderação; uma data errada não se nota.
 *
 * Tudo o que sai daqui é `YYYY-MM-DD` no fuso de Lisboa.
 */

export const LISBON_TIME_ZONE = 'Europe/Lisbon';

const MONTHS: Record<string, number> = {
  janeiro: 1,
  jan: 1,
  fevereiro: 2,
  fev: 2,
  marco: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  maio: 5,
  mai: 5,
  junho: 6,
  jun: 6,
  julho: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  setembro: 9,
  set: 9,
  sep: 9,
  outubro: 10,
  out: 10,
  novembro: 11,
  nov: 11,
  dezembro: 12,
  dez: 12,
};

const WEEKDAYS: Record<string, number> = {
  segunda: 1,
  seg: 1,
  'segunda-feira': 1,
  terca: 2,
  ter: 2,
  'terca-feira': 2,
  quarta: 3,
  qua: 3,
  'quarta-feira': 3,
  quinta: 4,
  qui: 4,
  'quinta-feira': 4,
  sexta: 5,
  sex: 5,
  'sexta-feira': 5,
  sabado: 6,
  sab: 6,
  domingo: 7,
  dom: 7,
};

/** Minúsculas sem acentos, mantendo espaços e pontuação. */
function fold(input: string): string {
  return input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Data de hoje em Lisboa, como `YYYY-MM-DD`. */
export function todayInLisbon(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LISBON_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts;
}

/** `true` se a cadeia é uma data ISO válida e existente. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

function toIso(year: number, month: number, day: number): string | null {
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidIsoDate(iso) ? iso : null;
}

/**
 * Ano em falta: as agendas escrevem «10 de maio» sem ano.
 *
 * Assume-se o ano que põe a data no futuro próximo — uma agenda publica o que
 * está para vir. A janela de 30 dias para trás evita que um evento de ontem
 * salte um ano inteiro por ser lido de madrugada.
 */
function inferYear(month: number, day: number, reference: string): number {
  const [refYear, refMonth, refDay] = reference.split('-').map(Number) as [number, number, number];
  const candidate = toIso(refYear, month, day);
  if (!candidate) return refYear;

  const refOrdinal = refMonth * 100 + refDay;
  const candidateOrdinal = month * 100 + day;
  // Mais de um mês no passado ⇒ é do ano que vem.
  if (candidateOrdinal < refOrdinal - 100) return refYear + 1;
  return refYear;
}

export interface ParseDateOptions {
  /** Data de referência para inferir o ano em falta. Por omissão, hoje. */
  reference?: string;
}

/**
 * Lê a primeira data que encontrar num texto português.
 *
 * Devolve `null` quando não há uma leitura inequívoca.
 */
export function parsePortugueseDate(
  input: string | null | undefined,
  options: ParseDateOptions = {},
): string | null {
  const dates = parsePortugueseDates(input, options);
  return dates[0] ?? null;
}

/**
 * Resultado da leitura de datas de um texto.
 *
 * `isRange` distingue as duas coisas que uma agenda escreve de maneira
 * parecida e que significam o oposto: «10 **a** 12 de junho» é uma coisa
 * contínua (uma exposição, uma temporada em cartaz), e «10, 11 **e** 12 de
 * junho» são três sessões.
 */
export interface ParsedEventDates {
  /** As datas a materializar como sessões. Num intervalo, só os dois extremos. */
  dates: string[];
  /** Verdadeiro quando `dates` são os extremos de uma corrida contínua. */
  isRange: boolean;
}

/**
 * Lê as datas de um texto, respeitando a diferença entre intervalo e lista.
 *
 * A regra é «nunca fabricar»: um intervalo dá **dois** extremos, nunca um dia
 * por cada dia lá pelo meio. Escrever trinta sessões porque a fonte disse «de
 * 1 a 30 de junho» é inventar trinta factos que ninguém afirmou — e o site
 * passaria a prometer alguma coisa todas as noites num sítio onde está uma
 * exposição aberta. Uma corrida contínua mostra-se como «1–30 jun», que é o
 * que a fonte diz e o que o visitante precisa de saber.
 */
export function parseEventDates(
  input: string | null | undefined,
  options: ParseDateOptions = {},
): ParsedEventDates {
  const seenRange = { value: false };
  const dates = collectDates(input, options, seenRange);
  return { dates, isRange: seenRange.value && dates.length > 1 };
}

/**
 * As datas de um texto, sem a distinção entre intervalo e lista.
 *
 * Entende «10 de maio de 2026», «10 mai», «10/05/2026», «2026-05-10»,
 * «de 10 a 12 de junho de 2026» (intervalo, dois extremos) e «10, 11 e 12 de
 * junho» (lista, três datas).
 */
export function parsePortugueseDates(
  input: string | null | undefined,
  options: ParseDateOptions = {},
): string[] {
  return parseEventDates(input, options).dates;
}

/**
 * O que pode aparecer entre o dia e o mês, e entre o mês e o ano.
 *
 * «10 de outubro», «10 outubro» e «10/outubro» são a mesma data escrita de três
 * maneiras. A terceira é a que o Centro Cultural Gil Vicente usa em toda a
 * programação — não a ler deixava a agenda de um concelho inteiro de fora,
 * silenciosamente, porque um evento sem data não dá erro nenhum: desaparece.
 */
const SEPARATOR = String.raw`\s*(?:de\s+|/\s*)?`;

function collectDates(
  input: string | null | undefined,
  options: ParseDateOptions,
  seenRange: { value: boolean },
): string[] {
  if (!input) return [];
  const reference = options.reference ?? todayInLisbon();
  const text = fold(input);
  const found: string[] = [];

  const push = (iso: string | null): void => {
    if (iso && !found.includes(iso)) found.push(iso);
  };

  // ISO explícito: 2026-05-10
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    push(toIso(Number(m[1]), Number(m[2]), Number(m[3])));
  }

  // Numérico português: 10/05/2026, 10-05-2026, 10.05.26
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g)) {
    const year = Number(m[3]);
    push(toIso(year < 100 ? 2000 + year : year, Number(m[2]), Number(m[1])));
  }

  // Intervalo por extenso: «10 a 12 de junho [de 2026]», «10-12 junho»
  const rangeRe = new RegExp(
    String.raw`\b(\d{1,2})\s*(?:a|-|ate|–|—)\s*(\d{1,2})${SEPARATOR}(${Object.keys(MONTHS).join('|')})\b(?:${SEPARATOR}(\d{4}))?`,
    'g',
  );
  for (const m of text.matchAll(rangeRe)) {
    const month = MONTHS[m[3] as string];
    if (month === undefined) continue;
    const first = Number(m[1]);
    const last = Number(m[2]);
    if (last < first) continue;
    const year = m[4] ? Number(m[4]) : inferYear(month, first, reference);
    // Só os extremos. Ver a nota em `parseEventDates`: os dias pelo meio não
    // são factos que a fonte tenha afirmado.
    push(toIso(year, month, first));
    push(toIso(year, month, last));
    if (first !== last) seenRange.value = true;
  }

  // Intervalo entre meses: «de 1 de junho a 30 de agosto», «10 jun – 12 jul»
  //
  // O padrão de cima só apanha o intervalo que cabe num mês — «10 a 12 de
  // junho» —, e não é aí que vivem as exposições: uma exposição atravessa
  // meses por definição. As duas datas já eram lidas na mesma, pelo padrão da
  // lista aqui em baixo, e ficavam certas; o que se perdia era o `isRange`, e
  // com ele a única coisa que distingue «está patente de 1 de junho a 30 de
  // agosto» de «há duas sessões, uma em junho e outra em agosto». Quem lesse a
  // ficha ficava a saber que nos três meses do meio não havia nada.
  const crossMonthRangeRe = new RegExp(
    String.raw`\b(\d{1,2})${SEPARATOR}(${Object.keys(MONTHS).join('|')})\b\.?(?:${SEPARATOR}(\d{4}))?\s*(?:a|-|ate|–|—)\s*(\d{1,2})${SEPARATOR}(${Object.keys(MONTHS).join('|')})\b\.?(?:${SEPARATOR}(\d{4}))?`,
    'g',
  );
  for (const m of text.matchAll(crossMonthRangeRe)) {
    const firstMonth = MONTHS[m[2] as string];
    const lastMonth = MONTHS[m[5] as string];
    if (firstMonth === undefined || lastMonth === undefined) continue;

    const firstDay = Number(m[1]);
    const lastDay = Number(m[4]);
    const firstYear = m[3] ? Number(m[3]) : inferYear(firstMonth, firstDay, reference);
    const first = toIso(firstYear, firstMonth, firstDay);
    if (!first) continue;

    // «10 de dezembro a 5 de janeiro» acaba no ano seguinte. Só se assume isso
    // quando o ano do fim não vinha escrito: um ano explícito é uma afirmação
    // da fonte e não se corrige, corra ao contrário ou não.
    const declaredLastYear = m[6] ? Number(m[6]) : null;
    let last = toIso(
      declaredLastYear ?? inferYear(lastMonth, lastDay, reference),
      lastMonth,
      lastDay,
    );
    if (last && last < first && declaredLastYear === null) {
      last = toIso(Number(first.slice(0, 4)) + 1, lastMonth, lastDay);
    }
    // Um fim anterior ao início é um engano de quem escreveu, não um intervalo.
    if (!last || last < first) continue;

    push(first);
    push(last);
    if (first !== last) seenRange.value = true;
  }

  // Lista ou data isolada: «10, 11 e 12 de junho», «10 de maio de 2026», «10 mai»
  const listRe = new RegExp(
    String.raw`\b((?:\d{1,2}\s*(?:,|e)\s*)*\d{1,2})${SEPARATOR}(${Object.keys(MONTHS).join('|')})\b\.?(?:${SEPARATOR}(\d{4}))?`,
    'g',
  );
  for (const m of text.matchAll(listRe)) {
    const month = MONTHS[m[2] as string];
    if (month === undefined) continue;
    const days = (m[1] as string)
      .split(/\s*(?:,|e)\s*/)
      .map(Number)
      .filter(Number.isFinite);
    for (const day of days) {
      const year = m[3] ? Number(m[3]) : inferYear(month, day, reference);
      push(toIso(year, month, day));
    }
  }

  return found.sort();
}

/**
 * Uma hora lida do texto, com o sítio onde estava.
 *
 * A posição importa: o que está *entre* duas horas é o que diz se são um
 * intervalo («10h às 12h») ou duas coisas («às 10h e às 15h»).
 */
interface TimeToken {
  /** `HH:MM`. */
  time: string;
  /** A fonte escreveu os minutos («21h30») ou só a hora («21h»). */
  withMinutes: boolean;
  /** Índices no texto dobrado. */
  start: number;
  end: number;
}

/**
 * As formas todas de escrever uma hora: «21h30», «21:30», «21.30h», «21h»,
 * «às 21 horas», «14H00» (as maiúsculas caem no `fold`).
 *
 * A alternativa com minutos vem primeiro para «19h30h» — que o Entroncamento
 * escreve — dar 19:30 e não 19:00 seguido de um «30h» perdido; e a seguir aos
 * minutos não pode vir outro algarismo, porque «10h001» não é hora nenhuma.
 * «horas» lê-se inteiro, para que «das 10 horas às 12 horas» não deixe um
 * «oras» pelo meio a estragar o intervalo. O ponto só conta como separador
 * quando vem seguido de «h»: «21.30h» é uma hora, «21.30» sozinho é um preço
 * ou uma versão, e a leitura fica-se por aí.
 */
const TIME_TOKEN =
  /\b([01]?\d|2[0-3])(?:\s*([h:.])\s*([0-5]\d)(?![0-9])|\s*(?:horas?\b|h(?![0-9])))/g;

function tokenizeTimes(text: string): TimeToken[] {
  const out: TimeToken[] = [];
  for (const m of text.matchAll(TIME_TOKEN)) {
    const whole = m[0]!;
    const start = m.index ?? 0;
    const separator = m[2];
    const minutes = m[3];
    if (separator === '.' && !/^\s*h(?![0-9])/.test(text.slice(start + whole.length))) continue;
    out.push({
      time: `${m[1]!.padStart(2, '0')}:${minutes ?? '00'}`,
      withMinutes: minutes !== undefined,
      start,
      end: start + whole.length,
    });
  }
  return out;
}

/**
 * Lê uma hora do texto: «21h30», «21:30», «21h», «às 21 horas».
 *
 * Devolve `HH:MM` ou `null`. Um número solto nunca é hora — «Sala 21» não é
 * uma sessão às nove da noite. Havendo várias, vale a primeira que trouxe
 * minutos: é a leitura de sempre, e há quem dependa dela. Quem precisa de
 * saber se há mais do que uma — e de não escolher — usa
 * `parsePortugueseTimeRange`.
 */
export function parsePortugueseTime(input: string | null | undefined): string | null {
  if (!input) return null;
  const tokens = tokenizeTimes(fold(input));
  return (tokens.find((token) => token.withMinutes) ?? tokens[0])?.time ?? null;
}

/** Uma hora de início e, quando a fonte a deu, a de fim. */
export interface TimeRange {
  start: string;
  end: string | null;
}

/** O que liga duas horas num intervalo: «10h-12h», «10h às 12h», «10h a 12h», «10h até às 12h». */
const INTERVAL_GAP = /^\s*(?:[-–—]|as|a|ate(?:\s+as)?)\s*$/;

/**
 * «e» só liga um intervalo com «entre» antes: «entre as 10h00 e as 13h00» é
 * um horário, «às 10h00 e às 15h00» são duas sessões.
 */
const ENTRE_GAP = /^\s*e(?:\s+as)?\s*$/;
const ENTRE_BEFORE = /\bentre(?:\s+as)?\s*$/;

/**
 * «das 10 às 12h», «entre as 10 e as 13 horas»: o primeiro número não tem
 * unidade porque partilha a do segundo. O «das» e o «entre as» concordam com
 * «horas» — nunca com um dia do mês —, e é isso que os torna legíveis.
 */
const SHARED_UNIT_START =
  /\b(?:das|entre as)\s+([01]?\d|2[0-3])\s+(?:as|a|ate(?:\s+as)?|e(?:\s+as)?)\s*$/;

/**
 * Um número solto preso a uma hora por um traço: «10-12h», «Sáb 12 - 21h30».
 * Tanto é uma hora sem unidade como um dia do mês, e não se adivinha. Um
 * algarismo, uma barra ou um ponto antes dele dizem que é o fim de uma data
 * («12/09/2026 - 21h30»), e uma data antes da hora é o mais normal que há.
 */
const BARE_DASH = /(?<![\d/.:-])\b\d{1,2}\s*[-–—]\s*$/;

/**
 * Lê a hora, ou o intervalo de horas, que um texto afirma — e só quando afirma
 * uma coisa só.
 *
 * Entende as formas de `parsePortugueseTime` e mais os intervalos: «das 10h às
 * 12h», «entre as 10h00 e as 13h00», «10h00 - 13h00», «10h-12h». Uma hora só
 * dá `{ start, end: null }`; um intervalo dá os dois extremos, já passados por
 * `saneEndTime` — e um fim igual ao início não é fim nenhum, é o campo
 * preenchido por preencher.
 *
 * Duas horas que não formem um intervalo — «sábados às 19h30 e domingos às
 * 10h00», «sessão às 21h30, duração 1h30» — dão `null`, e não a primeira. A
 * primeira seria um palpite: metade das vezes acertava, e a outra metade
 * mandava alguém de manhã a uma porta que só abre à noite. Uma hora em falta
 * corrige-se na moderação; uma hora errada não se nota.
 */
export function parsePortugueseTimeRange(input: string | null | undefined): TimeRange | null {
  if (!input) return null;
  const text = fold(input);
  const tokens = tokenizeTimes(text);
  if (tokens.length === 0) return null;

  const found: TimeRange[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    const gapBefore = text.slice(tokens[i - 1]?.end ?? 0, token.start);

    const shared = SHARED_UNIT_START.exec(gapBefore);
    if (shared) {
      found.push({ start: `${shared[1]!.padStart(2, '0')}:00`, end: token.time });
      continue;
    }
    if (BARE_DASH.test(gapBefore)) return null;

    const next = tokens[i + 1];
    if (next) {
      const gap = text.slice(token.end, next.start);
      if (INTERVAL_GAP.test(gap) || (ENTRE_GAP.test(gap) && ENTRE_BEFORE.test(gapBefore))) {
        found.push({ start: token.time, end: next.time });
        i += 1;
        continue;
      }
    }
    found.push({ start: token.time, end: null });
  }

  if (found.length !== 1) return null;
  const only = found[0]!;
  const end = only.end === only.start ? null : saneEndTime(only.start, only.end);
  return { start: only.start, end };
}

/** Nome do dia da semana em português, para uma data ISO. */
export function weekdayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const names = [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado',
  ];
  return names[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] as string;
}

/** Dia da semana ISO (1 = segunda) de uma data ISO. */
export function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Soma dias a uma data ISO (aritmética em UTC — sem horas de verão pelo meio). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/**
 * Os recortes de tempo que a agenda oferece num clique.
 *
 * Existem porque o público que este sítio serve primeiro é «quem quer saber o
 * que há para fazer no fim de semana», e a única forma de lá chegar era
 * escrever duas datas à mão em dois campos de calendário.
 *
 * Recebem o dia de hoje em vez de o irem buscar: é o que as torna funções puras
 * — testáveis sem relógio falso e sem servidor —, e quem chama já o tem, porque
 * a data tem de ser a de Lisboa (`todayInLisbon`) e não a da máquina.
 */
export interface JanelaDeDatas {
  from: string;
  to: string;
}

/** Sete dias contam a semana a partir de hoje, não a semana do calendário. */
export const DIAS_DA_SEMANA = 7;

/** Só hoje. Não é a agenda por omissão, que é «de hoje em diante». */
export function janelaDeHoje(hoje: string): JanelaDeDatas {
  return { from: hoje, to: hoje };
}

/**
 * De sexta a domingo — e nunca a começar no passado.
 *
 * **Sexta, e não sábado.** Metade da programação de um fim de semana é a noite
 * de sexta, e quem abre o sítio sexta às seis da tarde e carrega em «este fim
 * de semana» não pode deixar de ver o concerto dessa noite. É o pior falhanço
 * possível para o público que a agenda serve primeiro.
 *
 * **E «este» continua a ser este até ele acabar.** A janela encolhe à medida
 * que o fim de semana passa — ao domingo à tarde é só o domingo — em vez de
 * saltar para o seguinte. Mandar alguém para daí a seis dias é responder a uma
 * pergunta que ninguém fez; e a versão ingénua («o sábado e o domingo desta
 * semana») devolvia ao domingo um intervalo que começava ontem, que numa agenda
 * é pior do que não devolver nada.
 */
export function janelaDoFimDeSemana(hoje: string): JanelaDeDatas {
  const dia = isoWeekday(hoje);
  const sexta = addDays(hoje, 5 - dia);
  const domingo = addDays(hoje, 7 - dia);
  // Datas ISO comparam-se como texto, que é uma das razões para tudo aqui ser
  // string e não `Date`.
  return { from: sexta > hoje ? sexta : hoje, to: domingo };
}

/** Sete dias a partir de hoje — a mesma semana que a página de entrada mostra. */
export function janelaDaSemana(hoje: string): JanelaDeDatas {
  return { from: hoje, to: addDays(hoje, DIAS_DA_SEMANA) };
}

/** Lê um dia da semana escrito por extenso ou abreviado. */
export function parseWeekday(input: string): number | null {
  const key = fold(input).replace(/\.$/, '');
  return WEEKDAYS[key] ?? null;
}

/** Limite de segurança da expansão de recorrências. */
export const MAX_RECURRENCE_OCCURRENCES = 400;

export interface RecurrenceInput {
  frequency: 'daily' | 'weekly' | 'monthly';
  weekdays?: number[];
  interval?: number;
  until: string;
  exceptions?: string[];
}

/**
 * Expande uma regra de recorrência em datas concretas.
 *
 * A base de dados guarda ocorrências, não regras — assim uma listagem por data
 * é um índice, não um cálculo. O tecto de `MAX_RECURRENCE_OCCURRENCES` existe
 * porque uma regra mal lida («todos os dias, até 2099») dava um milhão de
 * linhas antes de alguém dar por isso.
 */
export function expandRecurrence(start: string, rule: RecurrenceInput): string[] {
  if (!isValidIsoDate(start) || !isValidIsoDate(rule.until)) return [];
  if (rule.until < start) return [];

  const interval = Math.max(1, Math.trunc(rule.interval ?? 1));
  const exceptions = new Set(rule.exceptions ?? []);
  const out: string[] = [];

  if (rule.frequency === 'daily') {
    for (let cursor = start; cursor <= rule.until; cursor = addDays(cursor, interval)) {
      if (!exceptions.has(cursor)) out.push(cursor);
      if (out.length >= MAX_RECURRENCE_OCCURRENCES) break;
    }
    return out;
  }

  if (rule.frequency === 'weekly') {
    const weekdays = rule.weekdays?.length ? [...new Set(rule.weekdays)] : [isoWeekday(start)];
    // Âncora na segunda-feira da semana de início, para que `interval` conte
    // semanas inteiras e não dias avulsos.
    const anchor = addDays(start, 1 - isoWeekday(start));
    for (let week = 0; ; week += 1) {
      const weekStart = addDays(anchor, week * interval * 7);
      if (weekStart > rule.until) break;
      for (const weekday of weekdays.sort((a, b) => a - b)) {
        const date = addDays(weekStart, weekday - 1);
        if (date < start || date > rule.until) continue;
        if (exceptions.has(date)) continue;
        out.push(date);
        if (out.length >= MAX_RECURRENCE_OCCURRENCES) return out;
      }
      if (week > MAX_RECURRENCE_OCCURRENCES) break;
    }
    return out.sort();
  }

  // Mensal: mesmo dia do mês. Um dia 31 salta os meses que não o têm, em vez
  // de escorregar para o dia 1 do mês seguinte.
  const [startYear, startMonth, startDay] = start.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  for (let step = 0; ; step += 1) {
    const monthsAhead = startMonth - 1 + step * interval;
    const year = startYear + Math.floor(monthsAhead / 12);
    const month = (monthsAhead % 12) + 1;
    const iso = toIso(year, month, startDay);
    const probe = toIso(year, month, 1);
    if (!probe || probe > rule.until) break;
    if (iso && iso >= start && iso <= rule.until && !exceptions.has(iso)) out.push(iso);
    if (out.length >= MAX_RECURRENCE_OCCURRENCES || step > MAX_RECURRENCE_OCCURRENCES) break;
  }
  return out;
}

/**
 * Hora de fim que faz sentido.
 *
 * Um espetáculo que acaba antes de começar é uma de duas coisas: uma sessão
 * que atravessa a meia-noite (21:00 → 01:00, legítimo e frequente num
 * arraial), ou um erro de leitura (21:00 → 16:00, a hora da matiné deixada na
 * linha da noite). Guarda-se a primeira e deita-se fora a segunda.
 */
export function saneEndTime(start: string | null, end: string | null): string | null {
  if (!start || !end) return end;
  if (end >= start) return end;
  return end < '06:00' ? end : null;
}

/** Dias entre duas datas ISO. Negativo se a segunda for anterior. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Acima disto, uma sequência de datas diárias deixa de ser um conjunto de
 * sessões e passa a ser uma coisa que está em cartaz.
 */
export const CONTINUOUS_RUN_DAYS = 45;

/** Tecto de sessões por evento. Uma leitura desmesurada trava aqui. */
export const MAX_SESSIONS_PER_EVENT = 80;

/**
 * Reduz aos extremos uma corrida diária longa de mais para ser sessões.
 *
 * Uma exposição que a fonte publica dia a dia chega aqui como sessenta datas
 * seguidas. Sessenta linhas dizem «há alguma coisa a acontecer todas as
 * noites»; duas linhas mais `isRange` dizem «está em cartaz de X a Y», que é
 * a verdade.
 */
export function collapseContinuousRun(dates: readonly string[]): ParsedEventDates {
  if (dates.length < 3) return { dates: [...dates], isRange: false };

  const sorted = [...new Set(dates)].sort();
  const first = sorted[0] as string;
  const last = sorted[sorted.length - 1] as string;
  const span = daysBetween(first, last);

  // Diária de ponta a ponta? Então é uma corrida, não uma programação.
  if (span + 1 === sorted.length && span >= CONTINUOUS_RUN_DAYS) {
    return { dates: [first, last], isRange: true };
  }
  if (sorted.length > MAX_SESSIONS_PER_EVENT) {
    return { dates: [first, last], isRange: true };
  }
  return { dates: sorted, isRange: false };
}

/**
 * O desvio de Lisboa em relação a UTC, para uma data e hora de parede.
 *
 * Uma hora sem fuso não é uma hora: `2026-05-10T21:30` diz nove e meia a quem
 * a lê em Lisboa e nove e meia a quem a lê em Nova Iorque, e uma dessas
 * pessoas vai ao concerto no dia errado. O calendário que esta casa publica já
 * escreve `TZID=Europe/Lisbon`; os dados estruturados escreviam a hora nua, e
 * é isso que este ajudante vem fechar.
 *
 * Lisboa anda entre `+00:00` e `+01:00`, e a data e hora entram aqui como hora
 * de parede — sem fuso, que é o que a base guarda. Para descobrir o desvio,
 * lê-se essa hora como se fosse UTC e pergunta-se ao `Intl` o que é que
 * Lisboa estava a marcar nesse instante. A aproximação só se engana dentro da
 * própria hora em que os relógios mudam, duas madrugadas por ano, e nessas
 * duas horas o que está na base é ele próprio ambíguo.
 */
export function lisbonUtcOffset(date: string, time: string): string {
  const instante = new Date(`${date}T${time.slice(0, 5)}:00Z`);
  if (Number.isNaN(instante.getTime())) return '+00:00';

  const nome = new Intl.DateTimeFormat('en-GB', {
    timeZone: LISBON_TIME_ZONE,
    timeZoneName: 'longOffset',
  })
    .formatToParts(instante)
    .find((parte) => parte.type === 'timeZoneName')?.value;

  const desvio = nome ? /GMT([+-]\d{2}:\d{2})/.exec(nome) : null;
  return desvio ? (desvio[1] as string) : '+00:00';
}

/**
 * Um instante ISO 8601, lido como o dia e a hora que Lisboa marcava.
 *
 * **O sentido que faltava.** O `lisbonUtcOffset` acima resolve o caminho de
 * saída — a hora de parede que a base guarda, escrita com o fuso para quem a
 * lê. Isto é o caminho de entrada, e não existia: cada leitor da recolha
 * tratava um instante à sua maneira.
 *
 * - O `splitIsoDateTime` do `html.ts` — que lê o JSON-LD e o The Events
 *   Calendar — cortava a cadeia com uma expressão regular e **descartava o
 *   deslocamento**. Um `2026-07-10T20:00:00Z` publicava «20:00» quando
 *   Lisboa marcava 21:00: um concerto de verão anunciado **uma hora mais
 *   cedo** do que é, e sem nada na página a dizê-lo. Em dezembro o mesmo
 *   valor está certo, o que é a pior forma de estar errado — a metade do ano
 *   em que se testa é a metade em que funciona.
 * - O `ical.ts` fazia a conversão bem, com o seu próprio par de funções, e
 *   o comentário lá dizia por extenso que era «a mesma aproximação» daqui.
 *   Duas cópias da mesma regra, e uma delas não é aqui.
 *
 * As quatro formas, e o que cada uma dá:
 *
 * | Escrito                     | Lisboa marca | Porquê                     |
 * | --------------------------- | ------------ | -------------------------- |
 * | `2026-07-10T20:00:00Z`      | 21:00        | verão, Lisboa é UTC+1      |
 * | `2026-12-10T20:00:00Z`      | 20:00        | inverno, Lisboa é UTC+0    |
 * | `2026-07-10T20:00:00+01:00` | 20:00        | já é a hora de Lisboa      |
 * | `2026-07-10T20:00:00`       | 20:00        | sem fuso é hora de parede  |
 *
 * A última é a decisão que importa e não é óbvia: uma hora sem fuso **não se
 * converte**. Numa fonte portuguesa, a hora escrita sem deslocamento é a hora
 * a que as pessoas aparecem à porta — tratá-la como UTC atrasava uma hora
 * todos os eventos de verão de quase todas as câmaras, que é o engano
 * simétrico e maior.
 *
 * Uma data sem hora nenhuma sai como data, e a hora fica nula: converter
 * `2026-07-10` obrigava a inventar-lhe a meia-noite, e a meia-noite de um dia
 * de verão é, em UTC, o dia anterior.
 */
export function lerInstanteIso(valor: string | null | undefined): {
  date: string | null;
  time: string | null;
} {
  if (!valor) return { date: null, time: null };
  const texto = valor.trim();

  const partes =
    /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?/.exec(
      texto,
    );
  if (!partes) return { date: null, time: null };

  const dia = partes[1] ?? null;
  if (!dia || !isValidIsoDate(dia)) return { date: null, time: null };
  if (partes[2] === undefined || partes[3] === undefined) return { date: dia, time: null };

  const hora = Number(partes[2]);
  const minuto = Number(partes[3]);
  if (hora > 23 || minuto > 59) return { date: dia, time: null };

  const fuso = partes[4];
  // Sem deslocamento é hora de parede, e é para ficar como está.
  if (!fuso) return { date: dia, time: `${partes[2]}:${partes[3]}` };

  const [ano, mes, diaDoMes] = dia.split('-').map(Number) as [number, number, number];
  const desvio = fuso === 'Z' ? 0 : minutosDoDeslocamento(fuso);
  if (desvio === null) return { date: dia, time: `${partes[2]}:${partes[3]}` };

  const instante = Date.UTC(ano, mes - 1, diaDoMes, hora, minuto) - desvio * 60_000;
  return emLisboa(instante);
}

/** `+01:00`, `-0300` e `Z` em minutos. `null` no que não se entende. */
function minutosDoDeslocamento(fuso: string): number | null {
  const partes = /^([+-])(\d{2}):?(\d{2})$/.exec(fuso);
  if (!partes) return null;
  return (partes[1] === '-' ? -1 : 1) * (Number(partes[2]) * 60 + Number(partes[3]));
}

const RELOGIO_DE_LISBOA = new Intl.DateTimeFormat('en-GB', {
  timeZone: LISBON_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Um instante absoluto, escrito como o dia e a hora que Lisboa marcava. */
export function emLisboa(ms: number): { date: string; time: string } {
  const partes = new Map(
    RELOGIO_DE_LISBOA.formatToParts(new Date(ms)).map((parte) => [parte.type, parte.value]),
  );
  return {
    date: `${partes.get('year')}-${partes.get('month')}-${partes.get('day')}`,
    time: `${partes.get('hour')}:${partes.get('minute')}`,
  };
}

/**
 * `2026-05-10T21:30:00+01:00` quando há hora, `2026-05-10` quando não há.
 *
 * Uma data sem hora fica data: o schema.org aceita-a, e inventar-lhe as
 * zero horas punha à meia-noite um evento que ninguém sabe a que horas é.
 */
export function isoWithLisbonOffset(date: string, time: string | null): string {
  if (!time) return date;
  const horas = time.slice(0, 5);
  // Uma hora que não é uma hora vale o mesmo que não haver hora nenhuma: sai a
  // data e mais nada. Colada sem olhar, dava um `2026-07-15Ta sé:00+00:00` —
  // uma cadeia que nenhum leitor entende e que ninguém veria a não ser no
  // resultado de uma pesquisa.
  if (!/^\d{2}:\d{2}$/.test(horas)) return date;
  return `${date}T${horas}:00${lisbonUtcOffset(date, horas)}`;
}
