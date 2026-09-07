import { describe, expect, it } from 'vitest';
import type { EventRow } from '@coreto/core';
import { mergeEventUpdate } from './db.js';

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
