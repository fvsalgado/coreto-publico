import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DumpDaRegiao } from '@/src/lib/feeds/dump';
import { FEED_CACHE_CONTROL } from '@/src/lib/feeds/http';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';

/**
 * O ficheiro de dados abertos da região.
 *
 * O que esta rota decide é a casca: os cabeçalhos, o nome do ficheiro e a
 * região em que responde. A construção do conteúdo tem os seus testes em
 * `feeds/dump.test.ts`; aqui prova-se a costura, e sobretudo que uma região
 * não serve o ficheiro de outra.
 */
const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
const carregarDump = vi.hoisted(() => vi.fn<(regiao: Regiao) => Promise<DumpDaRegiao>>());

vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao }));
vi.mock('@/src/lib/feeds/dump-load', () => ({ carregarDump }));

const { GET } = await import('./route');

const TRAVESSIA: Regiao = {
  ...REGIAO_DE_RECURSO,
  id: 'travessia',
  nome: 'Travessia do Zêzere',
  dominio: 'coreto.travessia.example',
};

const DUMP: DumpDaRegiao = {
  gerado_em: '2026-09-13T20:00:00.000Z',
  regiao: { id: 'travessia', nome: 'Travessia do Zêzere' },
  inclui: 'Os eventos publicados desta região cuja data é hoje ou depois.',
  total: 1,
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

function pedido() {
  return GET(new Request('https://coreto.travessia.example/dados.json'), {
    params: Promise.resolve({ regiao: 'travessia' }),
  });
}

describe('GET /dados.json', () => {
  it('serve o ficheiro da região em que responde, e nunca o de outra', async () => {
    const resposta = await pedido();
    const corpo = (await resposta.json()) as DumpDaRegiao;

    expect(exigirRegiao).toHaveBeenCalledWith('travessia');
    expect(carregarDump).toHaveBeenCalledWith(TRAVESSIA);
    expect(corpo.regiao.id).toBe('travessia');
    expect(JSON.stringify(corpo)).not.toContain('mediotejo');
  });

  it('leva a data, a contagem e a licença dentro do corpo', async () => {
    const corpo = (await (await pedido()).json()) as DumpDaRegiao;

    expect(corpo.gerado_em).toBe('2026-09-13T20:00:00.000Z');
    expect(corpo.total).toBe(1);
    expect(corpo.licenca.url).toBe('https://creativecommons.org/licenses/by/4.0/');
  });

  it('abre a leitura a quem integra e guarda-se como os outros feeds', async () => {
    const resposta = await pedido();

    expect(resposta.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(resposta.headers.get('Cache-Control')).toBe(FEED_CACHE_CONTROL);
    expect(resposta.headers.get('Content-Disposition')).toContain('coreto-travessia.json');
  });
});
