import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PUBLIC_SOURCE_FIELDS, VENUE_FIELDS, CORETO_FIELDS } from './fields';

const MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../supabase/migrations',
);

function migrationsSql(): string {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(join(MIGRATIONS, name), 'utf8'))
    .join('\n');
}

function asList(fields: string): string[] {
  return fields.split(',').map((field) => field.trim());
}

/**
 * As colunas que o PostgREST pode pedir às fontes.
 *
 * A tabela `sources` é lida com privilégios por coluna: o `grant select (...)`
 * da 0049 diz exatamente quais. Pedir uma coluna a mais não devolve essa
 * coluna a null — faz o PostgREST recusar o pedido inteiro com «permission
 * denied», e a página das fontes fica vazia sem dizer porquê, em produção e
 * só em produção (localmente, com a chave de serviço, passava). Este teste é
 * o que faz esse engano falhar em CI.
 */
describe('PUBLIC_SOURCE_FIELDS', () => {
  // TODOS os grants, não só o primeiro: os privilégios por coluna somam-se —
  // a 0049 concedeu nove e a 0107 concedeu a região — e uma migração nova
  // que conceda outra coluna entra aqui sozinha, como entra no Postgres.
  const grants = [
    ...migrationsSql().matchAll(
      /grant select \(([^)]*)\)\s*on public\.sources to anon, authenticated;/gi,
    ),
  ];

  it('as migrações concedem mesmo colunas das fontes', () => {
    expect(grants.length).toBeGreaterThan(0);
  });

  it('pede exatamente as colunas que as migrações concedem', () => {
    const concedidas = [
      ...new Set(
        grants.flatMap((grant) => asList(grant[1] ?? '').filter((column) => column.length > 0)),
      ),
    ].sort();
    expect(asList(PUBLIC_SOURCE_FIELDS).sort()).toEqual(concedidas);
  });

  it('não pede o caderno da recolha nem a configuração', () => {
    for (const interna of ['notes', 'config', 'last_error', 'adapter']) {
      expect(asList(PUBLIC_SOURCE_FIELDS)).not.toContain(interna);
    }
  });
});

/**
 * O que o público lê dos espaços e dos coretos é a descrição editorial, e
 * nunca as notas de trabalho. Aconteceu duas vezes — nos espaços e depois nos
 * coretos —, e das duas foi preciso alguém dar por ela numa página publicada.
 */
describe('as notas de trabalho não saem para a rua', () => {
  it('os espaços leem `description`', () => {
    expect(asList(VENUE_FIELDS)).toContain('description');
    expect(asList(VENUE_FIELDS)).not.toContain('notes');
  });

  it('os coretos leem `description`', () => {
    expect(asList(CORETO_FIELDS)).toContain('description');
    expect(asList(CORETO_FIELDS)).not.toContain('notes');
  });
});
