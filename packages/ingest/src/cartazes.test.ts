import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { LARGURA_DA_MINIATURA, LARGURA_DO_CARTAZ, MAXIMO_DE_BYTES_DO_ORIGINAL } from '@coreto/core';
import { derivarCartaz, nomeDoCartaz } from './cartazes.js';

const EVENTO = '11111111-1111-4111-8111-111111111111';
const ORIGEM = 'https://www.cm-tomar.pt/cartazes/2026/festa.jpg';

async function cartaz(largura: number, altura: number): Promise<Uint8Array> {
  const bytes = await sharp({
    create: { width: largura, height: altura, channels: 3, background: '#7a1f2b' },
  })
    .png()
    .toBuffer();
  return new Uint8Array(bytes);
}

describe('nomeDoCartaz', () => {
  it('o mesmo endereço dá sempre o mesmo nome', () => {
    expect(nomeDoCartaz(EVENTO, ORIGEM, 1200)).toBe(nomeDoCartaz(EVENTO, ORIGEM, 1200));
  });

  /*
   * É isto que torna uma cache de um ano segura. Um cartaz substituído chega
   * com outro endereço — é assim que os gestores de conteúdos municipais fazem
   * — e sai com outro nome, sem ninguém ter de invalidar nada.
   */
  it('endereços diferentes dão nomes diferentes', () => {
    const outro = 'https://www.cm-tomar.pt/cartazes/2026/festa-v2.jpg';
    expect(nomeDoCartaz(EVENTO, outro, 1200)).not.toBe(nomeDoCartaz(EVENTO, ORIGEM, 1200));
  });

  it('cada evento tem a sua pasta, e é o que faz a limpeza ser uma listagem', () => {
    expect(nomeDoCartaz(EVENTO, ORIGEM, 1200).startsWith(`cartazes/${EVENTO}/`)).toBe(true);
  });

  it('as duas medidas do mesmo cartaz não se pisam', () => {
    expect(nomeDoCartaz(EVENTO, ORIGEM, 1200)).not.toBe(nomeDoCartaz(EVENTO, ORIGEM, 400));
  });
});

describe('derivarCartaz', () => {
  it('um cartaz grande sai nas duas medidas, e em WebP', async () => {
    const saida = await derivarCartaz(await cartaz(2400, 3200), EVENTO, ORIGEM);
    expect(saida.estado).toBe('ok');
    if (saida.estado !== 'ok') return;

    expect(saida.grande.largura).toBe(LARGURA_DO_CARTAZ);
    expect(saida.miniatura.largura).toBe(LARGURA_DA_MINIATURA);
    // 4:3 ao alto, mantido: a moldura da capa é que enquadra, não isto.
    expect(saida.grande.altura).toBe(1600);
    expect(saida.grande.caminho.endsWith('.webp')).toBe(true);

    const meta = await sharp(saida.grande.bytes).metadata();
    expect(meta.format).toBe('webp');
  });

  /*
   * Crescer uma imagem é inventar píxeis e pesar mais para ficar pior. Dos
   * cartazes municipais, uma parte é servida a 600 de lado.
   */
  it('um cartaz mais pequeno do que a medida não é ampliado', async () => {
    const saida = await derivarCartaz(await cartaz(600, 800), EVENTO, ORIGEM);
    expect(saida.estado).toBe('ok');
    if (saida.estado !== 'ok') return;
    expect(saida.grande.largura).toBe(600);
    expect(saida.miniatura.largura).toBe(LARGURA_DA_MINIATURA);
  });

  it('a cópia pesa uma fracção do original', async () => {
    const original = await cartaz(2400, 3200);
    const saida = await derivarCartaz(original, EVENTO, ORIGEM);
    if (saida.estado !== 'ok') throw new Error('devia ter derivado');
    expect(saida.miniatura.bytes.length).toBeLessThan(saida.grande.bytes.length);
    expect(saida.miniatura.bytes.length).toBeLessThan(50_000);
  });

  /*
   * O reconhecimento antes do descodificador. A `medidasDaImagem` são cem
   * linhas nossas que lêem quatro cabeçalhos; o que elas não reconhecem não
   * chega ao `sharp`, que é a superfície de ataque desta casa toda.
   */
  it('uma página de erro em HTML não chega ao leitor de imagens', async () => {
    const html = new TextEncoder().encode('<!doctype html><title>404 Not Found</title>');
    expect(await derivarCartaz(html, EVENTO, ORIGEM)).toEqual({ estado: 'formato-desconhecido' });
  });

  it('um SVG não é copiado — não tem medidas em píxeis para copiar', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" />');
    expect(await derivarCartaz(svg, EVENTO, ORIGEM)).toEqual({ estado: 'formato-desconhecido' });
  });

  /*
   * O que se recebeu no tecto é o princípio de um ficheiro, não um ficheiro:
   * o `Range` corta a transferência e quem ignora o cabeçalho manda tudo, e
   * este lado corta na mesma. Copiar meia imagem é pior do que não copiar.
   */
  it('o que bate no tecto de bytes não é copiado', async () => {
    const enorme = new Uint8Array(MAXIMO_DE_BYTES_DO_ORIGINAL);
    // Um cabeçalho de PNG verdadeiro à cabeça, para provar que o que trava é
    // o tamanho e não o formato.
    enorme.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(await derivarCartaz(enorme, EVENTO, ORIGEM)).toEqual({ estado: 'grande-demais' });
  });

  it('um ficheiro cortado a meio é recusado sem rebentar', async () => {
    const inteiro = await cartaz(1200, 1600);
    const cortado = inteiro.subarray(0, 200);
    const saida = await derivarCartaz(cortado, EVENTO, ORIGEM);
    expect(saida.estado).toBe('ilegivel');
  });

  /*
   * O EXIF de um cartaz fotografado traz a máquina, a data e às vezes as
   * coordenadas de quem o fotografou. Republicá-las não é nosso, e o `sharp`
   * só as copia a quem lhas pedir — o que aqui não se faz.
   */
  it('a cópia não leva os metadados do original', async () => {
    const comExif = new Uint8Array(
      await sharp({ create: { width: 900, height: 1200, channels: 3, background: '#123456' } })
        .withExif({ IFD0: { Copyright: 'Fotografia de alguém', Artist: 'Alguém' } })
        .jpeg()
        .toBuffer(),
    );
    const saida = await derivarCartaz(comExif, EVENTO, ORIGEM);
    if (saida.estado !== 'ok') throw new Error('devia ter derivado');
    const meta = await sharp(saida.grande.bytes).metadata();
    expect(meta.exif).toBeUndefined();
  });
});
