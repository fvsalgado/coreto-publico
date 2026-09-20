import type { EventFilter } from '@coreto/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedContext } from '@/src/lib/feeds/build';
import { FEED_CACHE_CONTROL, ICAL_CONTENT_TYPE } from '@/src/lib/feeds/http';
import { unfoldLines } from '@/src/lib/feeds/ical';
import type { FeedPayload } from '@/src/lib/feeds/load';
import type { EventCard } from '@/src/lib/queries/types';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';

/**
 * A subscrição da agenda inteira.
 *
 * Quem subscreve isto põe e esquece — daí cem eventos e não cinquenta, e daí
 * o `inline`: quem abre o endereço no navegador quer que o calendário o
 * apanhe, não um ficheiro na pasta das transferências. O nome do calendário
 * e os UID são da região que responde; um UID com o domínio de outra
 * duplicava a agenda de quem já subscreveu. O formato tem os seus testes em
 * `feeds/ical.test.ts`; aqui prova-se a costura, com uma sessão só.
 */

const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
const loadFeed = vi.hoisted(() =>
  vi.fn<(regiao: Regiao, filter: EventFilter) => Promise<FeedPayload>>(),
);

vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao }));
vi.mock('@/src/lib/feeds/load', () => ({ loadFeed }));

const { GET, CALENDAR_LIMIT } = await import('./route');

/**
 * Uma segunda região, montada sobre a de recurso com o que esta rota lê.
 *
 * Não é o Médio Tejo de propósito: a Travessia descreve-se pelo domínio dela
 * e não pelo do deployment, e assim qualquer «mediotejo» que apareça no
 * calendário é uma fuga entre regiões, não uma coincidência.
 */
const TRAVESSIA: Regiao = {
  ...REGIAO_DE_RECURSO,
  id: 'travessia',
  nome: 'Travessia do Zêzere',
  artigo: 'a',
  doNome: 'da Travessia do Zêzere',
  noNome: 'na Travessia do Zêzere',
  dominio: 'coreto.travessia.example',
  email: 'coreto@travessia.example',
  dominioDosUid: 'coreto.travessia.example',
  tagline: null,
  concelhosDeclarados: 2,
  concelhosPorExtenso: 'dois',
};

const ORIGEM = 'https://coreto.travessia.example';

const EVENTO: EventCard = {
  id: 'e1',
  slug: 'concerto-de-ano-novo',
  title: 'Concerto de Ano Novo',
  description_short: 'A banda dos bombeiros abre o ano.',
  municipality_id: 'serta',
  venue_id: 'cine-teatro',
  location_name: null,
  category_slug: 'musica',
  category_confidence: 0.95,
  category_source: 'alias',
  date_start: '2027-01-01',
  date_end: null,
  is_ongoing: false,
  is_free: true,
  price_display: null,
  image_url: null,
  image_alt: null,
  wheelchair_accessible: true,
  has_sign_language: false,
  has_audio_description: false,
  has_subtitles: false,
  is_relaxed_performance: false,
  audience: 'all_ages',
};

const CONTEXTO: FeedContext = {
  siteUrl: ORIGEM,
  uidDomain: 'coreto.travessia.example',
  municipalityNames: { serta: 'Sertã' },
  venueNames: { 'cine-teatro': 'Cine-Teatro' },
  categoryNames: { musica: 'Música' },
  sessions: {
    e1: [
      {
        event_id: 'e1',
        session_date: '2027-01-01',
        start_time: '21:30:00',
        end_time: null,
        location_override: null,
        is_cancelled: false,
      },
    ],
  },
  timestamps: { e1: '2026-12-01T10:00:00Z' },
};

const PEDIDO = new Request(`${ORIGEM}/agenda.ics`);

function contexto(regiao: string): { params: Promise<{ regiao: string }> } {
  return { params: Promise.resolve({ regiao }) };
}

async function calendario(): Promise<{ resposta: Response; linhas: string[] }> {
  const resposta = await GET(PEDIDO, contexto('travessia'));
  expect(resposta.status).toBe(200);
  return { resposta, linhas: unfoldLines(await resposta.text()) };
}

describe('GET /agenda.ics', () => {
  beforeEach(() => {
    exigirRegiao.mockReset().mockResolvedValue(TRAVESSIA);
    loadFeed.mockReset().mockResolvedValue({ events: [EVENTO], total: 1, context: CONTEXTO });
  });

  it('serve um calendário para o navegador abrir, não para transferir', async () => {
    const { resposta } = await calendario();

    expect(resposta.headers.get('Content-Type')).toBe(ICAL_CONTENT_TYPE);
    expect(resposta.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
    expect(resposta.headers.get('Content-Disposition')).toBe(
      'inline; filename="coreto-travessia.ics"',
    );
    expect(resposta.headers.get('Cache-Control')).toBe(FEED_CACHE_CONTROL);
  });

  it('o calendário tem o nome, a descrição e a ligação da região', async () => {
    const { linhas } = await calendario();

    expect(linhas[0]).toBe('BEGIN:VCALENDAR');
    expect(linhas.at(-1)).toBe('END:VCALENDAR');
    expect(linhas).toContain('X-WR-CALNAME:Coreto — Travessia do Zêzere');
    expect(linhas).toContain(
      'X-WR-CALDESC:A agenda cultural dos dois concelhos da Travessia do Zêzere.',
    );
    expect(linhas).toContain(`URL:${ORIGEM}/agenda`);
    expect(linhas.join('\n')).not.toContain('mediotejo');
  });

  it('pede cem eventos: quem subscreve quer ver o mês seguinte inteiro', async () => {
    await calendario();

    expect(CALENDAR_LIMIT).toBe(100);
    expect(loadFeed).toHaveBeenCalledWith(TRAVESSIA, { page: 1, limit: 100 });
  });

  it('uma sessão dá um VEVENT com o UID no domínio da região e o sítio por extenso', async () => {
    const { linhas } = await calendario();

    expect(linhas).toContain('BEGIN:VEVENT');
    expect(linhas).toContain('UID:e1-2027-01-01-213000@coreto.travessia.example');
    expect(linhas).toContain('DTSTART;TZID=Europe/Lisbon:20270101T213000');
    expect(linhas).toContain('SUMMARY:Concerto de Ano Novo');
    // A vírgula do sítio vai escapada: é a regra do formato, e é o que parte
    // um calendário quando falha.
    expect(linhas).toContain('LOCATION:Cine-Teatro\\, Sertã');
    expect(linhas).toContain(`URL:${ORIGEM}/evento/concerto-de-ano-novo`);
    expect(linhas).toContain('STATUS:CONFIRMED');
    expect(linhas).toContain('LAST-MODIFIED:20261201T100000Z');
  });
});
