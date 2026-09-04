import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { htmlToText, plainTextOf, readInboundWebhook, webhookRejection } from './webhook';

/**
 * Gerado a cada execução, e não escrito no ficheiro: uma cadeia com ar de
 * segredo num ficheiro versionado é indistinguível de um segredo a sério para
 * quem varre o repositório. O que se verifica é o mecanismo, não um valor.
 */
const SECRET = randomBytes(32).toString('base64url');

const EMAIL = {
  from: 'Banda Filarmónica <geral@filarmonica.pt>',
  to: 'coreto@mediotejo.pt',
  subject: 'Concerto de Ano Novo',
  text: 'Dia 1 de janeiro de 2027, às 21h30, no salão da sociedade.',
};

function sign(body: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request('https://coreto.pt/api/intake/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

/** Um pedido assinado como o fornecedor o assinaria. */
function signedPost(payload: unknown, secret = SECRET): Request {
  const body = JSON.stringify(payload);
  return post(body, { 'x-coreto-signature': sign(body, secret) });
}

describe('receção do webhook de email', () => {
  it('aceita um corpo assinado com o segredo certo', async () => {
    const read = await readInboundWebhook(signedPost(EMAIL), SECRET);
    expect(read.status).toBe('ok');
    expect(read.status === 'ok' && read.email.subject).toBe('Concerto de Ano Novo');
  });

  it('aceita a assinatura no formato `sha256=`', async () => {
    const body = JSON.stringify(EMAIL);
    const request = post(body, { 'x-coreto-signature': `sha256=${sign(body)}` });
    expect((await readInboundWebhook(request, SECRET)).status).toBe('ok');
  });

  it('aceita a assinatura no cabeçalho alternativo', async () => {
    const body = JSON.stringify(EMAIL);
    const request = post(body, { 'x-webhook-signature': sign(body) });
    expect((await readInboundWebhook(request, SECRET)).status).toBe('ok');
  });

  it('recusa um corpo alterado depois de assinado', async () => {
    const body = JSON.stringify(EMAIL);
    const signature = sign(body);
    const adulterado = body.replace('Ano Novo', 'Ano Nova');
    const read = await readInboundWebhook(
      post(adulterado, { 'x-coreto-signature': signature }),
      SECRET,
    );
    expect(read.status).toBe('unauthorized');
  });

  it('recusa uma assinatura feita com outro segredo', async () => {
    const outro = randomBytes(32).toString('base64url');
    const read = await readInboundWebhook(signedPost(EMAIL, outro), SECRET);
    expect(read.status).toBe('unauthorized');
  });

  it('recusa um pedido sem assinatura nenhuma', async () => {
    const read = await readInboundWebhook(post(JSON.stringify(EMAIL)), SECRET);
    expect(read.status).toBe('unauthorized');
  });

  it('recusa antes de olhar para o corpo quando não há segredo configurado', async () => {
    const read = await readInboundWebhook(signedPost(EMAIL), undefined);
    expect(read.status).toBe('unconfigured');
  });

  it('recusa JSON malformado, já depois de a assinatura passar', async () => {
    const body = '{ isto não é JSON';
    const read = await readInboundWebhook(post(body, { 'x-coreto-signature': sign(body) }), SECRET);
    expect(read.status).toBe('invalid');
  });

  it('recusa um corpo que não é um email', async () => {
    const read = await readInboundWebhook(signedPost({ assunto: 'sem remetente' }), SECRET);
    expect(read.status).toBe('invalid');
  });

  it('recusa um corpo declarado acima do tecto sem o chegar a ler', async () => {
    const body = JSON.stringify(EMAIL);
    const request = post(body, {
      'x-coreto-signature': sign(body),
      'content-length': String(64 * 1024 * 1024),
    });
    expect((await readInboundWebhook(request, SECRET)).status).toBe('too_large');
  });

  it('preenche o que o schema deixa por preencher', async () => {
    const read = await readInboundWebhook(signedPost({ from: 'a@b.pt' }), SECRET);
    expect(read.status === 'ok' && read.email.attachments).toEqual([]);
    expect(read.status === 'ok' && read.email.subject).toBe('');
  });
});

describe('códigos de resposta da porta', () => {
  it('devolve 503 sem segredo, 401 sem assinatura válida, 400 com corpo inválido', () => {
    expect(webhookRejection({ status: 'unconfigured' }).status).toBe(503);
    expect(webhookRejection({ status: 'unauthorized' }).status).toBe(401);
    expect(webhookRejection({ status: 'too_large' }).status).toBe(413);
    expect(webhookRejection({ status: 'invalid', reason: 'JSON inválido' }).status).toBe(400);
  });

  it('não diz o que falhou na assinatura', async () => {
    const body = await webhookRejection({ status: 'unauthorized' }).json();
    expect(JSON.stringify(body)).not.toMatch(/assinatura|signature/i);
  });
});

describe('o texto que a extração vai ler', () => {
  it('prefere a versão em texto', () => {
    expect(plainTextOf({ ...EMAIL, attachments: [], html: '<p>outra coisa</p>' })).toBe(EMAIL.text);
  });

  it('reduz o HTML a texto quando não há versão em texto', () => {
    const html = '<div><h2>Concerto</h2><p>Dia 1<br>às 21h30</p><style>p{color:red}</style></div>';
    expect(plainTextOf({ ...EMAIL, text: '', attachments: [], html })).toBe(
      'Concerto\nDia 1\nàs 21h30',
    );
  });

  it('devolve vazio quando o email não traz corpo nenhum', () => {
    expect(plainTextOf({ ...EMAIL, text: '  ', attachments: [] })).toBe('');
  });

  it('desfaz as entidades e não deixa marcação para trás', () => {
    expect(htmlToText('<p>Bilhetes &amp; reservas &ndash; 5&euro;</p>')).toBe(
      'Bilhetes & reservas – 5€',
    );
  });
});
