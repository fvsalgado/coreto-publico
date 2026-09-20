/**
 * Põe o processador do MapLibre em `public/`, na versão que está instalada.
 *
 * Desde a versão 6 o `maplibre-gl` deixou de ser um ficheiro só: o trabalho
 * pesado do mapa corre num Web Worker que vive num módulo à parte
 * (`maplibre-gl-worker.mjs`), que por sua vez importa `maplibre-gl-shared.mjs`
 * ao lado. A biblioteca descobre onde eles estão pelo `import.meta.url` do
 * módulo principal — e dentro de um bundle do Next esse endereço não é um
 * `https://…`, por isso a biblioteca devolve uma cadeia vazia, o navegador
 * resolve `new URL('', página)` para a própria página, e o mapa arranca com o
 * HTML da página como processador. Não há erro na consola. Há um canvas
 * cinzento que nunca pede um mosaico. Medido a 19 de setembro de 2026, num
 * Chromium, contra a compilação de produção.
 *
 * A saída é dizer à biblioteca onde está o processador (`setWorkerUrl`, em
 * `MapaVivo.tsx`) e garantir que ele está lá: os dois ficheiros copiados para
 * `public/maplibre/<versão>/`, tal como saem do pacote, sem os passar pelo
 * empacotador — que os trataria como recursos soltos e partia o `import`
 * relativo entre eles (foi o que aconteceu ao deixá-lo tentar).
 *
 * **A versão está no caminho** de propósito. Sem ela, um navegador com o
 * processador antigo em cache falava com um módulo principal novo, e os dois
 * lados de um Worker que não são da mesma versão falham de maneiras que não
 * dizem porquê. Com ela, o caminho muda quando a versão muda, a cache antiga
 * nunca é pedida, e o `next.config.ts` pode marcar a pasta como imutável.
 *
 * Corre no `postinstall`, antes do `build` e antes do `dev`, e é idempotente:
 * copia a versão instalada e apaga as outras. Um teste
 * (`MapaVivo.worker.test.ts`) recusa uma cópia que não bata byte a byte com o
 * pacote — é o que apanha um `pnpm add maplibre-gl@…` sem voltar a correr isto.
 */
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pacote = require.resolve('maplibre-gl/package.json');
const { version } = JSON.parse(readFileSync(pacote, 'utf8'));
const dist = join(dirname(pacote), 'dist');

export const FICHEIROS_DO_PROCESSADOR = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

const raizDaWeb = join(dirname(fileURLToPath(import.meta.url)), '..');
const pasta = join(raizDaWeb, 'public', 'maplibre');
const destino = join(pasta, version);

mkdirSync(destino, { recursive: true });
for (const nome of FICHEIROS_DO_PROCESSADOR) copyFileSync(join(dist, nome), join(destino, nome));

for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
  if (entrada.isDirectory() && entrada.name !== version) {
    rmSync(join(pasta, entrada.name), { recursive: true, force: true });
  }
}

if (process.env.CI !== '1' || process.env.RUNNER_DEBUG === '1') {
  console.log(`maplibre-gl ${version}: processador copiado para public/maplibre/${version}/`);
}
