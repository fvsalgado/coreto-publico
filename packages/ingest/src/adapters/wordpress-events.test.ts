import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SourceRow } from '../adapter.js';
import { HttpClient } from '../http.js';
import { RunLogger } from '../run-logger.js';
import {
  lerCusto,
  lerDatasTribe,
  parseTribePage,
  tribeEndpoint,
  wordpressEventsAdapter,
} from './wordpress-events.js';

/**
 * A resposta em `../__fixtures__/tribe-events.json` é inventada, ao
 * contrário do resto das fixtures, e é por isso que serve: o que este
 * adaptador lê não é um sítio — é o contrato da API do The Events Calendar,
 * igual em todas as instalações. Cada um dos quatro eventos exercita uma
 * forma que a API tem: hora, dia inteiro, período, noite que atravessa a
 * meia-noite; sítio com coordenadas, sítio sem nada, `venue: []`; cartaz e
 * `image: false`; «Free», «Grátis», «10€» e vazio.
 */
const pagina = readFileSync(
  fileURLToPath(new URL('../__fixtures__/tribe-events.json', import.meta.url)),
  'utf8',
);

const API = 'https://agenda-inventada.example/wp-json/tribe/events/v1/events';

function fonte(url = 'https://agenda-inventada.example/', config: Record<string, unknown> = {}) {
  const row: SourceRow = {
    id: 'jf-inventada',
    name: 'Junta de Freguesia Inventada',
    kind: 'feed',
    municipality_id: 'vila-da-charamela',
    region_id: null,
    venue_id: null,
    url,
    adapter: 'wordpress-events',
    config,
    is_enabled: true,
    baseline_item_count: null,
    min_expected_items: 0,
    consecutive_failures: 0,
    circuit_open_until: null,
  };
  return row;
}

function evento(id: number, titulo: string): Record<string, unknown> {
  return {
    id,
    title: titulo,
    url: `https://agenda-inventada.example/event/${id}/`,
    start_date: '2099-01-10 21:00:00',
    end_date: '2099-01-10 22:00:00',
    all_day: false,
    venue: [],
    image: false,
    categories: [],
  };
}

function paginaCom(eventos: Record<string, unknown>[], next: string | null = null): string {
  return JSON.stringify({
    events: eventos,
    next_rest_url: next ?? undefined,
    total: eventos.length,
  });
}

function stubPorUrl(
  responder: (url: string) => { body: string; status?: number },
  pedidos: string[] = [],
): HttpClient {
  return new HttpClient({
    minHostIntervalMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: (input) => {
      const url = String(input);
      pedidos.push(url);
      const resposta = responder(url);
      return Promise.resolve(new Response(resposta.body, { status: resposta.status ?? 200 }));
    },
  });
}

const registo = () => new RunLogger({ sourceId: 'jf-inventada', output: () => undefined });

describe('tribeEndpoint', () => {
  it('a partir do sítio, acrescenta o caminho da API e os parâmetros', () => {
    expect(tribeEndpoint('https://jf-exemplo.pt/', '2026-09-01')).toBe(
      'https://jf-exemplo.pt/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-09-01',
    );
    expect(tribeEndpoint('https://jf-exemplo.pt', '2026-09-01')).toBe(
      'https://jf-exemplo.pt/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-09-01',
    );
  });

  it('a partir da API, mantém o que a fonte já escreveu', () => {
    const endereco = tribeEndpoint(`${API}?categories=agenda&per_page=10`, '2026-09-01');
    expect(endereco).toContain('categories=agenda');
    expect(endereco).toContain('per_page=10');
    expect(endereco).not.toContain('per_page=50');
    expect(endereco).toContain('start_date=2026-09-01');
  });

  it('rebenta com um endereço ilegível', () => {
    expect(() => tribeEndpoint('isto não é um endereço', '2026-09-01')).toThrow(/ilegível/);
  });
});

describe('parseTribePage contra a resposta inventada', () => {
  const lida = parseTribePage(pagina, API);
  const porId = (id: string) => lida.events.find((evento) => evento.sourceKey === id);

  it('lê os quatro eventos, sem página seguinte', () => {
    expect(lida.events).toHaveLength(4);
    expect(lida.next).toBeNull();
    expect(lida.dropped).toBe(0);
  });

  it('desfaz as entidades do título e das categorias', () => {
    expect(porId('101')?.title).toBe('Noite de Fado – Sessão inventada');
    expect(porId('101')?.categoriesRaw).toEqual(['Música']);
    expect(porId('103')?.categoriesRaw).toEqual(['Exposições', 'Artes Plásticas']);
  });

  it('uma sessão com hora leva início e fim', () => {
    expect(porId('101')?.dates).toEqual([
      { date: '2026-09-12', startTime: '21:30', endTime: '23:30' },
    ]);
    expect(porId('101')?.isOngoing).toBe(false);
  });

  it('um dia inteiro não leva hora, por mais que a API escreva 00:00:00', () => {
    expect(porId('102')?.dates).toEqual([{ date: '2026-09-19', startTime: null, endTime: null }]);
  });

  it('uma exposição são os dois extremos, marcados como em cartaz', () => {
    expect(porId('103')?.dates.map((sessao) => sessao.date)).toEqual(['2026-10-10', '2026-11-08']);
    expect(porId('103')?.isOngoing).toBe(true);
  });

  it('um baile que acaba à uma da manhã é uma noite, não dois dias', () => {
    expect(porId('104')?.dates).toEqual([
      { date: '2026-10-31', startTime: '22:00', endTime: '01:00' },
    ]);
    expect(porId('104')?.isOngoing).toBe(false);
  });

  it('o sítio traz nome, morada e coordenadas — em número ou em texto', () => {
    const fado = porId('101');
    expect(fado?.venueName).toBe('Cine-Teatro da Charamela');
    expect(fado?.locationAddress).toBe('Rua do Coreto 1, 9999-001, Vila da Charamela');
    expect(fado?.latitude).toBe(41.451);
    expect(fado?.longitude).toBe(-7.201);

    const baile = porId('104');
    expect(baile?.latitude).toBe(41.321);
    expect(baile?.longitude).toBe(-7.051);
  });

  it('sem sítio a API manda uma lista vazia, e isso é nada', () => {
    expect(porId('102')?.venueName).toBeNull();
    expect(porId('102')?.locationAddress).toBeNull();
    expect(porId('102')?.latitude).toBeNull();
    // Um sítio só com nome também não tem coordenadas inventadas.
    expect(porId('103')?.venueName).toBe('Galeria da Charamela');
    expect(porId('103')?.latitude).toBeNull();
  });

  it('sem cartaz a API manda false, e isso é nada; um caminho relativo resolve-se', () => {
    expect(porId('102')?.imageUrl).toBeNull();
    expect(porId('101')?.imageUrl).toBe(
      'https://agenda-inventada.example/wp-content/uploads/2026/08/fado.jpg',
    );
    expect(porId('104')?.imageUrl).toBe(
      'https://agenda-inventada.example/wp-content/uploads/2026/09/baile.jpg',
    );
  });

  it('o preço: «Free» e «Grátis» são de graça, «10€» fica para o harmonizador, vazio é nada', () => {
    expect(porId('102')?.isFree).toBe(true);
    expect(porId('102')?.priceRaw).toBe('Free');
    expect(porId('104')?.isFree).toBe(true);
    expect(porId('101')?.isFree).toBeNull();
    expect(porId('101')?.priceRaw).toBe('10€');
    expect(porId('103')?.isFree).toBeNull();
    expect(porId('103')?.priceRaw).toBeNull();
  });

  it('a descrição perde o HTML e cai para o excerto quando não há', () => {
    expect(porId('101')?.description).toContain('Reserva aconselhada.');
    expect(porId('101')?.description).not.toContain('<strong>');
    expect(porId('102')?.description).toBe('Livros em segunda mão no jardim, o dia inteiro.');
  });

  it('a chave é o identificador da API e o endereço é a ligação', () => {
    expect(porId('101')?.sourceUrl).toBe('https://agenda-inventada.example/event/noite-de-fado/');
  });

  it('o website fica no registo em bruto e não passa por bilheteira', () => {
    expect(porId('101')?.payload?.['website']).toBe('https://banda-inventada.example/fado');
    expect(porId('101')?.ticketingUrl).toBeUndefined();
  });

  it('o venueName da configuração só entra onde a API não deu sítio', () => {
    const comCasa = parseTribePage(pagina, API, { venueName: 'Casa do Povo' });
    expect(comCasa.events.find((evento) => evento.sourceKey === '102')?.venueName).toBe(
      'Casa do Povo',
    );
    expect(comCasa.events.find((evento) => evento.sourceKey === '101')?.venueName).toBe(
      'Cine-Teatro da Charamela',
    );
  });
});

describe('parseTribePage com o que a API não devia mandar', () => {
  it('rebenta com o que não é JSON nem uma página de eventos', () => {
    expect(() => parseTribePage('<html>Erro</html>', API)).toThrow(/não é JSON/);
    expect(() => parseTribePage('[]', API)).toThrow(/mudou de forma/);
  });

  it('deixa cair, e conta, o que não tem título ou data — ou tem outra forma', () => {
    const lida = parseTribePage(
      paginaCom([
        { id: 1, title: '', start_date: '2026-09-12 21:30:00' },
        { id: 2, title: 'Sem data' },
        { id: 3, title: { rendered: 'Título do WordPress, não do plugin' } },
        { id: 4, title: 'Data ilegível', start_date: 'brevemente' },
      ]),
      API,
    );
    expect(lida.events).toEqual([]);
    expect(lida.dropped).toBe(4);
  });

  it('sem identificador, a chave é a ligação; sem ligação, o dia e o título', () => {
    const lida = parseTribePage(
      paginaCom([
        { title: 'A', url: 'https://x.example/event/a/', start_date: '2099-01-10 21:00:00' },
        { title: 'B', start_date: '2099-01-11 21:00:00' },
      ]),
      API,
    );
    expect(lida.events.map((evento) => evento.sourceKey)).toEqual(['event/a', '2099-01-11-B']);
  });

  it('não repete um identificador', () => {
    const lida = parseTribePage(paginaCom([evento(7, 'A'), evento(7, 'A outra vez')]), API);
    expect(lida.events).toHaveLength(1);
  });

  it('anuncia a página seguinte quando a API a dá', () => {
    expect(parseTribePage(paginaCom([evento(1, 'A')], `${API}?page=2`), API).next).toBe(
      `${API}?page=2`,
    );
  });

  it('um envelope sem eventos é uma página vazia, não um erro', () => {
    expect(parseTribePage('{"total": 0}', API)).toEqual({ events: [], next: null, dropped: 0 });
  });
});

describe('lerCusto', () => {
  it('só afirma «de graça» quando o campo diz isso e mais nada', () => {
    expect(lerCusto('0')).toEqual({ priceRaw: '0', isFree: true });
    expect(lerCusto(0)).toEqual({ priceRaw: '0', isFree: true });
    expect(lerCusto('Entrada livre')).toEqual({ priceRaw: 'Entrada livre', isFree: true });
    expect(lerCusto('GRÁTIS')).toEqual({ priceRaw: 'GRÁTIS', isFree: true });
    expect(lerCusto('5€ / Grátis para sócios')).toEqual({
      priceRaw: '5€ / Grátis para sócios',
      isFree: null,
    });
    expect(lerCusto('')).toEqual({ priceRaw: null, isFree: null });
    expect(lerCusto(null)).toEqual({ priceRaw: null, isFree: null });
  });
});

describe('lerDatasTribe', () => {
  it('um período com horas dá os dois extremos, com as horas', () => {
    const datas = lerDatasTribe('2026-09-12 10:00:00', '2026-09-14 18:00:00', false);
    expect(datas.sessions.map((sessao) => sessao.date)).toEqual(['2026-09-12', '2026-09-14']);
    expect(datas.sessions[0]?.startTime).toBe('10:00');
    expect(datas.isOngoing).toBe(true);
  });

  it('sem data legível não há sessão nenhuma', () => {
    expect(lerDatasTribe('brevemente', null, false)).toEqual({ sessions: [], isOngoing: false });
    expect(lerDatasTribe(null, null, false)).toEqual({ sessions: [], isOngoing: false });
  });
});

describe('wordpressEventsAdapter', () => {
  it('pede à API a partir de hoje, cinquenta de cada vez, a partir do endereço do sítio', async () => {
    const pedidos: string[] = [];
    const eventos = await wordpressEventsAdapter.fetchEvents({
      source: fonte(),
      http: stubPorUrl(() => ({ body: paginaCom([evento(1, 'A')]) }), pedidos),
      log: registo(),
    });

    expect(eventos).toHaveLength(1);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toMatch(
      /^https:\/\/agenda-inventada\.example\/wp-json\/tribe\/events\/v1\/events\?/,
    );
    expect(pedidos[0]).toContain('per_page=50');
    expect(pedidos[0]).toMatch(/start_date=\d{4}-\d{2}-\d{2}/);
  });

  it('segue a paginação e junta sem repetir', async () => {
    const pedidos: string[] = [];
    const http = stubPorUrl(
      (url) =>
        url.includes('page=2')
          ? { body: paginaCom([evento(2, 'B'), evento(3, 'C')]) }
          : { body: paginaCom([evento(1, 'A'), evento(2, 'B')], `${API}?page=2`) },
      pedidos,
    );
    const eventos = await wordpressEventsAdapter.fetchEvents({
      source: fonte(),
      http,
      log: registo(),
    });

    expect(eventos.map((evento) => evento.sourceKey)).toEqual(['1', '2', '3']);
    expect(pedidos).toHaveLength(2);
  });

  it('não segue mais do que quatro páginas, e avisa', async () => {
    const pedidos: string[] = [];
    const log = registo();
    const http = stubPorUrl((url) => {
      const atual = Number(/page=(\d+)/.exec(url)?.[1] ?? '1');
      return { body: paginaCom([evento(atual, `Página ${atual}`)], `${API}?page=${atual + 1}`) };
    }, pedidos);

    const eventos = await wordpressEventsAdapter.fetchEvents({ source: fonte(), http, log });

    expect(pedidos).toHaveLength(4);
    expect(eventos).toHaveLength(4);
    expect(log.warnings.map((aviso) => aviso.message)).toContain(
      'tecto de páginas da API atingido',
    );
  });

  it('não segue uma página seguinte noutro servidor', async () => {
    const pedidos: string[] = [];
    const http = stubPorUrl(
      () => ({
        body: paginaCom(
          [evento(1, 'A')],
          'https://outro-sitio.example/wp-json/tribe/events/v1/events?page=2',
        ),
      }),
      pedidos,
    );
    await wordpressEventsAdapter.fetchEvents({ source: fonte(), http, log: registo() });
    expect(pedidos).toHaveLength(1);
  });

  it('rebenta quando a primeira página não responde', async () => {
    await expect(
      wordpressEventsAdapter.fetchEvents({
        source: fonte(),
        http: stubPorUrl(() => ({ body: '', status: 503 })),
        log: registo(),
      }),
    ).rejects.toThrow(/não respondeu/);
  });

  it('uma segunda página que falha custa o resto, não o que já se leu', async () => {
    const log = registo();
    const http = stubPorUrl((url) =>
      url.includes('page=2')
        ? { body: '', status: 500 }
        : { body: paginaCom([evento(1, 'A')], `${API}?page=2`) },
    );
    const eventos = await wordpressEventsAdapter.fetchEvents({ source: fonte(), http, log });

    expect(eventos).toHaveLength(1);
    expect(
      log.warnings.some((aviso) => aviso.message.startsWith('página seguinte sem resposta')),
    ).toBe(true);
  });

  it('respeita o tecto de itens da configuração', async () => {
    const eventos = await wordpressEventsAdapter.fetchEvents({
      source: fonte(API, { maxItems: 2 }),
      http: stubPorUrl(() => ({
        body: paginaCom([evento(1, 'A'), evento(2, 'B'), evento(3, 'C')]),
      })),
      log: registo(),
    });
    expect(eventos).toHaveLength(2);
  });

  it('uma agenda vazia dá zero, com aviso', async () => {
    const log = registo();
    const eventos = await wordpressEventsAdapter.fetchEvents({
      source: fonte(),
      http: stubPorUrl(() => ({ body: paginaCom([]) })),
      log,
    });
    expect(eventos).toEqual([]);
    expect(log.warnings.map((aviso) => aviso.message)).toContain(
      'a API de eventos de Junta de Freguesia Inventada devolveu zero eventos',
    );
  });
});
