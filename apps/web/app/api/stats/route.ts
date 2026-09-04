import { statRequestSchema } from '@/src/lib/analytics/kinds';
import { recordEventStat } from '@/src/lib/analytics/record';
import { SITE_URL } from '@/src/lib/env';
import { checkRateLimit, tooManyRequests } from '@/src/lib/rate-limit';

/**
 * `POST /api/stats` — soma 1 a um contador de um evento.
 *
 * É a rota mais barata do sítio e a que mais vezes é chamada, por isso não
 * devolve corpo nenhum: quem conta não precisa de resposta, e um 204 poupa
 * bytes a cada visita.
 *
 * Não guarda nada sobre quem chama. O endereço IP é usado uma vez, já em
 * hash e só para o balde de limitação de tráfego (que se apaga ao fim de dois
 * dias); o que fica na base de dados é um número por evento.
 */

/** `{"eventId":"<uuid>","kind":"ical_download"}` não passa dos 70 bytes. */
const MAX_BODY_BYTES = 256;

/** Uma pessoa a navegar não chega perto disto; um guião automático, sim. */
const RATE_LIMIT = { route: 'stats', limit: 60, windowSeconds: 60 } as const;

function noContent(): Response {
  return new Response(null, { status: 204 });
}

/**
 * Só conta o que vem do próprio sítio.
 *
 * `application/json` obrigaria um pedido de outra origem a pedir autorização
 * primeiro, mas `sendBeacon` também sabe enviar `text/plain`, que qualquer
 * página consegue mandar sem autorização nenhuma. Comparar a origem com o
 * anfitrião do pedido fecha essa porta e continua a funcionar em pré-produção,
 * onde o domínio não é o definitivo.
 *
 * Sem cabeçalho `origin` — um cliente que não é um navegador — deixa-se
 * passar: aí quem manda é o limite por IP.
 *
 * Aceitam-se três anfitriões porque atrás de um proxy o `host` do pedido nem
 * sempre é o domínio público, e uma comparação demasiado apertada deixaria de
 * contar tudo sem dar sinal nenhum. Nenhum deles é forjável por uma página de
 * outra origem: acrescentar um cabeçalho a um pedido entre origens obriga o
 * navegador a pedir autorização primeiro, e esta rota não a dá.
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  const allowed = [
    request.headers.get('host'),
    request.headers.get('x-forwarded-host'),
    new URL(SITE_URL).host,
  ].filter((host): host is string => host !== null);

  try {
    return allowed.includes(new URL(origin).host);
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  // Validar antes de limitar: rejeitar lixo não deve custar uma ida à base de
  // dados, e o limitador vive numa tabela.
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = statRequestSchema.safeParse(payload);
  if (!parsed.success) return new Response(null, { status: 400 });

  const limit = await checkRateLimit(request, RATE_LIMIT);
  if (!limit.allowed) return tooManyRequests(limit);

  await recordEventStat(parsed.data.eventId, parsed.data.kind);
  return noContent();
}
