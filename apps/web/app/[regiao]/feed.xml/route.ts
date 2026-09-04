import { eventFilterSchema } from '@coreto/core';
import { toRssItems } from '@/src/lib/feeds/build';
import { FEED_COPYRIGHT } from '@/src/lib/produto';
import { rssResponse } from '@/src/lib/feeds/http';
import { loadFeed } from '@/src/lib/feeds/load';
import { buildRss } from '@/src/lib/feeds/rss';
import { tituloDoSitio } from '@/src/lib/regiao';
import { exigirRegiao } from '@/src/lib/queries/regioes';

/**
 * RSS de tudo o que aí vem, na região inteira.
 *
 * Cinquenta entradas: um leitor de feeds mostra sempre a janela mais recente e
 * ninguém percorre mais do que isso de uma vez. Quem quer a agenda inteira tem
 * a API em `/api/events`.
 */

export const revalidate = 3600;

export const FEED_LIMIT = 50;

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);
  const { events, context } = await loadFeed(
    regiao,
    eventFilterSchema.parse({ limit: FEED_LIMIT }),
  );

  const xml = buildRss(
    {
      title: tituloDoSitio(regiao),
      link: `${context.siteUrl}/agenda`,
      description: `Concertos, teatro, exposições, festas, cinema e visitas nos ${regiao.concelhosPorExtenso} concelhos ${regiao.doNome}.`,
      selfUrl: `${context.siteUrl}/feed.xml`,
      ttlMinutes: 60,
      copyright: FEED_COPYRIGHT,
    },
    toRssItems(events, context),
  );

  return rssResponse(xml);
}
