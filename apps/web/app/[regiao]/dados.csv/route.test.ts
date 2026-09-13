import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DumpDaRegiao } from '@/src/lib/feeds/dump';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';

const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
const carregarDump = vi.hoisted(() => vi.fn<(regiao: Regiao) => Promise<DumpDaRegiao>>());

vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao }));
vi.mock('@/src/lib/feeds/dump-load', () => ({ carregarDump }));

const { GET } = await import('./route');

const TRAVESSIA: Regiao = { ...REGIAO_DE_RECURSO, id: 'travessia', nome: 'Travessia do Zêzere' };

const DUMP: DumpDaRegiao = {
  gerado_em: '2026-09-13T20:00:00.000Z',
  regiao: { id: 'travessia', nome: 'Travessia do Zêzere' },
  inclui: 'Os eventos publicados desta região cuja data é hoje ou depois.',
  total: 0,
  licenca: {
    nome: 'CC BY 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    atribuicao: 'Compilação sob CC BY 4.0.',
  },
  eventos: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  exigirRegiao.mockResolvedValue(TRAVESSIA);
  carregarDump.mockResolvedValue(DUMP);
});

describe('GET /dados.csv', () => {
  it('desce como ficheiro, com o tipo e o nome certos', async () => {
    // `attachment` e não `inline`: quem pede o CSV quer o ficheiro na pasta das
    // transferências, não um muro de texto no navegador.
    const resposta = await GET(new Request('https://coreto.travessia.example/dados.csv'), {
      params: Promise.resolve({ regiao: 'travessia' }),
    });

    expect(resposta.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(resposta.headers.get('Content-Disposition')).toBe(
      'attachment; filename="coreto-travessia.csv"',
    );
    expect(await resposta.text()).toContain('# gerado em: 2026-09-13T20:00:00.000Z');
  });
});
