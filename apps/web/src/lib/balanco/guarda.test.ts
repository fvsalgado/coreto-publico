import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O contrato de segurança da porta de quem decide, tal como o plano o
 * escreveu: «Sem token, 401; com o token de outra região, 404; com o certo, o
 * relatório dessa região e de mais nenhuma.»
 *
 * As três respostas são três decisões, e a mais fácil de errar é a do meio: a
 * tentação é responder 403 a um segredo válido noutra região — e um 403 diz a
 * quem tenta que o segredo existe e que a região existe, que são as duas
 * coisas que ele estava a tentar descobrir.
 */

const estado = vi.hoisted(() => ({
  regiaoDoSegredo: null as string | null,
  temChave: true,
  pedidos: [] as string[],
}));

vi.mock('../admin/queries', () => ({
  regiaoDoSegredoDeBalanco: async (impressao: string) => {
    estado.pedidos.push(impressao);
    return estado.regiaoDoSegredo;
  },
}));

vi.mock('../env', () => ({
  get hasServiceRole() {
    return estado.temChave;
  },
}));

const { quemAbre } = await import('./guarda');

const SEGREDO = 'a'.repeat(43);
const IMPRESSAO = '66d34fba71f8f450f7e45598853e53bfc23bbd129027cbb131a2f4ffd7878cd0';

beforeEach(() => {
  estado.regiaoDoSegredo = null;
  estado.temChave = true;
  estado.pedidos = [];
});

describe('sem chave nenhuma', () => {
  it('não abre', async () => {
    expect(await quemAbre(null, 'medio-tejo')).toEqual({ estado: 'sem-chave' });
    expect(await quemAbre('', 'medio-tejo')).toEqual({ estado: 'sem-chave' });
    expect(await quemAbre(undefined, null)).toEqual({ estado: 'sem-chave' });
  });

  it('nem sequer pergunta à base por um segredo malformado', async () => {
    await quemAbre('curto-de-mais', 'medio-tejo');
    expect(estado.pedidos).toEqual([]);
  });
});

describe('com um segredo que não abre nada', () => {
  it('responde o mesmo que sem segredo', async () => {
    estado.regiaoDoSegredo = null;
    expect(await quemAbre(SEGREDO, 'medio-tejo')).toEqual({ estado: 'sem-chave' });
    // Perguntou, e perguntou pela impressão e não pelo segredo.
    expect(estado.pedidos).toEqual([IMPRESSAO]);
    expect(estado.pedidos[0]).not.toContain(SEGREDO);
  });
});

describe('com o segredo certo', () => {
  it('abre a região do segredo', async () => {
    estado.regiaoDoSegredo = 'medio-tejo';
    expect(await quemAbre(SEGREDO, 'medio-tejo')).toEqual({
      estado: 'abre',
      regiao: 'medio-tejo',
    });
  });

  it('sem região pedida, abre a do segredo', async () => {
    estado.regiaoDoSegredo = 'medio-tejo';
    expect(await quemAbre(SEGREDO, null)).toEqual({ estado: 'abre', regiao: 'medio-tejo' });
    expect(await quemAbre(SEGREDO, '')).toEqual({ estado: 'abre', regiao: 'medio-tejo' });
  });

  /** O caso que o plano escreveu como critério: o token de outra região dá 404. */
  it('não abre outra região, e a resposta não é «proibido»', async () => {
    estado.regiaoDoSegredo = 'medio-tejo';
    expect(await quemAbre(SEGREDO, 'vale-do-coreto')).toEqual({ estado: 'outra-regiao' });
  });
});

describe('sem chave de serviço', () => {
  /**
   * Não conseguir perguntar não é poder entrar. Uma porta que abre porque a
   * base não respondeu é a pior das portas: abre exatamente quando ninguém
   * está a conseguir ver o que se passa.
   */
  it('não abre, mesmo com o segredo certo', async () => {
    estado.temChave = false;
    estado.regiaoDoSegredo = 'medio-tejo';
    expect(await quemAbre(SEGREDO, 'medio-tejo')).toEqual({ estado: 'sem-chave' });
    expect(estado.pedidos).toEqual([]);
  });
});
