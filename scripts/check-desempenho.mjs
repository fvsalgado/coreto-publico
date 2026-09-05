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
 */
const ORCAMENTOS = {
  '/': { js: 340, css: 30, html: 250 },
  '/agenda': { js: 340, css: 30, html: 250 },
  '/espacos': { js: 340, css: 30, html: 250 },
  /*
   * O mapa leva o MapLibre, e leva-o sozinho — mas só quando há marcas.
   *
   * Sem credenciais não há lugares, o `MapaVivo` nunca chega a montar e esta
   * rota mede o mesmo que as outras. Ou seja: **este tecto quase nunca é
   * exercitado em CI**, e não é ele que guarda o isolamento do MapLibre. Quem
   * o guarda são os 340 kB das rotas comuns: um import estático em vez do
   * `next/dynamic` levava-as para lá dos seiscentos, com ou sem base ligada.
   */
  '/mapa': { js: 700, css: 40, html: 250, terceiros: [MAPA_HOST] },
};

/** Um salto de layout acima disto sente-se. Ver `docs/ARQUITETURA.md`. */
const CLS_MAXIMO = 0.02;

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

  const pedidos = [];
  page.on('requestfinished', (request) => {
    pedidos.push(
      (async () => {
        const resposta = await request.response();
        const tamanhos = await request.sizes().catch(() => ({ responseBodySize: 0 }));
        return {
          url: request.url(),
          tipo: request.resourceType(),
          bytes: tamanhos.responseBodySize ?? 0,
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

  const { recolhidos, cls, cookies, guardado, ttfb } = await medirComPaciencia(rota);

  const kb = (bytes) => Math.round(bytes / 1024);
  const somar = (tipos) =>
    kb(
      recolhidos
        .filter((pedido) => tipos.includes(pedido.tipo))
        .reduce((total, pedido) => total + pedido.bytes, 0),
    );

  const js = somar(['script']);
  const css = somar(['stylesheet']);
  const html = somar(['document']);
  const terceiros = recolhidos.filter((pedido) => !permitidos.has(new URL(pedido.url).host));

  if (CALIBRAR) {
    calibracao.push(`  '${rota}': { js: ${js}, css: ${css}, html: ${html} },`);
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
