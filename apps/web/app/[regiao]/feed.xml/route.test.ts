import type { EventFilter } from '@coreto/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedContext } from '@/src/lib/feeds/build';
import { FEED_CACHE_CONTROL, RSS_CONTENT_TYPE } from '@/src/lib/feeds/http';
import type { FeedPayload } from '@/src/lib/feeds/load';
import { FEED_COPYRIGHT } from '@/src/lib/produto';
import type { EventCard } from '@/src/lib/queries/types';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';

/**
 * O RSS da região inteira.
 *
 * O que esta rota decide é o canal — título, ligação, descrição e a nota de
 * licença, todos da região em que responde — e o tamanho da janela:
 * cinquenta entradas, porque um leitor mostra sempre as mais recentes e
 * ninguém percorre mais do que isso. A escrita do XML tem os seus testes em
 * `feeds/rss.test.ts`, e a tradução de eventos para itens em `build.test.ts`.
 * Aqui prova-se a costura entre as três, com um evento só.
 */

const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
const loadFeed = vi.hoisted(() =>
  vi.fn<(regiao: Regiao, filter: EventFilter) => Promise<FeedPayload>>(),
);

vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao }));
vi.mock('@/src/lib/feeds/load', () => ({ loadFeed }));

const { GET, FEED_LIMIT } = await import('./route');

/**
 * Uma segunda região, montada sobre a de recurso com o que esta rota lê.
 *
 * Não é o Médio Tejo de propósito: a Travessia descreve-se pelo domínio dela
 * e não pelo do deployment, e assim qualquer «mediotejo» que apareça no feed
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

const EVENTO: EventCard = {
  id: 'e1',
  slug: 'concerto-de-ano-novo',
  title: 'Concerto de Ano Novo',
  description_short: 'A banda dos bombeiros abre o ano.',
  municipality_id: 'serta',
  venue_id: 'cine-teatro',
  location_name: null,
  category_slug: 'musica',
  date_start: '2027-01-01',
  date_end: null,
  is_ongoing: false,
  is_free: true,
  price_display: null,
  image_url: null,
  image_alt: null,
  wheelchair_accessible: true,
  audience: 'all_ages',
};

const CONTEXTO: FeedContext = {
  siteUrl: ORIGEM,
  uidDomain: 'coreto.travessia.example',
  municipalityNames: { serta: 'Sertã' },
  venueNames: { 'cine-teatro': 'Cine-Teatro' },
  categoryNames: { musica: 'Música' },
  sessions: {},
  timestamps: { e1: '2026-12-01T10:00:00Z' },
};

const PEDIDO = new Request(`${ORIGEM}/feed.xml`);

function contexto(regiao: string): { params: Promise<{ regiao: string }> } {
  return { params: Promise.resolve({ regiao }) };
}

async function feed(): Promise<{ resposta: Response; xml: string }> {
  const resposta = await GET(PEDIDO, contexto('travessia'));
  expect(resposta.status).toBe(200);
  return { resposta, xml: await resposta.text() };
}

describe('GET /feed.xml', () => {
  beforeEach(() => {
    exigirRegiao.mockReset().mockResolvedValue(TRAVESSIA);
    loadFeed.mockReset().mockResolvedValue({ events: [EVENTO], total: 1, context: CONTEXTO });
  });

  it('serve RSS com a cache dos feeds', async () => {
    const { resposta } = await feed();

    expect(resposta.headers.get('Content-Type')).toBe(RSS_CONTENT_TYPE);
    expect(resposta.headers.get('Content-Type')).toBe('application/rss+xml; charset=utf-8');
    expect(resposta.headers.get('Cache-Control')).toBe(FEED_CACHE_CONTROL);
  });

  it('o canal é o da região, na origem dela — e sem uma letra de outra', async () => {
    const { xml } = await feed();

    expect(xml).toContain('<title>Coreto — a agenda cultural da Travessia do Zêzere</title>');
    expect(xml).toContain(`<link>${ORIGEM}/agenda</link>`);
    expect(xml).toContain(
      '<description>Concertos, teatro, exposições, festas, cinema e visitas nos dois concelhos da Travessia do Zêzere.</description>',
    );
    expect(xml).toContain(
      `<atom:link href="${ORIGEM}/feed.xml" rel="self" type="application/rss+xml" />`,
    );
    expect(xml).toContain(`<copyright>${FEED_COPYRIGHT}</copyright>`);
    expect(xml).toContain('<ttl>60</ttl>');
    expect(xml).not.toContain('mediotejo');
  });

  it('pede cinquenta entradas, que é a janela que um leitor mostra', async () => {
    await feed();

    expect(FEED_LIMIT).toBe(50);
    expect(loadFeed).toHaveBeenCalledWith(TRAVESSIA, { page: 1, limit: 50 });
  });

  it('cada evento é um item com título, ligação permanente, data de alteração e categoria', async () => {
    const { xml } = await feed();

    const item = /<item>[\s\S]*?<\/item>/.exec(xml)?.[0] ?? '';
    expect(item).toContain('<title>Concerto de Ano Novo</title>');
    expect(item).toContain(`<link>${ORIGEM}/evento/concerto-de-ano-novo</link>`);
    expect(item).toContain(`<guid isPermaLink="true">${ORIGEM}/evento/concerto-de-ano-novo</guid>`);
    expect(item).toContain('<pubDate>Tue, 01 Dec 2026 10:00:00 GMT</pubDate>');
    expect(item).toContain('<category>Música</category>');
    expect(item).toContain('Cine-Teatro, Sertã · Entrada livre');
  });
});
