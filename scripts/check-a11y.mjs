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
 * A montra, que vive noutro anfitrião e por isso precisa de outra base.
 *
 * As quatro páginas do domínio do produto — a ficha, a política de segurança, o
 * cartão de visita da recolha e os preços — **nunca foram auditadas aqui**, e a
 * razão é de arquitetura e não de esquecimento: o trabalho de auditoria arranca
 * o sítio com `REGIAO_DE_OMISSAO`, e com essa variável posta **todos** os
 * anfitriões desconhecidos são servidos com a agenda dessa região. A montra
 * deixa de existir no processo. Pedir por `127.0.0.1` trazia a agenda do Médio
 * Tejo com outro nome.
 *
 * O que a torna alcançável é um segundo servidor, sem essa variável, e um
 * anfitrião que o mapa de domínios não conheça — `coreto.localhost`, que o
 * Chromium resolve sempre para a interface local (RFC 6761) sem precisar de
 * DNS, de `/etc/hosts` ou de um cabeçalho `Host` à mão, que aliás o Chromium
 * recusa pôr.
 *
 * Sem `BASE_URL_MONTRA` não se audita e diz-se: uma volta que salta as páginas
 * públicas em silêncio é uma volta que dá o sítio por auditado quando não está,
 * e a declaração de `/acessibilidade` promete que a auditoria corre «sobre
 * todas as páginas públicas».
 */
const BASE_MONTRA = process.env.BASE_URL_MONTRA?.trim() || null;

/**
 * As páginas do domínio do produto.
 *
 * Não se desligam no painel e não são de região nenhuma: ou estão nesta lista,
 * ou não são auditadas por nada.
 */
const ROTAS_DA_MONTRA = ['/', '/fontes', '/seguranca'];

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
  // A ficha técnica dos indicadores, pela mesma razão do estado: não se
  // desliga, é `noindex` por decisão escrita, e por isso não está no mapa do
  // sítio. A declaração publicada em `/acessibilidade` promete que a auditoria
  // corre «sobre todas as páginas públicas» — uma página fora desta lista
  // transforma essa frase em falsa sem ninguém dar por ela.
  '/indicadores',
  /*
   * A página que pede a senha de uma região tapada (0157).
   *
   * Só existe quando a região tem barreira ligada — nas outras é 404, e é
   * assim que sai desta lista sem ninguém mexer nela (ver `ROTAS_CONDICIONAIS`
   * abaixo). Entra aqui pela razão que o `/estado` e os `/indicadores` já
   * trouxeram: é uma página pública, não está no mapa do sítio (é `noindex`,
   * de propósito), e a declaração de `/acessibilidade` promete a auditoria
   * «sobre todas as páginas públicas». E é uma página que alguém encontra num
   * mau dia — a primeira e única coisa que vê de uma agenda inteira.
   */
  '/portao',
  // E o estado que se vê depois de escrever a senha errada: é o único sítio
  // da página com um `role="alert"` e com a cor de aviso, que é onde um
  // contraste fraco costuma estar.
  '/portao?erro=errada',
  '/nao-existe',
];

/**
 * As rotas que só existem em certos estados da instalação, e cujo 404 não é
 * defeito nenhum.
 *
 * É a mesma manobra das secções desligadas, para uma condição diferente: uma
 * instalação sem nenhuma região tapada não tem `/portao` nenhum, e o CI é
 * sempre uma dessas — a migração 0157 garante que nenhuma região nasce com a
 * barreira ligada.
 */
const ROTAS_CONDICIONAIS = ['/portao', '/portao?erro=errada'];

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

/*
 * As etiquetas, e o que elas conseguem mesmo provar.
 *
 * A 2.2 entra aqui a 20 de setembro de 2026. Vale a pena não ficar com a ideia
 * errada do que esta linha comprou: dos **seis** critérios novos da 2.2 ao
 * nível A/AA, o axe só sabe testar **um** — o 2.5.8 (Target Size), pela regra
 * `target-size`. Os outros cinco não são automatizáveis e estão na lista de
 * verificação manual do `docs/SELO.md`, com quem os verificou e quando.
 *
 * Ligar a etiqueta sem escrever isto ao lado seria a pior das duas hipóteses:
 * um verde novo a parecer que cobre seis coisas quando cobre uma.
 *
 * A 2.2 também **remove** o 4.1.1 (Parsing), por obsoleto. Não há nada a fazer
 * com isso: as etiquetas da 2.0 e 2.1 continuam aqui porque o DL n.º 83/2018
 * remete para a norma europeia, e é a 2.1 AA que ela hoje exige.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

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
    if (status === 404 && ROTAS_CONDICIONAIS.includes(route)) {
      console.warn(`· ${viewport.name} ${route} — saltada (não há barreira ligada nesta região)`);
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

// ---- A montra, no seu anfitrião ----

if (BASE_MONTRA === null) {
  console.warn(
    `· as ${ROTAS_DA_MONTRA.length} páginas do domínio do produto — saltadas (sem BASE_URL_MONTRA)`,
  );
  console.warn(
    '    Ver o comentário de BASE_MONTRA: precisam de um servidor sem REGIAO_DE_OMISSAO.',
  );
  skipped += ROTAS_DA_MONTRA.length * VIEWPORTS.length;
} else {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: viewport.tema ?? 'light',
    });
    const page = await context.newPage();

    for (const route of ROTAS_DA_MONTRA) {
      const url = `${BASE_MONTRA}${route}`;
      let response;
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      } catch (error) {
        console.error(`✗ montra ${viewport.name} ${route} — não carregou: ${error.message}`);
        failures += 1;
        continue;
      }

      /*
       * Aqui um 404 nunca é legítimo, e é uma diferença que vale a pena.
       *
       * Na volta de cima há rotas que podem não existir — uma secção desligada
       * no painel, uma ficha sem dados. Estas quatro páginas são estáticas, não
       * tocam na base e não se desligam em lado nenhum: um 404 quer dizer que a
       * `CAMINHOS_DA_MONTRA` do middleware não conhece o caminho, e o sintoma
       * disso não é um erro — é a agenda de uma região a responder no domínio
       * do produto, ou o contrário.
       */
      const status = response?.status() ?? 0;
      if (status !== 200) {
        console.error(`✗ montra ${viewport.name} ${route} — HTTP ${status}`);
        failures += 1;
        continue;
      }

      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      if (results.violations.length === 0) {
        console.log(`✓ montra ${viewport.name} ${route}`);
        continue;
      }

      failures += results.violations.length;
      console.error(`✗ montra ${viewport.name} ${route}`);
      for (const violation of results.violations) {
        console.error(`   [${violation.impact}] ${violation.id}: ${violation.help}`);
        for (const node of violation.nodes.slice(0, 3)) {
          console.error(`     ${node.target.join(' ')}`);
        }
      }
    }

    await context.close();
  }
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
    /*
     * O nome da barra de baixo está aqui por extenso, e isso já custou uma
     * corrida vermelha.
     *
     * As duas navegações principais — a do cabeçalho e a barra ao alcance do
     * polegar — chamavam-se ambas «Principal», e quem navega por landmarks
     * ouvia duas iguais. Ao desempatá-las, a da barra passou a «Principal, no
     * fundo do ecrã» e este seletor ficou a casar com a do cabeçalho, que não
     * tem gaveta: o clique esperou trinta segundos por um `summary` que nunca
     * ia existir.
     *
     * Fica o nome completo em vez de um prefixo: um seletor que casasse com
     * as duas voltava a apanhar a errada, e é precisamente essa ambiguidade
     * que se acabou de tirar do sítio.
     */
    async abrir(page) {
      const gaveta = 'nav[aria-label="Principal, no fundo do ecrã"]';
      await page.click(`${gaveta} summary`);
      await page.waitForFunction(
        (seletor) => document.querySelector(`${seletor} details`)?.open === true,
        gaveta,
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

// ---- 2.4.11: o foco não pode ficar debaixo da barra do polegar ----

/*
 * O critério que nenhuma ferramenta testa, e que esta casa tinha por cumprir.
 *
 * A `BarraInferior` é `fixed bottom-0` no telemóvel. Quando se navega por
 * teclado numa página longa, o navegador leva o elemento focado até à margem
 * do ecrã — que é exatamente onde a barra está por cima. O 2.4.11 da WCAG 2.2
 * (AA) exige que o elemento focado não fique **inteiramente** tapado por
 * conteúdo do autor. A correção é o `scroll-padding-block-end` do
 * `globals.css`; isto é a guarda dela.
 *
 * **Duas verificações, e a primeira é a que vale.** Percorrer a página com
 * Tab e ver se algum elemento calha debaixo da barra é um teste que depende de
 * onde o Tab calha parar — a primeira versão deste bloco fazia isso, passava a
 * verde numa compilação sem a correção, e teria deixado a regressão passar. O
 * que se mede primeiro é o **mecanismo**: o `scroll-padding` do documento tem
 * de ser pelo menos tão alto quanto a barra. Isso é determinístico, não tem
 * onde se esconder, e reprova no instante em que alguém mudar a altura de uma
 * sem mudar a outra. A varredura do foco vem a seguir como confirmação, e é
 * exaustiva — todos os focáveis, um `focus()` de cada vez — em vez de sessenta
 * Tabs à sorte.
 *
 * **`reducedMotion: 'reduce'` não é detalhe.** O `globals.css` tem
 * `scroll-behavior: smooth`, e com ela a leitura logo a seguir ao foco apanha a
 * animação a meio: o elemento aparece com coordenadas negativas, fora da
 * janela, e um teste que salte esses casos salta precisamente os que
 * interessam. O mesmo ficheiro converte movimento reduzido em
 * `scroll-behavior: auto`, e aí a posição lida é a definitiva.
 *
 * A barra encontra-se por `[data-barra-inferior]` e não por classes: procurá-la
 * por `.fixed.bottom-0` apanhava o véu que ela abre por cima da página, que
 * também é `fixed`, e a «barra» saía com 1798px de altura.
 */
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const ROTA = '/agenda';

  try {
    await page.goto(`${BASE_URL}${ROTA}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const medida = await page.evaluate(() => {
      const barra = document.querySelector('[data-barra-inferior]');
      if (!barra) return { semBarra: true };

      const alturaDaBarra = barra.getBoundingClientRect().height;
      const folga = getComputedStyle(document.documentElement).scrollPaddingBottom;
      const folgaEmPx = folga.endsWith('px') ? Number.parseFloat(folga) : 0;

      const seletor =
        'a[href],button:not([disabled]),input:not([type="hidden"]):not([disabled]),select,textarea,summary,[tabindex]:not([tabindex="-1"])';
      const alvos = [...document.querySelectorAll(seletor)].filter((e) => !barra.contains(e));

      let medidos = 0;
      const tapados = [];
      for (const alvo of alvos) {
        alvo.focus();
        if (document.activeElement !== alvo) continue;
        const f = alvo.getBoundingClientRect();
        const b = barra.getBoundingClientRect();
        if (!f.width || !f.height) continue;
        medidos += 1;
        if (f.top >= b.top && f.bottom <= b.bottom) {
          tapados.push(
            `${alvo.tagName.toLowerCase()} «${(alvo.textContent ?? '').trim().slice(0, 32)}» em ${Math.round(f.top)}–${Math.round(f.bottom)}`,
          );
        }
      }
      return { semBarra: false, alturaDaBarra, folga, folgaEmPx, medidos, tapados };
    });

    if (medida.semBarra) {
      console.warn(`· 2.4.11 ${ROTA} — saltado (não há barra fixa nesta página)`);
      skipped += 1;
    } else {
      // 1. O mecanismo.
      if (medida.folgaEmPx + 0.5 < medida.alturaDaBarra) {
        failures += 1;
        console.error(
          `✗ 2.4.11 ${ROTA} — o scroll-padding do documento (${medida.folga}) é menor do que a barra (${Math.round(medida.alturaDaBarra)}px)`,
        );
        console.error('     Ver scroll-padding-block-end em app/globals.css.');
      } else {
        console.log(
          `✓ 2.4.11 ${ROTA} — scroll-padding ${medida.folga} ≥ barra ${Math.round(medida.alturaDaBarra)}px`,
        );
      }

      // 2. A confirmação, sobre todos os focáveis da página.
      if (medida.medidos === 0) {
        console.warn(`· 2.4.11 ${ROTA} — varredura inconclusiva (nenhum focável mensurável)`);
        skipped += 1;
      } else if (medida.tapados.length > 0) {
        failures += medida.tapados.length;
        console.error(
          `✗ 2.4.11 ${ROTA} — ${medida.tapados.length} de ${medida.medidos} focáveis ficam tapados ao receber o foco`,
        );
        for (const t of medida.tapados.slice(0, 5)) console.error(`     ${t}`);
      } else {
        console.log(
          `✓ 2.4.11 ${ROTA} — ${medida.medidos} focáveis, nenhum tapado ao receber o foco`,
        );
      }
    }
  } catch (error) {
    console.error(`✗ 2.4.11 ${ROTA} — não correu: ${error.message}`);
    failures += 1;
  }

  await context.close();
}

// ---- O primeiro evento à vista: programação antes de controlos ----

/*
 * Não é um critério da WCAG; é a promessa que o benchmark de 20/09/2026
 * apanhou por cumprir. A agenda mostrava um parágrafo, três atalhos, um
 * formulário inteiro e a contagem antes do primeiro cartão: em secretária o
 * cartão começava a 820 px de um ecrã de 900, e no telemóvel a 615 de 844,
 * com a barra de baixo a tapar-lhe o fundo. Todas as agendas com que o Coreto
 * se compara mostram um evento no primeiro ecrã.
 *
 * O que se mede é se o primeiro `[data-cartao-de-evento]` **cabe inteiro** no
 * primeiro ecrã, nas duas larguras — do topo dele ao fundo, acima da barra
 * fixa quando a há. É a promessa na forma em que se vê: quem abre a agenda vê
 * um evento completo sem rolar. Dá para o cabeçalho, o título, as filas de
 * pílulas e o resumo dos filtros; não dá para o formulário aberto. Sem
 * cartão nenhum — uma corrida sem dados — salta-se e diz-se.
 */
{
  const ROTA = '/agenda';
  for (const vp of [
    { nome: 'telemóvel', width: 390, height: 844 },
    { nome: 'secretária', width: 1280, height: 900 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}${ROTA}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      const medida = await page.evaluate(() => {
        const cartao = document.querySelector('[data-cartao-de-evento]');
        if (!cartao) return null;
        const caixa = cartao.getBoundingClientRect();
        const barra = document.querySelector('[data-barra-inferior]');
        const alturaDaBarra = barra ? barra.getBoundingClientRect().height : 0;
        // A barra é `sm:hidden`: em secretária está no documento com 0 px.
        const limite = window.innerHeight - alturaDaBarra;
        return { topo: caixa.top, fundo: caixa.bottom, limite, janela: window.innerHeight };
      });
      if (!medida) {
        console.warn(`· primeiro evento ${vp.nome} ${ROTA} — saltado (sem cartões na agenda)`);
        skipped += 1;
      } else if (medida.fundo > medida.limite) {
        failures += 1;
        console.error(
          `✗ primeiro evento ${vp.nome} ${ROTA} — o primeiro cartão vai de ${Math.round(medida.topo)} a ${Math.round(medida.fundo)}px e o primeiro ecrã acaba aos ${Math.round(medida.limite)}px`,
        );
      } else {
        console.log(
          `✓ primeiro evento ${vp.nome} ${ROTA} — o primeiro cartão cabe inteiro (${Math.round(medida.topo)}–${Math.round(medida.fundo)}px de ${Math.round(medida.limite)})`,
        );
      }
    } catch (error) {
      console.error(`✗ primeiro evento ${vp.nome} ${ROTA} — não correu: ${error.message}`);
      failures += 1;
    }
    await context.close();
  }
}

await browser.close();

if (failures > 0) {
  console.error(`\n${failures} problema(s) de acessibilidade.`);
  process.exit(1);
}
console.log(
  '\n✓ sem violações WCAG 2.1 AA (e 2.2 AA na parte automatizável) nas rotas verificadas',
);
if (skipped > 0) {
  console.log(
    `  (${skipped} verificação(ões) saltada(s) por falta de dados — correr com a base ligada para as cobrir)`,
  );
}
