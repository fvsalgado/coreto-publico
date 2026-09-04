import 'server-only';
import { cookies } from 'next/headers';
import { env } from '../env';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  createSessionToken,
  readSessionToken,
} from './session';

/**
 * A ligação da autenticação ao pedido em curso.
 *
 * A lógica — hash da palavra-passe, assinatura e prazo do token — vive em
 * `session.ts`, sem nada do Next, para poder ser testada sem um servidor.
 * Aqui fica só o que precisa mesmo de cookies.
 */

export type AdminGate =
  { ok: true; actor: string } | { ok: false; reason: 'unconfigured' | 'anonymous' };

/** `true` quando a área interna tem configuração suficiente para existir. */
export function isAdminConfigured(): boolean {
  return Boolean(env.ADMIN_PASSWORD_HASH && env.ADMIN_SESSION_SECRET);
}

/** O estado de autenticação do pedido em curso. */

export async function currentAdmin(): Promise<AdminGate> {
  if (!isAdminConfigured()) return { ok: false, reason: 'unconfigured' };
  const store = await cookies();
  const payload = await readSessionToken(
    store.get(ADMIN_COOKIE_NAME)?.value,
    env.ADMIN_SESSION_SECRET as string,
  );
  return payload ? { ok: true, actor: payload.actor } : { ok: false, reason: 'anonymous' };
}

/**
 * Quem age, ou uma exceção.
 *
 * Usada pelas ações de moderação: uma ação sem sessão não deve seguir por
 * engano, e o nome que devolve é o que vai para o registo de auditoria.
 */
export async function requireAdmin(): Promise<string> {
  const gate = await currentAdmin();
  if (!gate.ok) throw new Error('sessão de administração em falta');
  return gate.actor;
}

export async function startSession(actor: string): Promise<void> {
  const store = await cookies();
  store.set(
    ADMIN_COOKIE_NAME,
    await createSessionToken(actor, env.ADMIN_SESSION_SECRET as string),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/admin',
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    },
  );
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete({ name: ADMIN_COOKIE_NAME, path: '/admin' });
}

export { ADMIN_COOKIE_NAME } from './session';
