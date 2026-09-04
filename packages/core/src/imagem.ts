/**
 * As medidas de um cartaz, lidas dos primeiros bytes do ficheiro.
 *
 * A ficha de evento reserva a vitrine do cartaz com uma altura mínima fixa,
 * porque não sabia as medidas de nada: a moldura não tem altura até a imagem
 * chegar, e quem está a ler o título vê-o fugir meio ecrã para baixo a meio da
 * frase. Isso é o Cumulative Layout Shift, e é a única métrica de desempenho
 * desta casa que o utilizador **sente** em vez de medir.
 *
 * A solução é declarar `width` e `height` no `<img>`: o navegador calcula a
 * caixa antes de a imagem existir. Para os declarar é preciso sabê-los, e para
 * os saber basta ler o cabeçalho do ficheiro, sem descarregar a imagem inteira.
 * Contra vinte cartazes verdadeiros de servidores municipais, isto leu as
 * medidas dos quinze que responderam; os outros cinco devolveram 503.
 *
 * **Porque é aqui e não numa biblioteca.** As que existem (`image-size`,
 * `probe-image-size`) trazem dezenas de formatos que uma agenda cultural nunca
 * verá — TIFF, PSD, DDS, ICNS — e, com eles, superfície de análise de ficheiros
 * de terceiros que ninguém desta casa vai auditar. Estes quatro formatos cobrem
 * o que os servidores das câmaras publicam, são cem linhas, e o que não se
 * reconhece devolve `null` em vez de adivinhar.
 *
 * **Nada aqui lança.** Recebe bytes de um servidor alheio, que tanto podem ser
 * um JPEG como uma página de erro em HTML como metade de um ficheiro cortado a
 * meio. Um leitor de cabeçalhos que rebenta com dados malformados é um leitor
 * que deita abaixo a recolha de um concelho por causa de um cartaz.
 */

export interface MedidasDaImagem {
  largura: number;
  altura: number;
}

/**
 * O que se lê e o que não se lê.
 *
 * Quatro formatos: PNG, JPEG, GIF e WebP. São os que saem de um CMS municipal
 * — WordPress, Joomla, os dois portais que a maior parte das câmaras usa. O
 * que fica de fora e podia aparecer um dia: AVIF (raro em CMS, e o cabeçalho
 * obriga a percorrer caixas ISO-BMFF) e SVG (não tem medidas em píxeis; tem um
 * `viewBox`, que é outra coisa). Ambos devolvem `null`, e `null` quer dizer «a
 * página reserva a vitrine como sempre reservou» — nunca um erro.
 */

/**
 * Trinta e dois kilobytes, e o número é medido e não escolhido.
 *
 * Dois kilobytes chegariam para o PNG, o GIF e o WebP, que trazem as medidas
 * nos primeiros trinta bytes. O JPEG é que não: as medidas vivem num segmento
 * «Start Of Frame» que vem **depois** do EXIF, e o EXIF de uma máquina
 * fotográfica leva a miniatura lá dentro.
 *
 * Contra catorze cartazes verdadeiros de servidores municipais: com 2 KB
 * leram-se oito; um do Sardoal precisou de 4 KB, e um de Tomar — 2860×1559,
 * saído de uma câmara — precisou de 32. Com 32 KB leram-se todos os que
 * responderam. Custa 30 KB a mais por cartaz **novo**, uma vez, e só quando o
 * endereço muda; um cartaz relido é um cartaz que não se vai buscar.
 */
export const BYTES_DE_CABECALHO = 32768;

/**
 * Limites de sanidade.
 *
 * Um cabeçalho corrompido consegue declarar 4 mil milhões de píxeis, e esse
 * número ia para a base e daí para um atributo `height` que faz o navegador
 * reservar um quilómetro de página. Um cartaz tem entre dezenas e alguns
 * milhares de píxeis de lado; fora disto, é lixo e trata-se como tal.
 */
const MINIMO = 1;
const MAXIMO = 30_000;

function saoPlausiveis(largura: number, altura: number): boolean {
  return (
    Number.isInteger(largura) &&
    Number.isInteger(altura) &&
    largura >= MINIMO &&
    altura >= MINIMO &&
    largura <= MAXIMO &&
    altura <= MAXIMO
  );
}

function comeca(bytes: Uint8Array, assinatura: readonly number[], desvio = 0): boolean {
  if (bytes.length < desvio + assinatura.length) return false;
  return assinatura.every((byte, indice) => bytes[desvio + indice] === byte);
}

function texto(bytes: Uint8Array, desvio: number, tamanho: number): string {
  let resultado = '';
  for (let i = desvio; i < desvio + tamanho && i < bytes.length; i += 1) {
    resultado += String.fromCharCode(bytes[i] as number);
  }
  return resultado;
}

function uint16BE(bytes: Uint8Array, desvio: number): number {
  return ((bytes[desvio] as number) << 8) | (bytes[desvio + 1] as number);
}

function uint16LE(bytes: Uint8Array, desvio: number): number {
  return (bytes[desvio] as number) | ((bytes[desvio + 1] as number) << 8);
}

function uint24LE(bytes: Uint8Array, desvio: number): number {
  return (
    (bytes[desvio] as number) |
    ((bytes[desvio + 1] as number) << 8) |
    ((bytes[desvio + 2] as number) << 16)
  );
}

/** `>>> 0` porque um PNG de mais de 2^31 píxeis daria negativo com `|`. */
function uint32BE(bytes: Uint8Array, desvio: number): number {
  return (
    (((bytes[desvio] as number) << 24) |
      ((bytes[desvio + 1] as number) << 16) |
      ((bytes[desvio + 2] as number) << 8) |
      (bytes[desvio + 3] as number)) >>>
    0
  );
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** O IHDR é sempre o primeiro chunk, e a norma obriga-o a isso. */
function medidasPng(bytes: Uint8Array): MedidasDaImagem | null {
  if (!comeca(bytes, PNG) || bytes.length < 24) return null;
  if (texto(bytes, 12, 4) !== 'IHDR') return null;
  return { largura: uint32BE(bytes, 16), altura: uint32BE(bytes, 20) };
}

function medidasGif(bytes: Uint8Array): MedidasDaImagem | null {
  const cabecalho = texto(bytes, 0, 6);
  if (cabecalho !== 'GIF87a' && cabecalho !== 'GIF89a') return null;
  if (bytes.length < 10) return null;
  // Little-endian, e é o único destes formatos que o é.
  return { largura: uint16LE(bytes, 6), altura: uint16LE(bytes, 8) };
}

/**
 * JPEG: percorrer segmentos até ao que declara o tamanho da imagem.
 *
 * Um JPEG não tem as medidas num sítio fixo. Começa em `FFD8` e segue-se uma
 * cadeia de segmentos `FF<marca><tamanho de 16 bits>`; as medidas estão no
 * segmento «Start Of Frame», que pode ser qualquer um de uma dúzia de marcas
 * conforme a compressão. Antes dele costuma vir o EXIF, que pode ter dezenas de
 * kilobytes de miniatura — e é por isso que `BYTES_DE_CABECALHO` são trinta e
 * dois e não dois. Se mesmo assim o SOF não couber, `null`, e a página reserva
 * a vitrine como sempre fez.
 */
function medidasJpeg(bytes: Uint8Array): MedidasDaImagem | null {
  if (!comeca(bytes, [0xff, 0xd8])) return null;

  let posicao = 2;
  while (posicao + 9 < bytes.length) {
    // Os segmentos são separados por `FF`; um `FF` a mais é enchimento.
    if (bytes[posicao] !== 0xff) {
      posicao += 1;
      continue;
    }
    const marca = bytes[posicao + 1] as number;
    if (marca === 0xff) {
      posicao += 1;
      continue;
    }

    /*
     * As marcas SOF que trazem medidas: C0–CF, menos C4 (tabelas de Huffman),
     * C8 (extensão da JPEG original, que ninguém usa) e CC (tabelas
     * aritméticas). As três excepções são segmentos vulgares nesta gama e ler
     * o tamanho delas como se fossem medidas dava números fabricados.
     */
    const eSof =
      marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc;
    if (eSof) {
      // Altura antes da largura, ao contrário de toda a gente.
      return { altura: uint16BE(bytes, posicao + 5), largura: uint16BE(bytes, posicao + 7) };
    }

    // `SOS` (DA) é o início dos dados comprimidos: daí para a frente não há
    // segmentos para percorrer, e continuar era ler píxeis como se fossem
    // cabeçalhos.
    if (marca === 0xda) return null;

    const tamanho = uint16BE(bytes, posicao + 2);
    // Um segmento tem de ter pelo menos os dois bytes do próprio tamanho. Sem
    // esta guarda, um ficheiro corrompido com `tamanho` a zero prendia o ciclo.
    if (tamanho < 2) return null;
    posicao += 2 + tamanho;
  }
  return null;
}

/**
 * WebP: três variantes, e a que interessa está na quarta letra do chunk.
 *
 * `VP8 ` é com perdas, `VP8L` é sem perdas, `VP8X` é o contentor com extensões
 * (animação, transparência). Guardam as medidas em três sítios e três
 * codificações diferentes — as duas primeiras até com um menos um por cima.
 */
function medidasWebp(bytes: Uint8Array): MedidasDaImagem | null {
  if (texto(bytes, 0, 4) !== 'RIFF' || texto(bytes, 8, 4) !== 'WEBP') return null;
  const variante = texto(bytes, 12, 4);

  if (variante === 'VP8 ') {
    if (bytes.length < 30) return null;
    // Os 14 bits de baixo; os 2 de cima são a escala, que aqui não interessa.
    return { largura: uint16LE(bytes, 26) & 0x3fff, altura: uint16LE(bytes, 28) & 0x3fff };
  }

  if (variante === 'VP8L') {
    if (bytes.length < 25) return null;
    // Catorze bits cada, empacotados em quatro bytes, e menos um cada.
    const empacotado =
      (bytes[21] as number) |
      ((bytes[22] as number) << 8) |
      ((bytes[23] as number) << 16) |
      ((bytes[24] as number) << 24);
    return {
      largura: (empacotado & 0x3fff) + 1,
      altura: ((empacotado >>> 14) & 0x3fff) + 1,
    };
  }

  if (variante === 'VP8X') {
    if (bytes.length < 30) return null;
    // Vinte e quatro bits cada, little-endian, e menos um cada.
    return { largura: uint24LE(bytes, 24) + 1, altura: uint24LE(bytes, 27) + 1 };
  }

  return null;
}

/**
 * As medidas de uma imagem, ou `null` quando não se sabem.
 *
 * `null` não é uma falha: é a resposta honesta para um formato que não se lê,
 * para um cabeçalho que não coube nos bytes recebidos, e para um servidor que
 * respondeu com uma página de erro em vez de uma imagem. Quem chama trata os
 * três da mesma maneira, que é continuar sem medidas — e a página reserva a
 * vitrine como sempre reservou.
 */
export function medidasDaImagem(bytes: Uint8Array): MedidasDaImagem | null {
  const medidas =
    medidasPng(bytes) ?? medidasGif(bytes) ?? medidasWebp(bytes) ?? medidasJpeg(bytes);
  if (!medidas) return null;
  return saoPlausiveis(medidas.largura, medidas.altura) ? medidas : null;
}
