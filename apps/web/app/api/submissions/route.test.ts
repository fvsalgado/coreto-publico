import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldReader, IntakeOutcome } from '@/src/lib/submissions/intake';

/**
 * A porta por programa para a fila de moderação.
 *
 * O que esta rota decide sozinha é pouco, e é tudo de segurança: só JSON (um
 * formulário de outro sítio manda `x-www-form-urlencoded` sem o navegador
 * pedir autorização a esta origem), um tecto de tamanho, e um corpo que é um
 * objeto. O resto — validar, limitar, escrever — é do `receiveSubmission`, e
 * o que aqui se prova é a tradução de cada desfecho dele para um código e um
 * corpo que quem integra consegue ler.
 *
 * O receptor está substituído, e o leitor de campos também: o que interessa
 * é que o corpo lido chega ao receptor inteiro. O `tooManyRequests` é o
 * verdadeiro, para o 429 sair com o `Retry-After`.
 */

const receiveSubmission = vi.hoisted(() =>
  vi.fn<(request: Request, read: FieldReader) => Promise<IntakeOutcome>>(),
);
const jsonReader = vi.hoisted(() => vi.fn<(body: Record<string, unknown>) => FieldReader>());

vi.mock('@/src/lib/submissions/intake', () => ({ receiveSubmission, jsonReader }));

const { POST } = await import('./route');

const LEITOR: FieldReader = () => '';

const SUBMISSAO = JSON.stringify({
  title: 'Concerto de Ano Novo',
  municipalityId: 'tomar',
  startDate: '2027-01-01',
  contactEmail: 'banda@example.org',
  consent: true,
});

function pedido(corpo: string, contentType = 'application/json'): Request {
  return new Request('https://coreto.mediotejo.pt/api/submissions', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: corpo,
  });
}

describe('POST /api/submissions', () => {
  beforeEach(() => {
    jsonReader.mockReset().mockReturnValue(LEITOR);
    receiveSubmission.mockReset().mockResolvedValue({ kind: 'accepted' });
  });

  it('aceita para revisão, e diz que é só isso', async () => {
    const resposta = await POST(pedido(SUBMISSAO));

    // 202 e não 201: não foi criado nada de público, e a mensagem diz-o por
    // extenso para ninguém ficar à espera de ver o evento no sítio a seguir.
    expect(resposta.status).toBe(202);
    const corpo = (await resposta.json()) as { status: string; message: string };
    expect(corpo.status).toBe('pending_review');
    expect(corpo.message).toContain('revista por uma pessoa');
    expect(jsonReader).toHaveBeenCalledWith(JSON.parse(SUBMISSAO));
    expect(receiveSubmission).toHaveBeenCalledWith(expect.any(Request), LEITOR);
  });

  it('só aceita JSON — e aceita-o com charset e em qualquer caixa', async () => {
    expect((await POST(pedido(SUBMISSAO, 'application/x-www-form-urlencoded'))).status).toBe(415);
    expect((await POST(pedido(SUBMISSAO, 'text/plain'))).status).toBe(415);
    expect(receiveSubmission).not.toHaveBeenCalled();

    expect((await POST(pedido(SUBMISSAO, 'Application/JSON; charset=utf-8'))).status).toBe(202);
  });

  it('um corpo acima de 64 KiB é recusado sem ser lido', async () => {
    const gordo = JSON.stringify({ title: 'x'.repeat(64 * 1024) });

    expect((await POST(pedido(gordo))).status).toBe(413);
    expect(receiveSubmission).not.toHaveBeenCalled();
  });

  it('JSON que não se lê, ou que não é um objeto, é 400 com a razão por extenso', async () => {
    const partido = await POST(pedido('{"title": '));
    expect(partido.status).toBe(400);
    await expect(partido.json()).resolves.toEqual({ error: 'JSON inválido.', fields: {} });

    const lista = await POST(pedido('["um", "dois"]'));
    expect(lista.status).toBe(400);
    await expect(lista.json()).resolves.toEqual({
      error: 'O corpo tem de ser um objeto JSON.',
      fields: {},
    });

    expect(receiveSubmission).not.toHaveBeenCalled();
  });

  it('os campos por corrigir voltam a quem os mandou, campo a campo', async () => {
    receiveSubmission.mockResolvedValue({
      kind: 'invalid',
      message: 'Falta corrigir alguns campos antes de enviar.',
      fieldErrors: {
        startDate: 'Indica uma data no formato AAAA-MM-DD — por exemplo, 2027-01-01.',
      },
    });

    const resposta = await POST(pedido(SUBMISSAO));

    expect(resposta.status).toBe(400);
    await expect(resposta.json()).resolves.toEqual({
      error: 'Falta corrigir alguns campos antes de enviar.',
      fields: { startDate: 'Indica uma data no formato AAAA-MM-DD — por exemplo, 2027-01-01.' },
    });
  });

  it('demasiadas submissões dão 429 com hora de voltar', async () => {
    receiveSubmission.mockResolvedValue({
      kind: 'rate_limited',
      message: 'Já recebemos vários eventos deste sítio há pouco.',
      rateLimit: { allowed: false, hits: 6, resetAt: null },
    });

    const resposta = await POST(pedido(SUBMISSAO));

    expect(resposta.status).toBe(429);
    expect(resposta.headers.get('Retry-After')).toBe('60');
  });

  it.each([
    ['unavailable', 503, 'O envio de eventos está temporariamente indisponível. Tenta mais tarde.'],
    ['failed', 500, 'Não foi possível guardar a submissão. Tenta outra vez daqui a pouco.'],
  ] as const)(
    'quando o receptor diz «%s», a rota responde %i com a mensagem dele',
    async (kind, status, message) => {
      receiveSubmission.mockResolvedValue({ kind, message });

      const resposta = await POST(pedido(SUBMISSAO));

      expect(resposta.status).toBe(status);
      await expect(resposta.json()).resolves.toEqual({ error: message });
    },
  );
});
