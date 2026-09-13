import { describe, expect, it } from 'vitest';
import { contarProblemas, formatSummary, parseArgs } from './cli.js';
import { emptyCounters } from './run-logger.js';
import type { SourceOutcome } from './pipeline.js';

describe('parseArgs', () => {
  it('lê fontes repetidas e separadas por vírgulas', () => {
    const options = parseArgs(['--source', 'cm-tomar', '--source', 'cm-ourem,teatro-virginia']);
    expect(options.sources).toEqual(['cm-tomar', 'cm-ourem', 'teatro-virginia']);
    expect(options.all).toBe(false);
  });

  it('lê os interruptores', () => {
    const options = parseArgs(['--all', '--dry-run']);
    expect(options.all).toBe(true);
    expect(options.dryRun).toBe(true);
  });

  it('recusa uma opção desconhecida e um --source sem valor', () => {
    expect(() => parseArgs(['--tudo'])).toThrow(/desconhecida/);
    expect(() => parseArgs(['--source', '--all'])).toThrow(/precisa de um id/);
  });
});

const outcome = (partial: Partial<SourceOutcome>): SourceOutcome => ({
  sourceId: 'cm-tomar',
  ambito: 'tomar',
  status: 'success',
  skipped: false,
  layoutDrift: false,
  contagem: 'normal',
  counters: emptyCounters(),
  submitted: 0,
  http: { responses: 1, failures: 0 },
  error: null,
  warnings: 0,
  ...partial,
});

describe('formatSummary', () => {
  it('mostra uma linha por fonte e os dois totais', () => {
    const summary = formatSummary(
      [
        outcome({ counters: { ...emptyCounters(), itemsFound: 24, itemsNew: 3 } }),
        outcome({ sourceId: 'cm-ourem', status: 'failed', error: 'sem resposta' }),
        outcome({
          sourceId: 'cm-macao',
          status: 'partial',
          layoutDrift: true,
          contagem: 'deriva',
        }),
      ],
      2_500,
    );

    expect(summary).toContain('cm-tomar');
    expect(summary).toContain('sem resposta');
    expect(summary).toContain('layout?');
    expect(summary).toContain('3 fontes em 2.5s — 1 com falha, 1 com a contagem em baixo.');
  });

  it('a queda tem etiqueta própria: não é a mesma coisa que um parcial', () => {
    const summary = formatSummary([outcome({ status: 'partial', contagem: 'queda' })], 100);
    expect(summary).toContain('queda');
    expect(summary).not.toContain('layout?');
  });
});

/**
 * O que decide o código de saída, e com ele o aviso da recolha.
 *
 * Antes disto, uma noite em que uma câmara mudasse de tema saía a zero: o
 * `if: failure()` do `scrape.yml` não disparava e o único registo era uma
 * linha «layout?» no meio de oitenta.
 */
describe('contarProblemas', () => {
  it('conta as falhas e as contagens em baixo em separado', () => {
    const problemas = contarProblemas([
      outcome({}),
      outcome({ status: 'failed' }),
      outcome({ status: 'partial', layoutDrift: true, contagem: 'deriva' }),
      outcome({ status: 'partial', contagem: 'queda' }),
    ]);
    expect(problemas).toEqual({ falhadas: 1, contagensMas: 2 });
  });

  it('uma fonte saltada pelo disjuntor não volta a tocar a campainha', () => {
    // A falha que abriu o disjuntor já abriu o aviso. Repeti-lo em cada uma
    // das 24 horas de pausa é a receita para um aviso que se ignora.
    const problemas = contarProblemas([
      outcome({ status: 'partial', skipped: true, contagem: 'normal' }),
    ]);
    expect(problemas).toEqual({ falhadas: 0, contagensMas: 0 });
  });

  it('uma recolha normal sai limpa', () => {
    expect(contarProblemas([outcome({}), outcome({})])).toEqual({
      falhadas: 0,
      contagensMas: 0,
    });
  });
});
