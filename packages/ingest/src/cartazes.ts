import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  LARGURA_DA_MINIATURA,
  LARGURA_DO_CARTAZ,
  MAXIMO_DE_BYTES_DO_ORIGINAL,
  QUALIDADE_DA_MINIATURA,
  QUALIDADE_DO_CARTAZ,
  medidasDaImagem,
  pastaDoCartaz,
} from '@coreto/core';

/**
 * De um cartaz alheio para dois ficheiros nossos.
 *
 * O **quando** está em `@coreto/core` (`decidirCartaz`), que é pura. O **onde
 * se escreve** está em `db.ts`, com o resto do que fala com o Supabase. Aqui
 * fica o meio: os bytes que vieram da rede, o que se recusa a decompor, e as
 * duas derivadas que saem.
 *
 * **O redimensionamento é na recolha e nunca a pedir.** O Supabase serve
 * transformações de imagem a pedido, e a conta Pro traz cem por mês — depois
 * são cinco dólares por cada mil. Um sítio público com uma lista de cartazes
 * passa as cem numa tarde, e a conta não avisa: cresce. Duas passagens por
 * `sharp` uma vez por cartaz novo, numa máquina do GitHub que já está a
 * correr, deixam no balde ficheiros estáticos que a cache serve.
 */

/**
 * O que se recusa, e nada disto é uma avaria.
 *
 * Em qualquer destes casos a ficha continua a apontar para a origem, que é
 * exactamente o que fazia antes de isto existir.
 */
export type DerivacaoDoCartaz =
  | ({ estado: 'ok' } & DerivadasDoCartaz)
  /** Veio mais do que o tecto, e o que se recebeu é o princípio de um ficheiro. */
  | { estado: 'grande-demais' }
  /** Uma página de erro em HTML com nome de `.jpg`, um SVG, um AVIF. */
  | { estado: 'formato-desconhecido' }
  /** O `sharp` recusou: truncado, corrompido, ou grande de mais a descomprimir. */
  | { estado: 'ilegivel'; razao: string };

/** As duas medidas de um cartaz, prontas a escrever. Nunca uma sem a outra. */
export interface DerivadasDoCartaz {
  grande: DerivadaDoCartaz;
  miniatura: DerivadaDoCartaz;
}

export interface DerivadaDoCartaz {
  caminho: string;
  bytes: Uint8Array;
  largura: number;
  altura: number;
}

/**
 * O nome do ficheiro traz o resumo do endereço de origem.
 *
 * **É o que faz uma cache de um ano ser segura.** Um cartaz substituído no
 * servidor da câmara chega aqui com outro endereço — é assim que os gestores
 * de conteúdos municipais fazem, um ficheiro novo por cada carregamento — e um
 * endereço diferente dá um nome diferente. Ninguém tem de invalidar nada, e
 * ninguém vê o cartaz do mês passado por causa de um cabeçalho.
 *
 * Doze caracteres de SHA-256 chegam de sobra dentro de uma pasta que tem um
 * evento só: o que se lhes pede é distinguir dois endereços do mesmo evento,
 * não resistir a quem procure uma colisão.
 */
export function nomeDoCartaz(eventId: string, origem: string, largura: number): string {
  const resumo = createHash('sha256').update(origem).digest('hex').slice(0, 12);
  return `${pastaDoCartaz(eventId)}/${resumo}-${largura}.webp`;
}

async function derivar(
  original: Uint8Array,
  caminho: string,
  largura: number,
  qualidade: number,
): Promise<DerivadaDoCartaz> {
  const saida = await sharp(original, {
    // Um cartaz mal formado não é um erro da recolha: `failOn: 'error'` recusa
    // o ficheiro em vez de adivinhar o que lhe falta. E o tecto de píxeis é
    // contra a imagem de mil megapíxeis que cabe em quarenta kilobytes
    // comprimidos e gasta gigabytes a descomprimir — a descompressão é que é a
    // arma, não o ficheiro.
    failOn: 'error',
    limitInputPixels: 100_000_000,
  })
    // Sem argumentos, aplica a orientação do EXIF. Um cartaz fotografado de
    // lado chega deitado a quem o vê se isto não estiver aqui.
    .rotate()
    // Um cartaz mais pequeno do que a medida não é ampliado: crescer uma
    // imagem é inventar píxeis e pesar mais para ficar pior.
    .resize({ width: largura, withoutEnlargement: true })
    // O `sharp` só copia os metadados se lhe pedirem, e não se lhe pede: o
    // EXIF de um cartaz fotografado traz a máquina, a data e às vezes as
    // coordenadas de quem o fotografou. Republicá-las não é nosso.
    .webp({ quality: qualidade })
    .toBuffer({ resolveWithObject: true });

  return {
    caminho,
    bytes: saida.data,
    largura: saida.info.width,
    altura: saida.info.height,
  };
}

/**
 * As duas derivadas de um cartaz, ou a razão por que não as há.
 *
 * **O reconhecimento antes do descodificador é deliberado.** O que se recebeu
 * é o que o servidor de outra pessoa quis mandar, e o descodificador nativo é
 * a superfície de ataque desta casa toda. A `medidasDaImagem` são cem linhas
 * nossas que reconhecem quatro formatos pelo cabeçalho; o que ela não
 * reconhece não chega ao `sharp`. Custa os cartazes em AVIF e em SVG, que
 * continuam a ser servidos da origem, e é um preço que se paga de boa vontade.
 *
 * Nunca lança.
 */
export async function derivarCartaz(
  original: Uint8Array,
  eventId: string,
  origem: string,
): Promise<DerivacaoDoCartaz> {
  if (original.length >= MAXIMO_DE_BYTES_DO_ORIGINAL) return { estado: 'grande-demais' };
  if (!medidasDaImagem(original)) return { estado: 'formato-desconhecido' };

  try {
    const [grande, miniatura] = await Promise.all([
      derivar(
        original,
        nomeDoCartaz(eventId, origem, LARGURA_DO_CARTAZ),
        LARGURA_DO_CARTAZ,
        QUALIDADE_DO_CARTAZ,
      ),
      derivar(
        original,
        nomeDoCartaz(eventId, origem, LARGURA_DA_MINIATURA),
        LARGURA_DA_MINIATURA,
        QUALIDADE_DA_MINIATURA,
      ),
    ]);
    return { estado: 'ok', grande, miniatura };
  } catch (erro) {
    return { estado: 'ilegivel', razao: erro instanceof Error ? erro.message : String(erro) };
  }
}
