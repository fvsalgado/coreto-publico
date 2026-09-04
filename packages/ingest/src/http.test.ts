import { describe, expect, it } from 'vitest';
import { HttpClient, backoffMs, parseRetryAfter, USER_AGENT } from './http.js';

interface Recorder {
  urls: string[];
  headers: Array<Record<string, string>>;
  sleeps: number[];
}

/** Uma resposta por descrever, para cada tentativa receber a sua. */
type Reply = { status: number; body?: string; headers?: Record<string, string> } | Error;

/** Cliente com relógio, espera e rede substituídos — nada aqui sai da máquina. */
function makeClient(
  replies: readonly Reply[],
  options: { minHostIntervalMs?: number } = {},
): { client: HttpClient; recorder: Recorder } {
  const recorder: Recorder = { urls: [], headers: [], sleeps: [] };
  let clock = 0;
  let index = 0;

  const client = new HttpClient({
    minHostIntervalMs: options.minHostIntervalMs ?? 0,
    now: () => clock,
    sleep: (ms) => {
      recorder.sleeps.push(ms);
      clock += ms;
      return Promise.resolve();
    },
    fetchImpl: (input, init) => {
      recorder.urls.push(String(input));
      const headers = init?.headers;
      recorder.headers.push(
        headers && !Array.isArray(headers) ? { ...(headers as Record<string, string>) } : {},
      );
      const next = replies[Math.min(index, replies.length - 1)];
      index += 1;
      if (next instanceof Error) return Promise.reject(next);
      if (!next) return Promise.resolve(new Response('', { status: 500 }));
      // Um `Response` só se lê uma vez: cada tentativa leva o seu.
      return Promise.resolve(
        new Response(next.body ?? '', { status: next.status, headers: next.headers ?? {} }),
      );
    },
  });

  return { client, recorder };
}

describe('backoffMs', () => {
  it('duplica a cada tentativa', () => {
    expect([backoffMs(1), backoffMs(2), backoffMs(3)]).toEqual([1_000, 2_000, 4_000]);
  });
});

describe('parseRetryAfter', () => {
  it('lê segundos e datas', () => {
    expect(parseRetryAfter('120', 0)).toBe(120_000);
    expect(
      parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT', Date.parse('2026-10-21T07:27:30Z')),
    ).toBe(30_000);
    expect(parseRetryAfter(null, 0)).toBeNull();
    expect(parseRetryAfter('já a seguir', 0)).toBeNull();
  });
});

describe('HttpClient', () => {
  it('identifica-se e pede em português', async () => {
    const { client, recorder } = makeClient([{ status: 200, body: 'olá' }]);
    const response = await client.get('https://www.cm-tomar.pt/pt/agenda');

    expect(response.ok).toBe(true);
    expect(response.body).toBe('olá');
    expect(recorder.headers[0]?.['user-agent']).toBe(USER_AGENT);
    expect(recorder.headers[0]?.['accept-language']).toContain('pt-PT');
    expect(client.counters()).toEqual({ responses: 1, failures: 0 });
  });

  it('repete um 503 com recuo exponencial e desiste ao fim das tentativas', async () => {
    const { client, recorder } = makeClient([{ status: 503 }]);
    const response = await client.get('https://www.cm-tomar.pt/pt/agenda');

    expect(response.ok).toBe(false);
    expect(response.status).toBe(503);
    expect(recorder.urls).toHaveLength(3);
    expect(recorder.sleeps).toEqual([1_000, 2_000]);
    expect(client.counters().responses).toBe(3);
  });

  it('nunca repete um 404', async () => {
    const { client, recorder } = makeClient([{ status: 404 }]);
    const response = await client.get('https://www.cm-tomar.pt/pt/agenda-antiga');

    expect(response.status).toBe(404);
    expect(recorder.urls).toHaveLength(1);
    expect(recorder.sleeps).toEqual([]);
  });

  it('espera o que o servidor pediu num 429', async () => {
    const { client, recorder } = makeClient([
      { status: 429, headers: { 'retry-after': '5' } },
      { status: 200, body: 'agenda' },
    ]);
    const response = await client.get('https://www.cm-tomar.pt/pt/agenda');

    expect(response.ok).toBe(true);
    expect(recorder.sleeps).toEqual([5_000]);
  });

  it('desiste quando o servidor pede uma espera longa de mais', async () => {
    const { client, recorder } = makeClient([{ status: 429, headers: { 'retry-after': '3600' } }]);
    const response = await client.get('https://www.cm-tomar.pt/pt/agenda');

    expect(response.ok).toBe(false);
    expect(response.error).toContain('3600s');
    expect(recorder.urls).toHaveLength(1);
  });

  it('conta como falha um pedido que nem chega a ter resposta', async () => {
    const { client } = makeClient([new Error('getaddrinfo ENOTFOUND')]);
    const response = await client.get('https://nao-existe.cm-exemplo.pt/agenda');

    expect(response.status).toBe(0);
    expect(response.error).toContain('ENOTFOUND');
    expect(client.counters()).toEqual({ responses: 0, failures: 3 });
  });

  it('espaça os pedidos ao mesmo hospedeiro e não os do seguinte', async () => {
    const { client, recorder } = makeClient([{ status: 200, body: 'ok' }], {
      minHostIntervalMs: 1_000,
    });

    await client.get('https://www.cm-tomar.pt/a');
    await client.get('https://www.cm-tomar.pt/b');
    await client.get('https://www.cm-ourem.pt/c');

    expect(recorder.sleeps).toEqual([1_000]);
  });
});
