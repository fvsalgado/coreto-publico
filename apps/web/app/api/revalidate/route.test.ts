import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O webhook que a recolha e a moderação chamam quando alguma coisa muda.
 *
 * Três promessas, por ordem de gravidade. Sem segredo configurado a rota não
 * existe — responde 503 em vez de deixar passar tudo, que é o que uma
 * comparação com `undefined` faria em silêncio. Com segredo, só quem o traz
 * consegue descartar a cache, e um portador errado não invalida nada. E o
 * que se invalida é o que o corpo pede: umas etiquetas, um concelho, ou —
 * sem corpo — tudo o que é público.
 *
 * O segredo entra pelo ambiente e não por um substituto do `env.ts`: é a
 * validação verdadeira que decide o que «configurado» quer dizer, e essa
 * decisão (dezasseis carateres, no mínimo) faz parte do que aqui se prova.
 * Daí a rota ser carregada de fresco em cada caso — o `env` lê o processo
 * uma vez, ao arrancar.
 */

const revalidateTag = vi.hoisted(() => vi.fn());

vi.mock('next/cache', () => ({
  revalidateTag,
  // O módulo das consultas chama-o ao carregar, para construir as suas
  // funções. Aqui devolve a função tal e qual: testa-se quem invalida.
  unstable_cache: <T>(fn: T) => fn,
}));

const { CACHE_TAGS } = await import('@/src/lib/queries/events');

const SEGREDO = 'um-segredo-de-prova-que-chega';
const PORTADOR = `Bearer ${SEGREDO}`;

function pedido(corpo: string | null, autorizacao?: string): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (autorizacao !== undefined) headers.set('authorization', autorizacao);
  return new Request('https://coreto.mediotejo.pt/api/revalidate', {
    method: 'POST',
    headers,
    body: corpo,
  });
}

async function chamar(corpo: string | null, autorizacao?: string): Promise<Response> {
  vi.resetModules();
  const { POST } = await import('./route');
  return POST(pedido(corpo, autorizacao));
}

async function etiquetas(resposta: Response): Promise<Set<string>> {
  expect(resposta.status).toBe(200);
  const corpo = (await resposta.json()) as { revalidated: string[]; at: string };
  expect(Number.isNaN(Date.parse(corpo.at))).toBe(false);
  return new Set(corpo.revalidated);
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    vi.stubEnv('REVALIDATE_SECRET', SEGREDO);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('sem segredo configurado, a rota está fechada — 503, e não «entra quem quiser»', async () => {
    vi.stubEnv('REVALIDATE_SECRET', undefined);

    const resposta = await chamar('{}', PORTADOR);

    expect(resposta.status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('um segredo curto de mais vale por nenhum', async () => {
    // O `env.ts` deita fora o que não passa na validação: um segredo de cinco
    // letras não dá 401 a toda a gente — dá 503, com o nome do campo no
    // registo, que é onde quem configurou o vai encontrar.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('REVALIDATE_SECRET', 'curto');

    const resposta = await chamar('{}', 'Bearer curto');

    expect(resposta.status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('recusa quem não traz o segredo certo, e não invalida nada', async () => {
    expect((await chamar('{"tags":["events"]}', 'Bearer outro-segredo-do-mesmo-tam')).status).toBe(
      401,
    );
    expect((await chamar('{"tags":["events"]}', 'Bearer curto')).status).toBe(401);
    // O segredo certo sem o esquema `Bearer` não conta como segredo.
    expect((await chamar('{"tags":["events"]}', SEGREDO)).status).toBe(401);
    expect((await chamar('{"tags":["events"]}')).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('recusa um corpo que não é o que o esquema diz', async () => {
    // `tags` tem de ser uma lista, e uma lista curta: trinta etiquetas chegam
    // para qualquer recolha, e um corpo maior é alguém a experimentar limites.
    expect((await chamar('{"tags":"events"}', PORTADOR)).status).toBe(400);
    const demais = JSON.stringify({ tags: Array.from({ length: 31 }, (_, i) => `etiqueta-${i}`) });
    expect((await chamar(demais, PORTADOR)).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('invalida as etiquetas pedidas, a fundo', async () => {
    const invalidadas = await etiquetas(await chamar('{"tags":["events","venues"]}', PORTADOR));

    expect(invalidadas).toEqual(new Set(['events', 'venues']));
    // `{ expire: 0 }` e não um perfil de validade: quem chama já sabe que os
    // dados mudaram, e o que se quer é purgar já.
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    expect(revalidateTag).toHaveBeenCalledWith('events', { expire: 0 });
    expect(revalidateTag).toHaveBeenCalledWith('venues', { expire: 0 });
  });

  it('um concelho invalida as listagens dele e a agenda inteira', async () => {
    const invalidadas = await etiquetas(
      await chamar('{"tags":["venues"],"municipality":"tomar"}', PORTADOR),
    );

    expect(invalidadas).toEqual(
      new Set(['venues', CACHE_TAGS.municipality('tomar'), CACHE_TAGS.events]),
    );
  });

  it('sem corpo, invalida tudo o que é público', async () => {
    // Um corpo vazio — ou um que não é JSON — vale por «tudo»: é o que a
    // recolha manda quando não sabe dizer o que mudou.
    for (const corpo of [null, 'isto não é json']) {
      const invalidadas = await etiquetas(await chamar(corpo, PORTADOR));
      expect([...invalidadas]).toEqual(
        expect.arrayContaining([
          CACHE_TAGS.events,
          CACHE_TAGS.venues,
          CACHE_TAGS.coretos,
          CACHE_TAGS.taxonomy,
        ]),
      );
    }
  });
});
