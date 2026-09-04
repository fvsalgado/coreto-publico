/**
 * Entrada da recolha.
 *
 *   pnpm ingest --all
 *   pnpm ingest --source cm-tomar --source teatro-virginia
 *   pnpm ingest --all --dry-run
 *
 * Imprime um resumo por fonte e sai com código diferente de zero se alguma
 * falhou — é isso que faz o cron da noite avisar em vez de ficar calado.
 */

import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { findAdapter, knownAdapterIds } from './adapters/index.js';
import { createDatabase } from './db.js';
import { HttpClient } from './http.js';
import { runPipeline, type SourceOutcome } from './pipeline.js';

const USAGE = `Recolha de agendas do Coreto.

Uso:
  tsx src/cli.ts --all [--dry-run]
  tsx src/cli.ts --source <id> [--source <id>...] [--dry-run]

Opções:
  --all         Corre todas as fontes ativas.
  --source <id> Corre só esta fonte. Pode repetir-se ou separar-se por vírgulas.
  --dry-run     Lê tudo e não escreve nada. Serve para afinar seletores.
  --help        Mostra esta ajuda.

Adaptadores registados: ${knownAdapterIds().join(', ')}`;

const optionsSchema = z.object({
  sources: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  all: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  help: z.boolean().default(false),
});

type CliOptions = z.infer<typeof optionsSchema>;

export function parseArgs(argv: readonly string[]): CliOptions {
  const sources: string[] = [];
  let all = false;
  let dryRun = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--all':
        all = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--help':
      case '-h':
        help = true;
        break;
      case '--source': {
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) throw new Error('«--source» precisa de um id');
        sources.push(
          ...value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean),
        );
        index += 1;
        break;
      }
      default:
        throw new Error(`opção desconhecida: ${argument ?? ''}`);
    }
  }

  return optionsSchema.parse({ sources, all, dryRun, help });
}

function pad(value: string | number, width: number): string {
  return String(value).padEnd(width, ' ');
}

function label(outcome: SourceOutcome): string {
  if (outcome.skipped) return 'saltada';
  switch (outcome.status) {
    case 'success':
      return 'sucesso';
    case 'partial':
      return outcome.layoutDrift ? 'layout?' : 'parcial';
    case 'failed':
      return 'falhou';
    default:
      return outcome.status;
  }
}

export function formatSummary(outcomes: readonly SourceOutcome[], elapsedMs: number): string {
  const lines = [
    `${pad('fonte', 24)}${pad('âmbito', 20)}${pad('estado', 10)}${pad('itens', 7)}${pad('novos', 7)}${pad('atual.', 7)}${pad('iguais', 7)}${pad('fila', 6)}erro`,
  ];

  for (const outcome of outcomes) {
    lines.push(
      [
        pad(outcome.sourceId, 24),
        // O concelho — ou a região, numa fonte regional. Este resumo é o que
        // o issue de falha cita: com mais de uma região na mesma recolha, a
        // linha tem de dizer de quem é o problema.
        pad(outcome.ambito, 20),
        pad(label(outcome), 10),
        pad(outcome.counters.itemsFound, 7),
        pad(outcome.counters.itemsNew, 7),
        pad(outcome.counters.itemsUpdated, 7),
        pad(outcome.counters.itemsUnchanged, 7),
        pad(outcome.submitted, 6),
        outcome.error ?? '',
      ].join(''),
    );
  }

  const failed = outcomes.filter((outcome) => outcome.status === 'failed').length;
  const seconds = Math.round(elapsedMs / 100) / 10;
  lines.push('');
  lines.push(`${outcomes.length} fontes em ${seconds}s — ${failed} com falha.`);
  return lines.join('\n');
}

async function main(): Promise<void> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`\n${USAGE}`);
    process.exitCode = 1;
    return;
  }

  if (options.help || (!options.all && options.sources.length === 0)) {
    console.log(USAGE);
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  const db = createDatabase();
  if (!db) {
    console.error(
      'Sem credenciais: define SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.',
    );
    process.exitCode = 1;
    return;
  }

  const sources = await db.loadSources(options.all ? undefined : options.sources);
  if (sources.length === 0) {
    console.error('Nenhuma fonte ativa corresponde ao pedido.');
    process.exitCode = 1;
    return;
  }

  for (const source of sources) {
    if (!findAdapter(source.adapter)) {
      console.error(
        `A fonte «${source.id}» aponta para o adaptador «${source.adapter}», que não existe.`,
      );
    }
  }

  if (options.dryRun) console.log('Simulação: nada será escrito.\n');

  const startedAt = Date.now();
  const outcomes = await runPipeline(sources, {
    db,
    http: new HttpClient(),
    dryRun: options.dryRun,
    triggeredBy: options.dryRun ? 'dry-run' : 'cli',
  });

  console.log(`\n${formatSummary(outcomes, Date.now() - startedAt)}`);
  process.exitCode = outcomes.some((outcome) => outcome.status === 'failed') ? 1 : 0;
}

/**
 * Só corre quando é o ficheiro executado.
 *
 * Sem esta guarda, importar o CLI para lhe testar o leitor de argumentos
 * disparava uma recolha a sério.
 */
const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  });
}
