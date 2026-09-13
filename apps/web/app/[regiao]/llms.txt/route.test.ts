import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_PARAMETERS } from '@/src/lib/feeds/params';
import type { SeccaoOpcional } from '@/src/lib/navegacao';
import { FEED_COPYRIGHT } from '@/src/lib/produto';
import type { SeriesEventCounts } from '@/src/lib/queries/events';
import type { Category, Municipality, Series } from '@/src/lib/queries/types';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';

/**
 * O que um motor de resposta lê antes de responder por nós.
 *
 * O ficheiro é gerado, e é isso que estes testes vigiam: os concelhos, as
 * categorias e os ciclos saem da base, a origem é a da região que responde,
 * e as duas frases que prometem páginas opcionais só se escrevem com a
 * secção ligada. Uma promessa a um modelo é como uma promessa a uma pessoa —
 * se a página não existe, mais vale não a fazer.
 *
 * As leituras estão substituídas. A lista de parâmetros da API não: é a
 * mesma que a rota de erro publica, e o teste percorre-a para que um
 * parâmetro novo não fique por documentar aqui.
 */

const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
const listMunicipalities = vi.hoisted(() => vi.fn<(regiao: string) => Promise<Municipality[]>>());
const listCategories = vi.hoisted(() => vi.fn<() => Promise<Category[]>>());
const listSeries = vi.hoisted(() => vi.fn<(regiao: string) => Promise<Series[]>>());
const countEventsBySeries = vi.hoisted(() =>
  vi.fn<(regiao: string) => Promise<SeriesEventCounts>>(),
);
const seccaoLigada = vi.hoisted(() =>
  vi.fn<(regiao: string, seccao: SeccaoOpcional) => Promise<boolean>>(),
);

vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao }));
vi.mock('@/src/lib/queries/events', () => ({
  listMunicipalities,
  listCategories,
  listSeries,
  countEventsBySeries,
}));
vi.mock('@/src/lib/queries/seccoes', () => ({ seccaoLigada }));

const { GET } = await import('./route');

/**
 * Uma segunda região, montada sobre a de recurso com o que esta rota lê — o
 * promotor incluído, porque o texto o nomeia.
 *
 * Não é o Médio Tejo de propósito: a Travessia descreve-se pelo domínio dela
 * e não pelo do deployment, e assim qualquer «mediotejo» que apareça no
 * texto é uma fuga entre regiões, não uma coincidência.
 */
const TRAVESSIA: Regiao = {
  ...REGIAO_DE_RECURSO,
  id: 'travessia',
  nome: 'Travessia do Zêzere',
  artigo: 'a',
  doNome: 'da Travessia do Zêzere',
  noNome: 'na Travessia do Zêzere',
  dominio: 'coreto.travessia.example',
  email: 'coreto@travessia.example',
  dominioDosUid: 'coreto.travessia.example',
  tagline: null,
  promotor: {
    nome: 'Comunidade Intermunicipal da Travessia do Zêzere',
    url: 'https://travessia.example',
    declaracaoDeFinanciamento: null,
    cofinanciamento: null,
    logotipo: null,
  },
  concelhosDeclarados: 2,
  concelhosPorExtenso: 'dois',
};

const ORIGEM = 'https://coreto.travessia.example';

const CONCELHOS: Municipality[] = [
  {
    id: 'serta',
    name: 'Sertã',
    district: 'Castelo Branco',
    latitude: null,
    longitude: null,
    sort_order: 1,
    parish_count: null,
  },
  {
    id: 'ferreira-do-zezere',
    name: 'Ferreira do Zêzere',
    district: 'Santarém',
    latitude: null,
    longitude: null,
    sort_order: 2,
    parish_count: null,
  },
];

const CATEGORIAS: Category[] = [
  { slug: 'musica', name: 'Música', description: null, sort_order: 1 },
  { slug: 'teatro', name: 'Teatro', description: null, sort_order: 2 },
];

/** Um ciclo com programa e um que ainda é só um nome que sabemos existir. */
const CICLOS: Series[] = [
  {
    id: 'festival-x',
    name: 'Festival X',
    kind: 'festival',
    municipality_id: null,
    description: null,
    website_url: null,
    is_regional: true,
  },
  {
    id: 'ciclo-por-recolher',
    name: 'Ciclo por recolher',
    kind: 'ciclo',
    municipality_id: 'serta',
    description: null,
    website_url: null,
    is_regional: false,
  },
];

const PEDIDO = new Request(`${ORIGEM}/llms.txt`);

function contexto(regiao: string): { params: Promise<{ regiao: string }> } {
  return { params: Promise.resolve({ regiao }) };
}

async function texto(regiao: Regiao = TRAVESSIA): Promise<string> {
  exigirRegiao.mockResolvedValue(regiao);
  const resposta = await GET(PEDIDO, contexto(regiao.id));
  expect(resposta.status).toBe(200);
  return resposta.text();
}

describe('GET /llms.txt', () => {
  beforeEach(() => {
    exigirRegiao.mockReset().mockResolvedValue(TRAVESSIA);
    listMunicipalities.mockReset().mockResolvedValue(CONCELHOS);
    listCategories.mockReset().mockResolvedValue(CATEGORIAS);
    listSeries.mockReset().mockResolvedValue(CICLOS);
    countEventsBySeries.mockReset().mockResolvedValue({
      'festival-x': { total: 3, porAcontecer: 1 },
    });
    seccaoLigada.mockReset().mockResolvedValue(true);
  });

  it('serve-se como markdown e guarda-se uma hora', async () => {
    const resposta = await GET(PEDIDO, contexto('travessia'));

    expect(resposta.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(resposta.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    );
  });

  it('diz de quem é e onde mora: a origem canónica, o promotor e a contagem viva dos concelhos', async () => {
    const corpo = await texto();

    expect(corpo).toContain(`Endereço canónico: ${ORIGEM}`);
    expect(corpo).toContain(
      'Promovido pela Comunidade Intermunicipal da Travessia do Zêzere (https://travessia.example).',
    );
    // «dos 2 concelhos», em algarismos e contados da lista — não da constante
    // que a região declara.
    expect(corpo).toContain(
      'A agenda cultural dos 2 concelhos da Comunidade Intermunicipal da Travessia do Zêzere',
    );
    expect(corpo).not.toContain('Médio Tejo');
    expect(corpo).not.toContain('mediotejo');

    // Sem promotor, fala em nome da região e não inventa uma CIM.
    const semPromotor = await texto({ ...TRAVESSIA, promotor: null });
    expect(semPromotor).toContain('A agenda cultural dos 2 concelhos da Travessia do Zêzere');
    expect(semPromotor).not.toContain('Promovido');
  });

  it('enumera os concelhos com o endereço de cada um', async () => {
    const corpo = await texto();

    expect(corpo).toContain(`- Sertã (\`serta\`) — ${ORIGEM}/concelho/serta`);
    expect(corpo).toContain(
      `- Ferreira do Zêzere (\`ferreira-do-zezere\`) — ${ORIGEM}/concelho/ferreira-do-zezere`,
    );
  });

  it('só promete as páginas que estão ligadas no painel', async () => {
    const ligado = await texto();
    expect(ligado).toContain('em `/ciclo/<id>`');
    expect(ligado).toContain(`${ORIGEM}/fontes`);
    expect(seccaoLigada).toHaveBeenCalledWith('travessia', 'ciclos');
    expect(seccaoLigada).toHaveBeenCalledWith('travessia', 'fontes');

    seccaoLigada.mockResolvedValue(false);
    const desligado = await texto();
    expect(desligado).not.toContain('/ciclo/<id>');
    expect(desligado).not.toContain(`${ORIGEM}/fontes`);
  });

  it('o vocabulário fechado sai da base: as categorias, e só os ciclos com programa', async () => {
    const corpo = await texto();
    expect(corpo).toContain('Categorias: `musica`, `teatro`.');
    expect(corpo).toContain('Ciclos com programa publicado: Festival X (`festival-x`).');
    expect(corpo).not.toContain('Ciclo por recolher');

    countEventsBySeries.mockResolvedValue({});
    expect(await texto()).toContain('Ciclos com programa publicado: nenhum de momento.');
  });

  it('documenta os endereços de máquina com a mesma lista de parâmetros da rota de erro', async () => {
    const corpo = await texto();

    for (const endereco of ['/api/events', '/feed.xml', '/agenda.ics', '/sitemap.xml']) {
      expect(corpo).toContain(`\`${ORIGEM}${endereco}\``);
    }
    expect(API_PARAMETERS.length).toBeGreaterThan(0);
    for (const parametro of API_PARAMETERS) {
      expect(corpo).toContain(
        `- \`${parametro.name}\` (${parametro.values}) — ${parametro.description}`,
      );
    }
  });

  it('leva a licença e a forma de citar', async () => {
    const corpo = await texto();

    expect(corpo).toContain(FEED_COPYRIGHT);
    expect(corpo).toContain('«Coreto, a agenda cultural da Travessia do Zêzere»');
  });
});
