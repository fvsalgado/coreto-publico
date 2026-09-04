import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A política de MTA-STS.
 *
 * São cinco linhas de texto, e mesmo assim vale um ficheiro de testes: em
 * `enforce`, um erro aqui **deixa de receber correio** e a falha é silenciosa
 * do nosso lado — quem escreve é que recebe a devolução. As três coisas a
 * provar são que o modo por omissão é o cauteloso, que sem MX não se publica
 * política nenhuma, e que a forma do ficheiro é a que a RFC 8461 pede.
 */

async function politica(ambiente: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [chave, valor] of Object.entries(ambiente)) {
    if (valor === undefined) vi.stubEnv(chave, '');
    else vi.stubEnv(chave, valor);
  }
  const { GET } = await import('./route');
  return GET();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('GET /.well-known/mta-sts.txt', () => {
  it('sem MX configurado não publica política nenhuma', async () => {
    // Um ficheiro que diz «só entrego a estes servidores» sem nomear nenhum é,
    // em `enforce`, uma forma de recusar todo o correio.
    const resposta = await politica({ MTA_STS_MX: undefined });
    expect(resposta.status).toBe(404);
  });

  it('o modo por omissão é `testing`, e não `enforce`', async () => {
    const texto = await (await politica({ MTA_STS_MX: 'mailserver.purelymail.com' })).text();
    expect(texto).toContain('mode: testing');
    expect(texto).not.toContain('enforce');
  });

  it('em enforce, diz enforce', async () => {
    const texto = await (
      await politica({ MTA_STS_MX: 'mailserver.purelymail.com', MTA_STS_MODO: 'enforce' })
    ).text();
    expect(texto).toContain('mode: enforce');
  });

  it('a forma é a da RFC 8461: versão, modo, um mx por linha, validade, com CRLF', async () => {
    const texto = await (
      await politica({ MTA_STS_MX: 'mx1.exemplo.pt, mx2.exemplo.pt', MTA_STS_MODO: 'enforce' })
    ).text();

    expect(texto.split('\r\n')).toEqual([
      'version: STSv1',
      'mode: enforce',
      'mx: mx1.exemplo.pt',
      'mx: mx2.exemplo.pt',
      'max_age: 604800',
      '',
    ]);
  });

  it('um MX só continua a ser uma linha só', async () => {
    const texto = await (await politica({ MTA_STS_MX: 'mailserver.purelymail.com' })).text();
    expect(texto.match(/^mx: /gm)).toHaveLength(1);
  });

  it('é texto simples, e guarda-se uma hora na rede', async () => {
    const resposta = await politica({ MTA_STS_MX: 'mailserver.purelymail.com' });
    expect(resposta.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(resposta.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    );
  });
});
