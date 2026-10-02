import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PessoaGuardada } from './pessoas';

/**
 * A entrada no painel, com as contas por pessoa (0170, C4-015, C4-016).
 *
 * O que tem de ser verdade, pela ordem do `CONTAS.md`: a senha do ambiente
 * continua a ser a do dono — ninguém fica trancado fora no dia em que isto
 * chega a produção —; com `ADMIN_EMAIL`, o email também tem de bater; as
 * pessoas entram pela sua conta; um engano tem uma resposta só, que não diz
 * se o email existe, e custa o mesmo tempo; e só as falhadas contam para o
 * limite.
 */

const estado = vi.hoisted(() => ({
  adminEmail: undefined as string | undefined,
  senhaDoDono: 'a-senha-do-dono',
  pessoa: null as PessoaGuardada | null,
  senhaDaPessoa: 'a-senha-da-ana',
  permitido: true,
}));

const startSession = vi.hoisted(() => vi.fn(async () => {}));
const iniciarSessaoDaPessoa = vi.hoisted(() => vi.fn(async () => {}));
const registarAcesso = vi.hoisted(() => vi.fn(async () => {}));
const registarFalhaDaEntrada = vi.hoisted(() => vi.fn(async () => {}));
const limparLimiteDoEndereco = vi.hoisted(() => vi.fn(async () => {}));
const gastarOMesmoTempo = vi.hoisted(() => vi.fn());
const verifyPassword = vi.hoisted(() =>
  vi.fn((senha: string, hash: string) =>
    hash === 'hash-do-dono' ? senha === estado.senhaDoDono : senha === estado.senhaDaPessoa,
  ),
);

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '10.0.0.1' }),
  cookies: async () => ({ set: () => {}, get: () => undefined, delete: () => {} }),
}));
vi.mock('next/navigation', () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));
vi.mock('../env', () => ({
  env: {
    ADMIN_PASSWORD_HASH: 'hash-do-dono',
    ADMIN_SESSION_SECRET: 'um-segredo-qualquer-com-mais-de-trinta-e-dois',
    get ADMIN_EMAIL() {
      return estado.adminEmail;
    },
  },
}));
vi.mock('./auth', () => ({
  isAdminConfigured: () => true,
  pessoaPodeEntrar: (pessoa: PessoaGuardada | null) =>
    Boolean(pessoa && pessoa.senha_hash && !pessoa.desativada_em),
  actorDoDonoConfigurado: () => (estado.adminEmail ? `dono · ${estado.adminEmail}` : 'dono'),
  startSession,
  iniciarSessaoDaPessoa,
  endSession: async () => {},
  exigirDono: async () => ({ tipo: 'dono', actor: 'dono' }),
  exigirSessao: async () => ({ tipo: 'dono', actor: 'dono' }),
}));
vi.mock('./password', () => ({
  verifyPassword,
  gastarOMesmoTempo,
  gerarHashDaSenha: () => 'scrypt$1$1$1$c2Fs$aGFzaA==',
  PALAVRA_PASSE_MINIMA: 12,
}));
vi.mock('./pessoas', () => ({
  lerPessoaPorEmail: async (email: string) =>
    estado.pessoa && estado.pessoa.email === email ? estado.pessoa : null,
  registarAcesso,
  faltaNoEsquema: () => false,
}));
vi.mock('./limite-da-entrada', () => ({
  consultarLimiteDaEntrada: async () =>
    estado.permitido
      ? { permitido: true, repoeEm: null }
      : { permitido: false, repoeEm: '2026-10-02T09:42:00Z' },
  registarFalhaDaEntrada,
  limparLimiteDoEndereco,
}));
vi.mock('./queries', () => ({ listRegionsAdmin: async () => [] }));
vi.mock('../supabase/server', () => ({ requireAdminClient: () => ({ rpc: vi.fn() }) }));

const { entrar } = await import('./acoes-das-contas');

function formulario(email: string, password: string, destino = '/admin/fila'): FormData {
  const dados = new FormData();
  dados.set('email', email);
  dados.set('password', password);
  dados.set('destino', destino);
  return dados;
}

async function destinoDe(accao: Promise<void>): Promise<string> {
  try {
    await accao;
  } catch (erro) {
    return (erro as Error).message.replace(/^REDIRECT:/, '');
  }
  throw new Error('a ação devia ter redirecionado');
}

function ana(mudancas: Partial<PessoaGuardada> = {}): PessoaGuardada {
  return {
    id: '0b8e5c2e-4b7a-4c55-9a3f-2f6a1d2b3c4d',
    email: 'ana@cim.pt',
    nome: 'Ana Silva',
    senha_hash: 'hash-da-ana',
    ativada_em: '2026-10-01T09:00:00Z',
    desativada_em: null,
    criada_em: '2026-10-01T08:00:00Z',
    criada_por: 'dono',
    ultimo_acesso: null,
    papeis: [{ region_id: 'mirante', papel: 'editor' }],
    ...mudancas,
  };
}

beforeEach(() => {
  estado.adminEmail = undefined;
  estado.pessoa = ana();
  estado.permitido = true;
  for (const espiao of [
    startSession,
    iniciarSessaoDaPessoa,
    registarAcesso,
    registarFalhaDaEntrada,
    limparLimiteDoEndereco,
    gastarOMesmoTempo,
    verifyPassword,
  ]) {
    espiao.mockClear();
  }
});

describe('o dono continua a entrar com a senha de sempre', () => {
  it('sem ADMIN_EMAIL, com qualquer email', async () => {
    expect(await destinoDe(entrar(formulario('qualquer@coisa.pt', 'a-senha-do-dono')))).toBe(
      '/admin/fila',
    );
    expect(startSession).toHaveBeenCalledWith('dono');
    expect(limparLimiteDoEndereco).toHaveBeenCalledTimes(1);
    expect(registarAcesso).toHaveBeenCalledWith(null, 'dono');
    expect(registarFalhaDaEntrada).not.toHaveBeenCalled();
  });

  it('com ADMIN_EMAIL, só com esse email — e a senha do dono com outro email não abre nada', async () => {
    estado.adminEmail = 'dono@coreto.org';
    expect(await destinoDe(entrar(formulario('DONO@coreto.org', 'a-senha-do-dono')))).toBe(
      '/admin/fila',
    );
    expect(startSession).toHaveBeenCalledWith('dono · dono@coreto.org');

    startSession.mockClear();
    expect(await destinoDe(entrar(formulario('ana@cim.pt', 'a-senha-do-dono')))).toBe(
      '/admin/entrar?erro=credenciais',
    );
    expect(startSession).not.toHaveBeenCalled();
    expect(iniciarSessaoDaPessoa).not.toHaveBeenCalled();
  });
});

describe('as pessoas entram pela sua conta', () => {
  it('com a palavra-passe dela, abre a sessão dela e regista a entrada com nome e email', async () => {
    expect(await destinoDe(entrar(formulario(' Ana@CIM.pt ', 'a-senha-da-ana')))).toBe(
      '/admin/fila',
    );
    expect(iniciarSessaoDaPessoa).toHaveBeenCalledTimes(1);
    expect(registarAcesso).toHaveBeenCalledWith(
      '0b8e5c2e-4b7a-4c55-9a3f-2f6a1d2b3c4d',
      'Ana Silva · ana@cim.pt',
    );
    expect(limparLimiteDoEndereco).toHaveBeenCalledTimes(1);
  });

  it('desativada, não entra — nem com a palavra-passe certa', async () => {
    estado.pessoa = ana({ desativada_em: '2026-10-02T08:00:00Z' });
    expect(await destinoDe(entrar(formulario('ana@cim.pt', 'a-senha-da-ana')))).toBe(
      '/admin/entrar?erro=credenciais',
    );
    expect(iniciarSessaoDaPessoa).not.toHaveBeenCalled();
  });
});

describe('um engano tem uma resposta só, e só os enganos contam', () => {
  it('a palavra-passe errada conta uma falha, com o email', async () => {
    expect(await destinoDe(entrar(formulario('ana@cim.pt', 'errada')))).toBe(
      '/admin/entrar?erro=credenciais',
    );
    expect(registarFalhaDaEntrada).toHaveBeenCalledWith(expect.any(Request), 'ana@cim.pt');
    expect(gastarOMesmoTempo).not.toHaveBeenCalled();
  });

  it('um email que não existe responde o mesmo, e gasta o mesmo scrypt', async () => {
    expect(await destinoDe(entrar(formulario('ninguem@cim.pt', 'errada')))).toBe(
      '/admin/entrar?erro=credenciais',
    );
    expect(gastarOMesmoTempo).toHaveBeenCalledTimes(1);
    expect(registarFalhaDaEntrada).toHaveBeenCalledTimes(1);
  });

  it('passado o limite, nem se confere a palavra-passe, e diz-se a hora de Lisboa', async () => {
    estado.permitido = false;
    expect(await destinoDe(entrar(formulario('ana@cim.pt', 'a-senha-da-ana')))).toBe(
      '/admin/entrar?erro=demasiadas&ate=10h42',
    );
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('um destino de fora é trocado pelo painel', async () => {
    expect(
      await destinoDe(entrar(formulario('ana@cim.pt', 'a-senha-da-ana', 'https://fora.example/'))),
    ).toBe('/admin');
  });
});
