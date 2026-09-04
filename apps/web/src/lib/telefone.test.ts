import { describe, expect, it } from 'vitest';
import { telefones } from './telefone';

describe('telefones', () => {
  it('marca um número simples', () => {
    expect(telefones('+351 249 891 207')).toEqual([
      { etiqueta: '+351 249 891 207', href: 'tel:+351249891207' },
    ]);
  });

  it('mostra a extensão e não a marca', () => {
    // O caso da biblioteca de Mação: `tel:+351241577200(ext.249)` não liga.
    const [primeiro] = telefones('+351 241 577 200 (ext. 249)');
    expect(primeiro?.etiqueta).toBe('+351 241 577 200 (ext. 249)');
    expect(primeiro?.href).toBe('tel:+351241577200');
  });

  it('não parte a extensão que traz uma barra sem espaços', () => {
    // `(ext. 6841/6842)` é uma extensão, não dois números.
    expect(telefones('+351 249 540 900 (ext. 6841/6842)')).toHaveLength(1);
  });

  it('separa dois números e dá a cada um o seu link', () => {
    expect(telefones('+351 249 540 900 / +351 919 585 003')).toEqual([
      { etiqueta: '+351 249 540 900', href: 'tel:+351249540900' },
      { etiqueta: '+351 919 585 003', href: 'tel:+351919585003' },
    ]);
  });

  it('não inventa nada quando não há telefone', () => {
    expect(telefones(null)).toEqual([]);
    expect(telefones('')).toEqual([]);
    expect(telefones('   ')).toEqual([]);
  });

  it('deixa passar um número fora do formato em vez de o deitar fora', () => {
    // Um valor estranho é um problema de dados, não uma razão para a ficha
    // ficar sem telefone nenhum.
    const [primeiro] = telefones('249 891 207 ou pelo balcão');
    expect(primeiro?.etiqueta).toBe('249 891 207 ou pelo balcão');
    expect(primeiro?.href).toBe('tel:249891207');
  });
});
