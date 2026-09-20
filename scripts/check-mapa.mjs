/**
 * O mapa desenha? Uma pergunta que nenhuma outra verificação fazia.
 *
 * O `check:a11y` abre a `/mapa` e passa com um canvas cinzento; o
 * `verificar-regioes.mjs` pede-a por `fetch` e vê um 200. Nenhum dos dois
 * sabe se o MapLibre chegou a pedir um mosaico — e a 19 de setembro de 2026,
 * ao subir para a versão 6, o mapa compilava, respondia 200, passava o axe e
 * nunca desenhava nada, porque o processador não se encontrava a si próprio
 * dentro do bundle (ver `apps/web/scripts/copiar-maplibre.mjs`). O PR do
 * Dependabot com essa versão tinha a bateria toda verde.
 *
 * Isto abre a `/mapa` de uma região com dados num Chromium a sério e exige
 * quatro coisas: o canvas do MapLibre, o processador servido a 200 do nosso
 * lado, pelo menos um mosaico pedido e recebido, e pelo menos uma marca. Se
 * qualquer uma faltar, sai com código 1 e diz qual.
 *
 *   BASE_URL=http://127.0.0.1:3000 node scripts/check-mapa.mjs
 *
 * **Só verifica onde há o que desenhar, e pergunta antes de exigir.** Um mapa
 * de uma região sem eventos mostra o estado vazio, e é assim que tem de ser:
 * a região de prova do CI é deliberadamente «a região no dia zero» — o
 * cabeçalho do seed diz, à letra, «sem eventos: as páginas provam os estados
 * vazios». Apontar esta verificação para lá foi o primeiro erro deste guião, e
 * ele reprovou a dizer «nenhuma marca no mapa» sobre uma região que nunca
 * teria nenhuma. Agora pergunta ao `/api/events` quantos eventos há: com zero,
 * salta com aviso; com eventos, exige o mapa inteiro.
 *
 * Corre no trabalho «Auditorias do sítio», que é o que compila com as
 * credenciais de leitura de produção e por isso serve uma agenda com eventos.
 * Num fork sem esses segredos o catálogo vem vazio e o passo salta, como já
 * saltam as rotas de ficha da auditoria de acessibilidade.
 *
 * O `HOST`, quando dado, é o domínio da região, resolvido para o `BASE_URL`
 * pelo próprio Chromium (`--host-resolver-rules`): é a maneira de o middleware
 * ver o anfitrião certo sem tocar no DNS da máquina.
 */
import { chromium } from 'playwright';

const BASE = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:3000');
const HOST = process.env.HOST ?? BASE.hostname;
const ESPERA_MS = Number(process.env.MAPA_ESPERA_MS ?? 45_000);

/** A página do mapa; muda-se só para ensaiar o guião contra outra rota. */
const CAMINHO = process.env.MAPA_CAMINHO ?? '/mapa';

const alvo = `${BASE.protocol}//${HOST}${BASE.port ? `:${BASE.port}` : ''}${CAMINHO}`;
const ipDaBase = BASE.hostname === 'localhost' ? '127.0.0.1' : BASE.hostname;

/*
 * Há o que desenhar?
 *
 * O mapa desenha eventos com morada conhecida. Perguntar primeiro é o que
 * separa «o mapa está partido» de «esta agenda ainda não tem nada» — e só a
 * primeira é uma falha.
 */
const eventos = await fetch(`${BASE.origin}/api/events?limit=1`, {
  headers: { Host: HOST },
})
  .then((r) => (r.ok ? r.json() : null))
  .then((corpo) => (typeof corpo?.total === 'number' ? corpo.total : null))
  .catch(() => null);

if (eventos === null) {
  console.warn(`· mapa — saltado: ${BASE.origin}/api/events não respondeu com um total.`);
  process.exit(0);
}
if (eventos === 0) {
  console.warn(
    '· mapa — saltado: a agenda não tem eventos, e um mapa sem eventos mostra o estado vazio. Com credenciais de leitura configuradas, esta verificação corre.',
  );
  process.exit(0);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [
    `--host-resolver-rules=MAP ${HOST} ${ipDaBase}`,
    '--use-gl=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    // Só para uma caixa de desenvolvimento atrás de um procurador com a sua
    // própria autoridade de certificação, que o Chromium não conhece: sem
    // isto o estilo e os mosaicos falham no TLS e o ensaio culpa o mapa. No
    // CI não há procurador, e a bandeira nunca está posta.
    ...(process.env.MAPA_IGNORAR_TLS === '1' ? ['--ignore-certificate-errors'] : []),
  ],
});

const falhas = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const respostas = [];
  const pedidosDeMosaicos = [];
  page.on('response', (r) => respostas.push({ status: r.status(), url: r.url() }));
  // Os mosaicos pede-os o processador, não a página: um pedido de mosaico é a
  // prova de que ele arrancou. Conta-se o pedido e não a resposta, porque num
  // executor sem GPU a resposta pode demorar mais do que a espera — e o que se
  // quer saber aqui é se há Worker, não quão depressa o servidor de mosaicos
  // responde.
  // Conta-se nos dois eventos: o Chromium nem sempre anuncia à página o
  // pedido que um Worker fez, mas anuncia-lhe a resposta.
  const anotarMosaico = (url) => {
    if (/\.pbf(\?|$)/.test(url) && !pedidosDeMosaicos.includes(url)) pedidosDeMosaicos.push(url);
  };
  page.on('request', (r) => anotarMosaico(r.url()));
  page.on('response', (r) => anotarMosaico(r.url()));
  page.on('pageerror', (e) => falhas.push(`erro na página: ${e.message}`));

  const abriu = await page
    .goto(alvo, { waitUntil: 'load', timeout: 60_000 })
    .then(() => true)
    .catch((erro) => {
      falhas.push(`não consegui abrir ${alvo}: ${erro.message.split('\n')[0]}`);
      return false;
    });
  if (!abriu) throw new Error('sem página');

  const canvas = await page
    .waitForSelector('canvas.maplibregl-canvas', { timeout: ESPERA_MS })
    .then(() => true)
    .catch(() => false);
  if (!canvas) falhas.push(`sem canvas do MapLibre em ${alvo} ao fim de ${ESPERA_MS} ms`);

  const inicio = Date.now();
  const mosaicos = () => pedidosDeMosaicos.length;
  while (mosaicos() === 0 && Date.now() - inicio < ESPERA_MS) {
    await page.waitForTimeout(500);
  }

  const estilo = respostas.find((r) => /openfreemap\.org\/styles\//.test(r.url));
  if (!estilo || estilo.status !== 200) {
    falhas.push(
      `o estilo do mapa não chegou (${estilo ? `HTTP ${estilo.status}` : 'nunca respondeu'}) — sem estilo não há mosaicos, e a culpa é da rede, não do processador`,
    );
  }
  const processador = respostas.find((r) =>
    /\/maplibre\/[^/]+\/maplibre-gl-worker\.mjs/.test(r.url),
  );
  const partilhado = respostas.find((r) =>
    /\/maplibre\/[^/]+\/maplibre-gl-shared\.mjs/.test(r.url),
  );
  if (!processador || processador.status !== 200) {
    falhas.push(
      `o processador não foi servido do nosso lado (${processador ? `HTTP ${processador.status}` : 'nunca pedido'}) — o MapLibre está a arrancar sem Worker`,
    );
  }
  if (!partilhado || partilhado.status !== 200) {
    falhas.push(
      `o módulo partilhado do processador não foi servido (${partilhado ? `HTTP ${partilhado.status}` : 'nunca pedido'})`,
    );
  }
  if (mosaicos() === 0)
    falhas.push('nenhum mosaico foi pedido: o processador do mapa não arrancou');

  await page.waitForTimeout(1_000);
  const marcas = await page.$$eval('.maplibregl-marker', (els) => els.length);
  if (marcas === 0) {
    falhas.push(`nenhuma marca no mapa, e a agenda tem ${eventos} evento(s) publicados`);
  }

  console.log(
    `mapa em ${alvo}: canvas ${canvas ? 'sim' : 'não'} · processador ${processador?.status ?? '—'} · estilo ${estilo?.status ?? '—'} · mosaicos pedidos ${mosaicos()} · marcas ${marcas}`,
  );
} catch (erro) {
  if (!(erro instanceof Error && erro.message === 'sem página')) {
    falhas.push(`o ensaio rebentou: ${erro instanceof Error ? erro.message : String(erro)}`);
  }
} finally {
  await browser.close();
}

if (falhas.length > 0) {
  console.error('\nO mapa não passa:');
  for (const f of falhas) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('✓ o mapa desenha, com o processador servido por nós');
