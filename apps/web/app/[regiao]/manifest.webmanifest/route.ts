import type { MetadataRoute } from 'next';
import { CORES_DO_TOLDO } from '@/src/lib/marca';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { descricaoDoSitio, tituloDoSitio } from '@/src/lib/regiao';

/**
 * O manifesto que faz da agenda uma aplicação instalável.
 *
 * É um route handler por região e não o `app/manifest.ts` de convenção: a
 * convenção só vive na raiz, e um manifesto de raiz teria de escolher uma
 * região para o sítio inteiro — quem instalasse a agenda a partir do domínio
 * de outra CIM ficava com o nome do Médio Tejo no ecrã. O middleware reescreve
 * `/manifest.webmanifest` para este segmento como faz às páginas, e o layout
 * da região declara-o nos metadados, que é o que a convenção faria.
 *
 * Não é um invólucro à volta do sítio: é o mesmo sítio, com um ícone no ecrã
 * principal e sem a barra de endereço a roubar uma linha de programação. Para
 * quem consulta a agenda todas as semanas — que é para quem isto é feito — a
 * diferença é deixar de a procurar.
 *
 * As decisões que não são óbvias:
 *
 * - `display: 'standalone'` e não `fullscreen`: uma agenda tem de conviver com
 *   a barra de estado do telemóvel, que é onde estão as horas. Quem abre isto
 *   está muitas vezes a decidir se ainda chega ao concerto.
 * - Nada de `orientation`: prender a aplicação ao retrato parte o mapa num
 *   tablet e não serve ninguém. Manda o equipamento, como manda no browser.
 * - `background_color` é o papel e `theme_color` é a cor do toldo — turquesa
 *   nas regiões, vermelho na montra. O primeiro é o ecrã de arranque, que
 *   dura décimos de segundo; o segundo é a barra do sistema enquanto a
 *   aplicação está aberta. São os mesmos valores de `--color-paper` e
 *   `--color-brand`, à mão (o toldo por `marca.ts`) porque um manifesto é
 *   JSON e não lê tokens.
 * - Sem `screenshots`: davam o convite de instalação em versão grande no
 *   Android, mas uma captura de uma agenda mostra eventos com data, e uma
 *   captura de setembro a convidar alguém em janeiro está a mentir. A casa não
 *   publica datas que já passaram como se fossem programa.
 * - Sem *service worker*, e é decisão e não esquecimento. O Chrome deixou de
 *   o exigir para instalar, e numa agenda que muda de hora a hora uma cache
 *   velha é pior do que uma página que não abre: uma página que não abre não
 *   engana ninguém, uma sessão que já acabou engana.
 *
 * Os ícones saem de `scripts/gerar-icones.mjs`, a partir da mesma marca que
 * está no cabeçalho. O `maskable` é um ficheiro à parte porque o Android
 * recorta o ícone à forma do fabricante: o mesmo desenho, mais pequeno dentro
 * da caixa, para nada ser cortado.
 */
export const revalidate = 3600;

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);
  const manifesto: MetadataRoute.Manifest = {
    id: '/',
    name: tituloDoSitio(regiao),
    short_name: 'Coreto',
    description: descricaoDoSitio(regiao),
    lang: 'pt-PT',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f6fafb',
    theme_color: CORES_DO_TOLDO[regiao.tipo],
    // A lista de categorias que o W3C mantém não tem «events» — tinha-a aqui,
    // a prometer arrumação a quem cataloga e a não arrumar em lado nenhum.
    categories: ['entertainment', 'travel', 'lifestyle'],
    icons: [
      { src: '/icones/coreto-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icones/coreto-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icones/coreto-512-mascara.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Agenda',
        short_name: 'Agenda',
        description: 'A lista completa, com filtros por concelho, categoria e data.',
        url: '/agenda',
      },
      {
        name: 'Mapa',
        short_name: 'Mapa',
        description:
          regiao.concelhosDeclarados > 0
            ? `Os ${regiao.concelhosPorExtenso} concelhos e o que está marcado em cada um.`
            : 'Os concelhos e o que está marcado em cada um.',
        url: '/mapa',
      },
      {
        name: 'Enviar evento',
        short_name: 'Enviar',
        description: 'Mandar um evento para a agenda.',
        url: '/submeter',
      },
    ],
  };

  return Response.json(manifesto, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
