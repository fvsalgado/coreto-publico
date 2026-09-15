#!/usr/bin/env node
/*
 * O dossiê de titularidade e o disco têm de concordar.
 *
 * Foi por não haver travão que entraram, sem proveniência, três páginas
 * completas do sítio de uma câmara municipal e duas páginas inteiras de uma
 * junta; e foi por não haver travão que o `PROVENIENCIA.md` dos logótipos
 * pôde apontar durante semanas para dois ficheiros que não existem e para um
 * caminho de código que também não existe. Um documento de proveniência que
 * não corresponde ao que está lá não serve de prova a ninguém — faz pior do
 * que não existir, porque dá confiança a quem o lê.
 *
 * Esta casa já tem este hábito para os números do PROJETO.md e para as
 * afirmações públicas. Faltava aqui.
 *
 * O que se verifica, e só isto: que cada ficheiro citado num documento de
 * proveniência existe, que cada caminho de código citado existe, que as pastas
 * de material de terceiros continuam declaradas, e que os `package.json`
 * continuam todos a declarar a licença. Não se julga se a licença está certa —
 * isso é de um advogado, e as perguntas estão escritas em
 * docs/TITULARIDADE.md.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let falhas = 0;
let passou = 0;

function afirmar(ok, afirmacao, detalhe) {
  if (ok) {
    passou += 1;
    console.log(`✓ ${afirmacao}`);
    return;
  }
  falhas += 1;
  console.log(`✗ ${afirmacao}`);
  if (detalhe) console.log(`    ${detalhe}`);
}

function ler(caminho) {
  try {
    return readFileSync(join(RAIZ, caminho), 'utf8');
  } catch {
    return '';
  }
}

// --- Os documentos que têm de existir --------------------------------------

const CANONICOS = ['AUTORIA.md', 'REUSE.toml', 'docs/TITULARIDADE.md', 'docs/TERCEIROS.md'];
for (const doc of CANONICOS) {
  afirmar(existsSync(join(RAIZ, doc)), `${doc} existe`);
}

// --- Cada ficheiro citado num documento de proveniência existe --------------
//
// O padrão é o das tabelas: um nome de ficheiro entre plicas invertidas. Só se
// verificam os que têm extensão de imagem, que são os que estes documentos
// nomeiam — um `nome.png` citado e ausente é o defeito que isto apanha.

const PROVENIENCIAS = [
  {
    doc: 'apps/web/public/logos/medio-tejo/PROVENIENCIA.md',
    pasta: 'apps/web/public/logos/medio-tejo',
  },
];

for (const { doc, pasta } of PROVENIENCIAS) {
  const texto = ler(doc);
  afirmar(texto.length > 0, `${doc} lê-se`);
  const citados = [...texto.matchAll(/`([\w.-]+\.(?:png|jpe?g|webp|svg|avif))`/g)].map((m) => m[1]);
  const unicos = [...new Set(citados)];
  afirmar(unicos.length > 0, `${doc} cita pelo menos um ficheiro`);
  for (const nome of unicos) {
    afirmar(
      existsSync(join(RAIZ, pasta, nome)),
      `${doc} cita \`${nome}\`, e ele existe`,
      `procurei em ${pasta}/`,
    );
  }
}

// --- Cada caminho de código citado existe -----------------------------------
//
// Apanha o caso real: a página mudou para `app/[regiao]/informacoes/` e o
// documento ficou a apontar para onde ela já não está.

for (const { doc } of PROVENIENCIAS) {
  const texto = ler(doc);
  const caminhos = [
    ...texto.matchAll(/`((?:apps|packages|scripts|supabase)\/[\w[\]./-]+\.\w+)`/g),
  ].map((m) => m[1]);
  for (const caminho of [...new Set(caminhos)]) {
    afirmar(existsSync(join(RAIZ, caminho)), `${doc} aponta \`${caminho}\`, e ele existe`);
  }
}

// --- As pastas de material de terceiros continuam declaradas ----------------
//
// Se nascer outra pasta de capturas e ninguém a declarar, isto não a apanha —
// apanha o contrário, que é alguém tirar do dossiê uma pasta que continua no
// disco. É o que aconteceria se o documento fosse aparado sem se olhar.

const terceiros = ler('docs/TERCEIROS.md');
const reuse = ler('REUSE.toml');
for (const pasta of ['packages/ingest/src/__fixtures__', 'instantaneos']) {
  if (!existsSync(join(RAIZ, pasta))) continue;
  afirmar(terceiros.includes(pasta), `docs/TERCEIROS.md declara \`${pasta}\``);
  afirmar(reuse.includes(pasta), `REUSE.toml declara \`${pasta}\``);
}

// --- Todos os package.json declaram a licença -------------------------------
//
// É dos primeiros sítios onde um auditor procura, e durante meses só o da raiz
// declarava.

const PACOTES = [
  'package.json',
  'apps/web/package.json',
  'packages/core/package.json',
  'packages/ingest/package.json',
];
for (const pacote of PACOTES) {
  let licenca = null;
  try {
    licenca = JSON.parse(ler(pacote)).license ?? null;
  } catch {
    licenca = null;
  }
  afirmar(
    licenca === 'AGPL-3.0-only',
    `${pacote} declara AGPL-3.0-only`,
    `declara: ${licenca ?? '(nada)'}`,
  );
}

// --- O aviso de copyright existe e nomeia alguém ----------------------------

const autoria = ler('AUTORIA.md');
afirmar(/Copyright © \d{4}/.test(autoria), 'AUTORIA.md tem um aviso de copyright com ano');
afirmar(/SPDX-License-Identifier/.test(reuse), 'REUSE.toml tem identificadores SPDX');

// ---------------------------------------------------------------------------

console.log();
console.log(`${passou} verificações passaram, ${falhas} a falhar.`);
if (falhas > 0) {
  console.log();
  console.log('Um documento de proveniência que não bate certo com o disco não serve');
  console.log('de prova a ninguém. Corrige o documento — ou o que o desmente.');
  process.exit(1);
}
