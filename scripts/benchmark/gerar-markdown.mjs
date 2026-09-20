/**
 * Escreve docs/BENCHMARK.md a partir de docs/benchmark/veredictos.json: o
 * mesmo texto da galeria (veredicto por sítio, matriz de critérios e plano),
 * sem os prints. A galeria com imagens gera-se com gerar-galeria.mjs e fica
 * fora do git; este ficheiro é o que se lê no repositório e o que se revê em
 * pull request.
 *
 *   node scripts/benchmark/gerar-markdown.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import prettier from 'prettier';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const v = JSON.parse(readFileSync(resolve(RAIZ, 'docs', 'benchmark', 'veredictos.json'), 'utf8'));

const GRUPOS = [
  ['coreto', 'O Coreto hoje'],
  ['pt', 'Portugal'],
  ['mundo', 'Pares diretos no mundo'],
  ['ux', 'Referências de experiência'],
];

const celula = (x) => (x === true ? '●' : x === false ? '○' : x === 'meio' ? '◐' : String(x ?? ''));

const linhas = [];
linhas.push(`# ${v.titulo}`, '');
linhas.push(
  `_${v.eyebrow}. Gerado por \`scripts/benchmark/gerar-markdown.mjs\` a partir de \`docs/benchmark/veredictos.json\`; não editar à mão._`,
  '',
);
linhas.push(v.lede, '');
linhas.push('| | |', '| --- | --- |');
for (const r of v.resumo) linhas.push(`| **${r.valor}** | ${r.rotulo} |`);
linhas.push('');
linhas.push('## Como se fez', '');
linhas.push(
  'Os prints tiraram-se no mesmo dia com `scripts/benchmark/prints.mjs` (Playwright, 1440×900 e 390×844 com agente de iPhone, faixas de cookies fechadas pelas palavras do costume). Ficam em `estado/benchmark/prints/`, fora do git, porque são capturas de sítios de terceiros. A galeria com as imagens lado a lado gera-se com `pnpm benchmark`; este ficheiro é a parte que se lê sem imagens.',
  '',
);
for (const [id, nome] of GRUPOS) {
  linhas.push(`## ${nome}`, '');
  for (const s of v.sitios.filter((x) => x.grupo === id)) {
    linhas.push(
      `### ${s.nome}`,
      '',
      `${s.tipo}${s.pais && s.pais !== '—' ? ` · ${s.pais}` : ''} · <${s.url}>`,
      '',
    );
    linhas.push(`**O que se vê.** ${s.veredicto}`, '');
    if (s.levar?.length) {
      linhas.push('**O que o Coreto pode levar.**', '');
      for (const l of s.levar) linhas.push(`- ${l}`);
      linhas.push('');
    }
  }
}
linhas.push('## Comparação', '', v.comparacaoIntro, '');
linhas.push(`| Critério | ${v.matriz.colunas.join(' | ')} |`);
linhas.push(`| --- | ${v.matriz.colunas.map(() => ':-:').join(' | ')} |`);
for (const l of v.matriz.linhas)
  linhas.push(`| ${l.criterio} | ${l.valores.map(celula).join(' | ')} |`);
linhas.push('', `● tem · ◐ em parte · ○ não tem · — não verificado. ${v.matriz.nota}`, '');
linhas.push('## Plano de melhorias', '', v.planoIntro, '');
v.plano.forEach((p, i) => {
  linhas.push(`### ${i + 1}. ${p.titulo}`, '', p.oque, '', `**Porquê.** ${p.porque}`, '');
  linhas.push(`- Esforço: ${p.esforco}`, `- Onde: ${p.onde}`);
  if (p.decisao) linhas.push(`- Decisão do dono: ${p.decisao}`);
  if (p.estado) linhas.push(`- Estado: ${p.estado}`);
  linhas.push('');
});
linhas.push('## Fecho', '', v.fecho, '');

// Passa pelo Prettier com a configuração do repositório: o `format:check` do
// CI lê este ficheiro, e um gerador que o escreve de outra forma falhava-o.
const destino = resolve(RAIZ, 'docs', 'BENCHMARK.md');
const opcoes = (await prettier.resolveConfig(destino)) ?? {};
writeFileSync(destino, await prettier.format(linhas.join('\n'), { ...opcoes, filepath: destino }));
console.log('✓ docs/BENCHMARK.md');
