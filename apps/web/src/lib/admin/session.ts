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

/**
 * As tentativas **falhadas** de entrada, e a janela em que contam (C4-016).
 *
 * Contavam-se todas as entradas, certas ou erradas, por endereço: cinco em
 * quinze minutos trancavam a equipa inteira de uma CIM, que sai para a
 * internet pelo mesmo IP — três técnicos, um portátil e um telemóvel numa
 * manhã, e o painel fechava a todos com uma mensagem que sugeria um ataque.
 *
 * Agora contam só as falhadas, em dois baldes: por email, apertado, porque é
 * o que trava quem tenta adivinhar a palavra-passe de uma pessoa; e por
 * endereço, mais largo, porque é partilhado por uma equipa e só tem de travar
 * quem tenta muitos emails a partir do mesmo sítio. Uma entrada certa limpa o
 * balde do endereço — quem acertou não paga os enganos de quem partilha a
 * rede.
 */
export const LOGIN_FALHAS_POR_EMAIL = 5;
export const LOGIN_FALHAS_POR_IP = 20;
export const LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60;

export interface SessionPayload {
  /**
   * De quem é a sessão: `'dono'`, ou o identificador da pessoa (0170).
   *
   * Opcional porque os tokens emitidos antes das contas por pessoa não o
   * trazem — e esses são todos do dono, que era o único que entrava. Lê-los
   * como do dono é o que impede que as sessões abertas caiam no dia em que
   * isto chega a produção.
   */
  sub?: string;
  /** Quem agiu, para a auditoria: «nome · email» de uma pessoa, ou o dono. */
  actor: string;
  /** Instante de expiração, em segundos desde a época. */
  exp: number;
  /** Ruído, para duas sessões seguidas não terem o mesmo valor. */
  jti: string;
}

/** O identificador do dono no campo `sub`. Uma pessoa tem um uuid. */
export const SUB_DO_DONO = 'dono';

/** Um uuid em minúsculas, como a `gen_random_uuid()` os escreve. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function corpoDoToken(payload: SessionPayload): string {
  return base64url(new TextEncoder().encode(JSON.stringify(payload)));
}

function novoPayload(actor: string, now: number, sub?: string): SessionPayload {
  return {
    ...(sub ? { sub } : {}),
    actor,
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
    jti: base64url(crypto.getRandomValues(new Uint8Array(9))),
  };
}

/**
 * Constrói o valor do cookie do dono: `payload.assinatura`, ambos em base64url.
 *
 * O formato é o de sempre, e a única coisa nova é o `sub` no corpo — que o
 * leitor antigo ignora. Uma sessão aberta antes da 0170 continua a conferir
 * depois dela, e uma aberta depois continuaria a conferir num deployment
 * antigo; nenhuma das duas mudanças tranca o dono fora.
 */
export async function createSessionToken(
  actor: string,
  secret: string,
  now = Date.now(),
  sub?: string,
): Promise<string> {
  const body = corpoDoToken(novoPayload(actor, now, sub));
  return `${body}.${await assinar(body, secret)}`;
}

/**
 * A chave da porta: o que o middleware usa para conferir a sessão de uma
 * pessoa sem ir à base.
 *
 * **O problema que isto resolve.** A sessão de uma pessoa assina-se com o
 * segredo e com o hash da palavra-passe **dela** (`chaveDaSessao`), para que
 * trocar a palavra-passe feche as sessões abertas — a mesma promessa que a do
 * dono cumpre desde 21 de setembro. Só que o middleware corre no edge, antes
 * de tudo, e não tem esse hash: está na base, e uma ida à base por cada pedido
 * a `/admin` no edge era pôr a primeira barreira a depender da segunda.
 *
 * Por isso o token de uma pessoa leva **duas** assinaturas sobre o mesmo
 * corpo: a da pessoa, que o servidor confere depois de ler o hash dela, e a da
 * porta, que só pede o segredo e que o middleware confere sozinho. Forjar uma
 * sessão continua a exigir o segredo — a porta não deixa passar o que o
 * servidor não emitiu —, e uma sessão roubada depois de a palavra-passe mudar
 * passa a porta e cai no layout, que é a segunda barreira de sempre.
 *
 * O sufixo separa esta chave das outras assinadas com o mesmo segredo: a do
 * dono leva um hash scrypt (que nunca é esta palavra), e o bilhete da barreira
 * (`portao.ts`) assina com o segredo em bruto.
 */
export function chaveDaPorta(secret: string): string {
  return `${secret}\nporta-do-painel`;
}

/**
 * O token de uma pessoa: `payload.assinatura-da-pessoa.assinatura-da-porta`.
 *
 * Três partes e não duas, e é isso que o distingue do do dono sem olhar para
 * dentro: um token de três partes nunca é lido como do dono, e um de duas
 * nunca é lido como de uma pessoa.
 */
export async function createPersonToken(
  pessoaId: string,
  actor: string,
  chavesDaPessoa: { daPessoa: string; daPorta: string },
  now = Date.now(),
): Promise<string> {
  const body = corpoDoToken(novoPayload(actor, now, pessoaId));
  const [daPessoa, daPorta] = await Promise.all([
    assinar(body, chavesDaPessoa.daPessoa),
    assinar(body, chavesDaPessoa.daPorta),
  ]);
  return `${body}.${daPessoa}.${daPorta}`;
}

function lerCorpo(body: string, now: number): SessionPayload | null {
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < now) return null;
    if (typeof payload.actor !== 'string' || payload.actor.length === 0) return null;
    if (payload.sub !== undefined && typeof payload.sub !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

/** O que a porta sabe de uma sessão, antes de o servidor ir à base. */
export type SessaoNaPorta =
  | { tipo: 'dono'; payload: SessionPayload }
  | { tipo: 'pessoa'; pessoaId: string; payload: SessionPayload };

/**
 * Lê uma sessão à porta: a do dono, inteira, ou a de uma pessoa, pela
 * assinatura da porta.
 *
 * É a leitura do middleware, e é também a primeira metade da do servidor, que
 * a seguir confere a assinatura da pessoa com o hash que lê da base
 * (`conferirAssinaturaDaPessoa`).
 */
export async function lerSessaoNaPorta(
  token: string | undefined,
  chaves: { doDono: string | null; daPorta: string },
  now = Date.now(),
): Promise<SessaoNaPorta | null> {
  if (!token) return null;
  const partes = token.split('.');

  if (partes.length === 2) {
    if (!chaves.doDono) return null;
    const payload = await readSessionToken(token, chaves.doDono, now);
    if (!payload) return null;
    // Um token de duas partes só pode ser do dono. Um `sub` de pessoa aqui é
    // um token que este servidor nunca emitiu.
    if (payload.sub !== undefined && payload.sub !== SUB_DO_DONO) return null;
    return { tipo: 'dono', payload };
  }

  if (partes.length === 3) {
    const [body = '', , daPorta = ''] = partes;
    if (!body || !daPorta) return null;
    if (!constantTimeEquals(daPorta, await assinar(body, chaves.daPorta))) return null;
    const payload = lerCorpo(body, now);
    if (!payload?.sub || !UUID.test(payload.sub)) return null;
    return { tipo: 'pessoa', pessoaId: payload.sub, payload };
  }

  return null;
}

/**
 * A segunda metade da leitura de uma pessoa: a assinatura feita com o hash da
 * palavra-passe dela. Falha assim que a palavra-passe muda.
 */
export async function conferirAssinaturaDaPessoa(
  token: string,
  chaveDaPessoa: string,
): Promise<boolean> {
  const partes = token.split('.');
  if (partes.length !== 3) return false;
  const [body = '', daPessoa = ''] = partes;
  if (!body || !daPessoa) return false;
  return constantTimeEquals(daPessoa, await assinar(body, chaveDaPessoa));
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
  // Duas partes e só duas: o token de uma pessoa tem três, e nunca é do dono.
  const partes = token.split('.');
  if (partes.length !== 2) return null;
  const [body = '', signature = ''] = partes;
  if (!body) return null;
  if (!constantTimeEquals(signature, await assinar(body, secret))) return null;

  return lerCorpo(body, now);
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_SESSION_TTL_SECONDS = SESSION_TTL_SECONDS;
