import { describe, expect, it } from 'vitest';
import { medidasDaImagem } from './imagem';

/**
 * Cabeçalhos construídos byte a byte, e não ficheiros de exemplo.
 *
 * Um PNG de verdade no repositório provaria que este leitor lê aquele PNG. O
 * que interessa provar é outra coisa: que lê o **campo certo** de cada formato,
 * e que não inventa nada quando os bytes não são o que dizem ser. Escrever os
 * cabeçalhos à mão é o que torna cada teste uma afirmação sobre a norma —
 * «o GIF é little-endian», «o JPEG traz a altura antes da largura» — em vez de
 * uma comparação com um ficheiro que ninguém leu.
 */

function bytes(...valores: number[]): Uint8Array {
  return new Uint8Array(valores);
}

function png(largura: number, altura: number): Uint8Array {
  return bytes(
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52,
    (largura >>> 24) & 0xff,
    (largura >>> 16) & 0xff,
    (largura >>> 8) & 0xff,
    largura & 0xff,
    (altura >>> 24) & 0xff,
    (altura >>> 16) & 0xff,
    (altura >>> 8) & 0xff,
    altura & 0xff,
  );
}

describe('PNG', () => {
  it('lê as medidas do IHDR', () => {
    expect(medidasDaImagem(png(1200, 630))).toEqual({ largura: 1200, altura: 630 });
  });

  it('a assinatura sem IHDR não dá medidas', () => {
    // Um PNG cujo primeiro chunk não seja o IHDR é inválido pela norma. Ler os
    // quatro bytes seguintes na mesma dava um número qualquer com ar de medida.
    const falso = png(800, 600);
    falso.set([0x49, 0x44, 0x41, 0x54], 12); // «IDAT» onde devia estar «IHDR»
    expect(medidasDaImagem(falso)).toBeNull();
  });
});

describe('GIF', () => {
  it('lê as medidas em little-endian — é o único destes que o é', () => {
    // 0x0140 = 320 escrito 40 01; ler isto como big-endian dava 16385.
    const gif = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x01, 0xf0, 0x00);
    expect(medidasDaImagem(gif)).toEqual({ largura: 320, altura: 240 });
  });

  it('aceita o 87a tanto como o 89a', () => {
    const gif = bytes(0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x0a, 0x00, 0x14, 0x00);
    expect(medidasDaImagem(gif)).toEqual({ largura: 10, altura: 20 });
  });
});

describe('JPEG', () => {
  /** `FFD8` + segmentos até um SOF0 com as medidas dadas. */
  function jpeg(largura: number, altura: number, antes: number[] = []): Uint8Array {
    return bytes(
      0xff,
      0xd8,
      ...antes,
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      (altura >>> 8) & 0xff,
      altura & 0xff,
      (largura >>> 8) & 0xff,
      largura & 0xff,
      0x03,
      0x01,
      0x22,
      0x00,
    );
  }

  it('a altura vem antes da largura, ao contrário de toda a gente', () => {
    // Se algum dia isto trocar, é aqui que se vê: 1920×1080 lido ao contrário
    // dá um cartaz deitado onde devia estar um em pé.
    expect(medidasDaImagem(jpeg(1920, 1080))).toEqual({ largura: 1920, altura: 1080 });
  });

  it('percorre os segmentos que vêm antes do SOF', () => {
    // Um APP0 (JFIF) de 16 bytes à frente, como qualquer JPEG de máquina.
    const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)];
    expect(medidasDaImagem(jpeg(640, 480, app0))).toEqual({ largura: 640, altura: 480 });
  });

  it('não confunde as tabelas de Huffman com um segmento de medidas', () => {
    // `FFC4` está na gama dos SOF e não é um: ler-lhe o tamanho como se fossem
    // medidas dava uma imagem fabricada a partir de uma tabela de compressão.
    const dht = [0xff, 0xc4, 0x00, 0x14, ...new Array(18).fill(0)];
    expect(medidasDaImagem(jpeg(800, 600, dht))).toEqual({ largura: 800, altura: 600 });
  });

  it('para no início dos dados comprimidos em vez de os ler como cabeçalho', () => {
    const soComDados = bytes(0xff, 0xd8, 0xff, 0xda, 0x00, 0x0c, ...new Array(40).fill(0x42));
    expect(medidasDaImagem(soComDados)).toBeNull();
  });

  it('um segmento de tamanho zero não prende o ciclo', () => {
    // Sem a guarda, `posicao += 2 + 0` nunca avança e a recolha fica pendurada
    // num cartaz corrompido — que é pior do que não ter medidas.
    const corrompido = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, ...new Array(40).fill(0));
    expect(medidasDaImagem(corrompido)).toBeNull();
  });

  it('um cabeçalho que acaba antes do SOF fica sem medidas', () => {
    // É o caso real: um EXIF grande empurra o SOF para além dos dois
    // kilobytes que se foram buscar. Não é erro, é «não sei».
    const soPrincipio = bytes(0xff, 0xd8, 0xff, 0xe1, 0x0f, 0xa0, ...new Array(30).fill(0));
    expect(medidasDaImagem(soPrincipio)).toBeNull();
  });
});

describe('WebP', () => {
  function riff(variante: string, resto: number[]): Uint8Array {
    return bytes(
      0x52,
      0x49,
      0x46,
      0x46,
      0x00,
      0x00,
      0x00,
      0x00,
      0x57,
      0x45,
      0x42,
      0x50,
      ...[...variante].map((c) => c.charCodeAt(0)),
      ...resto,
    );
  }

  it('VP8 com perdas: catorze bits, com dois de escala por cima', () => {
    // 550 = 0x226. Com a escala a 3 nos bits de cima (0xC2 0x26 → 0xC226), a
    // máscara tem de a deitar fora; sem ela sairia 49702.
    const resto = [...new Array(10).fill(0), 0x26, 0xc2, 0x2c, 0x81];
    expect(medidasDaImagem(riff('VP8 ', resto))).toEqual({ largura: 550, altura: 300 });
  });

  it('VP8L sem perdas: catorze bits empacotados, e menos um cada', () => {
    // largura-1 = 99 e altura-1 = 49, empacotados em 32 bits.
    const empacotado = 99 | (49 << 14);
    const resto = [
      // Quatro bytes de tamanho do chunk mais o byte de assinatura (0x2F): é
      // o que põe o valor empacotado no byte 21 do ficheiro, e é aí que a
      // norma o quer.
      0x00,
      0x00,
      0x00,
      0x00,
      0x2f,
      empacotado & 0xff,
      (empacotado >>> 8) & 0xff,
      (empacotado >>> 16) & 0xff,
      (empacotado >>> 24) & 0xff,
    ];
    expect(medidasDaImagem(riff('VP8L', resto))).toEqual({ largura: 100, altura: 50 });
  });

  it('VP8X estendido: vinte e quatro bits cada, e menos um cada', () => {
    const resto = [
      ...new Array(8).fill(0),
      0xff,
      0x03,
      0x00, // 1023 → 1024
      0x7f,
      0x02,
      0x00, // 639 → 640
    ];
    expect(medidasDaImagem(riff('VP8X', resto))).toEqual({ largura: 1024, altura: 640 });
  });
});

describe('o que não se lê devolve null, e nunca lança', () => {
  it('bytes vazios', () => {
    expect(medidasDaImagem(new Uint8Array(0))).toBeNull();
  });

  it('uma página de erro em HTML em vez da imagem', () => {
    // Acontece: a câmara devolve 200 com «Página não encontrada» em HTML.
    const html = new TextEncoder().encode('<!doctype html><html><body>404</body></html>');
    expect(medidasDaImagem(html)).toBeNull();
  });

  it('um SVG, que não tem medidas em píxeis para dar', () => {
    const svg = new TextEncoder().encode('<svg viewBox="0 0 100 100" xmlns="...">');
    expect(medidasDaImagem(svg)).toBeNull();
  });

  it('um PNG cortado a meio do IHDR', () => {
    expect(medidasDaImagem(png(100, 100).slice(0, 18))).toBeNull();
  });

  it('medidas absurdas são lixo e tratam-se como tal', () => {
    // Um cabeçalho corrompido consegue declarar mil milhões de píxeis, e esse
    // número ia parar a um atributo `height` que reserva um quilómetro de
    // página — pior do que o salto que isto veio resolver.
    expect(medidasDaImagem(png(4_000_000_000, 10))).toBeNull();
    expect(medidasDaImagem(png(0, 0))).toBeNull();
  });
});
