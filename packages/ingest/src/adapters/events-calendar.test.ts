import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SourceRow } from '../adapter.js';
import { HttpClient } from '../http.js';
import { RunLogger } from '../run-logger.js';
import { eventsCalendarAdapter, parseEventsCalendar } from './events-calendar.js';

/**
 * A página em `../__fixtures__/events-calendar.html` é inventada, ao
 * contrário do resto das fixtures, e é por isso que serve: o que este
 * adaptador lê não é a marcação de um tema — é `schema.org/Event`, um
 * contrato publicado, igual em todos os sítios que o servem. A página traz
 * um `@graph` com um `WebSite` pelo meio, um `TheaterEvent`, um evento
 * cancelado num bloco à parte, e o mesmo evento escrito duas vezes.
 */
const pagina = readFileSync(
  fileURLToPath(new URL('../__fixtures__/events-calendar.html', import.meta.url)),
  'utf8',
);

const PAGINA = 'https://filarmonica-da-ponte.example/agenda/';
const PECA = 'https://filarmonica-da-ponte.example/agenda/o-coreto-vazio/';

function comJsonLd(...nodes: unknown[]): string {
  return `<html><body>${nodes
    .map((node) => `<script type="application/ld+json">${JSON.stringify(node)}</script>`)
    .join('')}</body></html>`;
}

function fonte(config: Record<string, unknown> = {}): SourceRow {
  return {
    id: 'filarmonica-da-ponte',
    name: 'Sociedade Filarmónica da Ponte',
    kind: 'venue_site',
    municipality_id: 'ponte-do-bombo',
    region_id: null,
    venue_id: null,
    url: PAGINA,
    adapter: 'events-calendar',
    config,
    is_enabled: true,
    baseline_item_count: null,
    min_expected_items: 0,
    consecutive_failures: 0,
    circuit_open_until: null,
  };
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

const registo = () => new RunLogger({ sourceId: 'filarmonica-da-ponte', output: () => undefined });

describe('parseEventsCalendar contra a página inventada', () => {
  const lida = parseEventsCalendar(pagina, PAGINA);
  const concerto = lida.events.find((evento) => evento.title === 'Concerto de Outono');
  const peca = lida.events.find((evento) => evento.title.startsWith('«O Coreto Vazio»'));

  it('lê os dois eventos que a página afirma, e nomeia o cancelado', () => {
    expect(lida.events).toHaveLength(2);
    expect(lida.cancelled).toEqual(['Recital cancelado']);
  });

  it('desdobra o @graph, salta o WebSite e lê um TheaterEvent como evento', () => {
    expect(concerto).toBeDefined();
    expect(peca).toBeDefined();
  });

  it('resolve uma ligação relativa contra a página', () => {
    expect(concerto?.sourceUrl).toBe(
      'https://filarmonica-da-ponte.example/agenda/concerto-de-outono/',
    );
    expect(concerto?.sourceKey).toBe('agenda/concerto-de-outono');
  });

  it('não repete o evento que o tema escreveu duas vezes', () => {
    expect(lida.events.filter((evento) => evento.sourceKey === peca?.sourceKey)).toHaveLength(1);
  });

  it('traz sítio, morada, coordenadas, cartaz, preço e bilheteira', () => {
    expect(concerto?.dates).toEqual([{ date: '2026-10-17', startTime: '21:30', endTime: '23:00' }]);
    expect(concerto?.venueName).toBe('Salão da Filarmónica');
    expect(concerto?.locationAddress).toBe('Largo da Ponte 3, 9999-100, Ponte do Bombo');
    expect(concerto?.latitude).toBe(41.321);
    expect(concerto?.longitude).toBe(-7.051);
    expect(concerto?.imageUrl).toBe('https://filarmonica-da-ponte.example/img/outono.jpg');
    expect(concerto?.priceRaw).toBe('5 €');
    expect(concerto?.ticketingUrl).toBe('https://filarmonica-da-ponte.example/bilhetes/outono');
    expect(concerto?.description).toBe(
      'A banda apresenta o programa de outono, com solistas convidados.',
    );
  });

  it('um fim de semana de teatro são os dois dias, e é de graça', () => {
    expect(peca?.dates.map((sessao) => sessao.date)).toEqual(['2026-11-07', '2026-11-08']);
    expect(peca?.isOngoing).toBe(true);
    expect(peca?.isFree).toBe(true);
    expect(peca?.categoriesRaw).toEqual(['Teatro']);
    expect(peca?.venueName).toBe('Salão da Filarmónica');
  });

  it('o venueName da configuração só entra onde o JSON-LD não deu sítio', () => {
    const html = comJsonLd(
      { '@type': 'Event', name: 'Sem sítio', startDate: '2099-01-10', url: PECA },
      {
        '@type': 'Event',
        name: 'Com sítio',
        startDate: '2099-01-11',
        location: 'Adro',
        url: PAGINA,
      },
    );
    const eventos = parseEventsCalendar(html, PAGINA, { venueName: 'Salão' }).events;
    expect(eventos.map((evento) => evento.venueName)).toEqual(['Salão', 'Adro']);
  });
});

describe('parseEventsCalendar com o que não é uma agenda', () => {
  it('uma página sem JSON-LD dá zero, sem rebentar', () => {
    expect(parseEventsCalendar('<html><body><p>Agenda</p></body></html>', PAGINA)).toEqual({
      events: [],
      cancelled: [],
    });
    expect(parseEventsCalendar('', PAGINA).events).toEqual([]);
  });

  it('um bloco com JSON partido não derruba os outros', () => {
    const html = `<html><body>
      <script type="application/ld+json">{ isto não é JSON</script>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'Event',
        name: 'Sobrevivente',
        startDate: '2099-01-10',
        url: PECA,
      })}</script>
    </body></html>`;
    expect(parseEventsCalendar(html, PAGINA).events.map((evento) => evento.title)).toEqual([
      'Sobrevivente',
    ]);
  });

  it('um Event sem nome não é um evento', () => {
    expect(
      parseEventsCalendar(comJsonLd({ '@type': 'Event', startDate: '2099-01-10' }), PAGINA).events,
    ).toEqual([]);
  });
});

describe('eventsCalendarAdapter', () => {
  it('percorre as listagens configuradas e junta sem repetir', async () => {
    const pedidos: string[] = [];
    const eventos = await eventsCalendarAdapter.fetchEvents({
      source: fonte({ listUrls: [PAGINA, `${PAGINA}?pagina=2`] }),
      http: stubPorUrl(() => ({ body: pagina }), pedidos),
      log: registo(),
    });

    expect(pedidos).toEqual([PAGINA, `${PAGINA}?pagina=2`]);
    expect(eventos).toHaveLength(2);
  });

  it('avisa do que a fonte cancelou, e não o importa', async () => {
    const log = registo();
    await eventsCalendarAdapter.fetchEvents({
      source: fonte(),
      http: stubPorUrl(() => ({ body: pagina })),
      log,
    });
    expect(log.warnings).toContainEqual({
      message: 'evento marcado como cancelado ou adiado pela fonte',
      detail: 'Recital cancelado',
    });
  });

  it('rebenta quando nenhuma listagem responde', async () => {
    await expect(
      eventsCalendarAdapter.fetchEvents({
        source: fonte(),
        http: stubPorUrl(() => ({ body: '', status: 503 })),
        log: registo(),
      }),
    ).rejects.toThrow(/nenhuma página de listagem respondeu/);
  });

  it('uma listagem que falha não custa as outras', async () => {
    const log = registo();
    const eventos = await eventsCalendarAdapter.fetchEvents({
      source: fonte({ listUrls: [`${PAGINA}?pagina=0`, PAGINA] }),
      http: stubPorUrl((url) =>
        url.includes('pagina=0') ? { body: '', status: 500 } : { body: pagina },
      ),
      log,
    });
    expect(eventos).toHaveLength(2);
    expect(log.warnings.some((aviso) => aviso.message.startsWith('listagem sem resposta'))).toBe(
      true,
    );
  });

  it('avisa quando a página respondeu mas não traz JSON-LD nenhum', async () => {
    const log = registo();
    const eventos = await eventsCalendarAdapter.fetchEvents({
      source: fonte(),
      http: stubPorUrl(() => ({
        body: '<html><body><p>A agenda mudou de sítio.</p></body></html>',
      })),
      log,
    });
    expect(eventos).toEqual([]);
    expect(log.warnings.map((aviso) => aviso.message)).toContain(
      'nenhum evento em JSON-LD nesta página',
    );
  });

  it('com followLinks, completa pelo JSON-LD da página do evento — e só a quem falta algo', async () => {
    const pedidos: string[] = [];
    const detalhe = comJsonLd({
      '@context': 'https://schema.org',
      '@type': 'TheaterEvent',
      name: '«O Coreto Vazio», pelo grupo de teatro da Ponte',
      url: PECA,
      startDate: '2026-11-07',
      endDate: '2026-11-08',
      description: 'Uma peça inventada sobre um coreto onde ninguém toca.',
      image: 'https://filarmonica-da-ponte.example/img/coreto-vazio.jpg',
      location: 'Salão da Filarmónica',
    });

    const eventos = await eventsCalendarAdapter.fetchEvents({
      source: fonte({ followLinks: true }),
      http: stubPorUrl((url) => ({ body: url === PECA ? detalhe : pagina }), pedidos),
      log: registo(),
    });

    // O concerto já tinha descrição, data e cartaz: não se gasta um pedido com ele.
    expect(pedidos).toEqual([PAGINA, PECA]);

    const peca = eventos.find((evento) => evento.sourceUrl === PECA);
    expect(peca?.description).toBe('Uma peça inventada sobre um coreto onde ninguém toca.');
    expect(peca?.imageUrl).toBe('https://filarmonica-da-ponte.example/img/coreto-vazio.jpg');
    // O que a listagem já tinha dado ganha sempre.
    expect(peca?.dates.map((sessao) => sessao.date)).toEqual(['2026-11-07', '2026-11-08']);
    expect(peca?.isOngoing).toBe(true);
    expect(peca?.isFree).toBe(true);
  });

  it('respeita o tecto de itens da configuração', async () => {
    const eventos = await eventsCalendarAdapter.fetchEvents({
      source: fonte({ maxItems: 1 }),
      http: stubPorUrl(() => ({ body: pagina })),
      log: registo(),
    });
    expect(eventos).toHaveLength(1);
  });
});
