import { ORIGEM_DA_MONTRA } from '../montra';
import { URL_DA_POLITICA } from '../politica-de-seguranca';

/**
 * O mapa do sítio do domínio do produto — duas linhas, e é tudo o que ele tem.
 *
 * O `coreto.org` respondia 404 a `/sitemap.xml` pela mesma razão que respondia
 * 404 ao `security.txt`: a rota do mapa vive em `app/[regiao]/sitemap-xml`, e
 * este anfitrião não é de região nenhuma.
 *
 * **Só o que a montra tem.** A ficha técnica e a política de segurança são as
 * duas páginas que respondem 200 aqui — tudo o resto neste domínio é 404, por
 * decisão do middleware. Um endereço de uma região neste ficheiro seria a
 * agenda de uma CIM anunciada num domínio que não é dela, que é exatamente a
 * fuga que `scripts/verificar-regioes.mjs` existe para apanhar.
 *
 * Sem `lastmod`, e é a resposta honesta: estas duas páginas mudam quando
 * alguém as reescrever, e disso não há data em lado nenhum. Inventar uma — a
 * de hoje, a do último build — era ensinar um motor de busca a ignorar o
 * único campo do sitemap que ainda conta.
 *
 * Não toca na base de dados, como o resto da montra.
 */

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const enderecos = [`${ORIGEM_DA_MONTRA}/`, URL_DA_POLITICA];

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${enderecos.map((url) => `<url>\n<loc>${url}</loc>\n</url>`).join('\n')}\n` +
    '</urlset>\n';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
