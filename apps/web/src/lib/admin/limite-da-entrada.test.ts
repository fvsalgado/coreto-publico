import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O limite da entrada conta só as tentativas falhadas (C4-016).
 *
 * Contava todas, certas e erradas, por endereço: cinco entradas certas em
 * quinze minutos trancavam a equipa inteira de uma CIM, que sai para a
 * internet pelo mesmo IP. Aqui prova-se o comportamento novo pelo caminho da
 * memória — o que vale sem base, e antes de a 0170 chegar —, que é o mesmo
 * contrato que a base cumpre com `rate_limit_peek`, `rate_limit_hit` e
 * `rate_limit_clear` (as asserções da migração provam essas três).
 */

const estado = vi.hoisted(() => ({ cliente: null as unknown }));
vi.mock('../supabase/server', () => ({ adminClient: () => estado.cliente }));

const {
  consultarLimiteDaEntrada,
  esquecerMemoriaDaEntrada,
  limparLimiteDoEndereco,
  registarFalhaDaEntrada,
} = await import('./limite-da-entrada');
const { LOGIN_FALHAS_POR_EMAIL, LOGIN_FALHAS_POR_IP } = await import('./session');

function pedidoDe(ip: string): Request {
  return new Request('https://painel.invalid/admin/entrar', {
    headers: { 'x-forwarded-for': ip },
  });
}

const AGORA = Date.parse('2026-10-02T10:01:00Z');

beforeEach(() => {
  estado.cliente = null;
  esquecerMemoriaDaEntrada();
});

describe('só as falhadas contam', () => {
  it('espreitar não conta: cem consultas seguidas continuam a deixar entrar', async () => {
    for (let i = 0; i < 100; i += 1) {
      expect(
        (await consultarLimiteDaEntrada(pedidoDe('10.0.0.1'), 'ana@cim.pt', AGORA)).permitido,
      ).toBe(true);
    }
  });

  it('o email fecha ao fim das falhadas permitidas, e diz até quando', async () => {
    for (let i = 0; i < LOGIN_FALHAS_POR_EMAIL; i += 1) {
      await registarFalhaDaEntrada(pedidoDe(`10.0.0.${i}`), 'ana@cim.pt', AGORA);
    }
    const estadoDoEmail = await consultarLimiteDaEntrada(pedidoDe('10.0.9.9'), 'Ana@CIM.pt', AGORA);
    expect(estadoDoEmail.permitido).toBe(false);
    expect(estadoDoEmail.repoeEm).toBe('2026-10-02T10:15:00.000Z');
    // Outro email, do mesmo sítio, continua a poder.
    expect(
      (await consultarLimiteDaEntrada(pedidoDe('10.0.9.9'), 'rui@cim.pt', AGORA)).permitido,
    ).toBe(true);
  });

  it('o endereço partilhado aguenta os enganos de uma equipa, e fecha a quem tenta muitos emails', async () => {
    for (let i = 0; i < LOGIN_FALHAS_POR_IP - 1; i += 1) {
      await registarFalhaDaEntrada(pedidoDe('10.0.0.1'), `pessoa${i}@cim.pt`, AGORA);
    }
    expect(
      (await consultarLimiteDaEntrada(pedidoDe('10.0.0.1'), 'nova@cim.pt', AGORA)).permitido,
    ).toBe(true);
    await registarFalhaDaEntrada(pedidoDe('10.0.0.1'), 'outra@cim.pt', AGORA);
    expect(
      (await consultarLimiteDaEntrada(pedidoDe('10.0.0.1'), 'nova@cim.pt', AGORA)).permitido,
    ).toBe(false);
  });

  it('uma entrada certa limpa o balde do endereço', async () => {
    for (let i = 0; i < LOGIN_FALHAS_POR_IP; i += 1) {
      await registarFalhaDaEntrada(pedidoDe('10.0.0.1'), `pessoa${i}@cim.pt`, AGORA);
    }
    await limparLimiteDoEndereco(pedidoDe('10.0.0.1'));
    expect(
      (await consultarLimiteDaEntrada(pedidoDe('10.0.0.1'), 'nova@cim.pt', AGORA)).permitido,
    ).toBe(true);
  });

  it('a janela passa, e o balde esquece', async () => {
    for (let i = 0; i < LOGIN_FALHAS_POR_EMAIL; i += 1) {
      await registarFalhaDaEntrada(pedidoDe('10.0.0.1'), 'ana@cim.pt', AGORA);
    }
    const depois = AGORA + 15 * 60 * 1000;
    expect(
      (await consultarLimiteDaEntrada(pedidoDe('10.0.0.1'), 'ana@cim.pt', depois)).permitido,
    ).toBe(true);
  });
});

describe('com a base, antes da 0170', () => {
  it('sem a função de espreitar, conta-se na memória — fecha em vez de abrir', async () => {
    const semFuncao = {
      error: { code: 'PGRST202', message: 'Could not find the function public.rate_limit_peek' },
      data: null,
    };
    estado.cliente = { rpc: () => Promise.resolve(semFuncao) };
    for (let i = 0; i < LOGIN_FALHAS_POR_EMAIL; i += 1) {
      await registarFalhaDaEntrada(pedidoDe('10.0.0.1'), 'ana@cim.pt', AGORA);
    }
    expect(
      (await consultarLimiteDaEntrada(pedidoDe('10.0.0.1'), 'ana@cim.pt', AGORA)).permitido,
    ).toBe(false);
  });

  it('com a função, quem decide é a base', async () => {
    estado.cliente = {
      rpc: (nome: string, args: { p_bucket: string }) =>
        Promise.resolve({
          error: null,
          data:
            nome === 'rate_limit_peek'
              ? [
                  {
                    hits: args.p_bucket.startsWith('admin-entrada-email') ? 5 : 0,
                    reset_at: '2026-10-02T10:15:00Z',
                  },
                ]
              : null,
        }),
    };
    const resposta = await consultarLimiteDaEntrada(pedidoDe('10.0.0.1'), 'ana@cim.pt', AGORA);
    expect(resposta).toEqual({ permitido: false, repoeEm: '2026-10-02T10:15:00Z' });
  });
});
