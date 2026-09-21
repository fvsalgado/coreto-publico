import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O registo de acessos, e as três coisas que ele tem de garantir.
 *
 * A fila de moderação é onde estão os dados pessoais desta casa — o endereço
 * de quem enviou, o texto em bruto do email, o hash do IP. Até 21 de setembro
 * de 2026, abri-la não deixava vestígio nenhum, e a pergunta «o que é que foi
 * visto?» não tinha resposta possível. Este ficheiro pergunta se a resposta
 * passou mesmo a existir: **escreve-se**, escreve-se com o prefixo que a
 * separa das decisões, e **não se lê sem escrever**.
 */

interface Chamada {
  nome: string;
  argumentos: Record<string, unknown>;
}

const estado = vi.hoisted(() => ({
  actor: 'gestor' as string | null,
  resposta: { error: null } as { error: { message: string } | null },
  chamadas: [] as Chamada[],
}));

vi.mock('./auth', () => ({
  requireAdmin: async () => {
    if (estado.actor === null) throw new Error('sessão de administração em falta');
    return estado.actor;
  },
}));

vi.mock('../supabase/server', () => ({
  requireAdminClient: () => ({
    rpc: (nome: string, argumentos: Record<string, unknown>) => {
      estado.chamadas.push({ nome, argumentos });
      return Promise.resolve(estado.resposta);
    },
  }),
}));

beforeEach(() => {
  estado.actor = 'gestor';
  estado.resposta = { error: null };
  estado.chamadas = [];
});

const { PREFIXO_DE_LEITURA, recorteDaFila, registarLeitura } = await import('./leituras');

describe('ler a fila deixa rasto', () => {
  it('escreve quem leu o quê, pela mesma função das decisões', async () => {
    await registarLeitura('submissao', 'submission', 'abc');
    expect(estado.chamadas).toHaveLength(1);
    expect(estado.chamadas[0]?.nome).toBe('log_admin_action');
    expect(estado.chamadas[0]?.argumentos).toMatchObject({
      p_actor: 'gestor',
      p_action: 'leitura.submissao',
      p_entity_type: 'submission',
      p_entity_id: 'abc',
    });
  });

  it('o prefixo é o que separa acessos de decisões na auditoria', async () => {
    await registarLeitura('fila', 'submission_queue', 'status=pending');
    expect(String(estado.chamadas[0]?.argumentos.p_action).startsWith(PREFIXO_DE_LEITURA)).toBe(
      true,
    );
  });

  it('não copia o que foi lido para a segunda tabela', async () => {
    // Guardar o conteúdo seria duplicar dados pessoais para um sítio com
    // prazo de conservação mais longo do que o deles (24 meses, 0133).
    await registarLeitura('submissao', 'submission', 'abc');
    expect(estado.chamadas[0]?.argumentos).not.toHaveProperty('p_before');
    expect(estado.chamadas[0]?.argumentos).not.toHaveProperty('p_after');
  });
});

describe('sem rasto não há leitura', () => {
  it('a escrita falhada atira, em vez de deixar ler em silêncio', async () => {
    estado.resposta = { error: { message: 'terminating connection' } };
    await expect(registarLeitura('fila', 'submission_queue', 'tudo')).rejects.toThrow();
  });

  it('sem sessão não escreve nem deixa seguir', async () => {
    estado.actor = null;
    await expect(registarLeitura('submissao', 'submission', 'abc')).rejects.toThrow();
    expect(estado.chamadas).toHaveLength(0);
  });
});

describe('o recorte que se guarda de uma fila', () => {
  it('é o que a pessoa foi ver', () => {
    expect(recorteDaFila('pending', undefined)).toBe('status=pending');
    expect(recorteDaFila('approved', 'email')).toBe('status=approved&channel=email');
  });

  it('e sem recorte nenhum diz «tudo», que é o que foi pedido', () => {
    expect(recorteDaFila(undefined, undefined)).toBe('tudo');
  });
});
