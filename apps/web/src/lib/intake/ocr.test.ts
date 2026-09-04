import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  IMAGE_REASON,
  PDF_LOCKED_REASON,
  PDF_UNREADABLE_REASON,
  extractPdfText,
  looksLikeProse,
  readAttachmentText,
} from './ocr';

/**
 * Os PDFs são montados à mão, byte a byte.
 *
 * É de propósito: um ficheiro gerado por uma biblioteca testaria a biblioteca.
 * O que aqui interessa é a estrutura mínima que um PDF tem — objeto,
 * dicionário, `stream`/`endstream` — e o que o leitor faz com ela.
 */
function pdfObject(body: Buffer, dictionary: string): Buffer {
  return Buffer.concat([
    Buffer.from(`1 0 obj\n<< /Length ${body.length}${dictionary} >>\nstream\n`, 'latin1'),
    body,
    Buffer.from('\nendstream\nendobj\n', 'latin1'),
  ]);
}

function pdfWith(content: string, options: { compress?: boolean } = {}): Uint8Array {
  const raw = Buffer.from(content, 'latin1');
  const body = options.compress ? deflateSync(raw) : raw;
  const dictionary = options.compress ? ' /Filter /FlateDecode' : '';
  return Uint8Array.from(
    Buffer.concat([
      Buffer.from('%PDF-1.4\n', 'latin1'),
      pdfObject(body, dictionary),
      Buffer.from('%%EOF\n', 'latin1'),
    ]),
  );
}

const CARTAZ = [
  'BT',
  '/F1 18 Tf',
  '72 720 Td',
  '(Concerto de Ano Novo pela Banda Filarm\\363nica) Tj',
  '0 -22 Td',
  '(Dia 1 de janeiro de 2027, \\340s 21h30, no Cine-Teatro Para\\355so) Tj',
  '0 -22 Td',
  '(Entrada livre para todas as idades) Tj',
  'ET',
].join('\n');

describe('texto embutido de um PDF', () => {
  it('lê uma stream de conteúdo sem compressão', () => {
    const text = extractPdfText(pdfWith(CARTAZ));
    expect(text).toContain('Concerto de Ano Novo pela Banda Filarmónica');
    expect(text).toContain('Dia 1 de janeiro de 2027, às 21h30');
  });

  it('lê a mesma coisa quando a stream vem comprimida', () => {
    expect(extractPdfText(pdfWith(CARTAZ, { compress: true }))).toBe(
      extractPdfText(pdfWith(CARTAZ)),
    );
  });

  it('separa as linhas onde o PDF muda de linha', () => {
    const text = extractPdfText(pdfWith(CARTAZ)) ?? '';
    expect(text.split('\n').filter((line) => line.trim().length > 0)).toHaveLength(3);
  });

  it('lê um recuo grande de TJ como espaço entre palavras', () => {
    const content = 'BT /F1 12 Tf 72 720 Td [(Banda) -320 (Filarm\\363nica)] TJ ET';
    expect(extractPdfText(pdfWith(content))).toContain('Banda Filarmónica');
  });

  it('não inventa um espaço num recuo pequeno, que é só cerrar as letras', () => {
    const content = 'BT /F1 12 Tf 72 720 Td [(Concer) -20 (to)] TJ ET';
    expect(extractPdfText(pdfWith(content))).toContain('Concerto');
  });

  it('entende os escapes de uma cadeia', () => {
    const content = 'BT /F1 12 Tf 72 720 Td (Teatro \\(sala 2\\) \\055 21h00) Tj ET';
    expect(extractPdfText(pdfWith(content))?.trim()).toBe('Teatro (sala 2) - 21h00');
  });

  it('entende uma cadeia em hexadecimal', () => {
    const content = 'BT /F1 12 Tf 72 720 Td <54656174726F> Tj ET';
    expect(extractPdfText(pdfWith(content))?.trim()).toBe('Teatro');
  });

  it('não tenta abrir um PDF cifrado', () => {
    const cifrado = Buffer.concat([
      Buffer.from(pdfWith(CARTAZ)),
      Buffer.from('trailer\n<< /Encrypt 9 0 R >>\n', 'latin1'),
    ]);
    expect(extractPdfText(Uint8Array.from(cifrado))).toBe(null);
  });

  it('devolve null quando nenhuma stream é de um formato que saiba abrir', () => {
    const imagem = Uint8Array.from(
      Buffer.concat([
        Buffer.from('%PDF-1.4\n', 'latin1'),
        pdfObject(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), ' /Filter /DCTDecode'),
        Buffer.from('%%EOF\n', 'latin1'),
      ]),
    );
    expect(extractPdfText(imagem)).toBe(null);
  });

  it('lê o texto de um PDF que também traz uma imagem', () => {
    const misto = Uint8Array.from(
      Buffer.concat([
        Buffer.from('%PDF-1.4\n', 'latin1'),
        pdfObject(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), ' /Filter /DCTDecode'),
        pdfObject(Buffer.from(CARTAZ, 'latin1'), ''),
        Buffer.from('%%EOF\n', 'latin1'),
      ]),
    );
    expect(extractPdfText(misto)).toContain('Banda Filarmónica');
  });
});

describe('a porta que separa texto de lixo com ar de texto', () => {
  it('aceita um anúncio escrito em português', () => {
    expect(
      looksLikeProse('Concerto de Ano Novo, dia 1 de janeiro de 2027, às 21h30, entrada livre.'),
    ).toBe(true);
  });

  it('recusa o que sai de fontes que numeram os glifos', () => {
    expect(looksLikeProse('Frqfhuwr gh Dqr Qryr, gld 1 gh mdqhlur gh 2027, hqwudgd olyuh.')).toBe(
      false,
    );
  });

  it('recusa códigos de dois bytes lidos como caracteres', () => {
    const cid = Array.from({ length: 60 }, (_, index) =>
      String.fromCharCode(0, 3 + (index % 40)),
    ).join('');
    expect(looksLikeProse(cid)).toBe(false);
  });

  it('recusa um punhado de palavras soltas', () => {
    expect(looksLikeProse('Programa 2027 Cultura Municipal')).toBe(false);
  });
});

describe('leitura de um anexo', () => {
  it('devolve o texto de um PDF que o tenha', () => {
    const outcome = readAttachmentText({ kind: 'pdf', bytes: pdfWith(CARTAZ) });
    expect(outcome.status).toBe('ok');
    expect(outcome.status === 'ok' && outcome.text).toContain('Banda Filarmónica');
  });

  it('não devolve texto de um PDF cujos códigos não são caracteres', () => {
    const ilegivel = pdfWith('BT /F1 12 Tf 72 720 Td (Frqfhuwr gh Dqr Qryr) Tj ET');
    const outcome = readAttachmentText({ kind: 'pdf', bytes: ilegivel });
    expect(outcome).toEqual({ status: 'skipped', reason: PDF_UNREADABLE_REASON });
  });

  it('diz que o PDF está fechado quando não se consegue abrir nenhuma stream', () => {
    const imagem = Uint8Array.from(
      Buffer.concat([
        Buffer.from('%PDF-1.4\n', 'latin1'),
        pdfObject(Buffer.from([0xff, 0xd8, 0xff]), ' /Filter /DCTDecode'),
      ]),
    );
    expect(readAttachmentText({ kind: 'pdf', bytes: imagem })).toEqual({
      status: 'skipped',
      reason: PDF_LOCKED_REASON,
    });
  });

  it('deixa um cartaz em imagem para leitura humana, e diz porquê', () => {
    const outcome = readAttachmentText({
      kind: 'image',
      bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]),
    });
    expect(outcome).toEqual({ status: 'skipped', reason: IMAGE_REASON });
    expect(IMAGE_REASON).toContain('OCR');
  });
});
