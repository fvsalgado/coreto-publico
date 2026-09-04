import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRssEvents, readRssDate } from './rss-eventos.js';

const feed = readFileSync(
  fileURLToPath(new URL('../__fixtures__/jf-minde-eventos.xml', import.meta.url)),
  'utf8',
);

describe('readRssDate', () => {
  it('lê o dia de um RFC 822 sem passar pelo fuso', () => {
    // `new Date(...).toISOString()` daria 2026-09-18: meia-noite de Lisboa em
    // setembro é 23h do dia anterior em UTC. O dia sai da cadeia como está.
    expect(readRssDate('Sat, 19 Sep 2026 00:00:00 +0100')).toBe('2026-09-19');
    expect(readRssDate('Sat, 18 Jul 2026 00:00:00 +0100')).toBe('2026-07-18');
  });

  it('aceita o mês por extenso e o dia com um algarismo', () => {
    expect(readRssDate('Tue, 1 January 2027 00:00:00 +0000')).toBe('2027-01-01');
  });

  it('devolve nada quando não há data que se leia', () => {
    expect(readRssDate(null)).toBeNull();
    expect(readRssDate('')).toBeNull();
    expect(readRssDate('brevemente')).toBeNull();
    expect(readRssDate('Sat, 19 Xxx 2026 00:00:00 +0100')).toBeNull();
  });
});

describe('parseRssEvents', () => {
  const eventos = parseRssEvents(feed);

  it('lê os eventos do feed da Junta de Freguesia de Minde', () => {
    expect(eventos.length).toBeGreaterThan(10);
    for (const evento of eventos) {
      expect(evento.title).not.toBe('');
      expect(evento.dates[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('guarda a ligação do item como chave estável e como endereço', () => {
    const comemoracao = eventos.find((e) => e.title.includes('Charales Chorus'));
    expect(comemoracao?.dates[0]?.date).toBe('2026-09-19');
    expect(comemoracao?.sourceKey).toContain('jf-minde.pt');
    expect(comemoracao?.sourceUrl).toContain('jf-minde.pt');
  });

  it('guarda a linha de descrição sem a tomar por um espaço', () => {
    // Corrido contra o feed vivo: «Pavilhão Ana Sonça» é o lugar, mas
    // «Torneio de tiro ao alvo com pressão de ar» é o que a coisa é. A mesma
    // linha, dois significados — por isso não vira nome de espaço.
    const comemoracao = eventos.find((e) => e.title.includes('Charales Chorus'));
    expect(comemoracao?.description).toBe('Pavilhão Ana Sonça');
    expect(comemoracao?.venueName).toBeNull();

    const torneio = eventos.find((e) => e.title.includes('tiro ao alvo'));
    expect(torneio?.description).toBe('Torneio de tiro ao alvo com pressão de ar');
    expect(torneio?.venueName).toBeNull();

    // Quando a descrição é o título outra vez, não acrescenta nada e não vai.
    const trail = eventos.find((e) => e.title.includes('Terrantêz'));
    expect(trail?.description).toBeNull();
  });

  it('afirma o espaço só quando a fonte o declara', () => {
    const [primeiro] = parseRssEvents(feed, { venueName: 'Cine-Teatro de Minde' });
    expect(primeiro?.venueName).toBe('Cine-Teatro de Minde');
  });

  it('respeita o tecto de itens', () => {
    expect(parseRssEvents(feed, { maxItems: 3 })).toHaveLength(3);
  });

  it('não inventa eventos a partir de um item sem data', () => {
    const semData = `<rss><channel><item>
      <title><![CDATA[Uma coisa qualquer]]></title>
      <link>https://exemplo.pt/a</link>
    </item></channel></rss>`;
    expect(parseRssEvents(semData)).toEqual([]);
  });

  it('não repete o mesmo item quando o feed o traz duas vezes', () => {
    const repetido = `<rss><channel>
      <item><title>A</title><guid>g1</guid><pubDate>Sat, 19 Sep 2026 00:00:00 +0100</pubDate></item>
      <item><title>A</title><guid>g1</guid><pubDate>Sat, 19 Sep 2026 00:00:00 +0100</pubDate></item>
    </channel></rss>`;
    expect(parseRssEvents(repetido)).toHaveLength(1);
  });

  it('aguenta um feed vazio sem rebentar', () => {
    expect(parseRssEvents('')).toEqual([]);
    expect(parseRssEvents('<rss><channel></channel></rss>')).toEqual([]);
  });
});
