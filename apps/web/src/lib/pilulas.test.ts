import { describe, expect, it } from 'vitest';
import { primeiroNivel } from './pilulas';

const p = (chave: string, quantos: number | null, activa = false) => ({ chave, quantos, activa });

describe('primeiroNivel (Selo 3.1)', () => {
  it('até ao máximo mais uma, ficam todas à vista', () => {
    const nove = Array.from({ length: 9 }, (_, i) => p(`c${i}`, i));
    expect(primeiroNivel(nove, 8).resto).toEqual([]);
  });

  it('acima disso ficam as de mais eventos, pela ordem em que vieram', () => {
    const fila = [p('a', 1), p('b', 9), p('c', 3), p('d', 7), p('e', 2)];
    const { aVista, resto } = primeiroNivel(fila, 2);
    expect(aVista.map((x) => x.chave)).toEqual(['b', 'd']);
    expect(resto.map((x) => x.chave)).toEqual(['a', 'c', 'e']);
  });

  it('a acesa fica sempre à vista, mesmo com poucos eventos', () => {
    const fila = [p('a', 1, true), p('b', 9), p('c', 3), p('d', 7)];
    const { aVista } = primeiroNivel(fila, 2);
    expect(aVista.map((x) => x.chave)).toEqual(['a', 'b']);
  });

  it('sem contagem, ficam as primeiras', () => {
    const fila = [p('a', null), p('b', null), p('c', null), p('d', null)];
    expect(primeiroNivel(fila, 2).aVista.map((x) => x.chave)).toEqual(['a', 'b']);
  });

  it('nenhum nível passa de nove com o máximo de oito e o «Mais»', () => {
    const catorze = Array.from({ length: 14 }, (_, i) => p(`c${i}`, 14 - i));
    const { aVista, resto } = primeiroNivel(catorze, 8);
    expect(aVista.length + 1).toBeLessThanOrEqual(9);
    expect(resto.length).toBeLessThanOrEqual(9);
  });
});
