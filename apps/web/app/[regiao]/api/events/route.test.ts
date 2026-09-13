import type { EventFilter } from '@coreto/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedContext } from '@/src/lib/feeds/build';
import { CORS_HEADERS, FEED_CACHE_CONTROL } from '@/src/lib/feeds/http';
import type { FeedPayload } from '@/src/lib/feeds/load';
import { API_PARAMETERS } from '@/src/lib/feeds/params';
import { FEED_COPYRIGHT } from '@/src/lib/produto';
import type { EventCard } from '@/src/lib/queries/types';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';

/**
 * A API pública, para quem monta a agenda no seu sítio.
 *
 * O contrato com quem integra tem três partes, e as três partem-se em
 * silêncio: o CORS aberto (sem ele, o sítio de uma câmara não consegue ler
 * isto do navegador), o envelope (`events`, `total`, a página, a licença e
 * onde está a documentação) e o 400 que ensina — a lista de parâmetros vai
 * dentro do erro porque é lá que faz falta. E cada evento vem com os nomes
 * por trás dos identificadores e as sessões com hora: sem isso, quem integra
 * recebia `venue_id` e tinha de adivinhar de que espaço se trata.
 *
 * O carregamento está substituído; a leitura dos parâmetros e a composição
 * da resposta são as verdadeiras.
 */

const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
const loadFeed = vi.hoisted(() =>
  vi.fn<(regiao: Regiao, filter: EventFilter) => Promise<FeedPayload>>(),
);
const notFound = vi.hoisted(() =>
  vi.fn((): never => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);

vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao }));
vi.mock('@/src/lib/feeds/load', () => ({ loadFeed }));
vi.mock('next/navigation', () => ({ notFound }));

const { GET, OPTIONS } = await import('./route');

/**
 * Uma segunda região, montada sobre a de recurso com o que esta rota lê.
 *
 * Não é o Médio Tejo de propósito: a Travessia descreve-se pelo domínio dela
 * e não pelo do deployment, e assim qualquer «mediotejo» que apareça na
 * resposta é uma fuga entre regiões, não uma coincidência.
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
  category_confidence: 0.95,
  category_source: 'alias',
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

/** O que o `loadFeed` junta ao evento: os nomes, as sessões e o carimbo. */
const CONTEXTO: FeedContext = {
  siteUrl: ORIGEM,
  uidDomain: 'coreto.travessia.example',
  municipalityNames: { serta: 'Sertã' },
  venueNames: { 'cine-teatro': 'Cine-Teatro' },
  categoryNames: { musica: 'Música' },
  sessions: {
    e1: [
      {
        event_id: 'e1',
        session_date: '2027-01-01',
        start_time: '21:30:00',
        end_time: null,
        location_override: null,
        is_cancelled: false,
      },
    ],
  },
  timestamps: { e1: '2026-12-01T10:00:00Z' },
};

function pedido(parametros = ''): Request {
  return new Request(`${ORIGEM}/api/events${parametros}`);
}

function contexto(regiao: string): { params: Promise<{ regiao: string }> } {
  return { params: Promise.resolve({ regiao }) };
}

async function agenda(parametros = ''): Promise<{ events: Array<Record<string, unknown>> }> {
  const resposta = await GET(pedido(parametros), contexto('travessia'));
  expect(resposta.status).toBe(200);
  return (await resposta.json()) as { events: Array<Record<string, unknown>> };
}

describe('OPTIONS /api/events', () => {
  it('responde ao pré-voo com o CORS aberto, e deixa-o guardar um dia', async () => {
    const resposta = await OPTIONS();

    expect(resposta.status).toBe(204);
    for (const [nome, valor] of Object.entries(CORS_HEADERS)) {
      expect(resposta.headers.get(nome)).toBe(valor);
    }
    expect(resposta.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(resposta.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });
});

describe('GET /api/events', () => {
  beforeEach(() => {
    exigirRegiao.mockReset().mockResolvedValue(TRAVESSIA);
    loadFeed.mockReset().mockResolvedValue({ events: [EVENTO], total: 1, context: CONTEXTO });
    notFound.mockClear();
  });

  it('devolve a agenda no envelope combinado, com o CORS aberto e a cache dos feeds', async () => {
    const resposta = await GET(pedido('?municipality=serta&limit=2'), contexto('travessia'));

    expect(resposta.status).toBe(200);
    for (const [nome, valor] of Object.entries(CORS_HEADERS)) {
      expect(resposta.headers.get(nome)).toBe(valor);
    }
    expect(resposta.headers.get('Cache-Control')).toBe(FEED_CACHE_CONTROL);
    // A licença viaja com os dados: quem cita a agenda lê a quem atribuir no
    // mesmo envelope, sem ir procurar uma página.
    expect(await resposta.json()).toMatchObject({
      total: 1,
      page: 1,
      limit: 2,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: FEED_COPYRIGHT,
      documentation: `${ORIGEM}/levar#dados`,
    });
    // O filtro chega ao carregamento tal como foi lido, e com a região
    // inteira — é ela que dá a origem das ligações.
    expect(loadFeed).toHaveBeenCalledWith(
      TRAVESSIA,
      expect.objectContaining({ municipality: 'serta', limit: 2, page: 1 }),
    );
  });

  it('cada evento leva os nomes por trás dos identificadores e as sessões com hora', async () => {
    const { events } = await agenda();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      // Os campos que já existiam continuam a existir: quem lê
      // `municipality_id` não fica sem ele.
      ...EVENTO,
      url: `${ORIGEM}/evento/concerto-de-ano-novo`,
      municipality_name: 'Sertã',
      category_name: 'Música',
      venue_name: 'Cine-Teatro',
      updated_at: '2026-12-01T10:00:00Z',
      sessions: [{ date: '2027-01-01', start_time: '21:30:00', end_time: null }],
    });
  });

  it('diz o quanto confia na categoria e de onde ela veio', async () => {
    // Publicar a categoria e esconder a confiança é publicar a parte que
    // convém: quem integra ficava com «exposicoes» sem forma de saber se
    // aquilo foi uma etiqueta da fonte, uma palavra do título, o tipo do
    // espaço — ou uma pessoa.
    const { events } = await agenda();

    expect(events[0]).toMatchObject({ category_confidence: 0.95, category_source: 'alias' });
  });

  it('um evento sem espaço, sem categoria e sem sessões leva nulos e listas vazias, não buracos', async () => {
    loadFeed.mockResolvedValue({
      events: [{ ...EVENTO, id: 'e2', venue_id: null, category_slug: null }],
      total: 1,
      context: CONTEXTO,
    });

    const { events } = await agenda();

    expect(events[0]).toMatchObject({
      venue_name: null,
      category_name: null,
      updated_at: null,
      sessions: [],
    });
  });

  it('parâmetros inválidos dão um 400 que ensina — e que não se guarda', async () => {
    const resposta = await GET(pedido('?page=0'), contexto('travessia'));

    expect(resposta.status).toBe(400);
    expect(resposta.headers.get('Cache-Control')).toBe('no-store');
    expect(resposta.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const corpo = (await resposta.json()) as {
      error: string;
      details: Record<string, string[] | undefined>;
      parameters: unknown;
      documentation: string;
    };
    expect(corpo.error).toBe('Parâmetros inválidos.');
    expect(corpo.details.page?.length).toBeGreaterThan(0);
    expect(corpo.parameters).toEqual(API_PARAMETERS);
    expect(corpo.documentation).toBe(`${ORIGEM}/levar#dados`);
    expect(loadFeed).not.toHaveBeenCalled();
  });

  it('«false» é «sem filtro» e não um filtro ao contrário; o que não é nem um nem outro é erro', async () => {
    // A coerção do JavaScript diz que a cadeia «false» é verdadeira. Alguém
    // que escreva `free=false` à espera de ver tudo tem de ver tudo.
    await agenda('?free=false');
    expect(loadFeed.mock.calls[0]?.[1].free).toBeUndefined();

    const talvez = await GET(pedido('?free=talvez'), contexto('travessia'));
    expect(talvez.status).toBe(400);
    const { details } = (await talvez.json()) as { details: Record<string, string[]> };
    expect(details.free).toEqual(['Usa 1 ou 0 (também aceita true/false).']);
  });

  it('um segmento que não é de nenhuma região é 404, e a rota não o disfarça', async () => {
    // O `exigirRegiao` verdadeiro acaba em `notFound()` quando a base não
    // conhece o identificador; a rota não o apanha nem lê nada antes disso.
    exigirRegiao.mockImplementation(async () => notFound());

    await expect(GET(pedido(), contexto('nao-existe'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(loadFeed).not.toHaveBeenCalled();
  });
});
