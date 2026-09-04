import { describe, expect, it } from 'vitest';
import { todayInLisbon } from '@coreto/core';
import {
  declaracaoCaducada,
  mesesDecorridos,
  PRAZO_DE_REVISAO_EM_MESES,
  REVISAO_ACESSIBILIDADE,
} from './revisao';

describe('mesesDecorridos', () => {
  it('conta por calendário e não por dias', () => {
    expect(mesesDecorridos('2026-08-29', '2027-08-29')).toBe(12);
    expect(mesesDecorridos('2026-01-31', '2026-02-28')).toBe(0);
    expect(mesesDecorridos('2026-08-29', '2026-09-01')).toBe(0);
  });

  it('o mês só conta quando o dia chega', () => {
    // Onze meses e vinte e nove dias não são doze meses. Sem esta regra, a
    // declaração passava a estar caducada um dia antes de o estar.
    expect(mesesDecorridos('2026-08-29', '2027-08-28')).toBe(11);
    expect(mesesDecorridos('2026-08-29', '2027-08-30')).toBe(12);
  });

  it('não se engana com a viragem do ano', () => {
    expect(mesesDecorridos('2026-12-01', '2027-01-01')).toBe(1);
    expect(mesesDecorridos('2026-12-31', '2027-01-01')).toBe(0);
  });
});

describe('a declaração de acessibilidade', () => {
  it('caduca ao fim de doze meses, e não antes', () => {
    expect(declaracaoCaducada('2027-08-28')).toBe(false);
    expect(declaracaoCaducada('2027-08-29')).toBe(true);
  });

  /**
   * O teste que existe para falhar um dia.
   *
   * A declaração promete, por escrito, ser revista «no mínimo, uma vez por
   * ano» — é o que o Decreto-Lei n.º 83/2018 pede e é o que está publicado em
   * `/acessibilidade`. Uma promessa que ninguém verifica é uma
   * frase; o que a torna uma obrigação é isto falhar quando ela caducar.
   *
   * **Quando este teste reprovar, o que se faz não é mexer na data.** Faz-se a
   * revisão a sério — correr a auditoria, reler as limitações conhecidas,
   * confirmar que o mecanismo de resposta e a entidade de supervisão continuam
   * certos — e só depois se escreve a data nova em `REVISAO_ACESSIBILIDADE`.
   */
  it('não está caducada hoje', () => {
    const hoje = todayInLisbon();
    expect(
      declaracaoCaducada(hoje),
      `A declaração de acessibilidade foi revista a ${REVISAO_ACESSIBILIDADE} e hoje é ${hoje}: ` +
        `passaram ${mesesDecorridos(REVISAO_ACESSIBILIDADE, hoje)} meses, e o prazo escrito na ` +
        `própria declaração é de ${PRAZO_DE_REVISAO_EM_MESES}. Reveja a declaração — a auditoria, ` +
        `as limitações conhecidas, o mecanismo de resposta e a entidade de supervisão — e só ` +
        `depois actualize REVISAO_ACESSIBILIDADE em apps/web/src/lib/revisao.ts.`,
    ).toBe(false);
  });
});
