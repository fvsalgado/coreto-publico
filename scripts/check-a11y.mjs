/**
 * Verificação de acessibilidade contra o site a correr.
 *
 * A conformidade WCAG 2.1 AA não é um extra deste projeto: é o que o Decreto-
 * Lei 83/2018 exige a um serviço público. Uma declaração de acessibilidade que
 * ninguém verifica é uma promessa; isto torna-a um teste.
 *
 * Corre com o site já a servir (`pnpm --filter @coreto/web start`) e aponta
 * para ele com BASE_URL. Sem base de dados, as páginas mostram estados vazios
 * — o que se verifica aqui é a estrutura (títulos, marcos, rótulos, texto
 * alternativo, contraste, foco), que é onde vivem quase todas as falhas.
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';

/**
 * Caminho para um Chromium já instalado.
 *
 * Em ambientes onde o navegador vem pré-instalado (contentores de CI, esta
 * caixa de desenvolvimento), a versão do binário raramente coincide com a que
 * o Playwright espera. Apontar-lhe o caminho evita descarregar centenas de
 * megabytes só para correr uma auditoria.
 */
const EXECUTABLE_PATH = process.env.CHROMIUM_PATH;

/**
 * Rotas que existem sempre, com ou sem base de dados por trás.
 *
 * Sem credenciais, as consultas devolvem vazio e as páginas mostram estados
 * vazios — o que se verifica aqui é a estrutura, que é onde vivem quase todas
 * as falhas de acessibilidade.
 *
 * Quatro delas — as de `SECCOES_OPCIONAIS` — deixaram de existir sempre: quem
 * administra liga-as e desliga-as no painel, e desligadas devolvem 404 por
 * desenho. Continuam nesta lista porque na maior parte do tempo estão ligadas
 * e têm de ser auditadas; o que muda é que um 404 nelas é um estado legítimo
 * e não uma falha. Sem isto, a auditoria passava a reprovar de cada vez que
 * alguém desligasse uma secção — e uma verificação que reprova por uma
 * decisão editorial é uma verificação que se aprende a ignorar.
 *
 * `/privacidade` e `/acessibilidade` são o caso contrário: os dois textos
 * legais não se desligam, e um 404 neles é uma falha como outra qualquer.
 */
const ROUTES = [
  '/',
  '/agenda',
  '/agenda?free=1&category=musica',
  '/agenda?q=fado',
  '/mapa',
  '/espacos',
  '/coretos',
  '/ciclos',
  '/informacoes',
  '/privacidade',
  '/acessibilidade',
  '/submeter',
  '/fontes',
  '/levar',
  // O estado não se desliga e não está no mapa do sítio (é `noindex`, por
  // decisão escrita na página): sem esta linha, ficava a única página pública
  // da casa por auditar — e é a que uma CIM abre quando já está aflita.
  '/estado',
  '/nao-existe',
];

/**
 * Os tipos de ficha que a auditoria tem de ver — uma de cada.
 *
 * Já foram endereços escritos à mão («/concelho/tomar», «/espaco/teatro-
 * virginia»), e escritos à mão eram do Médio Tejo: numa instalação com outra
 * região — ou no dia em que um destes identificadores mudasse — a auditoria
 * saltava fichas sem ninguém reparar. Agora descobrem-se do mapa do sítio,
 * que é a lista sempre actual do que existe: a primeira ficha de cada tipo,
 * seja ela de que região for.
 *
 * **A ficha de evento tem de estar aqui.** A declaração de acessibilidade
 * publicada em `/acessibilidade` promete que a auditoria corre
 * «sobre todas as páginas públicas», e a ficha de evento é a página que mais
 * gente abre no sítio inteiro.
 */
const TIPOS_DE_FICHA = ['/concelho/', '/espaco/', '/ciclo/', '/evento/'];

/**
 * As secções que se ligam e desligam no painel.
 *
 * Os identificadores são os mesmos de `apps/web/src/lib/navegacao.ts` e da
 * restrição `site_sections_conhecidas`, na migração 0074. Escritos à mão aqui
 * de propósito: este ficheiro é um script de Node solto, sem passar pelo
 * empacotador, e não importa TypeScript da aplicação. Um teste em
 * `apps/web/src/lib/navegacao.test.ts` guarda que as duas listas coincidem.
 */
const ROTAS_DE_SECCAO = ['/coretos', '/ciclos', '/fontes', '/informacoes'];

/**
 * As rotas de ficha, lidas do `sitemap.xml` — a primeira de cada tipo.
 *
 * Sem base de dados o mapa do sítio vem sem fichas e a lista sai vazia — a
 * auditoria segue e diz o que saltou, tipo a tipo, para uma corrida sem
 * credenciais nunca dar por auditado o que nem chegou a ver.
 */
async function rotasDeFicha() {
  let xml = '';
  try {
    const resposta = await fetch(`${BASE_URL}/sitemap.xml`);
    if (resposta.ok) xml = await resposta.text();
  } catch {
    // Sem mapa não há fichas: a lista vazia diz o resto.
  }

  const rotas = [];
  for (const tipo of TIPOS_DE_FICHA) {
    const padrao = new RegExp(`<loc>[^<]*(${tipo.replaceAll('/', '\\/')}[^<]+)<\\/loc>`);
    const encontrado = xml.match(padrao);
    if (encontrado) {
      rotas.push(encontrado[1]);
    } else {
      console.warn(`· ficha de ${tipo} — saltada (o mapa do sítio não trouxe nenhuma)`);
      skipped += 1;
    }
  }
  return rotas;
}

/**
 * Larguras — e temas — onde o site tem de continuar utilizável.
 *
 * O tema escuro entra aqui porque é uma paleta inteira e não um retoque: são
 * treze cores próprias, e uma delas pode deixar de contrastar sem que nada
 * na clara mude. Passava-se ao lado disso a verificar só o que o browser dá
 * por omissão. Uma passagem chega — o que muda com o tema são as cores, não a
 * estrutura, e essa já vai verificada nas duas larguras.
 */
const VIEWPORTS = [
  { name: 'telemóvel', width: 360, height: 720 },
  { name: 'secretária', width: 1280, height: 900 },
  { name: 'secretária escura', width: 1280, height: 900, tema: 'dark' },
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

let failures = 0;
let skipped = 0;

const DATA_ROUTES = await rotasDeFicha();
const browser = await chromium.launch(EXECUTABLE_PATH ? { executablePath: EXECUTABLE_PATH } : {});

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: viewport.tema ?? 'light',
  });
  const page = await context.newPage();

  for (const route of [...ROUTES, ...DATA_ROUTES]) {
    const url = `${BASE_URL}${route}`;
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      // O sossego da rede é o que se quer esperar, mas não é o que se pode
      // exigir: o mapa pede mosaicos a um servidor de fora, e um servidor de
      // fora lento fazia a auditoria falhar por uma razão que não é dela.
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    } catch (error) {
      console.error(`✗ ${viewport.name} ${route} — não carregou: ${error.message}`);
      failures += 1;
      continue;
    }

    // 404 é legítimo na rota que existe para o ser, na ficha sem dados por
    // trás, e na secção que quem administra desligou.
    const status = response?.status() ?? 0;
    if (status === 404 && DATA_ROUTES.includes(route)) {
      console.warn(`· ${viewport.name} ${route} — saltada (sem dados na base)`);
      skipped += 1;
      continue;
    }
    if (status === 404 && ROTAS_DE_SECCAO.includes(route)) {
      console.warn(`· ${viewport.name} ${route} — saltada (secção desligada no painel)`);
      skipped += 1;
      continue;
    }
    if (status >= 500 || (status === 404 && route !== '/nao-existe')) {
      console.error(`✗ ${viewport.name} ${route} — HTTP ${status}`);
      failures += 1;
      continue;
    }

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    if (results.violations.length === 0) {
      console.log(`✓ ${viewport.name} ${route}`);
      continue;
    }

    failures += results.violations.length;
    console.error(`✗ ${viewport.name} ${route}`);
    for (const violation of results.violations) {
      console.error(`   [${violation.impact}] ${violation.id}: ${violation.help}`);
      for (const node of violation.nodes.slice(0, 3)) {
        console.error(`     ${node.target.join(' ')}`);
      }
    }
  }

  await context.close();
}

/**
 * Estados que só existem depois de alguém tocar em alguma coisa.
 *
 * Uma auditoria que só vê páginas acabadas de abrir dá por boa a parte do
 * sítio que ninguém abriu. A gaveta do «+» da barra de baixo é hoje o único
 * sítio onde o conteúdo aparece por interação — e é, por isso, o único que
 * uma volta pelas rotas nunca veria.
 */
const ESTADOS = [
  {
    nome: 'gaveta do «+»',
    route: '/coretos',
    width: 360,
    height: 720,
    async abrir(page) {
      await page.click('nav[aria-label="Principal"] summary');
      await page.waitForFunction(
        () => document.querySelector('nav[aria-label="Principal"] details')?.open === true,
        { timeout: 5_000 },
      );
    },
  },
  {
    // O painel do mapa só existe depois de se carregar numa marca, e é aí que
    // vive o cabeçalho da ficha e a lista de eventos. Auditar a página em
    // repouso deixava essa metade por verificar.
    nome: 'marca escolhida no mapa',
    route: '/mapa',
    width: 1280,
    height: 900,
    /**
     * Sem base de dados o mapa não tem uma única marca, e não há onde carregar.
     * É o mesmo caso das rotas de ficha: salta-se com aviso, para a auditoria
     * não dar por bom um estado que nem chegou a existir — nem falhar por uma
     * página estar legitimamente vazia.
     */
    async existe(page) {
      return (await page.locator('button[aria-controls="mapa-escolhido"]').count()) > 0;
    },
    async abrir(page) {
      await page.click('button[aria-controls="mapa-escolhido"]');
      await page.waitForFunction(() => document.querySelector('#mapa-escolhido article') !== null, {
        timeout: 5_000,
      });
    },
  },
  {
    /*
     * A ficha de atalho acesa.
     *
     * Não é uma rota nova de propósito: um endereço com datas fixas
     * (`?from=2026-09-11`) apodrecia na lista e passava a auditar uma agenda
     * vazia. Chega-se ao estado como quem lá chega — carregando no atalho — e
     * o que se audita é o par de cores do activo e o `aria-current`, que a
     * volta pelas rotas nunca vê porque em repouso nenhum está aceso.
     */
    nome: 'atalho de data aceso',
    route: '/agenda',
    width: 360,
    height: 720,
    async abrir(page) {
      await page.click('nav[aria-label="Atalhos de data"] a');
      await page.waitForFunction(
        () =>
          document.querySelector('nav[aria-label="Atalhos de data"] [aria-current="page"]') !==
          null,
        { timeout: 5_000 },
      );
    },
  },
];

for (const estado of ESTADOS) {
  const context = await browser.newContext({
    viewport: { width: estado.width, height: estado.height },
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}${estado.route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    if (estado.existe && !(await estado.existe(page))) {
      console.warn(`· estado: ${estado.nome} — saltado (sem dados na base)`);
      skipped += 1;
      await context.close();
      continue;
    }
    await estado.abrir(page);
  } catch (error) {
    console.error(`✗ ${estado.nome} — não abriu: ${error.message}`);
    failures += 1;
    await context.close();
    continue;
  }

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  if (results.violations.length === 0) {
    console.log(`✓ estado: ${estado.nome}`);
  } else {
    failures += results.violations.length;
    console.error(`✗ estado: ${estado.nome}`);
    for (const violation of results.violations) {
      console.error(`   [${violation.impact}] ${violation.id}: ${violation.help}`);
      for (const node of violation.nodes.slice(0, 3)) {
        console.error(`     ${node.target.join(' ')}`);
      }
    }
  }
  await context.close();
}

await browser.close();

if (failures > 0) {
  console.error(`\n${failures} problema(s) de acessibilidade.`);
  process.exit(1);
}
console.log('\n✓ sem violações WCAG 2.1 AA nas rotas verificadas');
if (skipped > 0) {
  console.log(
    `  (${skipped} verificação(ões) saltada(s) por falta de dados — correr com a base ligada para as cobrir)`,
  );
}
