/**
 * Gera `docs/regioes/medio-tejo/INVENTARIO.md` — o retrato da base, escrito pela própria base.
 *
 * Há dois documentos sobre dados neste repositório e não fazem a mesma coisa:
 * o `FONTES.md` é o levantamento do que **existe lá fora** e o `PLANO-DADOS.md`
 * é o plano do que se recolhe. Faltava o terceiro, que é o mais simples de
 * todos e o único que não se pode escrever à mão: **o que está lá dentro,
 * hoje**.
 *
 * À mão envelhecia em duas horas e mentia em três. Por isso não se escreve:
 * corre-se.
 *
 *   node scripts/gerar-inventario.mjs
 *
 * Lê `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do ambiente
 * ou de `apps/web/.env.local`, e escreve `docs/regioes/medio-tejo/INVENTARIO.md`.
 *
 * ## Porquê a chave pública, e não a de serviço
 *
 * De propósito. Tudo o que este documento diz é coisa que o sítio já publica —
 * e assim qualquer pessoa com a chave pública o pode voltar a gerar e conferir
 * linha a linha. Um inventário que só o dono consegue reproduzir não é um
 * inventário, é um boato.
 *
 * O preço é que fica de fora o que é de trabalho e não é público: as notas de
 * sondagem dos espaços, os contactos, as filas de moderação, o registo das
 * recolhas, os alias. Esses vivem no painel e nas migrações, e é onde devem
 * estar. As colunas pedidas são as mesmas que a aplicação pede em
 * `apps/web/src/lib/queries/fields.ts` — pedir uma a mais faz o PostgREST
 * recusar o pedido inteiro.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Credenciais
// ---------------------------------------------------------------------------

function lerAmbiente() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const ficheiro = join(RAIZ, 'apps/web/.env.local');
  if ((!url || !chave) && existsSync(ficheiro)) {
    for (const linha of readFileSync(ficheiro, 'utf8').split('\n')) {
      const par = /^([A-Z0-9_]+)=(.*)$/.exec(linha.trim());
      if (!par) continue;
      const valor = par[2].replace(/^["']|["']$/g, '');
      if (par[1] === 'NEXT_PUBLIC_SUPABASE_URL') url ??= valor;
      if (par[1] === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') chave ??= valor;
    }
  }

  if (!url || !chave) {
    throw new Error(
      'Sem credenciais: define NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY, ' +
        'ou deixa-as em apps/web/.env.local.',
    );
  }
  return { url: url.replace(/\/$/, ''), chave };
}

const { url: BASE, chave: CHAVE } = lerAmbiente();

/**
 * Uma tabela inteira, às páginas.
 *
 * O PostgREST devolve mil linhas de cada vez e não avisa que cortou. Pedir sem
 * paginar dava um inventário silenciosamente incompleto — que é a única coisa
 * pior do que não ter inventário nenhum.
 */
async function buscar(tabela, colunas, ordem) {
  const linhas = [];
  const passo = 1000;
  for (let inicio = 0; ; inicio += passo) {
    const query = new URLSearchParams({ select: colunas });
    if (ordem) query.set('order', ordem);
    const resposta = await fetch(`${BASE}/rest/v1/${tabela}?${query}`, {
      headers: {
        apikey: CHAVE,
        Authorization: `Bearer ${CHAVE}`,
        Range: `${inicio}-${inicio + passo - 1}`,
      },
    });
    if (!resposta.ok) {
      throw new Error(`${tabela}: ${resposta.status} ${await resposta.text()}`);
    }
    const bloco = await resposta.json();
    linhas.push(...bloco);
    if (bloco.length < passo) return linhas;
  }
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

const CANTO = '—';
const texto = (v) => (v === null || v === undefined || v === '' ? CANTO : String(v));
const sim = (v) => (v ? 'sim' : CANTO);
const escapar = (v) => texto(v).replace(/\|/g, '\\|').replace(/\n+/g, ' ');

function tabela(cabecalhos, linhas) {
  if (linhas.length === 0) return '_(nenhum)_\n';
  const cabecalho = `| ${cabecalhos.join(' | ')} |`;
  const risca = `| ${cabecalhos.map(() => '---').join(' | ')} |`;
  const corpo = linhas.map((l) => `| ${l.map(escapar).join(' | ')} |`);
  return [cabecalho, risca, ...corpo].join('\n') + '\n';
}

function contar(lista, chave) {
  const conta = new Map();
  for (const item of lista) {
    const k = chave(item) ?? CANTO;
    conta.set(k, (conta.get(k) ?? 0) + 1);
  }
  return [...conta.entries()].sort(
    (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt'),
  );
}

const percentagem = (parte, total) =>
  total === 0 ? CANTO : `${Math.round((parte / total) * 100)} %`;

const DIA = (v) => (v ? String(v).slice(0, 10) : CANTO);

const ESPECIE_DE_ESPACO = {
  theatre: 'teatro',
  cinema: 'cinema',
  library: 'biblioteca',
  museum: 'museu',
  gallery: 'galeria',
  auditorium: 'auditório',
  cultural_centre: 'centro cultural',
  bandstand: 'coreto',
  heritage: 'património',
  market: 'mercado',
  outdoor: 'ar livre',
  association: 'associação',
  religious: 'religioso',
  education: 'ensino',
  other: 'outro',
};

const ESPECIE_DE_FONTE = {
  municipal_site: 'sítio municipal',
  venue_site: 'sítio de equipamento',
  pdf_agenda: 'agenda em PDF',
};

// ---------------------------------------------------------------------------

const hoje = new Date().toISOString().slice(0, 10);

const [concelhos, categorias, espacos, fontes, coretos, ciclos, eventos, sessoes, seccoes] =
  await Promise.all([
    buscar('municipalities', 'id, name', 'name'),
    buscar('categories', 'slug, name, description', 'name'),
    buscar(
      'venues',
      'id, name, municipality_id, parish, kind, status, is_association, address, latitude, longitude, website_url, wheelchair_accessible, image_url, description',
      'name',
    ),
    buscar(
      'sources',
      'id, name, kind, municipality_id, venue_id, url, is_enabled, last_success_at, public_note',
      'name',
    ),
    buscar(
      'coretos',
      'id, name, parish, municipality_id, latitude, longitude, year_built, is_confirmed, venue_id, photo_url, description',
      'name',
    ),
    buscar('series', 'id, name, description', 'name'),
    buscar(
      'events',
      'id, slug, title, status, municipality_id, venue_id, location_name, category_slug, date_start, date_end, is_free, image_url, description_short',
      'date_start',
    ),
    buscar('event_sessions', 'event_id, session_date', 'session_date'),
    buscar('site_sections', 'id, is_enabled', 'id'),
  ]);

const nomeDoConcelho = new Map(concelhos.map((c) => [c.id, c.name]));
const nomeDaCategoria = new Map(categorias.map((c) => [c.slug, c.name]));
const nomeDoEspaco = new Map(espacos.map((e) => [e.id, e.name]));

const publicados = eventos.filter((e) => e.status === 'published');
const porAcontecer = publicados.filter((e) => (e.date_end ?? e.date_start ?? '') >= hoje);

const secoes = [];
const escreve = (s) => secoes.push(s);

// ---------------------------------------------------------------------------
escreve(`# Inventário — o que a base tem, a ${hoje}

> **Este ficheiro é gerado.** Não se edita à mão: corre-se
> \`node scripts/gerar-inventario.mjs\`, que o volta a escrever a partir da base
> de produção. Um inventário escrito à mão envelhece em duas horas e mente em
> três.

Tudo o que está aqui é lido pela **chave pública** — a mesma com que o sítio
serve as páginas. É de propósito: assim qualquer pessoa o pode voltar a gerar e
conferir linha a linha. O que é de trabalho e não é público — as notas de
sondagem, os contactos, as filas de moderação, o registo das recolhas, os
alias — não entra aqui, e vive no painel e nas migrações.

Os outros dois documentos de dados respondem a outras perguntas:
[\`FONTES.md\`](FONTES.md) é o levantamento do que **existe lá fora**;
[\`PLANO-DADOS.md\`](PLANO-DADOS.md) é o plano do que se **vai** recolher. Este
é o que **está cá dentro**.

## Num relance

| | |
| --- | --- |
| concelhos cobertos | **${concelhos.length}** |
| eventos publicados | **${publicados.length}**, dos quais ${porAcontecer.length} por acontecer ou a decorrer |
| sessões datadas | ${sessoes.length} |
| espaços no catálogo | **${espacos.length}** |
| fontes registadas | **${fontes.length}**, das quais ${fontes.filter((f) => f.is_enabled).length} ligadas |
| coretos levantados | ${coretos.length}, ${coretos.filter((c) => c.is_confirmed).length} confirmados |
| ciclos e festivais | ${ciclos.length} |
| categorias | ${categorias.length} |
`);

// ---------------------------------------------------------------------------
escreve(`## Os onze concelhos

Uma linha por concelho, com o que a base tem de cada um.
`);

escreve(
  tabela(
    ['Concelho', 'Eventos publicados', 'Por acontecer', 'Espaços', 'Fontes ligadas', 'Coretos'],
    concelhos.map((c) => [
      c.name,
      publicados.filter((e) => e.municipality_id === c.id).length,
      porAcontecer.filter((e) => e.municipality_id === c.id).length,
      espacos.filter((v) => v.municipality_id === c.id).length,
      fontes.filter((f) => f.municipality_id === c.id && f.is_enabled).length,
      coretos.filter((k) => k.municipality_id === c.id).length,
    ]),
  ),
);

const regionais = fontes.filter((f) => f.municipality_id === null);
escreve(`
E **${regionais.length} fontes sem concelho próprio**, porque cobrem a região
inteira: ${regionais.map((f) => f.name).join(', ')}.
`);

// ---------------------------------------------------------------------------
escreve(`## Fontes

De onde vêm os eventos. Uma fonte é um endereço que a recolha lê todas as
noites, com um adaptador que sabe ler aquele formato.
`);

const ligadas = fontes.filter((f) => f.is_enabled);
const desligadas = fontes.filter((f) => !f.is_enabled);

escreve(`### As ${ligadas.length} que estão ligadas
`);
escreve(
  tabela(
    ['Fonte', 'Espécie', 'Concelho', 'Espaço', 'Último êxito'],
    ligadas.map((f) => [
      f.name,
      ESPECIE_DE_FONTE[f.kind] ?? f.kind,
      f.municipality_id ? nomeDoConcelho.get(f.municipality_id) : 'região',
      f.venue_id ? (nomeDoEspaco.get(f.venue_id) ?? f.venue_id) : CANTO,
      DIA(f.last_success_at),
    ]),
  ),
);

escreve(`
### As ${desligadas.length} que estão desligadas, e porquê

Uma fonte desligada não é uma fonte partida: é um endereço que foi sondado e
não deu. A razão fica escrita para ninguém repetir o trabalho.
`);
escreve(
  tabela(
    ['Fonte', 'Espécie', 'Concelho', 'Razão'],
    desligadas.map((f) => [
      f.name,
      ESPECIE_DE_FONTE[f.kind] ?? f.kind,
      f.municipality_id ? nomeDoConcelho.get(f.municipality_id) : 'região',
      f.public_note,
    ]),
  ),
);

// ---------------------------------------------------------------------------
escreve(`## Espaços

O catálogo das casas da cultura da região. Um espaço entra quando um evento
prova que existe, ou quando um levantamento o encontra — e cada campo é
preenchido de fonte primária ou fica vazio.

### Quantos, e do quê
`);
escreve(
  tabela(
    ['Espécie', 'Quantos'],
    contar(espacos, (v) => ESPECIE_DE_ESPACO[v.kind] ?? v.kind),
  ),
);

const comCoordenada = espacos.filter((v) => v.latitude !== null).length;
const comMorada = espacos.filter((v) => v.address).length;
const comFoto = espacos.filter((v) => v.image_url).length;
const comDescricao = espacos.filter((v) => v.description).length;
const comSitio = espacos.filter((v) => v.website_url).length;
const comAcesso = espacos.filter((v) => v.wheelchair_accessible !== null).length;

escreve(`
### O que está preenchido
`);
escreve(
  tabela(
    ['Campo', 'Preenchidos', 'De', 'Cobertura'],
    [
      ['descrição', comDescricao, espacos.length, percentagem(comDescricao, espacos.length)],
      ['morada', comMorada, espacos.length, percentagem(comMorada, espacos.length)],
      ['coordenadas', comCoordenada, espacos.length, percentagem(comCoordenada, espacos.length)],
      ['sítio próprio', comSitio, espacos.length, percentagem(comSitio, espacos.length)],
      ['fotografia', comFoto, espacos.length, percentagem(comFoto, espacos.length)],
      ['acessibilidade', comAcesso, espacos.length, percentagem(comAcesso, espacos.length)],
    ],
  ),
);

escreve(`
### Todos, um a um
`);
for (const c of concelhos) {
  const meus = espacos.filter((v) => v.municipality_id === c.id);
  if (meus.length === 0) continue;
  escreve(`
#### ${c.name} — ${meus.length}
`);
  escreve(
    tabela(
      ['Espaço', 'Espécie', 'Freguesia', 'Morada', 'No mapa', 'Foto', 'Sítio'],
      meus.map((v) => [
        v.name,
        ESPECIE_DE_ESPACO[v.kind] ?? v.kind,
        texto(v.parish),
        texto(v.address),
        sim(v.latitude !== null),
        sim(v.image_url),
        v.website_url ? `[abrir](${v.website_url})` : CANTO,
      ]),
    ),
  );
}

// ---------------------------------------------------------------------------
escreve(`## A agenda

### Por categoria
`);
escreve(
  tabela(
    ['Categoria', 'Publicados', 'Por acontecer'],
    contar(publicados, (e) =>
      e.category_slug ? nomeDaCategoria.get(e.category_slug) : 'sem categoria',
    ).map(([nome, n]) => [
      nome,
      n,
      porAcontecer.filter(
        (e) => (e.category_slug ? nomeDaCategoria.get(e.category_slug) : 'sem categoria') === nome,
      ).length,
    ]),
  ),
);

escreve(`
### Por mês
`);
escreve(
  tabela(
    ['Mês', 'Eventos'],
    contar(publicados, (e) => (e.date_start ? String(e.date_start).slice(0, 7) : CANTO)).sort(
      (a, b) => String(a[0]).localeCompare(String(b[0])),
    ),
  ),
);

const comEspaco = publicados.filter((e) => e.venue_id).length;
const comCartaz = publicados.filter((e) => e.image_url).length;
const comResumo = publicados.filter((e) => e.description_short).length;
const comCategoria = publicados.filter((e) => e.category_slug).length;
const gratuitos = publicados.filter((e) => e.is_free === true).length;

escreve(`
### Qualidade do que está publicado
`);
escreve(
  tabela(
    ['Campo', 'Preenchidos', 'De', 'Cobertura'],
    [
      [
        'sítio (espaço do catálogo)',
        comEspaco,
        publicados.length,
        percentagem(comEspaco, publicados.length),
      ],
      ['categoria', comCategoria, publicados.length, percentagem(comCategoria, publicados.length)],
      ['cartaz', comCartaz, publicados.length, percentagem(comCartaz, publicados.length)],
      ['resumo', comResumo, publicados.length, percentagem(comResumo, publicados.length)],
      [
        'marcado como gratuito',
        gratuitos,
        publicados.length,
        percentagem(gratuitos, publicados.length),
      ],
    ],
  ),
);

escreve(`
Os eventos que não têm espaço do catálogo — ${publicados.length - comEspaco} —
não estão sem sítio: têm um **local nomeado**, que é uma praça, um largo, um
jardim ou um campo. O catálogo é das casas da cultura; um largo não é uma casa.

### Tudo o que está publicado
`);
escreve(
  tabela(
    ['Quando', 'Evento', 'Concelho', 'Sítio', 'Categoria'],
    [...publicados]
      .sort((a, b) => String(a.date_start ?? '').localeCompare(String(b.date_start ?? '')))
      .map((e) => [
        e.date_end && e.date_end !== e.date_start
          ? `${DIA(e.date_start)} → ${DIA(e.date_end)}`
          : DIA(e.date_start),
        e.title,
        texto(nomeDoConcelho.get(e.municipality_id)),
        e.venue_id ? (nomeDoEspaco.get(e.venue_id) ?? e.venue_id) : texto(e.location_name),
        e.category_slug ? (nomeDaCategoria.get(e.category_slug) ?? e.category_slug) : CANTO,
      ]),
  ),
);

// ---------------------------------------------------------------------------
escreve(`## Coretos

O levantamento dos coretos da região — o objecto que dá o nome ao projecto.
«Confirmado» quer dizer que há prova de que existe e de onde está.
`);
escreve(
  tabela(
    ['Coreto', 'Concelho', 'Freguesia', 'Ano', 'Confirmado', 'No mapa', 'Foto'],
    coretos.map((k) => [
      k.name,
      texto(nomeDoConcelho.get(k.municipality_id)),
      texto(k.parish),
      texto(k.year_built),
      sim(k.is_confirmed),
      sim(k.latitude !== null),
      sim(k.photo_url),
    ]),
  ),
);

// ---------------------------------------------------------------------------
escreve(`## Ciclos e festivais

Programações que atravessam vários dias, espaços ou concelhos, e que fazem
sentido lidas como um todo.
`);
escreve(
  tabela(
    ['Ciclo', 'Eventos na base'],
    ciclos.map((s) => [s.name, eventos.filter((e) => e.series_id === s.id).length]),
  ),
);

// ---------------------------------------------------------------------------
escreve(`## Categorias

O catálogo fechado. Uma etiqueta da fonte só vira categoria se houver um alias
que o diga — não se adivinha, porque uma categoria errada desvia o evento do
filtro onde as pessoas o procuram.
`);
escreve(
  tabela(
    ['Categoria', 'Identificador', 'Eventos publicados'],
    categorias.map((c) => [
      c.name,
      `\`${c.slug}\``,
      publicados.filter((e) => e.category_slug === c.slug).length,
    ]),
  ),
);

// ---------------------------------------------------------------------------
escreve(`## Secções do sítio

Quatro páginas que o painel liga e desliga sem passar por uma migração.
`);
escreve(
  tabela(
    ['Secção', 'Estado'],
    seccoes.map((s) => [`\`/${s.id}\``, s.is_enabled ? 'ligada' : '**desligada**']),
  ),
);

// ---------------------------------------------------------------------------
escreve(`## O que falta

Contado, e não estimado.
`);
escreve(
  tabela(
    ['O que falta', 'Quantos'],
    [
      ['eventos publicados sem categoria', publicados.length - comCategoria],
      ['eventos publicados sem cartaz', publicados.length - comCartaz],
      ['espaços sem descrição', espacos.length - comDescricao],
      ['espaços sem fotografia', espacos.length - comFoto],
      ['espaços sem coordenadas', espacos.length - comCoordenada],
      ['espaços sem informação de acessibilidade', espacos.length - comAcesso],
      ['coretos por confirmar', coretos.filter((k) => !k.is_confirmed).length],
      ['coretos sem fotografia', coretos.filter((k) => !k.photo_url).length],
      ['fontes desligadas', desligadas.length],
    ].filter(([, n]) => n > 0),
  ),
);

escreve(`
---

_Gerado por \`scripts/gerar-inventario.mjs\` a ${hoje}, a partir da base de
produção pela chave pública._
`);

const destino = join(RAIZ, 'docs/regioes/medio-tejo/INVENTARIO.md');
writeFileSync(destino, secoes.join('\n'), 'utf8');
console.log(
  `✓ docs/regioes/medio-tejo/INVENTARIO.md — ${publicados.length} eventos, ${espacos.length} espaços, ${fontes.length} fontes`,
);
