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

/** A mesma, calada de propósito até daqui a N dias (negativo = pausa já acabou). */
function fontePausada(
  id: string,
  diasDesdeOSucesso: number,
  ate: number,
  motivo = 'bloqueio da CIM',
) {
  return {
    ...fonte(id, diasDesdeOSucesso),
    pausada_ate: new Date(Date.now() + ate * 86_400_000).toISOString(),
    pausa_motivo: motivo,
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

/**
 * A pausa declarada, no corpo (0159).
 *
 * Os campos deste endereço são contrato — está escrito na rota, e a sonda
 * externa lê-os. Acrescentar dois sem os prender num teste era acrescentar
 * duas promessas que ninguém verifica: a `emPausa` e a `pausadas` existem para
 * que quem vigia distinga «não conseguimos ler» de «decidimos não ler», e uma
 * promessa dessas vale o que valer o teste que a guarda.
 */
describe('/estado.json e a pausa declarada', () => {
  beforeEach(() => {
    listMunicipalities.mockResolvedValue([{ id: 'tomar', name: 'Tomar' }]);
    countEventsByMunicipality.mockResolvedValue({ tomar: 40 });
  });

  it('uma fonte em pausa sai do «por arranjar», entra nas «pausadas», e não põe o grau a mau', async () => {
    listPublicSources.mockResolvedValue([fontePausada('cm-macao', 20, 4)]);

    const body = await corpo(
      await GET(new Request('http://x'), { params: Promise.resolve({ regiao: 'medio-tejo' }) }),
    );
    const recolha = body.recolha as Record<string, unknown>;

    expect(body.grau).toBe('bom');
    expect(recolha.emPausa).toBe(1);
    expect(recolha.paradas).toBe(0);
    expect(recolha.porArranjar).toEqual([]);
    expect(recolha.pausadas).toEqual([
      expect.objectContaining({ id: 'cm-macao', motivo: 'bloqueio da CIM' }),
    ]);
    // A data vem no corpo e não só a contagem: uma pausa é uma promessa de
    // rever, e sem o prazo à vista não há como saber se está a ser cumprida.
    expect((recolha.pausadas as Array<{ ate: string }>)[0]?.ate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('quando a pausa acaba, a fonte volta ao «por arranjar» e o grau volta a mau', async () => {
    listPublicSources.mockResolvedValue([fontePausada('cm-macao', 20, -1)]);

    const body = await corpo(
      await GET(new Request('http://x'), { params: Promise.resolve({ regiao: 'medio-tejo' }) }),
    );
    const recolha = body.recolha as Record<string, unknown>;

    expect(body.grau).toBe('mau');
    expect(body.resumo).toBe('A pausa de uma fonte acabou e ninguém a renovou.');
    expect(recolha.emPausa).toBe(0);
    expect(recolha.pausadas).toEqual([]);
    expect(recolha.porArranjar).toEqual([
      expect.objectContaining({ id: 'cm-macao', saude: 'parada' }),
    ]);
  });

  it('sem pausas, os campos novos existem à mesma — um contrato não aparece e desaparece', async () => {
    listPublicSources.mockResolvedValue([fonte('cm-tomar', 1)]);

    const body = await corpo(
      await GET(new Request('http://x'), { params: Promise.resolve({ regiao: 'medio-tejo' }) }),
    );
    const recolha = body.recolha as Record<string, unknown>;

    expect(recolha.emPausa).toBe(0);
    expect(recolha.pausadas).toEqual([]);
  });
});
