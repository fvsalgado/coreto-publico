import { MARCA_TRACOS } from '@/src/lib/marca';
import { tintaSobre } from '@/src/lib/paleta';
import { exigirRegiao, toldoDaRegiao } from '@/src/lib/queries/regioes';

/**
 * O ícone do separador, na cor da região (C4-027).
 *
 * É o `app/icon.svg` com o fundo e a tinta da região: o mesmo coreto, na mesma
 * posição — que é a medida que o gerador de ícones calculou para a marca
 * ficar ao meio do quadrado —, e o turquesa do Médio Tejo deixa de ser o
 * ícone de todas as agendas. O `favicon.ico` da raiz fica para os navegadores
 * que não leem SVG, e esses são cada vez menos.
 */

export const revalidate = 86400;

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);
  const toldo = await toldoDaRegiao(regiao);
  const tinta = tintaSobre(toldo) ?? '#181921';
  const tracos = MARCA_TRACOS.map((traco) => `<path d="${traco}"/>`).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">` +
    `<rect width="96" height="96" fill="${toldo}"/>` +
    `<g transform="translate(6.817 10.249) scale(3.43188)" fill="none" stroke="${tinta}" ` +
    `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${tracos}</g></svg>`;
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
