/**
 * iCalendar (RFC 5545) escrito à mão.
 *
 * Não há dependência aqui de propósito: o formato tem quatro regras que
 * costumam correr mal e todas cabem num ficheiro. Vale a pena enumerá-las,
 * porque cada uma já partiu o calendário de alguém em silêncio:
 *
 * 1. As linhas dobram-se aos 75 OCTETOS, não aos 75 carateres. «Exposição» são
 *    dez carateres e onze octetos; contar carateres dá ficheiros que passam no
 *    portátil de quem os escreveu e chegam cortados a meio a quem os subscreve.
 * 2. Em valores de texto escapa-se `\`, `;`, `,` e as quebras de linha — e a
 *    barra invertida primeiro, senão escapa-se o próprio escape. Um título com
 *    vírgula é o caso mais banal do mundo e é exatamente o que rebenta.
 * 3. Os terminadores são CRLF, sempre, incluindo o da última linha.
 * 4. Um `TZID` tem de vir acompanhado do `VTIMEZONE` correspondente no mesmo
 *    objeto. Sem ele há clientes que assumem UTC e mostram os concertos uma
 *    hora ao lado durante metade do ano.
 */

import { LISBON_TIME_ZONE, addDays } from '@coreto/core';

/** Limite de octetos por linha física (RFC 5545, 3.1). */
const MAX_LINE_OCTETS = 75;

/*
 * O PRODID identifica o *software* que escreveu o calendário, não a região —
 * e por isso é um só, para todas. Mudou de «Agenda Cultural do Medio Tejo»
 * para a forma genérica quando o Coreto passou a multi-região: o PRODID pode
 * mudar sem partir nada. Os UID é que não podem — são a identidade permanente
 * de cada compromisso nos calendários já subscritos, e o domínio deles
 * (`regions.ical_uid_domain`) nunca muda.
 */
export const ICAL_PRODUCT_ID = '-//Coreto//Agenda Cultural//PT';

/**
 * Duração assumida para uma sessão com hora de início e sem hora de fim.
 *
 * Sem `DTEND` nem `DURATION` o evento ocupa um instante, e a maioria dos
 * calendários desenha-o como um risco de zero minutos que ninguém vê. Duas
 * horas é a duração mediana de um espetáculo e erra para o lado seguro.
 */
const DEFAULT_DURATION = 'PT2H';

/**
 * Europe/Lisbon segundo a diretiva europeia: transições no último domingo de
 * março e de outubro. Está escrito à mão e não gerado a partir do sistema
 * porque uma regra fixa é reproduzível — e porque os clientes de calendário
 * usam a sua própria base de fusos quando reconhecem o `TZID`; isto é a rede
 * de segurança para os que não a têm.
 */
const VTIMEZONE_LINES: readonly string[] = [
  'BEGIN:VTIMEZONE',
  `TZID:${LISBON_TIME_ZONE}`,
  'X-LIC-LOCATION:Europe/Lisbon',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0000',
  'TZOFFSETTO:+0100',
  'TZNAME:WEST',
  'DTSTART:19700329T010000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0000',
  'TZNAME:WET',
  'DTSTART:19701025T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/** Uma ocorrência concreta. Uma destas dá um `VEVENT`. */
export interface CalendarEntry {
  /** Estável entre gerações: é por ele que o cliente reconhece a atualização. */
  uid: string;
  /** Data ISO `AAAA-MM-DD`. */
  date: string;
  /** Último dia, para o que está em cartaz. Inclusivo. */
  endDate?: string | null;
  /** `HH:MM`. Sem ela, o evento sai como dia inteiro. */
  startTime?: string | null;
  endTime?: string | null;
  summary: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  categories?: readonly string[];
  cancelled?: boolean;
  /** Instante ISO da última alteração. */
  lastModified?: string | null;
}

export interface CalendarOptions {
  name: string;
  description?: string;
  url?: string;
  /** Injetável para os testes terem um `DTSTAMP` previsível. */
  stamp?: Date;
}

/** Octetos que um ponto de código ocupa em UTF-8. */
function utf8Size(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/**
 * Dobra uma linha de conteúdo aos 75 octetos.
 *
 * O `for...of` percorre pontos de código, não unidades UTF-16: um emoji ou um
 * carater fora do plano básico nunca é partido ao meio. A continuação começa
 * com um espaço, e esse espaço conta para o limite da linha seguinte.
 */
export function foldLine(line: string): string {
  const pieces: string[] = [];
  let current = '';
  let octets = 0;

  for (const char of line) {
    const size = utf8Size(char.codePointAt(0) ?? 0);
    if (octets + size > MAX_LINE_OCTETS) {
      pieces.push(current);
      current = '';
      octets = 1;
    }
    current += char;
    octets += size;
  }

  pieces.push(current);
  return pieces.join('\r\n ');
}

/** Desfaz a dobragem. Existe para os testes lerem o que escreveram. */
export function unfoldLines(calendar: string): string[] {
  return calendar
    .replace(/\r\n[ \t]/g, '')
    .split('\r\n')
    .filter((line) => line.length > 0);
}

/** Carateres de controlo que não são representáveis num valor iCalendar. */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Escapa um valor TEXT. A ordem importa: a barra invertida primeiro. */
export function escapeText(value: string): string {
  return value
    .replace(CONTROL_CHARACTERS, '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * Um valor URI não é TEXT: não leva escapes, leva a garantia de que não tem
 * nada que quebre a linha. Escapar a vírgula de um endereço partiria o link.
 */
function sanitizeUri(value: string): string {
  return value.replace(CONTROL_CHARACTERS, '').replace(/\s/g, '');
}

function compactDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${year}${month}${day}`;
}

function compactTime(time: string): string | null {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) return null;
  const [, hours, minutes] = match;
  return `${hours}${minutes}00`;
}

/** `AAAAMMDDTHHMMSSZ`, sempre em UTC. */
export function formatUtcStamp(date: Date): string {
  const value = Number.isNaN(date.getTime()) ? new Date(0) : date;
  return `${value.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

function entryLines(entry: CalendarEntry, stamp: string): string[] {
  const date = compactDate(entry.date);
  if (!date) return [];

  const lines: string[] = ['BEGIN:VEVENT', `UID:${escapeText(entry.uid)}`, `DTSTAMP:${stamp}`];

  const startTime = entry.startTime ?? null;
  const start = startTime ? compactTime(startTime) : null;

  if (startTime && start) {
    lines.push(`DTSTART;TZID=${LISBON_TIME_ZONE}:${date}T${start}`);

    const endTime = entry.endTime ?? null;
    const end = endTime ? compactTime(endTime) : null;
    if (endTime && end) {
      // Um arraial que acaba às 02:00 acaba no dia seguinte. Sem isto, o
      // evento sai com fim anterior ao início e o cliente descarta-o.
      const lastDay = endTime <= startTime ? addDays(entry.date, 1) : entry.date;
      lines.push(`DTEND;TZID=${LISBON_TIME_ZONE}:${compactDate(lastDay)}T${end}`);
    } else {
      lines.push(`DURATION:${DEFAULT_DURATION}`);
    }
  } else {
    lines.push(`DTSTART;VALUE=DATE:${date}`);
    // `DTEND` de um evento de dia inteiro é exclusivo: uma exposição que fecha
    // a 12 termina a 13, senão o último dia desaparece da grelha.
    const lastDay = entry.endDate && entry.endDate > entry.date ? entry.endDate : entry.date;
    lines.push(`DTEND;VALUE=DATE:${compactDate(addDays(lastDay, 1))}`);
  }

  lines.push(`SUMMARY:${escapeText(entry.summary)}`);
  if (entry.description) lines.push(`DESCRIPTION:${escapeText(entry.description)}`);
  if (entry.location) lines.push(`LOCATION:${escapeText(entry.location)}`);
  if (entry.url) lines.push(`URL:${sanitizeUri(entry.url)}`);

  const categories = entry.categories?.filter((item) => item.length > 0) ?? [];
  if (categories.length > 0) {
    lines.push(`CATEGORIES:${categories.map(escapeText).join(',')}`);
  }

  // Uma sessão cancelada continua no feed: quem subscreveu quer saber que já
  // não há concerto, e é essa a diferença entre uma subscrição e uma lista.
  lines.push(`STATUS:${entry.cancelled ? 'CANCELLED' : 'CONFIRMED'}`);
  lines.push('TRANSP:TRANSPARENT');

  if (entry.lastModified) {
    const parsed = Date.parse(entry.lastModified);
    if (!Number.isNaN(parsed)) lines.push(`LAST-MODIFIED:${formatUtcStamp(new Date(parsed))}`);
  }

  lines.push('END:VEVENT');
  return lines;
}

export function buildCalendar(entries: readonly CalendarEntry[], options: CalendarOptions): string {
  const stamp = formatUtcStamp(options.stamp ?? new Date());

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${ICAL_PRODUCT_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.name)}`,
    `X-WR-TIMEZONE:${LISBON_TIME_ZONE}`,
  ];

  if (options.description) lines.push(`X-WR-CALDESC:${escapeText(options.description)}`);
  if (options.url) lines.push(`URL:${sanitizeUri(options.url)}`);

  lines.push(...VTIMEZONE_LINES);
  for (const entry of entries) lines.push(...entryLines(entry, stamp));
  lines.push('END:VCALENDAR');

  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
