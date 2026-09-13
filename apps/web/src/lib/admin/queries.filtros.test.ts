import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Os filtros da lista de eventos, e o que cada um manda para a base.
 *
 * `queries.test.ts` pergunta a cada leitura se atira ou finge com a base em
 * baixo, e diz por escrito que não cobre filtros nem recortes. Este ficheiro
 * cobre-os, e existe porque as ligações de `/admin/qualidade` passaram a
 * depender deles: cada percentagem abre uma lista, e a lista só é a mesma
 * população que a percentagem conta se o filtro for exatamente este.
 *
 * Um filtro que não chega à consulta não dá erro nenhum — devolve o catálogo
 * inteiro, que se lê como «afinal não falta nada a ninguém».
 */

interface Chamada {
  metodo: string;
  argumentos: unknown[];
}

/** Um cliente que grava a cadeia em vez de a executar. */
function clienteQueGrava(resposta: unknown, chamadas: Chamada[]) {
  const encadeado: Record<string, unknown> = {
    then(resolve: (valor: unknown) => unknown): Promise<unknown> {
      return Promise.resolve(resposta).then(resolve);
    },
  };
  for (const metodo of [
    'select',
    'eq',
    'neq',
    'in',
    'is',
    'or',
    'not',
    'gte',
    'lte',
    'ilike',
    'order',
    'range',
    'limit',
    'maybeSingle',
  ]) {
    encadeado[metodo] = (...argumentos: unknown[]) => {
      chamadas.push({ metodo, argumentos });
      return encadeado;
    };
  }
  return {
    from: (tabela: string) => {
      chamadas.push({ metodo: 'from', argumentos: [tabela] });
      return encadeado;
    },
    rpc: () => encadeado,
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null }) }) },
  };
}

const estado = vi.hoisted(() => ({ cliente: null as unknown, chamadas: [] as Chamada[] }));

vi.mock('../supabase/server', () => ({
  publicClient: () => null,
  adminClient: () => estado.cliente,
  requireAdminClient: () => estado.cliente,
}));

beforeEach(() => {
  estado.chamadas = [];
  estado.cliente = clienteQueGrava({ data: [], count: 0, error: null }, estado.chamadas);
});

function chamadasDe(metodo: string): unknown[][] {
  return estado.chamadas.filter((c) => c.metodo === metodo).map((c) => c.argumentos);
}

const { listEvents, ESTADOS_DO_CATALOGO } = await import('./queries');

describe('o estado «no catálogo»', () => {
  it('recorta pelos dois estados que a vista de qualidade agrega, e não por mais', async () => {
    await listEvents({ status: 'catalogo' });
    expect(chamadasDe('in')).toContainEqual(['status', [...ESTADOS_DO_CATALOGO]]);
    expect(ESTADOS_DO_CATALOGO).toEqual(['published', 'draft']);
  });

  it('não é o mesmo que «todos»', async () => {
    await listEvents({ status: 'todos' });
    // `todos` traz escondidos, cancelados e arquivados. É uma opção legítima
    // de quem modera; não é a população que a percentagem conta.
    expect(chamadasDe('in').some(([coluna]) => coluna === 'status')).toBe(false);
    expect(chamadasDe('eq').some(([coluna]) => coluna === 'status')).toBe(false);
  });

  it('um estado concreto continua a ser um estado concreto', async () => {
    await listEvents({ status: 'draft' });
    expect(chamadasDe('eq')).toContainEqual(['status', 'draft']);
  });
});

describe('os filtros de lacuna', () => {
  it('«preço» é quem não diz que é grátis nem quanto custa', async () => {
    await listEvents({ falta: 'preco' });
    // O complemento exato de `is_free or price_min is not null`, que é o que
    // a coluna `with_price` da vista conta. `is_free` é `not null` desde a
    // 0004: não há terceira hipótese a considerar.
    expect(chamadasDe('eq')).toContainEqual(['is_free', false]);
    expect(chamadasDe('is')).toContainEqual(['price_min', null]);
  });

  it('«mapa» é a mesma coluna que a vista lê', async () => {
    await listEvents({ falta: 'mapa' });
    expect(chamadasDe('is')).toContainEqual(['latitude', null]);
  });

  it('«espaço» é só o espaço do catálogo', async () => {
    await listEvents({ falta: 'espaco' });
    expect(chamadasDe('is')).toContainEqual(['venue_id', null]);
    // Um evento com `location_name` preenchido e sem espaço entra aqui: diz
    // onde é por escrito, mas não está ligado ao catálogo.
    expect(chamadasDe('is').some(([coluna]) => coluna === 'location_name')).toBe(false);
  });

  /**
   * «Sem sítio nenhum» foi uma opção do selector, e não podia devolver nada: a
   * restrição `events_has_location`, da 0004, exige espaço **ou** texto solto,
   * e `venue_id is null and location_name is null` é falso para todas as
   * linhas que a base aceita gravar. Zero em produção desde sempre, e não por
   * o trabalho estar feito — por não poder haver trabalho.
   *
   * Saiu. O que este teste guarda é que não voltou por distração: o ramo da
   * consulta tem de continuar fora, e `lacunas.test.ts` verifica que a
   * restrição que o justifica continua nas migrações.
   */
  it('já não pergunta pelo «sítio», que a base não deixa faltar', async () => {
    await listEvents({ falta: 'sitio' });
    expect(chamadasDe('is').some(([coluna]) => coluna === 'location_name')).toBe(false);
    expect(chamadasDe('is').some(([coluna]) => coluna === 'venue_id')).toBe(false);
  });

  it('uma lacuna que não existe não recorta nada', async () => {
    await listEvents({ falta: 'inventada' });
    for (const [coluna] of chamadasDe('is')) {
      expect(coluna).not.toBe('latitude');
      expect(coluna).not.toBe('venue_id');
      expect(coluna).not.toBe('image_url');
    }
  });
});

describe('o recorte por fonte', () => {
  it('filtra a coluna que a tabela «Por fonte» agrega', async () => {
    await listEvents({ fonte: 'cm-tomar' });
    expect(chamadasDe('eq')).toContainEqual(['source_id', 'cm-tomar']);
  });

  it('vazio não filtra — é «todas», não uma fonte chamada vazio', async () => {
    await listEvents({ fonte: '' });
    expect(chamadasDe('eq').some(([coluna]) => coluna === 'source_id')).toBe(false);
  });
});
