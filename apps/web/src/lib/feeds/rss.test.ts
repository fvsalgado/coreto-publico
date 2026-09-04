import { describe, expect, it } from 'vitest';
import { buildRss, escapeXml, formatRfc822, type RssItem } from './rss';

/**
 * Um `&` por escapar não degrada o feed: invalida-o. O leitor não mostra
 * metade das entradas — recusa o ficheiro inteiro e o subscritor deixa de
 * receber a agenda sem dar por isso.
 */

const CHANNEL = {
  title: 'Coreto',
  link: 'https://coreto.pt',
  description: 'A agenda cultural do Médio Tejo.',
  selfUrl: 'https://coreto.pt/feed.xml',
  lastBuildDate: new Date('2026-04-01T09:00:00Z'),
  ttlMinutes: 60,
};

function item(overrides: Partial<RssItem> = {}): RssItem {
  return {
    title: 'Concerto',
    link: 'https://coreto.pt/evento/concerto',
    description: 'Às 21h30.',
    ...overrides,
  };
}

describe('escapeXml', () => {
  it('escapa os cinco carateres que contam', () => {
    expect(escapeXml('Teatro & Companhia')).toBe('Teatro &amp; Companhia');
    expect(escapeXml('<b>negrito</b>')).toBe('&lt;b&gt;negrito&lt;/b&gt;');
    expect(escapeXml('aspas "duplas" e \'simples\'')).toBe(
      'aspas &quot;duplas&quot; e &#39;simples&#39;',
    );
  });

  it('escapa o & antes de tudo o resto, para não duplicar entidades', () => {
    expect(escapeXml('a & <b>')).toBe('a &amp; &lt;b&gt;');
    expect(escapeXml('&amp;')).toBe('&amp;amp;');
  });

  it('deixa passar acentos e a vírgula, que não têm significado em XML', () => {
    expect(escapeXml('Exposição, ateliê e serões; entrada livre')).toBe(
      'Exposição, ateliê e serões; entrada livre',
    );
  });
});

describe('formatRfc822', () => {
  it('escreve a data com os nomes ingleses e o fuso explícito', () => {
    expect(formatRfc822(new Date('2026-05-10T21:30:00Z'))).toBe('Sun, 10 May 2026 21:30:00 GMT');
  });

  it('não rebenta com uma data inválida', () => {
    expect(formatRfc822(new Date('não é uma data'))).toBe('Thu, 01 Jan 1970 00:00:00 GMT');
  });
});

describe('buildRss', () => {
  it('escreve o cabeçalho, o canal e a ligação para o próprio feed', () => {
    const xml = buildRss(CHANNEL, [item()]);

    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\n')).toBe(true);
    expect(xml).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
    expect(xml).toContain('<language>pt-PT</language>');
    expect(xml).toContain('<lastBuildDate>Wed, 01 Apr 2026 09:00:00 GMT</lastBuildDate>');
    expect(xml).toContain(
      '<atom:link href="https://coreto.pt/feed.xml" rel="self" type="application/rss+xml" />',
    );
    expect(xml.trimEnd().endsWith('</rss>')).toBe(true);
  });

  it('escapa o título de um evento com & e com sinais de maior', () => {
    const xml = buildRss(CHANNEL, [item({ title: 'Teatro & Companhia <ao vivo>' })]);
    expect(xml).toContain('<title>Teatro &amp; Companhia &lt;ao vivo&gt;</title>');
    expect(xml).not.toContain('<title>Teatro & Companhia');
  });

  it('escapa o & de um endereço com parâmetros', () => {
    const link = 'https://coreto.pt/agenda?municipality=tomar&free=1';
    const xml = buildRss(CHANNEL, [item({ link })]);
    expect(xml).toContain('<link>https://coreto.pt/agenda?municipality=tomar&amp;free=1</link>');
    expect(xml).toContain(
      '<guid isPermaLink="true">https://coreto.pt/agenda?municipality=tomar&amp;free=1</guid>',
    );
  });

  it('mantém as quebras de linha de uma descrição, escapando o que é preciso', () => {
    const xml = buildRss(CHANNEL, [
      item({ description: '10–12 mai · Teatro Virgínia\n\nBilhetes a 5 € & 8 €.' }),
    ]);
    expect(xml).toContain('10–12 mai · Teatro Virgínia\n\nBilhetes a 5 € &amp; 8 €.');
  });

  it('escreve a pubDate no formato do protocolo', () => {
    const xml = buildRss(CHANNEL, [item({ pubDate: new Date('2026-05-10T21:30:00Z') })]);
    expect(xml).toContain('<pubDate>Sun, 10 May 2026 21:30:00 GMT</pubDate>');
  });

  it('omite a pubDate quando não há data para declarar', () => {
    expect(buildRss(CHANNEL, [item({ pubDate: null })])).not.toContain('<pubDate>');
  });

  it('escreve uma categoria por elemento', () => {
    const xml = buildRss(CHANNEL, [item({ categories: ['Música', 'Festas & romarias'] })]);
    expect(xml).toContain('<category>Música</category>');
    expect(xml).toContain('<category>Festas &amp; romarias</category>');
  });

  it('produz um documento sem etiquetas por fechar', () => {
    const xml = buildRss(CHANNEL, [item(), item({ title: 'Outro' })]);
    const opened = xml.match(/<item>/g) ?? [];
    const closed = xml.match(/<\/item>/g) ?? [];
    expect(opened).toHaveLength(2);
    expect(closed).toHaveLength(2);
  });
});
