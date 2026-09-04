import { describe, expect, it } from 'vitest';
import { coverDay, formatEventDates, formatRelativeDay } from './format';

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

  it('dá o dia da semana com a data, dentro da semana', () => {
    expect(formatRelativeDay('2026-09-05', hoje)).toBe('Sábado, 5 set');
  });

  it('passada a semana, a data por extenso', () => {
    expect(formatRelativeDay('2026-09-20', hoje)).toBe('domingo, 20 de setembro');
  });
});
