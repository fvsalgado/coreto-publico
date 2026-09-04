import { describe, expect, it } from 'vitest';
import { buildCalendar, escapeText, foldLine, unfoldLines, type CalendarEntry } from './ical';

/**
 * Um `.ics` mal formado não dá erro: dá um calendário vazio, ou um evento a
 * menos, na aplicação de quem subscreveu — e ninguém nos vem dizer. Daí estes
 * testes serem sobre os octetos e não sobre a aparência.
 */

const STAMP = new Date('2026-04-01T09:00:00Z');

const encoder = new TextEncoder();

function octets(value: string): number {
  return encoder.encode(value).length;
}

function base(overrides: Partial<CalendarEntry> = {}): CalendarEntry {
  return {
    uid: 'evento-1@coreto.pt',
    date: '2026-05-10',
    startTime: '21:30',
    summary: 'Concerto',
    ...overrides,
  };
}

function propertyOf(calendar: string, name: string): string | undefined {
  const line = unfoldLines(calendar).find((item) => item.startsWith(`${name}:`));
  return line?.slice(name.length + 1);
}

describe('escapeText', () => {
  it('escapa a vírgula e o ponto e vírgula de um título', () => {
    expect(escapeText('Fado, vinho; e conversa')).toBe('Fado\\, vinho\\; e conversa');
  });

  it('escapa a barra invertida antes de tudo o resto', () => {
    expect(escapeText('A\\B,C')).toBe('A\\\\B\\,C');
  });

  it('converte quebras de linha na sequência do formato', () => {
    expect(escapeText('Primeira linha.\nSegunda linha.')).toBe('Primeira linha.\\nSegunda linha.');
    expect(escapeText('CRLF\r\nnuma só')).toBe('CRLF\\nnuma só');
  });
});

describe('foldLine', () => {
  it('deixa em paz uma linha de 75 octetos', () => {
    const line = 'X'.repeat(75);
    expect(foldLine(line)).toBe(line);
  });

  it('dobra ao passar dos 75 octetos', () => {
    const line = 'X'.repeat(76);
    expect(foldLine(line)).toBe(`${'X'.repeat(75)}\r\n X`);
  });

  it('conta octetos e não carateres: um acento ocupa dois', () => {
    // 74 carateres ASCII + «é» dão 76 octetos. Contando carateres, isto caberia
    // numa linha — e o ficheiro sairia com uma linha longa de mais.
    const line = `${'X'.repeat(74)}é`;
    const folded = foldLine(line);
    expect(folded).toBe(`${'X'.repeat(74)}\r\n é`);
  });

  it('nunca parte um carater ao meio', () => {
    const line = `SUMMARY:${'ção '.repeat(40)}`;
    for (const physical of foldLine(line).split('\r\n')) {
      expect(octets(physical)).toBeLessThanOrEqual(75);
    }
    expect(foldLine(line).replace(/\r\n /g, '')).toBe(line);
  });
});

describe('buildCalendar', () => {
  it('escreve o invólucro, o fuso e os terminadores CRLF', () => {
    const calendar = buildCalendar([base()], { name: 'Coreto', stamp: STAMP });

    expect(calendar.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(calendar.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(calendar.replace(/\r\n/g, '')).not.toMatch(/\n/);

    const lines = unfoldLines(calendar);
    expect(lines).toContain('VERSION:2.0');
    // O PRODID é do produto e não nomeia região nenhuma — os UID é que são
    // o namespace regional permanente, e esses estão presos noutro teste.
    expect(lines).toContain('PRODID:-//Coreto//Agenda Cultural//PT');
    expect(lines).toContain('TZID:Europe/Lisbon');
    expect(lines).toContain('BEGIN:VTIMEZONE');
    expect(lines).toContain('DTSTAMP:20260401T090000Z');
    expect(lines).toContain('UID:evento-1@coreto.pt');
  });

  it('marca a hora com o fuso de Lisboa', () => {
    const calendar = buildCalendar([base()], { name: 'Coreto', stamp: STAMP });
    expect(unfoldLines(calendar)).toContain('DTSTART;TZID=Europe/Lisbon:20260510T213000');
    expect(unfoldLines(calendar)).toContain('DURATION:PT2H');
  });

  it('leva para o dia seguinte um fim que atravessa a meia-noite', () => {
    const calendar = buildCalendar([base({ startTime: '22:00', endTime: '02:00' })], {
      name: 'Coreto',
      stamp: STAMP,
    });
    const lines = unfoldLines(calendar);
    expect(lines).toContain('DTSTART;TZID=Europe/Lisbon:20260510T220000');
    expect(lines).toContain('DTEND;TZID=Europe/Lisbon:20260511T020000');
  });

  it('escreve um evento sem hora como dia inteiro, com fim exclusivo', () => {
    const calendar = buildCalendar(
      [base({ startTime: null, endDate: '2026-05-12', summary: 'Exposição' })],
      { name: 'Coreto', stamp: STAMP },
    );
    const lines = unfoldLines(calendar);

    expect(lines).toContain('DTSTART;VALUE=DATE:20260510');
    // Fecha a 12; em iCalendar isso escreve-se 13, senão o último dia some-se.
    expect(lines).toContain('DTEND;VALUE=DATE:20260513');
    expect(lines.some((line) => line.startsWith('DTSTART;TZID='))).toBe(false);
  });

  it('escapa o título e a descrição dentro do ficheiro', () => {
    const calendar = buildCalendar(
      [
        base({
          summary: 'Fado, vinho; e conversa',
          description: 'Bilhetes à porta.\nSem marcação.',
          categories: ['Música', 'Festas e romarias'],
        }),
      ],
      { name: 'Coreto', stamp: STAMP },
    );

    expect(propertyOf(calendar, 'SUMMARY')).toBe('Fado\\, vinho\\; e conversa');
    expect(propertyOf(calendar, 'DESCRIPTION')).toBe('Bilhetes à porta.\\nSem marcação.');
    expect(propertyOf(calendar, 'CATEGORIES')).toBe('Música,Festas e romarias');
  });

  it('dobra um título longo com acentos sem estourar os 75 octetos', () => {
    const summary =
      'Apresentação do livro «As Coletividades e a Música Filarmónica do Médio Tejo», em Ferreira do Zêzere';
    const calendar = buildCalendar([base({ summary })], { name: 'Coreto', stamp: STAMP });

    for (const physical of calendar.split('\r\n')) {
      expect(octets(physical)).toBeLessThanOrEqual(75);
    }
    expect(propertyOf(calendar, 'SUMMARY')).toBe(escapeText(summary));
  });

  it('mantém no ficheiro a sessão cancelada, marcada como tal', () => {
    const calendar = buildCalendar([base({ cancelled: true })], {
      name: 'Coreto',
      stamp: STAMP,
    });
    expect(unfoldLines(calendar)).toContain('STATUS:CANCELLED');
  });

  it('não escapa a vírgula de um endereço', () => {
    const calendar = buildCalendar([base({ url: 'https://coreto.pt/evento/fado,vinho' })], {
      name: 'Coreto',
      stamp: STAMP,
    });
    expect(propertyOf(calendar, 'URL')).toBe('https://coreto.pt/evento/fado,vinho');
  });

  it('mantém um VEVENT por sessão', () => {
    const calendar = buildCalendar(
      [
        base({ uid: 'a@coreto.pt', date: '2026-05-10' }),
        base({ uid: 'b@coreto.pt', date: '2026-05-11' }),
      ],
      { name: 'Coreto', stamp: STAMP },
    );
    expect(unfoldLines(calendar).filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(2);
  });
});
