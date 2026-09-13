/**
 * Registo de uma execução de fonte.
 *
 * Abre uma linha em `source_runs` ao começar e fecha-a no fim, aconteça o que
 * acontecer. É daqui que sai o painel de saúde da recolha: uma execução que
 * fica eternamente em `running` é, ela própria, o sinal de que o processo
 * morreu a meio — por isso a linha abre antes de o adaptador correr, e não
 * depois de tudo correr bem.
 */

import type { RunStatus } from '@coreto/core';
import type { HttpCounters } from './http.js';

export interface RunCounters {
  itemsFound: number;
  itemsNew: number;
  itemsUpdated: number;
  itemsUnchanged: number;
  itemsRejected: number;
}

export function emptyCounters(): RunCounters {
  return { itemsFound: 0, itemsNew: 0, itemsUpdated: 0, itemsUnchanged: 0, itemsRejected: 0 };
}

export interface RunWarning {
  message: string;
  detail?: string;
}

export interface OpenRunInput {
  sourceId: string;
  triggeredBy: string;
}

export interface CloseRunInput {
  status: RunStatus;
  durationMs: number;
  counters: RunCounters;
  http: HttpCounters;
  layoutDrift: boolean;
  warnings: RunWarning[];
  error: string | null;
}

/** O que o registo de execuções precisa da base de dados. `db.ts` implementa. */
export interface RunStore {
  openRun(input: OpenRunInput): Promise<string | null>;
  closeRun(runId: string, input: CloseRunInput): Promise<void>;
}

export interface RunLoggerOptions {
  sourceId: string;
  /** `null` numa simulação ou sem credenciais: escreve-se só na consola. */
  store?: RunStore | null;
  triggeredBy?: string;
  now?: () => number;
  output?: (line: string) => void;
}

/**
 * Tecto de avisos guardados.
 *
 * Uma fonte com o seletor errado produz um aviso por item. Guardar os
 * quatrocentos não diz mais do que guardar os primeiros vinte e enche a
 * coluna `warnings` de ruído.
 */
const MAX_STORED_WARNINGS = 20;

export class RunLogger {
  readonly sourceId: string;

  private readonly store: RunStore | null;
  private readonly triggeredBy: string;
  private readonly now: () => number;
  private readonly output: (line: string) => void;

  private runId: string | null = null;
  private startedAtMs = 0;
  private started = false;
  private finished = false;
  private readonly collected: RunWarning[] = [];
  private warningCount = 0;

  constructor(options: RunLoggerOptions) {
    this.sourceId = options.sourceId;
    this.store = options.store ?? null;
    this.triggeredBy = options.triggeredBy ?? 'cron';
    this.now = options.now ?? (() => Date.now());
    this.output = options.output ?? ((line) => console.log(line));
  }

  /** Abre a linha de execução. Chamar duas vezes não abre duas linhas. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.startedAtMs = this.now();
    this.runId =
      (await this.store?.openRun({ sourceId: this.sourceId, triggeredBy: this.triggeredBy })) ??
      null;
  }

  info(message: string, detail?: string): void {
    this.output(`[${this.sourceId}] ${message}${detail ? ` — ${detail}` : ''}`);
  }

  warn(message: string, detail?: string): void {
    this.warningCount += 1;
    if (this.collected.length < MAX_STORED_WARNINGS) {
      this.collected.push(detail === undefined ? { message } : { message, detail });
    }
    this.output(`[${this.sourceId}] aviso: ${message}${detail ? ` — ${detail}` : ''}`);
  }

  get warnings(): readonly RunWarning[] {
    return this.collected;
  }

  get totalWarnings(): number {
    return this.warningCount;
  }

  /** Fecha a linha com o resultado. Chamar duas vezes não a reescreve. */
  async finish(input: {
    status: RunStatus;
    counters: RunCounters;
    http: HttpCounters;
    layoutDrift?: boolean;
    error?: string | null;
  }): Promise<void> {
    if (this.finished) return;
    this.finished = true;

    const warnings = [...this.collected];
    if (this.warningCount > this.collected.length) {
      warnings.push({
        message: 'avisos omitidos',
        detail: `mais ${this.warningCount - this.collected.length} não guardados`,
      });
    }

    if (this.runId && this.store) {
      await this.store.closeRun(this.runId, {
        status: input.status,
        durationMs: Math.max(0, this.now() - this.startedAtMs),
        counters: input.counters,
        http: input.http,
        layoutDrift: input.layoutDrift ?? false,
        warnings,
        error: input.error ?? null,
      });
    }
  }
}
