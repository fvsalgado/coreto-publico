import type { NextConfig } from 'next';

/**
 * Cabeçalhos de segurança.
 *
 * A CSP é restritiva em tudo menos num ponto: `script-src` leva
 * `'unsafe-inline'`, porque o App Router arranca a hidratação com scripts
 * inline. A decisão está tomada com os olhos abertos e explicada por extenso
 * na diretiva, lá abaixo — este cabeçalho já disse aqui o contrário do que o
 * ficheiro fazia, e um comentário que mente sobre a CSP é pior do que
 * nenhum.
 *
 * `frame-ancestors *` é deliberado — o widget existe para ser embebido nos
 * sites das câmaras, e essa é toda a sua razão de ser; as rotas que não são o
 * widget levam `frame-ancestors 'none'`.
 */
/**
 * Anfitriões do PostHog, lidos da configuração e não escritos à mão.
 *
 * A medição carrega um script de `<host>-assets.i.posthog.com` e envia para
 * `<host>`. Com a CSP a dizer só `'self'`, o navegador bloqueia os dois em
 * silêncio: não há erro na consola do servidor, não há pedido, e a medição
 * simplesmente não existe sem que ninguém dê por isso. Derivar os anfitriões
 * da mesma variável que o código do cliente usa evita que uma mudança de
 * região (`eu` → `us`) deixe a CSP para trás.
 *
 * Sem chave configurada, nem sequer entram na diretiva — a CSP mais apertada
 * é a que se aplica por omissão.
 */
function posthogHosts(): string[] {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return [];
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com').replace(
    /\/$/,
    '',
  );
  return [host, host.replace('.i.posthog.com', '-assets.i.posthog.com')];
}

const ANALYTICS_HOSTS = posthogHosts();

/**
 * O servidor de mosaicos do mapa.
 *
 * O mapa da agenda desenha ruas, e as ruas vêm do OpenFreeMap — dados do
 * OpenStreetMap, sem chave e sem conta. O MapLibre vai buscá-los por `fetch`,
 * e não por `<img>`: o estilo, os mosaicos vetoriais, os tipos de letra e os
 * ícones passam todos por `connect-src`. Com a CSP a dizer só `'self'`, o
 * navegador bloqueava-os em silêncio e ficava um retângulo cinzento sem uma
 * única mensagem de erro que explicasse porquê.
 */
const MAPA_HOST = 'https://tiles.openfreemap.org';

/**
 * O projeto Supabase desta instalação, e só ele.
 *
 * Esteve `https://*.supabase.co`, que autoriza o navegador a falar com
 * qualquer projeto Supabase do mundo — o de um atacante incluído, se algum
 * dia houvesse um script a mais na página. Lê-se a origem da variável que a
 * aplicação já usa; sem ela (um build sem base, o CI, um fork) volta-se ao
 * curinga, porque um `connect-src` vazio não tira nada a ninguém e um sítio
 * sem base não tem a quem se ligar.
 */
function supabaseHosts(): string[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    return url ? [new URL(url).origin] : ['https://*.supabase.co'];
  } catch {
    return ['https://*.supabase.co'];
  }
}

const SUPABASE_HOSTS = supabaseHosts();

const CSP = [
  "default-src 'self'",
  // `'unsafe-inline'` nos scripts, e é uma decisão tomada com os olhos
  // abertos. O App Router arranca a hidratação com scripts inline; sem os
  // deixar correr, TODO o JavaScript do sítio esteve morto em produção desde
  // o primeiro dia — o visor dos destaques, o botão de pausa da marquee, as
  // revelações — e ninguém deu por isso porque o essencial funciona sem ele.
  // A alternativa canónica (nonce por pedido) obriga a renderização dinâmica
  // e deitava fora o ISR, que é o que torna o sítio rápido em alojamento
  // barato. O risco que se aceita: um inline script só executa se alguém
  // conseguir injetar HTML — e o React escapa tudo por omissão; o único
  // `dangerouslySetInnerHTML` é o JSON-LD, gerado por nós. Defesa em
  // profundidade perde uma camada; a porta de entrada continua fechada.
  ['script-src', "'self'", "'unsafe-inline'", ...ANALYTICS_HOSTS].join(' '),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  ['connect-src', "'self'", ...SUPABASE_HOSTS, MAPA_HOST, ...ANALYTICS_HOSTS].join(' '),
  "worker-src 'self' blob:",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

/**
 * O que o navegador não deixa esta página fazer.
 *
 * `interest-cohort=()` esteve aqui e saiu: é a diretiva do FLoC, retirado em
 * 2022, e um cabeçalho que nomeia um standard morto não protege nada — dá é
 * a impressão de proteger, que é pior. O que existe hoje chama-se
 * `browsing-topics`, e a lista aproveitou para dizer «não» ao resto do que
 * uma agenda cultural nunca precisa de pedir.
 */
const PERMISSOES_NEGADAS = [
  'accelerometer',
  'browsing-topics',
  'camera',
  'display-capture',
  'geolocation',
  'gyroscope',
  'magnetometer',
  'microphone',
  'payment',
  'serial',
  'usb',
]
  .map((recurso) => `${recurso}=()`)
  .join(', ');

/**
 * Dois anos, subdomínios incluídos — e **sem `preload`**, de propósito.
 *
 * A palavra esteve aqui e saiu no dia em que o dono decidiu não submeter o
 * domínio à lista de preload dos browsers. Não é arrumação: a submissão em
 * hstspreload.org **não verifica a propriedade do domínio** — basta o sítio
 * servir o cabeçalho com `preload` para qualquer pessoa o poder submeter. Uma
 * declaração que não se pretende cumprir é, aqui, uma porta aberta a terceiros
 * para uma lista de que sair demora meses e passa por várias versões de
 * browser.
 *
 * O que se perde ao não estar na lista é só a **primeira** visita de quem
 * escreve `coreto.org` sem `https://`: essa ainda tenta HTTP antes de ser
 * mandada para HTTPS. Da segunda em diante, este cabeçalho já resolve. O
 * raciocínio completo está em `docs/DNS.md`.
 */
const HSTS = 'max-age=63072000; includeSubDomains';

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'Strict-Transport-Security', value: HSTS },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: PERMISSOES_NEGADAS },
  /*
   * Isola o `window.opener`: uma página que abramos noutro separador deixa de
   * ter uma referência a esta. `same-origin-allow-popups` e não `same-origin`
   * porque as ligações para fora — o sítio da câmara, a bilheteira — são metade
   * do valor desta agenda, e `same-origin` corta-lhes o `window.open`.
   */
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  // Não há aqui `crossdomain.xml` nenhum, e não deve passar a haver.
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
];

// O widget é a exceção: existe para viver dentro de um iframe alheio.
const WIDGET_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value: CSP.replace("frame-ancestors 'none'", 'frame-ancestors *'),
  },
  { key: 'Strict-Transport-Security', value: HSTS },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Sem `Cross-Origin-Opener-Policy`: o widget vive dentro de um iframe, e a
  // diretiva só vale para contextos de topo. Escrevê-la aqui era ruído.
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
];

/**
 * Um ano de cache para o que não muda — e a conta que isso obriga a fazer.
 *
 * O cartaz de partilha, os logótipos do cofinanciamento e os ícones da
 * aplicação saem de `public/`, e o Next serve `public/` com
 * `public, max-age=0, must-revalidate`. Medido em produção antes disto:
 * `/og/medio-tejo.png` (183 891 B) e `/logos/medio-tejo/cim-escuro.png`
 * (16 002 B) obrigavam a uma revalidação condicional de cada vez que o
 * navegador precisava deles. Um 304 é barato em bytes e caro em latência — e
 * a latência é o que se sente num telemóvel, a meio do concelho, com a rede
 * que houver.
 *
 * **O que isto obriga:** estes nomes não têm hash. Uma imagem substituída fica
 * presa na cache de quem já cá esteve, e nem um novo lançamento a desaloja.
 * A saída é versionar na cadeia de consulta — `/og/medio-tejo.png?v=2` — e os
 * dois caminhos que mudam na prática (o cartaz de partilha e os logótipos da
 * região) são campos do painel de administração, escritos à mão: quem troca o
 * ficheiro acrescenta `?v=2` no mesmo formulário, sem tocar em código. O
 * compromisso vale a pena porque a alternativa é cobrar uma revalidação a
 * *todos* os visitantes, *sempre*, para o caso de um ficheiro que muda uma vez
 * por ano.
 *
 * Sem `immutable` aqui, e é de propósito: sem ele, um recarregamento à mão
 * ainda revalida, e é essa a rede de segurança de quem se esqueceu do `?v=`.
 */
const UM_ANO = 60 * 60 * 24 * 365;

const CACHE_DE_FICHEIROS = [{ key: 'Cache-Control', value: `public, max-age=${UM_ANO}` }];

/**
 * Os ícones de metadados, esses são mesmo imutáveis.
 *
 * O Next escreve-lhes o hash do conteúdo na cadeia de consulta do `<link>`
 * (`/icon.svg?icon.38mkknf43f7sy.svg`), portanto trocar o ficheiro troca o
 * endereço sozinho. Com o nome já versionado, `immutable` não custa nada e
 * poupa a revalidação em cada separador novo.
 */
const CACHE_IMUTAVEL = [{ key: 'Cache-Control', value: `public, max-age=${UM_ANO}, immutable` }];

/**
 * O que leva cache longa. **`/_next/static/` não está aqui, e não pode estar:**
 * já vem com hash no nome e já sai `immutable` do executor — o Next ignora (e
 * avisa) quem lhe tente escrever `Cache-Control` por cima.
 */
const FICHEIROS_ESTATICOS = ['/og/:caminho*', '/logos/:caminho*', '/icones/:caminho*'];

const ICONES_DE_METADADOS = ['/icon.svg', '/apple-icon.png', '/favicon.ico'];

/**
 * As páginas que se fundiram, e para onde foram.
 *
 * O que a casa é vive em `/informacoes`; de onde vêm os eventos e como
 * levá-los daqui vivem em `/fontes` e em `/levar`. Os endereços antigos não
 * desaparecem — estavam no rodapé, na documentação do widget e na resposta
 * de erro da API, e há mais de um sítio de câmara com eles escritos à mão.
 *
 * `/privacidade` e `/acessibilidade` **não estão aqui, e não podem estar.**
 * Foram redirecionamentos para as âncoras de `/informacoes` enquanto os dois
 * textos legais viveram lá dentro; voltaram a ser páginas quando as
 * informações passaram a desligar-se no painel — ver o comentário em
 * `app/[regiao]/privacidade/page.tsx`. Um redirecionamento aqui passava à
 * frente da página e mandava-a para uma âncora que pode ser um 404.
 *
 * `permanent` porque é isso que são: uma fusão não é uma experiência. O 308
 * é o que passa a autoridade dos endereços antigos para os novos em vez de
 * a deitar fora, e o que diz aos leitores de feeds para não voltarem lá.
 */
const FUSOES: readonly { source: string; destination: string }[] = [
  { source: '/sobre', destination: '/informacoes' },
  // `/dados` aponta ao destino final e não a um salto intermédio: a secção
  // dos feeds mudou-se de `/fontes` para `/levar`, e deixar aqui o endereço
  // antigo dava duas viagens para chegar ao mesmo sítio.
  { source: '/dados', destination: '/levar#dados' },
  /*
   * `/widget` juntou-se aos feeds em `/levar`.
   *
   * **A fonte é exacta, e tem de continuar a sê-lo.** Um `/widget/:path*`
   * aqui apanhava `/widget/tomar` — que não é uma página, é a caixa que corre
   * dentro dos iframes já colados nos sítios das câmaras. Redireccioná-la
   * apagava todas as caixas de uma vez.
   */
  { source: '/widget', destination: '/levar' },
  // A página dos concelhos passou a ser o mapa. O nome antigo descrevia a
  // matéria («os onze concelhos»); o novo descreve o que a página faz.
  { source: '/concelhos', destination: '/mapa' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /*
   * O `unauthorized()` do `next/navigation`, que a porta do balanço usa.
   *
   * Sem isto, uma página que precisa de uma chave e não a recebe só sabe
   * responder 200 com um texto a dizê-lo — e uma porta fechada que responde
   * 200 é uma porta que os registos de quem opera contam como aberta. O
   * código faz parte da resposta.
   *
   * É o único uso, e é deliberadamente pequeno: `authInterrupts` liga
   * também o `forbidden()`, que esta casa não usa em lado nenhum — 403 diz a
   * quem tenta que a chave existe e não serve ali, que é informação a mais.
   */
  experimental: {
    authInterrupts: true,
  },
  /*
   * Sem bloco `images`, e é a verdade a apanhar a configuração.
   *
   * Havia aqui `remotePatterns` a autorizar `**.supabase.co` e `formats` a
   * pedir WebP — configuração do `next/image`, que este sítio não usa numa
   * única linha: os cartazes são `<img>` e `background-image`, por razões
   * escritas em `src/lib/cartaz.ts` (um cartaz que morre no servidor da
   * câmara não pode desenhar o ícone de imagem partida por cima da capa).
   * Configuração que não governa nada faz o próximo leitor acreditar que o
   * otimizador está ligado. Se um dia o `next/image` entrar, o bloco volta —
   * e aí a lista de anfitriões terá de incluir os vinte e um servidores
   * municipais, não só o Supabase.
   */
  async redirects() {
    return FUSOES.map((fusao) => ({ ...fusao, permanent: true }));
  },
  async headers() {
    return [
      { source: '/widget/:path*', headers: WIDGET_HEADERS },
      // `widget/` com a barra: sem ela, qualquer caminho que começasse por
      // «widget» — `/widgets`, `/widgetaria` — ficava sem cabeçalho nenhum.
      { source: '/((?!widget/).*)', headers: SECURITY_HEADERS },
      ...FICHEIROS_ESTATICOS.map((source) => ({ source, headers: CACHE_DE_FICHEIROS })),
      ...ICONES_DE_METADADOS.map((source) => ({ source, headers: CACHE_IMUTAVEL })),
      // O processador do mapa leva a versão no caminho (ver
      // `scripts/copiar-maplibre.mjs`): um caminho que muda com a versão pode
      // ser imutável, e um Worker que não se volta a pedir é um mapa que abre
      // mais depressa na segunda visita.
      { source: '/maplibre/:versao/:ficheiro', headers: CACHE_IMUTAVEL },
    ];
  },
};

export default nextConfig;
