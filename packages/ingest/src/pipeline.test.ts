import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { eventFingerprint, type EventRow, type SessionRow } from '@coreto/core';
import type { SourceRow } from './adapter.js';
import type {
  EspacoPorResolver,
  IngestDatabase,
  MemoriaDaFila,
  SourceHealthInput,
  StoredEvent,
  SubmissionInput,
} from './db.js';
import { HttpClient } from './http.js';
import type { CloseRunInput, OpenRunInput } from './run-logger.js';
import {
  concelhoDoEspaco,
  detectLayoutDrift,
  deterministicEventId,
  isCircuitOpen,
  motivoDaRevisao,
  runPipeline,
  type SourceOutcome,
} from './pipeline.js';

/**
 * Uma listagem com três eventos datados e um sem data — que é a proporção
 * real de uma agenda municipal a meio do mês.
 */
/**
 * Cada item traz um `.local`, e não é decoração.
 *
 * A base exige que todo o evento diga onde é (`events_has_location`), e uma
 * listagem sem local nenhum não representa uma agenda verdadeira — representa
 * um caso que nunca chegaria a ser gravado. A base falsa destes testes não
 * impõe restrições, e sem isto os testes descreviam um sucesso que a produção
 * não teria.
 */
const LISTING_HTML = `<ul class="lista">
  <li class="evento">
    <h3><a href="/agenda/concerto-de-natal">Concerto de Natal</a></h3>
    <time class="data" datetime="2026-12-20">20 de dezembro de 2026</time>
    <span class="hora">21h30</span>
    <span class="local">Casa da Cultura</span>
    <p class="resumo">Pela Banda Filarmónica e pelo coro juvenil do concelho.</p>
  </li>
  <li class="evento">
    <h3><a href="/agenda/feira-do-livro">Feira do Livro</a></h3>
    <time class="data" datetime="2026-05-10">10 de maio de 2026</time>
    <span class="local">Mercado Municipal</span>
  </li>
  <li class="evento">
    <h3><a href="/agenda/hora-do-conto">Hora do Conto</a></h3>
    <time class="data" datetime="2026-05-16">16 de maio de 2026</time>
    <span class="local">Biblioteca Municipal</span>
  </li>
  <li class="evento">
    <h3><a href="/agenda/exposicao-permanente">Exposição Permanente</a></h3>
    <span class="local">Casa da Cultura</span>
    <span class="resumo">Sem datas anunciadas.</span>
  </li>
</ul>`;

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

const CONFIG: Record<string, unknown> = {
  listSelector: '.evento',
  titleSelector: 'h3',
  dateSelector: '.data',
  timeSelector: '.hora',
  linkSelector: 'h3 a',
  venueSelector: '.local',
  descriptionSelector: '.resumo',
};

function makeSource(overrides: Partial<SourceRow> = {}): SourceRow {
  return {
    id: 'cm-tomar',
    name: 'Câmara Municipal de Tomar',
    kind: 'municipal_site',
    municipality_id: 'tomar',
    region_id: null,
    venue_id: null,
    url: 'https://www.cm-tomar.pt/pt/agenda',
    adapter: 'generic-html',
    config: CONFIG,
    is_enabled: true,
    baseline_item_count: null,
    min_expected_items: 0,
    consecutive_failures: 0,
    circuit_open_until: null,
    ...overrides,
  };
}

class FakeDatabase implements IngestDatabase {
  readonly events = new Map<string, EventRow>();
  readonly sessions = new Map<string, SessionRow[]>();
  readonly submissions: SubmissionInput[] = [];
  readonly health: SourceHealthInput[] = [];
  readonly closedRuns: CloseRunInput[] = [];
  readonly touched: string[] = [];
  readonly unknownTags: string[] = [];
  readonly unresolvedVenues: string[] = [];
  /** O concelho com que cada nome foi gravado, na mesma ordem. */
  readonly concelhosPorResolver: Array<string | null> = [];
  /** Bloqueios manuais, por id de evento. Os testes preenchem-nos à mão. */
  readonly locks = new Map<string, string[]>();
  /** Chamadas à reconciliação, para se poder afirmar que NÃO houve nenhuma. */
  readonly reconciled: Array<{ sourceId: string; seenKeys: string[] }> = [];
  /** Eventos publicados que a fonte tem — alimenta a trava de segurança. */
  publishedFromSource = 0;
  /** Impressões digitais que OUTRAS fontes já têm. Os testes preenchem-nas. */
  readonly fingerprintsDeOutrasFontes = new Set<string>();
  private runCounter = 0;

  loadSources(): Promise<SourceRow[]> {
    return Promise.resolve([]);
  }

  loadCategoryAliases(): Promise<Map<string, string>> {
    return Promise.resolve(new Map([['musica', 'musica']]));
  }

  loadVenueAliases(): Promise<Map<string, string>> {
    return Promise.resolve(new Map());
  }

  /** Concelho → (alias → espaço); os testes que precisam preenchem-no à mão. */
  readonly venueAliasesByMunicipality = new Map<string, Map<string, string>>();

  loadVenueAliasesByMunicipality(): Promise<Map<string, Map<string, string>>> {
    return Promise.resolve(this.venueAliasesByMunicipality);
  }

  /** Espaço → concelho; os testes que precisam preenchem-no à mão. */
  readonly venueMunicipalities = new Map<string, string>();

  loadVenueMunicipalities(): Promise<Map<string, string>> {
    return Promise.resolve(this.venueMunicipalities);
  }

  loadVenueKinds(): Promise<Map<string, string>> {
    return Promise.resolve(new Map());
  }

  loadEventsBySourceKey(sourceId: string): Promise<Map<string, StoredEvent>> {
    const out = new Map<string, StoredEvent>();
    for (const event of this.events.values()) {
      if (event.source_id === sourceId && event.source_key) out.set(event.source_key, event);
    }
    return Promise.resolve(out);
  }

  loadFingerprintsFromOtherSources(): Promise<Set<string>> {
    return Promise.resolve(this.fingerprintsDeOutrasFontes);
  }

  /**
   * Impressões digitais já recusadas por uma pessoa. Os testes preenchem-nas
   * à mão — aqui não há moderador nem tabela, há a decisão que ele deixou.
   */
  readonly recusadas = new Set<string>();

  loadSubmissionMemory(): Promise<MemoriaDaFila> {
    const aEspera = new Set<string>();
    for (const submission of this.submissions) {
      const raw = submission.payload['raw'];
      if (raw && typeof raw === 'object' && 'sourceKey' in raw) {
        const key = (raw as { sourceKey: unknown }).sourceKey;
        if (typeof key === 'string') aEspera.add(key);
      }
    }
    return Promise.resolve({ aEspera, decididasContra: this.recusadas });
  }

  saveEvent(event: EventRow): Promise<void> {
    this.events.set(event.id, event);
    return Promise.resolve();
  }

  touchEvents(ids: readonly string[]): Promise<void> {
    this.touched.push(...ids);
    return Promise.resolve();
  }

  replaceSessions(eventId: string, sessions: readonly SessionRow[]): Promise<void> {
    this.sessions.set(eventId, [...sessions]);
    return Promise.resolve();
  }

  saveSubmission(input: SubmissionInput): Promise<void> {
    this.submissions.push(input);
    return Promise.resolve();
  }

  loadLockedFields(eventIds: readonly string[]): Promise<Map<string, string[]>> {
    const found = new Map<string, string[]>();
    for (const id of eventIds) {
      const fields = this.locks.get(id);
      if (fields) found.set(id, fields);
    }
    return Promise.resolve(found);
  }

  countPublishedFromSource(): Promise<number> {
    return Promise.resolve(this.publishedFromSource);
  }

  reconcileMissing(
    sourceId: string,
    seenKeys: readonly string[],
  ): Promise<{ marked: number; archived: number; recovered: number }> {
    this.reconciled.push({ sourceId, seenKeys: [...seenKeys] });
    return Promise.resolve({ marked: 0, archived: 0, recovered: 0 });
  }

  recordUnknownTags(tags: readonly string[]): Promise<void> {
    this.unknownTags.push(...tags);
    return Promise.resolve();
  }

  /** Guarda o par nome+concelho, que é o que a fila passou a receber. */
  recordUnresolvedVenues(espacos: readonly EspacoPorResolver[]): Promise<void> {
    for (const espaco of espacos) {
      this.unresolvedVenues.push(espaco.name);
      this.concelhosPorResolver.push(espaco.municipalityId);
    }
    return Promise.resolve();
  }

  updateSourceHealth(_sourceId: string, input: SourceHealthInput): Promise<void> {
    this.health.push(input);
    return Promise.resolve();
  }

  openRun(_input: OpenRunInput): Promise<string | null> {
    this.runCounter += 1;
    return Promise.resolve(`run-${this.runCounter}`);
  }

  closeRun(_runId: string, input: CloseRunInput): Promise<void> {
    this.closedRuns.push(input);
    return Promise.resolve();
  }
}

/** Cliente HTTP que responde sempre o mesmo, sem rede e sem esperas. */
function stubHttp(body: string, status = 200): HttpClient {
  return new HttpClient({
    minHostIntervalMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: () => Promise.resolve(new Response(body, { status })),
  });
}

async function run(
  source: SourceRow,
  db: FakeDatabase,
  http: HttpClient = stubHttp(LISTING_HTML),
): Promise<SourceOutcome> {
  const outcomes = await runPipeline([source], {
    db,
    http,
    dryRun: false,
    triggeredBy: 'teste',
    output: () => undefined,
  });
  const outcome = outcomes[0];
  if (!outcome) throw new Error('sem resultado');
  return outcome;
}

describe('detectLayoutDrift', () => {
  it('não conclui nada sem linha de base', () => {
    expect(detectLayoutDrift({ itemsFound: 0, baseline: null, minExpected: 0 })).toBe(false);
  });

  it('ignora linhas de base pequenas de mais para dizerem alguma coisa', () => {
    expect(detectLayoutDrift({ itemsFound: 1, baseline: 4, minExpected: 0 })).toBe(false);
  });

  it('dispara abaixo de metade da linha de base', () => {
    expect(detectLayoutDrift({ itemsFound: 9, baseline: 20, minExpected: 0 })).toBe(true);
    expect(detectLayoutDrift({ itemsFound: 10, baseline: 20, minExpected: 0 })).toBe(false);
  });

  it('respeita o mínimo declarado na fonte', () => {
    expect(detectLayoutDrift({ itemsFound: 3, baseline: null, minExpected: 5 })).toBe(true);
    expect(detectLayoutDrift({ itemsFound: 6, baseline: null, minExpected: 5 })).toBe(false);
  });
});

describe('deterministicEventId', () => {
  it('é estável e tem forma de uuid', () => {
    const first = deterministicEventId('cm-tomar', 'agenda/concerto');
    expect(first).toBe(deterministicEventId('cm-tomar', 'agenda/concerto'));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('separa fontes diferentes com a mesma chave', () => {
    expect(deterministicEventId('cm-tomar', 'x')).not.toBe(deterministicEventId('cm-ourem', 'x'));
  });
});

describe('isCircuitOpen', () => {
  const now = new Date('2026-05-10T04:00:00.000Z');

  it('fechado sem data', () => {
    expect(isCircuitOpen(makeSource(), now)).toBe(false);
  });

  it('aberto até à hora marcada', () => {
    expect(isCircuitOpen(makeSource({ circuit_open_until: '2026-05-10T06:00:00.000Z' }), now)).toBe(
      true,
    );
    expect(isCircuitOpen(makeSource({ circuit_open_until: '2026-05-10T03:00:00.000Z' }), now)).toBe(
      false,
    );
  });
});

describe('motivoDaRevisao', () => {
  const evento = (over: Partial<EventRow>) =>
    ({ date_start: '2026-12-20', confidence: 0.9, ...over }) as EventRow;

  it('a data que falta é o primeiro motivo', () => {
    expect(motivoDaRevisao(evento({ date_start: null }), false)).toBe('sem data legível na fonte');
  });

  it('o sítio que falta é dito como sítio, e não como confiança', () => {
    const motivo = motivoDaRevisao(evento({ confidence: 0.75 }), true);
    expect(motivo).toBe('a fonte não diz onde é — falta o espaço ou o local');
    expect(motivo).not.toContain('confiança');
  });

  it('a confiança só é motivo quando é mesmo o problema, e diz contra o quê', () => {
    expect(motivoDaRevisao(evento({ confidence: 0.4 }), false)).toBe(
      'confiança de 0.4, abaixo do mínimo de 0.5',
    );
  });

  it('sem data e sem sítio ao mesmo tempo, manda a data', () => {
    expect(motivoDaRevisao(evento({ date_start: null }), true)).toBe('sem data legível na fonte');
  });
});

describe('runPipeline', () => {
  it('escreve os eventos datados e manda o resto para moderação', async () => {
    const db = new FakeDatabase();
    const outcome = await run(makeSource(), db);

    expect(outcome.counters.itemsFound).toBe(4);
    expect(outcome.counters.itemsNew).toBe(3);
    expect(outcome.submitted).toBe(1);
    expect(db.events.size).toBe(3);

    const titles = [...db.events.values()].map((event) => event.title).sort();
    expect(titles).toEqual(['Concerto de Natal', 'Feira do Livro', 'Hora do Conto']);

    const concerto = [...db.events.values()].find((event) => event.title === 'Concerto de Natal');
    expect(concerto?.source_key).toBe('agenda/concerto-de-natal');
    expect(concerto?.date_start).toBe('2026-12-20');
    expect(db.sessions.get(concerto?.id ?? '')?.[0]?.start_time).toBe('21:30');

    // Quem passou nas quatro condições entra publicado — o sítio público só
    // mostra `published`, e um catálogo que nasce todo em rascunho é um
    // catálogo que ninguém vê.
    expect(concerto?.status).toBe('published');
    expect(concerto?.published_at).not.toBeNull();

    expect(db.submissions).toHaveLength(1);
    expect(db.submissions[0]?.reason).toBe('sem data legível na fonte');

    // Um item sem data é o normal numa agenda municipal: não é motivo para
    // pintar a execução de amarelo nem para travar a linha de base.
    expect(outcome.status).toBe('success');
    expect(db.health[0]?.updateBaseline).toBe(true);
  });

  /*
   * O que uma pessoa recusou não volta na noite seguinte.
   *
   * Em 30 de agosto de 2026 as três linhas por decidir na fila eram, uma a
   * uma, as três que tinham sido recusadas quatro horas antes. A recolha
   * lia só as submissões `pending` e `needs_info`, e por isso não sabia que
   * já lhe tinham respondido. O moderador fazia o trabalho e a recolha
   * desfazia-o — todas as noites, para sempre.
   */
  it('um candidato já recusado não volta a ser posto na fila', async () => {
    const db = new FakeDatabase();
    db.recusadas.add(eventFingerprint('Exposição Permanente', null, 'tomar'));

    const outcome = await run(makeSource(), db);

    expect(db.submissions).toHaveLength(0);
    expect(outcome.submitted).toBe(0);

    // Continua a contar como recusado — não entrou no catálogo, e a saúde da
    // fonte tem de dizer a verdade sobre o que a fonte traz.
    expect(outcome.counters.itemsRejected).toBe(1);
    expect(outcome.counters.itemsNew).toBe(3);
  });

  /*
   * Mas a recusa é sobre o que ali estava escrito, e não sobre o endereço.
   * Se a fonte mudar o título — o mesmo `sourceKey`, outro texto — o
   * candidato volta a ser mostrado a uma pessoa. Ninguém recusou *isto*.
   */
  it('a recusa esquece-se quando a fonte muda o que diz', async () => {
    const db = new FakeDatabase();
    db.recusadas.add(eventFingerprint('Exposição Permanente', null, 'tomar'));

    const outroTitulo = LISTING_HTML.replace('Exposição Permanente', 'Exposição de Inverno');
    const outcome = await run(makeSource(), db, stubHttp(outroTitulo));

    expect(db.submissions).toHaveLength(1);
    expect(db.submissions[0]?.reason).toBe('sem data legível na fonte');
    expect(outcome.submitted).toBe(1);
  });

  /*
   * E uma submissão por decidir continua a travar pelo `sourceKey`: enquanto
   * ninguém lhe tocar, não se pede a mesma decisão duas vezes.
   */
  it('um candidato à espera de decisão não é pedido outra vez', async () => {
    const db = new FakeDatabase();
    await run(makeSource(), db);
    expect(db.submissions).toHaveLength(1);

    await run(makeSource(), db);
    expect(db.submissions).toHaveLength(1);
  });

  it('uma fonte regional escreve cada evento no seu concelho', async () => {
    const grelha = readFileSync(join(FIXTURES, 'caminhos.html'), 'utf8');
    const detalhe = readFileSync(join(FIXTURES, 'caminhos-evento.html'), 'utf8');
    const http = new HttpClient({
      minHostIntervalMs: 0,
      sleep: () => Promise.resolve(),
      fetchImpl: (input) =>
        Promise.resolve(
          new Response(String(input).includes('/programacao') ? grelha : detalhe, { status: 200 }),
        ),
    });

    const db = new FakeDatabase();
    const outcome = await run(
      makeSource({
        id: 'caminhos-cimt',
        adapter: 'caminhos',
        municipality_id: null,
        url: 'https://caminhos.mediotejo.pt/programacao/',
        config: {},
      }),
      db,
      http,
    );

    // O stub serve a mesma página de produção aos três cartões da grelha: as
    // três cópias de cada concelho fundem-se pela impressão digital — mas as
    // dos dois concelhos nunca se fundem entre si.
    expect(outcome.status).toBe('success');
    expect(db.events.size).toBe(2);

    const concelhos = [...db.events.values()].map((event) => event.municipality_id).sort();
    expect(concelhos).toEqual(['constancia', 'ferreira-do-zezere']);
    for (const event of db.events.values()) {
      expect(event.status).toBe('published');
      expect(event.series_id).toBe('caminhos');
    }

    /*
     * E a fila de espaços por resolver guarda o concelho DO EVENTO.
     *
     * Esta fonte não tem concelho — percorre os onze. Enquanto se gravou o da
     * fonte, cada nome que ela trouxesse entrava na fila com o concelho a
     * `null`, e um alias preso a um concelho nunca o conseguia tirar de lá: a
     * vista `unresolved_venues_pendentes` compara os dois, e «abrantes = null»
     * não é verdade. A 0078 encontrou duas dessas linhas — o claustro do
     * Convento de São Domingos e um «Centro Cultural» sem sobrenome — que
     * ninguém podia fechar.
     */
    expect(db.concelhosPorResolver.length).toBeGreaterThan(0);
    expect(db.concelhosPorResolver).not.toContain(null);
    for (const concelho of db.concelhosPorResolver) {
      expect(concelhos).toContain(concelho);
    }
  });

  it('sem concelho na fonte nem no evento, o candidato é recusado', async () => {
    const db = new FakeDatabase();
    const outcome = await run(makeSource({ municipality_id: null }), db);

    // Os quatro itens da listagem genérica não trazem concelho próprio.
    expect(db.events.size).toBe(0);
    expect(outcome.counters.itemsRejected).toBeGreaterThan(0);
  });

  it('quando só o espaço diz o concelho, o catálogo responde', () => {
    // Os aliases guardam-se já normalizados (só letras e dígitos), como na base.
    const lookups = {
      venueAliases: new Map([['centroculturalgilvicente', 'centro-cultural-gil-vicente']]),
      venueMunicipalities: new Map([['centro-cultural-gil-vicente', 'sardoal']]),
    };
    expect(concelhoDoEspaco('Centro Cultural Gil Vicente', lookups)).toBe('sardoal');
    expect(concelhoDoEspaco('Um Sítio Que Não Existe', lookups)).toBeNull();
    expect(concelhoDoEspaco(null, lookups)).toBeNull();
  });

  it('a segunda recolha não reescreve o que não mudou', async () => {
    const db = new FakeDatabase();
    await run(makeSource(), db);
    const second = await run(makeSource(), db);

    expect(second.counters.itemsUnchanged).toBe(3);
    expect(second.counters.itemsNew).toBe(0);
    expect(second.counters.itemsUpdated).toBe(0);
    expect(db.touched).toHaveLength(3);
    // A submissão que já estava na fila não é duplicada todas as noites.
    expect(db.submissions).toHaveLength(1);
  });

  it('uma categoria que mudou de leitura é reescrita, mesmo com a fonte igual', async () => {
    /*
     * O erro que isto trava: o `content_hash` cobre o que a **fonte** diz —
     * título, descrição, data, espaço, preço em bruto. A categoria é coisa
     * que nós derivamos, e derivamo-la com regras que melhoram. Enquanto a
     * comparação era só do hash, um alias novo ou uma palavra nova nas regras
     * de título nunca chegava ao que já estava publicado: a fonte continuava
     * a dizer o mesmo, e o evento ficava com a categoria da primeira noite
     * para sempre.
     */
    const db = new FakeDatabase();
    await run(makeSource(), db);

    const [gravado] = [...db.events.values()];
    expect(gravado).toBeDefined();
    if (!gravado) return;

    // A fonte não mexeu em nada — só a nossa leitura é que era outra.
    gravado.category_slug = 'outros';

    const second = await run(makeSource(), db);

    expect(second.counters.itemsUpdated).toBe(1);
    expect(second.counters.itemsUnchanged).toBe(2);
    expect(db.events.get(gravado.id)?.category_slug).not.toBe('outros');
  });

  it('reconcilia o que a fonte deixou de mostrar', async () => {
    const db = new FakeDatabase();
    db.publishedFromSource = 3;
    await run(makeSource(), db);

    expect(db.reconciled).toHaveLength(1);
    expect(db.reconciled[0]?.sourceId).toBe('cm-tomar');
    // As chaves entregues à reconciliação são as que esta recolha viu — é
    // sobre a diferença entre elas e o catálogo que a base decide.
    expect(db.reconciled[0]?.seenKeys.length).toBeGreaterThan(0);
  });

  it('NÃO reconcilia quando a recolha rendeu pouco de mais', async () => {
    const db = new FakeDatabase();
    // A fonte tem 40 eventos publicados e esta noite trouxe três. É
    // indistinguível, do lado de cá, de uma câmara que retirou a agenda toda —
    // e apagar um concelho por causa de um timeout é o erro que isto existe
    // para não acontecer.
    db.publishedFromSource = 40;
    await run(makeSource(), db);

    expect(db.reconciled).toHaveLength(0);
  });

  it('não reconcilia em simulação', async () => {
    const db = new FakeDatabase();
    db.publishedFromSource = 3;
    await runPipeline([makeSource()], {
      db,
      http: stubHttp(LISTING_HTML),
      dryRun: true,
      triggeredBy: 'teste',
    });

    expect(db.reconciled).toHaveLength(0);
  });

  it('não escreve por cima de um campo corrigido à mão', async () => {
    const db = new FakeDatabase();
    await run(makeSource(), db);

    const [written] = [...db.events.values()];
    expect(written).toBeDefined();
    if (!written) return;

    // Alguém corrige o título na moderação e o campo fica bloqueado.
    written.title = 'Título corrigido à mão';
    written.content_hash = 'diferente-para-forcar-escrita';
    db.locks.set(written.id, ['title']);

    await run(makeSource(), db);

    const after = db.events.get(written.id);
    expect(after?.title).toBe('Título corrigido à mão');
  });

  it('uma contagem muito abaixo da linha de base não escreve nada', async () => {
    const db = new FakeDatabase();
    const outcome = await run(makeSource({ baseline_item_count: 20 }), db);

    expect(outcome.layoutDrift).toBe(true);
    expect(outcome.status).toBe('partial');
    expect(db.events.size).toBe(0);
    expect(db.submissions).toHaveLength(0);
    expect(db.closedRuns[0]?.layoutDrift).toBe(true);
    // A linha de base não pode aprender com uma leitura em que não se confia.
    expect(db.health[0]?.updateBaseline).toBe(false);
  });

  it('uma freguesia sem agenda não fica amarela todas as noites', async () => {
    // Dezoito juntas pequenas devolvem zero porque zero é o que lá está: nunca
    // publicaram um evento, e a linha de base é zero. Marcá-las de parcial
    // enchia o painel de saúde de amarelo permanente — e um painel que está
    // sempre amarelo não avisa de nada no dia em que interessa.
    const db = new FakeDatabase();
    const outcome = await run(makeSource({ baseline_item_count: 0 }), db, stubHttp('<ul></ul>'));

    expect(outcome.status).toBe('success');
    expect(outcome.counters.itemsFound).toBe(0);
    expect(outcome.layoutDrift).toBe(false);
    // A nota vai para `last_error` da fonte: uma fonte saudável não pode ficar
    // com um erro escrito na ficha.
    expect(outcome.error).toBeNull();
  });

  it('a fonte sem linha de base nenhuma também não fica amarela por trazer zero', async () => {
    // `baseline_item_count` a nulo é a fonte que ainda não tem histórico. Não
    // há queda de onde não houve subida.
    const db = new FakeDatabase();
    const outcome = await run(makeSource({ baseline_item_count: null }), db, stubHttp('<ul></ul>'));

    expect(outcome.status).toBe('success');
    expect(outcome.error).toBeNull();
  });

  it('mas a fonte que costumava dar eventos e deixou de dar continua a assinalar-se', async () => {
    // Quatro está abaixo do mínimo da `detectLayoutDrift` (cinco), por isso
    // este zero não é apanhado pela guarda de desvio — e é exactamente o caso
    // que esta regra tem de continuar a apanhar. A nota diz o que se perdeu.
    const db = new FakeDatabase();
    const outcome = await run(makeSource({ baseline_item_count: 4 }), db, stubHttp('<ul></ul>'));

    expect(outcome.status).toBe('partial');
    expect(outcome.layoutDrift).toBe(false);
    expect(outcome.error).toContain('costumava dar 4');
  });

  it('uma alteração de layout não apaga o que já lá estava', async () => {
    const db = new FakeDatabase();
    await run(makeSource(), db);
    const before = new Map(db.events);

    const outcome = await run(makeSource({ baseline_item_count: 20 }), db, stubHttp('<ul></ul>'));

    expect(outcome.layoutDrift).toBe(true);
    expect(db.events).toEqual(before);
  });

  it('a fonte com o disjuntor aberto é saltada sem abrir execução', async () => {
    const db = new FakeDatabase();
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const outcome = await run(makeSource({ circuit_open_until: future }), db);

    expect(outcome.skipped).toBe(true);
    expect(db.closedRuns).toHaveLength(0);
    expect(db.events.size).toBe(0);
  });

  it('uma fonte que rebenta fica registada e conta uma falha', async () => {
    const db = new FakeDatabase();
    const outcome = await run(makeSource({ adapter: 'nao-existe' }), db);

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('nao-existe');
    expect(db.health[0]?.succeeded).toBe(false);
    expect(db.closedRuns[0]?.status).toBe('failed');
  });

  /**
   * O harmonizador sempre soube quando não conseguia resolver um espaço.
   * Ninguém guardava a resposta, e a informação de que faltava um alias
   * perdia-se todas as noites — para voltar a perder-se na noite seguinte.
   */
  it('guarda o nome do espaço que não casou com o catálogo', async () => {
    const db = new FakeDatabase();
    const listagem = `<ul class="lista">
      <li class="evento">
        <h3><a href="/agenda/concerto">Concerto na Sociedade</a></h3>
        <time class="data" datetime="2026-12-20">20 de dezembro de 2026</time>
        <span class="local">Sociedade Filarmónica de Um Sítio Qualquer</span>
      </li>
    </ul>`;

    await runPipeline([makeSource()], {
      db,
      http: stubHttp(listagem),
      dryRun: false,
      triggeredBy: 'teste',
      output: () => undefined,
    });

    expect(db.unresolvedVenues).toContain('Sociedade Filarmónica de Um Sítio Qualquer');
  });

  it('não põe na fila um espaço que o catálogo já conhece', async () => {
    const db = new FakeDatabase();
    await runPipeline([makeSource({ venue_id: 'cine-teatro-paraiso' })], {
      db,
      http: stubHttp(LISTING_HTML),
      dryRun: false,
      triggeredBy: 'teste',
      output: () => undefined,
    });

    expect(db.unresolvedVenues).toEqual([]);
  });

  /**
   * A restrição `events_has_location` da base exige que todo o evento diga
   * onde é. Exigi-lo só lá é tarde: a gravação rebenta, o evento conta como
   * recusa, e o registo diz «não foi gravado» sem dizer o que faltava.
   *
   * Na primeira recolha a sério isso deu trinta e um eventos lidos das páginas
   * certas e nenhum gravado. O sítio passou a ser condição de revisão, um
   * passo antes — com outra consequência: a fila, não um erro.
   */
  /**
   * A câmara e a junta de freguesia a anunciar a mesma festa.
   *
   * Enquanto foram onze fontes, uma por concelho, isto não podia acontecer.
   * Com vinte e cinco agendas de junta por cima das dos municípios passa a
   * poder — e a base não trava nada: o índice de `fingerprint` não é único e
   * nunca foi consultado antes de escrever.
   *
   * O que este teste segura não é uma fusão: é a recusa de publicar o segundo
   * por conta própria. Fundir dois eventos parecidos que afinal eram dois
   * espetáculos apaga programação, e apagar programação é o contrário do que
   * esta agenda existe para fazer.
   */
  it('não publica o que outra fonte já publicou — manda decidir', async () => {
    const db = new FakeDatabase();
    db.fingerprintsDeOutrasFontes.add(
      eventFingerprint('Festa de São Sebastião', '2026-12-20', 'tomar'),
    );

    const listagem = `<ul class="lista">
      <li class="evento">
        <h3><a href="/agenda/festa">Festa de São Sebastião</a></h3>
        <time class="data" datetime="2026-12-20">20 de dezembro de 2026</time>
        <span class="local">Largo da Igreja</span>
      </li>
    </ul>`;

    const outcomes = await runPipeline([makeSource()], {
      db,
      http: stubHttp(listagem),
      dryRun: false,
      triggeredBy: 'teste',
      output: () => undefined,
    });

    expect(db.events.size).toBe(0);
    expect(outcomes[0]?.submitted).toBe(1);
    expect(db.submissions[0]?.reason).toBe(
      'já existe um evento igual, vindo de outra fonte — decidir qual fica',
    );
  });

  it('publica o que só é parecido com o que outra fonte tem', async () => {
    // A impressão digital é título + data + concelho, e por isso só apanha
    // repetições exactas. Um título diferente é outro evento até prova em
    // contrário — e a prova, se houver, é dada por uma pessoa na moderação,
    // que tem lá o seu limiar de semelhança.
    const db = new FakeDatabase();
    db.fingerprintsDeOutrasFontes.add(
      eventFingerprint('Festas em Honra de Santo António e São Sebastião', '2026-12-20', 'tomar'),
    );

    const listagem = `<ul class="lista">
      <li class="evento">
        <h3><a href="/agenda/festa">Festa de São Sebastião</a></h3>
        <time class="data" datetime="2026-12-20">20 de dezembro de 2026</time>
        <span class="local">Largo da Igreja</span>
      </li>
    </ul>`;

    await runPipeline([makeSource()], {
      db,
      http: stubHttp(listagem),
      dryRun: false,
      triggeredBy: 'teste',
      output: () => undefined,
    });

    expect(db.events.size).toBe(1);
    expect(db.submissions).toHaveLength(0);
  });

  it('manda para a fila o evento que não diz onde é, em vez de rebentar', async () => {
    const db = new FakeDatabase();
    const listagem = `<ul class="lista">
      <li class="evento">
        <h3><a href="/agenda/sem-sitio">Concerto sem morada</a></h3>
        <time class="data" datetime="2026-12-20">20 de dezembro de 2026</time>
      </li>
    </ul>`;

    const outcomes = await runPipeline([makeSource()], {
      db,
      http: stubHttp(listagem),
      dryRun: false,
      triggeredBy: 'teste',
      output: () => undefined,
    });

    expect(db.events.size).toBe(0);
    expect(outcomes[0]?.submitted).toBe(1);
    // Recusado para o catálogo, sim; mas por decisão, e não por exceção.
    expect(outcomes[0]?.status).not.toBe('failed');
    // E o motivo tem de dizer o que falta. Este teste já cá estava e só
    // verificava que o evento ia à fila — a fila recebeu os oito primeiros
    // candidatos da produção com «confiança de 0.75» escrito como motivo,
    // e nenhum deles tinha problema de confiança nenhum.
    expect(db.submissions[0]?.reason).toBe('a fonte não diz onde é — falta o espaço ou o local');
  });

  it('publica na mesma o evento que diz onde é', async () => {
    const db = new FakeDatabase();
    const listagem = `<ul class="lista">
      <li class="evento">
        <h3><a href="/agenda/com-sitio">Concerto na Casa da Cultura</a></h3>
        <time class="data" datetime="2026-12-20">20 de dezembro de 2026</time>
        <span class="local">Casa da Cultura</span>
      </li>
    </ul>`;

    await runPipeline([makeSource()], {
      db,
      http: stubHttp(listagem),
      dryRun: false,
      triggeredBy: 'teste',
      output: () => undefined,
    });

    expect(db.events.size).toBe(1);
  });

  it('em simulação lê tudo e não escreve nada', async () => {
    const db = new FakeDatabase();
    const outcomes = await runPipeline([makeSource()], {
      db,
      http: stubHttp(LISTING_HTML),
      dryRun: true,
      triggeredBy: 'teste',
      output: () => undefined,
    });

    expect(outcomes[0]?.counters.itemsNew).toBe(3);
    expect(db.events.size).toBe(0);
    expect(db.closedRuns).toHaveLength(0);
  });
});

describe('as medidas dos cartazes', () => {
  const CARTAZ = 'https://www.cm-tomar.pt/img/concerto.png';

  const LISTAGEM_COM_CARTAZ = `<ul class="lista">
  <li class="evento">
    <h3><a href="/agenda/concerto-de-natal">Concerto de Natal</a></h3>
    <time class="data" datetime="2026-12-20">20 de dezembro de 2026</time>
    <span class="local">Casa da Cultura</span>
    <img class="cartaz" src="${CARTAZ}" alt="">
  </li>
</ul>`;

  /** Um PNG de 24 bytes: a assinatura, o IHDR e as medidas. Mais nada. */
  function png(largura: number, altura: number): Uint8Array {
    return new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52,
      (largura >>> 24) & 0xff,
      (largura >>> 16) & 0xff,
      (largura >>> 8) & 0xff,
      largura & 0xff,
      (altura >>> 24) & 0xff,
      (altura >>> 16) & 0xff,
      (altura >>> 8) & 0xff,
      altura & 0xff,
    ]);
  }

  /**
   * Um cliente que sabe distinguir a listagem do cartaz — e que **conta** os
   * pedidos ao cartaz. É essa contagem que prova a parte que interessa: que
   * uma recolha em regime normal não volta a ir buscar o que já mediu.
   */
  function httpComCartaz(corpoDoCartaz: Uint8Array | null = png(1200, 1600)) {
    const pedidosAoCartaz: string[] = [];
    const http = new HttpClient({
      minHostIntervalMs: 0,
      sleep: () => Promise.resolve(),
      fetchImpl: (input) => {
        const url = String(input);
        if (url === CARTAZ) {
          pedidosAoCartaz.push(url);
          if (!corpoDoCartaz) return Promise.resolve(new Response('', { status: 503 }));
          return Promise.resolve(new Response(corpoDoCartaz, { status: 206 }));
        }
        return Promise.resolve(new Response(LISTAGEM_COM_CARTAZ, { status: 200 }));
      },
    });
    return { http, pedidosAoCartaz };
  }

  const FONTE = makeSource({ config: { ...CONFIG, imageSelector: 'img.cartaz' } });

  it('mede o cartaz na primeira recolha e guarda as medidas', async () => {
    const db = new FakeDatabase();
    const { http, pedidosAoCartaz } = httpComCartaz();
    await run(FONTE, db, http);

    const [evento] = [...db.events.values()];
    expect(evento?.image_url).toBe(CARTAZ);
    expect(evento?.image_width).toBe(1200);
    expect(evento?.image_height).toBe(1600);
    expect(pedidosAoCartaz).toHaveLength(1);
  });

  it('a segunda recolha não volta a ir buscar o cartaz que já mediu', async () => {
    // É o que torna isto barato: numa noite em que os cartazes não mudem, não
    // sai daqui um único pedido aos servidores das câmaras.
    const db = new FakeDatabase();
    await run(FONTE, db, httpComCartaz().http);

    const { http, pedidosAoCartaz } = httpComCartaz();
    const segunda = await run(FONTE, db, http);

    expect(pedidosAoCartaz).toHaveLength(0);
    expect(segunda.counters.itemsUnchanged).toBe(1);
  });

  it('um cartaz por medir é medido e escrito, mesmo com a fonte a dizer o mesmo', async () => {
    /*
     * O erro que isto trava, e que esteve escrito neste ficheiro: a condição
     * do salto perguntava se o evento **a escrever** tinha medidas — e ele
     * acabava de as receber. A recolha ia buscar o cabeçalho, lia as medidas,
     * concluía que já as tinha, saltava a escrita e deitava-as fora; na noite
     * seguinte repetia tudo, para sempre. É também o caminho por onde os
     * eventos publicados antes da 0126 ganham medidas.
     */
    const db = new FakeDatabase();
    await run(FONTE, db, httpComCartaz().http);

    const [gravado] = [...db.events.values()];
    expect(gravado).toBeDefined();
    if (!gravado) return;
    // Como se este evento tivesse sido publicado antes de as colunas existirem.
    gravado.image_width = null;
    gravado.image_height = null;

    const { http, pedidosAoCartaz } = httpComCartaz();
    const segunda = await run(FONTE, db, http);

    expect(pedidosAoCartaz).toHaveLength(1);
    expect(segunda.counters.itemsUpdated).toBe(1);
    expect(db.events.get(gravado.id)?.image_width).toBe(1200);
  });

  it('um servidor em baixo deixa o cartaz sem medidas, e não parte a recolha', async () => {
    const db = new FakeDatabase();
    const { http } = httpComCartaz(null);
    const resultado = await run(FONTE, db, http);

    const [evento] = [...db.events.values()];
    expect(evento?.image_url).toBe(CARTAZ);
    expect(evento?.image_width).toBeNull();
    // O evento entra na mesma: um cartaz sem medidas é uma vitrine reservada à
    // antiga, não um evento a menos na agenda.
    expect(resultado.counters.itemsNew).toBe(1);
  });

  it('um cartaz que muda de endereço é remedido', async () => {
    const db = new FakeDatabase();
    await run(FONTE, db, httpComCartaz().http);

    const [gravado] = [...db.events.values()];
    if (!gravado) return;
    gravado.image_url = 'https://www.cm-tomar.pt/img/cartaz-antigo.png';

    const { http, pedidosAoCartaz } = httpComCartaz(png(800, 450));
    await run(FONTE, db, http);

    expect(pedidosAoCartaz).toHaveLength(1);
    expect(db.events.get(gravado.id)?.image_width).toBe(800);
    expect(db.events.get(gravado.id)?.image_height).toBe(450);
  });
});
