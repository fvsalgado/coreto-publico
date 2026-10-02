import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { MARCA_GRELHA, MARCA_TRACOS } from '@/src/lib/marca';
import { tintaSobre } from '@/src/lib/paleta';
import { exigirRegiao, toldoDaRegiao } from '@/src/lib/queries/regioes';

/**
 * O ícone da aplicação instalada, na cor da região (C4-027).
 *
 * A agenda instala-se no telemóvel, e instalada chamava-se «Coreto» com o
 * coreto turquesa em todas as regiões: quem instalava a agenda da sua CIM
 * ficava com o ícone e a cor de outra. O desenho é o mesmo — a marca do
 * produto, que assina todas as agendas —, e o fundo é o toldo da região, com
 * a tinta que se lê por cima dela (`tintaSobre`). O nome por baixo do ícone é
 * o do manifesto, que passa a ser o da região.
 *
 * Três medidas, as que o manifesto pede: 192 e 512 para o ícone comum, e 512
 * «maskable» com a marca mais pequena, porque o Android recorta o ícone numa
 * forma sua (um círculo, um quadrado de cantos redondos) e só garante os 80 %
 * do meio. O 180 é o do ecrã inicial do iPhone (`apple-touch-icon`).
 */

export const revalidate = 86400;

const TAMANHOS: Record<string, { lado: number; escala: number }> = {
  '180': { lado: 180, escala: 0.66 },
  '192': { lado: 192, escala: 0.66 },
  '512': { lado: 512, escala: 0.66 },
  '512-mascara': { lado: 512, escala: 0.5 },
};

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string; tamanho: string }> },
): Promise<Response> {
  const { regiao: regiaoId, tamanho } = await routeContext.params;
  const medida = TAMANHOS[tamanho];
  if (!medida) notFound();
  const regiao = await exigirRegiao(regiaoId);
  const toldo = await toldoDaRegiao(regiao);
  const tinta = tintaSobre(toldo) ?? '#181921';
  const marca = Math.round(medida.lado * medida.escala);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: toldo,
      }}
    >
      {/* A tinta não está centrada na grelha (ver `MARCA_TRACOS`): sobra mais
          em baixo do que em cima, e um empurrão de meio traço para cima
          acerta-a no meio do quadrado. */}
      <svg
        width={marca}
        height={marca}
        viewBox={`0 -0.5 ${MARCA_GRELHA} ${MARCA_GRELHA}`}
        fill="none"
        stroke={tinta}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {MARCA_TRACOS.map((traco) => (
          <path key={traco} d={traco} />
        ))}
      </svg>
    </div>,
    {
      width: medida.lado,
      height: medida.lado,
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
