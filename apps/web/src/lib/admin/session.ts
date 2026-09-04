/**
 * O token de sessão da área interna.
 *
 * Escrito sobre a Web Crypto e não sobre `node:crypto` por uma razão concreta:
 * o middleware, que é a primeira barreira de `/admin`, corre no runtime de
 * edge, onde `node:crypto` não existe. Ter duas implementações da mesma
 * verificação — uma para o middleware, outra para as páginas — era garantir
 * que um dia divergiam e uma delas passava a aceitar o que a outra recusa.
 *
 * A verificação da palavra-passe vive em `password.ts`, que é de propósito
 * outro ficheiro: usa scrypt, só corre no servidor, e o middleware não precisa
 * dela.
 */

const COOKIE_NAME = 'coreto_admin';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

/** Tentativas de entrada por IP, e a janela em que contam. */
export const LOGIN_ATTEMPT_LIMIT = 5;
export const LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60;

export interface SessionPayload {
  /** Quem agiu, para a auditoria. Há um só, mas o registo pede um nome. */
  actor: string;
  /** Instante de expiração, em segundos desde a época. */
  exp: number;
  /** Ruído, para duas sessões seguidas não terem o mesmo valor. */
  jti: string;
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function sign(value: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    new TextEncoder().encode(value),
  );
  return base64url(signature);
}

/** Comparação sem sair mais cedo, para o tempo de resposta não dizer nada. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Constrói o valor do cookie: `payload.assinatura`, ambos em base64url. */
export async function createSessionToken(
  actor: string,
  secret: string,
  now = Date.now(),
): Promise<string> {
  const payload: SessionPayload = {
    actor,
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
    jti: base64url(crypto.getRandomValues(new Uint8Array(9))),
  };
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await sign(body, secret)}`;
}

/**
 * Lê um token de sessão. Devolve `null` para tudo o que não seja um token
 * válido, dentro do prazo e com a assinatura certa.
 */
export async function readSessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<SessionPayload | null> {
  if (!token) return null;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!constantTimeEquals(signature, await sign(body, secret))) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < now) return null;
    if (typeof payload.actor !== 'string' || payload.actor.length === 0) return null;
    return payload;
  } catch {
    return null;
  }
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_SESSION_TTL_SECONDS = SESSION_TTL_SECONDS;
