/**
 * Verificação de acessibilidade da área interna, `/admin`.
 *
 * O `check-a11y.mjs` corre em cada CI sobre as páginas públicas e é o que a
 * declaração em `/acessibilidade` promete. O painel fica de fora dessa
 * auditoria por uma razão prática — precisa de sessão, e o CI não tem
 * palavra-passe nenhuma — e não por ser menos obrigado: quem modera a agenda
 * também pode andar de teclado ou de leitor de ecrã, e um painel que se
 * escreveu depressa é onde as falhas se acumulam sem ninguém as ver.
 *
 * Corre-se à mão, contra um `next start` local com a porta de administração
 * configurada e a base de dados de fora. Sem base as consultas falham ou
 * devolvem vazio, e as páginas mostram a estrutura — títulos, marcos,
 * rótulos, contraste, foco — que é o que aqui se verifica. A palavra-passe é
 * a que gerou o `ADMIN_PASSWORD_HASH` do servidor auditado:
 *
 *     ADMIN_PASSWORD_HASH=… ADMIN_SESSION_SECRET=… \
 *     NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
 *     SUPABASE_SERVICE_ROLE_KEY=uma-chave-falsa-com-vinte-caracteres \
 *       pnpm --filter @coreto/web build && pnpm --filter @coreto/web start --port 3998
 *
 *     BASE_URL=http://localhost:3998 ADMIN_PASSWORD=… pnpm check:a11y:admin
 *
 * `localhost` e não `127.0.0.1` de propósito: o `next start` corre em
 * produção e o cookie de sessão sai `Secure`, que o Chromium só aceita por
 * HTTP no nome `localhost`. A chave de serviço tem de ter vinte caracteres
 * ou mais para contar como configurada (ver `src/lib/env.ts`); mais curta,
 * as páginas mostram o estado «falta a chave», que também vale a pena auditar
 * — é uma segunda corrida, com `SUPABASE_SERVICE_ROLE_KEY=dummy`.
 *
 * Não está no CI de propósito. Entrar exige uma palavra-passe, e uma
 * palavra-passe no CI é um segredo a mais para guardar por causa de uma
 * verificação que corre bem à mão antes de cada alteração ao painel.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3998';
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';

/** Um Chromium já instalado, pela razão do `check-a11y.mjs`. */
const EXECUTABLE_PATH = process.env.CHROMIUM_PATH;

/** Onde escrever o resumo em JSON, se se quiser comparar duas corridas. */
const RESULTADOS = process.env.RESULTADOS;

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * As duas larguras e os dois temas. Ao contrário da auditoria pública, o
 * tema escuro corre também no telemóvel: o painel tem tabelas que só rolam
 * na largura pequena, e uma cor que falha numa célula pode só aparecer aí.
 */
const VIEWPORTS = [
  { name: 'telemóvel', width: 360, height: 720, tema: 'light' },
  { name: 'telemóvel escuro', width: 360, height: 720, tema: 'dark' },
  { name: 'secretária', width: 1280, height: 900, tema: 'light' },
  { name: 'secretária escura', width: 1280, height: 900, tema: 'dark' },
];

/**
 * Valores para os segmentos dinâmicos. Sem base nenhum deles existe, e o que
 * se audita é a resposta a um identificador desconhecido — o 404, ou a
 * página de erro do painel.
 */
const AMOSTRAS = {
  'fila/[id]': '00000000-0000-4000-8000-000000000000',
  'regioes/[id]': process.env.REGIAO_DE_OMISSAO?.trim() || 'medio-tejo',
};

/**
 * Estados que só existem com um parâmetro no endereço: os avisos que as
 * ações deixam ao voltar, e as mensagens de um filtro mal escrito.
 */
const VARIANTES = [
  '/admin?aviso=Um+aviso+de+teste',
  '/admin/eventos?aviso=Um+aviso+de+teste&estado=todos',
  '/admin/estatisticas?municipality=nao-existe',
  '/admin/relatorios?mes=nao-e-um-mes',
];

/** As rotas da entrada, auditadas sem sessão — com sessão redirecionam. */
const ROTAS_DE_ENTRADA = ['/admin/entrar', '/admin/entrar?erro=credenciais'];

/**
 * As rotas, lidas do sistema de ficheiros: cada `page.tsx` debaixo de
 * `apps/web/app/admin` é uma. Uma lista escrita à mão ficava para trás na
 * próxima página que alguém acrescentasse ao painel.
 */
function rotasDoPainel() {
  const raiz = new URL('../apps/web/app/admin', import.meta.url).pathname;
  const rotas = [];
  const percorrer = (pasta, segmentos) => {
    for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
      if (entrada.isDirectory()) {
        percorrer(join(pasta, entrada.name), [...segmentos, entrada.name]);
      } else if (entrada.name === 'page.tsx') {
        const caminho = segmentos.join('/');
        if (caminho === 'entrar') continue;
        const amostra = AMOSTRAS[caminho];
        const publico = amostra ? caminho.replace(/\[[^\]]+\]/, amostra) : caminho;
        if (/\[[^\]]+\]/.test(publico)) {
          console.warn(`· /admin/${caminho} — saltada (sem amostra para o segmento dinâmico)`);
          continue;
        }
        rotas.push(publico ? `/admin/${publico}` : '/admin');
      }
    }
  };
  percorrer(raiz, []);
  return rotas.sort();
}

/**
 * Entra pelo formulário verdadeiro e devolve os cookies da sessão. Passa
 * pela mesma Server Action que uma pessoa usa: se a entrada se partir, a
 * auditoria dá por isso em vez de a contornar.
 */
async function entrar(browser) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto('/admin/entrar', { waitUntil: 'domcontentloaded' });
  await page.fill('#password', PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/admin/entrar'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]).catch(() => {});
  const entrou = !new URL(page.url()).pathname.startsWith('/admin/entrar');
  const estado = entrou ? await context.storageState() : null;
  await context.close();
  return estado;
}

const resultados = [];
let failures = 0;

function registar(viewport, rota, status, violations, nota) {
  resultados.push({
    viewport: viewport.name,
    rota,
    status,
    violacoes: violations.length,
    regras: violations.map((v) => v.id),
    nota,
  });
  const sufixo = nota ? ` (${nota})` : '';
  if (violations.length === 0) {
    console.log(`✓ ${viewport.name} ${rota}${sufixo}`);
    return;
  }
  failures += violations.length;
  console.error(`✗ ${viewport.name} ${rota}${sufixo}`);
  for (const violation of violations) {
    console.error(`   [${violation.impact}] ${violation.id}: ${violation.help}`);
    for (const node of violation.nodes.slice(0, 3)) {
      console.error(`     ${node.target.join(' ')}`);
    }
  }
}

async function auditar(page, viewport, rota) {
  let response;
  try {
    response = await page.goto(`${BASE_URL}${rota}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  } catch (error) {
    console.error(`✗ ${viewport.name} ${rota} — não carregou: ${error.message}`);
    failures += 1;
    return;
  }

  const status = response?.status() ?? 0;
  // O que a página é de facto: a página de erro do painel tem um título
  // próprio, e uma rota que caiu nela audita-se como tal, com nota.
  const emErro = (await page.locator('h1', { hasText: 'A ação não foi concluída' }).count()) > 0;
  const nota = emErro ? 'página de erro do painel' : status === 404 ? 'HTTP 404' : '';

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  registar(viewport, rota, status, results.violations, nota);

  // As gavetas: o que só se vê depois de abrir um `<details>`. Abrem-se
  // todas de uma vez e audita-se outra vez — é o único conteúdo do painel
  // que uma volta pelas rotas nunca vê.
  const fechadas = await page.locator('details:not([open])').count();
  if (fechadas > 0) {
    await page.evaluate(() => {
      for (const gaveta of document.querySelectorAll('details')) gaveta.open = true;
    });
    const abertas = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    registar(viewport, rota, status, abertas.violations, 'gavetas abertas');
  }
}

const browser = await chromium.launch(EXECUTABLE_PATH ? { executablePath: EXECUTABLE_PATH } : {});

const sessao = PASSWORD ? await entrar(browser) : null;
if (!sessao) {
  // Duas frases e nenhuma com o nome da variável seguido de dois pontos: um
  // detetor de segredos lê «PASSWORD: …» como uma palavra-passe escrita, e
  // um aviso que se aprende a ignorar é um aviso que um dia esconde um a sério.
  console.warn(
    PASSWORD
      ? '· a entrada falhou — audita-se só a página de entrada'
      : '· sem a palavra-passe de administração no ambiente — audita-se só a página de entrada',
  );
}
const rotas = sessao ? [...rotasDoPainel(), ...VARIANTES] : [];

for (const viewport of VIEWPORTS) {
  const opcoes = {
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: viewport.tema,
  };

  // A entrada, sem sessão.
  const anonimo = await browser.newContext(opcoes);
  const paginaAnonima = await anonimo.newPage();
  for (const rota of ROTAS_DE_ENTRADA) await auditar(paginaAnonima, viewport, rota);
  await anonimo.close();

  if (!sessao) continue;
  const context = await browser.newContext({ ...opcoes, storageState: sessao });
  const page = await context.newPage();
  for (const rota of rotas) await auditar(page, viewport, rota);
  await context.close();
}

await browser.close();

if (RESULTADOS) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(RESULTADOS, JSON.stringify(resultados, null, 2));
}

if (failures > 0) {
  console.error(`\n${failures} problema(s) de acessibilidade no painel.`);
  process.exit(1);
}
console.log('\n✓ sem violações WCAG 2.1 AA nas rotas do painel verificadas');
