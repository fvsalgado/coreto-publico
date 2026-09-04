import { SITE_URL } from '@/src/lib/env';
import { eventUrl } from '@/src/lib/feeds/build';
import { FEED_COPYRIGHT } from '@/src/lib/produto';
import { CORS_HEADERS, FEED_CACHE_CONTROL } from '@/src/lib/feeds/http';
import { loadFeed } from '@/src/lib/feeds/load';
import { API_PARAMETERS, readEventFilter } from '@/src/lib/feeds/params';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { urlDoSitio } from '@/src/lib/regiao';

/**
 * Feed em JSON — a mesma agenda, para quem a quer montar no seu sítio.
 *
 * É público e sem chave de propósito: exigir registo a uma junta de freguesia
 * que quer mostrar o que se passa na terra é a maneira mais certa de a agenda
 * não chegar lá. O CORS é aberto porque os dados são públicos e a alternativa
 * — obrigar toda a gente a fazer proxy no servidor — não protege nada, só
 * afasta.
 *
 * Devolve as colunas do cartão, que são as que uma listagem precisa, mais os
 * nomes por trás dos identificadores e as sessões com hora — sem isso, quem
 * integra recebia `venue_id` e tinha de adivinhar de que espaço se trata. Quem
 * quer a ficha completa segue o `url` de cada entrada.
 */

export const revalidate = 3600;

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Cache-Control': 'public, max-age=86400' },
  });
}

export async function GET(
  request: Request,
  routeContext: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);
  const origem = urlDoSitio(regiao, SITE_URL);
  const outcome = readEventFilter(new URL(request.url).searchParams);

  if (!outcome.ok) {
    // Um 400 sem instruções obriga quem integra a adivinhar. A resposta traz a
    // lista dos parâmetros — é a documentação onde ela faz falta.
    return Response.json(
      {
        error: 'Parâmetros inválidos.',
        details: outcome.errors,
        parameters: API_PARAMETERS,
        // A documentação mudou-se de `/fontes#dados` para `/levar#dados`, e
        // teve de ser aqui à mão: este endereço vai dentro do corpo de cada
        // resposta de erro — para os olhos de quem integra e para os registos
        // dele —, e um fragmento nunca chega ao servidor. Nenhum 308 o podia
        // corrigir por nós.
        documentation: `${origem}/levar#dados`,
      },
      { status: 400, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } },
    );
  }

  const { filter } = outcome;

  /*
   * O mesmo carregamento que os feeds fazem, e por uma razão.
   *
   * A resposta trazia `municipality_id`, `category_slug` e `venue_id` e mais
   * nada — três identificadores sem nada que os resolvesse. Quem integrasse
   * ficava com `venue_id: "cine-teatro-paraiso"` e sem forma de saber que
   * aquilo se chama Cine-Teatro Paraíso, a não ser inventando a partir do
   * identificador. E as horas não vinham de todo: uma agenda que não diz a que
   * horas é não é uma agenda.
   *
   * `loadFeed` já junta os nomes e as sessões, tudo com a mesma cache de uma
   * hora do resto do sítio. São quatro leituras a mais, todas em cache.
   *
   * Os campos novos acrescentam-se, não substituem: quem já lê
   * `municipality_id` continua a lê-lo. As coordenadas ficam de fora de
   * propósito — o cartão de evento não as tem, e quem as tem é o espaço.
   */
  const { events, total, context } = await loadFeed(regiao, filter);

  return Response.json(
    {
      events: events.map((event) => ({
        ...event,
        url: eventUrl(context.siteUrl, event.slug),
        municipality_name: context.municipalityNames[event.municipality_id] ?? null,
        category_name: event.category_slug
          ? (context.categoryNames[event.category_slug] ?? null)
          : null,
        venue_name: event.venue_id ? (context.venueNames[event.venue_id] ?? null) : null,
        updated_at: context.timestamps[event.id] ?? null,
        sessions: (context.sessions[event.id] ?? []).map((sessao) => ({
          date: sessao.session_date,
          start_time: sessao.start_time,
          end_time: sessao.end_time,
        })),
      })),
      total,
      page: filter.page,
      limit: filter.limit,
      /*
       * A licença viaja com os dados.
       *
       * Fora do RSS — que a leva no `copyright` — quem puxava por aqui ficava
       * com um JSON sem uma palavra sobre o que pode fazer com ele. Um agente
       * que cite a agenda precisa de saber a quem atribuir, e ler três campos
       * no mesmo envelope é mais provável do que ir procurar uma página.
       * `FEED_COPYRIGHT` é a mesma frase do feed, para não haver duas.
       */
      license: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: FEED_COPYRIGHT,
      documentation: `${origem}/levar#dados`,
    },
    { headers: { ...CORS_HEADERS, 'Cache-Control': FEED_CACHE_CONTROL } },
  );
}
