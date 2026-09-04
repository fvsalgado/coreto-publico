/**
 * Recolha a partir de instantâneos guardados à mão.
 *
 * Há agendas que existem, que são públicas, e que a recolha noturna não
 * alcança — a de Torres Novas responde 503 «Application Blocked» a um WAF,
 * também ao executor do GitHub Actions. Contornar o bloqueio não é recolha, e
 * não é o que esta casa faz. A saída é outra: alguém abre a página no browser,
 * guarda-a, e a agenda entra por aqui.
 *
 * **O que este ficheiro NÃO é: um segundo recoletor.** Não tem seletores, não
 * sabe ler HTML e não decide nada sobre um evento. O que faz é servir os
 * ficheiros guardados ao adaptador verdadeiro da fonte, como se fossem a
 * resposta do servidor. Tudo o que sai daqui saiu do mesmo código que sairia
 * de uma recolha a sério: os mesmos seletores, as mesmas datas, a mesma
 * taxonomia, a mesma impressão digital e o mesmo `source_key`.
 *
 * Essa última parte é a que importa para o dia em que a câmara autorizar o
 * recoletor: os eventos entram com a chave que a fonte lhes dá (`eb-493`),
 * por isso a primeira recolha a sério reconhece-os e atualiza-os em vez de os
 * duplicar.
 *
 * Uso:
 *
 *     pnpm --filter @coreto/ingest exec tsx src/instantaneo.ts plano.json
 *
 * O plano diz qual é a fonte, que ficheiro corresponde a que endereço, e o
 * que se sabe de cada evento que a listagem não dava. A saída é SQL para uma
 * migração — nada é escrito na base a partir daqui.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { harmonizeEvent, type EventRow, type SessionRow } from '@coreto/core';
import { findAdapter } from './adapters/index.js';
import { sourceRowSchema, type SourceRow } from './adapter.js';
import { HttpClient } from './http.js';
import { deterministicEventId, type Lookups } from './pipeline.js';
import { RunLogger } from './run-logger.js';

// ---------------------------------------------------------------------------
// O plano
// ---------------------------------------------------------------------------

const paginaSchema = z.object({
  /** O endereço que a página tinha. É a base de todos os links relativos. */
  url: z.string().url(),
  /** O ficheiro guardado, relativo ao plano. */
  ficheiro: z.string().min(1),
});

/**
 * O que se sabe de um evento e a listagem não dava.
 *
 * Chaveado pelo `source_key` que o adaptador produz — `eb-493` —, para que a
 * correção continue a casar mesmo que o título mude.
 *
 * Cada campo que aqui entra é bloqueado em `manual_overrides`, e é por isso
 * que existe: a recolha do dia em que a fonte abrir não pode escrever
 * «Torres Novas» por cima de «Museu Municipal Carlos Reis».
 */
const correccaoSchema = z.object({
  venueId: z.string().min(1).optional(),
  locationName: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  /** Porque é que se sabe isto. Vai para a nota do bloqueio. */
  porque: z.string().min(1),
});

const planoSchema = z.object({
  fonte: sourceRowSchema,
  lookups: z.object({
    categoryAliases: z.record(z.string()),
    venueAliases: z.record(z.string()),
    /**
     * Concelho → (alias → espaço). Opcional para os planos que já existem.
     *
     * Os alias presos a um concelho, para o instantâneo resolver como a
     * recolha ao vivo resolve.
     */
    venueAliasesByMunicipality: z.record(z.record(z.string())).optional(),
    venueKinds: z.record(z.string()),
    /**
     * Concelho de cada espaço. Opcional para os planos que já existem.
     *
     * Serve para o mesmo que serve na recolha ao vivo: um nome que se repete
     * na região não pode casar com o espaço do concelho errado.
     */
    venueMunicipalities: z.record(z.string()).optional(),
  }),
  paginas: z.array(paginaSchema).min(1),
  /** Quem fez o levantamento. Fica em `manual_overrides.actor`. */
  actor: z.string().min(1),
  /** O instante que os eventos levam em `published_at`. */
  agora: z.string().datetime(),
  correccoes: z.record(correccaoSchema).default({}),
});

export type Plano = z.infer<typeof planoSchema>;

// ---------------------------------------------------------------------------
// O cliente que responde dos ficheiros
// ---------------------------------------------------------------------------

/**
 * Um `HttpClient` que só conhece as páginas guardadas.
 *
 * Tudo o resto responde 404, e isso é deliberado: um adaptador que vá buscar
 * a página de cada evento, ou o feed da agenda, tem de se ficar pelo que o
 * instantâneo tem. A alternativa era ir à rede a meio de uma importação de
 * ficheiros — e a rede, nesta fonte, é exatamente o que não responde.
 */
export function clienteDeInstantaneos(paginas: ReadonlyMap<string, string>): HttpClient {
  return new HttpClient({
    // Sem espera entre pedidos: não há servidor nenhum do outro lado.
    minHostIntervalMs: 0,
    maxAttempts: 1,
    fetchImpl: async (input) => {
      const endereco = typeof input === 'string' ? input : input.toString();
      const corpo = paginas.get(endereco) ?? paginas.get(endereco.replace(/\/+$/, ''));
      if (corpo === undefined) {
        return new Response('', { status: 404, headers: { 'content-type': 'text/html' } });
      }
      return new Response(corpo, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });
}

// ---------------------------------------------------------------------------
// A recolha
// ---------------------------------------------------------------------------

export interface EventoDoInstantaneo {
  event: EventRow;
  sessions: SessionRow[];
  /** Campos escritos à mão neste evento, para bloquear. */
  bloqueados: string[];
  porque: string | null;
}

export interface ResultadoDoInstantaneo {
  eventos: EventoDoInstantaneo[];
  /** Chaves que o plano corrigia e o adaptador não trouxe. Um plano desatualizado. */
  correccoesOrfas: string[];
}

export async function recolherDeInstantaneos(
  plano: Plano,
  paginas: ReadonlyMap<string, string>,
  log: RunLogger,
): Promise<ResultadoDoInstantaneo> {
  const fonte: SourceRow = {
    ...plano.fonte,
    // As páginas do instantâneo são as únicas que existem, e é preciso dizê-lo
    // ao adaptador: o `config` da fonte aponta para a agenda ao vivo.
    config: {
      ...plano.fonte.config,
      listUrls: plano.paginas.map((pagina) => pagina.url),
      // Sem feed nem páginas de evento: não estão no instantâneo, e um 404 a
      // meio de cada evento só enche o registo de avisos.
      skipFeed: true,
      maxDetailPages: 0,
    },
  };

  const adapter = findAdapter(fonte.adapter);
  if (!adapter) throw new Error(`adaptador desconhecido: ${fonte.adapter}`);

  const brutos = await adapter.fetchEvents({
    source: fonte,
    http: clienteDeInstantaneos(paginas),
    log,
  });

  const lookups: Pick<
    Lookups,
    | 'categoryAliases'
    | 'venueAliases'
    | 'venueAliasesByMunicipality'
    | 'venueKinds'
    | 'venueMunicipalities'
  > = {
    categoryAliases: new Map(Object.entries(plano.lookups.categoryAliases)),
    venueAliases: new Map(Object.entries(plano.lookups.venueAliases)),
    venueAliasesByMunicipality: new Map(
      Object.entries(plano.lookups.venueAliasesByMunicipality ?? {}).map(
        ([concelho, aliases]) => [concelho, new Map(Object.entries(aliases))] as const,
      ),
    ),
    venueKinds: new Map(Object.entries(plano.lookups.venueKinds)),
    venueMunicipalities: new Map(Object.entries(plano.lookups.venueMunicipalities ?? {})),
  };

  const municipalityId = plano.fonte.municipality_id;
  if (!municipalityId) throw new Error('a fonte tem de dizer o concelho');

  const usadas = new Set<string>();
  const eventos: EventoDoInstantaneo[] = [];

  for (const bruto of brutos) {
    const correccao = plano.correccoes[bruto.sourceKey];
    if (correccao) usadas.add(bruto.sourceKey);

    const harmonizado = harmonizeEvent(
      {
        ...bruto,
        // A correção entra ANTES do harmonizador, e não depois: assim o nome
        // do espaço passa pelo mesmo `resolveVenue` de sempre, a descrição
        // conta para a categoria e para a confiança, e o `content_hash` sai
        // coerente com o que lá está.
        venueId: correccao?.venueId ?? bruto.venueId,
        locationName: correccao?.locationName ?? bruto.locationName,
        description: correccao?.description ?? bruto.description,
      },
      {
        municipalityId,
        sourceId: fonte.id,
        categoryAliases: lookups.categoryAliases,
        venueAliases: lookups.venueAliases,
        venueAliasesByMunicipality: lookups.venueAliasesByMunicipality,
        venueKinds: lookups.venueKinds,
        venueMunicipalities: lookups.venueMunicipalities,
        defaultVenueId: fonte.venue_id,
        makeId: (candidato) => deterministicEventId(fonte.id, candidato.sourceKey),
        now: () => plano.agora,
      },
    );

    const evento = harmonizado.event;
    evento.status = 'published';
    evento.published_at = plano.agora;

    const bloqueados: string[] = [];
    if (correccao?.venueId) bloqueados.push('venue_id');
    if (correccao?.locationName) bloqueados.push('location_name');
    if (correccao?.description) bloqueados.push('description', 'description_short');

    eventos.push({
      event: evento,
      sessions: harmonizado.sessions,
      bloqueados,
      porque: correccao?.porque ?? null,
    });
  }

  return {
    eventos,
    correccoesOrfas: Object.keys(plano.correccoes).filter((chave) => !usadas.has(chave)),
  };
}

// ---------------------------------------------------------------------------
// A saída
// ---------------------------------------------------------------------------

/** Um valor SQL, com o `null` a sair `null` e não `'null'`. */
export function literal(valor: unknown): string {
  if (valor === null || valor === undefined) return 'null';
  if (typeof valor === 'boolean') return valor ? 'true' : 'false';
  if (typeof valor === 'number') return String(valor);
  if (Array.isArray(valor)) {
    return valor.length === 0
      ? `'{}'::text[]`
      : `array[${valor.map((item) => literal(item)).join(', ')}]::text[]`;
  }
  if (typeof valor === 'object') return `${literal(JSON.stringify(valor))}::jsonb`;
  return `'${String(valor).replace(/'/g, "''")}'`;
}

/**
 * As colunas que se escrevem, por ordem.
 *
 * Escritas à mão de propósito. Percorrer as chaves do objeto punha aqui
 * `agenda_date`, que é gerada, e rebentava a gravação — e punha-a em silêncio
 * no dia em que alguém acrescentasse um campo ao harmonizador.
 */
const COLUNAS = [
  'id',
  'slug',
  'title',
  'title_raw',
  'subtitle',
  'description',
  'description_short',
  'municipality_id',
  'venue_id',
  'location_name',
  'location_address',
  'parish',
  'latitude',
  'longitude',
  'how_to_arrive',
  'series_id',
  'category_slug',
  'category_confidence',
  'categories_raw',
  'tags',
  'audience',
  'min_age',
  'date_start',
  'date_end',
  'is_ongoing',
  'recurrence',
  'duration_minutes',
  'is_free',
  'price_min',
  'price_max',
  'price_display',
  'price_raw',
  'ticketing_url',
  'wheelchair_accessible',
  'has_sign_language',
  'has_audio_description',
  'has_subtitles',
  'is_relaxed_performance',
  'accessibility_notes',
  'image_url',
  'image_credit',
  'image_alt',
  'status',
  'origin',
  'confidence',
  'source_id',
  'source_key',
  'source_url',
  'fingerprint',
  'content_hash',
  'published_at',
  'last_seen_at',
] as const;

/**
 * Os eventos todos numa instrução, e não uma instrução por evento.
 *
 * Vinte e dois `insert` separados repetem vinte e duas vezes a lista das
 * cinquenta colunas e vinte e duas vezes a lista do `do update set` — cem
 * quilobytes de migração para dezasseis de programação. Uma instrução com
 * vinte e duas linhas de valores diz o mesmo e lê-se.
 *
 * O `on conflict (id) do update` fica na mesma: a migração tem de poder correr
 * duas vezes sem duplicar nada, e tem de poder correr outra vez depois de o
 * instantâneo ser refeito.
 */
export function sqlDosEventos(eventos: readonly EventoDoInstantaneo[], actor: string): string[] {
  if (eventos.length === 0) return [];

  const linhas: string[] = [];

  linhas.push(`insert into public.events (${COLUNAS.join(', ')}) values`);
  linhas.push(
    eventos
      .map((evento) => {
        const linha = evento.event as unknown as Record<string, unknown>;
        return `  (${COLUNAS.map((coluna) => literal(linha[coluna])).join(', ')})`;
      })
      .join(',\n'),
  );
  linhas.push('on conflict (id) do update set');
  linhas.push(
    COLUNAS.filter((coluna) => coluna !== 'id')
      .map((coluna) => `  ${coluna} = excluded.${coluna}`)
      .join(',\n'),
  );
  linhas.push(', updated_at = now();', '');

  const sessoes = eventos.flatMap((evento) =>
    evento.sessions.map(
      (sessao) =>
        `  (${literal(evento.event.id)}, ${literal(sessao.session_date)}, ${literal(sessao.start_time)}, ${literal(sessao.end_time)})`,
    ),
  );
  if (sessoes.length > 0) {
    linhas.push(
      'insert into public.event_sessions (event_id, session_date, start_time, end_time) values',
      sessoes.join(',\n'),
      'on conflict do nothing;',
      '',
    );
  }

  // Os bloqueios vêm depois de tudo escrito, e não podia ser de outra maneira:
  // `lock_event_fields` guarda o valor que o evento tem NESTE momento. Bloquear
  // antes de escrever gravava em `manual_overrides` o valor antigo.
  for (const evento of eventos) {
    if (evento.bloqueados.length === 0) continue;
    linhas.push(
      `select public.lock_event_fields(${literal(evento.event.id)}, ${literal(evento.bloqueados)}, ${literal(actor)}, ${literal(evento.porque)});`,
    );
  }

  return linhas;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export async function main(argv: readonly string[]): Promise<number> {
  const caminho = argv[0];
  if (!caminho) {
    process.stderr.write('uso: tsx src/instantaneo.ts <plano.json>\n');
    return 2;
  }

  const raiz = dirname(resolve(caminho));
  const plano = planoSchema.parse(JSON.parse(readFileSync(caminho, 'utf8')));

  const paginas = new Map<string, string>();
  for (const pagina of plano.paginas) {
    paginas.set(pagina.url, readFileSync(resolve(raiz, pagina.ficheiro), 'utf8'));
  }

  const log = new RunLogger({ sourceId: plano.fonte.id, output: (linha) => console.error(linha) });
  const resultado = await recolherDeInstantaneos(plano, paginas, log);

  if (resultado.correccoesOrfas.length > 0) {
    // Não é aviso, é erro: uma correção órfã quer dizer que o instantâneo já
    // não tem o evento que o plano corrigia, e o SQL que sairia daqui punha o
    // nome do concelho onde estava o nome do espaço.
    process.stderr.write(
      `correções sem evento correspondente: ${resultado.correccoesOrfas.join(', ')}\n`,
    );
    return 1;
  }

  process.stdout.write(`${sqlDosEventos(resultado.eventos, plano.actor).join('\n')}\n`);

  process.stderr.write(`${resultado.eventos.length} eventos\n`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2))
    .then((codigo) => process.exit(codigo))
    .catch((erro: unknown) => {
      process.stderr.write(`${erro instanceof Error ? erro.message : String(erro)}\n`);
      process.exit(1);
    });
}
