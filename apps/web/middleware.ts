import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_LOGIN_PATH, ADMIN_PATH_HEADER, adminLoginPath } from '@/src/lib/admin/guarda';
import { ADMIN_COOKIE_NAME, readSessionToken } from '@/src/lib/admin/session';
import { SITE_URL } from '@/src/lib/env';
import {
  REGIAO_PRINCIPAL,
  dominiosDasRegioes,
  normalizarHost,
  redirecionamentosDosDominios,
  regiaoDoHost,
} from '@/src/lib/regiao-host';

/**
 * A porta do multi-inquilino, e a guarda da área interna.
 *
 * Cada pedido público é reescrito para o segmento da sua região: o Host diz
 * qual (`regiao-host.ts` traduz), e o caminho passa a `/<regiao>/…` por dentro
 * sem o endereço público mudar. É reescrita e nunca `headers()` numa página —
 * o ISR e a `unstable_cache` continuam a valer, porque cada região é um
 * caminho distinto com cache distinta. Um Host que não é de nenhuma região não
 * tem segmento nenhum para onde ir: vê a página do produto, e a decisão está
 * escrita em `regiao-host.ts`.
 *
 * O que NÃO se reescreve, e porquê, está no corpo — cada exceção com a sua
 * razão. A regra de fundo: na dúvida, reescreve-se; as exceções são listas
 * fechadas, porque uma exceção por padrão («tem um ponto, é estático») comia
 * os feeds (`/feed.xml`, `/agenda.ics`, `/llms.txt` são páginas da região).
 *
 * O middleware corre no runtime de edge e não pode importar nada que dependa
 * do Node — daí verificar o token com a parte pura da sessão e não com
 * `currentAdmin()`. É a primeira barreira, e não a única: cada ação de
 * moderação volta a exigir a sessão do seu lado, e o layout de `app/admin`
 * volta a exigi-la antes de servir qualquer leitura, porque uma verificação
 * só à porta é uma verificação que um dia alguém contorna com um pedido
 * direto. O que as duas barreiras partilham está em `admin/guarda.ts`.
 */

/**
 * As pastas de `public/` e as convenções de raiz — ficheiros, não páginas.
 *
 * **Esta lista é fechada, e é por isso que uma pasta nova tem de entrar aqui.**
 * O que não estiver nela é tratado como caminho de página: passa pela
 * resolução de região e acaba num 404, mesmo com o ficheiro em `public/` à
 * espera. Aconteceu com o `/produto/`, das capturas da ficha técnica — o HTML
 * referenciava-as com as medidas certas e as quatro davam 404.
 */
const CAMINHOS_DE_FICHEIROS = [
  '/icones/',
  '/logos/',
  '/og/',
  '/produto/',
  '/.well-known/',
] as const;
const FICHEIROS_DE_RAIZ = ['/favicon.ico', '/icon.svg', '/apple-icon.png'] as const;

/** O caminho interno da página do produto — ver `app/pagina-do-produto`. */
const PAGINA_DO_PRODUTO = '/pagina-do-produto';

/**
 * O que a montra serve, e o caminho interno de cada coisa.
 *
 * **Lista fechada, e é o que impede este anfitrião de servir a agenda de
 * alguém.** Um Host fora do mapa não tem região; o que aqui não estiver leva
 * o 404 de qualquer página inexistente, que é a regra que já valia para a
 * raiz e agora vale para quatro endereços em vez de um.
 *
 * Os dois de máquina entraram porque faltavam onde mais falta faziam:
 * `curl -o /dev/null -w '%{http_code}' https://coreto.org/.well-known/security.txt`
 * dava 404, contra 200 nas duas origens de região — o domínio do produto era o
 * único sem `security.txt`, e é o primeiro onde um investigador procura. O
 * mesmo para o `sitemap.xml`. A causa era esta: as duas rotas vivem em
 * `app/[regiao]/`, e este anfitrião não chega a ter segmento nenhum.
 *
 * Os caminhos internos ficam debaixo do da página do produto de propósito.
 * Herdam dele a propriedade que interessa: `/pagina-do-produto/…` pedido por
 * fora não é endereço nenhum — num anfitrião de região reescreve-se para
 * `/<regiao>/pagina-do-produto/…`, que não existe; aqui não está nesta lista,
 * e cai no mesmo 404. Um endereço, um conteúdo.
 */
const CAMINHOS_DA_MONTRA = new Map<string, string>([
  ['/', PAGINA_DO_PRODUTO],
  ['/seguranca', `${PAGINA_DO_PRODUTO}/seguranca`],
  ['/.well-known/security.txt', `${PAGINA_DO_PRODUTO}/seguranca-txt`],
  ['/sitemap.xml', `${PAGINA_DO_PRODUTO}/sitemap-xml`],
]);

/**
 * Os endereços cujo caminho público não é o interno, e o segmento onde vivem.
 *
 * Três, e por duas razões. O `sitemap.xml` porque um segmento com esse nome é
 * convenção especial do Next (ver o comentário abaixo). O `security.txt` e o
 * `mta-sts.txt` porque vivem sob `.well-known/`, e o App Router ignora pastas
 * começadas por ponto — nenhuma rota nasceria lá.
 */
/** O anfitrião onde a política de MTA-STS tem de viver — ver a RFC 8461. */
const PREFIXO_MTA_STS = 'mta-sts';
const CAMINHO_MTA_STS = '/.well-known/mta-sts.txt';

/**
 * O domínio de correio deste deployment — o do `SITE_URL`.
 *
 * **Isto esteve preso ao mapa das regiões, e partiu-se.** A resolução era:
 * tirar o prefixo `mta-sts.`, procurar o que sobra no mapa domínio→região, e
 * servir a política se estivesse lá. Funcionou enquanto o `coreto.org` foi a
 * montra. No dia em que a montra mudou de casa e o `coreto.org` deixou de ser
 * de região nenhuma — que é o que faz dele a ficha técnica —, a política de
 * correio foi atrás: `mta-sts.coreto.org` passou a 404, e um domínio que
 * recebe correio ficou sem publicar a política que promete TLS.
 *
 * O engano de origem é que a pergunta estava errada. A política **não é de
 * uma região**: a rota que a serve nem olha para o segmento, lê
 * `MTA_STS_MX` e `MTA_STS_MODO` do ambiente. É do domínio de correio do
 * deployment, e é esse que aqui se compara. O segmento de região que a
 * reescrita usa é um preenchimento — tem de ser válido, e nada mais.
 *
 * Mais: com a regra antiga, `mta-sts.<domínio de qualquer região>` servia
 * esta mesma política, com este MX, a um domínio cujo correio não passa por
 * aqui. Uma política de MTA-STS errada é pior do que nenhuma — promete TLS
 * para servidores que não são os do domínio.
 */
const DOMINIO_DE_CORREIO = normalizarHost(new URL(SITE_URL).host);

const NOMES_PUBLICOS = new Map<string, string>([
  ['/sitemap.xml', 'sitemap-xml'],
  ['/.well-known/security.txt', 'seguranca-txt'],
  [CAMINHO_MTA_STS, 'mta-sts-txt'],
]);

/** Um nome interno pedido por fora não responde — ver `NOMES_PUBLICOS`. */
const NOMES_INTERNOS = new Set([...NOMES_PUBLICOS.values()].map((nome) => `/${nome}`));

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  /*
   * `mta-sts.<domínio>` serve uma coisa só, e não é o sítio.
   *
   * A RFC 8461 obriga a política a viver em
   * `https://mta-sts.<domínio>/.well-known/mta-sts.txt`, com certificado
   * válido e **sem redirecionamentos** — um 308 para o domínio canónico, que é
   * o que este middleware faz a qualquer alias, invalidaria a política. Daí
   * este anfitrião ser tratado aqui, antes dos alias: o prefixo cai, o que
   * sobra procura-se no mapa das regiões, e só aquele caminho responde.
   *
   * Tudo o resto neste anfitrião é 404, de propósito. Um subdomínio que existe
   * para servir cinco linhas de texto não deve responder 200 à agenda, aos
   * feeds nem ao painel — seriam endereços a mais para o mesmo conteúdo.
   *
   * **Vem antes da guarda do `/admin`**, e é por isso que é a primeira coisa
   * da função: sem isso, `mta-sts.<domínio>/admin` chegava à página de entrada
   * do painel. Um subdomínio de correio não tem de saber que existe uma área
   * interna.
   */
  const anfitriao = normalizarHost(request.headers.get('host'));
  if (anfitriao?.startsWith(`${PREFIXO_MTA_STS}.`)) {
    const dominioDaPolitica = anfitriao.slice(PREFIXO_MTA_STS.length + 1);
    const destinoDaPolitica = request.nextUrl.clone();
    destinoDaPolitica.pathname =
      dominioDaPolitica === DOMINIO_DE_CORREIO && pathname === CAMINHO_MTA_STS
        ? `/${REGIAO_PRINCIPAL}/mta-sts-txt`
        : `${PAGINA_DO_PRODUTO}/nao-e-endereco`;
    const resposta = NextResponse.rewrite(destinoDaPolitica);
    resposta.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return resposta;
  }

  // A área interna é uma só para todas as regiões e vive fora do segmento.
  if (pathname.startsWith('/admin')) {
    const response = await guardAdmin(request);
    // A área interna não é para indexar, nem para ficar em cache de ninguém.
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
    return response;
  }

  // Da API só `/api/events` é da região — é o feed público filtrado. O resto
  // (revalidate, intake, stats, submissions, regioes) é do produto: uma
  // recolha, um webhook e um painel servem todas as regiões.
  if (pathname !== '/api/events' && pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  /*
   * Um alias (0111) não serve: redireciona para o domínio canónico da sua
   * região, caminho e query intactos — 308, que diz «para sempre e com o
   * mesmo método». Dois endereços com as mesmas páginas era conteúdo
   * duplicado; de fora ficam só a área interna e a API do produto, acima —
   * e não é arrumação: o mapa vem de `/api/regioes`, e um redirecionamento
   * avaliado antes dessa exceção punha o middleware do próprio `/api/regioes`
   * a pedir o mapa a si mesmo, pedido dentro de pedido até ao timeout. Foi
   * assim que se viu. Uma falha na leitura deixa o mapa vazio: nada
   * redireciona e tudo se serve — degradar, nunca partir.
   */
  const redirecionamentos = await redirecionamentosDosDominios(request.nextUrl.origin);
  const host = normalizarHost(request.headers.get('host'));
  const canonico = host ? redirecionamentos[host] : undefined;
  if (canonico) {
    const destinoCanonico = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      `https://${canonico}`,
    );
    return NextResponse.redirect(destinoCanonico, 308);
  }

  /*
   * Ficheiros a sério não têm região: saem de `public/` e das convenções de
   * raiz tal como estão. Lista fechada — ver o comentário do módulo.
   *
   * O `security.txt` e o `mta-sts.txt` são a exceção dentro da exceção, e por
   * isso vêm antes: moram sob `/.well-known/`, que está na lista dos
   * ficheiros, mas não são ficheiros nenhuns — são rotas da região, com o
   * contacto dela e valores que se calculam. Deixá-los cair aqui dava 404,
   * porque `public/` não tem a pasta.
   */
  if (
    !NOMES_PUBLICOS.has(pathname) &&
    (FICHEIROS_DE_RAIZ.includes(pathname as (typeof FICHEIROS_DE_RAIZ)[number]) ||
      CAMINHOS_DE_FICHEIROS.some((prefixo) => pathname.startsWith(prefixo)))
  ) {
    return NextResponse.next();
  }

  /*
   * Tudo o resto é da região — as páginas, os feeds, o sitemap, o robots, o
   * manifesto, o widget e o `/api/events`. Uma falha na leitura do mapa
   * devolve o mapa vazio dentro de `dominiosDasRegioes`, nunca um erro aqui:
   * um 500 no middleware deitava abaixo todas as regiões ao mesmo tempo.
   */
  const dominios = await dominiosDasRegioes(request.nextUrl.origin);
  const regiao = regiaoDoHost(request.headers.get('host'), dominios);
  if (regiao === null) return paginaDoProduto(request);

  const destino = request.nextUrl.clone();
  /*
   * Os endereços cujo caminho interno não é o público — ver `NOMES_PUBLICOS`.
   *
   * O do sitemap tem história: um segmento chamado `sitemap.xml` é convenção
   * especial do Next (a dos `generateSitemaps`), e no build saía um fantasma
   * pré-gerado `/-/sitemap.xml` enquanto no Vercel a rota dinâmica respondia
   * 404 — em produção, não em local, que foi onde se viu. O route handler vive
   * em `sitemap-xml/` e é o middleware que lhe dá o nome público.
   *
   * E só o nome público: um nome interno pedido por fora reescreve-se para um
   * caminho que não existe e leva o 404 de qualquer página inexistente, porque
   * um nome interno que também respondesse dava ao mesmo ficheiro dois
   * endereços — e dois endereços para o mesmo conteúdo é conteúdo duplicado.
   */
  const interno = NOMES_PUBLICOS.get(pathname);
  destino.pathname = interno
    ? `/${regiao}/${interno}`
    : NOMES_INTERNOS.has(pathname)
      ? `/${regiao}${pathname}/nao-e-endereco`
      : `/${regiao}${pathname}`;
  return NextResponse.rewrite(destino);
}

/**
 * O anfitrião não é de ninguém: serve-se o produto, e só o que ele tem.
 *
 * Um Host fora do mapa não tem agenda, feeds nem manifesto — tem a ficha
 * técnica, a política de segurança e os dois ficheiros de máquina que as
 * anunciam, e é a lista de `CAMINHOS_DA_MONTRA`. Tudo o resto vai para um
 * caminho que não existe, que leva o 404 de qualquer página inexistente: é a
 * mesma manobra do `/sitemap-xml` acima, e é o que impede que este domínio
 * responda 200 a endereços que aqui não significam nada.
 *
 * O sitemap e o `security.txt` da montra falam sempre da mesma origem — a do
 * canónico que a ficha técnica já declara —, e por isso servem-se a
 * **qualquer** anfitrião desconhecido sem dizer nada de falso: é a mesma
 * decisão do canónico fixo, que manda para o original em vez de se esconder.
 * Quem lê a linha `Canonical:` sabe onde é a casa.
 *
 * **O `X-Robots-Tag` ficou só para o 404, e a razão vale a pena.** Ia nas duas
 * respostas, a acompanhar o `noindex` que a página declarava — o mesmo
 * conteúdo em todos os anfitriões desconhecidos é conteúdo duplicado. Mas a
 * página do produto passou a ser a face pública do `coreto.org`, e o
 * duplicado passou a resolver-se por canónico. Um cabeçalho `noindex` **ganha
 * ao canónico do HTML**: mantê-lo aqui era publicar uma ficha técnica que
 * nenhum motor de busca podia indexar, e depois estranhar que ninguém a
 * encontrasse.
 *
 * No 404 fica, porque aí não há nada a indexar em endereço nenhum.
 */
function paginaDoProduto(request: NextRequest): NextResponse {
  const interno = CAMINHOS_DA_MONTRA.get(request.nextUrl.pathname);
  const destino = request.nextUrl.clone();
  destino.pathname = interno ?? `${PAGINA_DO_PRODUTO}/nao-e-endereco`;
  const resposta = NextResponse.rewrite(destino);
  if (!interno) resposta.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return resposta;
}

/**
 * Deixa seguir, dizendo ao servidor por onde é que este pedido entrou.
 *
 * O caminho vai num cabeçalho de **pedido** — que é o que
 * `NextResponse.next({ request })` faz, e o que um `response.headers.set` não
 * faria — porque é a única forma de o layout de `app/admin` o ler com
 * `headers()` e voltar a exigir a sessão do seu lado sem se enganar a si
 * próprio na página de entrada. O `set` é deliberado: apaga o que um visitante
 * tenha tentado mandar com este nome.
 */
function deixarPassar(request: NextRequest): NextResponse {
  const cabecalhos = new Headers(request.headers);
  cabecalhos.set(ADMIN_PATH_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: cabecalhos } });
}

/**
 * A porta da área interna, e a única regra que ela tem: sem sessão válida não
 * se entra.
 *
 * Faltar o `ADMIN_SESSION_SECRET` deixava passar toda a gente — a ideia era
 * não trancar uma instalação por configurar à porta de uma página que ela
 * ainda não sabe servir. Era a degradação certa aplicada ao sítio errado: o
 * público degrada (um sítio sem base de dados serve na mesma), a segurança
 * fecha. E o preço era real — bastava a chave de serviço estar posta e o
 * segredo não para qualquer visitante ler a fila de moderação, com emails,
 * texto em bruto e hashes de IP, a auditoria e as licenças.
 *
 * Sem segredo manda-se para a entrada como a qualquer outro pedido sem
 * sessão, e é lá que a falta de configuração se explica: a `/admin/entrar`
 * reconhece-a e mostra «Administração por configurar», sem abrir nada. A
 * instalação por configurar continua a ter uma resposta com sentido; o que
 * deixa de ter é acesso.
 */
async function guardAdmin(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (pathname === ADMIN_LOGIN_PATH) return deixarPassar(request);

  const secret = process.env.ADMIN_SESSION_SECRET;
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (secret && (await readSessionToken(token, secret))) return deixarPassar(request);

  return NextResponse.redirect(new URL(adminLoginPath(pathname), request.url));
}

export const config = {
  /*
   * Tudo menos os ficheiros do próprio Next. As outras exceções decidem-se no
   * código, onde têm nome, razão e teste — um matcher é uma expressão regular
   * de configuração, e regras de negócio em expressões regulares de
   * configuração são as que ninguém volta a ler.
   */
  matcher: ['/((?!_next/).*)'],
};
