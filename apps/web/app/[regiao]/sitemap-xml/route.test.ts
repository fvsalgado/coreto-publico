import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SitemapEvent } from '@/src/lib/feeds/data';
import type { SeccaoOpcional } from '@/src/lib/navegacao';
import type { SeriesEventCounts } from '@/src/lib/queries/events';
import type { Municipality, Venue } from '@/src/lib/queries/types';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';

/**
 * O mapa do sítio de cada domínio.
 *
 * Duas coisas podem correr mal em silêncio, e as duas ensinam um motor de
 * busca a desconfiar do ficheiro inteiro: um endereço de outra região (a
 * origem tem de ser a do domínio que responde) e um endereço que dá 404
 * (uma secção desligada no painel tem de sair daqui no mesmo instante em que
 * sai da navegação). O resto é a datação — cada ficha com a sua alteração,
 * cada concelho com a do evento mais recente **dele**, e nada datado à força.
 *
 * As leituras estão todas substituídas: o que se prova é a composição do
 * XML, não o que a base devolve.
 */

const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
const listSitemapEvents = vi.hoisted(() =>
  vi.fn<(regiao: string, limit: number, from: string) => Promise<SitemapEvent[]>>(),
);
const listMunicipalities = vi.hoisted(() => vi.fn<(regiao: string) => Promise<Municipality[]>>());
const listVenues = vi.hoisted(() => vi.fn<(regiao: string) => Promise<Venue[]>>());
const countEventsBySeries = vi.hoisted(() =>
  vi.fn<(regiao: string) => Promise<SeriesEventCounts>>(),
);
const seccoesDesligadas = vi.hoisted(() => vi.fn<(regiao: string) => Promise<SeccaoOpcional[]>>());

vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao }));
vi.mock('@/src/lib/feeds/data', () => ({ listSitemapEvents }));
vi.mock('@/src/lib/queries/events', () => ({
  listMunicipalities,
  listVenues,
  countEventsBySeries,
}));
vi.mock('@/src/lib/queries/seccoes', () => ({ seccoesDesligadas }));

const { GET } = await import('./route');

/**
 * Uma segunda região, montada sobre a de recurso com o que esta rota lê.
 *
 * Não é o Médio Tejo de propósito: a Travessia descreve-se pelo domínio dela
 * e não pelo do deployment, e assim qualquer «mediotejo» que apareça no mapa
 * é uma fuga entre regiões, não uma coincidência.
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
  },
  {
    id: 'ferreira-do-zezere',
    name: 'Ferreira do Zêzere',
    district: 'Santarém',
    latitude: null,
    longitude: null,
    sort_order: 2,
  },
];

/**
 * Dois eventos na Sertã e nenhum em Ferreira do Zêzere: é essa assimetria que
 * a datação por concelho tem de mostrar.
 */
const EVENTOS: SitemapEvent[] = [
  {
    slug: 'concerto-de-ano-novo',
    municipality_id: 'serta',
    date_start: '2027-01-01',
    updated_at: '2026-12-01T10:00:00Z',
  },
  {
    slug: 'feira-do-livro',
    municipality_id: 'serta',
    date_start: '2027-03-10',
    updated_at: '2026-12-20T08:30:00Z',
  },
];

/** Um espaço com só o que o mapa lê dele. */
const ESPACO = { id: 'cine-teatro', name: 'Cine-Teatro' } as Venue;

const PEDIDO = new Request(`${ORIGEM}/sitemap.xml`);

function contexto(regiao: string): { params: Promise<{ regiao: string }> } {
  return { params: Promise.resolve({ regiao }) };
}

/** Cada `<url>` do mapa, pelo seu `<loc>`, para se ler o que cada entrada leva. */
function entradas(xml: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const [, bloco = ''] of xml.matchAll(/<url>\n([\s\S]*?)\n<\/url>/g)) {
    const loc = /<loc>(.*?)<\/loc>/.exec(bloco)?.[1];
    if (loc) mapa.set(loc, bloco);
  }
  return mapa;
}

async function mapaDoSitio(): Promise<{
  resposta: Response;
  xml: string;
  urls: Map<string, string>;
}> {
  const resposta = await GET(PEDIDO, contexto('travessia'));
  expect(resposta.status).toBe(200);
  const xml = await resposta.text();
  return { resposta, xml, urls: entradas(xml) };
}

describe('GET /sitemap.xml', () => {
  beforeEach(() => {
    exigirRegiao.mockReset().mockResolvedValue(TRAVESSIA);
    listSitemapEvents.mockReset().mockResolvedValue(EVENTOS);
    listMunicipalities.mockReset().mockResolvedValue(CONCELHOS);
    listVenues.mockReset().mockResolvedValue([ESPACO]);
    countEventsBySeries.mockReset().mockResolvedValue({
      'festival-x': { total: 3, porAcontecer: 1 },
    });
    seccoesDesligadas.mockReset().mockResolvedValue([]);
  });

  it('é um sitemap XML, guardado uma hora na rede', async () => {
    const { resposta, xml } = await mapaDoSitio();

    expect(resposta.headers.get('Content-Type')).toBe('application/xml');
    expect(resposta.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    );
    expect(
      xml.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n',
      ),
    ).toBe(true);
    expect(xml.endsWith('</urlset>\n')).toBe(true);
  });

  it('anuncia as páginas, os concelhos, os espaços e os ciclos da região, na origem dela', async () => {
    const { xml, urls } = await mapaDoSitio();

    for (const caminho of [
      '/',
      '/agenda',
      '/mapa',
      '/espacos',
      '/coretos',
      '/ciclos',
      '/submeter',
      '/levar',
      '/fontes',
      '/informacoes',
      '/concelho/serta',
      '/concelho/ferreira-do-zezere',
      '/espaco/cine-teatro',
      '/ciclo/festival-x',
    ]) {
      expect(urls.has(`${ORIGEM}${caminho}`), `falta ${caminho}`).toBe(true);
    }
    expect(xml).not.toContain('mediotejo');
  });

  it('as fichas dos eventos são o que interessa: cada uma datada pela sua alteração', async () => {
    const { urls } = await mapaDoSitio();

    const ficha = urls.get(`${ORIGEM}/evento/concerto-de-ano-novo`);
    expect(ficha).toContain('<lastmod>2026-12-01T10:00:00.000Z</lastmod>');
    // E nada mais. O `changefreq` e o `priority` saíram — nenhum motor de
    // busca os lê desde 2023, e um campo que ninguém lê ainda assim ocupa
    // duas linhas por cada um dos mil endereços deste ficheiro.
    expect(ficha).not.toContain('<changefreq>');
    expect(ficha).not.toContain('<priority>');
    // Mil é o tecto, e a janela começa hoje: o que já aconteceu não é programa.
    expect(listSitemapEvents).toHaveBeenCalledWith(
      'travessia',
      1000,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('cada concelho leva a data do evento mais recente dele — e sem eventos, não leva data', async () => {
    const { urls } = await mapaDoSitio();

    expect(urls.get(`${ORIGEM}/concelho/serta`)).toContain(
      '<lastmod>2026-12-20T08:30:00.000Z</lastmod>',
    );
    // Não há por onde saber quando é que a página de Ferreira mudou: dizer
    // uma data qualquer é pior do que não dizer nenhuma.
    expect(urls.get(`${ORIGEM}/concelho/ferreira-do-zezere`)).not.toContain('<lastmod>');
  });

  it('as listagens datam-se pela alteração mais recente da região; as outras páginas não se datam', async () => {
    const { urls } = await mapaDoSitio();

    expect(urls.get(`${ORIGEM}/`)).toContain('<lastmod>2026-12-20T08:30:00.000Z</lastmod>');
    expect(urls.get(`${ORIGEM}/agenda`)).toContain('<lastmod>2026-12-20T08:30:00.000Z</lastmod>');
    expect(urls.get(`${ORIGEM}/mapa`)).not.toContain('<lastmod>');
  });

  it('uma secção desligada sai do mapa ao mesmo tempo que sai da navegação', async () => {
    seccoesDesligadas.mockResolvedValue(['coretos']);

    const { urls } = await mapaDoSitio();

    expect(urls.has(`${ORIGEM}/coretos`)).toBe(false);
    expect(urls.has(`${ORIGEM}/ciclos`)).toBe(true);
    expect(urls.has(`${ORIGEM}/agenda`)).toBe(true);
  });

  it('com os ciclos desligados, saem o índice e a página de cada ciclo', async () => {
    seccoesDesligadas.mockResolvedValue(['ciclos']);

    const { urls } = await mapaDoSitio();

    expect(urls.has(`${ORIGEM}/ciclos`)).toBe(false);
    expect(urls.has(`${ORIGEM}/ciclo/festival-x`)).toBe(false);
  });

  it('as fontes e as informações obedecem ao mesmo interruptor', async () => {
    // `/informacoes` está etiquetada como secção opcional, tal como `/fontes`:
    // desligada no painel, é um 404 — e um 404 não se anuncia.
    seccoesDesligadas.mockResolvedValue(['fontes', 'informacoes']);

    const { urls } = await mapaDoSitio();

    expect(urls.has(`${ORIGEM}/fontes`)).toBe(false);
    expect(urls.has(`${ORIGEM}/informacoes`)).toBe(false);
    expect(urls.has(`${ORIGEM}/coretos`)).toBe(true);
  });
});
