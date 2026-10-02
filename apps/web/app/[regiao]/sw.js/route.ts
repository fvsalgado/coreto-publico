/**
 * O service worker de uma região: sem rede, abre a página «Está sem rede», com
 * o que se guardou neste aparelho (C3-015).
 *
 * A agenda é instalável — tem manifesto, ícones e atalhos —, e sem rede não
 * abria nada: quem abria a aplicação à porta de uma sala de paredes grossas, à
 * procura do concerto que tinha guardado, recebia o dinossauro do navegador.
 *
 * **O que se guarda é a casca e mais nada**, e a razão é a mesma que o
 * manifesto deixou escrita quando recusou um service worker: numa agenda que
 * muda de hora a hora, uma página velha servida como atual engana — uma sessão
 * que já acabou, uma hora que mudou. Por isso nenhuma página da agenda se
 * guarda. Guarda-se uma só, a `/sem-rede`, com os ficheiros de que ela precisa
 * para se desenhar; e é essa que responde a qualquer navegação que falhe. Ela
 * diz que está sem rede, e mostra os guardados, que vivem no `localStorage`
 * deste aparelho com o dia em que foram guardados ao lado — a fotografia que a
 * pessoa tirou, e não uma página que finge estar em dia.
 *
 * **Nada de ninguém fica na cache.** A casca não tem dados pessoais — os
 * guardados não estão nela, estão no armazenamento do navegador, onde sempre
 * estiveram —, e o resto dos pedidos passa ao lado: a API, o painel, os
 * formulários, tudo o que não é uma navegação ou um ficheiro da casca.
 *
 * **Só se instala a quem o pediu** — ver `RegistoSemRede`: a quem guardou um
 * evento, ou a quem instalou a aplicação. É a mesma regra das duas chaves do
 * `localStorage`: nada fica no equipamento de quem visita antes de a pessoa
 * carregar num botão.
 *
 * O código vai como texto, servido desta rota e não de `public/`: um service
 * worker só controla o caminho onde está e os de baixo, e tem de responder em
 * `/sw.js` — a raiz — em cada domínio de região. O middleware reescreve-o para
 * este segmento como reescreve as páginas.
 */

export const dynamic = 'force-static';

/**
 * Muda-se quando a forma da cache mudar: a ativação apaga as caches com
 * outro nome, e uma casca guardada por uma versão anterior deste ficheiro não
 * fica a ocupar espaço para sempre.
 */
const CACHE = 'coreto-sem-rede-1';

const CODIGO = `'use strict';
// Gerado por apps/web/app/[regiao]/sw.js/route.ts — as razões estão lá.
const CACHE = ${JSON.stringify(CACHE)};
const CASCA = '/sem-rede';
const CARIMBO = '/__casca-guardada-em';
// A casca refaz-se, no máximo, uma vez por dia, depois de uma navegação com rede:
// é o que a mantém a par de cada publicação do sítio sem custar um pedido por página.
const UM_DIA = 24 * 60 * 60 * 1000;

const doSitio = (endereco) => endereco.startsWith('/_next/static/');

async function guardarACasca() {
  const resposta = await fetch(CASCA, { cache: 'no-store', credentials: 'same-origin' });
  if (!resposta.ok) return;
  const html = await resposta.clone().text();
  const recursos = new Set();
  for (const achado of html.matchAll(/(?:src|href)="(\\/_next\\/static\\/[^"]+)"/g)) {
    recursos.add(achado[1]);
  }
  const cache = await caches.open(CACHE);
  for (const endereco of [...recursos]) {
    try {
      const ficheiro = await fetch(endereco, { credentials: 'same-origin' });
      if (!ficheiro.ok) continue;
      // As letras vêm do CSS, e não do HTML: sem elas a página sem rede
      // desenhava-se na letra do sistema.
      if (endereco.endsWith('.css')) {
        const css = await ficheiro.clone().text();
        for (const achado of css.matchAll(/url\\((\\/_next\\/static\\/[^)"']+)\\)/g)) {
          if (recursos.has(achado[1])) continue;
          recursos.add(achado[1]);
          const letra = await fetch(achado[1]).catch(() => null);
          if (letra && letra.ok) await cache.put(achado[1], letra);
        }
      }
      await cache.put(endereco, ficheiro);
    } catch (erro) {
      // Um ficheiro que falha não impede os outros: a página desenha-se pior,
      // mas desenha-se.
    }
  }
  await cache.put(CASCA, resposta);
  await cache.put(CARIMBO, new Response(String(Date.now())));
  // O que a casca nova já não usa sai: a cache não cresce de publicação em publicação.
  for (const pedido of await cache.keys()) {
    const caminho = new URL(pedido.url).pathname;
    if (caminho !== CASCA && caminho !== CARIMBO && !recursos.has(caminho)) await cache.delete(pedido);
  }
}

async function cascaVelha() {
  const carimbo = await caches.match(CARIMBO);
  if (!carimbo) return true;
  return Date.now() - Number(await carimbo.text()) > UM_DIA;
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(guardarACasca().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((nome) => nome.startsWith('coreto-') && nome !== CACHE).map((nome) => caches.delete(nome)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const endereco = new URL(pedido.url);
  if (endereco.origin !== self.location.origin) return;

  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((resposta) => {
          evento.waitUntil(cascaVelha().then((velha) => (velha ? guardarACasca() : null)).catch(() => {}));
          return resposta;
        })
        .catch(async () => (await caches.match(CASCA)) || Response.error()),
    );
    return;
  }

  // Os ficheiros da casca, e só esses, saem da cache; tudo o resto vai à rede.
  if (doSitio(endereco.pathname)) {
    evento.respondWith(caches.match(pedido).then((guardado) => guardado || fetch(pedido)));
  }
});
`;

export function GET(): Response {
  return new Response(CODIGO, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // O navegador volta a perguntar por este ficheiro a cada navegação, e é
      // assim que uma versão nova chega; uma cache longa prendia a antiga.
      'Cache-Control': 'no-cache',
      'X-Robots-Tag': 'noindex',
    },
  });
}
