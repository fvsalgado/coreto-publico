import { describe, expect, it } from 'vitest';

import { listMunicipalityNames, MUNICIPALITIES } from './municipalities';

/**
 * Este ficheiro já foi o cadeado do Médio Tejo: contava onze, proibia a Sertã
 * e Vila de Rei, e lia as migrações do disco para jurar que a constante e os
 * seeds diziam o mesmo. Esse guarda mudou de casa a 2026-09-01, quando as
 * regiões entraram na base: quem prende os seeds é agora o loop das
 * `scripts/schema-checks.sql`, que compara cada região com a contagem que ela
 * própria declara (`regions.expected_municipality_count`) — e a proibição da
 * Sertã ficou lá, com o âmbito dito («só no Médio Tejo»; na Beira Baixa ela
 * existe legitimamente).
 *
 * O que fica aqui é o que é do código: a forma da constante — que ainda serve
 * o `not-found` e o adaptador CAMINHOS, até a fase 3b do plano multi-inquilino
 * a reformar — e a enumeração em português.
 */

describe('MUNICIPALITIES', () => {
  it('não tem identificadores repetidos', () => {
    const ids = MUNICIPALITIES.map((municipality) => municipality.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('está ordenada pelo identificador', () => {
    const ids = MUNICIPALITIES.map((municipality) => municipality.id);
    expect(ids).toEqual([...ids].sort());
  });
});

describe('listMunicipalityNames', () => {
  it('enumera em português, com «e» antes do último', () => {
    expect(listMunicipalityNames()).toContain('Abrantes, Alcanena');
    expect(listMunicipalityNames()).toContain('Torres Novas e Vila Nova da Barquinha');
  });

  it('aguenta listas curtas', () => {
    expect(listMunicipalityNames([])).toBe('');
    expect(listMunicipalityNames([MUNICIPALITIES[0] as never])).toBe('Abrantes');
  });
});
