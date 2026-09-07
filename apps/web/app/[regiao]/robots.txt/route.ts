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

/**
 * O charset declarado, e não deixado ao acaso.
 *
 * Saía `text/plain` seco — confirmado em produção:
 * `curl -sI https://mediotejo.coreto.org/robots.txt` devolvia
 * `content-type: text/plain`, sem charset. E este ficheiro tem acentos no
 * corpo («Os agentes de resposta são bem-vindos»), porque é escrito em
 * português como o resto da casa. Sem charset, quem lê fica autorizado a
 * adivinhar — e a norma antiga do `text/plain` manda adivinhar Latin-1, que
 * transforma cada acento em dois carateres. O `security.txt` e o `llms.txt`,
 * ao lado, já o declaravam; era este que ia sozinho.
 */
const TIPO_DE_CONTEUDO = 'text/plain; charset=utf-8';

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);
  const origem = urlDoSitio(regiao, SITE_URL);

  /*
   * A montra fecha-se aos robôs por inteiro, e sai daqui com um ficheiro
   * curto — não é o normal com uma linha trocada.
   *
   * O porquê do fecho está no `generateMetadata` do layout: o programa dela é
   * inventado, e um evento falso indexado leva alguém a deslocar-se a uma
   * coisa que não existe.
   *
   * O porquê de ser um ficheiro **próprio** é que o resto deste robots.txt
   * contradiria o fecho. Ele convida os agentes de resposta, explica que os
   * dados são CC BY e existem para ser reutilizados, e anuncia o sitemap.
   * Tudo isso está certo para uma agenda a sério e está errado para uma
   * demonstração: seria pedir que não se indexasse e, na linha seguinte,
   * entregar o mapa de tudo e autorizar a reutilização. Um ficheiro que se
   * contradiz é um ficheiro que alguém há-de resolver pelo lado errado.
   */
  if (regiao.tipo === 'montra') {
    return new Response(
      [
        '# Demonstração do Coreto. O programa desta agenda é inventado de',
        '# propósito — eventos que nunca aconteceram, em concelhos que não',
        '# existem — e por isso não se indexa nem se reutiliza. A agenda a',
        '# sério de cada território vive no domínio dela.',
        '',
        'User-Agent: *',
        'Disallow: /',
        '',
      ].join('\n'),
      {
        headers: {
          'Content-Type': TIPO_DE_CONTEUDO,
          'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  }

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
      'Content-Type': TIPO_DE_CONTEUDO,
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
