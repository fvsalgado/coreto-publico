import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';

/**
 * O `/estado` numa forma que uma máquina lê.
 *
 * O que faz falta provar são duas coisas, e nenhuma é a redação: que o corpo
 * diz o mesmo que a página diria — porque as duas saem do mesmo `estado.ts` e
 * um dia alguém muda uma e esquece a outra — e que uma base em baixo sai com
 * **503** e não com 200. A segunda é a razão de o endereço existir: a sonda
 * externa vigia pelo código, e um 200 sobre uma base morta é um alarme que
 * nunca toca.
 */

const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
const listPublicSources = vi.hoisted(() => vi.fn());
const listMunicipalities = vi.hoisted(() => vi.fn());
const countEventsByMunicipality = vi.hoisted(() => vi.fn());

vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao }));
vi.mock('@/src/lib/queries/events', () => ({
  listPublicSources,
  listMunicipalities,
  countEventsByMunicipality,
}));

const { GET } = await import('./route');

const REGIAO: Regiao = { ...REGIAO_DE_RECURSO, id: 'medio-tejo' };

/** Uma fonte lida há N dias, e tentada hoje. */
function fonte(id: string, diasDesdeOSucesso: number | null) {
  const agora = Date.now();
  return {
    id,
    name: `Agenda de ${id}`,
    kind: 'html',
    municipality_id: 'tomar',
    region_id: null,
    venue_id: null,
    url: `https://${id}.pt/agenda`,
    is_enabled: true,
    last_success_at:
      diasDesdeOSucesso === null
        ? null
        : new Date(agora - diasDesdeOSucesso * 86_400_000).toISOString(),
    last_run_at: new Date(agora).toISOString(),
    public_note: null,
  };
}

async function corpo(resposta: Response) {
  return (await resposta.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  exigirRegiao.mockResolvedValue(REGIAO);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/estado.json', () => {
  it('conta as fontes e os concelhos a zero como a página conta', async () => {
    listPublicSources.mockResolvedValue([fonte('cm-tomar', 1), fonte('cm-ourem', 9)]);
    listMunicipalities.mockResolvedValue([
      { id: 'tomar', name: 'Tomar' },
      { id: 'ourem', name: 'Ourém' },
    ]);
    countEventsByMunicipality.mockResolvedValue({ tomar: 40 });

    const resposta = await GET(new Request('https://exemplo.pt/estado.json'), {
      params: Promise.resolve({ regiao: 'medio-tejo' }),
    });
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toBe('application/json; charset=utf-8');

    const dados = await corpo(resposta);
    expect(dados['regiao']).toBe('medio-tejo');
    expect(dados['grau']).toBe('mau');
    expect(dados['recolha']).toMatchObject({
      vigiadas: 2,
      emDia: 1,
      atrasadas: 0,
      paradas: 1,
      porEstrear: 0,
    });
    expect(dados['agenda']).toEqual({ total: 40, concelhosAZero: ['ourem'] });
  });

  it('com tudo em ordem, o grau é bom', async () => {
    listPublicSources.mockResolvedValue([fonte('cm-tomar', 0)]);
    listMunicipalities.mockResolvedValue([{ id: 'tomar', name: 'Tomar' }]);
    countEventsByMunicipality.mockResolvedValue({ tomar: 128 });

    const dados = await corpo(
      await GET(new Request('https://exemplo.pt/estado.json'), {
        params: Promise.resolve({ regiao: 'medio-tejo' }),
      }),
    );
    expect(dados['grau']).toBe('bom');
    expect(dados['agenda']).toEqual({ total: 128, concelhosAZero: [] });
  });

  it('com a base em baixo responde 503, e não um 200 tranquilizador', async () => {
    listPublicSources.mockRejectedValue(new Error('base em baixo'));
    listMunicipalities.mockResolvedValue([]);
    countEventsByMunicipality.mockResolvedValue({});

    const resposta = await GET(new Request('https://exemplo.pt/estado.json'), {
      params: Promise.resolve({ regiao: 'medio-tejo' }),
    });
    expect(resposta.status).toBe(503);
    const dados = await corpo(resposta);
    expect(dados['grau']).toBe('mau');
    // E nunca uma agenda vazia a fazer-se passar por verdade: sem números,
    // não se publicam números.
    expect(dados['agenda']).toBeUndefined();
  });
});
