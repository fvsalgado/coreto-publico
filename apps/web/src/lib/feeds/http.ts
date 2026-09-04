/**
 * Cabeçalhos dos feeds.
 *
 * `max-age=0` com `s-maxage=3600`: o navegador de quem abre o endereço nunca
 * fica com um feed velho na mão, mas a rede de distribuição guarda-o uma hora
 * e é ela que aguenta os leitores todos a bater à porta ao mesmo minuto. O
 * `stale-while-revalidate` de um dia é a rede de segurança para quando a base
 * de dados está em baixo — mais vale servir a agenda de ontem do que um 500.
 */

export const FEED_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

export const RSS_CONTENT_TYPE = 'application/rss+xml; charset=utf-8';
export const ICAL_CONTENT_TYPE = 'text/calendar; charset=utf-8';

/**
 * O feed é público e os dados também. Sem `Access-Control-Allow-Origin`, o
 * sítio de uma câmara não consegue ler a API a partir do navegador — e essa é
 * metade da razão pela qual a API existe.
 */
export const CORS_HEADERS: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function feedResponse(
  body: string,
  contentType: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': FEED_CACHE_CONTROL,
      ...extraHeaders,
    },
  });
}

/** `.ics` com nome de ficheiro, para quem o descarrega em vez de o subscrever. */
export function calendarResponse(body: string, filename: string): Response {
  return feedResponse(body, ICAL_CONTENT_TYPE, {
    'Content-Disposition': `inline; filename="${filename}"`,
  });
}

export function rssResponse(body: string): Response {
  return feedResponse(body, RSS_CONTENT_TYPE);
}

/** 404 no formato certo: um leitor de feeds não sabe ler HTML. */
export function feedNotFound(message: string): Response {
  return new Response(`${message}\n`, {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
