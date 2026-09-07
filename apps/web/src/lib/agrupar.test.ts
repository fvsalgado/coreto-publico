import { describe, expect, it } from 'vitest';
import { ONGOING, UNDATED, groupByDay } from './agrupar';

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
    expect(grupos.map((g) => g.key)).toEqual([ONGOING, '2026-08-28']);
    expect(grupos[0]?.events).toHaveLength(2);
    expect(grupos[1]?.events).toHaveLength(1);
  });

  it('dentro do «A decorrer» põe à frente o que fecha primeiro', () => {
    const grupos = groupByDay(
      [evento('2026-05-16', '2027-01-03'), evento('2026-06-03', '2026-09-27')],
      HOJE,
    );
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
      ONGOING,
      '2026-09-07',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      UNDATED,
    ]);
  });

  it('devolve lista vazia sem eventos', () => {
    expect(groupByDay([], HOJE)).toEqual([]);
  });
});
