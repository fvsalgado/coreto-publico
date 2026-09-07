import { PRODUTO } from '@/src/lib/produto';
import { ORIGEM_DA_MONTRA } from '../montra';
import { URL_DA_POLITICA, validadeDoSecurityTxt } from '../politica-de-seguranca';

/**
 * O `security.txt` do domínio do produto — o sítio onde se procura primeiro.
 *
 * A rota que serve as regiões vive em `app/[regiao]/seguranca-txt`, e o
 * `coreto.org` não é de região nenhuma: é isso que faz dele a ficha técnica.
 * O resultado, medido: `curl -o /dev/null -w '%{http_code}'
 * https://coreto.org/.well-known/security.txt` dava 404, contra 200 nas outras
 * duas origens. Quem faz divulgação responsável começa pelo domínio da marca,
 * e encontrava lá exatamente nada.
 *
 * **Um contacto só, e é o do produto.** A rota da região põe dois — o do
 * produto primeiro, o da região a seguir, e a razão está escrita lá. Aqui não
 * há região de quem dar o segundo, e não se inventa nenhum.
 *
 * O caminho público é `/.well-known/security.txt`; quem lhe dá o nome é o
 * middleware, pela mesma razão de sempre — o App Router ignora pastas
 * começadas por ponto, e por isso nenhuma rota nasceria lá.
 *
 * Não toca na base de dados, como tudo o que se serve a um anfitrião sem
 * região: é a superfície que tem de aguentar o dia em que a base está em
 * baixo. Um contacto de segurança que só responde quando o Postgres responde
 * é um contacto de segurança a menos.
 */

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const texto = [
    `Contact: mailto:${PRODUTO.email}`,
    `Expires: ${validadeDoSecurityTxt(new Date())}`,
    'Preferred-Languages: pt, en',
    `Policy: ${URL_DA_POLITICA}`,
    `Canonical: ${ORIGEM_DA_MONTRA}/.well-known/security.txt`,
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
