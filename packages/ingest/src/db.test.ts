import { describe, expect, it } from 'vitest';
import type { EventRow } from '@coreto/core';
import { CIRCUIT_FAILURE_THRESHOLD, estadoDaFonte, mergeEventUpdate } from './db.js';
import type { SourceHealthInput } from './db.js';

function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'concerto-de-natal-abc123',
    title: 'Concerto de Natal',
    title_raw: null,
    subtitle: null,
    description: 'Pela Banda Filarmónica, com o coro juvenil do concelho.',
    description_short: 'Pela Banda Filarmónica…',
    municipality_id: 'tomar',
    venue_id: 'cine-teatro-paraiso',
    location_name: null,
    location_address: 'Rua Serpa Pinto 1',
    parish: null,
    latitude: null,
    longitude: null,
    how_to_arrive: null,
    series_id: null,
    category_slug: 'musica',
    category_confidence: 0.95,
    category_source: 'alias',
    categories_raw: ['Música'],
    tags: [],
    audience: 'all_ages',
    min_age: null,
    date_start: '2026-12-20',
    date_end: '2026-12-20',
    is_ongoing: false,
    recurrence: null,
    duration_minutes: 90,
    is_free: false,
    price_min: 10,
    price_max: 10,
    price_display: '10 €',
    price_raw: '10€',
    ticketing_url: 'https://bilheteira.pt/concerto',
    wheelchair_accessible: true,
    has_sign_language: false,
    has_audio_description: false,
    has_subtitles: false,
    is_relaxed_performance: false,
    accessibility_notes: null,
    image_url: 'https://cm-exemplo.pt/img/concerto.jpg',
    image_width: null,
    image_height: null,
    image_credit: null,
    image_alt: 'Concerto de Natal',
    status: 'published',
    origin: 'scraper',
    confidence: 0.9,
    source_id: 'cm-tomar',
    source_key: 'agenda/concerto-de-natal',
    source_url: 'https://cm-tomar.pt/agenda/concerto-de-natal',
    submission_id: null,
    fingerprint: 'f1',
    duplicate_group_id: null,
    is_canonical: true,
    content_hash: 'hash-antigo',
    raw: null,
    published_at: '2026-10-01T09:00:00.000Z',
    last_seen_at: '2026-10-01T09:00:00.000Z',
    created_at: '2026-09-01T09:00:00.000Z',
    updated_at: '2026-10-01T09:00:00.000Z',
    ...overrides,
  };
}

describe('mergeEventUpdate', () => {
  it('sem linha anterior, fica o que a recolha trouxe', () => {
    const incoming = makeEvent({ id: 'novo' });
    expect(mergeEventUpdate(null, incoming)).toBe(incoming);
  });

  it('não apaga a descrição quando a recolha a perde', () => {
    const existing = makeEvent();
    const incoming = makeEvent({
      description: null,
      description_short: null,
      content_hash: 'novo',
    });

    const merged = mergeEventUpdate(existing, incoming);

    expect(merged.description).toBe(existing.description);
    expect(merged.description_short).toBe(existing.description_short);
  });

  it('não apaga imagem, espaço, morada nem etiquetas com valores vazios', () => {
    const existing = makeEvent({ tags: ['destaque'] });
    const incoming = makeEvent({
      image_url: null,
      venue_id: null,
      location_address: '   ',
      categories_raw: [],
      tags: [],
      content_hash: 'novo',
    });

    const merged = mergeEventUpdate(existing, incoming);

    expect(merged.image_url).toBe(existing.image_url);
    expect(merged.venue_id).toBe('cine-teatro-paraiso');
    expect(merged.location_address).toBe('Rua Serpa Pinto 1');
    expect(merged.categories_raw).toEqual(['Música']);
    expect(merged.tags).toEqual(['destaque']);
  });

  it('aceita valores novos que não são vazios', () => {
    const existing = makeEvent();
    const incoming = makeEvent({
      title: 'Concerto de Natal — 2.ª parte',
      description: 'Texto novo da câmara.',
      content_hash: 'novo',
    });

    const merged = mergeEventUpdate(existing, incoming);

    expect(merged.title).toBe('Concerto de Natal — 2.ª parte');
    expect(merged.description).toBe('Texto novo da câmara.');
    expect(merged.content_hash).toBe('novo');
  });

  it('mantém o preço inteiro quando a recolha não traz preço nenhum', () => {
    const existing = makeEvent();
    const incoming = makeEvent({
      is_free: false,
      price_min: null,
      price_max: null,
      price_display: null,
      price_raw: null,
    });

    const merged = mergeEventUpdate(existing, incoming);

    expect(merged.price_display).toBe('10 €');
    expect(merged.price_min).toBe(10);
    expect(merged.is_free).toBe(false);
  });

  it('não faz de um evento gratuito um evento pago por o seletor ter mudado', () => {
    const existing = makeEvent({
      is_free: true,
      price_min: 0,
      price_max: null,
      price_display: 'Entrada livre',
      price_raw: 'Entrada livre',
    });
    const incoming = makeEvent({
      is_free: false,
      price_min: null,
      price_max: null,
      price_display: null,
      price_raw: null,
    });

    expect(mergeEventUpdate(existing, incoming).is_free).toBe(true);
  });

  it('não mexe no que pertence à moderação', () => {
    const existing = makeEvent();
    const incoming = makeEvent({
      id: '22222222-2222-4222-8222-222222222222',
      slug: 'outro-slug',
      status: 'draft',
      published_at: null,
      is_canonical: false,
      created_at: '2027-01-01T00:00:00.000Z',
    });

    const merged = mergeEventUpdate(existing, incoming);

    expect(merged.id).toBe(existing.id);
    expect(merged.slug).toBe('concerto-de-natal-abc123');
    expect(merged.status).toBe('published');
    expect(merged.published_at).toBe(existing.published_at);
    expect(merged.is_canonical).toBe(true);
    expect(merged.created_at).toBe(existing.created_at);
  });

  it('deixa passar o que é mesmo da recolha', () => {
    const existing = makeEvent();
    const incoming = makeEvent({
      last_seen_at: '2026-11-11T03:00:00.000Z',
      updated_at: '2026-11-11T03:00:00.000Z',
      content_hash: 'novo',
    });

    const merged = mergeEventUpdate(existing, incoming);

    expect(merged.last_seen_at).toBe('2026-11-11T03:00:00.000Z');
    expect(merged.updated_at).toBe('2026-11-11T03:00:00.000Z');
  });

  it('não baixa a confiança de um evento já revisto', () => {
    const existing = makeEvent({ confidence: 0.95 });
    const incoming = makeEvent({ confidence: 0.6 });

    expect(mergeEventUpdate(existing, incoming).confidence).toBe(0.95);
  });
});

/**
 * O preço não se funde coluna a coluna.
 *
 * A regra do «preenchido nunca vira vazio» é boa para a descrição e para a
 * imagem, onde cada campo vale por si. No preço vale ao contrário: as cinco
 * colunas são uma resposta só, e metade de uma leitura ao lado de metade de
 * outra é uma linha que se contradiz a si própria.
 *
 * O caso medido em produção a 7 de setembro de 2026: o XXIX Grande Prémio do
 * Museu Nacional Ferroviário, no Entroncamento, com `price_min = 2` de uma
 * noite em que o leitor conseguiu ler, ao lado de `price_display = '€2.00'` de
 * uma noite em que já não conseguia. A ficha mostrava «€2.00»; os dados
 * estruturados da mesma página publicavam 2.
 */
describe('mergeEventUpdate e o preço em bloco', () => {
  it('uma leitura nova não fica ao lado de metade da antiga', () => {
    const existing = makeEvent({
      is_free: false,
      price_min: 2,
      price_max: 2,
      price_display: '2 €',
      price_raw: '€2.00',
    });
    // A recolha desta noite trouxe o campo da fonte e não conseguiu tirar dele
    // um número: o rótulo cai para a cadeia crua.
    const incoming = makeEvent({
      is_free: false,
      price_min: null,
      price_max: null,
      price_display: '€2.00',
      price_raw: '€2.00',
    });

    const merged = mergeEventUpdate(existing, incoming);

    expect(merged.price_min).toBe(null);
    expect(merged.price_display).toBe('€2.00');
  });

  it('e quando a recolha não traz preço nenhum ficam as cinco que lá estavam', () => {
    const existing = makeEvent({
      is_free: false,
      price_min: 7.5,
      price_max: 10,
      price_display: '7,50 € – 10 €',
      price_raw: 'Bilhetes: 10€ (desconto 7,50€)',
    });
    const incoming = makeEvent({
      is_free: false,
      price_min: null,
      price_max: null,
      price_display: null,
      price_raw: null,
    });

    const merged = mergeEventUpdate(existing, incoming);

    expect(merged.price_min).toBe(7.5);
    expect(merged.price_max).toBe(10);
    expect(merged.price_display).toBe('7,50 € – 10 €');
    expect(merged.price_raw).toBe('Bilhetes: 10€ (desconto 7,50€)');
  });
});

/**
 * O disjuntor conta o que não se conseguiu ler, e não o que se leu a menos.
 *
 * **Esta regra nunca esteve ao alcance de um teste, e trancou um concelho.**
 * O `updateSourceHealth` só era exercido pelo duplo do `FakeDatabase`, que se
 * limita a guardar o que recebe; a decisão de abrir o disjuntor corria só em
 * produção. Por isso foi lá que se partiu, e em silêncio.
 *
 * O que se partiu: um único booleano — `succeeded` — governava três coisas
 * diferentes ao mesmo tempo. Se a linha de base treina, se `last_success_at`
 * avança, e se o disjuntor conta uma falha. Para as duas primeiras está
 * certo. Para a terceira estava errado.
 *
 * A Câmara do Sardoal publicou seis eventos, depois cinco, depois quatro,
 * depois três. Programação a encolher, sem defeito nenhum de extração — o
 * adaptador lê os quatro blocos que a página tem, e um deles é uma reunião de
 * câmara que o nosso próprio `excludeTitles` tira. Ao fim de cinco leituras
 * assim o disjuntor abriu e o concelho deixou de ser lido, por ter menos
 * programação. E a saída estava fechada por dentro: para voltar a «normal», a
 * contagem precisava dos itens que já não existiam, e a linha de base que a
 * julgava estava congelada pelo mesmo booleano que a condenava.
 */
describe('estadoDaFonte — o que abre e o que fecha o disjuntor', () => {
  const AGORA = new Date('2026-09-14T09:00:00.000Z');

  const leitura = (overrides: Partial<SourceHealthInput> = {}): SourceHealthInput => ({
    succeeded: false,
    error: null,
    itemsFound: 3,
    consecutiveFailures: 0,
    baseline: 6,
    updateBaseline: false,
    leu: true,
    ...overrides,
  });

  it('uma contagem em baixo não conta como falha, por mais noites que dure', () => {
    // O caso do Sardoal: respondeu, trouxe menos, e é isso.
    let falhas = 0;
    for (let noite = 0; noite < CIRCUIT_FAILURE_THRESHOLD + 3; noite += 1) {
      const patch = estadoDaFonte(
        leitura({ consecutiveFailures: falhas, error: 'queda na contagem: 3 contra 6' }),
        AGORA,
      );
      falhas = patch['consecutive_failures'] as number;
      expect(patch['circuit_open_until'], `noite ${noite + 1}`).toBeNull();
    }
    expect(falhas).toBe(0);
  });

  it('mas uma fonte que não se consegue ler abre o disjuntor à quinta', () => {
    let falhas = 0;
    let aberto: unknown = null;
    for (let noite = 0; noite < CIRCUIT_FAILURE_THRESHOLD; noite += 1) {
      const patch = estadoDaFonte(leitura({ leu: false, consecutiveFailures: falhas }), AGORA);
      falhas = patch['consecutive_failures'] as number;
      aberto = patch['circuit_open_until'];
      if (noite < CIRCUIT_FAILURE_THRESHOLD - 1) expect(aberto).toBeUndefined();
    }
    expect(falhas).toBe(CIRCUIT_FAILURE_THRESHOLD);
    expect(aberto).toBe('2026-09-15T09:00:00.000Z');
  });

  it('e uma leitura que se fez fecha o disjuntor, mesmo com a contagem em baixo', () => {
    // A saída que faltava. O servidor voltou a responder: é disso que o
    // disjuntor trata, e não do número de eventos que a casa publica.
    const patch = estadoDaFonte(leitura({ leu: true, consecutiveFailures: 6 }), AGORA);

    expect(patch['circuit_open_until']).toBeNull();
    expect(patch['consecutive_failures']).toBe(0);
    // Mas não se declara sucesso nem se treina a linha de base com uma
    // contagem em que não se confia — isso continua como estava.
    expect(patch['last_success_at']).toBeUndefined();
    expect(patch['baseline_item_count']).toBeUndefined();
  });

  it('uma leitura boa avança o sucesso e treina a linha de base', () => {
    const patch = estadoDaFonte(
      leitura({ succeeded: true, updateBaseline: true, itemsFound: 6, baseline: 6 }),
      AGORA,
    );

    expect(patch['last_success_at']).toBe(AGORA.toISOString());
    expect(patch['baseline_item_count']).toBe(6);
    expect(patch['circuit_open_until']).toBeNull();
  });
});
