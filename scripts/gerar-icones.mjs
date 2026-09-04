/**
 * Gera os ícones da aplicação e o cartão de partilha a partir da marca.
 *
 * Os ficheiros que este script escreve estão versionados — um ícone é um
 * artefacto, não se compila a cada pedido —, mas a receita fica aqui para que
 * ninguém tenha de os redesenhar à mão quando a marca ou a cor mudarem. Corre
 * uma vez e escreve tudo:
 *
 *   apps/web/app/favicon.ico              16, 32 e 48 px, o separador do browser
 *   apps/web/app/icon.svg                 o mesmo desenho, sem tamanho
 *   apps/web/app/apple-icon.png           180 px, o ecrã principal do iPhone
 *   apps/web/app/opengraph-image.png      1200 × 630, o cartão de partilha
 *   apps/web/public/icones/coreto-192.png
 *   apps/web/public/icones/coreto-512.png
 *   apps/web/public/icones/coreto-512-mascara.png
 *
 * O desenho vem de `apps/web/src/lib/marca.ts`, que é o mesmo módulo que o
 * `BandstandMark` usa: o ícone no telemóvel é o desenho que está no cabeçalho.
 *
 * O cartão de partilha é feito **contra o sítio a correr**, e não a partir de
 * um HTML solto, porque é assim que ele sai com a letra Fraunces servida por
 * nós, com o grão do papel de cartaz e com as cores lidas dos tokens. Arranca
 * o sítio primeiro:
 *
 *   pnpm build && pnpm --filter @coreto/web start -p 3200
 *   BASE_URL=http://127.0.0.1:3200 node scripts/gerar-icones.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { MARCA_GRELHA, MARCA_TRACOS, MARCA_TRACOS_MIUDOS } from '../apps/web/src/lib/marca.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';

/** O mesmo Chromium que a auditoria de acessibilidade usa. */
const EXECUTABLE_PATH = process.env.CHROMIUM_PATH ?? process.env.PLAYWRIGHT_CHROMIUM_PATH;

/** As duas cores do toldo, escritas aqui porque um PNG não lê tokens CSS. */
const TURQUESA = '#40c0c4';
const TINTA = '#181921';

/*
 * Onde é que a tinta da marca começa e acaba dentro da grelha de 24.
 *
 * O traço tem 1,7 de espessura e sai meio traço para fora do caminho de cada
 * lado, por isso a caixa visível é maior do que a caixa das coordenadas. Sem
 * isto, a marca fica encostada ao lado esquerdo do ícone — e nota-se.
 */
const TINTA_ESQUERDA = 2.5 - 0.85;
const TINTA_DIREITA = 21.5 + 0.85;
const TINTA_TOPO = 1.8 - 0.85;
const TINTA_FUNDO = 20.2 + 0.85;
const TINTA_LARGURA = TINTA_DIREITA - TINTA_ESQUERDA;
const TINTA_ALTURA = TINTA_FUNDO - TINTA_TOPO;
const TINTA_MEIO_X = TINTA_ESQUERDA + TINTA_LARGURA / 2;
const TINTA_MEIO_Y = TINTA_TOPO + TINTA_ALTURA / 2;

/**
 * A marca numa caixa quadrada, centrada e com o fundo pintado.
 *
 * `parte` é quanto do lado do ícone a marca ocupa. Não é gosto: um ícone
 * normal quer folga para não bater nas bordas, e um ícone `maskable` do
 * Android tem de caber numa circunferência com 80% do lado — a diagonal de um
 * quadrado inscrito nessa circunferência dá 56%, e é daí que vem o 0,55.
 */
function svgDaMarca({
  lado,
  parte,
  tracos = MARCA_TRACOS,
  espessura = 1.7,
  fundo = TURQUESA,
  junta = 'round',
}) {
  const escala = (parte * lado) / Math.max(TINTA_LARGURA, TINTA_ALTURA);
  const x = lado / 2 - TINTA_MEIO_X * escala;
  const y = lado / 2 - TINTA_MEIO_Y * escala;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado}" height="${lado}">
  <rect width="${lado}" height="${lado}" fill="${fundo}"/>
  <g transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${escala.toFixed(5)})"
     fill="none" stroke="${TINTA}" stroke-width="${espessura}"
     stroke-linecap="round" stroke-linejoin="${junta}">
${tracos.map((traco) => `    <path d="${traco}"/>`).join('\n')}
  </g>
</svg>
`;
}

/** Rasteriza um SVG ao tamanho exacto, sem margens nem barras. */
async function rasterizar(browser, svg, lado) {
  const pagina = await browser.newPage({ viewport: { width: lado, height: lado } });
  await pagina.setContent(
    `<!doctype html><html><body style="margin:0;line-height:0">${svg}</body></html>`,
  );
  const png = await pagina.screenshot({ clip: { x: 0, y: 0, width: lado, height: lado } });
  await pagina.close();
  return png;
}

/**
 * Os pixéis crus de um SVG, em RGBA, tal como o Chromium os desenha.
 *
 * É o que o `.ico` precisa. O caminho normal — tirar a fotografia em PNG e
 * metê-la lá dentro — parece mais simples e não serve: o Chromium escreve um
 * PNG sem canal alfa quando a imagem é opaca, e o Next recusa-o na compilação
 * («The PNG is not in RGBA format!»). Passar pelo `canvas` dá os quatro canais
 * sempre, e daí sai um `.ico` no formato original, que é o que tudo lê.
 */
async function pixeisDaMarca(browser, svg, lado) {
  const pagina = await browser.newPage({ viewport: { width: lado, height: lado } });
  const dados = await pagina.evaluate(
    async ({ svg, lado }) => {
      const imagem = new Image();
      imagem.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await imagem.decode();
      const tela = document.createElement('canvas');
      tela.width = lado;
      tela.height = lado;
      const pincel = tela.getContext('2d');
      pincel.drawImage(imagem, 0, 0, lado, lado);
      return Array.from(pincel.getImageData(0, 0, lado, lado).data);
    },
    { svg, lado },
  );
  await pagina.close();
  return Buffer.from(dados);
}

/**
 * Um bitmap de 32 bits, no formato que vai dentro de um `.ico`.
 *
 * Três coisas que o formato exige e que se esquecem depressa: a altura no
 * cabeçalho é o **dobro** da imagem, porque contava com uma máscara por baixo;
 * as linhas escrevem-se de baixo para cima; e a ordem dos canais é BGRA e não
 * RGBA. A máscara vai a zeros — com trinta e dois bits quem manda na
 * transparência é o canal alfa —, mas tem de lá estar, com as linhas alinhadas
 * a quatro bytes.
 */
function bitmapParaIco(pixeis, lado) {
  const cabecalho = Buffer.alloc(40);
  cabecalho.writeUInt32LE(40, 0);
  cabecalho.writeInt32LE(lado, 4);
  cabecalho.writeInt32LE(lado * 2, 8);
  cabecalho.writeUInt16LE(1, 12);
  cabecalho.writeUInt16LE(32, 14);

  const cores = Buffer.alloc(lado * lado * 4);
  for (let linha = 0; linha < lado; linha += 1) {
    const origem = (lado - 1 - linha) * lado * 4;
    for (let coluna = 0; coluna < lado; coluna += 1) {
      const de = origem + coluna * 4;
      const para = (linha * lado + coluna) * 4;
      cores[para] = pixeis[de + 2];
      cores[para + 1] = pixeis[de + 1];
      cores[para + 2] = pixeis[de];
      cores[para + 3] = pixeis[de + 3];
    }
  }

  const bytesPorLinhaDaMascara = Math.ceil(lado / 8 / 4) * 4;
  const mascara = Buffer.alloc(bytesPorLinhaDaMascara * lado);

  return Buffer.concat([cabecalho, cores, mascara]);
}

/**
 * Junta vários tamanhos num `.ico`.
 *
 * Seis bytes de cabeçalho, uma entrada de dezasseis por tamanho, e a seguir as
 * imagens. Um lado de 256 escreve-se como zero — não é o caso aqui, mas é a
 * regra do formato e vale a pena não a esquecer.
 */
function empacotarIco(imagens) {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(imagens.length, 4);

  const entradas = [];
  const corpos = [];
  let deslocamento = 6 + imagens.length * 16;

  for (const { lado, pixeis } of imagens) {
    const corpo = bitmapParaIco(pixeis, lado);
    const entrada = Buffer.alloc(16);
    entrada.writeUInt8(lado >= 256 ? 0 : lado, 0);
    entrada.writeUInt8(lado >= 256 ? 0 : lado, 1);
    entrada.writeUInt8(0, 2);
    entrada.writeUInt8(0, 3);
    entrada.writeUInt16LE(1, 4);
    entrada.writeUInt16LE(32, 6);
    entrada.writeUInt32LE(corpo.length, 8);
    entrada.writeUInt32LE(deslocamento, 12);
    entradas.push(entrada);
    corpos.push(corpo);
    deslocamento += corpo.length;
  }

  return Buffer.concat([cabecalho, ...entradas, ...corpos]);
}

/**
 * O cartão que aparece quando alguém partilha uma ligação do Coreto.
 *
 * É desenhado dentro da página real: o CSS do sítio já lá está, com a letra, o
 * grão e os tokens de cor, e é por isso que o cartão sai com a cara da casa em
 * vez de uma imitação. Só se usam estilos escritos à mão e as classes `ct-*`,
 * que existem sempre — uma classe do Tailwind que o sítio não use em lado
 * nenhum não chega a ser gerada, e sairia daqui um cartão sem metade do
 * estilo.
 */
async function cartaoDePartilha(browser) {
  const pagina = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const resposta = await pagina.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
  if (!resposta || !resposta.ok()) {
    throw new Error(
      `O sítio não respondeu em ${BASE_URL}. Arranca-o com \`pnpm --filter @coreto/web start -p 3200\` e aponta o BASE_URL para lá.`,
    );
  }

  // A marca tal como o cabeçalho a desenha — mesma grelha, mesma espessura —,
  // só que grande. Aqui não se centra nada: ela vai numa linha com o nome da
  // casa, e é o alinhamento dessa linha que manda.
  const marca = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARCA_GRELHA} ${MARCA_GRELHA}" width="104" height="104" fill="none" stroke="${TINTA}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${MARCA_TRACOS.map((traco) => `<path d="${traco}"/>`).join('')}</svg>`;

  await pagina.evaluate(
    ({ marca }) => {
      document.documentElement.removeAttribute('data-theme');
      document.body.className = '';
      document.body.style.margin = '0';
      document.body.innerHTML = `
        <div id="cartao" class="ct-grain" style="width:1200px;height:630px;background:var(--color-brand);color:var(--color-on-brand);position:relative;overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;padding:0 86px 40px">
          <div style="position:relative;z-index:3">
            <div style="display:flex;align-items:center;gap:22px">
              ${marca}
              <span style="font-family:var(--font-display);font-weight:600;font-size:92px;letter-spacing:-0.03em;line-height:1">Coreto</span>
            </div>
            <p style="font-family:var(--font-display);font-weight:600;font-size:58px;line-height:1.08;letter-spacing:-0.02em;margin:34px 0 0;max-width:960px">A agenda cultural do Médio Tejo</p>
            <p style="font-size:26px;line-height:1.35;margin:26px 0 0;font-weight:500;max-width:1010px;text-wrap:balance">Abrantes · Alcanena · Constância · Entroncamento · Ferreira do Zêzere · Mação · Ourém · Sardoal · Tomar · Torres Novas · Vila Nova da Barquinha</p>
          </div>
          <div style="position:absolute;left:0;right:0;bottom:0;height:26px;background:var(--color-paper);z-index:1"></div>
          <div class="ct-lambrequim ct-lambrequim-marca" style="position:absolute;left:0;right:0;bottom:4px;height:22px;z-index:2;mask-size:36px 22px;-webkit-mask-size:36px 22px"></div>
        </div>`;
    },
    { marca },
  );

  // `document.fonts.ready` resolve para um objecto que não atravessa a
  // fronteira do browser; o que interessa é esperar, não o que ele devolve.
  await pagina.evaluate(() => document.fonts.ready.then(() => true));
  await pagina.waitForTimeout(300);

  /*
   * Confirmar que o CSS da casa chegou mesmo.
   *
   * Isto já saiu daqui um cartão branco com letra de sistema, e ninguém deu
   * por isso senão a olhar para o ficheiro: uma compilação falhada tinha
   * deixado o `.next` a meio, o servidor continuava a responder 200 e a
   * folha de estilo vinha vazia. Um cartão sem cor nenhuma é indistinguível
   * de um cartão que ainda não foi feito — por isso pergunta-se à página, e
   * rebenta-se aqui em vez de publicar aquilo.
   */
  const conferido = await pagina.evaluate(() => {
    const cartao = document.getElementById('cartao');
    const estilo = getComputedStyle(cartao);
    return {
      fundo: estilo.backgroundColor,
      letra: getComputedStyle(cartao.querySelector('span')).fontFamily,
    };
  });
  if (conferido.fundo !== 'rgb(64, 192, 196)' || !/Fraunces/i.test(conferido.letra)) {
    throw new Error(
      `O sítio respondeu mas veio sem o CSS da casa: fundo ${conferido.fundo}, letra ${conferido.letra}. Compila outra vez (\`pnpm build\`) antes de arrancar o servidor.`,
    );
  }
  const png = await pagina.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await pagina.close();
  return png;
}

async function escrever(caminho, dados) {
  const destino = resolve(RAIZ, caminho);
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, dados);
  console.log(`✓ ${caminho} (${(dados.length / 1024).toFixed(1)} kB)`);
}

const browser = await chromium.launch(EXECUTABLE_PATH ? { executablePath: EXECUTABLE_PATH } : {});

try {
  // O separador do browser: 16 px com a marca miúda, 32 e 48 com a inteira.
  const ico = empacotarIco([
    {
      lado: 16,
      pixeis: await pixeisDaMarca(
        browser,
        // Canto vivo no cume: a dezasseis pixéis, um `stroke-linejoin: round`
        // arredonda o telhado até ele parecer um arco de igreja.
        svgDaMarca({
          lado: 16,
          parte: 0.8,
          tracos: MARCA_TRACOS_MIUDOS,
          espessura: 2.6,
          junta: 'miter',
        }),
        16,
      ),
    },
    { lado: 32, pixeis: await pixeisDaMarca(browser, svgDaMarca({ lado: 32, parte: 0.74 }), 32) },
    { lado: 48, pixeis: await pixeisDaMarca(browser, svgDaMarca({ lado: 48, parte: 0.74 }), 48) },
  ]);
  await escrever('apps/web/app/favicon.ico', ico);

  // O mesmo desenho sem tamanho, para quem o souber ler.
  await escrever(
    'apps/web/app/icon.svg',
    svgDaMarca({ lado: MARCA_GRELHA * 4, parte: 0.74 }).replace(/ width="\d+" height="\d+"/, ''),
  );

  // O ecrã principal do iPhone. Sem transparência, que o iOS não perdoa.
  await escrever(
    'apps/web/app/apple-icon.png',
    await rasterizar(browser, svgDaMarca({ lado: 180, parte: 0.7 }), 180),
  );

  // Os dois tamanhos que o manifesto pede, e a versão para a máscara redonda
  // do Android — essa com a marca mais pequena, para nada ser cortado.
  await escrever(
    'apps/web/public/icones/coreto-192.png',
    await rasterizar(browser, svgDaMarca({ lado: 192, parte: 0.72 }), 192),
  );
  await escrever(
    'apps/web/public/icones/coreto-512.png',
    await rasterizar(browser, svgDaMarca({ lado: 512, parte: 0.72 }), 512),
  );
  await escrever(
    'apps/web/public/icones/coreto-512-mascara.png',
    await rasterizar(browser, svgDaMarca({ lado: 512, parte: 0.55 }), 512),
  );

  await escrever('apps/web/app/opengraph-image.png', await cartaoDePartilha(browser));
} finally {
  await browser.close();
}
