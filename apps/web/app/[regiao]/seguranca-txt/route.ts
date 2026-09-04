import { SITE_URL } from '@/src/lib/env';
import { PRODUTO } from '@/src/lib/produto';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { urlDoSitio } from '@/src/lib/regiao';

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

/**
 * A validade, ancorada no primeiro dia de um mês seis meses à frente.
 *
 * Ancorada e não «agora mais seis meses» porque uma data que muda a cada
 * pedido faz o ficheiro diferir entre duas leituras da mesma hora, e um
 * `security.txt` que nunca é byte a byte igual a si próprio é um ficheiro que
 * nenhuma cache e nenhum varredor conseguem comparar.
 */
function validoAte(agora: Date): string {
  const mes = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 6, 1, 0, 0, 0);
  return new Date(mes).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

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
    `Expires: ${validoAte(new Date())}`,
    'Preferred-Languages: pt, en',
    `Policy: ${origem}/privacidade`,
    'Policy: https://github.com/fvsalgado/coreto/blob/main/SECURITY.md',
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
