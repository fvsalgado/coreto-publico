import type { MetadataRoute } from 'next';
import { exigirRegiao, toldoDaRegiao } from '@/src/lib/queries/regioes';
import {
  comInicialMaiuscula,
  descricaoDoSitio,
  osConcelhosDaRegiao,
  tituloDoSitio,
} from '@/src/lib/regiao';

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
 * - `background_color` é o papel e `theme_color` é a cor do toldo — a que a
 *   região declarou (0167), ou, enquanto não declara, o turquesa da casa e o
 *   vermelho do produto na demonstração. O primeiro é o ecrã de arranque,
 *   que dura décimos de segundo; o segundo é a barra do sistema enquanto a
 *   aplicação está aberta. São os mesmos valores de `--color-paper` e
 *   `--color-brand`, lidos à parte (o toldo por `toldoDaRegiao`) porque um
 *   manifesto é JSON e não lê tokens.
 * - Sem `screenshots`: davam o convite de instalação em versão grande no
 *   Android, mas uma captura de uma agenda mostra eventos com data, e uma
 *   captura de setembro a convidar alguém em janeiro está a mentir. A casa não
 *   publica datas que já passaram como se fossem programa.
 * - Um *service worker* que guarda uma página só, e é a que diz que está sem
 *   rede (ver `sw.js/route.ts`, C3-015). Esteve aqui escrito «sem service
 *   worker», com uma razão que continua certa: numa agenda que muda de hora a
 *   hora uma cache velha é pior do que uma página que não abre, porque uma
 *   sessão que já acabou engana. Por isso nenhuma página da agenda se guarda.
 *   O que mudou foi o outro lado: uma aplicação instalada que sem rede mostra
 *   o erro do navegador parece avariada, e os guardados — que existem para o
 *   «mais tarde» — não se viam onde mais faziam falta.
 *
 * Os ícones desenham-se na cor da região, pela rota `icone-da-aplicacao/`, a
 * partir da mesma marca que está no cabeçalho (os de `scripts/gerar-icones.mjs`
 * ficam para a raiz, que não é de região nenhuma). O `maskable` é um tamanho à
 * parte porque o Android recorta o ícone à forma do fabricante: o mesmo
 * desenho, mais pequeno dentro da caixa, para nada ser cortado.
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
    /*
     * O nome que fica por baixo do ícone, no ecrã do telemóvel: o da região
     * (C4-027). Era «Coreto» em todas — quem instalava a agenda da sua CIM
     * ficava com o nome do produto e não com o da agenda que instalou. O
     * produto continua no `name` completo, que é o que a instalação mostra.
     */
    short_name: regiao.nome,
    description: descricaoDoSitio(regiao),
    lang: 'pt-PT',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f6fafb',
    theme_color: await toldoDaRegiao(regiao),
    // A lista de categorias que o W3C mantém não tem «events» — tinha-a aqui,
    // a prometer arrumação a quem cataloga e a não arrumar em lado nenhum.
    categories: ['entertainment', 'travel', 'lifestyle'],
    // Na cor da região — ver `icone-da-aplicacao/[tamanho]/route.tsx`.
    icons: [
      { src: '/icone-da-aplicacao/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icone-da-aplicacao/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icone-da-aplicacao/512-mascara',
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
        // «O concelho e o que está marcado nele», com um só (C1-031).
        description:
          regiao.concelhosDeclarados === 1
            ? 'O concelho e o que está marcado nele.'
            : `${comInicialMaiuscula(osConcelhosDaRegiao(regiao))} e o que está marcado em cada um.`,
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
