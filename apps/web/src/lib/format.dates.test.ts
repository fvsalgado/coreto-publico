import { describe, expect, it } from 'vitest';
import {
  coverDay,
  formatDatasDoCartao,
  formatEventDates,
  formatIntervaloPorExtenso,
  formatRelativeDay,
} from './format';

const HOJE = '2026-08-28';

describe('formatEventDates', () => {
  it('mantém o intervalo enquanto o evento não começou', () => {
    expect(formatEventDates('2026-09-10', '2026-09-12', HOJE)).toBe('10–12 set');
  });

  it('diz «até» a partir do dia em que abre', () => {
    // A exposição de Teresa Sousa: aberta a 3 de junho, fecha a 27 de setembro.
    // Em agosto, «3 jun – 27 set» põe em destaque uma data que já passou.
    expect(formatEventDates('2026-06-03', '2026-09-27', HOJE)).toBe('até 27 set');
  });

  it('conta o próprio dia da abertura como já a decorrer', () => {
    expect(formatEventDates(HOJE, '2026-09-27', HOJE)).toBe('até 27 set');
  });

  it('acrescenta o ano quando a temporada atravessa o ano', () => {
    expect(formatEventDates('2026-05-16', '2027-01-03', HOJE)).toBe('até 3 jan 2027');
  });

  it('não diz «até» a um evento de um dia só', () => {
    expect(formatEventDates(HOJE, HOJE, HOJE)).toBe('28 ago');
    expect(formatEventDates(HOJE, null, HOJE)).toBe('28 ago');
  });

  it('não diz «até» a uma temporada que já fechou', () => {
    // Não devia aparecer numa agenda do que aí vem, mas se aparecer é o
    // intervalo que se mostra — «até» a uma data passada seria um convite
    // para uma porta fechada.
    expect(formatEventDates('2026-01-10', '2026-02-10', HOJE)).toBe('10 jan – 10 fev');
  });

  it('não inventa data quando não há', () => {
    expect(formatEventDates(null, '2026-09-27', HOJE)).toBe('Data por confirmar');
  });
});

describe('coverDay', () => {
  it('mostra o dia da estreia enquanto não começou', () => {
    expect(coverDay('2026-09-10', '2026-09-12', HOJE)).toEqual({
      day: '10',
      month: 'set',
      untilEnd: false,
    });
  });

  it('mostra o último dia depois de abrir, e marca-o como prazo', () => {
    expect(coverDay('2026-06-03', '2026-09-27', HOJE)).toEqual({
      day: '27',
      month: 'set',
      untilEnd: true,
    });
  });

  it('não devolve dia nenhum sem data de início', () => {
    expect(coverDay(null, null, HOJE)).toBeNull();
  });

  it('escreve o ano quando o evento não é deste ano', () => {
    // «2 jul» a 29 de agosto de 2026 lê-se como uma data passada — e o evento
    // é de 2027. Uma agenda que mostra um concerto como se já tivesse
    // acontecido é uma agenda que perde o concerto.
    expect(formatEventDates('2027-07-02', null, '2026-08-29')).toBe('2 jul 2027');
    expect(formatEventDates('2027-03-15', '2027-04-19', '2026-08-29')).toBe('15 mar – 19 abr 2027');
  });

  it('não repete o ano numa data deste ano', () => {
    expect(formatEventDates('2026-09-03', null, '2026-08-29')).toBe('3 set');
    expect(formatEventDates('2026-09-04', '2026-09-06', '2026-08-29')).toBe('4–6 set');
  });

  it('deixa em paz o intervalo que já traz os dois anos', () => {
    expect(formatEventDates('2026-12-20', '2027-01-10', '2026-08-29')).toBe(
      '20 dez 2026 – 10 jan 2027',
    );
  });
});

/**
 * O cabeçalho de um grupo de dias na agenda.
 *
 * A data andou escondida: o cabeçalho dizia «Sábado» e o dia do mês só existia
 * dentro do atributo `datetime`, que ninguém vê. Quem chega de um motor de
 * busca a uma lista já a meio fica sem saber de que sábado se fala.
 */
describe('formatRelativeDay', () => {
  const hoje = '2026-09-01';

  it('trata hoje e amanhã pelo nome', () => {
    expect(formatRelativeDay('2026-09-01', hoje)).toBe('Hoje');
    expect(formatRelativeDay('2026-09-02', hoje)).toBe('Amanhã');
  });

  /*
   * Um formato só, a qualquer distância (C2-041): saía «Sábado, 5 set» até aos
   * seis dias e «domingo, 20 de setembro» depois, na mesma coluna.
   */
  it('dá o dia da semana com a data por extenso, com a mesma caixa a 3 e a 10 dias', () => {
    expect(formatRelativeDay('2026-09-04', hoje)).toBe('Sexta-feira, 4 de setembro');
    expect(formatRelativeDay('2026-09-11', hoje)).toBe('Sexta-feira, 11 de setembro');
    expect(formatRelativeDay('2026-09-20', hoje)).toBe('Domingo, 20 de setembro');
  });

  it('escreve o ano quando não é este', () => {
    expect(formatRelativeDay('2027-01-02', hoje)).toBe('Sábado, 2 de janeiro de 2027');
  });
});

describe('formatDatasDoCartao', () => {
  const hoje = '2026-10-01';
  const coro = { date_start: '2026-10-04', date_end: '2026-10-12' };

  it('duas sessões soltas não são um intervalo (C2-013, C1-029)', () => {
    expect(formatDatasDoCartao({ ...coro, dias: ['2026-10-04', '2026-10-12'] }, hoje)).toBe(
      '4 e 12 out',
    );
    expect(
      formatDatasDoCartao(
        { ...coro, dias: ['2026-10-04', '2026-10-12'], start_time: '16:00:00' },
        hoje,
      ),
    ).toBe('4 out · 16h · também a 12 out');
  });

  it('depois da primeira sessão, diz só as que restam', () => {
    expect(
      formatDatasDoCartao({ ...coro, dias: ['2026-10-12'], start_time: '21:00' }, '2026-10-05'),
    ).toBe('12 out · 21h');
  });

  it('dias seguidos continuam a ser um intervalo, e muitos dias contam-se', () => {
    expect(
      formatDatasDoCartao(
        {
          date_start: '2026-10-02',
          date_end: '2026-10-04',
          dias: ['2026-10-02', '2026-10-03', '2026-10-04'],
        },
        hoje,
      ),
    ).toBe('2–4 out');
    expect(
      formatDatasDoCartao(
        {
          date_start: '2026-10-03',
          date_end: '2026-10-24',
          dias: ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24'],
        },
        hoje,
      ),
    ).toBe('3 out e mais 3 datas');
    expect(
      formatDatasDoCartao(
        { date_start: '2026-09-28', date_end: '2026-10-04', dias: ['2026-10-01', '2026-10-04'] },
        hoje,
      ),
    ).toBe('1 e 4 out');
  });

  it('um período continua a dizer até quando', () => {
    expect(
      formatDatasDoCartao(
        {
          date_start: '2026-09-01',
          date_end: '2026-10-22',
          is_ongoing: true,
          dias: ['2026-10-22'],
        },
        hoje,
      ),
    ).toBe('até 22 out');
  });
});

describe('formatIntervaloPorExtenso', () => {
  it('diz o mês e o ano uma vez quando são os mesmos', () => {
    expect(formatIntervaloPorExtenso('2026-10-02', '2026-10-08')).toBe('2 a 8 de outubro de 2026');
  });

  it('dá o nome aos dois meses quando a semana muda de mês', () => {
    expect(formatIntervaloPorExtenso('2026-09-28', '2026-10-04')).toBe(
      '28 de setembro a 4 de outubro de 2026',
    );
  });

  it('e aos dois anos quando muda de ano', () => {
    expect(formatIntervaloPorExtenso('2026-12-29', '2027-01-04')).toBe(
      '29 de dezembro de 2026 a 4 de janeiro de 2027',
    );
  });

  it('um dia só é esse dia', () => {
    expect(formatIntervaloPorExtenso('2026-10-02', '2026-10-02')).toBe('2 de outubro de 2026');
  });
});
