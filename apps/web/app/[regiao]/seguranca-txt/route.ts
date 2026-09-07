import { SITE_URL } from '@/src/lib/env';
import { PRODUTO } from '@/src/lib/produto';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { urlDoSitio } from '@/src/lib/regiao';
import {
  URL_DA_POLITICA,
  validadeDoSecurityTxt,
} from '@/app/pagina-do-produto/politica-de-seguranca';

/**
 * Onde escrever quando se encontra uma falha — no sítio onde se procura.
 *
 * O `SECURITY.md` está no GitHub e é bom; o problema é que ninguém o encontra
 * a partir do sítio. Quem faz varrimento — e quem faz divulgação responsável,
 * que é a mesma pessoa em dias diferentes — procura em
 * `/.well-known/security.txt`, e é isso que a RFC 9116 normalizou. Sem ele, a
 * escolha de quem encontra uma falha é adivinhar um endereço ou abrir um issue
 * público, que é exatamente o que a política pede para não se fazer.
 *
 * É rota e não ficheiro em `public/`, por causa de um campo: a RFC **obriga**
 * a `Expires`, e um ficheiro escrito à mão com uma data lá dentro é uma data
 * que envelhece em silêncio — a mesma razão por que a página `/levar` e o
 * `llms.txt` são gerados. Aqui a validade anda sozinha, seis meses à frente,
 * e nunca fica para trás sem ninguém dar por isso.
 *
 * O middleware traduz `/.well-known/security.txt` para este caminho, como já
 * faz ao `sitemap.xml` — e, pela mesma razão, o nome interno pedido por fora
 * não responde: um endereço com dois nomes é um endereço a mais.
 */

export const revalidate = 3600;

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);
  const origem = urlDoSitio(regiao, SITE_URL);

  /*
   * Dois contactos, e a ordem é a resposta.
   *
   * O primeiro é o do produto: quem corrige o software é quem o escreve, e
   * uma falha no Coreto é do Coreto em todas as regiões ao mesmo tempo. O
   * segundo é o desta região, para quem chegou por este domínio e não sabe
   * — nem tem de saber — que há um produto por baixo.
   *
   * Dois **distintos**: na região montra os dois endereços são o mesmo, e
   * saía a mesma linha `Contact:` repetida — visto em produção. Um ficheiro
   * que se lê à máquina não deve mandar duas vezes ao mesmo sítio.
   */
  const contactos = [...new Set([PRODUTO.email, regiao.email])];

  const texto = [
    ...contactos.map((email) => `Contact: mailto:${email}`),
    `Expires: ${validadeDoSecurityTxt(new Date())}`,
    'Preferred-Languages: pt, en',
    /*
     * A política de segurança primeiro, e num domínio nosso.
     *
     * Apontava para `github.com/fvsalgado/coreto/blob/main/SECURITY.md`, e o
     * repositório é privado: o campo que existe para dar o âmbito e os prazos
     * dava um 404 a quem seguisse a RFC 9116. Passou a ser servida no próprio
     * domínio, no endereço que `pagina-do-produto/politica-de-seguranca.ts`
     * declara — e é lá que está escrito porque é do produto e não da região.
     *
     * A de privacidade fica em segundo por ser a outra política que interessa
     * a quem chega aqui — a que diz o que se faz com os dados que uma falha
     * possa ter exposto —, e essa é da região, na origem dela.
     */
    `Policy: ${URL_DA_POLITICA}`,
    `Policy: ${origem}/privacidade`,
    `Canonical: ${origem}/.well-known/security.txt`,
    '',
    '# O âmbito, os prazos e o que já está feito estão na política acima.',
    '# Não abrir um issue público para uma falha de segurança.',
    '',
  ].join('\n');

  return new Response(texto, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
