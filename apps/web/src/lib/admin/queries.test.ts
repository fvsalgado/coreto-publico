import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * «Não há» e «não consegui saber» são duas respostas diferentes.
 *
 * Quinze leituras deste ficheiro destruturavam só o `data` — o `error` do
 * Supabase nem chegava a ser lido — ou registavam-no e devolviam `[]`. Com a
 * base em baixo, o painel de entrada escrevia «nenhuma fonte avariada», a
 * fila «nada por moderar», a qualidade uma coluna de zeros. São todas frases
 * tranquilizadoras, ditas exatamente no instante em que alguém foi ao painel
 * porque desconfiava de alguma coisa.
 *
 * Este ficheiro pergunta a mesma coisa a cada leitura: **com o cliente a
 * devolver um erro, isto atira ou finge?** Não é um teste das consultas — as
 * colunas, os filtros e os recortes não estão aqui cobertos. É um teste de uma
 * propriedade só, e é a propriedade que faz o painel poder ser lido.
 *
 * A exceção é `signedAttachmentUrl`, que não lê a base: assina um endereço no
 * armazenamento, e o `null` não afirma nada.
 */

/** O erro tal como o supabase-js o entrega. */
const AVARIA = {
  data: null,
  count: null,
  error: { code: '57P01', message: 'terminating connection due to administrator command' },
};

/**
 * Um cliente de mentira que responde sempre a mesma coisa, encadeie-se o que
 * se encadear.
 *
 * As leituras deste ficheiro tocam nesta superfície e em mais nada: uma
 * cadeia de filtros e um `await` no fim. É de propósito que não imita a API
 * de dados — imitar mais seria testar o supabase-js.
 */
function clienteQue(resposta: unknown) {
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
    encadeado[metodo] = () => encadeado;
  }
  return {
    from: () => encadeado,
    rpc: () => encadeado,
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null }) }) },
  };
}

const estado = vi.hoisted(() => ({ cliente: null as unknown }));

vi.mock('../supabase/server', () => ({
  publicClient: () => null,
  adminClient: () => estado.cliente,
  requireAdminClient: () => estado.cliente,
}));

beforeEach(() => {
  estado.cliente = clienteQue(AVARIA);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/**
 * Uma leitura por linha, com o que ela diria se continuasse a fingir.
 *
 * A lista é escrita à mão e não derivada do módulo de propósito: uma leitura
 * nova tem de entrar aqui à mão, e é essa a intenção — a pergunta «e se isto
 * falhar?» é para se fazer uma vez por leitura, por uma pessoa.
 */
const LEITURAS: Array<[nome: string, correr: (q: typeof import('./queries')) => Promise<unknown>]> =
  [
    ['listSubmissions', (q) => q.listSubmissions({})],
    ['getSubmission', (q) => q.getSubmission('11111111-1111-1111-1111-111111111111')],
    ['listAttachments', (q) => q.listAttachments('11111111-1111-1111-1111-111111111111')],
    ['findDuplicateCandidates', (q) => q.findDuplicateCandidates('Concerto', null, 'tomar')],
    ['listSourceHealth', (q) => q.listSourceHealth()],
    ['listRecentRuns', (q) => q.listRecentRuns()],
    ['listAdminActions', (q) => q.listAdminActions(1)],
    ['listEvents', (q) => q.listEvents({ janela: 'futuros' })],
    ['countEventsByStatus', (q) => q.countEventsByStatus()],
    ['listUnknownTags', (q) => q.listUnknownTags()],
    ['listUnresolvedVenues', (q) => q.listUnresolvedVenues()],
    ['listVenuesForLinking', (q) => q.listVenuesForLinking()],
    ['qualityByMunicipality', (q) => q.qualityByMunicipality()],
    ['qualityBySource', (q) => q.qualityBySource()],
    ['dashboardCounts', (q) => q.dashboardCounts()],
    ['listRegionsAdmin', (q) => q.listRegionsAdmin()],
    ['listRegionLicenses', (q) => q.listRegionLicenses()],
    ['listSiteSections', (q) => q.listSiteSections('medio-tejo')],
    ['listSiteSectionsTodas', (q) => q.listSiteSectionsTodas()],
    ['listRegionGates', (q) => q.listRegionGates()],
    ['monthlyReport', (q) => q.monthlyReport('medio-tejo', '2026-08')],
    ['listEventsWithoutTime', (q) => q.listEventsWithoutTime()],
  ];

describe('com a base em baixo, o painel diz que não sabe', () => {
  it.each(LEITURAS)('%s atira em vez de devolver vazio', async (_nome, correr) => {
    const queries = await import('./queries');
    await expect(correr(queries)).rejects.toThrow();
  });

  it('e com a base a responder, devolve o que veio', async () => {
    // O simétrico: se tudo atirasse sempre, o teste de cima passava com um
    // painel partido.
    estado.cliente = clienteQue({ data: [], error: null, count: 0 });
    const { listSourceHealth, listUnknownTags } = await import('./queries');
    await expect(listSourceHealth()).resolves.toEqual([]);
    await expect(listUnknownTags()).resolves.toEqual([]);
  });
});

describe('as exceções, que são exceções e não esquecimentos', () => {
  it('o endereço assinado de um anexo devolve null sem deitar a ficha abaixo', async () => {
    const { signedAttachmentUrl } = await import('./queries');
    await expect(signedAttachmentUrl('intake/cartaz.pdf')).resolves.toBeNull();
  });

  it('uma página da auditoria além do fim é uma lista vazia, não um erro', async () => {
    // O PostgREST recusa o intervalo com 416 e `PGRST103`, e isso quer dizer
    // «não há mais nada» — a única recusa desta casa que não é uma avaria.
    estado.cliente = clienteQue({
      data: null,
      count: null,
      error: { code: 'PGRST103', message: 'Requested range not satisfiable' },
    });
    const { listAdminActions } = await import('./queries');
    await expect(listAdminActions(99)).resolves.toEqual([]);
  });
});
