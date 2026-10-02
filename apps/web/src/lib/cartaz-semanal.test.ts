import { describe, expect, it } from 'vitest';
import { montarCartazDaSemana, type EventoDoCartaz, type SessaoDoCartaz } from './cartaz-semanal';

/**
 * A folha da semana: o que entra, em que dia, a que horas — e o que fica de
 * fora, que numa folha afixada é tão importante como o que entra.
 */

const SEMANA = { from: '2026-10-02', to: '2026-10-08' };

function evento(parcial: Partial<EventoDoCartaz> & { id: string }): EventoDoCartaz {
  return {
    slug: parcial.id,
    title: `Evento ${parcial.id}`,
    date_start: '2026-10-03',
    date_end: null,
    is_ongoing: false,
    is_free: false,
    price_display: null,
    venue_id: null,
    location_name: null,
    ...parcial,
  };
}

function sessao(dia: string, hora: string | null, parcial: Partial<SessaoDoCartaz> = {}) {
  return { session_date: dia, start_time: hora, end_time: null, is_cancelled: false, ...parcial };
}

describe('montarCartazDaSemana', () => {
  it('um evento com sessões em dois dias da semana está nos dois dias', () => {
    // Quem passa à porta no sábado e lê «domingo» tem de o encontrar lá.
    const cartaz = montarCartazDaSemana(
      [evento({ id: 'coro', date_start: '2026-10-02', date_end: '2026-10-04' })],
      { coro: [sessao('2026-10-02', '21:00:00'), sessao('2026-10-04', '16:00:00')] },
      SEMANA,
    );
    expect(cartaz.dias.map((dia) => [dia.dia, dia.linhas[0]?.horas])).toEqual([
      ['2026-10-02', ['21:00']],
      ['2026-10-04', ['16:00']],
    ]);
    expect(cartaz.eventos).toBe(1);
    expect(cartaz.linhas).toBe(2);
  });

  it('duas sessões no mesmo dia são uma linha com as duas horas', () => {
    const cartaz = montarCartazDaSemana(
      [evento({ id: 'cinema' })],
      {
        cinema: [
          sessao('2026-10-03', '21:30:00'),
          sessao('2026-10-03', '15:00:00'),
          sessao('2026-10-03', '15:00:00'),
        ],
      },
      SEMANA,
    );
    expect(cartaz.dias).toHaveLength(1);
    expect(cartaz.dias[0]?.linhas[0]?.horas).toEqual(['15:00', '21:30']);
  });

  it('as sessões canceladas e as de fora da semana não entram — e um evento só com essas cala-se', () => {
    const cartaz = montarCartazDaSemana(
      [evento({ id: 'adiado' }), evento({ id: 'depois', date_start: '2026-10-20' })],
      {
        adiado: [sessao('2026-10-03', '21:00:00', { is_cancelled: true })],
        depois: [sessao('2026-10-20', '21:00:00')],
      },
      SEMANA,
    );
    expect(cartaz.dias).toEqual([]);
    expect(cartaz.periodos).toEqual([]);
    expect(cartaz.eventos).toBe(0);
  });

  it('00:00 sem fim é «sem hora», como no resto da casa', () => {
    const cartaz = montarCartazDaSemana(
      [evento({ id: 'sem-hora' })],
      { 'sem-hora': [sessao('2026-10-03', '00:00:00')] },
      SEMANA,
    );
    expect(cartaz.dias[0]?.linhas[0]?.horas).toEqual([]);
  });

  it('um período fica em «Durante a semana», uma vez só, e não nos sete dias', () => {
    const cartaz = montarCartazDaSemana(
      [
        evento({
          id: 'exposicao',
          date_start: '2026-09-01',
          date_end: '2026-11-30',
          is_ongoing: true,
          is_free: true,
        }),
        evento({ id: 'feira', date_start: '2026-10-07', date_end: '2026-10-11' }),
      ],
      { exposicao: [sessao('2026-10-05', '10:00:00')] },
      SEMANA,
    );
    expect(cartaz.dias).toEqual([]);
    // Pelo fim: o que fecha primeiro é o que tem pressa.
    expect(cartaz.periodos.map((periodo) => [periodo.slug, periodo.ate, periodo.preco])).toEqual([
      ['feira', '2026-10-11', null],
      ['exposicao', '2026-11-30', 'Entrada livre'],
    ]);
  });

  it('sem sessões lidas, um evento de um dia entra pela data', () => {
    const cartaz = montarCartazDaSemana(
      [evento({ id: 'baile', date_start: '2026-10-08', price_display: '5 €' })],
      {},
      SEMANA,
    );
    expect(cartaz.dias).toEqual([
      {
        dia: '2026-10-08',
        linhas: [{ slug: 'baile', titulo: 'Evento baile', horas: [], onde: null, preco: '5 €' }],
      },
    ]);
  });

  it('num dia, pela hora — o que não a tem vai no fim, e o empate pelo título', () => {
    const cartaz = montarCartazDaSemana(
      [
        evento({ id: 'c', title: 'Concerto' }),
        evento({ id: 'b', title: 'Baile' }),
        evento({ id: 'a', title: 'Arraial' }),
        evento({ id: 'z', title: 'Zarzuela' }),
      ],
      {
        c: [sessao('2026-10-03', '21:00:00')],
        b: [sessao('2026-10-03', '10:30:00')],
        a: [sessao('2026-10-03', '21:00:00')],
        z: [sessao('2026-10-03', null)],
      },
      SEMANA,
    );
    expect(cartaz.dias[0]?.linhas.map((linha) => linha.titulo)).toEqual([
      'Baile',
      'Arraial',
      'Concerto',
      'Zarzuela',
    ]);
  });

  it('o sítio é o nome do espaço quando se sabe, e o que a fonte escreveu quando não', () => {
    const cartaz = montarCartazDaSemana(
      [
        evento({ id: 'no-espaco', venue_id: 'v1', location_name: 'Rua Direita' }),
        evento({ id: 'na-rua', venue_id: 'v9', location_name: 'Largo da Feira' }),
      ],
      {},
      SEMANA,
      { v1: 'Cine-Teatro' },
    );
    const onde = Object.fromEntries(
      (cartaz.dias[0]?.linhas ?? []).map((linha) => [linha.slug, linha.onde]),
    );
    expect(onde).toEqual({ 'no-espaco': 'Cine-Teatro', 'na-rua': 'Largo da Feira' });
  });
});
