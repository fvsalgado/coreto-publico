import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { EventCard } from '../queries/types';
import { eventCalendarPath, toCalendarEntries, toRssItems, type FeedContext } from './build';
import type { FeedSession } from './data';

/**
 * A regra que estes testes protegem: uma sessão é um compromisso, uma
 * temporada não é. Uma exposição publicada dia a dia não pode encher a agenda
 * de quem subscreveu com sessenta entradas iguais.
 */

const EVENT: EventCard = {
  id: 'e1',
  slug: 'concerto-de-ano-novo',
  title: 'Concerto de Ano Novo',
  description_short: 'A banda dos bombeiros abre o ano.',
  municipality_id: 'tomar',
  venue_id: 'cine-teatro',
  location_name: null,
  category_slug: 'musica',
  category_confidence: 0.95,
  category_source: 'alias',
  date_start: '2027-01-01',
  date_end: '2027-01-03',
  is_ongoing: false,
  is_free: true,
  price_display: null,
  image_url: null,
  image_miniatura: null,
  image_alt: null,
  wheelchair_accessible: true,
  has_sign_language: false,
  has_audio_description: false,
  has_subtitles: false,
  is_relaxed_performance: false,
  audience: 'all_ages',
};

function session(overrides: Partial<FeedSession> = {}): FeedSession {
  return {
    event_id: 'e1',
    session_date: '2027-01-01',
    // Postgres devolve `time` como HH:MM:SS; é essa a forma que chega aqui.
    start_time: '21:30:00',
    end_time: null,
    location_override: null,
    is_cancelled: false,
    ...overrides,
  };
}

/**
 * A identidade do Médio Tejo, escrita por extenso de propósito: estes valores
 * são sentinelas. O domínio dos UID é um espaço de nomes permanente — mudá-lo
 * duplicava os calendários de quem já subscreveu — e por isso os testes
 * afirmam o valor real, não uma abstração dele.
 */
const IDENTIDADE_MT = {
  siteUrl: 'https://coreto.mediotejo.pt',
  uidDomain: 'coreto.mediotejo.pt',
} as const;

function context(
  sessions: FeedSession[],
  identidade: { siteUrl: string; uidDomain: string } = IDENTIDADE_MT,
): FeedContext {
  return {
    ...identidade,
    municipalityNames: { tomar: 'Tomar' },
    venueNames: { 'cine-teatro': 'Cine-Teatro Paraíso' },
    categoryNames: { musica: 'Música' },
    sessions: { e1: sessions },
    timestamps: { e1: '2026-12-01T10:00:00Z' },
  };
}

describe('toCalendarEntries', () => {
  it('dá um VEVENT por sessão', () => {
    const entries = toCalendarEntries(
      [EVENT],
      context([session(), session({ session_date: '2027-01-02', start_time: '17:00:00' })]),
    );

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.uid)).toEqual([
      'e1-2027-01-01-213000@coreto.mediotejo.pt',
      'e1-2027-01-02-170000@coreto.mediotejo.pt',
    ]);
    expect(entries[0]?.startTime).toBe('21:30:00');
    expect(entries[0]?.location).toBe('Cine-Teatro Paraíso, Tomar');
  });

  it('encolhe para um único compromisso quando as sessões são de mais', () => {
    const many = Array.from({ length: 40 }, (_unused, index) =>
      session({ session_date: `2027-01-${String(index + 1).padStart(2, '0')}`, start_time: null }),
    );
    const entries = toCalendarEntries([EVENT], context(many));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.uid).toBe('e1@coreto.mediotejo.pt');
    expect(entries[0]?.date).toBe('2027-01-01');
    expect(entries[0]?.endDate).toBe('2027-01-03');
    expect(entries[0]?.startTime).toBeUndefined();
  });

  /**
   * A exposição de três meses, que é o caso que trouxe tudo isto à superfície.
   *
   * Chega com duas sessões — abre a 3 de junho, fecha a 27 de setembro —, e
   * duas sessões passam por baixo do tecto de doze sem tocar nele. O
   * calendário escrevia dois compromissos: quem subscrevesse ficava com a
   * exposição marcada no dia de abrir e no dia de fechar, e os quase quatro
   * meses do meio — que são a exposição — em branco. Duas marcações falsas
   * onde a informação era um intervalo.
   */
  it('uma exposição em cartaz dá um compromisso só, e não um por ponta', () => {
    const exposicao: EventCard = {
      ...EVENT,
      title: 'Exposição de gravura',
      date_start: '2027-06-03',
      date_end: '2027-09-27',
      is_ongoing: true,
    };
    const pontas = [
      session({ session_date: '2027-06-03', start_time: null }),
      session({ session_date: '2027-09-27', start_time: null }),
    ];

    const entries = toCalendarEntries([exposicao], context(pontas));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.uid).toBe('e1@coreto.mediotejo.pt');
    expect(entries[0]?.date).toBe('2027-06-03');
    expect(entries[0]?.endDate).toBe('2027-09-27');
    // Sem hora: uma exposição não começa às nove e meia, está aberta.
    expect(entries[0]?.startTime).toBeUndefined();
  });

  it('respeita o local próprio de uma sessão em itinerância', () => {
    const entries = toCalendarEntries(
      [EVENT],
      context([session({ location_override: 'Coreto do Jardim' })]),
    );
    expect(entries[0]?.location).toBe('Coreto do Jardim, Tomar');
  });

  it('deixa de fora um evento sem sessões e sem data', () => {
    const undated: EventCard = { ...EVENT, date_start: null, date_end: null };
    expect(toCalendarEntries([undated], context([]))).toHaveLength(0);
  });

  it('leva o preço e a ligação na descrição', () => {
    const entries = toCalendarEntries([EVENT], context([session()]));
    expect(entries[0]?.description).toContain('Entrada livre');
    expect(entries[0]?.description).toContain(
      'https://coreto.mediotejo.pt/evento/concerto-de-ano-novo',
    );
    expect(entries[0]?.categories).toEqual(['Música']);
  });

  it('numa segunda região, os UID e as ligações são do domínio dela', () => {
    // É a promessa multi-inquilino ao nível dos feeds: nem um byte do Médio
    // Tejo num calendário da Travessia — nem o contrário.
    const entries = toCalendarEntries(
      [EVENT],
      context([session()], {
        siteUrl: 'https://coreto.travessia.example',
        uidDomain: 'coreto.travessia.example',
      }),
    );
    expect(entries[0]?.uid).toBe('e1-2027-01-01-213000@coreto.travessia.example');
    expect(entries[0]?.description).toContain(
      'https://coreto.travessia.example/evento/concerto-de-ano-novo',
    );
    expect(entries[0]?.uid).not.toContain('mediotejo');
  });
});

describe('toRssItems', () => {
  it('resume a data, o sítio e o preço antes do texto', () => {
    const [rssItem] = toRssItems([EVENT], context([session()]));

    expect(rssItem?.title).toBe('Concerto de Ano Novo');
    expect(rssItem?.link).toBe('https://coreto.mediotejo.pt/evento/concerto-de-ano-novo');
    expect(rssItem?.description).toBe(
      '1–3 jan · Cine-Teatro Paraíso, Tomar · Entrada livre\n\nA banda dos bombeiros abre o ano.',
    );
  });

  it('usa a última alteração como data de publicação', () => {
    const [rssItem] = toRssItems([EVENT], context([session()]));
    expect(rssItem?.pubDate?.toISOString()).toBe('2026-12-01T10:00:00.000Z');
  });
});

/**
 * O caminho do calendário de um evento tem de existir mesmo.
 *
 * Este teste não verifica uma string contra outra string — isso não apanhava
 * nada, porque foi exactamente assim que o erro entrou: alguém escreveu
 * `/evento/<endereço>.ics` na ficha, a rota chamava-se
 * `/evento/<endereço>/agenda.ics`, e as duas coisas nunca se olharam. O que
 * este teste faz é ir ao disco perguntar se há um `route.ts` no caminho que a
 * função devolve. Se alguém mudar a rota de sítio, falha aqui e não em
 * produção, com o botão «Adicionar ao calendário» a dar 404 em todas as
 * fichas.
 */
describe('eventCalendarPath', () => {
  it('aponta para uma rota que existe no disco', () => {
    const caminho = eventCalendarPath('concerto-de-ano-novo');
    expect(caminho).toBe('/evento/concerto-de-ano-novo/agenda.ics');

    // O segmento dinâmico do App Router escreve-se `[slug]` no disco — e a
    // rota vive dentro do segmento da região, que o caminho público não tem:
    // é o middleware que o acrescenta.
    const noDisco = `/[regiao]${caminho.replace('/concerto-de-ano-novo/', '/[slug]/')}`;
    const ficheiro = fileURLToPath(new URL(`../../../app${noDisco}/route.ts`, import.meta.url));
    expect(existsSync(ficheiro), `não há rota em app${noDisco}/route.ts`).toBe(true);
  });
});
