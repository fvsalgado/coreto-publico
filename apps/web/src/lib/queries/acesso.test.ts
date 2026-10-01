import { AsyncLocalStorage } from 'node:async_hooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O atalho «Acessível», e a coluna que ele passou a procurar.
 *
 * Devolvia **0 de 128** no Médio Tejo, porque procurava
 * `events.wheelchair_accessible` — a coluna que as câmaras não preenchem. A
 * informação estava em `venues`, e a ficha de evento já a mostrava: vinte e
 * sete eventos com ficha a dizer «Acessível» e um filtro que não os
 * encontrava. A 0129 materializa `coalesce(evento, espaço)` numa coluna, e é
 * essa que o filtro procura agora.
 *
 * Estes testes olham para a **consulta** e não para o resultado, e é de
 * propósito: o que se pode partir aqui sem partir teste nenhum dos outros é o
 * nome da coluna — e a diferença entre as duas é toda a diferença entre 0
 * e 27.
 *
 * O `AsyncLocalStorage` antes de tudo e os `import` dinâmicos são pela mesma
 * razão de `falhas.test.ts`: o Next lê-o uma vez no topo do módulo.
 */
(globalThis as Record<string, unknown>).AsyncLocalStorage = AsyncLocalStorage;

interface Resposta {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number | null;
}

/** Um cliente de mentira que guarda os filtros que lhe penduraram. */
function clienteFalso(responder: () => Resposta) {
  const pedidos: Array<{ filtros: string[] }> = [];
  return {
    pedidos,
    from(_tabela: string) {
      const filtros: string[] = [];
      const encadeado: Record<string, unknown> = {
        select: () => encadeado,
        then(resolve: (valor: Resposta) => unknown, rejeitar: (erro: unknown) => unknown) {
          pedidos.push({ filtros: [...filtros] });
          return Promise.resolve().then(responder).then(resolve, rejeitar);
        },
      };
      for (const metodo of [
        'eq',
        'or',
        'lte',
        'textSearch',
        'not',
        'order',
        'range',
        'limit',
        'in',
        'is',
      ]) {
        encadeado[metodo] = (...args: unknown[]) => {
          filtros.push(`${metodo}(${args.map((a) => String(a)).join(',')})`);
          return encadeado;
        };
      }
      return encadeado;
    },
  };
}

function cacheFalsa() {
  const guardado = new Map<string, string>();
  return {
    isOnDemandRevalidate: false,
    async generateSimpleCacheKey(chave: string): Promise<string> {
      return chave;
    },
    async get(chave: string) {
      const corpo = guardado.get(chave);
      if (corpo === undefined) return null;
      return { value: { kind: 'FETCH', data: { body: corpo } }, isStale: false };
    },
    async set(chave: string, entrada: { data: { body: string } }): Promise<void> {
      guardado.set(chave, entrada.data.body);
    },
  };
}

const estado = vi.hoisted(() => ({ cliente: null as unknown }));

vi.mock('../supabase/server', () => ({
  publicClient: () => estado.cliente,
  adminClient: () => null,
  requireAdminClient: () => {
    throw new Error('a chave de serviço não entra nestes testes');
  },
}));

beforeEach(() => {
  (globalThis as Record<string, unknown>).__incrementalCache = cacheFalsa();
  estado.cliente = null;
});

function filtro(page: number) {
  return { page, limit: 20, from: '2026-09-07' } as Parameters<
    Awaited<typeof import('./events')>['listEvents']
  >[1];
}

describe('o filtro de acessibilidade', () => {
  it('procura a coluna resolvida, e não a declaração do evento', async () => {
    const cliente = clienteFalso(() => ({ data: [], error: null, count: 0 }));
    estado.cliente = cliente;

    const { listEvents } = await import('./events');
    await listEvents('medio-tejo', { ...filtro(1), accessible: true });

    expect(cliente.pedidos[0]?.filtros).toContain('eq(wheelchair_accessible_resolved,true)');
    expect(cliente.pedidos[0]?.filtros).not.toContain('eq(wheelchair_accessible,true)');
  });

  it('e sem o atalho não filtra por acesso nenhum', async () => {
    const cliente = clienteFalso(() => ({ data: [], error: null, count: 0 }));
    estado.cliente = cliente;

    const { listEvents } = await import('./events');
    await listEvents('medio-tejo', filtro(1));

    expect(cliente.pedidos[0]?.filtros.some((f) => f.includes('wheelchair'))).toBe(false);
  });
});

/**
 * O nome publicado não muda com a coluna que o alimenta.
 *
 * `wheelchair_accessible` sai em `/api/events` e está documentado em `/levar`
 * com exemplo. A pergunta que responde é a mesma; mudou a forma de a
 * responder. Um alias no `select` é o que separa as duas coisas, e é isto que
 * falha se alguém o desfizer — passando a servir um campo com outro nome a
 * quem já lê o antigo.
 */
describe('o campo publicado da acessibilidade', () => {
  it('vem da coluna resolvida, com o nome de sempre', async () => {
    const { CARD_EVENT_FIELDS } = await import('./fields');
    expect(CARD_EVENT_FIELDS).toContain('wheelchair_accessible:wheelchair_accessible_resolved');
    // E o nome cru não fica no pedido: pedir a mesma coisa duas vezes é um
    // pedido malformado para o PostgREST, não uma redundância inócua.
    expect(CARD_EVENT_FIELDS.split(', ')).not.toContain('wheelchair_accessible');
  });
});

/**
 * De quem é o «Acessível» do cartão (C2-011).
 *
 * O cartão lê a coluna resolvida, que não diz de onde veio o «sim». Esta
 * leitura é a que o diz: os eventos que se calam e cuja coluna resolvida diz
 * que sim — o «sim» do espaço.
 */
describe('eventosComAcessoDoEspaco', () => {
  it('pergunta pelos que se calam e herdam o sim, e só entre os que o cartão dá como acessíveis', async () => {
    const cliente = clienteFalso(() => ({ data: [{ id: 'concerto' }], error: null }));
    estado.cliente = cliente;

    const { eventosComAcessoDoEspaco } = await import('./events');
    const doEspaco = await eventosComAcessoDoEspaco([
      { id: 'concerto', wheelchair_accessible: true },
      { id: 'feira', wheelchair_accessible: null },
      { id: 'escadaria', wheelchair_accessible: false },
    ]);

    expect([...doEspaco]).toEqual(['concerto']);
    expect(cliente.pedidos).toHaveLength(1);
    expect(cliente.pedidos[0]?.filtros).toEqual([
      'in(id,concerto)',
      'is(wheelchair_accessible,null)',
      'eq(wheelchair_accessible_resolved,true)',
    ]);
  });

  it('numa lista sem nenhum acessível não há leitura nenhuma', async () => {
    const cliente = clienteFalso(() => ({ data: [], error: null }));
    estado.cliente = cliente;

    const { eventosComAcessoDoEspaco } = await import('./events');
    expect(
      (await eventosComAcessoDoEspaco([{ id: 'feira', wheelchair_accessible: null }])).size,
    ).toBe(0);
    expect(cliente.pedidos).toHaveLength(0);
  });

  it('degrada: sem a leitura, o cartão diz «Acessível», como dizia', async () => {
    estado.cliente = clienteFalso(() => ({ data: null, error: { message: 'caiu' } }));

    const { eventosComAcessoDoEspaco } = await import('./events');
    const doEspaco = await eventosComAcessoDoEspaco([
      { id: 'concerto-que-falha', wheelchair_accessible: true },
    ]);
    expect(doEspaco.size).toBe(0);
  });
});

/**
 * O «nenhum evento desta agenda declara…» (C2-010) é sobre a agenda inteira,
 * e por isso conta sem o recorte de quem está a ver.
 */
describe('contarEixosDaAgenda', () => {
  it('conta a agenda inteira de hoje em diante, sem filtro nenhum', async () => {
    const cliente = clienteFalso(() => ({
      data: [
        {
          wheelchair_accessible_resolved: true,
          has_sign_language: false,
          has_audio_description: false,
          has_subtitles: false,
          is_relaxed_performance: false,
        },
        {
          wheelchair_accessible_resolved: null,
          has_sign_language: true,
          has_audio_description: false,
          has_subtitles: false,
          is_relaxed_performance: false,
        },
      ],
      error: null,
      count: 2,
    }));
    estado.cliente = cliente;

    const { contarEixosDaAgenda } = await import('./events');
    expect(await contarEixosDaAgenda('regiao-dos-eixos')).toEqual({
      accessible: 1,
      lgp: 1,
      audiodescricao: 0,
      legendas: 0,
      relaxada: 0,
    });
    const filtros = cliente.pedidos[0]?.filtros ?? [];
    expect(filtros).toContain('eq(municipalities.region_id,regiao-dos-eixos)');
    // Nem concelho, nem categoria, nem caixa nenhuma: o que se afirma é da agenda toda.
    expect(filtros.some((f) => f.includes('municipality_id') || f.includes('category_slug'))).toBe(
      false,
    );
  });
});
