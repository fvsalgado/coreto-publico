/**
 * Prints de agendas culturais — as melhores do país e do mundo — e do Coreto.
 * Secretária (1440) e telemóvel (390), cada sítio. Tenta fechar faixas de
 * cookies pelas palavras do costume antes de disparar.
 *
 *   node scripts/benchmark/prints.mjs                 # todos
 *   APENAS=fr-lyon,pt-porto node scripts/benchmark/prints.mjs
 *
 * Os prints ficam em `estado/benchmark/prints/`, fora do git: são capturas de
 * sítios de terceiros, tiradas para comparar e não para redistribuir.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/** Tudo o que este script produz vai para `estado/benchmark/`, que o git ignora. */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ESTADO = resolve(RAIZ, 'estado', 'benchmark');

const SAIDA = resolve(ESTADO, 'prints');
mkdirSync(SAIDA, { recursive: true });

const SITIOS = [
  // ---- Coreto ----
  { id: 'coreto-demo-inicio', url: 'https://demo.coreto.org/', grupo: 'coreto' },
  { id: 'coreto-demo-agenda', url: 'https://demo.coreto.org/agenda', grupo: 'coreto' },
  { id: 'coreto-demo-mapa', url: 'https://demo.coreto.org/mapa', grupo: 'coreto' },
  { id: 'coreto-montra', url: 'https://coreto.org/', grupo: 'coreto' },
  // ---- Portugal ----
  { id: 'pt-agendalx', url: 'https://www.agendalx.pt/', grupo: 'pt' },
  { id: 'pt-viralagenda', url: 'https://www.viralagenda.com/pt', grupo: 'pt' },
  { id: 'pt-porto', url: 'https://agenda.porto.pt/', grupo: 'pt' },
  { id: 'pt-timeout-lisboa', url: 'https://www.timeout.pt/lisboa/pt', grupo: 'pt' },
  { id: 'pt-gerador', url: 'https://gerador.eu/agenda/', grupo: 'pt' },
  { id: 'pt-bol', url: 'https://www.bol.pt/', grupo: 'pt' },
  // ---- Mundo: agendas públicas / territoriais (os pares diretos) ----
  {
    id: 'fr-openagenda',
    url: 'https://openagenda.com/fr/jep-2026-centre-val-de-loire',
    grupo: 'mundo',
  },
  { id: 'fr-nantes', url: 'https://metropole.nantes.fr/que-faire-a-nantes/agenda', grupo: 'mundo' },
  { id: 'fr-lyon', url: 'https://www.lyon.fr/agenda', grupo: 'mundo' },
  { id: 'nl-iamsterdam', url: 'https://www.iamsterdam.com/en/whats-on', grupo: 'mundo' },
  { id: 'nl-uitagenda', url: 'https://www.uitagenda.nl/', grupo: 'mundo' },
  { id: 'es-barcelona', url: 'https://guia.barcelona.cat/agenda', grupo: 'mundo' },
  { id: 'es-esmadrid', url: 'https://www.esmadrid.com/agenda-madrid', grupo: 'mundo' },
  {
    id: 'de-visitberlin',
    url: 'https://www.visitberlin.de/en/event-calendar-berlin',
    grupo: 'mundo',
  },
  { id: 'at-wien', url: 'https://www.wien.info/en/now-on', grupo: 'mundo' },
  { id: 'uk-ianvisits', url: 'https://www.ianvisits.co.uk/calendar/', grupo: 'mundo' },
  {
    id: 'ca-montreal',
    url: 'https://www.mtl.org/en/what-to-do/festivals-and-events',
    grupo: 'mundo',
  },
  // ---- Mundo: referências de UX (não são públicas, mas definem a fasquia) ----
  { id: 'ux-dice', url: 'https://dice.fm/browse/lisbon', grupo: 'ux' },
  { id: 'ux-timeout-london', url: 'https://www.timeout.com/london/things-to-do', grupo: 'ux' },
  {
    id: 'ux-songkick',
    url: 'https://www.songkick.com/metro-areas/31399-portugal-lisbon',
    grupo: 'ux',
  },
  { id: 'ux-fever', url: 'https://feverup.com/pt/lisboa', grupo: 'ux' },
];

const VISTAS = [
  { nome: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
  {
    nome: 'mobile',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
];

const PALAVRAS_DE_ACEITAR = [
  'Aceitar todos',
  'Aceitar tudo',
  'Aceitar',
  'Aceito',
  'Concordo',
  'Accept all',
  'Accept All',
  'Accept',
  'I agree',
  'Agree',
  'Tout accepter',
  "J'accepte",
  'Accepter',
  'Alles accepteren',
  'Akkoord',
  'Aceptar todas y cerrar',
  'Acceptar-ho tot',
  'Aceptar todo',
  'Aceptar',
  'Permitir Todos os Cookies',
  'Permitir todos',
  'Allow all',
  'Accepteren',
  'Ja, ik accepteer',
  'Alle akzeptieren',
  'Zustimmen',
  'OK',
  'Got it',
  'Entendi',
];

async function fecharFaixas(page) {
  for (const palavra of PALAVRAS_DE_ACEITAR) {
    try {
      const botao = page
        .getByRole('button', { name: new RegExp(`^\\s*${palavra}\\s*$`, 'i') })
        .first();
      if (await botao.isVisible({ timeout: 400 })) {
        await botao.click({ timeout: 1500 });
        await page.waitForTimeout(600);
        return palavra;
      }
    } catch {
      /* próximo */
    }
  }
  // Faixas dentro de iframes (OneTrust, Didomi, Sourcepoint)
  for (const frame of page.frames()) {
    for (const palavra of PALAVRAS_DE_ACEITAR.slice(0, 12)) {
      try {
        const botao = frame.getByRole('button', { name: new RegExp(palavra, 'i') }).first();
        if (await botao.isVisible({ timeout: 300 })) {
          await botao.click({ timeout: 1500 });
          await page.waitForTimeout(600);
          return `${palavra} (iframe)`;
        }
      } catch {
        /* próximo */
      }
    }
  }
  return null;
}

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  // O Chromium não lê o HTTPS_PROXY do ambiente; há que lho dizer.
  ...(proxy ? { proxy: { server: proxy } } : {}),
});

const resultados = [];
const APENAS = process.env.APENAS ? new Set(process.env.APENAS.split(',')) : null;
for (const sitio of SITIOS.filter((x) => !APENAS || APENAS.has(x.id))) {
  for (const vista of VISTAS) {
    const context = await browser.newContext({
      viewport: vista.viewport,
      isMobile: vista.isMobile,
      deviceScaleFactor: vista.deviceScaleFactor ?? 1,
      userAgent: vista.userAgent,
      locale: 'pt-PT',
      timezoneId: 'Europe/Lisbon',
    });
    const page = await context.newPage();
    const ficheiro = `${SAIDA}/${sitio.id}--${vista.nome}.jpg`;
    let estado = 'ok',
      nota = '';
    try {
      const r = await page.goto(sitio.url, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
      const fechada = await fecharFaixas(page);
      if (fechada) nota = `faixa fechada: ${fechada}`;
      await page.waitForTimeout(1200);
      // Um pequeno scroll e volta, para as imagens preguiçosas acima da dobra carregarem.
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(500);
      await page.mouse.wheel(0, -600);
      await page.waitForTimeout(400);
      await page.screenshot({ path: ficheiro, type: 'jpeg', quality: 72, fullPage: false });
      estado = `${r?.status() ?? '?'}`;
    } catch (e) {
      estado = 'ERRO';
      nota = e.message.split('\n')[0].slice(0, 100);
    }
    resultados.push({ id: sitio.id, vista: vista.nome, estado, nota });
    console.log(`${estado.padEnd(4)} ${sitio.id.padEnd(24)} ${vista.nome.padEnd(8)} ${nota}`);
    await context.close();
  }
}
await browser.close();
const ok = resultados.filter((r) => r.estado !== 'ERRO').length;
console.log(`\n${ok}/${resultados.length} prints tirados em ${SAIDA}`);
