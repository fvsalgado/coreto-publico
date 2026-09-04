/**
 * Acesso à base de dados a partir da recolha.
 *
 * Corre com a chave de serviço — passa por cima do RLS — e por isso vive num
 * processo que nunca é exposto à internet. Sem credenciais, `createDatabase()`
 * devolve `null` e o pipeline corre em seco: dá para desenvolver um adaptador
 * novo sem base de dados nenhuma.
 *
 * Tudo o que vem de fora passa por Zod, incluindo o que vem da própria base:
 * a coluna `config` das fontes é escrita à mão em SQL, e uma gralha aí tem de
 * dar uma mensagem legível em vez de um `undefined` três camadas mais à
 * frente.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { FALHAS_ATE_PAUSA, HORAS_EM_PAUSA, type EventRow, type SessionRow } from '@coreto/core';
import { sourceRowSchema, type SourceRow } from './adapter.js';
import type { CloseRunInput, OpenRunInput, RunStore } from './run-logger.js';

const envSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
});

/**
 * Colunas de um evento que a recolha lê antes de escrever.
 *
 * São as que entram na decisão de fusão. Selecionar `*` traria também o `raw`
 * de todos os eventos da fonte — megabytes de JSON que ninguém lê.
 */
const STORED_KEYS = [
  'id',
  'slug',
  'title',
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
  'image_width',
  'image_height',
  'status',
  'origin',
  'confidence',
  'source_id',
  'source_key',
  'source_url',
  'submission_id',
  'fingerprint',
  'duplicate_group_id',
  'is_canonical',
  'content_hash',
  'published_at',
  'created_at',
] as const;

type StoredKey = (typeof STORED_KEYS)[number];

/** Um evento tal como já está guardado. */
export type StoredEvent = Pick<EventRow, StoredKey>;

const STORED_EVENT_COLUMNS = STORED_KEYS.join(', ');

const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);
const stringArray = z
  .array(z.string())
  .nullish()
  .transform((value) => value ?? []);
const flag = z
  .boolean()
  .nullish()
  .transform((value) => value ?? false);
const nullableFlag = z
  .boolean()
  .nullish()
  .transform((value) => value ?? null);

/**
 * Número que também aceita a forma textual.
 *
 * As colunas `numeric` chegam ora como número ora como cadeia, consoante o
 * caminho que a resposta faz. Aceitar as duas evita descartar um evento
 * inteiro por causa de um preço.
 */
const nullableNumber = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  });

/**
 * Inteiro, ou nulo — e nulo também para o que não é um inteiro.
 *
 * São as medidas dos cartazes, e a coluna é `integer`. Um valor que chegue
 * como outra coisa não se arredonda nem se aproxima: uma medida aproximada
 * reserva a caixa errada, que é o problema que estas colunas vieram resolver.
 */
const nullableInteger = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  });

const audienceSchema = z
  .enum([
    'all_ages',
    'family',
    'children',
    'youth',
    'adults',
    'seniors',
    'schools',
    'professionals',
  ])
  .nullish()
  .transform((value) => value ?? null);

const storedEventSchema: z.ZodType<StoredEvent, z.ZodTypeDef, unknown> = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  subtitle: nullableString,
  description: nullableString,
  description_short: nullableString,
  municipality_id: z.string(),
  venue_id: nullableString,
  location_name: nullableString,
  location_address: nullableString,
  parish: nullableString,
  latitude: nullableNumber,
  longitude: nullableNumber,
  how_to_arrive: nullableString,
  series_id: nullableString,
  category_slug: nullableString,
  category_confidence: nullableNumber,
  categories_raw: stringArray,
  tags: stringArray,
  audience: audienceSchema,
  min_age: nullableNumber,
  date_start: nullableString,
  date_end: nullableString,
  is_ongoing: flag,
  duration_minutes: nullableNumber,
  is_free: flag,
  price_min: nullableNumber,
  price_max: nullableNumber,
  price_display: nullableString,
  price_raw: nullableString,
  ticketing_url: nullableString,
  wheelchair_accessible: nullableFlag,
  has_sign_language: flag,
  has_audio_description: flag,
  has_subtitles: flag,
  is_relaxed_performance: flag,
  accessibility_notes: nullableString,
  image_url: nullableString,
  image_width: nullableInteger,
  image_height: nullableInteger,
  image_credit: nullableString,
  image_alt: nullableString,
  status: z.enum(['draft', 'published', 'hidden', 'cancelled', 'postponed', 'archived']),
  origin: z.enum(['scraper', 'email', 'form', 'manual']),
  confidence: nullableNumber.transform((value) => value ?? 0.5),
  source_id: nullableString,
  source_key: nullableString,
  source_url: nullableString,
  submission_id: nullableString,
  fingerprint: z.string(),
  duplicate_group_id: nullableString,
  is_canonical: z
    .boolean()
    .nullish()
    .transform((value) => value ?? true),
  content_hash: nullableString,
  published_at: nullableString,
  created_at: z.string(),
});

/**
 * Campos que pertencem a quem modera, não a quem recolhe.
 *
 * O `slug` está aqui porque é o endereço público do evento: mudá-lo parte
 * ligações que já foram partilhadas. O `status` está aqui porque uma recolha
 * que reescrevesse o estado despublicava, todas as noites, tudo o que alguém
 * tinha publicado de manhã.
 */
const MODERATION_OWNED: readonly StoredKey[] = [
  'id',
  'slug',
  'status',
  'published_at',
  'submission_id',
  'duplicate_group_id',
  'is_canonical',
  'created_at',
];

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function keepIfEmpty<K extends StoredKey>(
  target: EventRow,
  source: Pick<EventRow, K>,
  key: K,
): void {
  if (isEmpty(target[key]) && !isEmpty(source[key])) target[key] = source[key];
}

function copyField<K extends StoredKey>(target: EventRow, source: Pick<EventRow, K>, key: K): void {
  target[key] = source[key];
}

/**
 * Funde o que já está guardado com o que a recolha desta noite trouxe.
 *
 * A regra que manda: **um valor preenchido nunca é substituído por vazio.**
 * Uma recolha em que o seletor da descrição deixou de casar traz `null` em
 * todas as descrições — e sem esta regra apagava, de madrugada e sem ninguém
 * ver, o texto de todos os eventos do concelho. Perder informação é o único
 * erro que esta casa não sabe desfazer.
 *
 * O preço é tratado em bloco: se a recolha não trouxe preço nenhum, fica o
 * que lá estava por inteiro, incluindo o `is_free`. De outra maneira um
 * evento gratuito passava a pago (ou o contrário) por o seletor do preço ter
 * mudado de nome.
 */
export function mergeEventUpdate(existing: StoredEvent | null, incoming: EventRow): EventRow {
  if (!existing) return incoming;

  const merged: EventRow = { ...incoming };
  for (const key of STORED_KEYS) keepIfEmpty(merged, existing, key);
  for (const key of MODERATION_OWNED) copyField(merged, existing, key);

  const lostPrice =
    isEmpty(incoming.price_raw) && isEmpty(incoming.price_display) && incoming.price_min === null;
  if (lostPrice) {
    merged.is_free = existing.is_free;
    merged.price_min = existing.price_min;
    merged.price_max = existing.price_max;
    merged.price_display = existing.price_display;
    merged.price_raw = existing.price_raw;
  }

  // A confiança sobe com revisão humana e com campos resolvidos; nunca desce
  // por a recolha de hoje ter visto menos do que a de ontem.
  merged.confidence = Math.max(existing.confidence, incoming.confidence);

  return merged;
}

export interface SubmissionInput {
  sourceId: string;
  municipalityId: string | null;
  venueId: string | null;
  fingerprint: string;
  confidence: number;
  /** Motivo por que não foi direto para o catálogo — é o que o moderador lê primeiro. */
  reason: string;
  payload: Record<string, unknown>;
  sourceUrl: string | null;
}

/**
 * Os estados de submissão que a recolha tem de ir ler antes de voltar a
 * perguntar a mesma coisa.
 *
 * `approved` e `merged` ficam de fora de propósito: o que foi aprovado passou
 * a evento, e um evento reconhece-se pelo `sourceKey` um passo antes — não
 * precisa da fila para nada.
 */
const ESTADOS_COM_MEMORIA = ['pending', 'needs_info', 'rejected', 'duplicate'] as const;

/**
 * O que a fila de moderação já sabe sobre uma fonte.
 *
 * São duas memórias com granularidades diferentes, e a diferença é o ponto:
 *
 *   · **`aEspera`** guarda `sourceKey`. Uma submissão por decidir é sobre
 *     *aquele item da fonte*, e enquanto lá estiver não se pede outra vez —
 *     mesmo que a fonte tenha entretanto corrigido o título.
 *   · **`decididasContra`** guarda `fingerprint` — título normalizado, data e
 *     concelho. Uma recusa é um juízo sobre **o que ali estava escrito**, não
 *     sobre o endereço onde estava. Se a fonte mudar o que diz, a impressão
 *     digital muda com ela e o candidato volta a ser mostrado a uma pessoa,
 *     que é exactamente o que se quer: ninguém recusou *isto*, recusou aquilo.
 *
 * Sem a segunda, uma recusa durava até à meia-noite. Em 30 de agosto de 2026
 * as três linhas por decidir na fila eram, uma a uma, as três que tinham sido
 * recusadas quatro horas antes — o PDF da agenda de Mação, o aviso de
 * adiamento, o programa de cinema do Sardoal sem uma única data. O moderador
 * fazia o trabalho e a recolha desfazia-o.
 */
export interface MemoriaDaFila {
  /** `sourceKey` das submissões desta fonte à espera de decisão. */
  aEspera: Set<string>;
  /** `fingerprint` das que já foram recusadas ou dadas por duplicadas. */
  decididasContra: Set<string>;
}

/**
 * Um nome de espaço que a recolha não conseguiu ligar ao catálogo.
 *
 * O concelho é o **do evento** e não o da fonte, e a diferença só aparece nas
 * fontes regionais — o CAMINHOS percorre os onze. Enquanto se gravou o da
 * fonte, cada nome que o CAMINHOS trazia entrava na fila sem concelho
 * nenhum, e um alias preso a um concelho nunca o conseguia tirar de lá: a
 * vista compara os dois, e `'abrantes' = null` não é verdade. A fila ficava
 * com linhas que ninguém podia fechar, que é o contrário do que uma fila de
 * trabalho serve.
 */
export interface EspacoPorResolver {
  name: string;
  municipalityId: string | null;
}

export interface SourceHealthInput {
  succeeded: boolean;
  error: string | null;
  itemsFound: number;
  /** Contagem anterior de falhas seguidas, para saber quando abrir o disjuntor. */
  consecutiveFailures: number;
  baseline: number | null;
  /** Não recalibra a linha de base quando a leitura não é de confiança. */
  updateBaseline: boolean;
}

/**
 * Falhas seguidas a partir das quais a fonte deixa de ser tentada.
 *
 * O número mora em `@coreto/core` e não aqui: é uma promessa publicada em
 * `/fontes`, e a página tem de o poder ler. Ver `packages/core/src/recolha.ts`.
 */
export const CIRCUIT_FAILURE_THRESHOLD = FALHAS_ATE_PAUSA;

/** Quanto tempo o disjuntor fica aberto. Pela mesma razão, mora em core. */
export const CIRCUIT_OPEN_HOURS = HORAS_EM_PAUSA;

export interface IngestDatabase extends RunStore {
  loadSources(ids?: readonly string[]): Promise<SourceRow[]>;
  loadCategoryAliases(): Promise<Map<string, string>>;
  /** Os alias que valem em toda a região. */
  loadVenueAliases(): Promise<Map<string, string>>;
  /** Concelho → (alias → espaço): os alias presos a um concelho só. */
  loadVenueAliasesByMunicipality(): Promise<Map<string, Map<string, string>>>;
  loadVenueKinds(): Promise<Map<string, string>>;
  /** Espaço → concelho, para eventos que só dizem onde e não em que concelho. */
  loadVenueMunicipalities(): Promise<Map<string, string>>;
  loadEventsBySourceKey(sourceId: string): Promise<Map<string, StoredEvent>>;
  /** O que a fila de moderação já sabe sobre esta fonte. Ver `MemoriaDaFila`. */
  loadSubmissionMemory(sourceId: string): Promise<MemoriaDaFila>;
  /**
   * Impressões digitais do que as OUTRAS fontes já têm no catálogo.
   *
   * É o que permite não publicar duas vezes a mesma festa quando a câmara e a
   * junta de freguesia a anunciam ambas. Carrega-se uma vez por execução de
   * fonte — não uma por evento.
   */
  loadFingerprintsFromOtherSources(sourceId: string): Promise<Set<string>>;
  saveEvent(event: EventRow): Promise<void>;
  touchEvents(ids: readonly string[], seenAt: string): Promise<void>;
  replaceSessions(eventId: string, sessions: readonly SessionRow[]): Promise<void>;
  saveSubmission(input: SubmissionInput): Promise<void>;
  recordUnknownTags(tags: readonly string[], exampleUrl: string | null): Promise<void>;
  /** Nomes de espaço que não casaram com o catálogo. Ver `unresolved_venues`. */
  recordUnresolvedVenues(
    espacos: readonly EspacoPorResolver[],
    exampleUrl: string | null,
  ): Promise<void>;
  updateSourceHealth(sourceId: string, input: SourceHealthInput): Promise<void>;
  /** Campos que uma pessoa corrigiu à mão e que a recolha não pode pisar. */
  loadLockedFields(eventIds: readonly string[]): Promise<Map<string, string[]>>;
  /** Marca em falta o que a fonte deixou de mostrar. Ver `reconcileDecision`. */
  reconcileMissing(sourceId: string, seenKeys: readonly string[]): Promise<ReconcileOutcome>;
  /** Quantos eventos publicados esta fonte tem — a base da trava de segurança. */
  countPublishedFromSource(sourceId: string): Promise<number>;
}

export interface ReconcileOutcome {
  marked: number;
  archived: number;
  recovered: number;
}

/** Quantos eventos de uma fonte se carregam antes de escrever. */
const MAX_EXISTING_EVENTS = 5_000;

/** Eventos marcados como vistos por consulta. */
const TOUCH_BATCH_SIZE = 200;

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

class SupabaseIngestDatabase implements IngestDatabase {
  constructor(private readonly client: SupabaseClient) {}

  async loadSources(ids?: readonly string[]): Promise<SourceRow[]> {
    let query = this.client.from('sources').select('*').eq('is_enabled', true);
    if (ids && ids.length > 0) query = query.in('id', [...ids]);

    const { data, error } = await query.order('id');
    if (error) fail('carregar fontes', error.message);

    const parsed = z.array(sourceRowSchema).safeParse(data ?? []);
    if (!parsed.success) {
      fail('carregar fontes', parsed.error.issues.map((issue) => issue.message).join('; '));
    }
    return parsed.data;
  }

  async loadCategoryAliases(): Promise<Map<string, string>> {
    const { data, error } = await this.client
      .from('category_aliases')
      .select('alias, category_slug');
    if (error) fail('carregar aliases de categoria', error.message);

    const rows = z
      .array(z.object({ alias: z.string(), category_slug: z.string() }))
      .parse(data ?? []);
    return new Map(rows.map((row) => [row.alias, row.category_slug]));
  }

  async loadVenueAliases(): Promise<Map<string, string>> {
    const rows = await this.lerAliasesDeEspaco();
    return new Map(
      rows.flatMap((row) =>
        row.municipality_id ? [] : [[row.alias, row.venue_id] as [string, string]],
      ),
    );
  }

  async loadVenueAliasesByMunicipality(): Promise<Map<string, Map<string, string>>> {
    const rows = await this.lerAliasesDeEspaco();
    const out = new Map<string, Map<string, string>>();
    for (const row of rows) {
      if (!row.municipality_id) continue;
      let doConcelho = out.get(row.municipality_id);
      if (!doConcelho) {
        doConcelho = new Map<string, string>();
        out.set(row.municipality_id, doConcelho);
      }
      doConcelho.set(row.alias, row.venue_id);
    }
    return out;
  }

  /**
   * A tabela toda, de uma vez.
   *
   * São duas leituras da mesma coisa — os regionais e os de concelho —, e
   * lê-las em dois pedidos era pedir duas vezes o que cabe num.
   */
  private async lerAliasesDeEspaco(): Promise<
    Array<{ alias: string; venue_id: string; municipality_id: string | null }>
  > {
    const { data, error } = await this.client
      .from('venue_aliases')
      .select('alias, venue_id, municipality_id');
    if (error) fail('carregar aliases de espaço', error.message);

    return z
      .array(
        z.object({
          alias: z.string(),
          venue_id: z.string(),
          municipality_id: z
            .string()
            .nullish()
            .transform((valor) => valor ?? null),
        }),
      )
      .parse(data ?? []);
  }

  async loadVenueKinds(): Promise<Map<string, string>> {
    const { data, error } = await this.client.from('venues').select('id, kind');
    if (error) fail('carregar espaços', error.message);

    const rows = z.array(z.object({ id: z.string(), kind: z.string() })).parse(data ?? []);
    return new Map(rows.map((row) => [row.id, row.kind]));
  }

  async loadVenueMunicipalities(): Promise<Map<string, string>> {
    const { data, error } = await this.client.from('venues').select('id, municipality_id');
    if (error) fail('carregar concelhos dos espaços', error.message);

    const rows = z
      .array(z.object({ id: z.string(), municipality_id: z.string().nullish() }))
      .parse(data ?? []);
    return new Map(
      rows.flatMap((row) => (row.municipality_id ? [[row.id, row.municipality_id] as const] : [])),
    );
  }

  async loadEventsBySourceKey(sourceId: string): Promise<Map<string, StoredEvent>> {
    const { data, error } = await this.client
      .from('events')
      .select(STORED_EVENT_COLUMNS)
      .eq('source_id', sourceId)
      .not('source_key', 'is', null)
      .limit(MAX_EXISTING_EVENTS);
    if (error) fail('carregar eventos da fonte', error.message);

    const out = new Map<string, StoredEvent>();
    for (const row of (data ?? []) as unknown[]) {
      const parsed = storedEventSchema.safeParse(row);
      if (!parsed.success || !parsed.data.source_key) continue;
      out.set(parsed.data.source_key, parsed.data);
    }
    return out;
  }

  async loadSubmissionMemory(sourceId: string): Promise<MemoriaDaFila> {
    const { data, error } = await this.client
      .from('submissions')
      .select('status, fingerprint, payload')
      .eq('source_id', sourceId)
      .in('status', [...ESTADOS_COM_MEMORIA])
      // Sem ordem, o corte de 2 000 é arbitrário. Com ela, o que se perde
      // numa fonte muito antiga são as decisões mais velhas — as que têm
      // menos hipóteses de voltar a aparecer na fonte.
      .order('created_at', { ascending: false })
      .limit(2_000);
    if (error) fail('carregar memória da fila de submissões', error.message);

    const shape = z.object({
      status: z.string(),
      fingerprint: nullableString,
      payload: z.object({ raw: z.object({ sourceKey: z.string() }) }).nullish(),
    });
    const aEspera = new Set<string>();
    const decididasContra = new Set<string>();
    for (const row of (data ?? []) as unknown[]) {
      const parsed = shape.safeParse(row);
      if (!parsed.success) continue;
      const { status, fingerprint, payload } = parsed.data;
      if (status === 'pending' || status === 'needs_info') {
        if (payload) aEspera.add(payload.raw.sourceKey);
      } else if (fingerprint) {
        decididasContra.add(fingerprint);
      }
    }
    return { aEspera, decididasContra };
  }

  async loadFingerprintsFromOtherSources(sourceId: string): Promise<Set<string>> {
    // `neq` e não `not in`: uma fonte não é duplicada de si própria — o que
    // ela repete resolve-se por `sourceKey`, um passo antes. E arquivados de
    // fora, que um evento arquivado é um evento que deixou de existir.
    const { data, error } = await this.client
      .from('events')
      .select('fingerprint')
      .neq('source_id', sourceId)
      .neq('status', 'archived')
      .not('fingerprint', 'is', null)
      .limit(MAX_EXISTING_EVENTS);
    if (error) fail('carregar impressões digitais de outras fontes', error.message);

    const out = new Set<string>();
    for (const row of (data ?? []) as { fingerprint: string | null }[]) {
      if (row.fingerprint) out.add(row.fingerprint);
    }
    return out;
  }

  async touchEvents(ids: readonly string[], seenAt: string): Promise<void> {
    // Em blocos: o `in` do PostgREST viaja no URL, e uma agenda grande passa
    // o limite de comprimento com folga.
    for (let start = 0; start < ids.length; start += TOUCH_BATCH_SIZE) {
      const batch = ids.slice(start, start + TOUCH_BATCH_SIZE);
      const { error } = await this.client
        .from('events')
        .update({ last_seen_at: seenAt })
        .in('id', [...batch]);
      if (error) fail('marcar eventos como vistos', error.message);
    }
  }

  async saveEvent(event: EventRow): Promise<void> {
    const { error } = await this.client.from('events').upsert(event, { onConflict: 'id' });
    if (error) fail(`gravar evento ${event.source_key ?? event.id}`, error.message);
  }

  async replaceSessions(eventId: string, sessions: readonly SessionRow[]): Promise<void> {
    const { error: removed } = await this.client
      .from('event_sessions')
      .delete()
      .eq('event_id', eventId);
    if (removed) fail('apagar sessões', removed.message);
    if (sessions.length === 0) return;

    const { error } = await this.client
      .from('event_sessions')
      .insert(sessions.map((session) => ({ ...session, event_id: eventId })));
    if (error) fail('gravar sessões', error.message);
  }

  async saveSubmission(input: SubmissionInput): Promise<void> {
    const { error } = await this.client.from('submissions').insert({
      channel: 'scraper',
      status: 'pending',
      payload: input.payload,
      source_id: input.sourceId,
      municipality_id: input.municipalityId,
      venue_id: input.venueId,
      fingerprint: input.fingerprint,
      confidence: input.confidence,
      review_notes: input.reason,
      raw_text: input.sourceUrl,
      extraction_status: 'skipped',
    });
    if (error) fail('gravar submissão', error.message);
  }

  async loadLockedFields(eventIds: readonly string[]): Promise<Map<string, string[]>> {
    const locks = new Map<string, string[]>();
    if (eventIds.length === 0) return locks;

    const { data, error } = await this.client
      .from('manual_overrides')
      .select('event_id, field')
      .in('event_id', [...eventIds]);
    if (error) fail('ler bloqueios manuais', error.message);

    for (const row of z
      .array(z.object({ event_id: z.string(), field: z.string() }))
      .parse(data ?? [])) {
      const fields = locks.get(row.event_id) ?? [];
      fields.push(row.field);
      locks.set(row.event_id, fields);
    }
    return locks;
  }

  async countPublishedFromSource(sourceId: string): Promise<number> {
    const { count, error } = await this.client
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', sourceId)
      .eq('status', 'published')
      .eq('origin', 'scraper');
    if (error) fail('contar eventos publicados da fonte', error.message);
    return count ?? 0;
  }

  async reconcileMissing(sourceId: string, seenKeys: readonly string[]): Promise<ReconcileOutcome> {
    const { data, error } = await this.client.rpc('reconcile_source_events', {
      p_source_id: sourceId,
      p_seen_keys: [...seenKeys],
    });
    if (error) fail('reconciliar o que desapareceu da fonte', error.message);

    const row = Array.isArray(data) ? data[0] : data;
    const parsed = z
      .object({ marked: z.number(), archived: z.number(), recovered: z.number() })
      .safeParse(row);
    return parsed.success ? parsed.data : { marked: 0, archived: 0, recovered: 0 };
  }

  async recordUnknownTags(tags: readonly string[], exampleUrl: string | null): Promise<void> {
    const unique = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 50);
    if (unique.length === 0) return;

    const { data, error } = await this.client
      .from('unknown_tags')
      .select('tag, hits')
      .in('tag', unique);
    if (error) fail('ler etiquetas desconhecidas', error.message);

    const known = new Map(
      z
        .array(z.object({ tag: z.string(), hits: z.number() }))
        .parse(data ?? [])
        .map((row) => [row.tag, row.hits]),
    );
    const now = new Date().toISOString();

    const fresh = unique.filter((tag) => !known.has(tag));
    if (fresh.length > 0) {
      const { error: insertError } = await this.client.from('unknown_tags').insert(
        fresh.map((tag) => ({
          tag,
          hits: 1,
          first_seen: now,
          last_seen: now,
          example_url: exampleUrl,
        })),
      );
      if (insertError) fail('gravar etiquetas desconhecidas', insertError.message);
    }

    // Uma etiqueta de cada vez: são poucas por execução, e um `update` por
    // linha evita ter de acrescentar uma função ao esquema só para somar um.
    for (const [tag, hits] of known) {
      const { error: updateError } = await this.client
        .from('unknown_tags')
        .update({ hits: hits + 1, last_seen: now })
        .eq('tag', tag);
      if (updateError) fail('atualizar etiqueta desconhecida', updateError.message);
    }
  }

  /**
   * Uma chamada por nome, à função que soma no servidor.
   *
   * A soma tem de ser atómica: duas fontes do mesmo concelho a correr na mesma
   * noite não podem perder uma contagem uma da outra. E são poucos nomes por
   * execução — quando forem muitos, é porque falta um alias, que é exatamente
   * o que esta fila serve para mostrar.
   */
  async recordUnresolvedVenues(
    espacos: readonly EspacoPorResolver[],
    exampleUrl: string | null,
  ): Promise<void> {
    const porChave = new Map<string, EspacoPorResolver>();
    for (const espaco of espacos) {
      const name = espaco.name.trim();
      if (!name) continue;
      porChave.set(`${espaco.municipalityId ?? ''}\u0000${name}`, { ...espaco, name });
    }

    for (const espaco of [...porChave.values()].slice(0, 50)) {
      const { error } = await this.client.rpc('record_unresolved_venue', {
        p_name: espaco.name,
        p_municipality_id: espaco.municipalityId,
        p_example_url: exampleUrl,
      });
      if (error) fail('gravar espaço por resolver', error.message);
    }
  }

  async updateSourceHealth(sourceId: string, input: SourceHealthInput): Promise<void> {
    const now = new Date().toISOString();
    const failures = input.succeeded ? 0 : input.consecutiveFailures + 1;

    const patch: Record<string, unknown> = {
      last_run_at: now,
      last_error: input.error,
      consecutive_failures: failures,
    };

    if (input.succeeded) {
      patch['last_success_at'] = now;
      patch['circuit_open_until'] = null;
      if (input.updateBaseline)
        patch['baseline_item_count'] = nextBaseline(input.baseline, input.itemsFound);
    } else if (failures >= CIRCUIT_FAILURE_THRESHOLD) {
      patch['circuit_open_until'] = new Date(
        Date.now() + CIRCUIT_OPEN_HOURS * 3_600_000,
      ).toISOString();
    }

    const { error } = await this.client.from('sources').update(patch).eq('id', sourceId);
    if (error) fail('atualizar estado da fonte', error.message);
  }

  async openRun(input: OpenRunInput): Promise<string | null> {
    const { data, error } = await this.client
      .from('source_runs')
      .insert({ source_id: input.sourceId, status: 'running', triggered_by: input.triggeredBy })
      .select('id')
      .single();
    if (error) fail('abrir execução', error.message);

    const parsed = z.object({ id: z.string() }).safeParse(data);
    return parsed.success ? parsed.data.id : null;
  }

  async closeRun(runId: string, input: CloseRunInput): Promise<void> {
    const { error } = await this.client
      .from('source_runs')
      .update({
        status: input.status,
        finished_at: new Date().toISOString(),
        duration_ms: input.durationMs,
        items_found: input.counters.itemsFound,
        items_new: input.counters.itemsNew,
        items_updated: input.counters.itemsUpdated,
        items_unchanged: input.counters.itemsUnchanged,
        items_rejected: input.counters.itemsRejected,
        http_responses: input.http.responses,
        http_failures: input.http.failures,
        layout_drift: input.layoutDrift,
        warnings: input.warnings,
        error: input.error,
      })
      .eq('id', runId);
    if (error) fail('fechar execução', error.message);
  }
}

/**
 * Nova linha de base, suavizada.
 *
 * Média móvel em vez do último valor: a agenda de agosto é legitimamente mais
 * magra do que a de outubro, e uma linha de base que copiasse a última
 * recolha ficava presa no mês mais fraco — e deixava de dar pela mudança de
 * layout que ela existe para apanhar.
 */
export function nextBaseline(current: number | null, found: number): number {
  if (current === null || current <= 0) return found;
  return Math.max(0, Math.round(current * 0.7 + found * 0.3));
}

/** Cliente com chave de serviço. `null` quando não há credenciais. */
export function createDatabase(
  environment: NodeJS.ProcessEnv = process.env,
): IngestDatabase | null {
  const parsed = envSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error(
      `configuração inválida — ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }

  const url = parsed.data.SUPABASE_URL ?? parsed.data.NEXT_PUBLIC_SUPABASE_URL;
  const key = parsed.data.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return new SupabaseIngestDatabase(
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  );
}
