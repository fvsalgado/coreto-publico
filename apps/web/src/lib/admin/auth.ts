import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { env } from '../env';
import { comAviso } from './fields';
import { pode, actorDaPessoa, actorDoDono, type Papel, type Sessao } from './papeis';
import { lerPessoa, type PessoaGuardada } from './pessoas';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  SUB_DO_DONO,
  chaveDaPorta,
  chaveDaSessao,
  conferirAssinaturaDaPessoa,
  createPersonToken,
  createSessionToken,
  lerSessaoNaPorta,
} from './session';

/**
 * A ligação da autenticação ao pedido em curso.
 *
 * A lógica — hash da palavra-passe, assinatura e prazo do token — vive em
 * `session.ts`, sem nada do Next, para poder ser testada sem um servidor; o que
 * cada papel pode, em `papeis.ts`. Aqui fica só o que precisa mesmo de cookies
 * e da base.
 *
 * **Há duas maneiras de ter sessão, e as duas são verificadas aqui de novo**
 * (o middleware já as viu à porta): a do dono, assinada com o segredo e com o
 * `ADMIN_PASSWORD_HASH`; e a de uma pessoa, assinada com o segredo e com o
 * hash da palavra-passe dela, que se lê da base **em cada pedido**. É essa
 * leitura que faz uma pessoa desativada, ou sem o papel que tinha, deixar de
 * entrar no clique seguinte — não daqui a oito horas, quando o cookie
 * expirasse.
 */

export type AdminGate =
  { ok: true; actor: string; sessao: Sessao } | { ok: false; reason: 'unconfigured' | 'anonymous' };

/** `true` quando a área interna tem configuração suficiente para existir. */
export function isAdminConfigured(): boolean {
  return Boolean(env.ADMIN_PASSWORD_HASH && env.ADMIN_SESSION_SECRET);
}

/**
 * A chave de assinatura das sessões do dono, ou `null` sem configuração.
 *
 * Leva o hash da palavra-passe de propósito — ver `chaveDaSessao`. As duas
 * variáveis andam juntas e o `isAdminConfigured` já exige as duas; isto é a
 * mesma exigência escrita de forma a que o TypeScript a veja, em vez de três
 * `as string` espalhados.
 */
function chaveDoDono(): string | null {
  const { ADMIN_SESSION_SECRET: segredo, ADMIN_PASSWORD_HASH: hash } = env;
  return segredo && hash ? chaveDaSessao(segredo, hash) : null;
}

/** Uma pessoa pode entrar: ativada, não desativada, com palavra-passe. */
export function pessoaPodeEntrar(
  pessoa: Pick<PessoaGuardada, 'senha_hash' | 'desativada_em'> | null,
): pessoa is Pick<PessoaGuardada, 'senha_hash' | 'desativada_em'> & { senha_hash: string } {
  return Boolean(pessoa && pessoa.senha_hash && !pessoa.desativada_em);
}

/**
 * A sessão do pedido em curso, ou `null`.
 *
 * Memorizada **dentro do pedido** (`cache` do React): o layout, a página e as
 * leituras perguntam todos, e é uma ida à base por pedido, não uma por
 * pergunta. Entre pedidos não se guarda nada — é a regra de cima.
 */
export const sessaoAtual = cache(async (): Promise<Sessao | null> => {
  const segredo = env.ADMIN_SESSION_SECRET;
  if (!segredo || !env.ADMIN_PASSWORD_HASH) return null;

  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  const naPorta = await lerSessaoNaPorta(token, {
    doDono: chaveDoDono(),
    daPorta: chaveDaPorta(segredo),
  });
  if (!naPorta || !token) return null;

  if (naPorta.tipo === 'dono') {
    // O autor de uma sessão do dono é o que ela trouxe; as abertas antes das
    // contas por pessoa dizem «gestor», e continuam a valer até expirarem.
    return { tipo: 'dono', actor: naPorta.payload.actor };
  }

  const pessoa = await lerPessoa(naPorta.pessoaId);
  if (!pessoa || !pessoaPodeEntrar(pessoa)) return null;
  const confere = await conferirAssinaturaDaPessoa(
    token,
    chaveDaSessao(segredo, pessoa.senha_hash as string),
  );
  if (!confere) return null;

  return {
    tipo: 'pessoa',
    // Lido da base e não do token: se o dono corrigir o nome de alguém, a
    // auditoria escreve o nome certo a partir do clique seguinte.
    actor: actorDaPessoa(pessoa),
    pessoa: { id: pessoa.id, nome: pessoa.nome, email: pessoa.email },
    papeis: pessoa.papeis,
  };
});

/** O estado de autenticação do pedido em curso. */
export async function currentAdmin(): Promise<AdminGate> {
  if (!isAdminConfigured()) return { ok: false, reason: 'unconfigured' };
  const sessao = await sessaoAtual();
  return sessao ? { ok: true, actor: sessao.actor, sessao } : { ok: false, reason: 'anonymous' };
}

/**
 * A sessão, ou uma exceção.
 *
 * Sem sessão nenhuma rebenta, como sempre: o middleware e o layout já mandam
 * para a entrada quem chega sem ela, e uma ação que mesmo assim corra sem
 * sessão é um pedido forjado — não merece um aviso simpático.
 */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) throw new Error('sessão de administração em falta');
  return sessao;
}

/** Quem age, para a auditoria. O nome antigo, para quem só precisa disso. */
export async function requireAdmin(): Promise<string> {
  return (await exigirSessao()).actor;
}

/**
 * Para onde vai uma ação que a sessão não pode fazer: de volta ao painel, com
 * a razão, e **sem ter escrito nada** — esta chamada vem antes de qualquer
 * escrita.
 *
 * Um aviso e não uma exceção, ao contrário da sessão em falta: aqui há uma
 * pessoa autenticada do outro lado, e a página de erro diria «não foi possível
 * falar com a base de dados», que é mentira.
 */
function recusar(razao: string): never {
  redirect(comAviso('/admin', razao));
}

/** O dono, ou de volta ao painel. */
export async function exigirDono(): Promise<Sessao & { tipo: 'dono' }> {
  const sessao = await exigirSessao();
  if (sessao.tipo !== 'dono') {
    recusar('Isso é de quem opera o Coreto, e não desta conta — nada foi alterado.');
  }
  return sessao;
}

/**
 * Uma sessão com pelo menos este papel nesta região, ou de volta ao painel.
 *
 * **Cada ação volta a perguntar isto antes de escrever.** A página que a
 * mostrou já recortou pela região — mas a página é um caminho e a ação é um
 * endereço, que responde a quem lhe bata com um formulário feito à mão.
 */
export async function exigirPapel(
  regiao: string | null | undefined,
  minimo: Papel,
): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (!pode(sessao, regiao, minimo)) {
    recusar('Isso é de uma região que não é desta conta — nada foi alterado.');
  }
  return sessao;
}

/**
 * O mesmo, quando a região é preciso ir buscá-la à base — a de uma
 * submissão, a de um lote de eventos, a dos dois lados de uma fusão.
 *
 * As regiões leem-se **depois** da sessão, e só para quem não é o dono: um
 * pedido sem sessão não chega a pôr a base a trabalhar, e o dono, que pode
 * tudo, não paga leituras que não mudam a resposta. Uma lista vazia recusa —
 * não é «nenhuma região a verificar», é «não se sabe de quem é isto».
 */
export async function exigirPapelNas(
  minimo: Papel,
  regioes: () => Promise<ReadonlyArray<string | null | undefined>>,
): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.tipo === 'dono') return sessao;
  const lista = await regioes();
  if (lista.length === 0 || !lista.every((regiao) => pode(sessao, regiao, minimo))) {
    recusar('Isso é de uma região que não é desta conta — nada foi alterado.');
  }
  return sessao;
}

const OPCOES_DO_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/admin',
  maxAge: ADMIN_SESSION_TTL_SECONDS,
};

/** Abre a sessão do dono. */
export async function startSession(actor: string): Promise<void> {
  const assinatura = chaveDoDono();
  if (!assinatura) throw new Error('área de administração por configurar');
  const store = await cookies();
  store.set(
    ADMIN_COOKIE_NAME,
    await createSessionToken(actor, assinatura, Date.now(), SUB_DO_DONO),
    OPCOES_DO_COOKIE,
  );
}

/** O autor do dono, para quem abre a sessão dele. */
export function actorDoDonoConfigurado(): string {
  return actorDoDono(env.ADMIN_EMAIL);
}

/** Abre a sessão de uma pessoa — assinada com o hash da palavra-passe dela. */
export async function iniciarSessaoDaPessoa(pessoa: {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
}): Promise<void> {
  const segredo = env.ADMIN_SESSION_SECRET;
  if (!segredo || !env.ADMIN_PASSWORD_HASH) throw new Error('área de administração por configurar');
  const store = await cookies();
  store.set(
    ADMIN_COOKIE_NAME,
    await createPersonToken(pessoa.id, actorDaPessoa(pessoa), {
      daPessoa: chaveDaSessao(segredo, pessoa.senha_hash),
      daPorta: chaveDaPorta(segredo),
    }),
    OPCOES_DO_COOKIE,
  );
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete({ name: ADMIN_COOKIE_NAME, path: '/admin' });
}

export { ADMIN_COOKIE_NAME } from './session';
