import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POSTHOG_HOST,
  ehCaixaEmbebida,
  postHogScriptUrl,
  propriedadesDaVista,
  REGIAO_DA_FICHA,
  startPostHog,
} from './posthog';

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

describe('propriedadesDaVista', () => {
  it('cola a região a cada vista de página', () => {
    expect(propriedadesDaVista('/agenda', 'medio-tejo')).toEqual({
      $pathname: '/agenda',
      regiao: 'medio-tejo',
    });
  });

  it('o nome da propriedade é `regiao` e não muda', () => {
    // Este teste existe para partir quando alguém lhe tocar. O nome da
    // propriedade é o eixo por onde os números se separam por cliente: mudá-lo
    // não parte a compilação nem um único ecrã, parte os painéis, e a série
    // parte-se em duas semanas antes de alguém dar por isso.
    expect(Object.keys(propriedadesDaVista('/', 'medio-tejo')).sort()).toEqual([
      '$pathname',
      'regiao',
    ]);
  });

  it('a ficha técnica conta-se com um nome que nenhuma região pode ter', () => {
    // O `coreto.org` não é região nenhuma — é isso que o define —, mas tem de
    // aparecer nos números como qualquer outro sítio. Os identificadores de
    // região vêm da base; este não vem de lá e não colide com nenhum.
    expect(propriedadesDaVista('/', REGIAO_DA_FICHA).regiao).toBe('ficha-tecnica');
  });
});

describe('ehCaixaEmbebida', () => {
  it('não conta o que corre dentro do iframe do sítio de uma câmara', () => {
    // Cada visita à página da câmara carrega o widget com ela. Contá-la fazia
    // o número da agenda crescer com o trânsito do sítio dela e não com o
    // nosso — mais gente a «visitar» a agenda do que alguma vez a abriu.
    expect(ehCaixaEmbebida('/widget/tomar')).toBe(true);
  });

  it('conta as páginas do sítio, incluindo a que ensina a levar o widget', () => {
    expect(ehCaixaEmbebida('/levar')).toBe(false);
    expect(ehCaixaEmbebida('/agenda')).toBe(false);
    expect(ehCaixaEmbebida('/')).toBe(false);
  });
});
