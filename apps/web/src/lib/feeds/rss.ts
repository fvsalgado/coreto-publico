/**
 * RSS 2.0 escrito à mão.
 *
 * O risco aqui é o mesmo do iCalendar e ainda mais silencioso: basta um `&`
 * por escapar no título de um evento — «Teatro & Companhia» — para o leitor
 * de feeds recusar o ficheiro inteiro e o subscritor deixar de receber a
 * agenda sem nunca perceber porquê. Por isso tudo o que é texto passa por
 * `escapeXml`, sem exceção e sem CDATA (um `]]>` dentro de uma descrição
 * fecharia a secção a meio).
 */

/**
 * Carateres que o XML 1.0 não representa de todo. Não há escape para eles;
 * ou saem do documento, ou o documento é inválido.
 */
const INVALID_XML_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

export function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML_CHARACTERS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Data no formato que o RSS 2.0 pede (RFC 822, com o ano a quatro dígitos da
 * revisão RFC 1123).
 *
 * `toUTCString` e não uma formatação à mão: a especificação do ECMAScript fixa
 * o resultado com os nomes ingleses de dia e mês, aconteça o que acontecer com
 * a locale do servidor. A versão feita à mão com `toLocaleDateString` mandava
 * «Sáb, 10 Mai» para dentro do feed sempre que a máquina estava em português —
 * e há leitores que engolem isso e mostram a data errada em vez de se queixar.
 */
export function formatRfc822(date: Date): string {
  const value = Number.isNaN(date.getTime()) ? new Date(0) : date;
  return value.toUTCString();
}

export interface RssItem {
  title: string;
  link: string;
  description: string;
  /** Instante da última alteração da entrada. */
  pubDate?: Date | null;
  /** Por omissão, o `link`. */
  guid?: string;
  categories?: readonly string[];
}

export interface RssChannel {
  title: string;
  link: string;
  description: string;
  /** Endereço do próprio feed, para o `atom:link rel="self"`. */
  selfUrl?: string;
  language?: string;
  lastBuildDate?: Date;
  /** Sugestão de intervalo de recolha, em minutos. */
  ttlMinutes?: number;
  copyright?: string;
}

function tag(name: string, value: string): string {
  return `    <${name}>${escapeXml(value)}</${name}>`;
}

function itemXml(item: RssItem): string {
  const lines = [
    '    <item>',
    `      <title>${escapeXml(item.title)}</title>`,
    `      <link>${escapeXml(item.link)}</link>`,
    // `isPermaLink="true"` obriga o `guid` a ser um endereço que abre. É, e é
    // o mesmo do link: um evento tem uma página só sua e é essa a identidade.
    `      <guid isPermaLink="true">${escapeXml(item.guid ?? item.link)}</guid>`,
  ];

  if (item.pubDate) lines.push(`      <pubDate>${formatRfc822(item.pubDate)}</pubDate>`);

  for (const category of item.categories ?? []) {
    if (category) lines.push(`      <category>${escapeXml(category)}</category>`);
  }

  lines.push(`      <description>${escapeXml(item.description)}</description>`);
  lines.push('    </item>');
  return lines.join('\n');
}

export function buildRss(channel: RssChannel, items: readonly RssItem[]): string {
  const header = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    tag('title', channel.title),
    tag('link', channel.link),
    tag('description', channel.description),
    tag('language', channel.language ?? 'pt-PT'),
  ];

  if (channel.copyright) header.push(tag('copyright', channel.copyright));
  header.push(
    `    <lastBuildDate>${formatRfc822(channel.lastBuildDate ?? new Date())}</lastBuildDate>`,
  );
  if (channel.ttlMinutes) header.push(tag('ttl', String(channel.ttlMinutes)));
  if (channel.selfUrl) {
    header.push(
      `    <atom:link href="${escapeXml(channel.selfUrl)}" rel="self" type="application/rss+xml" />`,
    );
  }

  const body = items.map(itemXml);
  return [...header, ...body, '  </channel>', '</rss>', ''].join('\n');
}
