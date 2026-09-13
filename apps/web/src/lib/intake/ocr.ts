import { inflateRawSync, inflateSync } from 'node:zlib';
import type { AttachmentKind } from './attachments';

/**
 * Texto a partir dos anexos.
 *
 * Aqui o perigo não é falhar — é acertar por engano. O que sair deste módulo
 * vai direito para a extração, e da extração sai um evento que uma pessoa vai
 * rever à pressa. Um leitor que devolve lixo com ar de texto produz um evento
 * inventado com data inventada, e a agenda passa a mandar alguém a uma porta
 * fechada. Por isso:
 *
 * - **PDF**: lê-se o texto que lá esteja **embutido**, sem dependências novas
 *   (`node:zlib` já vem com o Node) e sem adivinhar. Um PDF cifrado, com
 *   filtros que não se leem aqui, ou com fontes cujos códigos não são
 *   caracteres — o caso normal de um cartaz feito num programa de paginação —
 *   não dá texto nenhum. Nesse caso não se inventa: fica `skipped` com o
 *   motivo, o ficheiro fica guardado e alguém o lê.
 * - **Imagem**: não há serviço de OCR. Fica `skipped`, e o cartaz fica no
 *   balde privado à espera de olhos. Encaminhá-lo para a extração seria o
 *   caminho — a API que ela usa aceita blocos de imagem em base64 — mas o
 *   contrato de `extractEvent` é de texto, e não se reescreve por aqui.
 *
 * Tudo o que sai daqui passou pela porta de `looksLikeProse`: o que não se
 * parece com língua escrita não sai.
 */

export type OcrOutcome = { status: 'ok'; text: string } | { status: 'skipped'; reason: string };

/** Tecto do que se guarda por anexo. A extração corta bem antes disto. */
export const MAX_OCR_TEXT_CHARS = 20_000;

/** Tecto do que se descomprime, para um anexo pequeno não rebentar a memória. */
const MAX_DECODED_STREAM_BYTES = 8 * 1024 * 1024;

/** Num recuo de `TJ`, isto (em milésimos de em) já é um espaço entre palavras. */
const WORD_GAP_THOUSANDTHS = 100;

export const IMAGE_REASON =
  'cartaz por ler: não há serviço de OCR configurado — fica guardado para leitura humana';

export const PDF_UNREADABLE_REASON =
  'PDF sem texto embutido legível (digitalizado, ou com fontes sem mapa de caracteres) — fica guardado para leitura humana';

export const PDF_LOCKED_REASON =
  'PDF cifrado ou codificado de maneira que não se lê aqui — fica guardado para leitura humana';

export interface ReadableAttachment {
  kind: AttachmentKind;
  bytes: Uint8Array;
}

export function readAttachmentText(attachment: ReadableAttachment): OcrOutcome {
  if (attachment.kind === 'image') return { status: 'skipped', reason: IMAGE_REASON };
  if (attachment.kind !== 'pdf') return { status: 'skipped', reason: 'tipo sem leitor de texto' };

  const raw = extractPdfText(attachment.bytes);
  if (raw === null) return { status: 'skipped', reason: PDF_LOCKED_REASON };

  const text = tidy(raw);
  if (!looksLikeProse(text)) return { status: 'skipped', reason: PDF_UNREADABLE_REASON };

  return { status: 'ok', text: text.slice(0, MAX_OCR_TEXT_CHARS) };
}

/**
 * O texto embutido de um PDF, ou `null` quando o ficheiro não se deixa abrir.
 *
 * `null` e cadeia vazia querem dizer coisas diferentes: `null` é «não dá para
 * tentar» (cifrado, filtros por implementar), vazio é «tentou-se e não havia
 * texto». Os dois acabam em `skipped`, com motivos diferentes.
 */
export function extractPdfText(bytes: Uint8Array): string | null {
  // `latin1` porque é a única codificação em que um byte é um caractere: o
  // ficheiro é binário e o que se quer é percorrê-lo byte a byte com as
  // ferramentas de cadeias.
  const file = Buffer.from(bytes).toString('latin1');

  // Um PDF cifrado dá streams que descomprimem para ruído. Melhor não tentar.
  if (/\/Encrypt\b/.test(file)) return null;

  const pieces: string[] = [];
  let total = 0;
  let attempted = 0;
  let opened = 0;

  // A palavra-chave `stream` vem sempre seguida de uma quebra de linha e nunca
  // precedida de uma letra — é o que a distingue de `endstream`.
  const streamStart = /(?<![A-Za-z])stream(?:\r\n|\n|\r)/g;
  let match: RegExpExecArray | null = streamStart.exec(file);

  while (match !== null && total < MAX_OCR_TEXT_CHARS) {
    const bodyStart = match.index + match[0].length;
    const bodyEnd = file.indexOf('endstream', bodyStart);
    if (bodyEnd === -1) break;
    streamStart.lastIndex = bodyEnd;

    const dictionaryStart = file.lastIndexOf('obj', match.index);
    const dictionary = dictionaryStart === -1 ? '' : file.slice(dictionaryStart, match.index);

    attempted += 1;
    const content = decodeStream(file.slice(bodyStart, bodyEnd), dictionary);
    if (content !== null) {
      opened += 1;
      const text = textFromContentStream(content);
      if (text.length > 0) {
        pieces.push(text);
        total += text.length;
      }
    }

    match = streamStart.exec(file);
  }

  // Havia streams e nenhuma se conseguiu abrir: é um ficheiro que este leitor
  // não sabe ler, e não um ficheiro sem texto.
  if (attempted > 0 && opened === 0) return null;

  return pieces.join('\n');
}

/**
 * Abre uma stream, quando é uma das que aqui se sabem ler.
 *
 * Só o que é seguro: sem filtro nenhum, ou `FlateDecode` sozinho. Tudo o
 * resto — imagens, LZW, ASCII85, os preditores dos xref — devolve `null`, que
 * é a maneira honesta de dizer «isto não é para aqui».
 */
function decodeStream(body: string, dictionary: string): string | null {
  const filterMatch = /\/Filter\s*(\/[A-Za-z0-9]+|\[[^\]]*\])/.exec(dictionary);
  const filter = filterMatch?.[1] ?? '';

  if (/\/Predictor\b/.test(dictionary)) return null;
  if (filter.length > 0 && !/^\[?\s*\/FlateDecode\s*\]?$/.test(filter)) return null;

  // O corpo pode trazer a quebra de linha que antecede `endstream`.
  const trimmed = body.replace(/[\r\n]+$/, '');
  if (trimmed.length === 0) return null;

  if (filter.length === 0) {
    // Sem filtro, só interessa se for mesmo uma stream de conteúdo — assim
    // não se percorrem os bytes de uma imagem à procura de letras.
    return /\bBT\b/.test(trimmed) ? trimmed : null;
  }

  const raw = Buffer.from(trimmed, 'latin1');
  for (const inflate of [inflateSync, inflateRawSync]) {
    try {
      return inflate(raw, { maxOutputLength: MAX_DECODED_STREAM_BYTES }).toString('latin1');
    } catch {
      // Tenta o formato seguinte: alguns produtores escrevem deflate cru.
    }
  }
  return null;
}

/**
 * Os operadores de texto de uma stream de conteúdo, por ordem.
 *
 * Não é um interpretador: é um leitor dos operadores que mostram texto (`Tj`,
 * `TJ`, `'`, `"`) e dos que mudam de linha (`Td`, `TD`, `T*`, `Tm`). O
 * espaçamento entre palavras vem dos recuos do `TJ` e da componente vertical
 * dos posicionamentos — é a heurística mínima que separa «Bandada
 * Filarmónica» de «Banda da Filarmónica».
 */
function textFromContentStream(content: string): string {
  // Sem um bloco de texto não há nada a ler.
  if (!/\bBT\b/.test(content)) return '';

  let out = '';
  let operands: number[] = [];
  let lastY: number | null = null;
  let lastTextAt: number | null = null;
  let arrayDepth = 0;
  let index = 0;

  const breakLine = (): void => {
    if (out.length > 0 && !out.endsWith('\n')) out += '\n';
  };
  const gap = (): void => {
    if (out.length > 0 && !/\s$/.test(out)) out += ' ';
  };

  while (index < content.length && out.length < MAX_OCR_TEXT_CHARS) {
    const char = content[index] as string;

    if (char === '%') {
      while (index < content.length && content[index] !== '\n') index += 1;
      continue;
    }

    if (char === '(') {
      const read = readLiteralString(content, index);
      lastTextAt = out.length;
      out += read.value;
      index = read.next;
      continue;
    }

    if (char === '<') {
      if (content[index + 1] === '<') {
        index += 2;
        continue;
      }
      const read = readHexString(content, index);
      lastTextAt = out.length;
      out += read.value;
      index = read.next;
      continue;
    }

    if (char === '[') {
      arrayDepth += 1;
      index += 1;
      continue;
    }
    if (char === ']') {
      arrayDepth = Math.max(0, arrayDepth - 1);
      index += 1;
      continue;
    }

    if (char === '-' || char === '+' || char === '.' || (char >= '0' && char <= '9')) {
      const read = readNumber(content, index);
      if (read.next === index) {
        index += 1;
        continue;
      }
      if (arrayDepth > 0 && read.value <= -WORD_GAP_THOUSANDTHS) gap();
      operands.push(read.value);
      index = read.next;
      continue;
    }

    if (/[A-Za-z'"*]/.test(char)) {
      const start = index;
      while (index < content.length && /[A-Za-z0-9'"*]/.test(content[index] as string)) {
        index += 1;
      }

      switch (content.slice(start, index)) {
        case 'BT':
          lastY = null;
          breakLine();
          break;
        case 'ET':
          breakLine();
          break;
        case 'Td':
        case 'TD':
          if ((operands[1] ?? 0) === 0) gap();
          else breakLine();
          break;
        case 'T*':
          breakLine();
          break;
        case 'Tm': {
          const y = operands[5] ?? null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) < 0.01) gap();
          else breakLine();
          lastY = y;
          break;
        }
        case "'":
        case '"':
          // Estes mostram o texto **depois** de mudar de linha, e a cadeia já
          // foi lida: a quebra entra onde ela começou.
          if (lastTextAt !== null) {
            out = `${out.slice(0, lastTextAt)}\n${out.slice(lastTextAt)}`;
          }
          break;
        default:
          break;
      }

      operands = [];
      continue;
    }

    index += 1;
  }

  return out;
}

interface Read<T> {
  value: T;
  next: number;
}

/** Uma cadeia entre parênteses, com escapes e parênteses encaixados. */
function readLiteralString(content: string, start: number): Read<string> {
  let depth = 0;
  let out = '';
  let index = start;

  for (; index < content.length; index += 1) {
    const char = content[index] as string;

    if (char === '\\') {
      const escaped = content[index + 1];
      index += 1;
      if (escaped === undefined) break;
      switch (escaped) {
        case 'n':
          out += '\n';
          break;
        case 'r':
          out += '\r';
          break;
        case 't':
          out += '\t';
          break;
        case 'b':
        case 'f':
          out += ' ';
          break;
        case '\n':
          break;
        case '\r':
          if (content[index + 1] === '\n') index += 1;
          break;
        default:
          if (escaped >= '0' && escaped <= '7') {
            let octal = escaped;
            while (octal.length < 3) {
              const next = content[index + 1] ?? '';
              if (next < '0' || next > '7') break;
              octal += next;
              index += 1;
            }
            out += decodeByte(Number.parseInt(octal, 8));
          } else {
            out += escaped;
          }
      }
      continue;
    }

    if (char === '(') {
      if (depth > 0) out += char;
      depth += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        index += 1;
        break;
      }
      out += char;
      continue;
    }

    out += decodeByte(char.charCodeAt(0));
  }

  return { value: out, next: index };
}

/** Uma cadeia em hexadecimal, `<48656c6c6f>`. */
function readHexString(content: string, start: number): Read<string> {
  const end = content.indexOf('>', start);
  if (end === -1) return { value: '', next: content.length };

  const digits = content.slice(start + 1, end).replace(/[^0-9A-Fa-f]/g, '');
  const padded = digits.length % 2 === 0 ? digits : `${digits}0`;

  let out = '';
  for (let index = 0; index + 1 < padded.length; index += 2) {
    out += decodeByte(Number.parseInt(padded.slice(index, index + 2), 16));
  }
  return { value: out, next: end + 1 };
}

function readNumber(content: string, start: number): Read<number> {
  const match = /^[-+]?\d*\.?\d+/.exec(content.slice(start, start + 32));
  if (!match) return { value: 0, next: start };
  return { value: Number(match[0]), next: start + match[0].length };
}

/**
 * Os poucos códigos em que a codificação normal dos PDFs difere do Latin-1.
 *
 * São os que mais aparecem numa folha de programação portuguesa: o travessão
 * dos intervalos de datas, as aspas curvas e o apóstrofo.
 */
const WIN_ANSI_HIGH: Readonly<Record<number, string>> = {
  0x80: '€',
  0x82: '‚',
  0x83: 'ƒ',
  0x84: '„',
  0x85: '…',
  0x86: '†',
  0x87: '‡',
  0x88: 'ˆ',
  0x89: '‰',
  0x8a: 'Š',
  0x8b: '‹',
  0x8c: 'Œ',
  0x8e: 'Ž',
  0x91: '‘',
  0x92: '’',
  0x93: '“',
  0x94: '”',
  0x95: '•',
  0x96: '–',
  0x97: '—',
  0x98: '˜',
  0x99: '™',
  0x9a: 'š',
  0x9b: '›',
  0x9c: 'œ',
  0x9e: 'ž',
  0x9f: 'Ÿ',
};

function decodeByte(code: number): string {
  return WIN_ANSI_HIGH[code] ?? String.fromCharCode(code);
}

/** Espaços a sério, sem caracteres de controlo e sem linhas vazias a mais. */
function tidy(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const MIN_PROSE_CHARS = 40;
const MIN_PROSE_WORDS = 8;
const MIN_PROSE_MARKERS = 2;

/**
 * Palavras que uma folha de programação portuguesa tem de ter.
 *
 * São palavras de ligação e de calendário — as que aparecem em qualquer
 * anúncio de qualquer evento e que nenhuma sequência de códigos de glifos
 * produz por acaso. É esta lista que distingue «Concerto de Ano Novo, dia 1 de
 * janeiro» de «Frqfhuwr gh Dqr Qryr», que é o que sai de um PDF cujas fontes
 * numeram os glifos por ordem de aparecimento.
 */
const PORTUGUESE_MARKERS: ReadonlySet<string> = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'ao',
  'aos',
  'com',
  'para',
  'por',
  'pelo',
  'pela',
  'um',
  'uma',
  'que',
  'se',
  'sobre',
  'entre',
  'ate',
  'dia',
  'dias',
  'hora',
  'horas',
  'sabado',
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
  'entrada',
  'bilhete',
  'bilhetes',
  'evento',
  'concerto',
  'teatro',
  'exposicao',
  'festa',
  'municipio',
  'camara',
]);

/**
 * A porta que separa texto de lixo com ar de texto.
 *
 * Sem isto, este módulo seria exatamente aquilo que não pode ser: um leitor de
 * PDFs a fingir que funciona. Um ficheiro cujos códigos não são caracteres
 * chega aqui e é recusado, e a submissão fica com o motivo escrito em vez de
 * com um evento inventado.
 */
export function looksLikeProse(text: string): boolean {
  if (text.length < MIN_PROSE_CHARS) return false;

  const readable = text.replace(/[^\p{Letter}\p{Number}\s.,;:!?()\-'"«»/€%&@+–—‘’“”]/gu, '');
  if (readable.length / text.length < 0.9) return false;

  const words = fold(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
  if (words.length < MIN_PROSE_WORDS) return false;

  const markers = new Set(words.filter((word) => PORTUGUESE_MARKERS.has(word)));
  return markers.size >= MIN_PROSE_MARKERS;
}

/** Minúsculas sem acentos. */
function fold(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
