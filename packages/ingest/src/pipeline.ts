/**
 * O coração da recolha: de uma fonte a linhas na base de dados.
 *
 * Três princípios, por esta ordem:
 *
 *   1. **Isolamento.** Uma fonte que rebente não leva as outras atrás. O erro
 *      fica registado, a fonte conta mais uma falha e a recolha continua.
 *   2. **Não apagar.** Uma recolha só acrescenta ou corrige; nunca substitui
 *      o que está preenchido por vazio, e desiste inteira quando desconfia de
 *      si própria.
 *   3. **Deixar rasto.** Tudo o que aconteceu fica em `source_runs`, incluindo
 *      — e sobretudo — o que não aconteceu.
 */

import { createHash } from 'node:crypto';
import {
  harmonizeEvent,
  looksLikeMunicipalNotice,
  matchesExcludedTitle,
  mergeSourceDuplicates,
  normalizeForHash,
  rawEventSchema,
  reconcileDecision,
  applyManualLocks,
  avaliarContagem,
  type LeituraDaContagem,
  type EventRow,
  type RawEvent,
  type RunStatus,
  type SessionRow,
  BYTES_DE_CABECALHO,
  medidasDaImagem,
} from '@coreto/core';
import { parseAdapterConfig, type SourceRow } from './adapter.js';
import { getAdapter } from './adapters/index.js';
import type { HttpClient, HttpCounters } from './http.js';
import {
  mergeEventUpdate,
  type EspacoPorResolver,
  type IngestDatabase,
  type StoredEvent,
} from './db.js';
import { RunLogger, emptyCounters, type RunCounters } from './run-logger.js';

/**
 * Confiança mínima para entrar no catálogo sem passar por uma pessoa.
 *
 * O mesmo limiar do harmonizador: um evento sem data não lá chega, e é de
 * propósito — uma data errada leva alguém a uma porta fechada.
 */
export const MIN_AUTOPUBLISH_CONFIDENCE = 0.5;

/**
 * Porque é que este candidato foi à fila, dito a quem a abre.
 *
 * São cinco as condições que lá o põem, e por isso têm de ser cinco os
 * motivos. Houve uma versão com três condições e dois motivos, e a primeira
 * recolha a sério mostrou o que isso custa: os oito candidatos que foram à
 * fila foram lá parar todos por a fonte não dizer onde era o evento, e todos
 * registaram «confiança de 0.75» ou parecido — um número **acima** do mínimo,
 * que portanto não explicava nada. Quem abrisse a fila via um motivo que não
 * era motivo nenhum, e não ficava a saber que o que faltava era escrever o
 * sítio.
 *
 * A ordem é a mesma da condição que decide: primeiro a data, que é o que
 * impede um evento de existir; depois o duplicado, porque quem abre a fila
 * precisa de saber que o evento já cá está antes de discutir o resto; depois
 * o aviso, que explica o candidato inteiro; depois o sítio; e a confiança em
 * último, que é o único caso em que o número diz mesmo alguma coisa.
 */
export function motivoDaRevisao(
  event: EventRow,
  semSitio: boolean,
  pareceAviso = false,
  jaExisteNoutraFonte = false,
): string {
  if (event.date_start === null) return 'sem data legível na fonte';
  if (jaExisteNoutraFonte)
    return 'já existe um evento igual, vindo de outra fonte — decidir qual fica';
  if (pareceAviso)
    return 'parece informação municipal, não um evento — confirmar antes de publicar';
  if (semSitio) return 'a fonte não diz onde é — falta o espaço ou o local';
  return `confiança de ${event.confidence}, abaixo do mínimo de ${MIN_AUTOPUBLISH_CONFIDENCE}`;
}

export interface Lookups {
  categoryAliases: ReadonlyMap<string, string>;
  venueAliases: ReadonlyMap<string, string>;
  venueAliasesByMunicipality: ReadonlyMap<string, ReadonlyMap<string, string>>;
  venueKinds: ReadonlyMap<string, string>;
  venueMunicipalities: ReadonlyMap<string, string>;
}

/**
 * O concelho lido do espaço, quando nem a fonte nem o evento o dizem.
 *
 * A rede CAMINHOS tem produções em que a página só nomeia o espaço («Centro
 * Cultural Gil Vicente») — mas se esse nome casar com o catálogo, o catálogo
 * sabe o concelho. É a mesma resolução por alias que o harmonizador usa para
 * ligar o evento ao espaço; aqui é preciso mais cedo, porque o concelho entra
 * na identidade do evento.
 */
export function concelhoDoEspaco(
  venueName: string | null | undefined,
  lookups: Pick<Lookups, 'venueAliases' | 'venueMunicipalities'>,
): string | null {
  if (!venueName) return null;
  const venueId = lookups.venueAliases.get(normalizeForHash(venueName));
  if (!venueId) return null;
  return lookups.venueMunicipalities.get(venueId) ?? null;
}

export interface PipelineContext {
  db: IngestDatabase | null;
  http: HttpClient;
  dryRun: boolean;
  triggeredBy: string;
  output?: (line: string) => void;
  now?: () => Date;
}

/** «tomar», ou «região:medio-tejo» numa fonte sem concelho. */
export function ambitoDaFonte(source: {
  municipality_id: string | null;
  region_id: string | null;
}): string {
  return source.municipality_id ?? (source.region_id ? `região:${source.region_id}` : '—');
}

export interface SourceOutcome {
  sourceId: string;
  /**
   * De onde é a fonte: o concelho, ou «região:<id>» numa fonte regional.
   * Vai no resumo — e no issue de falha — porque com mais de uma região o
   * nome da fonte deixou de dizer sozinho de quem é o problema.
   */
  ambito: string;
  status: RunStatus;
  /** Fonte saltada pelo disjuntor: não é sucesso nem falha. */
  skipped: boolean;
  layoutDrift: boolean;
  /**
   * O que a contagem desta execução diz de si própria — ver `avaliarContagem`.
   *
   * Sai daqui para fora porque é o que o CLI precisa de saber para decidir o
   * código de saída: uma execução em que uma fonte derivou não pode terminar
   * a zero, ou o `if: failure()` do `scrape.yml` nunca abre o aviso e a
   * deriva passa a noite inteira sem ninguém saber.
   */
  contagem: LeituraDaContagem;
  counters: RunCounters;
  /** Candidatos enviados para moderação em vez de irem para o catálogo. */
  submitted: number;
  http: HttpCounters;
  error: string | null;
  warnings: number;
}

/**
 * Identificador estável de um evento de uma fonte.
 *
 * Determinístico a partir de `(fonte, chave)` para que duas execuções da
 * mesma recolha escrevam na mesma linha mesmo que a primeira tenha falhado a
 * meio. A coluna é `uuid`, por isso o resumo é vestido de UUID versão 4 —
 * a versão e a variante são fixadas para respeitar o formato.
 */
export function deterministicEventId(sourceId: string, sourceKey: string): string {
  const hex = createHash('sha256').update(`${sourceId}|${sourceKey}`, 'utf8').digest('hex');
  const variant = ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

export function isCircuitOpen(source: SourceRow, now: Date): boolean {
  if (!source.circuit_open_until) return false;
  const until = Date.parse(source.circuit_open_until);
  return Number.isFinite(until) && until > now.getTime();
}

export async function loadLookups(db: IngestDatabase | null): Promise<Lookups> {
  if (!db) {
    return {
      categoryAliases: new Map(),
      venueAliases: new Map(),
      venueAliasesByMunicipality: new Map(),
      venueKinds: new Map(),
      venueMunicipalities: new Map(),
    };
  }
  const [
    categoryAliases,
    venueAliases,
    venueAliasesByMunicipality,
    venueKinds,
    venueMunicipalities,
  ] = await Promise.all([
    db.loadCategoryAliases(),
    db.loadVenueAliases(),
    db.loadVenueAliasesByMunicipality(),
    db.loadVenueKinds(),
    db.loadVenueMunicipalities(),
  ]);
  return {
    categoryAliases,
    venueAliases,
    venueAliasesByMunicipality,
    venueKinds,
    venueMunicipalities,
  };
}

function outcome(
  source: SourceRow,
  partial: Partial<SourceOutcome> & { status: RunStatus },
): SourceOutcome {
  return {
    sourceId: source.id,
    ambito: ambitoDaFonte(source),
    skipped: false,
    layoutDrift: false,
    contagem: 'normal',
    counters: emptyCounters(),
    submitted: 0,
    http: { responses: 0, failures: 0 },
    error: null,
    warnings: 0,
    ...partial,
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Corre uma escrita de registo sem a deixar derrubar a recolha.
 *
 * Fechar a execução e atualizar a saúde da fonte são escritas na mesma base
 * que pode estar em baixo. Se falharem, o que se perde é o relatório — não
 * pode ser também a recolha das fontes seguintes.
 */
async function ignoreFailure(
  log: RunLogger,
  what: string,
  action: () => Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    log.warn(`não foi possível ${what}`, describe(error));
  }
}

export async function runSource(
  source: SourceRow,
  context: PipelineContext,
  lookups: Lookups,
): Promise<SourceOutcome> {
  const clock = context.now ?? (() => new Date());
  const log = new RunLogger({
    sourceId: source.id,
    store: context.dryRun ? null : context.db,
    triggeredBy: context.triggeredBy,
    ...(context.output ? { output: context.output } : {}),
  });

  if (isCircuitOpen(source, clock())) {
    log.warn('disjuntor aberto — fonte saltada', `até ${source.circuit_open_until ?? ''}`);
    return outcome(source, { status: 'partial', skipped: true, warnings: log.totalWarnings });
  }

  const httpBefore = context.http.counters();
  const httpDelta = (): HttpCounters => {
    const after = context.http.counters();
    return {
      responses: after.responses - httpBefore.responses,
      failures: after.failures - httpBefore.failures,
    };
  };

  const counters = emptyCounters();
  let submitted = 0;

  try {
    await log.start();
    const result = await collectAndWrite(source, context, lookups, log, counters, clock);
    submitted = result.submitted;

    await ignoreFailure(log, 'fechar a execução', () =>
      log.finish({
        status: result.status,
        counters,
        http: httpDelta(),
        layoutDrift: result.layoutDrift,
        error: result.note,
      }),
    );

    /*
     * **Uma leitura que não trouxe o que costuma trazer não é uma leitura com
     * sucesso.**
     *
     * Aqui esteve `succeeded: true` sem condição nenhuma, e era o defeito
     * mais caro desta casa: uma câmara que mudasse de tema devolvia zero
     * eventos, a deriva era detetada, a nota era escrita — e a seguir a fonte
     * levava `last_success_at = agora` e `consecutive_failures = 0`. A página
     * `/estado`, que só olha para essa coluna, respondia «todas as fontes
     * lidas com sucesso nas últimas 48 horas» durante as semanas em que o
     * concelho estava sem agenda nenhuma. O instrumento existia, estava
     * verde, e o verde vinha da própria avaria.
     *
     * `contagem === 'normal'` e não `!layoutDrift`, para a faixa do meio
     * entrar na mesma regra: uma queda de 40% também não é uma leitura boa.
     * É o mesmo booleano que governa a linha de base, e é de propósito que é
     * o mesmo — a contagem em que não se confia o suficiente para a deixar
     * treinar a linha de base é a contagem em que não se confia o suficiente
     * para dizer que está tudo bem.
     */
    const leituraBoa = result.contagem === 'normal';

    await ignoreFailure(log, 'atualizar o estado da fonte', async () => {
      await context.db?.updateSourceHealth(source.id, {
        succeeded: leituraBoa,
        error: result.note,
        itemsFound: counters.itemsFound,
        consecutiveFailures: source.consecutive_failures,
        baseline: source.baseline_item_count,
        // Uma contagem em que não se confia não pode treinar a linha de base:
        // seria a deteção de alteração de layout a habituar-se ao problema.
        // Itens recusados não a invalidam — o que a invalida é a contagem.
        updateBaseline: leituraBoa,
      });
    });

    return outcome(source, {
      status: result.status,
      layoutDrift: result.layoutDrift,
      contagem: result.contagem,
      counters,
      submitted,
      http: httpDelta(),
      error: result.note,
      warnings: log.totalWarnings,
    });
  } catch (error) {
    const message = describe(error);
    log.warn('fonte falhou', message);

    await ignoreFailure(log, 'fechar a execução', () =>
      log.finish({ status: 'failed', counters, http: httpDelta(), error: message }),
    );

    await ignoreFailure(log, 'atualizar o estado da fonte', async () => {
      await context.db?.updateSourceHealth(source.id, {
        succeeded: false,
        error: message,
        itemsFound: counters.itemsFound,
        consecutiveFailures: source.consecutive_failures,
        baseline: source.baseline_item_count,
        updateBaseline: false,
      });
    });

    return outcome(source, {
      status: 'failed',
      counters,
      submitted,
      http: httpDelta(),
      error: message,
      warnings: log.totalWarnings,
    });
  }
}

interface CollectResult {
  status: RunStatus;
  layoutDrift: boolean;
  /**
   * O que a contagem desta execução diz de si própria.
   *
   * Anda ao lado do `layoutDrift` e não em vez dele porque as duas perguntas
   * são diferentes: o booleano decide se se escreve, esta decide se a leitura
   * conta como sucesso e se a linha de base pode aprender com ela. Uma
   * `queda` escreve e não conta; uma `deriva` não faz nem uma coisa nem outra.
   */
  contagem: LeituraDaContagem;
  submitted: number;
  /** Nota guardada em `source_runs.error` mesmo sem falha — é o que se lê primeiro. */
  note: string | null;
}

/**
 * As medidas do cartaz de um evento, com o cuidado de não as ir buscar duas vezes.
 *
 * **O que decide se há pedido é o endereço, não o evento.** Um cartaz já medido
 * cujo endereço não mudou devolve as medidas guardadas sem tocar na rede — e é
 * isso que faz esta função custar quase nada em regime normal: numa noite em
 * que a agenda de um concelho não mude de cartazes, não sai daqui um único
 * pedido. Sem essa condição, cada noite acrescentava uma centena de pedidos aos
 * servidores das câmaras por uma altura de caixa.
 *
 * **Um cartaz que nunca se conseguiu medir volta a tentar-se.** É o que traz
 * medidas aos eventos que já estavam publicados quando a 0126 correu, e o que
 * recupera de uma noite em que o servidor da câmara respondeu 503. O custo é
 * um pedido por noite por cartaz que não se consiga ler nunca — um SVG, por
 * exemplo. São poucos, e a alternativa (guardar que já se tentou) era uma
 * coluna a mais para poupar meia dúzia de pedidos.
 *
 * Nunca lança: o pior caso é ficar sem medidas, e sem medidas a ficha reserva
 * a vitrine como sempre reservou.
 */
async function medirCartaz(
  http: HttpClient,
  endereco: string | null,
  anterior: StoredEvent | null,
  log: RunLogger,
): Promise<{ largura: number | null; altura: number | null }> {
  if (!endereco) return { largura: null, altura: null };

  const jaMedido =
    anterior !== null &&
    anterior.image_url === endereco &&
    anterior.image_width !== null &&
    anterior.image_height !== null;
  if (jaMedido) {
    return { largura: anterior.image_width, altura: anterior.image_height };
  }

  const bytes = await http.cabecalho(endereco, BYTES_DE_CABECALHO);
  if (!bytes) return { largura: null, altura: null };

  const medidas = medidasDaImagem(bytes);
  if (!medidas) {
    // Informativo e não aviso: um cartaz sem medidas é uma página com a
    // vitrine reservada à antiga, não uma fonte partida. Um aviso por cada um
    // enchia o registo da noite com coisas que ninguém vai arranjar.
    log.info('cartaz sem medidas legíveis', endereco);
    return { largura: null, altura: null };
  }
  return { largura: medidas.largura, altura: medidas.altura };
}

async function collectAndWrite(
  source: SourceRow,
  context: PipelineContext,
  lookups: Lookups,
  log: RunLogger,
  counters: RunCounters,
  clock: () => Date,
): Promise<CollectResult> {
  const adapter = getAdapter(source.adapter);
  // Uma fonte de um concelho traz o concelho na configuração. Uma fonte
  // regional — a programação em rede CAMINHOS cobre os onze — não tem um para
  // declarar, e traz um por evento. O que continua a não existir é evento sem
  // concelho nenhum: esses são recusados um a um, mais abaixo, onde se sabe
  // qual é o evento e fica escrito no registo.
  const municipalityId = source.municipality_id;

  const collected = await adapter.fetchEvents({ source, http: context.http, log });

  const valid: RawEvent[] = [];
  for (const candidate of collected) {
    const parsed = rawEventSchema.safeParse(candidate);
    if (!parsed.success) {
      counters.itemsRejected += 1;
      const issue = parsed.error.issues[0];
      log.warn(
        'candidato recusado pela validação',
        `${candidate.sourceKey ?? 'sem chave'} — ${issue ? `${issue.path.join('.')}: ${issue.message}` : 'inválido'}`,
      );
      continue;
    }
    valid.push(parsed.data);
  }

  // O que uma pessoa já decidiu que não é um evento nesta fonte sai aqui,
  // antes de contar: um aviso excluído não é um item «encontrado» e não pode
  // treinar a linha de base como se fosse programação.
  const { config: adapterConfig } = parseAdapterConfig(source.config);
  const kept: RawEvent[] = [];
  let excluded = 0;
  for (const candidate of valid) {
    if (matchesExcludedTitle(candidate.title, adapterConfig.excludeTitles)) {
      excluded += 1;
      continue;
    }
    kept.push(candidate);
  }
  if (excluded > 0) {
    log.info(`${excluded} itens excluídos pela configuração da fonte (excludeTitles)`);
  }

  const deduplicated = mergeSourceDuplicates(kept, municipalityId ?? '');
  if (deduplicated.mergedCount > 0) {
    log.info(`${deduplicated.mergedCount} repetições da própria fonte fundidas`);
  }
  counters.itemsFound = deduplicated.events.length;

  const contagem = avaliarContagem({
    itemsFound: counters.itemsFound,
    baseline: source.baseline_item_count,
    minExpected: source.min_expected_items,
  });

  if (contagem === 'deriva') {
    const note = `contagem suspeita: ${counters.itemsFound} itens contra uma linha de base de ${source.baseline_item_count ?? 0} (mínimo esperado ${source.min_expected_items})`;
    log.warn('possível alteração de layout — nada foi escrito', note);
    return { status: 'partial', layoutDrift: true, contagem, submitted: 0, note };
  }

  // Uma queda escreve o que veio, e é de propósito: doze eventos a menos são
  // doze eventos que deixaram de aparecer, mas os oito que vieram são a sério
  // e alguém os procura hoje. O que a queda muda está mais abaixo — a
  // execução não conta como sucesso e a linha de base fica onde está.
  if (contagem === 'queda') {
    log.warn(
      'queda na contagem — escreve-se, mas a leitura não conta como boa',
      `${counters.itemsFound} itens contra uma linha de base de ${source.baseline_item_count ?? 0}`,
    );
  }

  const writer = context.dryRun ? null : context.db;
  const existing = context.db
    ? await context.db.loadEventsBySourceKey(source.id)
    : new Map<string, StoredEvent>();
  const memoriaDaFila = context.db
    ? await context.db.loadSubmissionMemory(source.id)
    : { aEspera: new Set<string>(), decididasContra: new Set<string>() };

  // As impressões digitais do que as OUTRAS fontes já publicaram. Uma
  // consulta por execução de fonte, e não uma por evento.
  const outrasFontes = context.db
    ? await context.db.loadFingerprintsFromOtherSources(source.id)
    : new Set<string>();

  const lockedFields = context.db
    ? await context.db.loadLockedFields([...existing.values()].map((row) => row.id))
    : new Map<string, string[]>();

  const nowIso = clock().toISOString();
  const unknownTags = new Set<string>();
  const unresolvedVenues = new Map<string, EspacoPorResolver>();
  const unchangedIds: string[] = [];
  const seenKeys: string[] = [];
  let submitted = 0;
  let jaRecusados = 0;

  for (const raw of deduplicated.events) {
    // Um evento que rebente ao ser gravado não pode levar atrás os que ainda
    // faltam da mesma fonte — uma linha recusada por um campo comprido de
    // mais custa um evento, não a agenda de um concelho.
    try {
      const previous = existing.get(raw.sourceKey) ?? null;
      seenKeys.push(raw.sourceKey);

      const concelhoDoEvento =
        raw.municipalityId ?? municipalityId ?? concelhoDoEspaco(raw.venueName, lookups);
      if (!concelhoDoEvento) {
        counters.itemsRejected += 1;
        log.warn(
          'candidato sem concelho',
          `${raw.sourceKey} — nem a fonte nem o evento o dizem, e o espaço «${raw.venueName ?? '—'}» não casa com o catálogo`,
        );
        continue;
      }

      const harmonized = harmonizeEvent(raw, {
        municipalityId: concelhoDoEvento,
        sourceId: source.id,
        categoryAliases: lookups.categoryAliases,
        venueAliases: lookups.venueAliases,
        venueAliasesByMunicipality: lookups.venueAliasesByMunicipality,
        venueKinds: lookups.venueKinds,
        venueMunicipalities: lookups.venueMunicipalities,
        defaultVenueId: source.venue_id,
        makeId: (candidate) =>
          existing.get(candidate.sourceKey)?.id ??
          deterministicEventId(source.id, candidate.sourceKey),
        now: () => nowIso,
      });

      for (const tag of harmonized.unknownTags) unknownTags.add(tag);
      // O harmonizador já sabia quando não conseguia resolver o espaço; até
      // agora ninguém guardava a resposta. Cada nome resolvido à mão uma vez
      // vira alias e melhora todas as recolhas seguintes.
      if (harmonized.unresolvedVenueName) {
        // O concelho é o DO EVENTO. Numa fonte municipal dá no mesmo; numa
        // regional — o CAMINHOS percorre os onze — é a diferença entre uma
        // linha que alguém pode fechar com um alias e uma que fica lá para
        // sempre, porque a vista compara o concelho da fila com o do alias.
        unresolvedVenues.set(`${concelhoDoEvento}\u0000${harmonized.unresolvedVenueName}`, {
          name: harmonized.unresolvedVenueName,
          municipalityId: concelhoDoEvento,
        });
      }

      // Sem sítio não se publica, e a razão é a mesma da data: quem se desloca
      // precisa de saber para onde. A base já o exige — a restrição
      // `events_has_location` pede `venue_id` ou `location_name` —, mas exigi-lo
      // só lá é tarde de mais: a gravação rebenta, o evento conta como recusa,
      // e o registo diz «não foi gravado» sem dizer que faltava o sítio.
      //
      // Aqui é a mesma condição, um passo antes, e com outra consequência: em
      // vez de um erro, uma ida à fila de moderação, onde uma pessoa abre a
      // página e escreve onde é. Foi a primeira recolha a sério que o mostrou.
      const semSitio =
        harmonized.event.venue_id === null && harmonized.event.location_name === null;

      // Só para candidatos novos: um aviso que já está no catálogo foi visto
      // por uma pessoa (ou é dela a decisão de o tirar), e a recolha não anda
      // a repeti-la todas as noites.
      const pareceAviso = !previous && looksLikeMunicipalNotice(harmonized.event.title);

      /*
       * O mesmo evento, vindo de duas fontes.
       *
       * Enquanto foram onze fontes, uma por concelho, isto não acontecia: elas
       * não se sobrepunham. Com as agendas das juntas de freguesia por cima
       * das dos municípios passa a poder acontecer — a câmara e a junta a
       * anunciar a mesma festa —, e a base não trava nada: o índice de
       * `fingerprint` não é único e nunca foi consultado antes de escrever.
       *
       * O que se faz aqui é o mínimo defensável: **não se funde nada**. Fundir
       * dois eventos parecidos que afinal eram dois espetáculos apaga
       * programação, e apagar programação é o contrário do que esta agenda
       * existe para fazer. O que se faz é não publicar o segundo por conta
       * própria — vai à fila, com o motivo à vista, e é uma pessoa que decide
       * qual fica.
       *
       * A impressão digital é título + data + concelho, por isso só apanha
       * repetições exactas. A câmara a escrever «Festa de São Sebastião» e a
       * junta «Festas em Honra de Santo António e São Sebastião» continuam a
       * ser dois eventos aqui — e é a área de moderação, com o seu limiar de
       * semelhança, que os aproxima de quem decide.
       */
      const jaExisteNoutraFonte =
        !previous &&
        harmonized.event.fingerprint !== null &&
        outrasFontes.has(harmonized.event.fingerprint);

      const needsReview =
        harmonized.event.date_start === null ||
        jaExisteNoutraFonte ||
        semSitio ||
        pareceAviso ||
        harmonized.event.confidence < MIN_AUTOPUBLISH_CONFIDENCE;

      if (needsReview && !previous) {
        // Nunca entra no catálogo por si; fica na fila com o motivo à vista.
        // Se já cá estava, mexer nele seria pior: fica a versão que uma pessoa
        // já viu, e o catálogo não ganha uma cópia de qualidade duvidosa.
        counters.itemsRejected += 1;
        if (memoriaDaFila.aEspera.has(raw.sourceKey)) continue;

        /*
         * E o que já foi recusado não volta a ser perguntado.
         *
         * A comparação é por impressão digital e não por `sourceKey`, porque
         * o que uma pessoa recusou foi o que ali estava escrito. Se a fonte
         * mudar o título ou a data, a impressão digital muda, e o candidato
         * volta à fila para ser visto de novo — a recusa nunca é uma porta
         * fechada à fonte, é uma resposta àquele texto.
         */
        if (
          harmonized.event.fingerprint !== null &&
          memoriaDaFila.decididasContra.has(harmonized.event.fingerprint)
        ) {
          jaRecusados += 1;
          continue;
        }

        submitted += 1;
        await writer?.saveSubmission({
          sourceId: source.id,
          municipalityId: concelhoDoEvento,
          venueId: harmonized.event.venue_id,
          fingerprint: harmonized.event.fingerprint,
          confidence: harmonized.event.confidence,
          reason: motivoDaRevisao(harmonized.event, semSitio, pareceAviso, jaExisteNoutraFonte),
          payload: {
            raw: { ...raw },
            event: { ...harmonized.event },
            sessions: harmonized.sessions,
          },
          sourceUrl: raw.sourceUrl ?? null,
        });
        continue;
      }

      if (needsReview && previous) {
        log.warn('leitura pior do que a guardada — mantida a que lá está', raw.sourceKey);
        counters.itemsUnchanged += 1;
        unchangedIds.push(previous.id);
        continue;
      }

      // Quem chega aqui novo passou nas quatro condições — tem data, tem
      // sítio, não parece aviso, e a confiança chega. É para isto que o limiar
      // se chama «autopublish»: entra publicado, senão a agenda inteira ficava
      // em rascunho à espera de uma pessoa que o modelo diz não ser precisa.
      // Para os que já existem, o estado é de quem modera e vem do que está
      // guardado — `mergeEventUpdate` trata disso, aqui não se toca.
      if (!previous) {
        harmonized.event.status = 'published';
        harmonized.event.published_at = nowIso;
      }

      // O que uma pessoa corrigiu não volta a ser pisado. Só esses campos:
      // congelar o evento inteiro por causa de uma data corrigida seria o
      // erro simétrico, e a agenda deixava de acompanhar a fonte.
      const locked = previous ? (lockedFields.get(previous.id) ?? []) : [];
      const withLocks = applyManualLocks<EventRow>(
        harmonized.event,
        previous === null ? null : (previous as unknown as Record<string, unknown>),
        locked,
      );
      const incoming = withLocks.event;
      if (withLocks.blocked.length > 0) {
        log.info('campos protegidos por correção manual', withLocks.blocked.join(', '));
      }
      if (withLocks.conflicts.length > 0) {
        log.warn('a fonte discorda de campos corrigidos à mão', withLocks.conflicts.join(', '));
      }

      const merged = mergeEventUpdate(previous, incoming);

      // As medidas do cartaz. Só há pedido quando o endereço é novo ou quando
      // o que lá está ainda não tem medidas — ver `medirCartaz`.
      const cartaz = await medirCartaz(context.http, merged.image_url, previous, log);
      merged.image_width = cartaz.largura;
      merged.image_height = cartaz.altura;

      /*
       * O `content_hash` diz se a **fonte** mudou; não diz se a nossa leitura
       * dela mudou.
       *
       * Ele cobre o título, a descrição, a data, o espaço e o preço em bruto —
       * o que a fonte publicou. A categoria, o espaço resolvido e o ciclo são
       * coisas que nós derivamos, e derivamos com regras que melhoram: um
       * alias novo em `category_aliases`, uma palavra nova nas regras de
       * título, um alias de espaço acrescentado por migração.
       *
       * Enquanto esta comparação foi só do `content_hash`, nada disso chegava
       * ao que já estava publicado. Um evento ficava com a categoria da noite
       * em que foi lido pela primeira vez, para sempre, porque a fonte
       * continuava a dizer exactamente o mesmo. A auditoria de 30 de agosto
       * mediu-o: sessenta e cinco dos cento e trinta e nove eventos
       * publicados sem categoria nenhuma, muitos deles com uma palavra no
       * título que as regras de hoje reconhecem.
       *
       * Agora salta-se apenas quando a fonte **e** a leitura coincidem. Não
       * custa escritas em regime normal — as regras não mudam todas as
       * noites —, e na noite em que mudam, a agenda inteira acompanha.
       */
      const leituraIgual =
        previous !== null &&
        previous.category_slug === merged.category_slug &&
        previous.venue_id === merged.venue_id &&
        previous.series_id === merged.series_id &&
        /*
         * O título também é leitura, e faltava aqui.
         *
         * O `content_hash` acima **dobra a caixa** (`normalizeForHash` faz
         * `toLowerCase`), de propósito: é o que impede uma câmara que troque
         * «CONCERTO» por «Concerto» de gerar uma escrita por noite. O efeito
         * de lado é que uma correção às regras de caixa — a `fixShoutyTitle`,
         * as palavras menores, as siglas — nunca chegava à base: o resumo
         * coincidia, a leitura coincidia, saltava-se a escrita, e a agenda
         * ficava com o título de antes para sempre.
         *
         * Foi assim que «Pai Que Se Tornou Mãe» ficou publicado com o «Que» e
         * o «Se» capitalizados. Corrigir a função sem corrigir esta linha era
         * dar a auditoria por fechada sem nada ter mudado no que se lê.
         */
        previous.title === merged.title &&
        /*
         * E o preço, pela mesma razão e com a mesma armadilha.
         *
         * O `content_hash` cobre o `priceRaw` — o que a fonte escreveu —, e não
         * o que nós lemos dele. Uma correção ao leitor de preços coincidia no
         * resumo, coincidia na leitura, e nunca chegava a uma linha publicada:
         * a agenda ficava com o rótulo da primeira noite.
         *
         * Bastam estas duas colunas. O `price_min` e o `price_max` decidem-se
         * na mesma passagem que o rótulo (ver `decidirPreco`, em `harmonize`),
         * e o `price_raw` já vai no resumo.
         */
        previous.price_display === merged.price_display &&
        previous.is_free === merged.is_free;

      /*
       * Medidas novas são razão para escrever, mesmo que nada mais mude.
       *
       * **A comparação é com o que está guardado, e tem de ser.** A primeira
       * versão disto perguntava se `merged` tinha medidas — e `merged` acabava
       * de as receber, umas linhas acima. O resultado era o pior possível: a
       * recolha ia buscar o cabeçalho, lia as medidas, concluía que já as
       * tinha, saltava a escrita e deitava-as fora. Na noite seguinte repetia
       * tudo, para sempre, e os eventos publicados antes da 0126 nunca ganhavam
       * medidas nenhumas.
       *
       * Assim, o que decide é a diferença: aprendeu-se alguma coisa que a base
       * não tem, escreve-se. É também o que recupera de uma noite em que o
       * servidor da câmara respondeu 503 a quem lhe foi ler o cabeçalho.
       *
       * O preço é uma escrita por noite por cartaz que nunca se consiga ler —
       * um SVG, um servidor em baixo há semanas. São poucos, e a alternativa
       * (guardar que já se tentou) era uma coluna a mais para poupar meia dúzia
       * de linhas.
       */
      const medidasIguais =
        previous !== null &&
        previous.image_width === merged.image_width &&
        previous.image_height === merged.image_height;

      if (
        previous &&
        previous.content_hash &&
        previous.content_hash === merged.content_hash &&
        leituraIgual &&
        medidasIguais
      ) {
        counters.itemsUnchanged += 1;
        unchangedIds.push(previous.id);
        continue;
      }

      await writeEvent(writer, merged, harmonized.sessions);
      if (previous) counters.itemsUpdated += 1;
      else counters.itemsNew += 1;
    } catch (error) {
      counters.itemsRejected += 1;
      log.warn('evento não foi gravado', `${raw.sourceKey} — ${describe(error)}`);
    }
  }

  if (unchangedIds.length > 0) {
    // Um evento inalterado continua a ser publicado pela fonte, e é isso que
    // `last_seen_at` diz. Uma escrita para todos em vez de uma linha por
    // evento — a diferença é entre uma consulta e quatrocentas.
    await writer?.touchEvents(unchangedIds, nowIso);
  }

  if (unknownTags.size > 0) {
    log.info(`${unknownTags.size} etiquetas por mapear`, [...unknownTags].slice(0, 10).join(', '));
    await writer?.recordUnknownTags([...unknownTags], source.url);
  }

  if (unresolvedVenues.size > 0) {
    const nomes = [...new Set([...unresolvedVenues.values()].map((espaco) => espaco.name))];
    log.info(`${nomes.length} espaços por resolver`, nomes.slice(0, 10).join(', '));
    await writer?.recordUnresolvedVenues([...unresolvedVenues.values()], source.url);
  }

  if (submitted > 0) log.info(`${submitted} candidatos enviados para moderação`);
  if (jaRecusados > 0) {
    log.info(
      `${jaRecusados} ${jaRecusados === 1 ? 'candidato já recusado' : 'candidatos já recusados'} — a fonte não mudou o que diz`,
    );
  }

  await reconcile(source, seenKeys, context, writer, log);

  // Uma agenda municipal tem quase sempre um ou dois itens sem data, que vão
  // para a fila de moderação. Se isso bastasse para marcar a execução como
  // parcial, o painel de saúde ficava permanentemente amarelo e ninguém lhe
  // dava atenção no dia em que interessasse. Parcial é não trazer nada, ou
  // recusar mais do que aquilo que se escreveu.
  //
  // «Não trazer nada» só é notícia se houvesse alguma coisa para trazer, e é
  // aí que esta regra se traía a si própria. Dezoito juntas de freguesia
  // pequenas — Bugalhos, Valhascos, Espite, Cercal — publicam a agenda em
  // papel na porta da sede e não têm secção de eventos com conteúdo nenhum.
  // Trouxeram zero em seis recolhas seguidas, porque zero é o que lá está.
  // Ficavam amarelas todas as noites: dezoito linhas em oitenta, para sempre,
  // exactamente o painel permanentemente amarelo que o parágrafo de cima diz
  // que não se pode ter.
  //
  // Quem sabe se um zero é alarmante é a `detectLayoutDrift`, e já correu
  // acima: uma fonte com linha de base a sério que devolve zero volta de lá
  // marcada, com a contagem escrita na nota, e nem chega aqui. O que chega
  // aqui é o zero que ela deixou passar — e a linha de base é precisamente o
  // registo do que esta fonte costuma dar. Sem linha de base não há queda:
  // há uma freguesia sossegada.
  const written = counters.itemsNew + counters.itemsUpdated + counters.itemsUnchanged;
  const nadaOndeSeEsperavaAlgo = counters.itemsFound === 0 && (source.baseline_item_count ?? 0) > 0;
  const status: RunStatus =
    nadaOndeSeEsperavaAlgo || counters.itemsRejected > written ? 'partial' : 'success';

  // A nota vai para `last_error` da fonte, e é a mesma mentira noutro sítio:
  // uma freguesia sem agenda ficava com um erro escrito na ficha do painel.
  // Só se escreve quando há de facto alguma coisa a assinalar.
  const note = nadaOndeSeEsperavaAlgo
    ? `a fonte respondeu mas não devolveu eventos (costumava dar ${source.baseline_item_count})`
    : contagem === 'queda'
      ? `queda na contagem: ${counters.itemsFound} itens contra uma linha de base de ${source.baseline_item_count ?? 0}`
      : counters.itemsRejected > 0
        ? `${counters.itemsRejected} candidatos não entraram no catálogo`
        : null;

  return {
    status: contagem === 'queda' ? 'partial' : status,
    layoutDrift: false,
    contagem,
    submitted,
    note,
  };
}

/**
 * Retira do catálogo o que a fonte deixou de mostrar — quando é seguro fazê-lo.
 *
 * A trava vem antes de tudo o resto. Uma recolha que rendeu muito abaixo do que
 * a fonte tem publicado é indistinguível, do lado de cá, de uma câmara que
 * retirou a agenda inteira: reconciliar sobre isso apagava um concelho ao fim
 * de três noites, e a falha que o causaria — um timeout que devolve uma lista
 * vazia «com sucesso» — não deixa rasto nenhum no registo.
 *
 * Nunca deita a execução abaixo: se falhar, o catálogo fica como está, que é o
 * lado seguro de errar.
 */
async function reconcile(
  source: SourceRow,
  seenKeys: readonly string[],
  context: PipelineContext,
  writer: IngestDatabase | null,
  log: RunLogger,
): Promise<void> {
  if (!writer || !context.db) return;

  try {
    const published = await context.db.countPublishedFromSource(source.id);
    const decision = reconcileDecision(published, seenKeys.length);
    if (decision.skip) {
      log.warn('reconciliação saltada — nada foi retirado', decision.reason ?? '');
      return;
    }

    const outcome = await writer.reconcileMissing(source.id, seenKeys);
    if (outcome.marked > 0 || outcome.archived > 0 || outcome.recovered > 0) {
      log.info(
        'reconciliação',
        `${outcome.marked} em falta, ${outcome.archived} retirados, ${outcome.recovered} repostos`,
      );
    }
  } catch (error) {
    log.warn('reconciliação falhou — o catálogo fica como está', describe(error));
  }
}

async function writeEvent(
  writer: IngestDatabase | null,
  event: EventRow,
  sessions: readonly SessionRow[],
): Promise<void> {
  if (!writer) return;
  await writer.saveEvent(event);
  // Sem sessões novas não se apagam as antigas: a recolha de hoje pode ter
  // perdido as datas, e as sessões guardadas ainda são a melhor informação.
  if (sessions.length > 0) await writer.replaceSessions(event.id, sessions);
}

export async function runPipeline(
  sources: readonly SourceRow[],
  context: PipelineContext,
): Promise<SourceOutcome[]> {
  const lookups = await loadLookups(context.db);
  const out: SourceOutcome[] = [];
  for (const source of sources) {
    out.push(await runSource(source, context, lookups));
  }
  return out;
}
