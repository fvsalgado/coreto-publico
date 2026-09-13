import { CORS_HEADERS, FEED_CACHE_CONTROL } from '@/src/lib/feeds/http';
import { carregarDump } from '@/src/lib/feeds/dump-load';
import { exigirRegiao } from '@/src/lib/queries/regioes';

/**
 * O catálogo da região num ficheiro só, em JSON.
 *
 * Cada resposta da API já declara a licença, e não havia um único ficheiro para
 * descarregar: quem quisesse o catálogo inteiro paginava de cem em cem. Este
 * endereço é estável, a data de geração e a contagem vão **dentro** do ficheiro,
 * e a licença viaja com os dados — que é a promessa de devolver os dados a quem
 * os faz, cumprida na forma mais barata que há.
 *
 * O campo `inclui` diz, em português, o que lá está: os eventos publicados cuja
 * data é hoje ou depois. Não é «o catálogo inteiro», e não se chama isso.
 */
export const revalidate = 3600;

export async function GET(
  _request: Request,
  context: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await context.params;
  const regiao = await exigirRegiao(regiaoId);
  const dump = await carregarDump(regiao);

  return Response.json(dump, {
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': FEED_CACHE_CONTROL,
      'Content-Disposition': `inline; filename="coreto-${regiao.id}.json"`,
    },
  });
}
