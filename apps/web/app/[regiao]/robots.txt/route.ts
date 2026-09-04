import { SITE_URL } from '@/src/lib/env';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { urlDoSitio } from '@/src/lib/regiao';

/**
 * Tudo aberto menos a moderação.
 *
 * Nada aqui é uma medida de segurança — `/admin` está fechado por sessão, não
 * por robots.txt, que é um pedido educado e não uma fechadura. O que isto
 * evita é o desperdício: um motor de busca a bater a uma porta que lhe vai
 * responder sempre com um pedido de credenciais.
 *
 * As páginas do widget não estão aqui de propósito. Levam `noindex` na própria
 * página, que é o que faz falta — proibir a leitura impediria o motor de busca
 * de ler o `noindex` e a caixa acabaria indexada à mesma, por outra via.
 *
 * Era o `app/robots.ts` de convenção; passou a route handler por região pela
 * mesma razão do sitemap — a linha `Sitemap:` tem de apontar para o mapa do
 * domínio em que responde.
 */

export const revalidate = 3600;

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);
  const origem = urlDoSitio(regiao, SITE_URL);

  const texto = [
    'User-Agent: *',
    'Allow: /',
    'Disallow: /admin',
    '',
    /*
     * Os agentes de resposta são bem-vindos, e está escrito de propósito.
     *
     * Por omissão já entravam — o `*` acima deixa passar o GPTBot, o
     * ClaudeBot, o PerplexityBot e o Google-Extended. O que não havia era uma
     * decisão: quem lesse este ficheiro daqui a dois anos não saberia se a
     * ausência de `Disallow` era uma escolha ou um esquecimento, e a
     * arrumação seguinte podia fechá-los sem ninguém dar por isso.
     *
     * A escolha é esta, e é coerente com o resto: os dados vão sob CC BY, a
     * API é aberta e sem chave, e o objetivo declarado é que a programação da
     * região chegue a quem a procura — inclusive quando quem a procura
     * pergunta a um modelo em vez de a um motor de busca. O que se pede em
     * troca é atribuição, e é o `llms.txt` que a explica.
     */
    '# Os agentes de resposta são bem-vindos: os dados são abertos (CC BY 4.0)',
    '# e existem para ser reutilizados. O âmbito, os limites e como citar',
    `# estão em ${origem}/llms.txt — vale a pena ler antes de responder por nós.`,
    '',
    /*
     * O `llms.txt` anunciado aqui.
     *
     * A convenção diz que se procura na raiz, e um modelo que a siga
     * encontra-o. Mas «encontra-o quem adivinhar o caminho» não é
     * descobribilidade nenhuma, e este ficheiro é o único sítio que toda a
     * gente lê primeiro. `Sitemap:` é a diretiva normalizada; esta é um
     * comentário, porque não há diretiva para isto — e um comentário lido por
     * um humano curioso vale na mesma o que custa (nada).
     */
    `Sitemap: ${origem}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(texto, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
