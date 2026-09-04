import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasDatabase, hasServiceRole } from '../env';

/**
 * Clientes Supabase do servidor.
 *
 * O cliente público NÃO lê cookies de propósito: o site é servido de cache e
 * não personaliza nada, por isso não há sessão que ler. Isso é o que permite
 * que quase tudo seja estático e o site aguente picos.
 *
 * A chave de serviço nunca sai daqui — só a usam a moderação e as rotas de
 * escrita, e ambas correm no servidor.
 */

type Client = SupabaseClient;

let anonClient: Client | null = null;
let serviceClient: Client | null = null;

/** Leitura pública. `null` quando não há base configurada. */
export function publicClient(): Client | null {
  if (!hasDatabase) return null;
  anonClient ??= createClient(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return anonClient;
}

/** Escrita e leitura interna. `null` quando não há chave de serviço. */
export function adminClient(): Client | null {
  if (!hasServiceRole) return null;
  serviceClient ??= createClient(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return serviceClient;
}

/** Igual a `adminClient()`, mas rebenta em vez de devolver `null`. */
export function requireAdminClient(): Client {
  const client = adminClient();
  if (!client) throw new Error('SUPABASE_SERVICE_ROLE_KEY em falta');
  return client;
}
