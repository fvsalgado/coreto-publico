import { describe, expect, it } from 'vitest';
import { ONGOING, UNDATED, groupByDay } from './agrupar';

const HOJE = '2026-08-28';

const evento = (date_start: string | null, date_end: string | null = null) => ({
  date_start,
  date_end,
});

describe('groupByDay', () => {
  it('põe cada dia no seu grupo, pela ordem em que vêm', () => {
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

  it('guarda os eventos sem data no seu próprio grupo', () => {
    const grupos = groupByDay([evento(null), evento('2026-08-29')], HOJE);
    expect(grupos.map((g) => g.key)).toEqual([UNDATED, '2026-08-29']);
  });

  it('devolve lista vazia sem eventos', () => {
    expect(groupByDay([], HOJE)).toEqual([]);
  });
});
