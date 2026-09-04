import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { env } from '@/src/lib/env';
import { CACHE_TAGS } from '@/src/lib/queries/events';

/**
 * Invalidação de cache por webhook.
 *
 * As listagens públicas são servidas de cache com etiquetas. A recolha
 * noturna e a moderação chamam aqui quando alguma coisa muda, em vez de se
 * esperar que um tempo de vida expire. É o que permite que uma aprovação
 * apareça no site em segundos sem que o site deixe de ser praticamente todo
 * estático — e é também o que o faz aguentar um pico, porque quase nada é
 * calculado no momento do pedido.
 */

const bodySchema = z.object({
  /** Etiquetas a invalidar. Vazio ⇒ invalida tudo o que é público. */
  tags: z.array(z.string().max(120)).max(30).optional(),
  /** Atalho: invalida as listagens de um concelho. */
  municipality: z.string().max(80).optional(),
});

const ALL_TAGS = [CACHE_TAGS.events, CACHE_TAGS.venues, CACHE_TAGS.coretos, CACHE_TAGS.taxonomy];

function unauthorized(): Response {
  return Response.json({ error: 'não autorizado' }, { status: 401 });
}

export async function POST(request: Request): Promise<Response> {
  const secret = env.REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ error: 'REVALIDATE_SECRET não configurado' }, { status: 503 });
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  // Comparação de comprimento constante: `timingSafeEqual` exige buffers do
  // mesmo tamanho, por isso compara-se primeiro o comprimento e só depois o
  // conteúdo, byte a byte, sem sair mais cedo.
  if (!constantTimeEquals(token, secret)) return unauthorized();

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: 'corpo inválido' }, { status: 400 });
  }

  const tags = new Set<string>(parsed.data.tags ?? ALL_TAGS);
  if (parsed.data.municipality) {
    tags.add(CACHE_TAGS.municipality(parsed.data.municipality));
    tags.add(CACHE_TAGS.events);
  }

  // `{ expire: 0 }` e não um perfil de `cacheLife`: isto é um webhook, não uma
  // Server Action. Quem chama já sabe que os dados mudaram — o que se quer é
  // purgar já, não encurtar a validade. (`updateTag`, que seria o equivalente
  // imediato, só funciona dentro de uma Server Action.)
  for (const tag of tags) revalidateTag(tag, { expire: 0 });

  return Response.json({ revalidated: [...tags], at: new Date().toISOString() });
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
