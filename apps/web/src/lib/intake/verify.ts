import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verificação da assinatura do webhook de email.
 *
 * Sem `INBOUND_MAIL_SECRET` configurado, a rota devolve 503 e não aceita nada.
 * Um endereço que cria submissões sem verificar quem as manda é um canal de
 * entrada aberto para a fila de moderação — e uma fila inundada é uma fila que
 * ninguém lê.
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  // Aceita-se `sha256=<hex>` e o hexadecimal nu: os fornecedores dividem-se
  // entre os dois e não vale a pena obrigar a um.
  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');

  // `timingSafeEqual` rebenta com buffers de tamanhos diferentes, por isso o
  // comprimento é comparado primeiro — e um comprimento errado nunca é válido.
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}
