import { describe, expect, it } from 'vitest';
import { DEFAULT_POSTHOG_HOST, postHogScriptUrl, startPostHog } from './posthog';

describe('postHogScriptUrl', () => {
  it('vai buscar o script ao domínio de ficheiros estáticos da região europeia', () => {
    expect(postHogScriptUrl(DEFAULT_POSTHOG_HOST)).toBe(
      'https://eu-assets.i.posthog.com/static/array.js',
    );
  });

  it('ignora a barra final do anfitrião configurado', () => {
    expect(postHogScriptUrl('https://eu.i.posthog.com/')).toBe(
      'https://eu-assets.i.posthog.com/static/array.js',
    );
  });

  it('num anfitrião próprio serve o script do próprio anfitrião', () => {
    expect(postHogScriptUrl('https://estatisticas.exemplo.pt')).toBe(
      'https://estatisticas.exemplo.pt/static/array.js',
    );
  });

  it('não desvia os dados para fora da Europa quando o anfitrião é o americano', () => {
    // A troca é a mesma do excerto oficial: só muda o subdomínio, nunca a
    // região. Se um dia isto passasse a apontar para outro sítio, era aqui que
    // se via.
    expect(postHogScriptUrl('https://us.i.posthog.com')).toBe(
      'https://us-assets.i.posthog.com/static/array.js',
    );
  });
});

describe('startPostHog', () => {
  it('não arranca nada sem chave configurada', async () => {
    // Sem `NEXT_PUBLIC_POSTHOG_KEY` — que é o caso em testes, em CI e num fork
    // — tem de devolver `null` sem tocar em `document`.
    await expect(startPostHog()).resolves.toBeNull();
  });
});
