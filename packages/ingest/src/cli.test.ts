import { describe, expect, it } from 'vitest';
import { formatSummary, parseArgs } from './cli.js';
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

describe('formatSummary', () => {
  const outcome = (partial: Partial<SourceOutcome>): SourceOutcome => ({
    sourceId: 'cm-tomar',
    ambito: 'tomar',
    status: 'success',
    skipped: false,
    layoutDrift: false,
    counters: emptyCounters(),
    submitted: 0,
    http: { responses: 1, failures: 0 },
    error: null,
    warnings: 0,
    ...partial,
  });

  it('mostra uma linha por fonte e o total de falhas', () => {
    const summary = formatSummary(
      [
        outcome({ counters: { ...emptyCounters(), itemsFound: 24, itemsNew: 3 } }),
        outcome({ sourceId: 'cm-ourem', status: 'failed', error: 'sem resposta' }),
        outcome({ sourceId: 'cm-macao', status: 'partial', layoutDrift: true }),
      ],
      2_500,
    );

    expect(summary).toContain('cm-tomar');
    expect(summary).toContain('sem resposta');
    expect(summary).toContain('layout?');
    expect(summary).toContain('3 fontes em 2.5s — 1 com falha.');
  });
});
