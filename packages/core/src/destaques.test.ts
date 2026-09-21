import { describe, expect, it } from 'vitest';
import { baralharComSemente, comporDestaques, type EntradaDeDestaque } from './destaques';

const HOJE = '2026-09-20';

function evento(id: string, ate: string | null = '2026-09-25'): EntradaDeDestaque {
  return { id, ate };
}

const SEMANA = Array.from({ length: 10 }, (_, i) => evento(`s${i}`));

describe('baralharComSemente', () => {
  /*
   * A montra é servida de cache com uma hora de vida. Um sorteio por pedido
   * fazia-a mudar a meio de uma leitura, e o que se via dependia de qual das
   * cópias em cache respondeu.
   */
  it('a mesma semente dá sempre a mesma ordem', () => {
    const uma = baralharComSemente(SEMANA, 'medio-tejo:2026-09-20');
    const outra = baralharComSemente(SEMANA, 'medio-tejo:2026-09-20');
    expect(uma.map((e) => e.id)).toEqual(outra.map((e) => e.id));
  });

  it('sementes diferentes dão ordens diferentes', () => {
    const hoje = baralharComSemente(SEMANA, 'medio-tejo:2026-09-20');
    const amanha = baralharComSemente(SEMANA, 'medio-tejo:2026-09-21');
    expect(hoje.map((e) => e.id)).not.toEqual(amanha.map((e) => e.id));
  });

  it('duas regiões no mesmo dia não veem a mesma ordem', () => {
    const uma = baralharComSemente(SEMANA, 'medio-tejo:2026-09-20');
    const outra = baralharComSemente(SEMANA, 'vale-do-coreto:2026-09-20');
    expect(uma.map((e) => e.id)).not.toEqual(outra.map((e) => e.id));
  });

  it('não perde nem inventa nenhum, e não mexe na lista que recebe', () => {
    const copia = [...SEMANA];
    const saida = baralharComSemente(SEMANA, 'x');
    expect(saida).toHaveLength(SEMANA.length);
    expect(new Set(saida.map((e) => e.id))).toEqual(new Set(SEMANA.map((e) => e.id)));
    expect(SEMANA).toEqual(copia);
  });

  it('aguenta a lista vazia e a de um só', () => {
    expect(baralharComSemente([], 'x')).toEqual([]);
    expect(baralharComSemente([evento('u')], 'x').map((e) => e.id)).toEqual(['u']);
  });
});

describe('comporDestaques', () => {
  const base = { daSemana: SEMANA, alvo: 6, hoje: HOJE, semente: 'r:2026-09-20' };

  it('sem nada fixado, enche-se com a semana', () => {
    const saida = comporDestaques({ ...base, fixados: [] });
    expect(saida).toHaveLength(6);
    expect(saida.every((e) => e.id.startsWith('s'))).toBe(true);
  });

  it('os fixados vêm primeiro e pela ordem que lhes deram', () => {
    const fixados = [evento('f1'), evento('f2')];
    const saida = comporDestaques({ ...base, fixados });
    expect(saida.slice(0, 2).map((e) => e.id)).toEqual(['f1', 'f2']);
    expect(saida).toHaveLength(6);
  });

  /*
   * Um destaque fixado em setembro para um evento de setembro continua
   * fixado em outubro. Não se apaga — quem fixou é que decide isso —, mas a
   * montra não é sítio para o que já passou.
   */
  it('o que já acabou não entra, mesmo fixado', () => {
    const fixados = [evento('passado', '2026-09-19'), evento('f2')];
    const saida = comporDestaques({ ...base, fixados });
    expect(saida.map((e) => e.id)).not.toContain('passado');
    expect(saida[0]?.id).toBe('f2');
  });

  it('um evento que acaba hoje ainda é destaque', () => {
    const saida = comporDestaques({ ...base, fixados: [evento('hoje', HOJE)] });
    expect(saida[0]?.id).toBe('hoje');
  });

  it('um evento sem data de fim conta como a decorrer', () => {
    const saida = comporDestaques({ ...base, fixados: [evento('sem-fim', null)] });
    expect(saida[0]?.id).toBe('sem-fim');
  });

  it('um fixado que também está na semana não aparece duas vezes', () => {
    const saida = comporDestaques({ ...base, fixados: [evento('s3')] });
    expect(saida.filter((e) => e.id === 's3')).toHaveLength(1);
    expect(saida).toHaveLength(6);
  });

  it('com mais fixados do que o alvo, mostram-se os primeiros', () => {
    const fixados = Array.from({ length: 8 }, (_, i) => evento(`f${i}`));
    const saida = comporDestaques({ ...base, fixados, alvo: 3 });
    expect(saida.map((e) => e.id)).toEqual(['f0', 'f1', 'f2']);
  });

  // Zero é uma escolha legítima: «não quero montra nenhuma».
  it('alvo zero não devolve nada', () => {
    expect(comporDestaques({ ...base, fixados: [evento('f1')], alvo: 0 })).toEqual([]);
  });

  it('com menos eventos do que o alvo, devolve os que há', () => {
    const saida = comporDestaques({ ...base, daSemana: SEMANA.slice(0, 2), fixados: [], alvo: 6 });
    expect(saida).toHaveLength(2);
  });

  it('a composição é estável no mesmo dia e muda no dia seguinte', () => {
    const hoje = comporDestaques({ ...base, fixados: [] });
    const outraVez = comporDestaques({ ...base, fixados: [] });
    const amanha = comporDestaques({ ...base, fixados: [], semente: 'r:2026-09-21' });
    expect(hoje.map((e) => e.id)).toEqual(outraVez.map((e) => e.id));
    expect(hoje.map((e) => e.id)).not.toEqual(amanha.map((e) => e.id));
  });
});
