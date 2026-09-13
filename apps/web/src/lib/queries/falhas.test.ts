import { AsyncLocalStorage } from 'node:async_hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O que estes testes provam, e porquê ao nível a que os prova.
 *
 * A correção de `falhas.ts` assenta numa afirmação sobre código de terceiros:
 * o `unstable_cache` não guarda o resultado de uma callback que lança. Uma
 * afirmação dessas não se toma de palavra nem se prova a ler o ficheiro — o
 * primeiro bloco daqui corre contra o `unstable_cache` **real** do Next
 * instalado, com uma cache incremental de mentira que regista todas as
 * escritas. Se uma versão futura do Next mudar de ideias, é aqui que se
 * descobre, e não em produção.
 *
 * Os restantes blocos exercitam as leituras verdadeiras de `events.ts`,
 * `regioes.ts` e `seccoes.ts` através dessa mesma cache real, com um cliente
 * Supabase de mentira por baixo. Não são testes das consultas — as colunas, os
 * filtros e o recorte por região não estão cobertos aqui, e continuam sem
 * cobertura. São testes de uma única propriedade, que é a que esta correção
 * existe para garantir: **um erro de leitura não fica guardado e não se
 * disfarça de «não há nada»**.
 *
 * O que fica de fora, dito por extenso para ninguém tomar este ficheiro por
 * mais do que é: as consultas em si (colunas, filtros, ordenações, o recorte
 * por `municipalities!inner()` que isola as regiões umas das outras), as
 * etiquetas de invalidação, o ramo do `unstable_cache` que corre dentro de um
 * pedido real do App Router — onde há revalidação em segundo plano e o valor
 * velho a servir enquanto ela corre —, e as páginas: se a fronteira de
 * `app/[regiao]/error.tsx` desenha o que se espera só um pedido a sério o
 * mostra, e é para isso que serviu a prova de parar e arrancar a base local.
 *
 * O `AsyncLocalStorage` tem de estar no `globalThis` antes de o Next carregar
 * (ver `next/dist/server/app-render/async-local-storage.js`, que o lê uma vez
 * no topo do módulo). Daí a atribuição em primeiro lugar e todos os `import`
 * deste ficheiro serem dinâmicos: um `import` estático é içado para cima
 * disto e o Next arrancaria com o substituto que rebenta.
 */
(globalThis as Record<string, unknown>).AsyncLocalStorage = AsyncLocalStorage;

/** A resposta de uma consulta, tal como o `supabase-js` a devolve. */
interface Resposta {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
}

/**
 * Um cliente Supabase de mentira: encadeia tudo e devolve o que lhe mandarem.
 *
 * Não imita a API de dados — imita só o formato do par `{ data, error }` e a
 * natureza encadeável do construtor de consultas, que é a superfície inteira
 * que estas leituras tocam. Cada tabela tem uma função por resposta, e não uma
 * resposta fixa, para um teste poder dizer «à primeira falha, à segunda já
 * responde» — que é exatamente a forma de uma falha transitória.
 */
function clienteFalso(respostas: Record<string, () => Resposta>) {
  const consultas: string[] = [];

  return {
    consultas,
    from(tabela: string) {
      const encadeado: Record<string, unknown> = {
        then(
          resolve: (valor: Resposta) => unknown,
          rejeitar: (erro: unknown) => unknown,
        ): Promise<unknown> {
          consultas.push(tabela);
          const responder = respostas[tabela];
          if (!responder) {
            return Promise.reject(new Error(`tabela sem resposta no teste: ${tabela}`)).catch(
              rejeitar,
            );
          }
          return Promise.resolve()
            .then(() => responder())
            .then(resolve, rejeitar);
        },
      };
      for (const metodo of [
        'select',
        'eq',
        'neq',
        'in',
        'or',
        'not',
        'gte',
        'lte',
        'order',
        'range',
        'limit',
        'maybeSingle',
      ]) {
        encadeado[metodo] = () => encadeado;
      }
      return encadeado;
    },
  };
}

/**
 * Uma cache incremental de mentira, com o registo das escritas.
 *
 * É o mínimo que o `unstable_cache` chama quando corre fora de um pedido do
 * App Router (o ramo sem `workStore`): gerar a chave, ler e escrever. As
 * escritas ficam contadas porque é nelas que está a prova — «não ficou
 * guardado» é uma afirmação sobre o `set`, não sobre o valor devolvido.
 */
function cacheFalsa() {
  const guardado = new Map<string, string>();
  const escritas: string[] = [];

  return {
    guardado,
    escritas,
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
      escritas.push(chave);
      guardado.set(chave, entrada.data.body);
    },
  };
}

/**
 * O cliente que as leituras vão encontrar. Troca-se por teste; o `vi.hoisted`
 * existe porque a fábrica do `vi.mock` é içada para cima das declarações
 * normais e não veria uma variável de módulo.
 */
const estado = vi.hoisted(() => ({ cliente: null as unknown }));

vi.mock('../supabase/server', () => ({
  publicClient: () => estado.cliente,
  adminClient: () => null,
  requireAdminClient: () => {
    throw new Error('a chave de serviço não entra nestes testes');
  },
}));

let cache: ReturnType<typeof cacheFalsa>;

beforeEach(() => {
  cache = cacheFalsa();
  (globalThis as Record<string, unknown>).__incrementalCache = cache;
  estado.cliente = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('unstable_cache, a propriedade em que tudo isto assenta', () => {
  it('não guarda o resultado de uma callback que lança, e volta a tentar a seguir', async () => {
    const { unstable_cache } = await import('next/cache');

    let vez = 0;
    const ler = vi.fn(async () => {
      vez += 1;
      if (vez === 1) throw new Error('base em baixo');
      return ['tomar'];
    });
    const cacheada = unstable_cache(ler, ['prova-da-propriedade'], { revalidate: 3600 });

    await expect(cacheada()).rejects.toThrow('base em baixo');
    expect(cache.escritas).toHaveLength(0);

    // O pedido seguinte não encontra nada guardado e volta a ler — é isto que
    // faz a recuperação ser imediata em vez de daqui a uma hora.
    await expect(cacheada()).resolves.toEqual(['tomar']);
    expect(cache.escritas).toHaveLength(1);

    // E o resultado bom fica guardado, que é o que a cache existe para fazer.
    await expect(cacheada()).resolves.toEqual(['tomar']);
    expect(ler).toHaveBeenCalledTimes(2);
  });
});

describe('exigirLeitura e degradarForaDaCache', () => {
  it('o erro leva o nome da leitura consigo', async () => {
    const { ErroDeLeitura, exigirLeitura } = await import('./falhas');

    expect(() => exigirLeitura('listEvents', null)).not.toThrow();
    expect(() => exigirLeitura('listEvents', undefined)).not.toThrow();

    try {
      exigirLeitura('listEvents', { message: 'ligação recusada' });
      expect.unreachable('devia ter lançado');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDeLeitura);
      expect((erro as InstanceType<typeof ErroDeLeitura>).leitura).toBe('listEvents');
      expect((erro as Error).message).toBe('listEvents: ligação recusada');
    }
  });

  it('degrada, regista, e não guarda nada — o recurso é deste pedido e mais nada', async () => {
    const { degradarForaDaCache } = await import('./falhas');
    const { unstable_cache } = await import('next/cache');

    let vez = 0;
    const cacheada = unstable_cache(
      async (): Promise<Record<string, number>> => {
        vez += 1;
        if (vez === 1) throw new Error('sem rede');
        return { tomar: 4 };
      },
      ['prova-da-degradacao'],
      { revalidate: 3600 },
    );
    const lateral = degradarForaDaCache('contagens', cacheada, () => ({}));

    await expect(lateral()).resolves.toEqual({});
    // O registo passa por `reportarErro`, que escreve uma linha de JSON. O que
    // interessa afirmar é o conteúdo — quem falhou e porquê —, não a forma:
    // um teste preso ao formato do registo trava a próxima mudança de formato
    // sem proteger nada.
    const linha = vi.mocked(console.error).mock.calls.at(-1)?.[0];
    expect(JSON.parse(String(linha))).toMatchObject({
      nivel: 'erro',
      operacao: 'contagens',
      mensagem: 'sem rede',
    });
    expect(cache.escritas).toHaveLength(0);

    // O vazio devolvido acima não foi guardado: a chamada seguinte traz o
    // número verdadeiro, e não o `{}` de há um segundo.
    await expect(lateral()).resolves.toEqual({ tomar: 4 });
  });
});

describe('as leituras que propagam', () => {
  it('listEvents: um erro rebenta em vez de se disfarçar de agenda vazia', async () => {
    const { ErroDeLeitura } = await import('./falhas');
    const { listEvents } = await import('./events');
    const filtro = { page: 1, limit: 24 } as Parameters<typeof listEvents>[1];

    let vez = 0;
    estado.cliente = clienteFalso({
      events: () => {
        vez += 1;
        if (vez === 1) return { data: null, error: { message: 'timeout' }, count: null };
        return { data: [{ id: 'e1', slug: 'concerto' }], error: null, count: 1 };
      },
    });

    // Antes, isto devolvia `{ events: [], total: 0 }` e a agenda escrevia «Sem
    // resultados para estes filtros» — com o vazio guardado por uma hora.
    await expect(listEvents('medio-tejo', filtro)).rejects.toBeInstanceOf(ErroDeLeitura);
    expect(cache.escritas).toHaveLength(0);

    // A base voltou: o pedido seguinte já mostra a agenda. Sem esperar a hora.
    const resultado = await listEvents('medio-tejo', filtro);
    expect(resultado.total).toBe(1);
    expect(cache.escritas).toHaveLength(1);
  });

  it('listEvents: uma agenda mesmo vazia continua a ser uma resposta, e guarda-se', async () => {
    const { listEvents } = await import('./events');
    const filtro = { page: 1, limit: 24, category: 'danca' } as Parameters<typeof listEvents>[1];

    const cliente = clienteFalso({ events: () => ({ data: [], error: null, count: 0 }) });
    estado.cliente = cliente;

    await expect(listEvents('medio-tejo', filtro)).resolves.toEqual({ events: [], total: 0 });
    expect(cache.escritas).toHaveLength(1);

    // A segunda leitura sai da cache: «não há nada» é verdade e é cacheável.
    // É esta a distinção que a correção inteira serve para poder fazer.
    await expect(listEvents('medio-tejo', filtro)).resolves.toEqual({ events: [], total: 0 });
    expect(cliente.consultas).toHaveLength(1);
  });

  it('listMunicipalities: o erro rebenta, e por isso os concelhos deixam de dar 404', async () => {
    const { ErroDeLeitura } = await import('./falhas');
    const { listMunicipalities } = await import('./events');

    let vez = 0;
    estado.cliente = clienteFalso({
      municipalities: () => {
        vez += 1;
        if (vez === 1) return { data: null, error: { message: 'ligação perdida' } };
        return { data: [{ id: 'tomar', name: 'Tomar' }], error: null };
      },
    });

    // A lista vazia é a lista fechada por onde `/concelho/<id>` se valida: a
    // devolvê-la, os onze concelhos respondiam 404 e o ISR guardava-o.
    await expect(listMunicipalities('medio-tejo')).rejects.toBeInstanceOf(ErroDeLeitura);
    expect(cache.escritas).toHaveLength(0);

    await expect(listMunicipalities('medio-tejo')).resolves.toHaveLength(1);
  });

  it('carregarRegiao: separa «não consegui ler» de «esta região não existe»', async () => {
    const { ErroDeLeitura } = await import('./falhas');
    const { carregarRegiao } = await import('./regioes');

    estado.cliente = clienteFalso({
      regions: () => ({ data: null, error: { message: 'ligação recusada' } }),
    });

    // Um erro sobe: o domínio de uma CIM responde 500 durante os segundos da
    // falha, em vez de 404 durante a hora seguinte.
    await expect(carregarRegiao('medio-tejo')).rejects.toBeInstanceOf(ErroDeLeitura);
    expect(cache.escritas).toHaveLength(0);

    // Uma linha que não existe continua a dar `null` — o 404 legítimo, o
    // mesmo das secções desligadas, e esse pode ficar guardado.
    estado.cliente = clienteFalso({ regions: () => ({ data: null, error: null }) });
    await expect(carregarRegiao('cim-que-nao-existe')).resolves.toBeNull();
    expect(cache.escritas).toHaveLength(1);
  });

  it('sem base de dados configurada, nada rebenta — o sítio serve na mesma', async () => {
    const { listEvents, listMunicipalities } = await import('./events');
    const { carregarRegiao } = await import('./regioes');
    const filtro = { page: 1, limit: 24 } as Parameters<typeof listEvents>[1];

    // `publicClient()` a `null` é uma instalação sem credenciais — o CI, um
    // fork, um `next build` sem segredos. Não é uma falha, e continua a não
    // ser tratada como uma.
    estado.cliente = null;

    await expect(listEvents('medio-tejo', filtro)).resolves.toEqual({ events: [], total: 0 });
    await expect(listMunicipalities('medio-tejo')).resolves.toEqual([]);
    await expect(carregarRegiao('medio-tejo')).resolves.toBeNull();
  });
});

describe('as leituras que degradam', () => {
  it('countEventsByVenue: devolve vazio sem rebentar, e sem guardar o vazio', async () => {
    const { countEventsByVenue } = await import('./events');

    let vez = 0;
    estado.cliente = clienteFalso({
      events: () => {
        vez += 1;
        if (vez === 1) return { data: null, error: { message: 'timeout' } };
        return { data: [{ venue_id: 'teatro-virginia' }], error: null };
      },
      municipalities: () => ({ data: [], error: null }),
    });

    // O cartão de um espaço só desenha a linha das contagens acima de zero:
    // sem elas fica sem essa linha, e não a dizer que o espaço não tem nada.
    await expect(countEventsByVenue('medio-tejo')).resolves.toEqual({});
    expect(cache.escritas).toHaveLength(0);

    await expect(countEventsByVenue('medio-tejo')).resolves.toEqual({ 'teatro-virginia': 1 });
  });

  it('listFeedTimestamps: sem carimbos, o feed sai na mesma — e sem os guardar em falta', async () => {
    const { listFeedTimestamps } = await import('../feeds/data');

    let vez = 0;
    estado.cliente = clienteFalso({
      events: () => {
        vez += 1;
        if (vez === 1) return { data: null, error: { message: 'timeout' } };
        return { data: [{ id: 'e1', updated_at: '2026-09-01T10:00:00Z' }], error: null };
      },
    });

    await expect(listFeedTimestamps(['e1'])).resolves.toEqual({});
    expect(cache.escritas).toHaveLength(0);
    await expect(listFeedTimestamps(['e1'])).resolves.toEqual({ e1: '2026-09-01T10:00:00Z' });
  });

  it('listFeedSessions: propaga — um .ics com os uid errados suja calendários alheios', async () => {
    const { ErroDeLeitura } = await import('./falhas');
    const { listFeedSessions } = await import('../feeds/data');

    estado.cliente = clienteFalso({
      event_sessions: () => ({ data: null, error: { message: 'timeout' } }),
    });

    await expect(listFeedSessions(['e1'], '2026-09-01')).rejects.toBeInstanceOf(ErroDeLeitura);
    expect(cache.escritas).toHaveLength(0);
  });

  it('seccoesDesligadas: falha para o lado de mostrar, e a falha não fica guardada', async () => {
    const { seccoesDesligadas } = await import('./seccoes');

    let vez = 0;
    estado.cliente = clienteFalso({
      site_sections: () => {
        vez += 1;
        if (vez === 1) return { data: null, error: { message: 'sem rede' } };
        return { data: [{ id: 'coretos' }], error: null };
      },
    });

    // A regra escrita em `seccoes.ts` mantém-se: sem resposta, mostra-se
    // tudo. O que mudou é que este `[]` já não vale por uma hora — e a
    // diferença conta-se numa CIM que acabou de desligar uma secção no
    // painel e a via reaparecer até a cache expirar.
    await expect(seccoesDesligadas('medio-tejo')).resolves.toEqual([]);
    expect(cache.escritas).toHaveLength(0);

    await expect(seccoesDesligadas('medio-tejo')).resolves.toEqual(['coretos']);
  });
});
