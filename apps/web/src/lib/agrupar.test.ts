import { describe, expect, it } from 'vitest';
import { ONGOING, UNDATED, dosPrimeirosDias, groupByDay } from './agrupar';

const HOJE = '2026-08-28';

const evento = (date_start: string | null, date_end: string | null = null) => ({
  date_start,
  date_end,
});

describe('groupByDay', () => {
  it('põe cada dia no seu grupo, por ordem crescente', () => {
    const grupos = groupByDay(
      [evento('2026-08-28'), evento('2026-08-29'), evento('2026-08-29')],
      HOJE,
    );
    expect(grupos.map((g) => g.key)).toEqual(['2026-08-28', '2026-08-29']);
    expect(grupos[1]?.events).toHaveLength(2);
  });

  it('separa o que já abriu em vez de o fazer passar por estreia de hoje', () => {
    // O caso que se via na agenda: três exposições abertas há meses por cima
    // do que acontecia mesmo naquele dia.
    const grupos = groupByDay(
      [
        evento('2026-05-16', '2027-01-03'),
        evento('2026-06-03', '2026-09-27'),
        evento('2026-08-28'),
      ],
      HOJE,
    );
    // O dia primeiro, e o que está em cartaz logo a seguir (C1-001).
    expect(grupos.map((g) => g.key)).toEqual(['2026-08-28', ONGOING]);
    expect(grupos[0]?.events).toHaveLength(1);
    expect(grupos[1]?.events).toHaveLength(2);
  });

  it('dentro do «A decorrer» põe à frente o que fecha primeiro', () => {
    const grupos = groupByDay(
      [evento('2026-05-16', '2027-01-03'), evento('2026-06-03', '2026-09-27')],
      HOJE,
    );
    expect(grupos[0]?.key).toBe(ONGOING);
    expect(grupos[0]?.events.map((e) => e.date_end)).toEqual(['2026-09-27', '2027-01-03']);
  });

  it('não trata como já aberto o que estreia hoje', () => {
    const grupos = groupByDay([evento(HOJE, '2026-09-27')], HOJE);
    expect(grupos[0]?.key).toBe(HOJE);
  });

  it('ordena por último o que decorre sem data de fim conhecida', () => {
    const grupos = groupByDay(
      [evento('2026-05-16', null), evento('2026-06-03', '2026-09-27')],
      HOJE,
    );
    expect(grupos[0]?.key).toBe(ONGOING);
    expect(grupos[0]?.events.map((e) => e.date_end)).toEqual(['2026-09-27', null]);
  });

  it('guarda os eventos sem data no seu próprio grupo, e no fim', () => {
    const grupos = groupByDay([evento(null), evento('2026-08-29')], HOJE);
    expect(grupos.map((g) => g.key)).toEqual(['2026-08-29', UNDATED]);
  });

  it('ordena os dias mesmo quando a lista vem ordenada pelo fim', () => {
    /*
     * O caso que se via em produção. A consulta ordena por `agenda_date`, que
     * a 0053 define como `coalesce(date_end, date_start)`: um evento de
     * vários dias chega pelo dia em que acaba e agrupa-se pelo dia em que
     * começa. A lista abaixo vem como a consulta a serve, e a quinta 10 de
     * setembro chega depois do dia 11 porque só fecha a 15.
     */
    const hoje = '2026-09-07';
    const grupos = groupByDay(
      [
        evento('2026-09-07'),
        evento('2026-05-16', '2026-09-08'),
        evento('2026-09-09'),
        evento('2026-09-11'),
        evento('2026-09-10', '2026-09-15'),
        evento(null),
      ],
      hoje,
    );
    expect(grupos.map((g) => g.key)).toEqual([
      '2026-09-07',
      ONGOING,
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      UNDATED,
    ]);
  });

  /*
   * O domingo que se lia 21h, 11h, 16h (C2-001): dentro do dia, pela hora; sem
   * hora no fim, e os de vários dias depois dos de um só.
   */
  it('dentro de cada dia ordena pela hora, e o que não a tem vai para o fim', () => {
    const dia = '2026-10-04';
    const com = (titulo: string, hora: string | null, fim: string = dia) => ({
      titulo,
      date_start: dia,
      date_end: fim,
      start_time: hora,
    });
    const grupos = groupByDay(
      [
        com('noite', '21:00:00'),
        com('sem hora, vários dias', null, '2026-10-06'),
        com('manhã', '11:00:00'),
        com('sem hora, um dia', null),
        com('tarde', '16:00:00'),
      ],
      '2026-10-01',
    );
    expect(grupos[0]?.events.map((e) => e.titulo)).toEqual([
      'manhã',
      'tarde',
      'noite',
      'sem hora, um dia',
      'sem hora, vários dias',
    ]);
  });

  /*
   * O coro com sessões a 4 e a 12: no dia 5 passava a «a decorrer», como uma
   * exposição aberta. Entra pelo dia da próxima sessão.
   */
  it('uma lista de sessões entra pelo dia da próxima, e não fica «a decorrer»', () => {
    const coro = { date_start: '2026-10-04', date_end: '2026-10-12', dias: ['2026-10-12'] };
    expect(groupByDay([coro], '2026-10-05').map((g) => g.key)).toEqual(['2026-10-12']);
  });

  it('um período que já abriu fica em cartaz, venham ou não as sessões', () => {
    const exposicao = {
      date_start: '2026-09-01',
      date_end: '2026-12-01',
      is_ongoing: true,
      dias: ['2026-12-01'],
    };
    expect(groupByDay([exposicao], '2026-10-05').map((g) => g.key)).toEqual([ONGOING]);
  });

  /*
   * Num recorte de sexta a domingo visto à quinta, a feira que abriu na quinta
   * aparecia num grupo «Hoje» — e hoje nem estava no recorte (C2-046).
   */
  it('o que abriu antes da janela fica em cartaz, e nunca no grupo de hoje', () => {
    const quinta = '2026-10-01';
    const sexta = '2026-10-02';
    const grupos = groupByDay(
      [
        { date_start: quinta, date_end: '2026-10-05', is_ongoing: true },
        { date_start: '2026-10-03', date_end: '2026-10-03' },
      ],
      quinta,
      sexta,
    );
    expect(grupos.map((g) => g.key)).toEqual(['2026-10-03', ONGOING]);
  });

  /*
   * Uma ligação para um fim de semana que já passou punha o que lá aconteceu
   * em «A decorrer» (C2-016). Num recorte passado, cada coisa fica no seu dia.
   */
  it('num recorte de dias que já passaram, o que aconteceu fica no seu dia', () => {
    const grupos = groupByDay(
      [{ date_start: '2026-09-18', date_end: '2026-09-18' }],
      '2026-10-01',
      '2026-09-18',
    );
    expect(grupos.map((g) => g.key)).toEqual(['2026-09-18']);
  });

  it('devolve lista vazia sem eventos', () => {
    expect(groupByDay([], HOJE)).toEqual([]);
  });
});

describe('dosPrimeirosDias (C2-018)', () => {
  const HOJE = '2026-10-02';
  const ATE = '2026-10-04';
  const ev = (id: string, date_start: string | null, extra: Record<string, unknown> = {}) => ({
    id,
    date_start,
    date_end: null,
    ...extra,
  });

  it('fica com os três primeiros dias e o que está em cartaz; larga o resto da semana e o que não tem data', () => {
    const lista = dosPrimeirosDias(
      [
        ev('hoje', HOJE),
        ev('domingo', ATE),
        ev('segunda', '2026-10-05'),
        ev('em-cartaz', '2026-09-20', { date_end: '2026-11-30', is_ongoing: true }),
        ev('sem-data', null),
      ],
      HOJE,
      ATE,
    );
    expect(lista.map((evento) => evento.id)).toEqual(['hoje', 'domingo', 'em-cartaz']);
  });

  it('corta pela próxima sessão, e não pela estreia', () => {
    // Um coro que estreou na semana passada e volta a cantar amanhã fica; um
    // que só volta na quarta, não.
    const lista = dosPrimeirosDias(
      [
        ev('amanha', '2026-09-26', { dias: ['2026-10-03'] }),
        ev('quarta', '2026-09-26', { dias: ['2026-10-07'] }),
      ],
      HOJE,
      ATE,
    );
    expect(lista.map((evento) => evento.id)).toEqual(['amanha']);
  });
});
