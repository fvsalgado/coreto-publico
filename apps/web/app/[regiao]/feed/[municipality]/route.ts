import { eventFilterSchema } from '@coreto/core';
import { toRssItems } from '@/src/lib/feeds/build';
import { FEED_COPYRIGHT } from '@/src/lib/produto';
import { feedNotFound, rssResponse } from '@/src/lib/feeds/http';
import { loadFeed, resolveMunicipality } from '@/src/lib/feeds/load';
import { buildRss } from '@/src/lib/feeds/rss';
import { listMunicipalities } from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';

/**
 * RSS de um concelho — `/feed/tomar.xml`.
 *
 * A extensão vai dentro do segmento e não numa pasta com sufixo: o App Router
 * só reconhece um segmento dinâmico quando ele é `[nome]` do princípio ao fim.
 * `resolveMunicipality` descasca o `.xml` e aceita também o endereço sem ele.
 */

export const revalidate = 3600;

const FEED_LIMIT = 50;

export async function generateStaticParams({
  params,
}: {
  params: { regiao: string };
}): Promise<Array<{ municipality: string }>> {
  const municipalities = await listMunicipalities(params.regiao);
  return municipalities.map((municipality) => ({ municipality: `${municipality.id}.xml` }));
}

/**
 * Os parâmetros são declarados aqui e não com o `RouteContext` que o Next
 * gera.
 *
 * Esse tipo só existe depois de um `next build` ter escrito `.next/types`, e
 * por isso um `tsc --noEmit` sobre uma cópia acabada de clonar falhava — que
 * é exatamente o que o CI faz, e o que qualquer pessoa faz ao abrir o
 * repositório pela primeira vez. Uma verificação de tipos que depende de um
 * artefacto de compilação não é uma verificação de tipos.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ regiao: string; municipality: string }> },
): Promise<Response> {
  const { regiao: regiaoId, municipality: segment } = await context.params;
  const regiao = await exigirRegiao(regiaoId);
  const municipality = await resolveMunicipality(regiao.id, segment, '.xml');
  if (!municipality) return feedNotFound('Não há feed para este concelho.');

  const { events, context: feedContext } = await loadFeed(
    regiao,
    eventFilterSchema.parse({ municipality: municipality.id, limit: FEED_LIMIT }),
  );

  const xml = buildRss(
    {
      title: `Coreto — ${municipality.name}`,
      link: `${feedContext.siteUrl}/concelho/${municipality.id}`,
      description: `O que há para fazer em ${municipality.name}: concertos, teatro, exposições, festas, cinema e visitas.`,
      selfUrl: `${feedContext.siteUrl}/feed/${municipality.id}.xml`,
      ttlMinutes: 60,
      copyright: FEED_COPYRIGHT,
    },
    toRssItems(events, feedContext),
  );

  return rssResponse(xml);
}
