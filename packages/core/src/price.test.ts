import { describe, expect, it } from 'vitest';
import { formatPrice, parsePrice } from './price';

describe('parsePrice', () => {
  it('lê um valor único', () => {
    expect(parsePrice('12€')).toEqual({ priceMin: 12, priceMax: 12 });
    expect(parsePrice('10,00 €')).toEqual({ priceMin: 10, priceMax: 10 });
    expect(parsePrice('5 euros')).toEqual({ priceMin: 5, priceMax: 5 });
    expect(parsePrice('€ 7,50')).toEqual({ priceMin: 7.5, priceMax: 7.5 });
  });

  it('lê um intervalo', () => {
    expect(parsePrice('de 8 a 25 euros')).toEqual({ priceMin: 8, priceMax: 25 });
    expect(parsePrice('10€ - 20€')).toEqual({ priceMin: 10, priceMax: 20 });
  });

  it('lê as várias maneiras de dizer que é de graça', () => {
    for (const text of [
      'Entrada livre',
      'entrada gratuita',
      'Acesso livre',
      'Gratuito',
      'ENTRADA FRANCA',
    ]) {
      expect(parsePrice(text)).toEqual({ isFree: true, priceMin: 0 });
    }
  });

  it('deixa o preço pago ganhar à palavra «gratuito»', () => {
    expect(parsePrice('12€ (entrada livre para menores de 12)')).toEqual({
      priceMin: 12,
      priceMax: 12,
    });
  });

  it('junta os vários preços de uma tabela', () => {
    expect(parsePrice('5€ / 3€ estudantes')).toEqual({ priceMin: 3, priceMax: 5 });
  });

  it('ignora números que não são preços de bilhete', () => {
    expect(parsePrice('Prémio de 5000 euros para o vencedor')).toEqual({});
    expect(parsePrice('Lotação: 300 lugares')).toEqual({});
  });

  it('ignora valores acima do tecto', () => {
    expect(parsePrice('apoio de 20000 euros')).toEqual({});
  });

  it('devolve vazio quando não há nada a ler', () => {
    expect(parsePrice(null, undefined, '')).toEqual({});
  });
});

describe('formatPrice', () => {
  it('escreve os rótulos que aparecem no cartão', () => {
    expect(formatPrice({ isFree: true })).toBe('Entrada livre');
    expect(formatPrice({ priceMin: 0 })).toBe('Entrada livre');
    expect(formatPrice({ priceMin: 12, priceMax: 12 })).toBe('12 €');
    expect(formatPrice({ priceMin: 7.5, priceMax: 7.5 })).toBe('7,50 €');
    expect(formatPrice({ priceMin: 8, priceMax: 25 })).toBe('8 € – 25 €');
  });

  it('cai para o texto original quando não há número', () => {
    expect(formatPrice({}, 'Consultar bilheteira')).toBe('Consultar bilheteira');
    expect(formatPrice({})).toBe(null);
  });
});
