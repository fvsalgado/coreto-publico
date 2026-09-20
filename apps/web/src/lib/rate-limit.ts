import 'server-only';
import { reportarErro } from './registo';
import { adminClient } from './supabase/server';
import { baldeDoPedido } from './ip';

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
  /**
   * Sem base de dados, ou com ela em erro, conta na memória do processo em
   * vez de deixar passar. É para as portas onde «deixar passar» é o ataque —
   * o login do painel, a senha da barreira, as submissões. Para leituras
   * públicas fica a omissão, que é a que não transforma uma avaria nossa
   * numa negação de serviço feita por nós.
   */
  falhaFechada?: boolean;
}

export async function checkRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const bucket = `${options.route}:${options.key ?? baldeDoPedido(request)}`;
  const supabase = adminClient();
  if (!supabase) return semBase(bucket, options);

  const { data, error } = await supabase.rpc('rate_limit_hit', {
    p_bucket: bucket,
    p_window_seconds: options.windowSeconds,
    p_limit: options.limit,
  });

  if (error) {
    // Um limitador em baixo não pode fechar o site. Regista-se e — nas portas
    // que não pediram o contrário — deixa-se passar: a alternativa é uma
    // falha de infraestrutura virar uma negação de serviço feita por nós.
    reportarErro('rate_limit_hit', error);
    return semBase(bucket, options);
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

/**
 * O que se faz quando a base não responde: depende de quem pergunta.
 *
 * As portas com `falhaFechada` contam aqui, na memória deste processo. Não é
 * a mesma coisa que a tabela — cada instância tem a sua memória e um reinício
 * esquece tudo —, mas é o que separa «cinco tentativas por quarto de hora» de
 * «as que quiser», que era o que o login do painel oferecia sempre que a
 * chave de serviço faltava ou a função falhava. Medido a 19 de setembro de
 * 2026; o próprio `env.ts` já o admitia num comentário.
 */
function semBase(bucket: string, options: RateLimitOptions): RateLimitResult {
  if (!options.falhaFechada) return { allowed: true, hits: 0, resetAt: null };
  return contarEmMemoria(bucket, options.windowSeconds, options.limit);
}

interface BaldeEmMemoria {
  inicio: number;
  hits: number;
}

const MEMORIA = new Map<string, BaldeEmMemoria>();
const MEMORIA_MAX_BALDES = 10_000;

export function contarEmMemoria(
  bucket: string,
  windowSeconds: number,
  limit: number,
  agora = Date.now(),
): RateLimitResult {
  const janelaMs = windowSeconds * 1000;
  let balde = MEMORIA.get(bucket);
  if (!balde || agora - balde.inicio >= janelaMs) {
    // Um mapa que só cresce é uma fuga de memória com outro nome: antes de
    // abrir um balde novo, deitam-se fora os que já expiraram; e se mesmo
    // assim forem de mais, esquece-se tudo — o custo é uma janela mais
    // generosa, nunca uma porta aberta.
    if (!balde && MEMORIA.size >= MEMORIA_MAX_BALDES) {
      for (const [chave, outro] of MEMORIA) {
        if (agora - outro.inicio >= janelaMs) MEMORIA.delete(chave);
      }
      if (MEMORIA.size >= MEMORIA_MAX_BALDES) MEMORIA.clear();
    }
    balde = { inicio: agora, hits: 0 };
    MEMORIA.set(bucket, balde);
  }
  balde.hits += 1;
  return {
    allowed: balde.hits <= limit,
    hits: balde.hits,
    resetAt: new Date(balde.inicio + janelaMs).toISOString(),
  };
}

/** Só para os testes: o processo de testes partilha a memória entre casos. */
export function esquecerMemoriaDeTrafego(): void {
  MEMORIA.clear();
}
