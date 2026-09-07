/**
 * Verificação das promessas de peso e de fronteira, contra o sítio a correr.
 *
 * O README abre a dizer que o sítio é rápido, e nada o media. A acessibilidade
 * é medida a cada alteração precisamente porque a declaração publicada em
 * `/acessibilidade` tem de ser verdade; isto faz o mesmo às outras quatro
 * promessas que estavam escritas e não tinham verificação nenhuma:
 *
 *   1. nenhum pedido a terceiros para desenhar uma página;
 *   2. nada guardado no equipamento de quem visita;
 *   3. o essencial funciona sem JavaScript;
 *   4. o cartaz não faz a página saltar.
 *
 * Corre com o sítio já a servir (`pnpm --filter @coreto/web start`) e aponta
 * para ele com BASE_URL:
 *
 *   pnpm --filter @coreto/web build && pnpm --filter @coreto/web start &
 *   pnpm check:desempenho
 *
 * ## O que este número não é
 *
 * O `next start` do executor comprime com gzip; a Vercel serve brotli. Os
 * bytes contados aqui **não** são os que um visitante recebe em produção — são
 * um detector de regressão contra si próprio. Ler esta tabela como se fosse
 * uma medição de produção é usá-la para o que ela não serve.
 *
 * ## Porque é que isto não é Lighthouse
 *
 * Duas razões, e as duas estão escritas no `ci.yml` a propósito da auditoria
 * de acessibilidade. A primeira: sem credenciais o catálogo está vazio, e uma
 * pontuação de desempenho sobre uma agenda vazia não mede nada — mas o
 * repositório tem de poder ser bifurcado e o CI passar sem um único segredo. A
 * segunda: a pontuação do Lighthouse oscila entre corridas do mesmo commit num
 * executor partilhado, e um gate que acusa falso duas vezes é um gate que
 * alguém desliga — e aí perde-se a verificação toda em vez de metade.
 *
 * Por isso **nada que varie com o executor pode reprovar**. Bytes, origens,
 * cookies e CLS são função da compilação. O TTFB e o LCP medem-se, imprimem-se
 * e nunca reprovam: uma regressão vê-se no registo sem que ninguém tenha de
 * desligar o trabalho.
 *
 * ## Calibrar
 *
 *   DESEMPENHO_CALIBRAR=1 pnpm check:desempenho
 *
 * Imprime o que mediu no formato da tabela `ORCAMENTOS`, para os números serem
 * semeados de uma corrida real com folga em vez de inventados. Em corrida
 * normal imprime a folga de cada rota, para a erosão se ver muito antes de
 * rebentar.
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const EXECUTABLE_PATH = process.env.CHROMIUM_PATH;
const CALIBRAR = process.env.DESEMPENHO_CALIBRAR === '1';

/**
 * O único terceiro autorizado, e só onde faz falta.
 *
 * Os mosaicos do mapa vêm do OpenFreeMap — dados do OpenStreetMap, sem chave e
 * sem conta —, e é a única excepção à regra da casa. Está aqui pelo nome para
 * que acrescentar outra seja uma decisão visível e não um descuido; a mesma
 * lista vive na `connect-src` da CSP, em `apps/web/next.config.ts`.
 */
const MAPA_HOST = 'tiles.openfreemap.org';

/**
 * Tectos, nunca mínimos.
 *
 * Só tectos porque uma compilação sem credenciais serve um catálogo vazio, e o
 * HTML sai muito mais pequeno: um mínimo faria o trabalho reprovar em qualquer
 * fork, que é exactamente o que o `ci.yml` diz que não pode acontecer.
 *
 * O tecto de JavaScript das rotas comuns guarda uma decisão de arquitectura
 * concreta: o MapLibre entra por `next/dynamic` em
 * `src/components/MapaDosEventos.tsx`, e são trezentos quilobytes que só o mapa
 * precisa. Trocá-lo por um import estático rebenta este número — sem ser
 * preciso um teste frágil sobre nomes de pacotes, que em produção vêm com
 * resumo no nome.
 *
 * Os 170 kB são baixos porque medem só o primeiro carregamento da rota.
 * Enquanto isto contava também o pré-carregamento dos vizinhos, o tecto tinha
 * de ser 340 para caber o ruído — e a essa distância já não travava nada.
 *
 * A raiz e o mapa estiveram em 330 e 700, e desceram no dia em que o Zod saiu
 * do navegador: 288 kB e 289 passaram a 144 e 146. O Zod chegava lá pelo
 * barril do `@coreto/core`, importado pelo `lib/format.ts`, que é usado por
 * dois componentes de cliente — ver o cabeçalho desse ficheiro. Foi só trocar
 * o barril pelo `@coreto/core/dates`, e as quatro rotas passaram a medir
 * praticamente o mesmo.
 *
 * O que deu por isto foi a subida do Zod 3 para o 4, no mesmo PR: com o 4 a
 * raiz saltava para 358 kB e o tecto de 330 reprovava-a. Mas o defeito era
 * anterior à subida e custava quase o mesmo — medido: no `main`, ainda com o
 * Zod 3, trocar só o barril pelo `dates` levava a raiz de 288 kB a 144 e o
 * mapa de 289 a 146, os mesmos números que se medem aqui com o Zod 4. Ninguém
 * o via porque os tectos de 330 e 700 tinham sido calibrados por cima dele —
 * é o que acontece a um orçamento semeado de uma medição real sem se perguntar
 * se o que se mediu estava certo.
 */
const ORCAMENTOS = {
  '/': { js: 170, css: 30, html: 250 },
  '/agenda': { js: 170, css: 30, html: 250 },
  '/espacos': { js: 170, css: 30, html: 250 },
  /*
   * O `/levar` está aqui pelo construtor de widget.
   *
   * É a página onde uma coletividade copia o código para embeber a agenda, e
   * o `ConstrutorDeWidget` é um componente de cliente que importa o
   * `lib/widget/opcoes.ts`. Esse ficheiro validava as opções com Zod e deixou
   * de o fazer justamente por isso — sem um tecto aqui, nada travava quem lho
   * voltasse a pôr.
   */
  '/levar': { js: 170, css: 30, html: 250 },
  /*
   * O mapa tem o mesmo tecto que as outras, e isso é uma mudança.
   *
   * Teve 700 enquanto se contava tudo o que passava na rede, para caber o
   * MapLibre. Agora conta-se o que está no HTML, e o MapLibre não está lá: entra
   * por `next/dynamic` depois da hidratação. Fica fora da medição, e um tecto de
   * 700 seria um número que nunca reprovaria nada.
   *
   * A trava que interessa não se perde. Trocar o `next/dynamic` por um import
   * estático punha o MapLibre no HTML de todas as rotas comuns, e são estes
   * 170 kB que o apanham.
   */
  '/mapa': { js: 170, css: 30, html: 250, terceiros: [MAPA_HOST] },
};

/** Um salto de layout acima disto sente-se. Ver `docs/ARQUITETURA.md`. */
const CLS_MAXIMO = 0.02;

/**
 * A ficha de evento — a rota por onde entrou a regressão que este guarda não viu.
 *
 * As cinco rotas de cima são as que existem sempre. A ficha não é nenhuma
 * delas, e foi por aí que entrou em produção um salto de layout de 0,20 sem
 * reprovar nada: o `<img>` do cartaz era `w-auto` dentro de uma grelha
 * centrada, a proporção declarada aplicava-se à caixa do texto alternativo, e
 * a caixa reservada era metade da que a imagem viria a ocupar. O tecto de
 * 0,02 estava escrito aqui desde o princípio e nunca chegou a olhar para a
 * página que mais gente abre.
 *
 * **O endereço não se escreve à mão.** Os slugs são de uma região e mudam com
 * o catálogo; escritos aqui, esta linha era do Médio Tejo e apodrecia na
 * primeira recolha. Descobrem-se do mapa do sítio, como a auditoria de
 * acessibilidade já faz em `scripts/check-a11y.mjs`.
 *
 * **E tem de ser uma ficha com cartaz de medidas declaradas**, que é a que o
 * defeito atingia. Uma ficha sem cartaz não mede coisa nenhuma — passava
 * sempre, e um portão que passa sempre é ruído. Uma ficha com cartaz sem
 * medidas é outra história e ainda não está resolvida: aí a reserva é o
 * `min-h` da moldura, o resto do salto é a diferença entre o reservado e o
 * cartaz, e mede-se 0,16 hoje. Escolher essa aqui seria fazer este guarda
 * reprovar por um defeito que ninguém está a corrigir — e um portão que acusa
 * o que não se pode fechar é um portão que se desliga.
 *
 * Sem base de dados o mapa do sítio vem sem fichas: a rota salta com aviso e
 * o resto da medição segue, que é o que o cabeçalho deste ficheiro exige de
 * uma corrida num fork sem um único segredo. O preço está dito em voz alta:
 * onde não há catálogo, esta rota não é medida.
 *
 * Os tectos de peso são os mesmos das outras rotas, e o que os justifica é
 * uma medição: em produção a ficha traz os mesmos pacotes de JavaScript da
 * agenda — 1% acima — e um HTML que é um quarto do da entrada. O que a traz a
 * esta lista é o salto de layout; o peso vem de borla e fica a guardar o
 * mesmo que guarda nas outras.
 *
 * O `imagensDeTerceiros` é o que torna esta rota mensurável: sem ele, uma
 * ficha com cartaz reprovava sempre a fronteira, porque o cartaz vem do
 * servidor de quem organiza — ver a nota junto ao filtro dos terceiros, mais
 * abaixo. É também a razão de o salto de layout ser aqui uma medida honesta:
 * o cartaz vem mesmo de fora e chega mesmo depois da primeira pintura, que é
 * a situação que a reserva tem de aguentar.
 *
 * E o erro só cai para um lado, que é o que o cabeçalho deste ficheiro exige:
 * uma rede depressa demais pode esconder o salto e deixar passar, mas nunca
 * inventa um que não existe — com a caixa reservada certa mede-se zero em
 * qualquer rede.
 */
const ORCAMENTO_DA_FICHA = { js: 170, css: 30, html: 250, imagensDeTerceiros: true };

/**
 * Quantas fichas se espreitam à procura de uma com cartaz medido.
 *
 * Vinte porque no Médio Tejo cerca de metade das fichas tem cartaz com
 * medidas e o mapa não as ordena por isso: com vinte tentativas a
 * probabilidade de sair de mãos a abanar é remota, e são vinte pedidos a um
 * servidor local antes de a medição começar.
 */
const FICHAS_A_ESPREITAR = 20;

/** O cartaz da ficha, na marcação servida: o único `<img>` com prioridade declarada. */
const CARTAZ = /<img\b[^>]*\bfetchpriority="high"[^>]*>/i;

async function fichaComCartazMedido() {
  let xml = '';
  try {
    const resposta = await fetch(`${BASE_URL}/sitemap.xml`);
    if (resposta.ok) xml = await resposta.text();
  } catch {
    // Sem mapa não há fichas: o aviso a seguir diz o resto.
  }

  const caminhos = [...xml.matchAll(/<loc>[^<]*(\/evento\/[^<]+)<\/loc>/g)].map(
    ([, caminho]) => caminho,
  );
  if (caminhos.length === 0) {
    console.warn('· /evento/… — saltada (o mapa do sítio não trouxe fichas)');
    return null;
  }

  for (const caminho of caminhos.slice(0, FICHAS_A_ESPREITAR)) {
    let html = '';
    try {
      const resposta = await fetch(`${BASE_URL}${caminho}`);
      if (!resposta.ok) continue;
      html = await resposta.text();
    } catch {
      continue;
    }
    const cartaz = html.match(CARTAZ)?.[0];
    if (cartaz && /\bwidth="\d+"/.test(cartaz) && /\bheight="\d+"/.test(cartaz)) return caminho;
  }

  console.warn(
    `· /evento/… — saltada (nenhuma das ${FICHAS_A_ESPREITAR} primeiras fichas traz cartaz com medidas)`,
  );
  return null;
}

const ficha = await fichaComCartazMedido();
if (ficha) ORCAMENTOS[ficha] = ORCAMENTO_DA_FICHA;

const rotas = Object.keys(ORCAMENTOS);

let falhas = 0;
const calibracao = [];

const browser = await chromium.launch(
  EXECUTABLE_PATH ? { executablePath: EXECUTABLE_PATH } : undefined,
);

/**
 * Carrega uma rota e conta o que passou pela rede.
 *
 * Os bytes são os da rede (`responseBodySize`) e não os do corpo já
 * descomprimido: senão o número mudava sozinho no dia em que alguém mexesse na
 * compressão, e um orçamento que se move não trava nada.
 *
 * A recolha é em `requestfinished` e não em `response` porque em `response` o
 * tamanho ainda não está fechado.
 */
async function medir(rota) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  /*
   * O peso é o da rota, e não o dos vizinhos — e sem olhar para o relógio.
   *
   * O Next pré-carrega as rotas para que a página aponta, e essas
   * transferências chegam como `script` iguais às outras. A contá-las, o
   * `/agenda` media 291 kB quando o que ela própria carrega são 146: o número
   * passava a depender de quantas ligações a página tem.
   *
   * A primeira separação foi pelo instante do `load`: contava o que tinha
   * chegado antes dele. Dá o número certo — medida a par com esta, sobre a
   * mesma compilação, sai exactamente o mesmo nas quatro rotas. Mas é uma
   * regra sobre **quando** um pedido chegou, e o pré-carregamento só começa
   * depois do `load` por hábito do router, não por garantia. Um orçamento
   * apertado assente numa corrida é a espécie de número que este ficheiro
   * diz, logo no cabeçalho, que não pode reprovar uma compilação.
   *
   * Por isso o que conta é **o que o servidor escreveu no HTML**, lido do HTML
   * e não do documento já vivo — ver `primeiroCarregamento`. É função da
   * compilação e não do relógio, e o conjunto é o mesmo em qualquer máquina.
   *
   * O que fica de fora: um pacote pedido por `next/dynamic` depois da
   * hidratação não está no HTML e não é contado — é o caso do MapLibre no
   * `/mapa`. A trava que interessa continua a valer, porque um import estático
   * dele apareceria no HTML das rotas comuns e rebentava-lhes o tecto.
   *
   * **Todos os pedidos continuam a ser recolhidos**, e é sobre todos que se
   * verificam os terceiros: um pedido a terceiros feito tarde continua a ser um
   * pedido a terceiros.
   */
  const pedidos = [];
  page.on('requestfinished', (request) => {
    pedidos.push(
      (async () => {
        const resposta = await request.response();
        const tamanhos = await request.sizes().catch(() => ({ responseBodySize: 0 }));
        return {
          url: request.url(),
          tipo: request.resourceType(),
          // Um recurso servido da cache do navegador devolve tamanho negativo.
          bytes: Math.max(0, tamanhos.responseBodySize ?? 0),
          estado: resposta?.status() ?? 0,
        };
      })(),
    );
  });

  // Mede o salto de layout desde a primeira pintura. Injectado antes de
  // qualquer script da página para não perder os saltos iniciais, que são os
  // que se sentem.
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries()) {
        if (!entrada.hadRecentInput) window.__cls += entrada.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  const inicio = Date.now();
  await page.goto(`${BASE_URL}${rota}`, { waitUntil: 'networkidle', timeout: 30_000 });
  const ttfb = Date.now() - inicio;

  const recolhidos = await Promise.all(pedidos);
  const cls = await page.evaluate(() => window.__cls ?? 0);
  const cookies = await context.cookies();
  const guardado = await page.evaluate(() => {
    try {
      return localStorage.length + sessionStorage.length;
    } catch {
      // Um navegador com o armazenamento bloqueado atira ao ler. Não saber
      // quanto lá está não é o mesmo que estar lá alguma coisa.
      return 0;
    }
  });

  await context.close();
  return { recolhidos, cls, cookies, guardado, ttfb };
}

/**
 * O que o servidor escreveu no HTML — lido do HTML, e não do DOM.
 *
 * Ler `document.querySelectorAll('script[src]')` depois do carregamento parece
 * equivalente e não é: durante a espera pela rede o router do Next acrescenta ao
 * documento os pacotes das rotas que pré-carrega, e o conjunto cresce enquanto
 * se olha para ele — que é o mesmo defeito, um passo mais tarde.
 *
 * O HTML servido não cresce. É o mesmo texto para toda a gente, é função da
 * compilação, e é dele que sai o conjunto.
 *
 * **Isto devolve um conjunto de endereços, não um peso.** Quem soma é o
 * `medir`, cruzando este conjunto com o que o navegador chegou mesmo a pedir, e
 * o cruzamento não é uma formalidade: o Next escreve no `<head>` um
 * `<script noModule>` com os polyfills para navegadores antigos, e um navegador
 * com módulos ES nunca o vai buscar. São 40 kB comprimidos que estão no HTML e
 * não viajam. Somar o que aqui está devolvido, sem cruzar, inflaciona a raiz de
 * 144 para 184 kB e mede um navegador que já ninguém usa.
 */
async function primeiroCarregamento(rota) {
  const resposta = await fetch(`${BASE_URL}${rota}`);
  const html = await resposta.text();
  const enderecos = new Set([new URL(rota, BASE_URL).href]);
  for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    enderecos.add(new URL(src, BASE_URL).href);
  }
  for (const [, tag] of html.matchAll(/(<link[^>]+>)/g)) {
    if (!/rel="stylesheet"/.test(tag)) continue;
    const href = tag.match(/href="([^"]+)"/)?.[1];
    if (href) enderecos.add(new URL(href, BASE_URL).href);
  }
  return enderecos;
}

/** Só o carregamento se repete — a asserção, nunca. Um soluço não é uma regressão. */
async function medirComPaciencia(rota) {
  let ultimoErro;
  for (const espera of [0, 2_000, 4_000]) {
    if (espera) await new Promise((resolve) => setTimeout(resolve, espera));
    try {
      return await medir(rota);
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  throw ultimoErro;
}

const origem = new URL(BASE_URL).host;

for (const rota of rotas) {
  const orcamento = ORCAMENTOS[rota];
  const permitidos = new Set([origem, ...(orcamento.terceiros ?? [])]);

  // Aquece antes de medir. `/agenda` não é ISR — lê os parâmetros do endereço e
  // renderiza a cada pedido; o que está em cache é a consulta. O primeiro
  // pedido paga o servidor frio e a cache vazia, e isso são centenas de
  // milissegundos de variância que não dizem nada sobre o código.
  await fetch(`${BASE_URL}${rota}`).catch(() => {});

  const daRota = await primeiroCarregamento(rota);
  const { recolhidos, cls, cookies, guardado, ttfb } = await medirComPaciencia(rota);

  const kb = (bytes) => Math.round(bytes / 1024);
  const somar = (tipos) =>
    kb(
      recolhidos
        .filter((pedido) => daRota.has(pedido.url) && tipos.includes(pedido.tipo))
        .reduce((total, pedido) => total + pedido.bytes, 0),
    );

  const js = somar(['script']);
  const css = somar(['stylesheet']);
  const html = somar(['document']);
  /*
   * O cartaz de quem organiza não é um pedido a terceiros para desenhar a
   * página — é a decisão escrita da casa.
   *
   * As imagens são servidas do servidor de quem as publicou, e isso está
   * decidido em três sítios e dito ao visitante em `/privacidade`. Sem
   * catálogo isto nunca se nota, porque não há uma única imagem para carregar;
   * numa corrida com dados por trás, contar o cartaz da câmara como violação
   * seria fazer este guião reprovar a decisão do projecto em vez de uma
   * regressão. Só se dispensam **imagens**, e só na rota que o declara: um
   * script, uma folha de estilos ou um tipo de letra de fora continua a
   * reprovar em qualquer rota.
   */
  const terceiros = recolhidos.filter(
    (pedido) =>
      !permitidos.has(new URL(pedido.url).host) &&
      !(orcamento.imagensDeTerceiros && pedido.tipo === 'image'),
  );

  if (CALIBRAR) {
    // A ficha mede-se e imprime-se como as outras, mas não entra na tabela
    // para colar: o seu endereço é o de um evento que existia hoje, e colado
    // em `ORCAMENTOS` seria uma rota morta na primeira recolha.
    if (rota !== ficha) {
      calibracao.push(`  '${rota}': { js: ${js}, css: ${css}, html: ${html} },`);
    }
    console.log(`· ${rota} — js ${js} kB, css ${css} kB, html ${html} kB, cls ${cls.toFixed(3)}`);
    continue;
  }

  const problemas = [];

  for (const [nome, medido, tecto] of [
    ['JavaScript', js, orcamento.js],
    ['CSS', css, orcamento.css],
    ['HTML', html, orcamento.html],
  ]) {
    if (medido > tecto) problemas.push(`${nome}: ${medido} kB, o tecto é ${tecto} kB`);
  }

  if (terceiros.length > 0) {
    const hosts = [...new Set(terceiros.map((pedido) => new URL(pedido.url).host))];
    problemas.push(`pedidos a terceiros: ${hosts.join(', ')}`);
  }
  if (cookies.length > 0) {
    problemas.push(`cookies: ${cookies.map((cookie) => cookie.name).join(', ')}`);
  }
  if (guardado > 0) {
    problemas.push(`${guardado} chave(s) guardada(s) no equipamento`);
  }
  if (cls > CLS_MAXIMO) {
    problemas.push(`salto de layout: ${cls.toFixed(3)}, o máximo é ${CLS_MAXIMO}`);
  }

  if (problemas.length === 0) {
    const folga = Math.min(
      ...[
        (1 - js / orcamento.js) * 100,
        (1 - css / orcamento.css) * 100,
        (1 - html / orcamento.html) * 100,
      ],
    );
    console.log(
      `✓ ${rota} — js ${js} kB, css ${css} kB, html ${html} kB (folga ${Math.round(folga)}%)`,
    );
  } else {
    falhas += problemas.length;
    console.error(`✗ ${rota}`);
    for (const problema of problemas) console.error(`   ${problema}`);
  }

  console.log(
    `::notice::${rota} — TTFB ${ttfb} ms, ${recolhidos.length} pedidos, CLS ${cls.toFixed(3)}`,
  );
}

/**
 * E sem JavaScript.
 *
 * A promessa não é «degrada bem»: é que o essencial **funciona**. O que se
 * afirma aqui é o que o público n.º 1 precisa de encontrar numa agenda com o
 * JavaScript desligado — o formulário de filtros, o recolhível que o esconde
 * no telemóvel, e os atalhos de data, que têm de ser ligações e não botões.
 */
if (!CALIBRAR) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/agenda`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  const essenciais = [
    ['formulário de filtros', 'form'],
    ['recolhível dos filtros', 'details > summary'],
    ['atalhos de data', 'nav[aria-label="Atalhos de data"] a[href*="from="]'],
    ['navegação principal', 'nav[aria-label="Principal"]'],
  ];

  for (const [nome, seletor] of essenciais) {
    const encontrados = await page.locator(seletor).count();
    if (encontrados > 0) {
      console.log(`✓ sem JavaScript: ${nome}`);
    } else {
      falhas += 1;
      console.error(`✗ sem JavaScript: ${nome} não existe na página servida`);
    }
  }
  await context.close();
}

await browser.close();

if (CALIBRAR) {
  console.log('\nOrçamentos medidos — arredonda para cima com folga antes de os fixar:\n');
  console.log(calibracao.join('\n'));
  process.exit(0);
}

if (falhas > 0) {
  console.error(`\n${falhas} problema(s).`);
  process.exit(1);
}
console.log('\n✓ peso, fronteiras e degradação dentro do prometido');
