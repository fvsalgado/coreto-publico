/**
 * Reduz os prints para a galeria e devolve-os como data URI, num JSON só.
 * Sem ImageMagick nem PIL nesta máquina: o Chromium desenha cada imagem num
 * canvas à largura pedida e exporta JPEG. Secretária a 980 px, telemóvel a 390.
 */
import { chromium } from 'playwright';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/** Tudo o que este script produz vai para `estado/benchmark/`, que o git ignora. */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ESTADO = resolve(RAIZ, 'estado', 'benchmark');

const PASTA = resolve(ESTADO, 'prints');
const LARGURA = { desktop: 980, mobile: 390 };
const QUALIDADE = 0.68;

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');

const saida = {};
let total = 0;
for (const nome of readdirSync(PASTA)
  .filter((f) => f.endsWith('.jpg'))
  .sort()) {
  const [id, vistaExt] = nome.split('--');
  const vista = vistaExt.replace('.jpg', '');
  const original = `data:image/jpeg;base64,${readFileSync(`${PASTA}/${nome}`).toString('base64')}`;
  const dataUri = await page.evaluate(
    async ({ src, largura, q }) => {
      const img = new Image();
      await new Promise((ok, ko) => {
        img.onload = ok;
        img.onerror = ko;
        img.src = src;
      });
      const escala = largura / img.naturalWidth;
      const c = document.getElementById('c');
      c.width = largura;
      c.height = Math.round(img.naturalHeight * escala);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', q);
    },
    { src: original, largura: LARGURA[vista] ?? 980, q: QUALIDADE },
  );
  saida[id] ??= {};
  saida[id][vista] = dataUri;
  total += dataUri.length;
  console.log(`${nome.padEnd(36)} ${(dataUri.length / 1024).toFixed(0).padStart(4)} kB`);
}
await browser.close();
writeFileSync(resolve(ESTADO, 'imagens.json'), JSON.stringify(saida));
console.log(
  `\n${Object.keys(saida).length} sítios · total ${(total / 1024 / 1024).toFixed(1)} MB em imagens.json`,
);
