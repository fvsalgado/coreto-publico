import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PUBLIC_SOURCE_FIELDS, VENUE_FIELDS, CORETO_FIELDS, DETAIL_EVENT_FIELDS } from './fields';

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
    for (const interna of ['notes', 'config', 'last_error']) {
      expect(asList(PUBLIC_SOURCE_FIELDS)).not.toContain(interna);
    }
  });

  it('pede o nome do leitor, e nunca a configuração dele', () => {
    /*
     * O `adapter` esteve nesta lista de proibidas até à 0139, e sair dela foi
     * uma decisão e não um descuido.
     *
     * A 12 e 13 de setembro de 2026 oito fontes do Médio Tejo não responderam a
     * um único pedido nas duas noites, enquanto as vinte e seis juntas de
     * freguesia responderam a todos. Sete das oito correm o mesmo leitor. A
     * `/estado` mostrava oito linhas soltas e não tinha como dizer o que elas
     * tinham em comum — a informação estava na base e era esta coluna.
     *
     * O nome do leitor infere-se abrindo o sítio da câmara, e a `/fontes` já
     * publica o endereço de todas. A **configuração** é outra coisa: leva
     * seletores, exclusões e chaves de caminho, e continua fora. É a distinção
     * que este par de testes existe para prender.
     */
    expect(asList(PUBLIC_SOURCE_FIELDS)).toContain('adapter');
    expect(asList(PUBLIC_SOURCE_FIELDS)).not.toContain('config');
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

/**
 * O `status` nas colunas da ficha.
 *
 * Não é uma coluna decorativa: é a única coisa que separa, dentro da mesma
 * página, um convite de um registo. Desde a 0132 a `fetchEvent` devolve as
 * duas coisas, e sem o `status` a ficha oferecia calendário para abril e o
 * JSON-LD anunciava bilhetes de um concerto que já se fez.
 *
 * Tirá-lo de `DETAIL_EVENT_FIELDS` não parte nenhum tipo — o TypeScript vê o
 * `select` como uma cadeia — e parte a página em silêncio. Daí o teste.
 */
describe('DETAIL_EVENT_FIELDS', () => {
  const colunas = DETAIL_EVENT_FIELDS.split(',').map((coluna) => coluna.trim());

  it('pede o estado, porque a ficha desenha duas coisas diferentes', () => {
    expect(colunas).toContain('status');
  });

  it('e não pede a razão do arquivo, que a política já garante', () => {
    // A política só deixa passar arquivados com `archived_reason = 'passado'`.
    // Pedir a coluna era pedir uma resposta que já se sabe.
    expect(colunas).not.toContain('archived_reason');
  });

  it('nenhuma coluna se repete — um `select` com repetições é um pedido malformado', () => {
    expect(new Set(colunas).size).toBe(colunas.length);
  });
});
