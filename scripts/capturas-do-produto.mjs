/**
 * As capturas da página do produto, refeitas por guião (C4-005, C1-026).
 *
 *   DEMONSTRACAO=https://demo.coreto.org node scripts/capturas-do-produto.mjs
 *   DEMONSTRACAO=http://demo.localhost:3000 node scripts/capturas-do-produto.mjs
 *
 * As quatro imagens de `apps/web/public/produto/` entraram à mão, a 4 de
 * setembro, e envelheceram como envelhece tudo o que se faz à mão: datas em
 * formato americano (o navegador estava em inglês), a letra de recurso do
 * sistema em vez da do sítio, e a agenda de quatro semanas antes, sem
 * cartazes. Com o guião, refazê-las é um comando, e sai sempre igual:
 *
 * - **em português de Portugal e à hora de Lisboa** — `locale` e `timezoneId`
 *   do contexto, que é o que os campos de data e as horas leem;
 * - **com a letra do sítio** — espera-se por `document.fonts.ready` antes de
 *   cada captura, e só então se fotografa;
 * - **da demonstração, e nunca de um cliente** — a página do produto é
 *   servida a qualquer anfitrião desconhecido, e uma imagem diz o nome, as
 *   terras e a marca tão bem como uma frase (ver `ECRAS`, em
 *   `PaginaDaMontra.tsx`). O endereço vem do ambiente, como o do resto da casa;
 * - **em WebP**, codificado pelo próprio Chromium (`canvas.toDataURL`), sem
 *   dependência nova.
 *
 * As medidas são as que a página declara: 1400 × 875 nas três de secretária,
 * 780 × 1688 no telemóvel (390 × 844 a densidade 2). Quem as mudar aqui muda
 * também os `width` e `height` da página, que é o que impede o salto.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PASTA = join(RAIZ, 'apps', 'web', 'public', 'produto');

const DEMONSTRACAO = process.env.DEMONSTRACAO?.trim().replace(/\/$/, '');
if (!DEMONSTRACAO) {
  console.error(
    'Falta DEMONSTRACAO: o endereço da demonstração, por exemplo https://demo.<domínio>.',
  );
  process.exit(1);
}

const navegador = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  // `*.localhost` resolve para a máquina sem DNS nem `/etc/hosts`; o mapa
  // precisa de WebGL, e num servidor sem placa é o SwiftShader que o desenha.
  args: [
    '--host-resolver-rules=MAP *.localhost 127.0.0.1',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--lang=pt-PT',
  ],
});

/** A captura em WebP, pelo `canvas` do próprio navegador. */
async function emWebp(pagina, png, qualidade = 0.86) {
  const url = await pagina.evaluate(
    async ({ dados, qualidade: q }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${dados}`;
      await img.decode();
      const tela = document.createElement('canvas');
      tela.width = img.naturalWidth;
      tela.height = img.naturalHeight;
      tela.getContext('2d').drawImage(img, 0, 0);
      return tela.toDataURL('image/webp', q);
    },
    { dados: png.toString('base64'), qualidade },
  );
  return Buffer.from(url.split(',')[1], 'base64');
}

async function capturar(
  nome,
  caminho,
  { largura, altura, densidade = 1, telemovel = false, espera = 600 },
) {
  const contexto = await navegador.newContext({
    viewport: { width: largura, height: altura },
    deviceScaleFactor: densidade,
    isMobile: telemovel,
    hasTouch: telemovel,
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const pagina = await contexto.newPage();
  const resposta = await pagina.goto(`${DEMONSTRACAO}${caminho}`, {
    waitUntil: 'networkidle',
    timeout: 90_000,
  });
  if (!resposta?.ok()) throw new Error(`${caminho} respondeu ${resposta?.status()}`);
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForTimeout(espera);
  const png = await pagina.screenshot({ type: 'png' });
  writeFileSync(join(PASTA, `${nome}.webp`), await emWebp(pagina, png));
  await contexto.close();
  console.log(`✓ ${nome}.webp ← ${DEMONSTRACAO}${caminho}`);
}

// A ficha de um evento com cartaz, escolhida pelos dados e não pelo nome: o
// primeiro com imagem que a API da demonstração devolver. Pede-se pelo
// navegador, e não pelo `fetch` do Node, para valer a mesma resolução de
// nomes das capturas — `demo.localhost` não existe fora dele.
const contextoDaLista = await navegador.newContext();
const paginaDaLista = await contextoDaLista.newPage();
await paginaDaLista.goto(`${DEMONSTRACAO}/api/events?limit=30`);
const lista = JSON.parse(await paginaDaLista.evaluate(() => document.body.innerText));
await contextoDaLista.close();
const comCartaz = (lista.events ?? []).find((evento) => evento.image_url && !evento.is_ongoing);
if (!comCartaz) throw new Error('a demonstração não devolveu nenhum evento com cartaz');

await capturar('agenda', '/', { largura: 1400, altura: 875 });
await capturar('mapa', '/mapa', { largura: 1400, altura: 875, espera: 4000 });
await capturar('evento', `/evento/${comCartaz.slug}`, { largura: 1400, altura: 875 });
await capturar('telemovel', '/', {
  largura: 390,
  altura: 844,
  densidade: 2,
  telemovel: true,
});

await navegador.close();
