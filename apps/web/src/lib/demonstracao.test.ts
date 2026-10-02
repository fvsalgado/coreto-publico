import { describe, expect, it } from 'vitest';
import { numerosDoEstado } from './demonstracao';

describe('os números da demonstração', () => {
  it('lê o total, os concelhos e os espaços do estado público', () => {
    expect(
      numerosDoEstado({
        regiao: 'vale-do-coreto',
        agenda: { total: 31, concelhosAZero: [], concelhos: 2, espacos: 8 },
        calculadoEm: '2026-10-02T13:21:23.464Z',
      }),
    ).toEqual({ eventos: 31, concelhos: 2, espacos: 8, lidoEm: '2026-10-02T13:21:23.464Z' });
  });

  it('um estado de antes dos campos novos dá o total, e não inventa o resto', () => {
    expect(
      numerosDoEstado({
        agenda: { total: 31, concelhosAZero: [] },
        calculadoEm: '2026-10-02T13:21:23.464Z',
      }),
    ).toEqual({ eventos: 31, concelhos: null, espacos: null, lidoEm: '2026-10-02T13:21:23.464Z' });
  });

  it('o que não é um estado não dá números', () => {
    expect(numerosDoEstado(null)).toBeNull();
    expect(numerosDoEstado({ agenda: { total: '31' }, calculadoEm: 'ontem' })).toBeNull();
    expect(numerosDoEstado({ grau: 'mau', resumo: 'a base não respondeu' })).toBeNull();
  });
});
