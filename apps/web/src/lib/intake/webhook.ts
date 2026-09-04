import { inboundEmailSchema, unescapeHtml, type InboundEmail } from '@coreto/core';
import { verifySignature } from './verify';

/**
 * A porta do canal de email: corpo em bruto, assinatura, schema.
 *
 * Vive fora da rota, e sem tocar na base de dados, por uma razão prática: é a
 * parte que se tem de poder exercitar. Uma verificação de assinatura só se
 * sabe que está certa se houver um teste que assine um corpo, o entregue e
 * confirme que passa — e outro que lhe mude uma letra e confirme que não.
 *
 * O corpo é lido **em bruto** e só depois interpretado. A assinatura é sobre
 * os bytes que o fornecedor enviou; qualquer normalização feita antes (voltar
 * a serializar o JSON, por exemplo) muda-os e a verificação passaria a
 * recusar tudo.
 */

/**
 * Tecto do corpo. Os anexos viajam em base64 dentro do JSON, e o limite dos
 * anexos é de 10 MB — que em base64 dá perto de 14 MB.
 */
export const MAX_BODY_BYTES = 16 * 1024 * 1024;

/**
 * Cabeçalhos onde se procura a assinatura.
 *
 * O primeiro é o que se documenta; o segundo existe porque metade dos
 * fornecedores tem um nome próprio e obrigar a renomear cabeçalhos é uma
 * maneira de tornar a configuração frágil.
 */
export const SIGNATURE_HEADERS = ['x-coreto-signature', 'x-webhook-signature'] as const;

export type InboundRejection =
  | { status: 'unconfigured' }
  | { status: 'unauthorized' }
  | { status: 'too_large' }
  | { status: 'invalid'; reason: string };

export type InboundRead = { status: 'ok'; email: InboundEmail } | InboundRejection;

export async function readInboundWebhook(
  request: Request,
  secret: string | undefined,
): Promise<InboundRead> {
  // Sem segredo não se verifica nada, e sem verificação isto seria um
  // endereço aberto para escrever na fila de moderação.
  if (!secret) return { status: 'unconfigured' };

  const declared = Number(request.headers.get('content-length') ?? Number.NaN);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { status: 'too_large' };

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return { status: 'invalid', reason: 'corpo ilegível' };
  }
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) return { status: 'too_large' };

  const signature = SIGNATURE_HEADERS.map((header) => request.headers.get(header)).find(
    (value) => value !== null && value.length > 0,
  );
  if (!verifySignature(rawBody, signature ?? null, secret)) return { status: 'unauthorized' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { status: 'invalid', reason: 'JSON inválido' };
  }

  const email = inboundEmailSchema.safeParse(parsed);
  if (!email.success) {
    return { status: 'invalid', reason: email.error.issues[0]?.message ?? 'corpo inválido' };
  }

  return { status: 'ok', email: email.data };
}

/**
 * Resposta a um pedido que não chegou a ser um email.
 *
 * Só aqui é que há códigos de erro. A partir do momento em que o corpo é um
 * email válido, a rota responde sempre 200 — ver a nota na própria rota.
 * A 401 não diz o que falhou: um atacante que saiba distinguir «assinatura em
 * falta» de «assinatura errada» aprende alguma coisa; quem configura o
 * fornecedor tem os registos do lado dele.
 */
export function webhookRejection(rejection: InboundRejection): Response {
  switch (rejection.status) {
    case 'unconfigured':
      return Response.json({ error: 'canal de email por configurar' }, { status: 503 });
    case 'unauthorized':
      return Response.json({ error: 'não autorizado' }, { status: 401 });
    case 'too_large':
      return Response.json({ error: 'corpo demasiado grande' }, { status: 413 });
    case 'invalid':
      return Response.json({ error: rejection.reason }, { status: 400 });
  }
}

/**
 * O texto que a extração vai ler, e que fica guardado como material em bruto.
 *
 * Prefere-se a versão em texto do email. Muita gente manda só HTML, e nesse
 * caso reduz-se a texto aqui mesmo — sem biblioteca, porque o que se quer não
 * é interpretar HTML, é ficar com as palavras e as quebras de linha nos
 * sítios certos. O que sobrar de marcação estraga uma leitura; perder o corpo
 * do email estraga a submissão inteira.
 */
export function plainTextOf(email: InboundEmail): string {
  const text = email.text.trim();
  if (text.length > 0) return text;
  return email.html ? htmlToText(email.html) : '';
}

export function htmlToText(html: string): string {
  return (
    unescapeHtml(
      html
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|tr|h[1-6]|table|section|article)>/gi, '\n')
        .replace(/<[^>]+>/g, ' '),
    ) ?? ''
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
