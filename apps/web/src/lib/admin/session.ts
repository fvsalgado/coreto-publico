import { assinar, base64url, constantTimeEquals, fromBase64url } from '../token-assinado';

/**
 * O token de sessão da área interna.
 *
 * Escrito sobre a Web Crypto e não sobre `node:crypto` por uma razão concreta:
 * o middleware, que é a primeira barreira de `/admin`, corre no runtime de
 * edge, onde `node:crypto` não existe. Ter duas implementações da mesma
 * verificação — uma para o middleware, outra para as páginas — era garantir
 * que um dia divergiam e uma delas passava a aceitar o que a outra recusa.
 *
 * Esse aviso cumpriu-se em 2026-09-15, quando a barreira das regiões (0157)
 * precisou de um segundo cookie assinado: as primitivas saíram para
 * `../token-assinado.ts` e são as mesmas para os dois. **O formato deste token
 * não mudou** — nem um byte —, para não deitar abaixo as sessões abertas.
 *
 * A verificação da palavra-passe vive em `password.ts`, que é de propósito
 * outro ficheiro: usa scrypt, só corre no servidor, e o middleware não precisa
 * dela.
 */

const COOKIE_NAME = 'coreto_admin';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

/**
 * A chave com que uma sessão se assina: o segredo **e** o hash da
 * palavra-passe em vigor.
 *
 * É a linha que torna verdadeira uma frase que o `scripts/hash-password.ts`
 * dizia desde o primeiro dia — «trocar a palavra-passe invalida as sessões
 * abertas» — e que era falsa: o token era assinado só com o
 * `ADMIN_SESSION_SECRET`, que não sabe nada da palavra-passe. Trocar a
 * palavra-passe porque ela foi vista por cima de um ombro, ou porque saiu
 * numa conversa, mudava o que era preciso para **entrar** e não tocava em
 * quem já estava dentro: uma sessão de oito horas continuava boa até ao fim
 * do prazo dela. Quem trocava a palavra-passe pensava ter fechado a porta.
 *
 * Com o hash a fazer parte da chave, um valor novo em `ADMIN_PASSWORD_HASH`
 * produz assinaturas diferentes e as antigas deixam de conferir — sem tabela
 * de sessões, sem lista de revogados, sem nada por limpar. E como cada
 * execução do `hash-password.ts` gera um sal novo, até voltar a pôr a **mesma**
 * palavra-passe expulsa toda a gente, que é o comportamento certo para quem
 * está a reagir a uma dúvida.
 *
 * **O formato do token não muda** — nem um byte —, mas a chave muda, e por
 * isso as sessões abertas no dia em que isto for a produção caem uma vez. É o
 * preço, é pago uma só vez, e a alternativa era continuar a prometer uma coisa
 * que não acontecia.
 */
export function chaveDaSessao(secret: string, passwordHash: string): string {
  // O `\n` não é decoração: sem separador, um segredo que acabasse em `x` com
  // um hash que começasse por `y` daria a mesma cadeia que um segredo acabado
  // em `xy` com um hash começado no resto. Um newline não aparece em nenhum
  // dos dois valores — o hash é base64 com `$`, o segredo é uma linha de
  // ambiente —, e por isso a concatenação é reversível.
  return `${secret}\n${passwordHash}`;
}

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
  return `${body}.${await assinar(body, secret)}`;
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
  if (!constantTimeEquals(signature, await assinar(body, secret))) return null;

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
