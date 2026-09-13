import { describe, expect, it } from 'vitest';
import { corpoDoResumo, linhasDoResumo } from './resumo-diario.mjs';

const NADA = {
  region: 'medio-tejo',
  as_of: '2026-09-13',
  pending: { total: 0, by_channel: { scraper: 0, email: 0, form: 0 } },
  pending_within_7_days: 0,
  pending_already_past: 0,
  pending_stale: 0,
  silent_sources: 0,
  tomorrow_incomplete: 0,
  licenses_ending: [],
};

/**
 * A regra que decide se o aviso existe.
 *
 * Um aviso diário sobre uma fila vazia aprende-se a ignorar em duas semanas —
 * e aí deixa de servir também nos dias em que havia alguma coisa. É o
 * argumento que a própria casa escreve na `agenda-semanal.yml` para
 * justificar ser semanal, aplicado a mais um sítio.
 */
describe('quando não há nada a fazer', () => {
  it('não há corpo nenhum, e por isso não se envia nada', () => {
    expect(corpoDoResumo(NADA)).toBe('');
    expect(linhasDoResumo(NADA)).toEqual([]);
  });

  it('um resumo em branco não rebenta e também não diz nada', () => {
    expect(corpoDoResumo({})).toBe('');
    expect(corpoDoResumo(null)).toBe('');
    expect(corpoDoResumo(undefined)).toBe('');
  });

  /**
   * Zero submissões por rever com uma licença a acabar **tem** de enviar: a
   * licença não está na fila de ninguém, e é a única destas sete coisas que
   * ninguém descobre a trabalhar.
   */
  it('mas uma licença a acabar envia, mesmo com a fila vazia', () => {
    const corpo = corpoDoResumo({
      ...NADA,
      licenses_ending: [{ kind: 'piloto', ends_on: '2026-10-01' }],
    });
    expect(corpo).toBe('licença piloto acaba a 2026-10-01');
  });
});

describe('o corpo do resumo', () => {
  it('diz quantas e por onde entraram, e omite os canais a zero', () => {
    const corpo = corpoDoResumo({
      ...NADA,
      pending: { total: 3, by_channel: { scraper: 1, email: 0, form: 2 } },
    });
    expect(corpo).toBe('3 por rever (2 por formulário, 1 por recolha)');
    expect(corpo).not.toContain('email');
  });

  /** O caso que o plano escreveu como critério de aceitação. */
  it('diz «3 por rever» e «1 acontece nos próximos 7 dias»', () => {
    const linhas = linhasDoResumo({
      ...NADA,
      pending: { total: 3, by_channel: { scraper: 0, email: 0, form: 3 } },
      pending_within_7_days: 1,
    });
    expect(linhas[0]).toContain('3 por rever');
    expect(linhas[1]).toBe('1 acontece nos próximos 7 dias');
  });

  it('concorda em número, que é onde estes textos costumam errar', () => {
    expect(linhasDoResumo({ ...NADA, pending_within_7_days: 2 })).toContain(
      '2 acontecem nos próximos 7 dias',
    );
    expect(linhasDoResumo({ ...NADA, pending_already_past: 1 })).toContain('1 já passou');
    expect(linhasDoResumo({ ...NADA, pending_already_past: 4 })).toContain('4 já passaram');
    expect(linhasDoResumo({ ...NADA, silent_sources: 1 })).toContain(
      '1 fonte correu e não trouxe nada',
    );
    expect(linhasDoResumo({ ...NADA, silent_sources: 8 })).toContain(
      '8 fontes correram e não trouxeram nada',
    );
    expect(linhasDoResumo({ ...NADA, tomorrow_incomplete: 1 })).toContain(
      '1 evento de amanhã sem hora',
    );
    expect(linhasDoResumo({ ...NADA, tomorrow_incomplete: 3 })).toContain(
      '3 eventos de amanhã sem hora',
    );
  });

  /**
   * As que já passaram contam-se à parte de propósito. Rever uma submissão de
   * um evento que já aconteceu não é trabalho por fazer — é trabalho que já
   * não vale a pena —, e somá-la às urgentes fazia a lista parecer maior do
   * que aquilo que dá para salvar.
   */
  it('não junta as que já passaram às que urgem', () => {
    const linhas = linhasDoResumo({
      ...NADA,
      pending: { total: 5, by_channel: { scraper: 5, email: 0, form: 0 } },
      pending_within_7_days: 2,
      pending_already_past: 3,
    });
    expect(linhas).toContain('2 acontecem nos próximos 7 dias');
    expect(linhas).toContain('3 já passaram');
    expect(linhas.join('\n')).not.toContain('5 acontecem');
  });

  it('uma linha por facto, e nenhuma linha vazia', () => {
    const corpo = corpoDoResumo({
      ...NADA,
      pending: { total: 2, by_channel: { scraper: 2, email: 0, form: 0 } },
      silent_sources: 8,
      licenses_ending: [
        { kind: 'contrato', ends_on: '2026-10-01' },
        { kind: 'piloto', ends_on: '2026-12-31' },
      ],
    });
    const linhas = corpo.split('\n');
    expect(linhas).toHaveLength(4);
    expect(linhas.every((l) => l.trim().length > 0)).toBe(true);
  });
});
