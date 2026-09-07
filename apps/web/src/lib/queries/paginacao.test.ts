import { AsyncLocalStorage } from 'node:async_hooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Uma página além do fim é uma pergunta com resposta, não uma avaria.
 *
 * `https://mediotejo.coreto.org/agenda?page=99` respondia 500, e o mesmo em
 * `/api/events?page=99`. Não é um endereço rebuscado: é o que um rastreador
 * constrói sozinho a partir da paginação, e o que fica num favorito quando a
 * agenda encolhe de cinco páginas para duas. O 500 ia parar ao registo de
 * erros ao lado das avarias a sério, que é como um registo de erros deixa de
 * se ler.
 *
 * A causa é uma linha do protocolo: o PostgREST recusa um `Range` que comece
 * depois da última linha com um 416 e o código `PGRST103`, e a doutrina desta
 * casa — desde `falhas.ts` — é que um `error` de leitura lança. Está certa
 * para tudo menos para este código, que não diz «não consegui» e sim «não há
 * nada aí».
 *
 * O que se prova aqui: a recusa não sobe como erro, a lista vem vazia, e o
 * total continua a ser o verdadeiro — sem o qual a paginação desenhava «página
 * 99 de 1» e a agenda dizia que não tem eventos nenhuns.
 *
 * O `AsyncLocalStorage` no `globalThis` antes de tudo, e os `import`
 * dinâmicos, são pela mesma razão que em `falhas.test.ts`: o Next lê-o uma vez
 * no topo do módulo, e um `import` estático seria içado para cima disto.
 */
(globalThis as Record<string, unknown>).AsyncLocalStorage = AsyncLocalStorage;

/** A recusa do PostgREST, tal como o supabase-js a entrega. */
const RECUSA = {
  data: null,
  count: null,
  error: {
    code: 'PGRST103',
    message: 'Requested range not satisfiable',
    details: 'An offset of 980 was requested, but there are only 128 rows.',
    hint: null,
  },
};

interface Resposta {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number | null;
}

/**
 * Um cliente Supabase de mentira que distingue a consulta com linhas da
 * consulta que só conta.
 *
 * A distinção é o assunto: a segunda pergunta — a do `head: true` — é a que
 * vai buscar o total que a recusa não traz, e um teste que não a separasse da
 * primeira não provava que ela chega a ser feita.
 */
function clienteFalso(responder: (opcoes: { head: boolean }) => Resposta) {
  const pedidos: Array<{ head: boolean; filtros: string[] }> = [];

  return {
    pedidos,
    from(_tabela: string) {
      let head = false;
      const filtros: string[] = [];
      const encadeado: Record<string, unknown> = {
        select(_campos: string, opcoes?: { head?: boolean }) {
          head = opcoes?.head === true;
          return encadeado;
        },
        then(
          resolve: (valor: Resposta) => unknown,
          rejeitar: (erro: unknown) => unknown,
        ): Promise<unknown> {
          pedidos.push({ head, filtros: [...filtros] });
          return Promise.resolve()
            .then(() => responder({ head }))
            .then(resolve, rejeitar);
        },
      };
      for (const metodo of ['eq', 'or', 'lte', 'textSearch', 'not', 'order', 'range', 'limit']) {
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

/** Um filtro com o mínimo que a agenda passa, na página que se pedir. */
function filtro(page: number) {
  return { page, limit: 20, from: '2026-09-07' } as Parameters<
    Awaited<typeof import('./events')>['listEvents']
  >[1];
}

describe('uma página além do fim', () => {
  it('devolve a lista vazia com o total verdadeiro, e não um erro', async () => {
    const cliente = clienteFalso(({ head }) =>
      head ? { data: null, error: null, count: 128 } : RECUSA,
    );
    estado.cliente = cliente;

    const { listEvents } = await import('./events');
    const resultado = await listEvents('medio-tejo', filtro(99));

    expect(resultado.events).toEqual([]);
    expect(resultado.total).toBe(128);
    // Duas perguntas: a que foi recusada, e a que só conta.
    expect(cliente.pedidos.map((pedido) => pedido.head)).toEqual([false, true]);
  });

  it('a contagem leva os mesmos filtros da lista', async () => {
    // Sem isto, o total seria o da região inteira e a paginação de uma agenda
    // filtrada por concelho anunciava páginas que não existem.
    const cliente = clienteFalso(({ head }) =>
      head ? { data: null, error: null, count: 16 } : RECUSA,
    );
    estado.cliente = cliente;

    const { listEvents } = await import('./events');
    await listEvents('medio-tejo', { ...filtro(99), municipality: 'tomar' });

    const [lista, contagem] = cliente.pedidos;
    expect(lista?.filtros).toContain('eq(municipality_id,tomar)');
    // A contagem não leva o `range`: é a única diferença, e é de propósito.
    expect(contagem?.filtros).toContain('eq(municipality_id,tomar)');
    expect(contagem?.filtros.filter((f) => !f.startsWith('range'))).toEqual(
      lista?.filtros.filter((f) => !f.startsWith('range') && !f.startsWith('order')),
    );
  });

  it('um erro a sério continua a lançar', async () => {
    // A correção não pode ter aberto a porta a engolir falhas de leitura: o
    // vazio de um erro é o que fazia a agenda dizer «alargue o intervalo de
    // datas» por causa de um soluço da base.
    estado.cliente = clienteFalso(() => ({
      data: null,
      count: null,
      error: { code: '57014', message: 'canceling statement due to statement timeout' },
    }));

    const { listEvents } = await import('./events');
    await expect(listEvents('medio-tejo', filtro(1))).rejects.toThrow(/listEvents/);
  });

  it('se a própria contagem falhar, isso é um erro e não um zero', async () => {
    estado.cliente = clienteFalso(({ head }) =>
      head
        ? { data: null, count: null, error: { code: '57014', message: 'base em baixo' } }
        : RECUSA,
    );

    const { listEvents } = await import('./events');
    await expect(listEvents('medio-tejo', filtro(99))).rejects.toThrow(/listEvents/);
  });
});
