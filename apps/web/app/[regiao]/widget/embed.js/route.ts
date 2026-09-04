import { SITE_URL } from '@/src/lib/env';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { urlDoSitio } from '@/src/lib/regiao';

/**
 * O script que monta o `iframe`.
 *
 * Uma câmara cola uma linha no seu sítio e acabou — sem conta, sem chave, sem
 * nada para configurar do nosso lado. Em troca, o script tem uma obrigação
 * acima de todas as outras: nunca, em circunstância nenhuma, partir a página
 * de quem nos embebeu. Daí o `try` a envolver tudo e o silêncio no `catch` —
 * se o widget não aparecer, o pior que acontece é não aparecer.
 *
 * É JavaScript simples de propósito. Vai correr em sítios institucionais com
 * dez anos, alguns com jQuery 1.x e um `<!DOCTYPE>` de outra era.
 */

export const revalidate = 3600;

/** Um dia no navegador, uma semana na rede. O script muda uma vez por ano. */
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000';

/** Altura inicial, até chegar a primeira medição. Cabem cinco eventos. */
const INITIAL_HEIGHT = 380;

function script(origin: string): string {
  return `(function () {
  'use strict';

  var ORIGIN = ${JSON.stringify(origin)};
  var SLUG = /^[a-z0-9-]{2,60}$/;

  try {
    // Com 'async' ou 'defer', currentScript é nulo: procura-se o último
    // marcado com data-concelho, que durante a execução é sempre este.
    var element = document.currentScript;
    if (!element) {
      var found = document.querySelectorAll('script[data-concelho]');
      element = found.length > 0 ? found[found.length - 1] : null;
    }
    if (!element || !element.parentNode) return;

    var read = function (name) {
      return (element.getAttribute(name) || '').trim().toLowerCase();
    };

    var concelho = read('data-concelho');
    if (!SLUG.test(concelho)) return;

    var query = [];

    var limit = parseInt(read('data-limit'), 10);
    if (limit >= 1 && limit <= 20) query.push('limit=' + limit);

    var categoria = read('data-categoria');
    if (SLUG.test(categoria)) query.push('category=' + categoria);

    var espaco = read('data-espaco');
    if (SLUG.test(espaco)) query.push('venue=' + espaco);
    var ciclo = read('data-ciclo');
    if (SLUG.test(ciclo)) query.push('series=' + ciclo);

    var tema = read('data-tema');
    if (tema === 'light' || tema === 'dark' || tema === 'auto') query.push('theme=' + tema);

    var disposicao = read('data-disposicao');
    if (disposicao === 'lista' || disposicao === 'mural' || disposicao === 'cartazes') {
      query.push('layout=' + disposicao);
    }

    // A cor vai encodada: sem isso o cardinal corta a cadeia de consulta e
    // tudo o que vier a seguir desaparece. A forma é validada do outro lado.
    var cor = read('data-cor');
    if (/^#?[0-9a-f]{3}([0-9a-f]{3})?$/.test(cor)) query.push('color=' + encodeURIComponent(cor));

    // A letra é texto livre de quem embebe, e por isso não leva toLowerCase
    // nem validação aqui: quem a saneia é o servidor, com lista branca. Aqui
    // só se limita o tamanho, para não montar um endereço absurdo.
    var letraBruta = (element.getAttribute('data-letra') || '').trim();
    if (letraBruta && letraBruta.length <= 200) {
      query.push('font=' + encodeURIComponent(letraBruta));
    }

    // A pesquisa é texto livre, como a letra: sem toLowerCase, encodada, e
    // limitada no tamanho. O servidor faz o resto.
    var pesquisaBruta = (element.getAttribute('data-pesquisa') || '').trim();
    if (pesquisaBruta && pesquisaBruta.length <= 120) {
      query.push('q=' + encodeURIComponent(pesquisaBruta));
    }

    var gratis = read('data-gratis');
    if (gratis === 'true' || gratis === '1' || gratis === 'sim') query.push('free=1');

    var naoQuer = function (nome) {
      var valor = read(nome);
      return valor === 'nao' || valor === 'não' || valor === 'false' || valor === '0';
    };
    if (naoQuer('data-cabecalho')) query.push('header=nao');
    if (naoQuer('data-moldura')) query.push('frame=nao');

    var iframe = document.createElement('iframe');
    iframe.src = ORIGIN + '/widget/' + concelho + (query.length ? '?' + query.join('&') : '');
    iframe.title = element.getAttribute('data-titulo') || 'Agenda cultural — Coreto';
    iframe.loading = 'lazy';
    iframe.style.display = 'block';
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.height = '${INITIAL_HEIGHT}px';
    iframe.setAttribute('scrolling', 'no');

    element.parentNode.insertBefore(iframe, element.nextSibling);

    window.addEventListener('message', function (event) {
      // Qualquer página pode mandar mensagens; só esta conta.
      if (event.origin !== ORIGIN) return;
      if (event.source !== iframe.contentWindow) return;

      var data = event.data;
      if (!data || data.type !== 'coreto:height') return;

      var height = Number(data.height);
      if (!isFinite(height) || height < 40 || height > 5000) return;

      iframe.style.height = Math.ceil(height) + 'px';
    }, false);
  } catch (error) {
    // O widget é um extra na página de outra pessoa. Falha calado.
  }
})();
`;
}

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  // O ORIGIN cozido no script é o da região que o serviu: a caixa de uma CIM
  // aponta para a agenda dela, e a mensagem de altura só é aceite dela.
  const { regiao: regiaoId } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);
  return new Response(script(urlDoSitio(regiao, SITE_URL)), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': CACHE_CONTROL,
      'Access-Control-Allow-Origin': '*',
    },
  });
}
