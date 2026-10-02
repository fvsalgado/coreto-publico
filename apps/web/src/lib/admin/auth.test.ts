import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PessoaGuardada } from './pessoas';
import {
  chaveDaPorta,
  chaveDaSessao,
  createPersonToken,
  createSessionToken,
  SUB_DO_DONO,
} from './session';

/**
 * A segunda barreira: a sessão relida no servidor, em cada pedido (C4-015).
 *
 * O middleware confere à porta a assinatura que só pede o segredo; aqui lê-se
 * a pessoa da base e confere-se a assinatura feita com a palavra-passe dela. É
 * isto que faz uma pessoa desativada, ou com a palavra-passe trocada, deixar
 * de entrar no clique seguinte — e uma guarda de papel recusar a região de
 * outra CIM antes de qualquer escrita.
 */

const SEGREDO = randomBytes(32).toString('base64url');
const HASH_DO_DONO = 'scrypt$32768$8$1$c2FsZG9kb25v$aGFzaGRvZG9ubw==';
const HASH_DA_ANA = 'scrypt$32768$8$1$c2FsZGFhbmE=$aGFzaGRhYW5h';
const ANA = '0b8e5c2e-4b7a-4c55-9a3f-2f6a1d2b3c4d';

const estado = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  pessoa: null as PessoaGuardada | null,
}));

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (estado.cookie ? { value: estado.cookie } : undefined),
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));
vi.mock('../env', () => ({
  env: { ADMIN_SESSION_SECRET: SEGREDO, ADMIN_PASSWORD_HASH: HASH_DO_DONO },
}));
vi.mock('./pessoas', () => ({ lerPessoa: async () => estado.pessoa }));

const { exigirDono, exigirPapel, exigirPapelNas, sessaoAtual } = await import('./auth');

function ana(mudancas: Partial<PessoaGuardada> = {}): PessoaGuardada {
  return {
    id: ANA,
    email: 'ana@cim.pt',
    nome: 'Ana Silva',
    senha_hash: HASH_DA_ANA,
    ativada_em: '2026-10-01T09:00:00Z',
    desativada_em: null,
    criada_em: '2026-10-01T08:00:00Z',
    criada_por: 'dono',
    ultimo_acesso: null,
    papeis: [{ region_id: 'mirante', papel: 'editor' }],
    ...mudancas,
  };
}

async function tokenDaAna(hash = HASH_DA_ANA): Promise<string> {
  return createPersonToken(ANA, 'Ana Silva · ana@cim.pt', {
    daPessoa: chaveDaSessao(SEGREDO, hash),
    daPorta: chaveDaPorta(SEGREDO),
  });
}

beforeEach(() => {
  estado.cookie = undefined;
  estado.pessoa = null;
});

describe('a sessão relida no servidor', () => {
  it('a do dono, como sempre', async () => {
    estado.cookie = await createSessionToken(
      'dono',
      chaveDaSessao(SEGREDO, HASH_DO_DONO),
      Date.now(),
      SUB_DO_DONO,
    );
    expect(await sessaoAtual()).toEqual({ tipo: 'dono', actor: 'dono' });
  });

  it('a de uma pessoa, com os papéis lidos da base', async () => {
    estado.cookie = await tokenDaAna();
    estado.pessoa = ana();
    expect(await sessaoAtual()).toMatchObject({
      tipo: 'pessoa',
      actor: 'Ana Silva · ana@cim.pt',
      papeis: [{ region_id: 'mirante', papel: 'editor' }],
    });
  });

  it('uma pessoa desativada perde a sessão no pedido seguinte', async () => {
    estado.cookie = await tokenDaAna();
    estado.pessoa = ana({ desativada_em: '2026-10-02T10:00:00Z' });
    expect(await sessaoAtual()).toBeNull();
  });

  it('trocar a palavra-passe fecha as sessões abertas dessa pessoa', async () => {
    estado.cookie = await tokenDaAna();
    estado.pessoa = ana({ senha_hash: 'scrypt$32768$8$1$b3V0cm8=$b3V0cmFoYXNo' });
    expect(await sessaoAtual()).toBeNull();
  });

  it('uma pessoa que já não existe na base não tem sessão', async () => {
    estado.cookie = await tokenDaAna();
    estado.pessoa = null;
    expect(await sessaoAtual()).toBeNull();
  });
});

describe('as guardas das ações', () => {
  it('um editor do Mirante não escreve na Travessia — e a recusa vem antes de qualquer escrita', async () => {
    estado.cookie = await tokenDaAna();
    estado.pessoa = ana();
    await expect(exigirPapel('travessia', 'editor')).rejects.toThrow(/^REDIRECT:\/admin\?aviso=/);
    await expect(exigirPapel('mirante', 'editor')).resolves.toMatchObject({ tipo: 'pessoa' });
  });

  it('um editor não faz o que é do gestor, nem o que é do dono', async () => {
    estado.cookie = await tokenDaAna();
    estado.pessoa = ana();
    await expect(exigirPapel('mirante', 'gestor')).rejects.toThrow(/^REDIRECT:/);
    await expect(exigirDono()).rejects.toThrow(/^REDIRECT:/);
  });

  it('as regiões de uma coisa só se leem para quem não é o dono, e uma lista vazia recusa', async () => {
    estado.cookie = await tokenDaAna();
    estado.pessoa = ana();
    const regioes = vi.fn(async () => ['mirante', 'travessia']);
    await expect(exigirPapelNas('editor', regioes)).rejects.toThrow(/^REDIRECT:/);
    await expect(exigirPapelNas('editor', async () => [])).rejects.toThrow(/^REDIRECT:/);

    estado.cookie = await createSessionToken('dono', chaveDaSessao(SEGREDO, HASH_DO_DONO));
    const naoChamada = vi.fn(async () => ['travessia']);
    await expect(exigirPapelNas('gestor', naoChamada)).resolves.toMatchObject({ tipo: 'dono' });
    expect(naoChamada).not.toHaveBeenCalled();
  });

  it('sem sessão nenhuma, rebentam — é um pedido forjado', async () => {
    await expect(exigirPapel('mirante', 'editor')).rejects.toThrow(
      'sessão de administração em falta',
    );
  });
});
