import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatKind } from '@/src/lib/analytics/kinds';
import type { RateLimitOptions, RateLimitResult } from '@/src/lib/rate-limit';

/**
 * A rota mais chamada do sítio, e a que menos pode custar.
 *
 * A ordem das recusas é o assunto: origem, tamanho, forma, limite — e só
 * depois a base de dados. Cada degrau existe para o seguinte não ser
 * atingido por lixo: um `sendBeacon` de outro sítio não chega a ser lido, um
 * corpo que não é um pedido não chega ao limitador (que vive numa tabela), e
 * um cliente a martelar não chega à escrita.
 *
 * A escrita e o limitador estão substituídos; o `tooManyRequests` é o
 * verdadeiro, para o 429 sair com o `Retry-After` que o navegador respeita.
 * O endereço público do deployment fica fixo porque é o terceiro anfitrião
 * que a rota aceita — o que conta atrás de um proxy.
 */

const recordEventStat = vi.hoisted(() =>
  vi.fn<(eventId: string, kind: StatKind) => Promise<void>>(),
);
const checkRateLimit = vi.hoisted(() =>
  vi.fn<(request: Request, options: RateLimitOptions) => Promise<RateLimitResult>>(),
);

vi.mock('@/src/lib/analytics/record', () => ({ recordEventStat }));
vi.mock('@/src/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/lib/rate-limit')>()),
  checkRateLimit,
}));
vi.mock('@/src/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/lib/env')>()),
  SITE_URL: 'https://coreto.mediotejo.pt',
}));

const { POST } = await import('./route');

const EVENTO = '3f2b8c1e-5d47-4a3b-9c6e-1f0a2b3c4d5e';
const CONTAGEM = JSON.stringify({ eventId: EVENTO, kind: 'view' });
const DEIXA_PASSAR: RateLimitResult = { allowed: true, hits: 1, resetAt: null };

function pedido(corpo: string, cabecalhos: Record<string, string> = {}): Request {
  return new Request('https://coreto.mediotejo.pt/api/stats', {
    method: 'POST',
    headers: { host: 'coreto.mediotejo.pt', ...cabecalhos },
    body: corpo,
  });
}

describe('POST /api/stats', () => {
  beforeEach(() => {
    recordEventStat.mockReset().mockResolvedValue(undefined);
    checkRateLimit.mockReset().mockResolvedValue(DEIXA_PASSAR);
  });

  it('conta um pedido do próprio sítio, e responde sem corpo', async () => {
    const resposta = await POST(pedido(CONTAGEM, { origin: 'https://coreto.mediotejo.pt' }));

    expect(resposta.status).toBe(204);
    expect(resposta.body).toBeNull();
    expect(recordEventStat).toHaveBeenCalledWith(EVENTO, 'view');
    expect(checkRateLimit).toHaveBeenCalledWith(expect.any(Request), {
      route: 'stats',
      limit: 60,
      windowSeconds: 60,
    });
  });

  it('recusa uma origem que não é a do sítio — ou que não se lê — sem chegar ao limitador', async () => {
    // `sendBeacon` sabe mandar `text/plain` sem pedir autorização a ninguém:
    // é a origem que fecha a porta, não o tipo do corpo.
    expect((await POST(pedido(CONTAGEM, { origin: 'https://outro-sitio.example' }))).status).toBe(
      403,
    );
    expect((await POST(pedido(CONTAGEM, { origin: 'isto não é uma origem' }))).status).toBe(403);
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(recordEventStat).not.toHaveBeenCalled();
  });

  it('atrás de um proxy, o domínio público continua a ser o próprio sítio', async () => {
    // O `host` que chega é o interno e a origem é a pública. Nenhum dos dois
    // é forjável por uma página de outra origem.
    const peloEnderecoPublico = await POST(
      pedido(CONTAGEM, { host: 'coreto-sage.vercel.app', origin: 'https://coreto.mediotejo.pt' }),
    );
    expect(peloEnderecoPublico.status).toBe(204);

    const peloProxy = await POST(
      pedido(CONTAGEM, {
        host: 'interno.local',
        'x-forwarded-host': 'agenda.travessia.example',
        origin: 'https://agenda.travessia.example',
      }),
    );
    expect(peloProxy.status).toBe(204);
  });

  it('sem cabeçalho de origem, quem manda é o limite por endereço', async () => {
    // Um cliente que não é um navegador não manda `origin`; não é recusado por
    // isso, mas também não passa ao lado do balde.
    const resposta = await POST(pedido(CONTAGEM));

    expect(resposta.status).toBe(204);
    expect(checkRateLimit).toHaveBeenCalledOnce();
  });

  it('um corpo maior do que um pedido pode ser é recusado à porta', async () => {
    const gordo = JSON.stringify({ eventId: EVENTO, kind: 'view', enchimento: 'x'.repeat(300) });

    expect((await POST(pedido(gordo))).status).toBe(413);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('lixo não custa uma ida à base: valida-se antes de limitar', async () => {
    expect((await POST(pedido('{isto não é json'))).status).toBe(400);
    expect(
      (await POST(pedido(JSON.stringify({ eventId: 'não-é-um-uuid', kind: 'view' })))).status,
    ).toBe(400);
    expect((await POST(pedido(JSON.stringify({ eventId: EVENTO, kind: 'gosto' })))).status).toBe(
      400,
    );
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(recordEventStat).not.toHaveBeenCalled();
  });

  it('quem martela leva 429 com hora de voltar, e não conta', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, hits: 61, resetAt: null });

    const resposta = await POST(pedido(CONTAGEM));

    expect(resposta.status).toBe(429);
    expect(resposta.headers.get('Retry-After')).toBe('60');
    expect(recordEventStat).not.toHaveBeenCalled();
  });
});
