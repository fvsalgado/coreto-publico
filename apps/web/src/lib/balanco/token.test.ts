import { describe, expect, it } from 'vitest';
import { COMPRIMENTO_DO_SEGREDO, gerarSegredo, impressaoDoSegredo, segredosIguais } from './token';

describe('o segredo do balanço', () => {
  it('tem 32 bytes de entropia e cabe num endereço sem escape nenhum', () => {
    const s = gerarSegredo();
    expect(s).toHaveLength(COMPRIMENTO_DO_SEGREDO);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(s)).toBe(s);
  });

  it('nunca sai o mesmo duas vezes', () => {
    const cem = new Set(Array.from({ length: 100 }, () => gerarSegredo()));
    expect(cem.size).toBe(100);
  });
});

describe('a impressão do segredo', () => {
  it('é o sha256 em hexadecimal minúsculo, que é o que a 0151 guarda', () => {
    // O sha256 de 43 «a», escrito por extenso. Um valor fixo e não uma
    // expressão: se alguém trocar o algoritmo, a codificação do texto ou a do
    // resultado, todos os segredos que já foram dados deixam de abrir — e o
    // que se quer é saber isso aqui, e não por uma CIM à porta fechada.
    expect(impressaoDoSegredo('a'.repeat(43))).toBe(
      '66d34fba71f8f450f7e45598853e53bfc23bbd129027cbb131a2f4ffd7878cd0',
    );
  });

  it('é estável: o mesmo segredo dá sempre a mesma impressão', () => {
    const s = gerarSegredo();
    expect(impressaoDoSegredo(s)).toBe(impressaoDoSegredo(s));
  });

  it('dois segredos diferentes dão impressões diferentes', () => {
    expect(impressaoDoSegredo(gerarSegredo())).not.toBe(impressaoDoSegredo(gerarSegredo()));
  });

  /**
   * Um segredo malformado devolve `null`, e o chamador trata-o como «não
   * abre» — exatamente a mesma resposta que um segredo errado. Distinguir os
   * dois dizia a quem tenta se acertou na forma, que é metade do caminho.
   */
  it('recusa tudo o que não tem a forma, sem sequer calcular', () => {
    expect(impressaoDoSegredo(null)).toBeNull();
    expect(impressaoDoSegredo(undefined)).toBeNull();
    expect(impressaoDoSegredo('')).toBeNull();
    expect(impressaoDoSegredo('curto')).toBeNull();
    expect(impressaoDoSegredo('a'.repeat(44))).toBeNull();
    expect(impressaoDoSegredo('a'.repeat(42))).toBeNull();
    // Caracteres fora do base64url: o `+`, o `/` e o `=` do base64 normal.
    expect(impressaoDoSegredo(`${'a'.repeat(42)}+`)).toBeNull();
    expect(impressaoDoSegredo(`${'a'.repeat(42)}/`)).toBeNull();
    expect(impressaoDoSegredo(`${'a'.repeat(42)}=`)).toBeNull();
    // E o que alguém escreveria a tentar a sorte.
    expect(impressaoDoSegredo("' or 1=1 --")).toBeNull();
  });

  it('o que gera passa sempre no que valida', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(impressaoDoSegredo(gerarSegredo())).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('a comparação em tempo constante', () => {
  it('diz que sim ao mesmo e que não ao diferente', () => {
    const s = gerarSegredo();
    expect(segredosIguais(s, s)).toBe(true);
    expect(segredosIguais(s, gerarSegredo())).toBe(false);
  });

  it('não rebenta com comprimentos diferentes', () => {
    expect(segredosIguais('a', 'bb')).toBe(false);
    expect(segredosIguais('', '')).toBe(true);
  });
});
