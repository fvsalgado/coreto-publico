/**
 * Gera a página do benchmark: prints lado a lado, comparação e plano.
 * Lê estado/benchmark/imagens.json (data URIs) e docs/benchmark/veredictos.json
 * (o texto: veredictos, matriz e plano). Sem bibliotecas. Escreve
 * estado/benchmark/benchmark.html, fora do git por levar prints de terceiros.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/** Tudo o que este script produz vai para `estado/benchmark/`, que o git ignora. */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ESTADO = resolve(RAIZ, 'estado', 'benchmark');

const imagens = JSON.parse(readFileSync(resolve(ESTADO, 'imagens.json'), 'utf8'));
const v = JSON.parse(readFileSync(resolve(RAIZ, 'docs', 'benchmark', 'veredictos.json'), 'utf8'));

const esc = (t) =>
  String(t).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
const md = (t) =>
  esc(t)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

const CSS = `
:root{
  --bg:#F1F2F5;--surface:#FFFFFF;--surface-2:#E9EBF0;--ink:#15181E;--muted:#5C6473;--line:#D6DAE2;
  --accent:#1D4ED8;--accent-ink:#FFFFFF;--good:#1B7F4B;--warn:#B45309;--bad:#B42318;
  --shadow:0 1px 2px rgba(20,24,32,.06),0 8px 24px -12px rgba(20,24,32,.18);
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#0E1014;--surface:#161920;--surface-2:#1E222B;--ink:#E7E9EE;--muted:#98A1B2;--line:#2A2F3A;
  --accent:#7B9BFF;--accent-ink:#0B1020;--good:#4ADE80;--warn:#FBBF24;--bad:#F87171;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -12px rgba(0,0,0,.6);
}}
:root[data-theme="dark"]{
  --bg:#0E1014;--surface:#161920;--surface-2:#1E222B;--ink:#E7E9EE;--muted:#98A1B2;--line:#2A2F3A;
  --accent:#7B9BFF;--accent-ink:#0B1020;--good:#4ADE80;--warn:#FBBF24;--bad:#F87171;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -12px rgba(0,0,0,.6);
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;padding-inline:16px;padding-block:0 64px}
a{color:var(--accent)}
code{font:.85em "IBM Plex Mono",ui-monospace,Menlo,monospace;background:var(--surface-2);padding:.05em .35em;border-radius:4px}
h1,h2,h3{font-family:"Bricolage Grotesque","IBM Plex Sans",system-ui,sans-serif;line-height:1.1;text-wrap:balance;margin:0}
h1{font-size:clamp(2rem,5vw,3.4rem);font-weight:700;letter-spacing:-.02em}
h2{font-size:clamp(1.5rem,3vw,2.1rem);font-weight:600;letter-spacing:-.015em;margin-top:64px}
h3{font-size:1.2rem;font-weight:600}
.wrap{max-width:1120px;margin:0 auto}
.topo{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);margin-inline:-16px;padding:10px 16px}
.topo nav{display:flex;gap:6px 18px;flex-wrap:wrap;max-width:1120px;margin:0 auto;font-size:.9rem}
.topo a{text-decoration:none;color:var(--muted);font-weight:500}
.topo a:hover,.topo a:focus-visible{color:var(--ink)}
.cabeca{padding-block:56px 8px;max-width:760px}
.eyebrow{font:600 .72rem/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:14px}
.lede{font-size:1.15rem;color:var(--muted);max-width:62ch;margin-top:16px}
.resumo{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:28px}
.resumo div{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.resumo b{display:block;font-family:"Bricolage Grotesque",sans-serif;font-size:1.6rem;font-weight:700;letter-spacing:-.02em}
.resumo span{color:var(--muted);font-size:.9rem}
.grupo{margin-top:40px}
.grupo>p{color:var(--muted);max-width:66ch;margin:8px 0 0}
.folha{background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);margin-top:22px;overflow:hidden}
.folha header{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;padding:16px 20px 12px;border-bottom:1px solid var(--line)}
.folha header .tag{font:600 .68rem/1 "IBM Plex Mono",monospace;letter-spacing:.1em;text-transform:uppercase;padding:5px 8px;border-radius:999px;background:var(--surface-2);color:var(--muted)}
.folha header a{font-size:.85rem;color:var(--muted);text-decoration:none;margin-left:auto;overflow-wrap:anywhere}
.prints{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,1.1fr);gap:14px;padding:16px 20px;background:var(--surface-2)}
.prints figure{margin:0;min-width:0}
.prints img{display:block;width:100%;height:auto;border-radius:8px;border:1px solid var(--line);background:#fff}
.prints figcaption{font:.72rem/1.4 "IBM Plex Mono",monospace;color:var(--muted);margin-top:6px;letter-spacing:.04em}
.veredicto{padding:16px 20px 20px;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:16px 28px}
.veredicto p{margin:0;max-width:62ch}
.veredicto ul{margin:0;padding-left:1.1em;color:var(--muted);font-size:.95rem}
.veredicto li{margin:2px 0}
.veredicto .rot{font:600 .7rem/1 "IBM Plex Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.tabela{overflow-x:auto;margin-top:20px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
table{border-collapse:collapse;width:100%;min-width:760px;font-size:.92rem}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{font:600 .72rem/1.3 "IBM Plex Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);background:var(--surface-2);position:sticky;top:0}
td:first-child{font-weight:600}
tr:last-child td{border-bottom:0}
.sim{color:var(--good);font-weight:700}.nao{color:var(--bad);font-weight:700}.meio{color:var(--warn);font-weight:700}
.plano{counter-reset:p;margin-top:20px;display:grid;gap:12px}
.passo{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px 20px 18px 64px;position:relative}
.passo::before{counter-increment:p;content:counter(p);position:absolute;left:18px;top:16px;width:32px;height:32px;border-radius:8px;background:var(--accent);color:var(--accent-ink);font:700 1rem/32px "Bricolage Grotesque",sans-serif;text-align:center}
.passo h3{margin-bottom:6px}
.passo p{margin:6px 0 0;max-width:66ch}
.passo .meta{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font:.75rem/1.4 "IBM Plex Mono",monospace;color:var(--muted)}
.passo .meta .feito{color:var(--good);font-weight:600}
.nota{border-left:3px solid var(--accent);padding:10px 16px;margin-top:20px;color:var(--muted);max-width:66ch}
@media (max-width:760px){.prints,.veredicto{grid-template-columns:1fr}.folha header a{margin-left:0}}
@media (prefers-reduced-motion:no-preference){.folha{transition:transform .2s}}
`;

const grupos = [
  [
    'coreto',
    'O Coreto hoje',
    'A linha de base: a região de demonstração em produção, e a montra do produto.',
  ],
  [
    'pt',
    'Portugal',
    'O que uma câmara ou uma CIM já conhece e com que compara, quer se diga quer não.',
  ],
  [
    'mundo',
    'Pares diretos no mundo',
    'Agendas públicas ou territoriais — o mesmo problema, resolvido por cidades e plataformas.',
  ],
  [
    'ux',
    'Referências de experiência',
    'Não são públicas nem territoriais, mas definem o que um utilizador de telemóvel acha normal em 2026.',
  ],
];

const folha = (s) => {
  const im = imagens[s.id] ?? {};
  return `<article class="folha" id="${esc(s.id)}">
  <header><h3>${esc(s.nome)}</h3><span class="tag">${esc(s.tipo)}</span>${s.pais ? `<span class="tag">${esc(s.pais)}</span>` : ''}<a href="${esc(s.url)}" rel="noopener">${esc(s.url.replace(/^https?:\/\//, ''))}</a></header>
  <div class="prints">
    <figure>${im.desktop ? `<img src="${im.desktop}" alt="${esc(s.nome)} em secretária" loading="lazy">` : '<div style="padding:40px;color:var(--muted)">sem print de secretária</div>'}<figcaption>secretária · 1440 px</figcaption></figure>
    <figure>${im.mobile ? `<img src="${im.mobile}" alt="${esc(s.nome)} em telemóvel" loading="lazy">` : '<div style="padding:40px;color:var(--muted)">sem print de telemóvel</div>'}<figcaption>telemóvel · 390 px</figcaption></figure>
  </div>
  <div class="veredicto">
    <div><div class="rot">O que se vê</div><p>${md(s.veredicto)}</p></div>
    <div><div class="rot">O que o Coreto pode levar</div><ul>${(s.levar ?? []).map((l) => `<li>${md(l)}</li>`).join('')}</ul></div>
  </div>
</article>`;
};

const celula = (x) =>
  x === true
    ? '<span class="sim">●</span>'
    : x === false
      ? '<span class="nao">○</span>'
      : x === 'meio'
        ? '<span class="meio">◐</span>'
        : esc(x ?? '');

const html = `<title>${esc(v.titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>${CSS}</style>
<div class="topo"><nav>${grupos.map(([id, nome]) => `<a href="#g-${id}">${esc(nome)}</a>`).join('')}<a href="#comparacao">Comparação</a><a href="#plano">Plano</a></nav></div>
<div class="wrap">
<header class="cabeca">
  <div class="eyebrow">${esc(v.eyebrow)}</div>
  <h1>${esc(v.titulo)}</h1>
  <p class="lede">${md(v.lede)}</p>
  <div class="resumo">${v.resumo.map((r) => `<div><b>${esc(r.valor)}</b><span>${md(r.rotulo)}</span></div>`).join('')}</div>
</header>
${grupos
  .map(
    ([id, nome, desc]) =>
      `<section class="grupo" id="g-${id}"><h2>${esc(nome)}</h2><p>${md(desc)}</p>${v.sitios
        .filter((s) => s.grupo === id)
        .map(folha)
        .join('')}</section>`,
  )
  .join('')}
<section id="comparacao"><h2>Comparação</h2><p class="lede" style="font-size:1rem">${md(v.comparacaoIntro)}</p>
<div class="tabela"><table><thead><tr><th>Critério</th>${v.matriz.colunas.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
<tbody>${v.matriz.linhas.map((l) => `<tr><td>${md(l.criterio)}</td>${l.valores.map((x) => `<td>${celula(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
<p class="nota">● tem · ◐ em parte · ○ não tem. ${md(v.matriz.nota)}</p></section>
<section id="plano"><h2>Plano de melhorias</h2><p class="lede" style="font-size:1rem">${md(v.planoIntro)}</p>
<div class="plano">${v.plano.map((p) => `<div class="passo"><h3>${md(p.titulo)}</h3><p>${md(p.oque)}</p><p><strong>Porquê:</strong> ${md(p.porque)}</p><div class="meta"><span>esforço · ${esc(p.esforco)}</span><span>onde · ${esc(p.onde)}</span>${p.decisao ? `<span>decisão do dono · ${esc(p.decisao)}</span>` : ''}${p.estado ? `<span class="feito">estado · ${esc(p.estado)}</span>` : ''}</div></div>`).join('')}</div>
${v.fecho ? `<p class="nota">${md(v.fecho)}</p>` : ''}</section>
</div>`;

writeFileSync(resolve(ESTADO, 'benchmark.html'), html);
console.log(`✓ benchmark.html — ${(html.length / 1024 / 1024).toFixed(1)} MB`);
