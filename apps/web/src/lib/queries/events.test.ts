import { describe, expect, it, vi } from 'vitest';

import { withCardTimes, type SessionTime } from './events';
import type { EventCard } from './types';

/**
 * A hora no cartão.
 *
 * A hora existia na base desde a migração 0004, saía na API pública e
 * aparecia na ficha — e nenhum dos 128 cartões da agenda a mostrava, porque
 * as sessões só se carregavam em `loadFeed` e as páginas chamam `listEvents`.
 * Isto é a regra que decide qual das sessões é «a hora do cartão», isolada do
 * React e da base para poder falhar aqui e não em produção.
 *
 * Os casos são os do Médio Tejo a 7 de setembro de 2026, medidos na API
 * pública: das cinquenta primeiras entradas, trinta e uma passam a mostrar
 * hora e quatro não a mostram por estarem em cartaz.
 */

const HOJE = '2026-09-07';

const EVENTO: EventCard = {
  id: 'e1',
  slug: 'raizes-de-montalvo-48ec4a',
  title: 'Raízes de Montalvo',
  description_short: null,
  municipality_id: 'constancia',
  venue_id: null,
  location_name: 'Escola Adães Bermudes, Montalvo',
  category_slug: 'comunidade',
  category_confidence: 0.95,
  category_source: 'alias',
  date_start: '2026-09-07',
  date_end: '2026-09-07',
  is_ongoing: false,
  is_free: true,
  price_display: 'Entrada livre',
  image_url: null,
  image_miniatura: null,
  image_alt: null,
  wheelchair_accessible: null,
  has_sign_language: false,
  has_audio_description: false,
  has_subtitles: false,
  is_relaxed_performance: false,
  audience: null,
};

function sessao(overrides: Partial<SessionTime> = {}): SessionTime {
  return {
    session_date: '2026-09-07',
    start_time: '17:30:00',
    is_cancelled: false,
    ...overrides,
  };
}

/** Uma leitura de sessões que devolve estas, sem ir à base. */
function leitura(sessions: Record<string, SessionTime[]>) {
  return () => Promise.resolve(sessions);
}

async function hora(event: EventCard, sessions: SessionTime[]): Promise<string | null> {
  const [cartao] = await withCardTimes([event], HOJE, leitura({ [event.id]: sessions }));
  return cartao?.start_time ?? null;
}

describe('withCardTimes', () => {
  it('dá a hora da sessão do dia que o cartão anuncia', async () => {
    expect(await hora(EVENTO, [sessao()])).toBe('17:30:00');
  });

  it('com duas sessões no mesmo dia, dá a primeira', async () => {
    // As duas turmas de yoga sénior de Vila Nova da Barquinha são dois
    // eventos; um só evento com duas sessões no mesmo dia é a matiné e a
    // sessão da noite, e quem lê o cartão quer saber a que horas aquilo abre.
    const horas = [sessao({ start_time: '21:30:00' }), sessao({ start_time: '15:00:00' })];
    expect(await hora(EVENTO, horas)).toBe('15:00:00');
  });

  it('ignora as sessões de outros dias', async () => {
    // O cartão está no grupo do dia da estreia; a hora da sessão de sábado não
    // é a hora deste cartão.
    expect(
      await hora(EVENTO, [sessao({ session_date: '2026-09-12', start_time: '21:00:00' })]),
    ).toBeNull();
  });

  it('não inventa hora para um evento em cartaz', async () => {
    // «Festa de Águas Belas», 11 a 13 de setembro, com a sessão de abertura às
    // 18h: um horário de abertura não é a hora de uma sessão, e «11–13 set ·
    // 18h» seria anunciar um começo que a fonte não diz.
    const festa: EventCard = {
      ...EVENTO,
      is_ongoing: true,
      date_start: '2026-09-11',
      date_end: '2026-09-13',
    };
    expect(
      await hora(festa, [sessao({ session_date: '2026-09-11', start_time: '18:00:00' })]),
    ).toBeNull();
  });

  it('não dá a hora de uma sessão cancelada', async () => {
    // A ficha mostra-a riscada de propósito; o cartão que a anunciasse como a
    // hora do evento mandava para a porta fechada quem já tinha bilhete.
    const canceladas = [
      sessao({ start_time: '15:00:00', is_cancelled: true }),
      sessao({ start_time: '21:00:00' }),
    ];
    expect(await hora(EVENTO, canceladas)).toBe('21:00:00');
  });

  it('fica sem hora quando não há sessão nenhuma, e não escreve nada', async () => {
    // São 26% das sessões da região. Numa lista de quarenta cartões, a
    // ausência de um sinal não é um sinal — por isso o valor é `null` e não
    // um traço ou um «por confirmar» que o cartão tivesse de desenhar.
    expect(await hora(EVENTO, [])).toBeNull();
    expect((await withCardTimes([EVENTO], HOJE, leitura({})))[0]?.start_time).toBeNull();
  });

  it('fica sem hora quando a sessão não traz hora', async () => {
    expect(await hora(EVENTO, [sessao({ start_time: null })])).toBeNull();
  });

  it('fica sem hora quando o evento não tem data', async () => {
    const semData: EventCard = { ...EVENTO, date_start: null, date_end: null };
    expect(await hora(semData, [sessao()])).toBeNull();
  });

  it('pede as sessões dos eventos que a página desenha, à data da lista', async () => {
    const ler = vi.fn(() => Promise.resolve({}));
    await withCardTimes([EVENTO, { ...EVENTO, id: 'e2' }], HOJE, ler);
    expect(ler).toHaveBeenCalledWith(['e1', 'e2'], HOJE);
  });

  it('sem as sessões, a agenda serve na mesma e os cartões saem sem hora', async () => {
    // `listFeedSessions` propaga o erro de propósito, e a razão está escrita
    // lá: um `.ics` sem sessões suja calendários já subscritos. Numa listagem
    // esse risco não existe — responder 500 na página mais importante do sítio
    // por causa de um enfeite seria trocar a agenda inteira pela hora.
    const registo = vi.spyOn(console, 'error').mockImplementation(() => {});
    const lista = await withCardTimes([EVENTO], HOJE, () =>
      Promise.reject(new Error('a base caiu')),
    );
    expect(lista).toEqual([{ ...EVENTO, start_time: null }]);
    expect(registo).toHaveBeenCalled();
    registo.mockRestore();
  });

  it('não mexe no resto do evento nem na ordem da lista', async () => {
    const segundo: EventCard = { ...EVENTO, id: 'e2', date_start: '2026-09-08' };
    const lista = await withCardTimes([EVENTO, segundo], HOJE, leitura({ e1: [sessao()] }));
    expect(lista.map((evento) => evento.id)).toEqual(['e1', 'e2']);
    expect(lista[0]).toEqual({ ...EVENTO, start_time: '17:30:00' });
    expect(lista[1]).toEqual({ ...segundo, start_time: null });
  });
});
