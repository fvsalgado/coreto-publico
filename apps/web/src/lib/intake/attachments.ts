/**
 * Anexos: cartazes e PDFs de agenda.
 *
 * Duas regras que não se negoceiam:
 *
 * 1. **O tipo é o que o ficheiro é, não o que o remetente diz que é.** O
 *    `Content-Type` de um email é escrito por quem o envia. Um executável com
 *    um cabeçalho a dizer `image/jpeg` seria guardado sem sobrolho franzido se
 *    acreditássemos nele.
 * 2. **Nada disto é servido do domínio principal.** Vai para um balde privado,
 *    e só é visto por quem modera, através de um endereço assinado de curta
 *    duração. Um cartaz enviado por email não é conteúdo público antes de
 *    alguém o aprovar.
 */

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type DetectedType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

export type AttachmentKind = 'pdf' | 'image' | 'other';

/**
 * Descobre o tipo real pela assinatura do ficheiro.
 *
 * Devolve `null` para tudo o que não esteja na lista — e o que não está na
 * lista é descartado, não guardado «por via das dúvidas».
 */
export function detectType(bytes: Uint8Array): DetectedType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf'; // %PDF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // RIFF....WEBP
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return 'image/webp';
  }
  return null;
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, index) => bytes[index] === byte);
}

export function kindOf(type: DetectedType): AttachmentKind {
  return type === 'application/pdf' ? 'pdf' : 'image';
}

/**
 * Nome de ficheiro seguro para um caminho de armazenamento.
 *
 * Sem barras, sem `..`, sem caracteres de controlo, sem nome vazio. Um nome de
 * ficheiro é entrada externa como qualquer outra: `../../etc/passwd` tem de
 * sair daqui como um nome inofensivo.
 */
export function sanitiseFilename(name: string | undefined): string {
  const last = (name ?? '').split(/[/\\]/).pop() ?? '';
  const cleaned = last
    // Caracteres de controlo, escritos com escapes para não viajarem literais.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.\-]+/, '')
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : 'anexo';
}

export interface AcceptedAttachment {
  filename: string;
  mimeType: DetectedType;
  kind: AttachmentKind;
  bytes: Uint8Array;
}

export interface RejectedAttachment {
  filename: string;
  reason: string;
}

export interface TriageResult {
  accepted: AcceptedAttachment[];
  rejected: RejectedAttachment[];
}

/**
 * Decide o que fica e o que se descarta.
 *
 * O que é descartado não faz o email cair: o texto é guardado na mesma e a
 * submissão entra na fila com um aviso. Perder um anexo é um contratempo;
 * perder o email é perder a programação de uma coletividade.
 */
export function triageAttachments(
  attachments: ReadonlyArray<{ filename?: string; content: string }>,
): TriageResult {
  const accepted: AcceptedAttachment[] = [];
  const rejected: RejectedAttachment[] = [];
  let total = 0;

  for (const attachment of attachments) {
    const filename = sanitiseFilename(attachment.filename);
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(Buffer.from(attachment.content, 'base64'));
    } catch {
      rejected.push({ filename, reason: 'conteúdo ilegível' });
      continue;
    }

    if (bytes.length === 0) {
      rejected.push({ filename, reason: 'vazio' });
      continue;
    }
    if (bytes.length > MAX_ATTACHMENT_BYTES) {
      rejected.push({ filename, reason: 'acima de 5 MB' });
      continue;
    }
    if (total + bytes.length > MAX_TOTAL_ATTACHMENT_BYTES) {
      rejected.push({ filename, reason: 'total acima de 10 MB' });
      continue;
    }

    const mimeType = detectType(bytes);
    if (!mimeType) {
      rejected.push({ filename, reason: 'tipo não aceite' });
      continue;
    }

    total += bytes.length;
    accepted.push({ filename, mimeType, kind: kindOf(mimeType), bytes });
  }

  return { accepted, rejected };
}

/** Caminho no balde privado. O id da submissão isola cada envio. */
export function storagePath(submissionId: string, index: number, filename: string): string {
  return `${submissionId}/${index}-${filename}`;
}
