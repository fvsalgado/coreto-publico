import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { VERSAO_MAXIMA, caminhoDoQR, codigoQR, type CodigoQR } from './qr';

/**
 * O QR do cartaz da semana — conferido contra uma implementação de referência.
 *
 * Um QR errado não dá erro nenhum: dá um quadrado que a câmara do telemóvel
 * não lê, afixado na porta de um café. As matrizes daqui foram tiradas da
 * biblioteca `qrcode` (a de referência em JavaScript), no mesmo modo, nível,
 * versão e máscara — e o símbolo escolhido sozinho foi lido por um
 * descodificador independente (`jsQR`) quando isto se escreveu. A biblioteca
 * não entra no projeto: serviu para conferir, e o que fica é o resultado.
 */

/** A matriz em texto, uma linha por fila: `#` escuro, `.` claro. */
function emTexto(codigo: CodigoQR): string[] {
  return codigo.modulos.map((linha) => linha.map((escuro) => (escuro ? '#' : '.')).join(''));
}

const resumo = (linhas: string[]) => createHash('sha256').update(linhas.join('\n')).digest('hex');

describe('codigoQR', () => {
  it('desenha, módulo a módulo, o mesmo que a referência (versão 4, máscara 2)', () => {
    const codigo = codigoQR('https://demo.coreto.org/concelho/vila-da-charamela', 2);
    expect(codigo?.versao).toBe(4);
    expect(emTexto(codigo as CodigoQR)).toEqual([
      '#######..#..##..##.###.#..#######',
      '#.....#..#########..#...#.#.....#',
      '#.###.#.#.####.#######.#..#.###.#',
      '#.###.#.#.#.#.###..##.##..#.###.#',
      '#.###.#.#.#.##.#..#..#.#..#.###.#',
      '#.....#.##.##.#####.#.....#.....#',
      '#######.#.#.#.#.#.#.#.#.#.#######',
      '........##.#...#..#..##.#........',
      '#.#####....#####.#....#.#.#####..',
      '..#....####.....#.####.##.##.####',
      '...####....##..##.#..#...#..#.##.',
      '###.....####..#....#####....#####',
      '#.#######.#....#..##..####.###.##',
      '.###...#.####.###...#..#..#..####',
      '.###..###.#.##...#.#..#.###....#.',
      '..#.#..#...#.#..#..####.###.###..',
      '......####.......###..####.##...#',
      '######....###.#.####..##..##.##.#',
      '..##.##..#######.#..###....##.#..',
      '.#.....########.#######..#.######',
      '#####.##.##...#.#..#..###..###.##',
      '#...##.##....###.##..#.#..##....#',
      '#...###.#..#.#####..#....#...###.',
      '#..##...##..#.##.....#.##..#.##.#',
      '#.#...#..#.#..##.#....#.#####....',
      '........#.##.##.#.####..#...#.#.#',
      '#######..#....###.#..####.#.#.##.',
      '#.....#.##..###.#...#####...###..',
      '#.###.#.#.#.#.....#...#.######..#',
      '#.###.#.#...##.##..###.###..##.##',
      '#.###.#.##..###..##..####.##..#..',
      '#.....#...#.#...#...###..##.###..',
      '#######.#..#.....#.##.####.#...#.',
    ]);
  });

  it('a partir da versão 7 leva a informação de versão, como a referência', () => {
    // 120 bytes: versão 7, dois grupos de blocos e os 18 bits da versão nos cantos.
    const codigo = codigoQR('x'.repeat(120), 5) as CodigoQR;
    expect(codigo.versao).toBe(7);
    expect(resumo(emTexto(codigo))).toBe(
      'faf8db708232d5af5edfc5f567465a09c691d4b8d39ce3cd0d3b79937387aee6',
    );
  });

  it('na versão 10 a contagem passa a 16 bits, e o texto vai em UTF-8', () => {
    const codigo = codigoQR(
      `https://agenda.exemplo.pt/concelho/são-joão-da-pesqueira-${'a'.repeat(150)}`,
      3,
    ) as CodigoQR;
    expect(codigo.versao).toBe(10);
    expect(resumo(emTexto(codigo))).toBe(
      'c852c5ebc9aa7ecc8db78a206cb85402f2faae9863592cd6ed3efc7e3eade930',
    );
  });

  it('escolhe a versão mais pequena em que o texto cabe, e recusa acima da 10', () => {
    expect(codigoQR('https://exemplo.pt/x')?.versao).toBe(2);
    expect(codigoQR('z'.repeat(213))?.versao).toBe(VERSAO_MAXIMA);
    // Um QR que não se lê é pior do que nenhum: acima da capacidade, nada.
    expect(codigoQR('z'.repeat(214))).toBeNull();
  });

  it('sozinho, escolhe a máscara de menor penalização — e é sempre a mesma', () => {
    const a = codigoQR('https://demo.coreto.org/concelho/vila-da-charamela') as CodigoQR;
    const b = codigoQR('https://demo.coreto.org/concelho/vila-da-charamela') as CodigoQR;
    expect(a.mascara).toBe(2);
    expect(emTexto(a)).toEqual(emTexto(b));
  });
});

describe('caminhoDoQR', () => {
  it('leva a margem clara de quatro módulos que a norma exige', () => {
    const codigo = codigoQR('https://exemplo.pt/x') as CodigoQR;
    expect(caminhoDoQR(codigo).viewBox).toBe(`0 0 ${codigo.tamanho + 8} ${codigo.tamanho + 8}`);
    // O canto de cima à esquerda do primeiro olho começa no módulo 4.
    expect(caminhoDoQR(codigo).d.startsWith('M4 4h7v1h-7z')).toBe(true);
  });

  it('junta os módulos escuros seguidos de uma linha num retângulo só', () => {
    const codigo = codigoQR('https://exemplo.pt/x') as CodigoQR;
    const escuros = codigo.modulos.flat().filter(Boolean).length;
    const retangulos = caminhoDoQR(codigo).d.split('M').length - 1;
    expect(retangulos).toBeGreaterThan(0);
    expect(retangulos).toBeLessThan(escuros);
  });
});
