import { describe, expect, it } from 'vitest';
import { contraste, legivelSobre, lerCor, luminancia, paletaDoWidget, tintaSobre } from './cores';

const PAPEL = '#fbfdfd';
const ESCURO = '#131418';

describe('lerCor', () => {
  it('aceita as formas que uma pessoa escreve à mão', () => {
    expect(lerCor('#14676B')).toBe('#14676b');
    expect(lerCor('14676b')).toBe('#14676b');
    expect(lerCor('  #abc  ')).toBe('#aabbcc');
    expect(lerCor('abc')).toBe('#aabbcc');
  });

  it('recusa o que não é uma cor, em vez de adivinhar', () => {
    expect(lerCor('vermelho')).toBeNull();
    expect(lerCor('#12345')).toBeNull();
    expect(lerCor('rgb(1,2,3)')).toBeNull();
    expect(lerCor('')).toBeNull();
    expect(lerCor(null)).toBeNull();
    // Uma cor com aspas dentro fechava a declaração de estilo se passasse.
    expect(lerCor('#fff;background:red')).toBeNull();
  });
});

describe('luminancia e contraste', () => {
  it('põe o branco em cima e o preto em baixo', () => {
    expect(luminancia('#ffffff')).toBeCloseTo(1, 5);
    expect(luminancia('#000000')).toBeCloseTo(0, 5);
  });

  it('dá 21:1 entre preto e branco', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('dá 1:1 a uma cor consigo própria', () => {
    expect(contraste('#14676b', '#14676b')).toBeCloseTo(1, 5);
  });
});

describe('legivelSobre', () => {
  it('deixa em paz uma cor que já se lê', () => {
    // O turquesa desta casa sobre o papel desta casa já passa.
    expect(legivelSobre('#14676b', PAPEL)).toBe('#14676b');
  });

  it('escurece o amarelo de marca até se poder ler sobre papel', () => {
    // O caso que motivou o módulo: #ffe600 dá cerca de 1,2:1 sobre branco.
    const ajustado = legivelSobre('#ffe600', PAPEL);
    expect(ajustado).not.toBe('#ffe600');
    expect(contraste(ajustado, PAPEL)).toBeGreaterThanOrEqual(4.5);
  });

  it('aclara uma cor escura sobre fundo escuro, em vez de a escurecer mais', () => {
    const ajustado = legivelSobre('#14676b', ESCURO);
    expect(contraste(ajustado, ESCURO)).toBeGreaterThanOrEqual(4.5);
    expect(luminancia(ajustado)).toBeGreaterThan(luminancia('#14676b'));
  });

  it('leva qualquer cor a passar, sobre claro e sobre escuro', () => {
    const cores = ['#ffe600', '#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#808080'];
    for (const fundo of [PAPEL, ESCURO, '#ffffff', '#000000']) {
      for (const cor of cores) {
        expect(
          contraste(legivelSobre(cor, fundo), fundo),
          `${cor} sobre ${fundo}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('tintaSobre', () => {
  it('escolhe branco sobre escuro e preto sobre claro', () => {
    expect(tintaSobre('#14676b')).toBe('#ffffff');
    expect(tintaSobre('#ffe600')).toBe('#000000');
  });

  it('dá sempre uma tinta que se lê por cima da cor', () => {
    for (const cor of ['#ffe600', '#14676b', '#7f7f7f', '#ff0000', '#0000ff']) {
      expect(contraste(tintaSobre(cor), cor), cor).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('paletaDoWidget', () => {
  it('não devolve paleta nenhuma sem cor escolhida', () => {
    expect(paletaDoWidget(null, PAPEL)).toBeNull();
    expect(paletaDoWidget('azul-da-camara', PAPEL)).toBeNull();
  });

  it('guarda a marca como foi dada e garante o texto', () => {
    const paleta = paletaDoWidget('#ffe600', PAPEL);
    expect(paleta?.marca).toBe('#ffe600');
    expect(contraste(paleta?.texto ?? '', PAPEL)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(paleta?.contraMarca ?? '', '#ffe600')).toBeGreaterThanOrEqual(4.5);
  });

  it('dá um fundo de pastilha próximo do papel, para o texto assentar', () => {
    const paleta = paletaDoWidget('#14676b', PAPEL);
    // Quase papel: a pastilha marca sem gritar.
    expect(contraste(paleta?.fundo ?? '', PAPEL)).toBeLessThan(1.6);
  });
});
