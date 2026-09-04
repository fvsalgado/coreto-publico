import { env } from '@/src/lib/env';

/**
 * A política de MTA-STS, servida pelo próprio sítio.
 *
 * O MTA-STS obriga quem entrega correio a este domínio a usar TLS e a recusar
 * a entrega se o certificado não bater certo. Sem ele, quem esteja em posição
 * de rede pode fazer o servidor de origem baixar para texto simples e ler o
 * que vai dentro — que aqui são submissões de eventos, com o endereço de quem
 * escreveu e os cartazes em anexo.
 *
 * **Porque é o sítio a servir isto.** A norma (RFC 8461) exige que a política
 * viva em `https://mta-sts.<domínio>/.well-known/mta-sts.txt`, com certificado
 * válido — não há forma de a publicar só no DNS. Como já há aqui um Next.js
 * com certificado automático, a peça que faltava era uma rota. A alternativa
 * era um segundo alojamento só para servir cinco linhas de texto.
 *
 * **`testing` por omissão, e é a decisão certa.** Em `enforce`, um MX mal
 * escrito deixa de receber correio, e a falha é silenciosa do nosso lado: quem
 * escreve é que recebe a devolução, e nós não damos por nada. Uma agenda cujo
 * canal principal de entrada é o email não pode estrear uma política assim.
 * Passa-se a `enforce` mudando `MTA_STS_MODO`, depois de ler os relatórios
 * TLS-RPT de uma semana.
 *
 * **O `id` do registo TXT no DNS tem de mudar sempre que esta política muda.**
 * É por ele que um servidor de correio sabe que tem de voltar a buscar o
 * ficheiro; sem o mudar, continua a usar a que tem em cache até ao `max_age`.
 * Está escrito em `docs/DNS.md`, que é onde vive o passo do DNS.
 */

export const revalidate = 3600;

/**
 * Uma semana. É o valor que a norma sugere e o que faz sentido aqui: mais
 * curto obriga a ir buscar a política com frequência sem ganhar nada; mais
 * longo faz uma correção demorar a chegar aos servidores que já a leram.
 */
const MAX_AGE = 604800;

export async function GET(): Promise<Response> {
  const mx = env.MTA_STS_MX;

  /*
   * Sem MX configurado não se serve política nenhuma.
   *
   * Um ficheiro que diz «só entrego a estes servidores» sem nomear nenhum é,
   * na melhor das hipóteses, ignorado — e na pior, em `enforce`, uma forma de
   * recusar todo o correio. O 404 é a resposta honesta: não há política aqui.
   */
  if (!mx) {
    return new Response('Não há política de MTA-STS publicada neste domínio.\n', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  /*
   * Uma linha `mx:` por servidor. A vírgula é o separador na variável de
   * ambiente porque um MX não pode ter vírgulas; os espaços à volta caem.
   */
  const servidores = mx
    .split(',')
    .map((nome) => nome.trim())
    .filter((nome) => nome.length > 0);

  // CRLF, e não `\n`: a RFC 8461 pede terminadores de linha de rede.
  const texto = [
    'version: STSv1',
    `mode: ${env.MTA_STS_MODO}`,
    ...servidores.map((servidor) => `mx: ${servidor}`),
    `max_age: ${MAX_AGE}`,
    '',
  ].join('\r\n');

  return new Response(texto, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
