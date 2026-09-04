import 'server-only';
import { reportarErro } from './registo';
import { adminClient } from './supabase/server';
import { hashIp } from './ip';

/**
 * Limitação de tráfego, com estado em Postgres.
 *
 * Sem Redis nem serviço externo: uma tabela e uma função que incrementa e
 * devolve a contagem numa só ida. Chega para o que isto tem de aguentar, e
 * uma dependência a menos é uma coisa a menos para falhar às três da manhã.
 *
 * Sem base de dados configurada, deixa passar: em desenvolvimento é o que se
 * quer, e em produção a base existe sempre.
 */

export interface RateLimitResult {
  allowed: boolean;
  hits: number;
  resetAt: string | null;
}

export interface RateLimitOptions {
  /** Nome da rota, para separar baldes. */
  route: string;
  limit: number;
  windowSeconds: number;
  /** Chave alternativa ao IP (por exemplo, o remetente de um email). */
  key?: string;
}

export async function checkRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const supabase = adminClient();
  if (!supabase) return { allowed: true, hits: 0, resetAt: null };

  const bucket = `${options.route}:${options.key ?? hashIp(request)}`;
  const { data, error } = await supabase.rpc('rate_limit_hit', {
    p_bucket: bucket,
    p_window_seconds: options.windowSeconds,
    p_limit: options.limit,
  });

  if (error) {
    // Um limitador em baixo não pode fechar o site. Regista-se e deixa-se
    // passar — a alternativa é uma falha de infraestrutura virar uma negação
    // de serviço feita por nós.
    reportarErro('rate_limit_hit', error);
    return { allowed: true, hits: 0, resetAt: null };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: row?.allowed ?? true,
    hits: row?.hits ?? 0,
    resetAt: row?.reset_at ?? null,
  };
}

/** Resposta 429 com `Retry-After`, para quando o limite é atingido. */
export function tooManyRequests(result: RateLimitResult): Response {
  const retryAfter = result.resetAt
    ? Math.max(1, Math.ceil((Date.parse(result.resetAt) - Date.now()) / 1000))
    : 60;
  return Response.json(
    { error: 'Demasiados pedidos. Tenta daqui a pouco.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}
