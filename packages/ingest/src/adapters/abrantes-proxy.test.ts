import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SourceRow } from '../adapter.js';
import { HttpClient } from '../http.js';
import { RunLogger } from '../run-logger.js';
import { abrantesProxyAdapter, lerDataPt, lerDetalhe, paraRawEvent } from './abrantes-proxy.js';

import { comRobots } from '../robots-de-teste.js';
/**
 * Corre contra as respostas verdadeiras do proxy, capturadas a 28 de agosto
 * de 2026 com o cabeçalho Origin autorizado pela CM de Abrantes. Quando um
 * destes testes falhar, a hipótese mais provável é a API ter mudado.
 */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__');
const URL_PROXY = 'https://sitecmaproxy.cm-abrantes.pt/proxy/agenda/eventos';
const ORIGIN = 'https://www.cm-abrantes.pt';

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

function source(config: Record<string, unknown> = { originHeader: ORIGIN }): SourceRow {
  return {
    id: 'cm-abrantes',
    name: 'Câmara Municipal de Abrantes',
    kind: 'municipal_site',
    municipality_id: 'abrantes',
    region_id: null,
    venue_id: null,
    url: URL_PROXY,
    adapter: 'abrantes-proxy',
    config,
    is_enabled: true,
    baseline_item_count: null,
    min_expected_items: 1,
    consecutive_failures: 0,
    circuit_open_until: null,
  };
}

interface Pedido {
  url: string;
  origin: string | null;
}

function stubHttp(porUrl: (url: string) => string, pedidos: Pedido[] = []): HttpClient {
  return new HttpClient({
    minHostIntervalMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: comRobots((input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      pedidos.push({ url, origin: headers.get('origin') });
      return Promise.resolve(new Response(porUrl(url), { status: 200 }));
    }),
  });
}

function log(): RunLogger {
  return new RunLogger({ sourceId: 'cm-abrantes', output: () => undefined });
}

describe('lerDataPt', () => {
  it('converte dd-mm-aaaa e recusa o resto', () => {
    expect(lerDataPt('03-09-2026')).toBe('2026-09-03');
    expect(lerDataPt('2026-09-03')).toBeNull();
    expect(lerDataPt('99-99-2026')).toBeNull();
    expect(lerDataPt('')).toBeNull();
  });
});

describe('paraRawEvent', () => {
  it('constrói o evento a partir do item da lista', () => {
    const raw = paraRawEvent({
      id: 649,
      titulo: 'FIF Abrantes',
      local: 'Praça Barão da Batalha',
      dataInicio: '03-09-2026',
      dataFim: '03-09-2026',
      areaTematica: 'Cultura',
      estado: 'Disponível',
    });
    expect(raw).not.toBeNull();
    expect(raw?.sourceKey).toBe('649');
    expect(raw?.dates).toEqual([{ date: '2026-09-03' }]);
    expect(raw?.venueName).toBe('Praça Barão da Batalha');
    expect(raw?.categoriesRaw).toEqual(['Cultura']);
  });

  it('deixa cair o cancelado e o que não tem data', () => {
    expect(
      paraRawEvent({ id: 1, titulo: 'X', dataInicio: '01-01-2027', estado: 'Cancelado' }),
    ).toBeNull();
    expect(paraRawEvent({ id: 2, titulo: 'Y', estado: 'Disponível' })).toBeNull();
  });
});

describe('lerDetalhe', () => {
  it('lê a hora, a descrição e o promotor do detalhe real', () => {
    const detalhe = lerDetalhe(fixture('abrantes-proxy-detalhe.json'));
    expect(detalhe).not.toBeNull();
    expect(detalhe?.startTime).toBe('19:30');
    // O detalhe sempre trouxe a hora de fim; só nunca ninguém a carregou.
    expect(detalhe?.endTime).toBe('03:00');
    expect(detalhe?.description).toBeTruthy();
  });

  it('a hora de fim segue as regras da de início: «00:00» é o campo por preencher', () => {
    const detalhe = lerDetalhe(
      JSON.stringify({ payload: [{ evento: { horaInicio: '21:00', horaFim: '00:00' } }] }),
    );
    expect(detalhe?.startTime).toBe('21:00');
    expect(detalhe?.endTime).toBeNull();
  });

  it('aceita o payload vazio dos eventos passados', () => {
    expect(lerDetalhe('{"payload": ""}')).toBeNull();
    expect(lerDetalhe('não é json')).toBeNull();
  });
});

describe('abrantesProxyAdapter', () => {
  it('recusa correr sem originHeader configurado', async () => {
    const http = stubHttp(() => fixture('abrantes-proxy.json'));
    await expect(
      abrantesProxyAdapter.fetchEvents({ source: source({}), http, log: log() }),
    ).rejects.toThrow(/originHeader/);
  });

  it('envia o cabeçalho Origin autorizado em todos os pedidos', async () => {
    const pedidos: Pedido[] = [];
    const http = stubHttp(
      (url) => (url === URL_PROXY ? fixture('abrantes-proxy.json') : '{"payload": ""}'),
      pedidos,
    );
    await abrantesProxyAdapter.fetchEvents({ source: source(), http, log: log() });
    expect(pedidos.length).toBeGreaterThan(0);
    for (const pedido of pedidos) expect(pedido.origin).toBe(ORIGIN);
  });

  it('traz hoje e futuro da resposta real, com as datas convertidas', async () => {
    const http = stubHttp((url) =>
      url === URL_PROXY ? fixture('abrantes-proxy.json') : fixture('abrantes-proxy-detalhe.json'),
    );
    const events = await abrantesProxyAdapter.fetchEvents({ source: source(), http, log: log() });

    // 3 de hoje + 9 futuros; o passado truncado da fixture pode entrar ou não
    // consoante o dia em que o teste corre — o que se garante é o presente.
    expect(events.length).toBeGreaterThanOrEqual(12);
    const fif = events.find((event) => event.title === 'FIF Abrantes');
    expect(fif?.dates[0]?.date).toBe('2026-09-03');
    // O detalhe (fixture do Festival ao Alto) enriquece os futuros — com a
    // hora a que acaba, que atravessa a meia-noite e é o harmonizador que o
    // decide.
    expect(fif?.dates[0]?.startTime).toBe('19:30');
    expect(fif?.dates[0]?.endTime).toBe('03:00');
    expect(fif?.description).toBeTruthy();
  });
});
