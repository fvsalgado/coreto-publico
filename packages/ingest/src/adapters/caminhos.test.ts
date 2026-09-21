import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MUNICIPALITIES, slugify } from '@coreto/core';
import type { SourceRow } from '../adapter.js';
import { HttpClient } from '../http.js';
import { RunLogger } from '../run-logger.js';
import { caminhosAdapter, lerFicha, lerGrelha, lerSessoes, partirTitulo } from './caminhos.js';

import { comRobots } from '../robots-de-teste.js';
/**
 * Corre contra as páginas verdadeiras de caminhos.mediotejo.pt, capturadas a
 * 28 de agosto de 2026. Quando um destes testes falhar, a hipótese mais
 * provável é o tema Elementor ter mudado.
 */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__');
const URL_GRELHA = 'https://caminhos.mediotejo.pt/programacao/';
const URL_BONECAS =
  'https://caminhos.mediotejo.pt/eventos/bonecas-de-constancia-teatro-e-marionetas-de-mandragora/';

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

function source(): SourceRow {
  return {
    id: 'caminhos-cimt',
    name: 'CAMINHOS — Programação Cultural em Rede',
    kind: 'municipal_site',
    // A fonte é regional: o concelho vem em cada evento, não daqui.
    municipality_id: null,
    region_id: null,
    venue_id: null,
    url: URL_GRELHA,
    adapter: 'caminhos',
    config: {},
    is_enabled: true,
    baseline_item_count: null,
    min_expected_items: 1,
    consecutive_failures: 0,
    circuit_open_until: null,
    cartaz_alojavel: false,
  };
}

function stubHttp(porUrl: (url: string) => string): HttpClient {
  return new HttpClient({
    minHostIntervalMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: comRobots((input) =>
      Promise.resolve(new Response(porUrl(String(input)), { status: 200 })),
    ),
  });
}

function log(): RunLogger {
  return new RunLogger({ sourceId: 'caminhos-cimt', output: () => undefined });
}

describe('os onze concelhos casam por slug', () => {
  // O adaptador resolve o texto do concelho contra `MUNICIPALITIES` por
  // slug. Isto só é verdade enquanto `slugify(name) === id` para os onze —
  // e é este teste que transforma essa coincidência num contrato.
  it('slugify(name) é o id em todos', () => {
    for (const municipality of MUNICIPALITIES) {
      expect(slugify(municipality.name)).toBe(municipality.id);
    }
  });
});

describe('lerGrelha', () => {
  it('lê os cartões com endereço e imagem', () => {
    const cartoes = lerGrelha(fixture('caminhos.html'));
    expect(cartoes.size).toBe(3);

    const bonecas = cartoes.get(URL_BONECAS);
    expect(bonecas?.imageUrl).toContain('wp-content/uploads');
  });
});

describe('lerSessoes', () => {
  it('lê data, hora, espaço e concelho de cada sessão', () => {
    const { sessoes, porResolver } = lerSessoes(fixture('caminhos-evento.html'));
    expect(porResolver).toEqual([]);
    expect(sessoes).toHaveLength(4);

    expect(sessoes[0]).toEqual({
      session: { date: '2026-04-13', startTime: '11:00' },
      municipalityId: 'ferreira-do-zezere',
      venue: 'Centro Escolar de Ferreira do Zêzere',
    });
    expect(sessoes[2]?.municipalityId).toBe('constancia');
    expect(sessoes[2]?.venue).toBe('Museu dos Rios e das Artes Marítimas (jardim)');
    expect(sessoes[3]?.session.startTime).toBe('14:00');
  });

  it('sem linha de concelho, lê-o do nome do espaço quando lá está', () => {
    // A página das Adufeiras diz «01.05.2026 / 18:00 ⏎ Cine-Teatro de Mação»
    // e a linha do concelho vem vazia — o nome do espaço trai a terra.
    const { sessoes, porResolver } = lerSessoes(fixture('caminhos-evento-sem-concelho.html'));
    expect(porResolver).toEqual([]);
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]).toEqual({
      session: { date: '2026-05-01', startTime: '18:00' },
      municipalityId: 'macao',
      venue: 'Cine-Teatro de Mação',
    });
  });
});

describe('lerFicha', () => {
  it('classifica os blocos pelo que contêm', () => {
    const ficha = lerFicha(fixture('caminhos-evento.html'));
    expect(ficha.categoria).toBe('Teatro Marionetas');
    expect(ficha.duracaoMinutos).toBe(30);
    expect(ficha.publico).toBe('Comunidade escolar (M/3)');
    expect(ficha.condicoesDeAcesso).toBe('Espetáculo restrito à comunidade escolar');
    expect(ficha.descricao).toBe('Espetáculo dirigido ao público escolar.');
    // «restrito à comunidade escolar» não diz que é grátis, e não se inventa.
    expect(ficha.gratuito).toBeNull();
  });
});

describe('partirTitulo', () => {
  it('parte «Produção | Companhia» em título e subtítulo', () => {
    expect(partirTitulo('Bonecas de Constância | Teatro e Marionetas de Mandrágora')).toEqual({
      title: 'Bonecas de Constância',
      subtitle: 'Teatro e Marionetas de Mandrágora',
    });
    expect(partirTitulo('Coro dos Comuns')).toEqual({ title: 'Coro dos Comuns', subtitle: null });
  });
});

describe('caminhosAdapter', () => {
  it('devolve um evento por concelho, com as sessões desse concelho', async () => {
    const http = stubHttp((url) =>
      url === URL_GRELHA ? fixture('caminhos.html') : fixture('caminhos-evento.html'),
    );

    const events = await caminhosAdapter.fetchEvents({ source: source(), http, log: log() });

    // 3 cartões na grelha; o detalhe (o mesmo para os três, no stub) tem
    // sessões em dois concelhos → 2 eventos por produção.
    expect(events).toHaveLength(6);

    const fz = events.find((event) => event.municipalityId === 'ferreira-do-zezere');
    const constancia = events.find((event) => event.municipalityId === 'constancia');

    // Dois espaços diferentes em FZ: o local desce a cada sessão.
    expect(fz?.venueName).toBeNull();
    expect(fz?.locationName).toBe(
      'Centro Escolar de Ferreira do Zêzere · Centro Escolar de Areias',
    );
    expect(fz?.dates).toHaveLength(2);
    expect(fz?.dates[0]?.venueOverride).toBe('Centro Escolar de Ferreira do Zêzere');

    // Um só espaço em Constância: sobe para o evento, para casar por alias.
    expect(constancia?.venueName).toBe('Museu dos Rios e das Artes Marítimas (jardim)');
    expect(constancia?.dates).toHaveLength(2);
    expect(constancia?.dates[0]?.venueOverride).toBeNull();

    // A identidade separa os concelhos e a série liga a rede.
    expect(fz?.sourceKey).toBe(
      'bonecas-de-constancia-teatro-e-marionetas-de-mandragora:ferreira-do-zezere',
    );
    expect(fz?.seriesId).toBe('caminhos');
    expect(fz?.subtitle).toBe('Teatro e Marionetas de Mandrágora');
    expect(fz?.durationMinutes).toBe(30);
    expect(fz?.audienceRaw).toBe('Comunidade escolar (M/3)');
    expect(fz?.accessibilityNotes).toBe('Espetáculo restrito à comunidade escolar');
    expect(fz?.imageUrl).toContain('wp-content/uploads');
  });
});
