/**
 * As listas do Selo de Usabilidade e Acessibilidade, corridas por máquina.
 *
 * O selo (ARTE, <https://selo.usabilidade.gov.pt/>) exige duas avaliações: uma
 * **automática**, que o `check:a11y` já faz com o axe num navegador verdadeiro,
 * e uma **manual**, feita contra três listas de verificação publicadas. A
 * manual é a que ninguém automatiza — e é por isso que existe.
 *
 * Isto não a substitui. Faz outra coisa, mais modesta e mais útil do que
 * parece: **dos 27 requisitos dos «10 aspetos críticos» e dos 17 da lista
 * «Conteúdo», arranca os que têm resposta objetiva e passa-os a teste.** O que
 * sobra — o que exige teclado, leitor de ecrã e juízo humano — fica escrito em
 * `docs/SELO.md`, requisito a requisito, para quem se sentar a fazê-lo saber
 * exatamente o que falta.
 *
 * A diferença entre um requisito medido aqui e um requisito «verificado uma
 * vez»: este reprova no dia em que alguém o partir, e isso é o que separa uma
 * candidatura de uma promessa.
 *
 * Corre com o sítio já a servir, como o `check:a11y`:
 *
 *   REGIAO_DE_OMISSAO=medio-tejo pnpm --filter @coreto/web build
 *   REGIAO_DE_OMISSAO=medio-tejo pnpm --filter @coreto/web start --port 3000 &
 *   BASE_URL=http://127.0.0.1:3000 pnpm check:selo
 *
 * `CHROMIUM_PATH` aponta um navegador já instalado, pela mesma razão do
 * `check-a11y.mjs`: não descarregar centenas de megabytes para correr isto.
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const EXECUTABLE_PATH = process.env.CHROMIUM_PATH;

/**
 * As rotas públicas que existem sem base de dados.
 *
 * É a mesma família do `check-a11y.mjs` e pela mesma razão: sem credenciais as
 * páginas mostram estados vazios, e o que aqui se mede — tamanhos, níveis de
 * navegação, estrutura — não depende de haver eventos.
 */
const ROTAS = [
  '/',
  '/agenda',
  '/mapa',
  '/espacos',
  '/informacoes',
  '/privacidade',
  '/acessibilidade',
  '/submeter',
  '/fontes',
  '/levar',
  '/estado',
];

/**
 * 12 pontos são 16 píxeis, e 10 pontos são 13,33.
 *
 * A lista «Conteúdo» fala em pontos e o navegador responde em píxeis. A
 * conversão da CSS é fixa — 1pt = 1/72 de polegada, 1px = 1/96 — e é ela que
 * manda aqui. Escreve-se à vista para ninguém ter de a adivinhar.
 */
const PX_POR_PONTO = 96 / 72;
const CORPO_MINIMO = 12 * PX_POR_PONTO; // 16px
const SECUNDARIO_MINIMO = 10 * PX_POR_PONTO; // 13,333…px
const ENTRELINHA_MINIMA = 1.5;

/**
 * Alvos de toque: 44px CSS, na vertical e na horizontal (Conteúdo 5.2).
 *
 * Mede-se com uma folga de meio pixel porque o `getBoundingClientRect` devolve
 * fracionários e um botão de 43,98px não é um defeito de acessibilidade, é
 * arredondamento de renderização.
 */
const ALVO_MINIMO = 44 - 0.5;

let falhas = 0;
let passou = 0;
const porLigar = [];

function afirmar(ok, requisito, detalhe) {
  if (ok) {
    passou += 1;
    console.log(`✓ ${requisito}`);
    return;
  }
  falhas += 1;
  console.log(`✗ ${requisito}`);
  if (detalhe) for (const linha of [].concat(detalhe)) console.log(`    ${linha}`);
}

function registar(requisito, porque) {
  porLigar.push({ requisito, porque });
  console.log(`· ${requisito}`);
  console.log(`    ${porque}`);
}

const navegador = await chromium.launch(EXECUTABLE_PATH ? { executablePath: EXECUTABLE_PATH } : {});

// ---------------------------------------------------------------------------
// Uma passagem por todas as rotas, a recolher tudo de uma vez.
//
// Abrir onze páginas uma vez e medir dez coisas é mais barato — e mais fiável,
// porque todas as medições veem a mesma página — do que abrir onze páginas dez
// vezes.
// ---------------------------------------------------------------------------
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
const pagina = await contexto.newPage();
const recolha = [];

for (const rota of ROTAS) {
  let resposta;
  try {
    resposta = await pagina.goto(BASE_URL + rota, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await pagina.waitForTimeout(400);
  } catch {
    console.log(`· ${rota} — não carregou a tempo, saltada`);
    continue;
  }
  if (!resposta || resposta.status() !== 200) {
    console.log(`· ${rota} — HTTP ${resposta?.status() ?? 'sem resposta'}, saltada`);
    continue;
  }
  recolha.push({
    rota,
    ...(await pagina.evaluate(medirNaPagina, {
      SECUNDARIO_MINIMO,
      ENTRELINHA_MINIMA,
      ALVO_MINIMO,
    })),
  });
}

/**
 * Tudo o que se mede dentro da página, numa função só.
 *
 * Vai serializada para o navegador, por isso não fecha sobre nada de fora: os
 * limiares entram por argumento.
 */
function medirNaPagina({ SECUNDARIO_MINIMO, ENTRELINHA_MINIMA, ALVO_MINIMO }) {
  const textoProprio = (el) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();

  const medida = (el) => {
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const lh = cs.lineHeight === 'normal' ? fs * 1.2 : parseFloat(cs.lineHeight);
    return { fs, racio: lh / fs };
  };

  // --- tipografia ----------------------------------------------------------
  // Só o que é mesmo texto corrido: um elemento com quarenta caracteres de
  // texto próprio. Um `<li>` que só contém outro elemento não é uma linha de
  // texto, e contá-lo dava um número que não quer dizer nada.
  const blocos = [...document.querySelectorAll('main p, main li')].filter(
    (el) => textoProprio(el).length >= 40 && !el.closest('pre, code'),
  );

  const corpo = blocos.map((el) => ({ ...medida(el), texto: textoProprio(el).slice(0, 60) }));

  // --- navegação, por NÍVEL e não por elemento -----------------------------
  // Um `<nav>` pode levar dois níveis: a fila sempre visível e a gaveta que
  // um `<details>` esconde. Contá-los juntos dá um número inflacionado — foi
  // o erro que esta casa quase escreveu num documento, a 15 de setembro de
  // 2026: onze opções contadas onde há cinco e mais sete atrás de um «+».
  const niveis = [];
  for (const nav of document.querySelectorAll('nav')) {
    const rotulo = nav.getAttribute('aria-label') || '(sem rótulo)';
    const primeiro = [...nav.querySelectorAll('a, summary')].filter(
      (e) => e.tagName === 'SUMMARY' || !e.closest('details'),
    );
    niveis.push({ rotulo, nivel: 1, opcoes: primeiro.length });
    [...nav.querySelectorAll('details')].forEach((g, i) =>
      niveis.push({
        rotulo: `${rotulo} → gaveta ${i + 1}`,
        nivel: 2,
        opcoes: g.querySelectorAll('a').length,
      }),
    );
  }

  // --- alvos de toque ------------------------------------------------------
  // Uma ligação dentro de uma frase NÃO é um alvo de toque, e a própria WCAG
  // di-lo (2.5.8, exceção «in a sentence or block of text»). Medir-lhe a altura
  // da linha e chamar-lhe botão pequeno é inventar um defeito — foi o que este
  // guião fez à primeira, e apanhou sete ligações de texto em `/levar`.
  //
  // A regra que os separa: um alvo tem irmãos que não são texto, ou é filho
  // único de um contentor que não é prosa. Uma ligação com texto solto ao lado,
  // dentro de <p> ou <li>, está numa frase.
  const numaFrase = (el) => {
    const pai = el.parentElement;
    if (!pai) return false;
    if (pai.closest('p, li, blockquote, figcaption, dd, dt')) {
      const temTextoAoLado = [...pai.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
      );
      if (temTextoAoLado) return true;
    }
    return ['p', 'li', 'blockquote', 'figcaption', 'dd', 'dt'].includes(pai.tagName.toLowerCase());
  };

  const alvosBlocos = [...document.querySelectorAll('main a, main button, main summary')]
    .filter((el) => !numaFrase(el))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, texto: (el.textContent || '').trim().slice(0, 40) };
    })
    .filter((a) => a.w > 0 && a.h > 0);

  return {
    h1: document.querySelectorAll('h1').length,
    saltosDeTitulo: (() => {
      const n = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => +h.tagName[1]);
      let s = 0;
      for (let i = 1; i < n.length; i++) if (n[i] > n[i - 1] + 1) s++;
      return s;
    })(),
    tabelas: [...document.querySelectorAll('table')].map((t) => ({
      th: !!t.querySelector('th'),
      caption: !!t.querySelector('caption'),
    })),
    // 2.1 fala do «tipo de letra do corpo do documento», no singular: é a
    // omissão da página, não cada parágrafo. Um subtítulo de cartão a 14px é
    // informação secundária, e quem manda nessa é o 2.2 — que põe o chão nos
    // 10 pontos e não nos 12. Medir cada parágrafo contra os 12 punha a casa a
    // reprovar por causa de rótulos, que é reprovar pela razão errada.
    corpoBase: parseFloat(getComputedStyle(document.body).fontSize),
    corpoTotal: corpo.length,
    abaixoDoSecundario: corpo.filter((c) => c.fs < SECUNDARIO_MINIMO - 0.01),
    entrelinhaCurta: corpo.filter((c) => c.racio < ENTRELINHA_MINIMA - 0.01),
    niveis,
    alvosPequenos: alvosBlocos.filter((a) => a.w < ALVO_MINIMO || a.h < ALVO_MINIMO),
    alvosTotal: alvosBlocos.length,
    rodapeComEntidade: /coreto/i.test(document.querySelector('footer')?.textContent ?? ''),
    pdfs: document.querySelectorAll('a[href$=".pdf"]').length,
    campos: [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].map(
      (c) => {
        const id = c.getAttribute('id');
        return {
          etiquetado:
            !!(id && document.querySelector(`label[for=${JSON.stringify(id)}]`)) ||
            !!c.closest('label') ||
            !!c.getAttribute('aria-label') ||
            !!c.getAttribute('aria-labelledby'),
          obrigatorio: c.hasAttribute('required') || c.getAttribute('aria-required') === 'true',
        };
      },
    ),
    media: document.querySelectorAll('video, audio').length,
    modais: document.querySelectorAll('dialog, [role=dialog], [aria-modal=true]').length,
  };
}

console.log('\n— 10 aspetos críticos de acessibilidade funcional —\n');

// 2.1 — um só <h1> por página
{
  const maus = recolha.filter((r) => r.h1 !== 1);
  afirmar(
    maus.length === 0,
    `2.1 · existe um título <h1> marcado na página, e só um (${recolha.length} páginas)`,
    maus.map((m) => `${m.rota}: ${m.h1} <h1>`),
  );
}

// 2.2 — hierarquia sem saltos
{
  const maus = recolha.filter((r) => r.saltosDeTitulo > 0);
  afirmar(
    maus.length === 0,
    '2.2 · a marcação de títulos e subtítulos é hierárquica, sem saltos de nível',
    maus.map((m) => `${m.rota}: ${m.saltosDeTitulo} salto(s)`),
  );
}

// 3.1 e 3.2 — tabelas de dados
{
  const tabelas = recolha.flatMap((r) => r.tabelas.map((t) => ({ ...t, rota: r.rota })));
  if (tabelas.length === 0) {
    registar(
      '3.1 / 3.2 · tabelas de dados',
      'não há uma única <table> nas rotas verificadas: sem objeto',
    );
  } else {
    afirmar(
      tabelas.every((t) => t.th),
      `3.1 · os cabeçalhos das tabelas estão marcados com <th> (${tabelas.length} tabela(s))`,
      tabelas.filter((t) => !t.th).map((t) => `${t.rota}: tabela sem <th>`),
    );
    afirmar(
      tabelas.every((t) => t.caption),
      '3.2 · a legenda da tabela está marcada com <caption>',
      tabelas.filter((t) => !t.caption).map((t) => `${t.rota}: tabela sem <caption>`),
    );
  }
}

// 4.1 — a etiqueta está associada ao campo
{
  const campos = recolha.flatMap((r) => r.campos.map((c) => ({ ...c, rota: r.rota })));
  const semEtiqueta = campos.filter((c) => !c.etiquetado);
  afirmar(
    semEtiqueta.length === 0,
    `4.1 · cada campo de edição tem etiqueta associada (${campos.length} campo(s))`,
    semEtiqueta.map((c) => `${c.rota}: campo sem <label>, aria-label ou aria-labelledby`),
  );
}

// 7 — players
{
  const comMedia = recolha.filter((r) => r.media > 0);
  if (comMedia.length === 0) {
    registar(
      '7.1 / 7.2 · leitores de vídeo e áudio',
      'não há <video> nem <audio> nas rotas verificadas: sem objeto',
    );
  } else {
    registar(
      '7.1 / 7.2 · leitores de vídeo e áudio',
      `há media em ${comMedia.map((r) => r.rota).join(', ')} — verificar à mão`,
    );
  }
}

// 10.1 — PDFs
{
  const comPdf = recolha.filter((r) => r.pdfs > 0);
  if (comPdf.length === 0) {
    registar(
      '10.1 · ficheiros PDF com texto extraível',
      'o sítio não serve um único PDF: sem objeto',
    );
  } else {
    registar(
      '10.1 · ficheiros PDF',
      `há PDF em ${comPdf.map((r) => r.rota).join(', ')} — extrair para TXT e confirmar`,
    );
  }
}

console.log('\n— lista «Conteúdo» —\n');

// 1.4 — a entidade responsável em todas as páginas
{
  const maus = recolha.filter((r) => !r.rodapeComEntidade);
  afirmar(
    maus.length === 0,
    '1.4 · a informação sobre a entidade responsável está em todas as páginas',
    maus.map((m) => `${m.rota}: rodapé sem identificação`),
  );
}

// 2.1 — corpo do documento com 12 pontos no mínimo
{
  const maus = recolha.filter((r) => r.corpoBase < CORPO_MINIMO - 0.01);
  afirmar(
    maus.length === 0,
    `2.1 · o corpo do documento tem, no mínimo, 12 pontos (${CORPO_MINIMO}px)`,
    maus.map((m) => `${m.rota}: corpo a ${m.corpoBase}px`),
  );
}

// 2.2 — informação secundária com 10 pontos no mínimo
{
  const maus = recolha.flatMap((r) => r.abaixoDoSecundario.map((b) => ({ ...b, rota: r.rota })));
  afirmar(
    maus.length === 0,
    `2.2 · nenhum texto corrido abaixo de 10 pontos (${SECUNDARIO_MINIMO.toFixed(2)}px)`,
    maus.slice(0, 6).map((m) => `${m.rota}: ${m.fs}px — «${m.texto}…»`),
  );
}

// 2.4 — entrelinha
{
  const maus = recolha.flatMap((r) => r.entrelinhaCurta.map((b) => ({ ...b, rota: r.rota })));
  afirmar(
    maus.length === 0,
    `2.4 · o espaçamento entre linhas não é inferior a ${ENTRELINHA_MINIMA}x`,
    maus.slice(0, 6).map((m) => `${m.rota}: ${m.racio.toFixed(2)}x — «${m.texto}…»`),
  );
}

// 3.1 — nenhum nível de navegação com mais de 9 opções
{
  const maus = recolha.flatMap((r) =>
    r.niveis.filter((n) => n.opcoes > 9).map((n) => ({ ...n, rota: r.rota })),
  );
  const quantos = recolha[0]?.niveis.length ?? 0;
  afirmar(
    maus.length === 0,
    `3.1 · nenhum nível de navegação tem mais de 9 opções (${quantos} níveis na entrada)`,
    maus.map((m) => `${m.rota}: ${m.opcoes} opções em «${m.rotulo}»`),
  );
}

// 5.2 — alvos de 44px
{
  const maus = recolha.flatMap((r) => r.alvosPequenos.map((a) => ({ ...a, rota: r.rota })));
  const total = recolha.reduce((a, r) => a + r.alvosTotal, 0);
  afirmar(
    maus.length === 0,
    `5.2 · os elementos interativos têm 44px CSS no mínimo (${total} alvos medidos)`,
    maus.slice(0, 8).map((m) => `${m.rota}: ${m.w.toFixed(0)}x${m.h.toFixed(0)}px — «${m.texto}»`),
  );
}

// ---------------------------------------------------------------------------
// Aspeto 8 — o que se vê quando a folha de estilos cai.
//
// Quatro requisitos que se verificam desligando a CSS, e que uma pessoa faz
// com uma extensão do navegador. Aqui tira-se a folha e mede-se o mesmo que
// ela mediria: alinhamento à esquerda, ordem, semântica e informação visível.
// ---------------------------------------------------------------------------
console.log('\n— aspeto 8: a página sem folha de estilos —\n');
{
  const semCss = [];
  for (const rota of ROTAS.slice(0, 6)) {
    // `domcontentloaded` e não `networkidle`: o mapa carrega mosaicos enquanto
    // houver mapa, e esperar por silêncio de rede numa página que nunca se cala
    // é esperar pelo tempo limite. O que aqui se mede é marcação, e a marcação
    // já lá está.
    let resposta;
    try {
      resposta = await pagina.goto(BASE_URL + rota, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } catch {
      console.log(`· ${rota} — não carregou a tempo, saltada`);
      continue;
    }
    if (!resposta || resposta.status() !== 200) continue;
    const r = await pagina.evaluate(() => {
      // 8.4 — a informação que só existe na folha de estilos.
      //
      // Esta verificação errou duas vezes antes de acertar, e as duas ficam
      // escritas porque a próxima pessoa vai ter as mesmas ideias.
      //
      // Primeiro foi um limiar fixo de 200 caracteres. Reprovava `/mapa` por
      // uma razão que nada tem que ver com CSS: sem base de dados a página diz
      // «O mapa ainda não está disponível», que são 152 caracteres legítimos.
      //
      // Depois foi comparar o `innerText` antes e depois. Reprovava `/agenda` e
      // `/espacos`, e também estava errado: o `innerText` depende do desenho, e
      // sem folha de estilos um `<details>` fecha-se e uma sobrancelha deixa de
      // estar em maiúsculas. Medido: o `textContent` de `/agenda` é 678
      // caracteres com folha e 678 sem — **não desapareceu nada**. O que o
      // número dizia era que a página mudou de forma, que é o que se espera.
      //
      // O que 8.4 vigia é outra coisa: informação que **só** existe na CSS —
      // texto em `::before`/`::after`, conteúdo que sai do documento quando a
      // folha sai. É isso que se mede. Um ícone ou uma aspa não são informação;
      // duas palavras seguidas são.
      const palavrasEmPseudo = [];
      for (const el of document.querySelectorAll('main *')) {
        for (const pseudo of ['::before', '::after']) {
          const c = getComputedStyle(el, pseudo).content;
          if (!c || c === 'none' || c === 'normal') continue;
          const texto = c.replace(/^["']|["']$/g, '').trim();
          if (/[\p{L}]{2,}(\s+[\p{L}]{2,})+/u.test(texto)) {
            palavrasEmPseudo.push(`${el.tagName.toLowerCase()}${pseudo}: «${texto.slice(0, 50)}»`);
          }
        }
      }
      const antes = (document.querySelector('main')?.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim().length;
      for (const f of document.querySelectorAll('link[rel=stylesheet], style')) f.remove();
      for (const el of document.querySelectorAll('[style]')) el.removeAttribute('style');
      const corpo = document.body;
      const alinhados = [...corpo.querySelectorAll('main p, main li, main h1, main h2')];
      return {
        naoEsquerda: alinhados.filter(
          (e) => !['start', 'left'].includes(getComputedStyle(e).textAlign),
        ).length,
        semanticos: {
          main: document.querySelectorAll('main').length,
          nav: document.querySelectorAll('nav').length,
          footer: document.querySelectorAll('footer').length,
          listas: document.querySelectorAll('ul, ol').length,
          titulos: document.querySelectorAll('h1,h2,h3').length,
        },
        // 8.4: o texto continua lá. Compara-se com o que estava antes de tirar
        // a folha — se a informação vivia num pseudo-elemento ou numa imagem de
        // fundo, desaparece aqui e o número cai.
        antes,
        depois: (document.querySelector('main')?.textContent ?? '').replace(/\s+/g, ' ').trim()
          .length,
        palavrasEmPseudo,
        tabelasDeMaquetizacao: [...document.querySelectorAll('table')].filter(
          (t) => !t.querySelector('th') && !t.querySelector('caption'),
        ).length,
      };
    });
    semCss.push({ rota, ...r });
  }

  afirmar(
    semCss.every((s) => s.naoEsquerda === 0),
    '8.1 · sem CSS, os elementos alinham à esquerda',
    semCss
      .filter((s) => s.naoEsquerda > 0)
      .map((s) => `${s.rota}: ${s.naoEsquerda} elemento(s) noutro alinhamento`),
  );
  afirmar(
    semCss.every(
      (s) =>
        s.semanticos.main >= 1 &&
        s.semanticos.nav >= 1 &&
        s.semanticos.footer >= 1 &&
        s.semanticos.titulos >= 1,
    ),
    '8.3 · sem CSS, a semântica dos elementos continua a reconhecer-se (marcos, títulos e listas)',
    semCss
      .filter((s) => !(s.semanticos.main >= 1 && s.semanticos.nav >= 1 && s.semanticos.footer >= 1))
      .map((s) => `${s.rota}: ${JSON.stringify(s.semanticos)}`),
  );
  afirmar(
    semCss.every((s) => s.depois >= s.antes * 0.95 && s.palavrasEmPseudo.length === 0),
    '8.4 · sem CSS, a informação permanece — nada vive só na folha de estilos',
    semCss.flatMap((s) => [
      ...(s.depois < s.antes * 0.95
        ? [`${s.rota}: ${s.antes} caracteres no documento, ${s.depois} sem folha`]
        : []),
      ...s.palavrasEmPseudo.map((x) => `${s.rota}: informação num pseudo-elemento — ${x}`),
    ]),
  );
  afirmar(
    semCss.every((s) => s.tabelasDeMaquetizacao === 0),
    '8.5 · a maquetização não recorre ao elemento <table>',
    semCss
      .filter((s) => s.tabelasDeMaquetizacao > 0)
      .map((s) => `${s.rota}: ${s.tabelasDeMaquetizacao} tabela(s) sem <th> nem <caption>`),
  );
  registar(
    '8.2 · sem CSS, a informação aparece numa ordem lógica',
    'a ordem sem folha de estilos É a ordem do documento; que ela seja lógica é juízo de quem lê — ver docs/SELO.md',
  );
}

// ---------------------------------------------------------------------------
// Conteúdo 4.2 — sem varrimento horizontal no telemóvel.
// ---------------------------------------------------------------------------
console.log('\n— lista «Conteúdo», a 320px —\n');
{
  const estreito = await contexto.newPage();
  await estreito.setViewportSize({ width: 320, height: 640 });
  const maus = [];
  for (const rota of ROTAS) {
    let resposta;
    try {
      resposta = await estreito.goto(BASE_URL + rota, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await estreito.waitForTimeout(400);
    } catch {
      continue;
    }
    if (!resposta || resposta.status() !== 200) continue;
    const m = await estreito.evaluate(() => ({
      s: document.documentElement.scrollWidth,
      c: document.documentElement.clientWidth,
    }));
    if (m.s > m.c + 1) maus.push(`${rota}: ${m.s}px de conteúdo em ${m.c}px de ecrã`);
  }
  afirmar(maus.length === 0, '4.2 · o layout é adaptável sem varrimento horizontal (320px)', maus);
  await estreito.close();
}

await contexto.close();
await navegador.close();

// ---------------------------------------------------------------------------
console.log('');
console.log(
  `${passou} requisito(s) confirmados, ${porLigar.length} sem objeto ou por avaliar, ${falhas} a falhar.`,
);
console.log('');
console.log('Os requisitos que exigem teclado, leitor de ecrã e juízo humano não estão aqui');
console.log('e não se podem simular: estão em docs/SELO.md, um a um, com o que fazer.');

if (falhas > 0) {
  console.log('');
  console.log(
    'Um requisito do Selo que passa a falhar é uma candidatura que deixou de ser verdade.',
  );
  process.exit(1);
}
