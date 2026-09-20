import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../env', () => ({
  env: { EXTRACTION_API_KEY: 'chave-de-teste', EXTRACTION_MODEL: 'modelo-de-teste' },
}));

const { extractEvent, extractJsonObject, minimizarTexto } = await import('./extract');

const ENTRADA = {
  subject: 'Concerto de Outono',
  text: 'Concerto de Outono a 20 de setembro de 2026, pelas 21h30, no Cine-Teatro Paraíso, em Tomar. Bilhetes a 12 €.',
  municipalities: [{ id: 'tomar', name: 'Tomar' }],
  categories: [{ slug: 'musica', name: 'Música' }],
  today: '2026-09-07',
};

function respondeCom(texto: string): void {
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'text', text: texto }],
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('extractJsonObject', () => {
  it('tira o JSON de uma cerca de código', () => {
    expect(extractJsonObject('Aqui vai:\n```json\n{"a":1}\n```\nPronto.')).toBe('{"a":1}');
  });

  it('devolve nulo quando não há chavetas', () => {
    expect(extractJsonObject('Não consigo ler esta mensagem.')).toBe(null);
  });
});

/**
 * Uma falha determinística não se repete cinco vezes.
 *
 * O `JSON.parse` estava dentro do `try` que envolve a chamada inteira, e o
 * `catch` desse marca tudo o que não seja um `AbortError` como **repetível**.
 * Uma resposta truncada — o modelo bateu no `max_tokens` a meio de uma chaveta —
 * produz um `SyntaxError`, e a submissão ficava com `next_attempt_at` marcado:
 * a mesma chamada, sobre o mesmo texto, a gastar o orçamento diário para dar o
 * mesmo erro, cinco vezes.
 */
describe('extractEvent e o JSON que não se lê', () => {
  it('uma resposta truncada falha, e não se repete', async () => {
    // Truncada onde o `max_tokens` costuma cortar: o array de sessões ficou
    // aberto, mas há chavetas que cheguem para o `extractJsonObject` recortar
    // um bloco — e é aí que o `JSON.parse` rebenta.
    respondeCom('{"title": "Concerto de Outono", "dates": [{"date": "2026-09-20"}');
    const outcome = await extractEvent(ENTRADA);

    expect(outcome.status).toBe('failed');
    if (outcome.status !== 'failed') return;
    expect(outcome.retryable).toBe(false);
    expect(outcome.reason).toContain('JSON inválido');
  });

  it('e uma resposta sem chavetas nenhumas também não', async () => {
    respondeCom('Desculpa, não consigo ajudar com isso.');
    const outcome = await extractEvent(ENTRADA);

    expect(outcome.status).toBe('failed');
    if (outcome.status !== 'failed') return;
    expect(outcome.retryable).toBe(false);
  });
});

describe('extractEvent e o juízo sobre o que devolve', () => {
  const resposta = (extra: Record<string, unknown>): string =>
    JSON.stringify({
      title: 'Concerto de Outono',
      municipalityId: 'tomar',
      venueName: 'Cine-Teatro Paraíso',
      categorySlug: 'musica',
      confidence: 0.9,
      ...extra,
    });

  it('uma leitura fiel não deixa nada por verificar', async () => {
    respondeCom(
      resposta({ dates: [{ date: '2026-09-20', startTime: '21:30' }], priceRaw: '12 €' }),
    );
    const outcome = await extractEvent(ENTRADA);

    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    expect(outcome.naoVerificados).toEqual([]);
  });

  it('uma data que o email não tem sai marcada, e o resto vem na mesma', async () => {
    respondeCom(
      resposta({ dates: [{ date: '2026-10-04', startTime: '21:30' }], priceRaw: '12 €' }),
    );
    const outcome = await extractEvent(ENTRADA);

    expect(outcome.status).toBe('ok');
    if (outcome.status !== 'ok') return;
    // A proposta chega inteira: o juiz marca, não recusa.
    expect(outcome.event.title).toBe('Concerto de Outono');
    expect(outcome.naoVerificados).toEqual(['data 2026-10-04']);
  });
});

describe('minimizarTexto — o que não sai daqui', () => {
  it('corta a conversa citada a partir do «Em … escreveu:»', () => {
    const texto = [
      'Sábado há baile no coreto às 21h.',
      '',
      'Em qui., 18 de set. de 2026 às 10:02, Maria <maria@exemplo.pt> escreveu:',
      '> Olá, conseguem publicar?',
      '> Maria, 912 345 678',
    ].join('\n');
    expect(minimizarTexto(texto)).toBe('Sábado há baile no coreto às 21h.');
  });

  it('corta a partir da primeira linha citada com «>»', () => {
    expect(minimizarTexto('Concerto dia 20.\n> texto antigo\nmais')).toBe('Concerto dia 20.');
  });

  it('corta a assinatura a partir do separador da RFC 3676 e do «Enviado do meu»', () => {
    expect(minimizarTexto('Feira do livro, 3 a 5 de outubro.\n-- \nJoão Silva\nPresidente')).toBe(
      'Feira do livro, 3 a 5 de outubro.',
    );
    expect(minimizarTexto('Feira do livro.\nEnviado do meu iPhone\nJoão')).toBe('Feira do livro.');
  });

  it('troca os endereços de email que restem por [email]', () => {
    expect(minimizarTexto('Inscrições por cultura@cm-exemplo.pt até dia 3.')).toBe(
      'Inscrições por [email] até dia 3.',
    );
  });

  it('não toca no que é o evento', () => {
    const texto =
      'Teatro «A Sapateira», 14 de novembro, 21h30, Cine-Teatro. Bilhetes 5 €, 912 345 678.';
    expect(minimizarTexto(texto)).toBe(texto);
  });
});

describe('o pedido ao fornecedor leva o texto minimizado', () => {
  it('a assinatura e o email do remetente não saem no prompt', async () => {
    let corpoEnviado = '';
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      corpoEnviado = init.body;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                title: 'Concerto de Outono',
                municipalityId: 'tomar',
                confidence: 0.9,
                dates: [{ date: '2026-09-20', startTime: '21:30' }],
              }),
            },
          ],
        }),
      };
    });
    await extractEvent({
      ...ENTRADA,
      text: `${ENTRADA.text}\n-- \nAna Costa · ana.costa@exemplo.pt · 912 000 000`,
    });
    expect(corpoEnviado).toContain('Concerto de Outono a 20 de setembro');
    expect(corpoEnviado).not.toContain('Ana Costa');
    expect(corpoEnviado).not.toContain('ana.costa@exemplo.pt');
  });
});
