#!/usr/bin/env node
/**
 * Refaz o `docs/contrato/panorama.json` a partir da base.
 *
 * O anexo do dossiê contratual mostra a instalação de referência concelho a
 * concelho. São números que mudam todas as noites, e escritos à mão envelhecem
 * no dia seguinte sem ninguém saber quando — por isso vivem num ficheiro com a
 * data da medição, e é este guião que o refaz.
 *
 *   DATABASE_URL='postgresql://…' node scripts/atualizar-panorama.mjs
 *
 * Não escreve nada na base: são cinco contagens. A cadeia de produção é a mesma
 * que o `migracoes-por-aplicar.sh` usa, e está em `docs/INFRAESTRUTURA.md`.
 *
 * **Só a região indicada**, que por omissão é a `medio-tejo`. A instalação serve
 * também uma região de demonstração com eventos inventados: juntá-los dava 319
 * eventos em vez de 289, e um número que quem confere não encontra destrói a
 * confiança no resto do documento. Foi esse o erro que este guião existe para
 * não se repetir.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'docs', 'contrato', 'panorama.json');
const REGIAO = process.env.REGIAO_DO_PANORAMA?.trim() || 'medio-tejo';

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL — sem base não há panorama.');
  console.error('Ver docs/INFRAESTRUTURA.md. Não se inventa: o ficheiro fica como está.');
  process.exit(1);
}

const perguntar = (sql) =>
  JSON.parse(
    execFileSync('psql', [process.env.DATABASE_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-tAc', sql], {
      encoding: 'utf8',
    }).trim() || 'null',
  );

const ambito = `(s.municipality_id in (select id from public.municipalities where region_id = '${REGIAO}')
  or s.region_id = '${REGIAO}' or (s.municipality_id is null and s.region_id is null))`;

const concelhos = perguntar(`select coalesce(json_agg(x order by x->>'nome'), '[]') from (
  select json_build_object(
    'nome', m.name,
    'espacos', (select count(*) from public.venues v where v.municipality_id = m.id),
    'eventos', (select count(*) from public.events e where e.municipality_id = m.id),
    'futuros', (select count(*) from public.events e where e.municipality_id = m.id and e.date_start >= current_date),
    'fontes', (select count(*) from public.sources s where s.municipality_id = m.id),
    'ligadas', (select count(*) from public.sources s where s.municipality_id = m.id and s.is_enabled)
  ) as x from public.municipalities m where m.region_id = '${REGIAO}') t;`);

const estados = perguntar(`select json_build_object(
  'fontes', count(*),
  'fontesALer', count(*) filter (where s.is_enabled and s.consecutive_failures = 0 and s.last_success_at is not null),
  'fontesPausadas', count(*) filter (where s.is_enabled and s.consecutive_failures > 0),
  'fontesDesligadas', count(*) filter (where not s.is_enabled)
) from public.sources s where ${ambito};`);

const adaptadores =
  perguntar(`select coalesce(json_agg(x order by (x->>'fontes')::int desc, x->>'nome'), '[]') from (
  select json_build_object('nome', s.adapter, 'fontes', count(*), 'concelhos', count(distinct s.municipality_id)) as x
  from public.sources s where ${ambito} group by s.adapter) t;`);

const antigo = JSON.parse(readFileSync(DESTINO, 'utf8'));

/* A descrição de cada adaptador é prosa e não sai da base: mantém-se a que já
   estava escrita, e um adaptador novo entra com o nome à espera de legenda. */
const legendas = new Map(antigo.adaptadores.map((a) => [a.nome, a.leGenero]));

const novo = {
  ...antigo,
  medidoEm: new Date().toISOString().slice(0, 10),
  totais: {
    concelhos: concelhos.length,
    ...estados,
    espacos: concelhos.reduce((a, c) => a + c.espacos, 0),
    eventos: concelhos.reduce((a, c) => a + c.eventos, 0),
    eventosFuturos: concelhos.reduce((a, c) => a + c.futuros, 0),
    adaptadoresEscritos: antigo.totais.adaptadoresEscritos,
    adaptadoresEmUso: adaptadores.length,
  },
  concelhos,
  adaptadores: adaptadores.map((a) => ({
    nome: a.nome,
    leGenero: legendas.get(a.nome) ?? '(por descrever)',
    fontes: a.fontes,
    concelhos: a.concelhos,
  })),
};

writeFileSync(DESTINO, `${JSON.stringify(novo, null, 2)}\n`);
const semLegenda = novo.adaptadores.filter((a) => a.leGenero === '(por descrever)');
console.log(`✓ ${DESTINO} — ${novo.totais.concelhos} concelhos, ${novo.totais.fontes} fontes`);
if (semLegenda.length > 0) {
  console.log(`  adaptadores por descrever: ${semLegenda.map((a) => a.nome).join(', ')}`);
}
