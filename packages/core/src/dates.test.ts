import { describe, expect, it } from 'vitest';
import {
  addDays,
  collapseContinuousRun,
  daysBetween,
  parseEventDates,
  saneEndTime,
  expandRecurrence,
  isValidIsoDate,
  isoWeekday,
  isoWithLisbonOffset,
  parsePortugueseDate,
  parsePortugueseDates,
  parsePortugueseTime,
  parsePortugueseTimeRange,
  parseWeekday,
  todayInLisbon,
  weekdayName,
} from './dates';

const REF = { reference: '2026-05-01' };

describe('parsePortugueseDates', () => {
  it('lê a data por extenso com ano', () => {
    expect(parsePortugueseDates('10 de maio de 2026', REF)).toEqual(['2026-05-10']);
  });

  it('lê a abreviatura do mês', () => {
    expect(parsePortugueseDates('10 MAI', REF)).toEqual(['2026-05-10']);
    expect(parsePortugueseDates('3 set.', REF)).toEqual(['2026-09-03']);
  });

  it('lê o formato numérico português (dia primeiro)', () => {
    expect(parsePortugueseDates('10/05/2026', REF)).toEqual(['2026-05-10']);
    expect(parsePortugueseDates('01.06.26', REF)).toEqual(['2026-06-01']);
  });

  it('lê o formato ISO', () => {
    expect(parsePortugueseDates('2026-05-10', REF)).toEqual(['2026-05-10']);
  });

  it('dá dois extremos a um intervalo, não um dia por cada dia', () => {
    // «10 a 12» é uma coisa contínua. Escrever três sessões seria inventar
    // duas que ninguém afirmou.
    const parsed = parseEventDates('de 10 a 12 de junho de 2026', REF);
    expect(parsed.dates).toEqual(['2026-06-10', '2026-06-12']);
    expect(parsed.isRange).toBe(true);
  });

  it('não inventa trinta sessões por causa de uma exposição de um mês', () => {
    const parsed = parseEventDates('Exposição de 1 a 30 de junho de 2026', REF);
    expect(parsed.dates).toEqual(['2026-06-01', '2026-06-30']);
    expect(parsed.isRange).toBe(true);
  });

  /**
   * O intervalo que atravessa meses — que é onde as exposições vivem.
   *
   * As duas datas sempre foram lidas, pelo padrão da lista, e ficavam certas.
   * O que se perdia era o `isRange`: «de 3 de junho a 27 de setembro» chegava
   * ao outro lado indistinguível de «há uma sessão em junho e outra em
   * setembro», e a ficha escrevia «2 sessões» sobre uma coisa que está aberta
   * quatro meses seguidos.
   */
  it('reconhece o intervalo que atravessa meses', () => {
    const parsed = parseEventDates('Exposição patente de 3 de junho a 27 de setembro de 2026', REF);
    expect(parsed.dates).toEqual(['2026-06-03', '2026-09-27']);
    expect(parsed.isRange).toBe(true);
  });

  it('lê o intervalo entre meses com travessão e com «até»', () => {
    expect(parseEventDates('10 de junho – 12 de julho de 2026', REF).isRange).toBe(true);
    expect(parseEventDates('10 de junho até 12 de julho de 2026', REF).isRange).toBe(true);
  });

  it('um intervalo que passa o fim do ano acaba no ano seguinte', () => {
    // «10 de dezembro a 5 de janeiro» são vinte e sete dias, não trezentos e
    // trinta e nove a andar para trás.
    const parsed = parseEventDates('de 10 de dezembro a 5 de janeiro', {
      reference: '2026-11-01',
    });
    expect(parsed.dates).toEqual(['2026-12-10', '2027-01-05']);
    expect(parsed.isRange).toBe(true);
  });

  it('expande uma lista, que são mesmo sessões', () => {
    const parsed = parseEventDates('10, 11 e 12 de junho de 2026', REF);
    expect(parsed.dates).toEqual(['2026-06-10', '2026-06-11', '2026-06-12']);
    expect(parsed.isRange).toBe(false);
  });

  it('não chama intervalo a uma data isolada', () => {
    expect(parseEventDates('10 de junho de 2026', REF).isRange).toBe(false);
  });

  it('infere o ano seguinte quando a data já passou há mais de um mês', () => {
    expect(parsePortugueseDates('10 de janeiro', { reference: '2026-05-01' })).toEqual([
      '2027-01-10',
    ]);
  });

  it('mantém o ano corrente para uma data acabada de passar', () => {
    expect(parsePortugueseDates('28 de abril', { reference: '2026-05-01' })).toEqual([
      '2026-04-28',
    ]);
  });

  it('ignora datas impossíveis em vez de as arredondar', () => {
    expect(parsePortugueseDates('31 de fevereiro de 2026', REF)).toEqual([]);
    expect(parsePortugueseDates('30/02/2026', REF)).toEqual([]);
  });

  it('devolve vazio quando não há data nenhuma', () => {
    expect(parsePortugueseDates('Bilhetes à venda na bilheteira', REF)).toEqual([]);
    expect(parsePortugueseDates('', REF)).toEqual([]);
    expect(parsePortugueseDates(null, REF)).toEqual([]);
  });

  it('não confunde um número solto com uma data', () => {
    expect(parsePortugueseDates('Sala 21, lotação 300', REF)).toEqual([]);
  });

  it('desdupla a mesma data escrita duas vezes', () => {
    expect(parsePortugueseDates('10 de maio de 2026 (2026-05-10)', REF)).toEqual(['2026-05-10']);
  });

  it('lê a data quando vem colada ao dia da semana e à hora', () => {
    expect(parsePortugueseDate('Sáb 10 maio 2026 | 21h30', REF)).toBe('2026-05-10');
  });

  it('lê o dia separado do mês por barra', () => {
    // É como o Centro Cultural Gil Vicente escreve toda a programação, com e
    // sem espaço à volta da barra.
    expect(parsePortugueseDates('10/outubro | 21h30', REF)).toEqual(['2026-10-10']);
    expect(parsePortugueseDates('14/novembro| 21h30', REF)).toEqual(['2026-11-14']);
    expect(parsePortugueseDates('5 / dezembro', REF)).toEqual(['2026-12-05']);
    expect(parsePortugueseDates('3/set.', REF)).toEqual(['2026-09-03']);
  });

  it('lê o ano quando também ele vem depois de uma barra', () => {
    expect(parsePortugueseDates('5/dezembro/2027', REF)).toEqual(['2027-12-05']);
  });

  it('lê um intervalo escrito com barra', () => {
    const parsed = parseEventDates('10 a 12/junho de 2026', REF);
    expect(parsed.dates).toEqual(['2026-06-10', '2026-06-12']);
    expect(parsed.isRange).toBe(true);
  });

  it('a barra não faz de um mês sem dia uma data', () => {
    // «Cinema agosto/ 2026» é o título de um programa mensal, não um dia.
    expect(parsePortugueseDates('Cinema agosto/ 2026', REF)).toEqual([]);
  });

  it('continua a ler o formato numérico sem o confundir com o do mês por extenso', () => {
    expect(parsePortugueseDates('10/05/2026', REF)).toEqual(['2026-05-10']);
  });
});

describe('parsePortugueseTime', () => {
  it('lê as formas correntes', () => {
    expect(parsePortugueseTime('21h30')).toBe('21:30');
    expect(parsePortugueseTime('21:30')).toBe('21:30');
    expect(parsePortugueseTime('21h')).toBe('21:00');
    expect(parsePortugueseTime('às 21 horas')).toBe('21:00');
    expect(parsePortugueseTime('09h05')).toBe('09:05');
  });

  it('não inventa horas a partir de números soltos', () => {
    expect(parsePortugueseTime('Sala 21')).toBe(null);
    expect(parsePortugueseTime('lotação 300')).toBe(null);
    expect(parsePortugueseTime('')).toBe(null);
  });

  it('recusa horas impossíveis', () => {
    expect(parsePortugueseTime('25h00')).toBe(null);
    expect(parsePortugueseTime('21h75')).toBe(null);
  });

  it('lê o que as câmaras escrevem à mão: «19h30h», «10h00m», «21.30h»', () => {
    expect(parsePortugueseTime('às 19h30h')).toBe('19:30');
    expect(parsePortugueseTime('às 10h00m')).toBe('10:00');
    expect(parsePortugueseTime('21.30h')).toBe('21:30');
  });
});

describe('parsePortugueseTimeRange', () => {
  it('uma hora só dá início sem fim', () => {
    expect(parsePortugueseTimeRange('Sáb 10 maio | 21h30')).toEqual({ start: '21:30', end: null });
    expect(parsePortugueseTimeRange('21:30')).toEqual({ start: '21:30', end: null });
    expect(parsePortugueseTimeRange('21h')).toEqual({ start: '21:00', end: null });
    expect(parsePortugueseTimeRange('às 21 horas')).toEqual({ start: '21:00', end: null });
    expect(parsePortugueseTimeRange('a partir das 19h00')).toEqual({ start: '19:00', end: null });
    expect(parsePortugueseTimeRange('pelas 18 horas')).toEqual({ start: '18:00', end: null });
  });

  it('lê o ponto como separador, mas só com o «h» a seguir', () => {
    expect(parsePortugueseTimeRange('21.30h')).toEqual({ start: '21:30', end: null });
    expect(parsePortugueseTimeRange('versão 21.30')).toBe(null);
  });

  it('as maiúsculas caem no fold', () => {
    expect(parsePortugueseTimeRange('das 14H00 às 18H00')).toEqual({
      start: '14:00',
      end: '18:00',
    });
  });

  it('lê os intervalos nas formas em que as agendas os escrevem', () => {
    expect(parsePortugueseTimeRange('das 10h às 12h')).toEqual({ start: '10:00', end: '12:00' });
    expect(parsePortugueseTimeRange('entre as 10h00 e as 13h00')).toEqual({
      start: '10:00',
      end: '13:00',
    });
    expect(parsePortugueseTimeRange('10h00 - 13h00')).toEqual({ start: '10:00', end: '13:00' });
    expect(parsePortugueseTimeRange('10h-12h')).toEqual({ start: '10:00', end: '12:00' });
    expect(parsePortugueseTimeRange('10h30 – 12h30')).toEqual({ start: '10:30', end: '12:30' });
    expect(parsePortugueseTimeRange('das 10h até às 12h')).toEqual({
      start: '10:00',
      end: '12:00',
    });
    expect(parsePortugueseTimeRange('das 10 horas às 12 horas')).toEqual({
      start: '10:00',
      end: '12:00',
    });
  });

  it('em «das 10 às 12h» o primeiro número partilha a unidade do segundo', () => {
    expect(parsePortugueseTimeRange('das 10 às 12h')).toEqual({ start: '10:00', end: '12:00' });
    expect(parsePortugueseTimeRange('entre as 10 e as 13 horas')).toEqual({
      start: '10:00',
      end: '13:00',
    });
  });

  it('duas horas que não são um intervalo não dão palpite nenhum', () => {
    // As aulas de yoga do Entroncamento, tal e qual: nenhuma das duas é «a
    // hora» do evento, e escolher uma era adivinhar.
    expect(
      parsePortugueseTimeRange(
        'todos os sábados – Jardim Zona Verde às 19h30h e domingos às 10h00m',
      ),
    ).toBe(null);
    expect(parsePortugueseTimeRange('às 10h00 e às 15h00')).toBe(null);
    expect(parsePortugueseTimeRange('sessão às 21h30. Duração: 1h30')).toBe(null);
    expect(parsePortugueseTimeRange('das 10h às 12h e das 14h às 18h')).toBe(null);
  });

  it('um número solto preso à hora por um traço tanto é hora como dia — não se lê', () => {
    expect(parsePortugueseTimeRange('10-12h')).toBe(null);
    expect(parsePortugueseTimeRange('Sáb 12 - 21h30')).toBe(null);
    // Uma data antes da hora é o mais normal que há, e não é um número solto.
    expect(parsePortugueseTimeRange('12/09/2026 - 21h30')).toEqual({ start: '21:30', end: null });
  });

  it('não inventa horas a partir de números soltos', () => {
    expect(parsePortugueseTimeRange('Sala 21')).toBe(null);
    expect(parsePortugueseTimeRange('lotação 300')).toBe(null);
    expect(parsePortugueseTimeRange('de 11 a 13 de setembro de 2026')).toBe(null);
    expect(parsePortugueseTimeRange('')).toBe(null);
    expect(parsePortugueseTimeRange(null)).toBe(null);
  });

  it('recusa horas impossíveis', () => {
    expect(parsePortugueseTimeRange('25h00')).toBe(null);
    expect(parsePortugueseTimeRange('21h75')).toBe(null);
  });

  it('um fim antes do início só passa se atravessar a meia-noite', () => {
    expect(parsePortugueseTimeRange('das 22h às 02h')).toEqual({ start: '22:00', end: '02:00' });
    expect(parsePortugueseTimeRange('das 14h às 10h')).toEqual({ start: '14:00', end: null });
    // Um fim igual ao início é o campo preenchido por preencher.
    expect(parsePortugueseTimeRange('16:30 - 16:30')).toEqual({ start: '16:30', end: null });
  });
});

describe('expandRecurrence', () => {
  it('expande uma regra semanal', () => {
    expect(
      expandRecurrence('2026-05-04', { frequency: 'weekly', weekdays: [1], until: '2026-05-25' }),
    ).toEqual(['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25']);
  });

  it('expande vários dias da semana', () => {
    expect(
      expandRecurrence('2026-05-04', {
        frequency: 'weekly',
        weekdays: [1, 5],
        until: '2026-05-15',
      }),
    ).toEqual(['2026-05-04', '2026-05-08', '2026-05-11', '2026-05-15']);
  });

  it('respeita o intervalo de duas em duas semanas', () => {
    expect(
      expandRecurrence('2026-05-04', {
        frequency: 'weekly',
        weekdays: [1],
        interval: 2,
        until: '2026-06-15',
      }),
    ).toEqual(['2026-05-04', '2026-05-18', '2026-06-01', '2026-06-15']);
  });

  it('expande uma regra diária', () => {
    expect(expandRecurrence('2026-05-01', { frequency: 'daily', until: '2026-05-04' })).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
    ]);
  });

  it('salta os meses sem o dia pedido, em vez de escorregar', () => {
    expect(expandRecurrence('2026-01-31', { frequency: 'monthly', until: '2026-04-30' })).toEqual([
      '2026-01-31',
      '2026-03-31',
    ]);
  });

  it('retira as exceções', () => {
    expect(
      expandRecurrence('2026-05-04', {
        frequency: 'weekly',
        weekdays: [1],
        until: '2026-05-18',
        exceptions: ['2026-05-11'],
      }),
    ).toEqual(['2026-05-04', '2026-05-18']);
  });

  it('devolve vazio quando o fim é anterior ao início', () => {
    expect(expandRecurrence('2026-05-10', { frequency: 'daily', until: '2026-05-01' })).toEqual([]);
  });

  it('trava uma regra desmesurada no tecto de segurança', () => {
    const out = expandRecurrence('2026-01-01', { frequency: 'daily', until: '2099-01-01' });
    expect(out).toHaveLength(400);
  });
});

describe('auxiliares de calendário', () => {
  it('valida datas ISO', () => {
    expect(isValidIsoDate('2026-05-10')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('10-05-2026')).toBe(false);
  });

  it('soma dias sobre a fronteira do mês', () => {
    expect(addDays('2026-05-31', 1)).toBe('2026-06-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('conta a semana a começar na segunda', () => {
    expect(isoWeekday('2026-05-04')).toBe(1);
    expect(isoWeekday('2026-05-10')).toBe(7);
  });

  it('nomeia o dia da semana em português', () => {
    expect(weekdayName('2026-05-10')).toBe('domingo');
    expect(weekdayName('2026-05-09')).toBe('sábado');
  });

  it('lê dias da semana escritos como as agendas os escrevem', () => {
    expect(parseWeekday('Sáb')).toBe(6);
    expect(parseWeekday('quarta-feira')).toBe(3);
    expect(parseWeekday('nada')).toBe(null);
  });

  it('devolve hoje em Lisboa, não em UTC', () => {
    // 31 de maio às 23h30 UTC já é 1 de junho em Lisboa (UTC+1 no verão).
    expect(todayInLisbon(new Date('2026-05-31T23:30:00Z'))).toBe('2026-06-01');
  });
});

describe('saneEndTime', () => {
  it('aceita uma sessão que atravessa a meia-noite', () => {
    expect(saneEndTime('21:00', '01:00')).toBe('01:00');
    expect(saneEndTime('23:30', '02:15')).toBe('02:15');
  });

  it('deita fora uma hora de fim que é claramente erro de leitura', () => {
    expect(saneEndTime('21:00', '16:00')).toBe(null);
  });

  it('deixa passar o caso normal e a ausência', () => {
    expect(saneEndTime('21:00', '23:00')).toBe('23:00');
    expect(saneEndTime('21:00', null)).toBe(null);
    expect(saneEndTime(null, '23:00')).toBe('23:00');
  });
});

describe('collapseContinuousRun', () => {
  function daily(start: string, count: number): string[] {
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }

  it('reduz aos extremos uma corrida diária longa', () => {
    const parsed = collapseContinuousRun(daily('2026-06-01', 60));
    expect(parsed.dates).toEqual(['2026-06-01', '2026-07-30']);
    expect(parsed.isRange).toBe(true);
  });

  it('deixa em paz uma programação curta', () => {
    const parsed = collapseContinuousRun(['2026-06-01', '2026-06-08', '2026-06-15']);
    expect(parsed.dates).toHaveLength(3);
    expect(parsed.isRange).toBe(false);
  });

  it('deixa em paz sessões espalhadas por meses, que não são uma corrida', () => {
    const parsed = collapseContinuousRun(['2026-01-10', '2026-04-10', '2026-09-10']);
    expect(parsed.isRange).toBe(false);
  });

  it('trava no tecto de sessões', () => {
    const spread = Array.from({ length: 100 }, (_, i) => addDays('2026-01-01', i * 3));
    expect(collapseContinuousRun(spread).dates).toHaveLength(2);
  });

  it('ordena e desdupla', () => {
    expect(collapseContinuousRun(['2026-06-08', '2026-06-01', '2026-06-08']).dates).toEqual([
      '2026-06-01',
      '2026-06-08',
    ]);
  });
});

describe('daysBetween', () => {
  it('conta os dias nos dois sentidos', () => {
    expect(daysBetween('2026-06-01', '2026-06-11')).toBe(10);
    expect(daysBetween('2026-06-11', '2026-06-01')).toBe(-10);
  });
});

describe('isoWithLisbonOffset', () => {
  it('deixa a data sozinha quando não há hora', () => {
    expect(isoWithLisbonOffset('2026-05-10', null)).toBe('2026-05-10');
  });

  it('marca +01:00 no verão e +00:00 no inverno', () => {
    // Lisboa anda uma hora à frente de UTC entre o último domingo de março e
    // o último de outubro. Duas datas bem dentro de cada metade do ano.
    expect(isoWithLisbonOffset('2026-07-15', '21:30')).toBe('2026-07-15T21:30:00+01:00');
    expect(isoWithLisbonOffset('2026-01-15', '21:30')).toBe('2026-01-15T21:30:00+00:00');
  });

  it('corta os segundos que a base às vezes traz', () => {
    expect(isoWithLisbonOffset('2026-07-15', '21:30:00')).toBe('2026-07-15T21:30:00+01:00');
  });

  it('deita fora uma hora que não é uma hora, e fica pela data', () => {
    expect(isoWithLisbonOffset('2026-07-15', 'a sério?')).toBe('2026-07-15');
    expect(isoWithLisbonOffset('2026-07-15', '')).toBe('2026-07-15');
  });
});
