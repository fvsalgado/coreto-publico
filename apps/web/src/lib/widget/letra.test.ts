import { describe, expect, it } from 'vitest';
import { lerTipoDeLetra } from './letra';

describe('lerTipoDeLetra', () => {
  it('aceita um nome simples e acrescenta-lhe uma reserva', () => {
    expect(lerTipoDeLetra('Open Sans')).toBe('"Open Sans", sans-serif');
  });

  it('aceita uma pilha inteira e respeita a genérica que já lá está', () => {
    expect(lerTipoDeLetra('Lato, Helvetica, sans-serif')).toBe('"Lato", "Helvetica", sans-serif');
    expect(lerTipoDeLetra('Georgia, serif')).toBe('"Georgia", serif');
  });

  it('normaliza as aspas em vez de confiar nas que vieram', () => {
    // Uma aspa a mais ou a menos desequilibrava a declaração inteira. Aqui
    // saem todas e voltam a ser postas por nós — e a genérica fica sem elas,
    // que é como o CSS a quer.
    expect(lerTipoDeLetra('"Open Sans", serif')).toBe('"Open Sans", serif');
    expect(lerTipoDeLetra("'Open Sans, serif")).toBe('"Open Sans", serif');
  });

  it('aceita acentos, que existem em nomes de letras', () => {
    expect(lerTipoDeLetra('Muli Regular')).toBe('"Muli Regular", sans-serif');
    expect(lerTipoDeLetra('Comércio Sans')).toBe('"Comércio Sans", sans-serif');
  });

  it('deita fora o que fecharia a declaração ou abriria outra regra', () => {
    expect(lerTipoDeLetra('serif;background:url(x)')).toBeNull();
    expect(lerTipoDeLetra('a}body{display:none')).toBeNull();
    expect(lerTipoDeLetra('Open Sans<script>')).toBeNull();
    expect(lerTipoDeLetra('url(http://mau.pt/x)')).toBeNull();
    expect(lerTipoDeLetra('@import "mau"')).toBeNull();
  });

  it('salta o nome estragado e fica com os bons', () => {
    // Um nome mau numa pilha não deita a pilha fora.
    expect(lerTipoDeLetra('Open Sans, a{b}, serif')).toBe('"Open Sans", serif');
  });

  it('recusa o vazio e o desmesurado', () => {
    expect(lerTipoDeLetra('')).toBeNull();
    expect(lerTipoDeLetra('   ')).toBeNull();
    expect(lerTipoDeLetra(null)).toBeNull();
    expect(lerTipoDeLetra('a'.repeat(300))).toBeNull();
  });

  it('trava o número de famílias', () => {
    const muitas = 'A, B, C, D, E, F, G, H, I';
    const lido = lerTipoDeLetra(muitas) ?? '';
    expect(lido.split(',').length).toBeLessThanOrEqual(7);
  });

  it('nunca devolve caracteres que quebrem um atributo style', () => {
    for (const entrada of ['Open Sans', 'Georgia, serif', 'Muli', 'system-ui']) {
      const lido = lerTipoDeLetra(entrada) ?? '';
      expect(lido).not.toMatch(/[;{}()<>\\]/);
    }
  });
});
