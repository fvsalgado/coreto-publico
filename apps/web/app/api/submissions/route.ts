import { tooManyRequests } from '@/src/lib/rate-limit';
import { jsonReader, receiveSubmission } from '@/src/lib/submissions/intake';

/**
 * `POST /api/submissions` — receção de eventos por programa.
 *
 * O sítio já não tem formulário — a porta pública é o email (`/submeter`).
 * Esta rota fica para quem tem os eventos noutro sistema e prefere
 * mandá-los de uma vez; entra na mesma fila de moderação que tudo o resto.
 *
 * Só aceita JSON, e isso é uma decisão de segurança, não de gosto: um corpo
 * `application/x-www-form-urlencoded` pode ser enviado por um formulário de
 * outro sítio sem o navegador pedir autorização a esta origem, e a submissão
 * ficava atribuída ao endereço de quem visitou esse sítio. Com JSON o
 * navegador é obrigado a pedir autorização primeiro, e não a tem.
 *
 * Nada aqui publica: a submissão entra na fila em `pending`, como todas.
 */

/** Uma submissão de formulário não chega perto disto. */
const MAX_BODY_BYTES = 64 * 1024;

function badRequest(message: string, fields?: Record<string, string>): Response {
  return Response.json({ error: message, fields: fields ?? {} }, { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return Response.json(
      { error: 'O corpo tem de ser JSON (content-type: application/json).' },
      { status: 415 },
    );
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return Response.json({ error: 'Corpo demasiado grande.' }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return badRequest('JSON inválido.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return badRequest('O corpo tem de ser um objeto JSON.');
  }

  const outcome = await receiveSubmission(request, jsonReader(parsed as Record<string, unknown>));

  switch (outcome.kind) {
    case 'accepted':
      // 202 e não 201: não foi criado nada de público. Foi aceite para
      // revisão, e a resposta diz isso por extenso para ninguém ficar à
      // espera de ver o evento no sítio a seguir.
      return Response.json(
        {
          status: 'pending_review',
          message: 'Submissão recebida. Vai ser revista por uma pessoa antes de ser publicada.',
        },
        { status: 202 },
      );
    case 'invalid':
      return badRequest(outcome.message, outcome.fieldErrors as Record<string, string>);
    case 'rate_limited':
      return tooManyRequests(outcome.rateLimit);
    case 'unavailable':
      return Response.json({ error: outcome.message }, { status: 503 });
    case 'failed':
      return Response.json({ error: outcome.message }, { status: 500 });
  }
}
