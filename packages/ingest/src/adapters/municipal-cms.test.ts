import { describe, expect, it } from 'vitest';

import { HttpClient } from '../http';
import { RunLogger } from '../run-logger';
import { jsonLdToRawEvent, municipalCmsAdapter, sessionsForRange } from './municipal-cms';
import { readJsonLdEvents } from '../html';

/**
 * O adaptador que expandia um intervalo dia a dia.
 *
 * Nenhuma das fontes ligadas o usa hoje — as câmaras que aqui estavam passaram
 * para adaptadores próprios —, e é justamente por isso que este ficheiro
 * existe: um adaptador que ninguém corre é um adaptador onde um defeito fica à
 * espera. Este ficava. `sessionsForRange` abria `expandRecurrence(…, 'daily')`
 * sobre o intervalo declarado, com um tecto de 92 dias, e uma exposição de três
 * meses saía daqui com **93 sessões** — 93 factos que a câmara nunca afirmou,
 * 93 linhas na ficha e 93 entradas na agenda de quem subscrevesse o calendário
 * do concelho. Bastava alguém apontar uma fonte a este adaptador.
 *
 * O HTML é escrito aqui e não capturado de um site, ao contrário do resto das
 * fixtures, e a razão é a mesma que faz este adaptador começar pelo JSON-LD:
 * o que ele lê não é a marcação de um tema municipal — é `schema.org/Event`,
 * um contrato publicado, igual em todos os sítios que o servem. É o contrato
 * que está em prova, não a página.
 */
const registo = () => new RunLogger({ sourceId: 'teste', output: () => undefined });

const PAGINA = 'https://www.cm-exemplo.pt/agenda';

function comJsonLd(node: Record<string, unknown>): string {
  return `<html><body><script type="application/ld+json">${JSON.stringify(node)}</script></body></html>`;
}

function lerPrimeiro(node: Record<string, unknown>) {
  const [evento] = readJsonLdEvents(comJsonLd(node));
  expect(evento, 'o JSON-LD do teste não foi reconhecido como Event').toBeDefined();
  return jsonLdToRawEvent(evento!, PAGINA);
}

describe('sessionsForRange', () => {
  it('uma exposição de três meses são dois dias, não noventa e três', () => {
    const datas = sessionsForRange('2027-06-01', null, '2027-08-31', null);

    expect(datas.sessions.map((sessao) => sessao.date)).toEqual(['2027-06-01', '2027-08-31']);
    expect(datas.isOngoing).toBe(true);
  });

  it('um dia só é um dia só', () => {
    const datas = sessionsForRange('2027-06-01', '21:30', null, null);

    expect(datas.sessions).toEqual([{ date: '2027-06-01', startTime: '21:30', endTime: null }]);
    expect(datas.isOngoing).toBe(false);
  });

  it('um fim igual ao início não abre um intervalo', () => {
    const datas = sessionsForRange('2027-06-01', null, '2027-06-01', null);

    expect(datas.sessions).toHaveLength(1);
    expect(datas.isOngoing).toBe(false);
  });

  it('trata um fim anterior ao início como engano, não como intervalo', () => {
    const datas = sessionsForRange('2027-06-10', null, '2027-06-01', null);

    expect(datas.sessions.map((sessao) => sessao.date)).toEqual(['2027-06-10']);
    expect(datas.isOngoing).toBe(false);
  });

  it('sem data de início não há sessão nenhuma para gravar', () => {
    expect(sessionsForRange(null, null, '2027-06-30', null)).toEqual({
      sessions: [],
      isOngoing: false,
    });
  });

  it('um fim de semana são os dois dias, e são os dois que a fonte disse', () => {
    // Dois extremos que estão colados: a lista não tem buraco nenhum, mas
    // continua a ser um período — foi isso que a fonte declarou.
    const datas = sessionsForRange('2027-06-05', null, '2027-06-06', null);

    expect(datas.sessions.map((sessao) => sessao.date)).toEqual(['2027-06-05', '2027-06-06']);
    expect(datas.isOngoing).toBe(true);
  });
});

describe('jsonLdToRawEvent', () => {
  it('uma exposição declarada em JSON-LD chega marcada como em cartaz', () => {
    const evento = lerPrimeiro({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Exposição de gravura',
      startDate: '2027-06-03',
      endDate: '2027-09-27',
      url: 'https://www.cm-exemplo.pt/agenda/exposicao-de-gravura',
      location: { '@type': 'Place', name: 'Galeria Municipal' },
    });

    expect(evento?.dates.map((sessao) => sessao.date)).toEqual(['2027-06-03', '2027-09-27']);
    expect(evento?.isOngoing).toBe(true);
  });

  it('um espetáculo com dia e hora não é um período', () => {
    const evento = lerPrimeiro({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Concerto de Ano Novo',
      startDate: '2027-01-01T21:30',
      url: 'https://www.cm-exemplo.pt/agenda/concerto-de-ano-novo',
    });

    expect(evento?.dates).toEqual([{ date: '2027-01-01', startTime: '21:30', endTime: null }]);
    expect(evento?.isOngoing).toBe(false);
  });
});

describe('municipalCmsAdapter', () => {
  it('lê a listagem inteira sem abrir os dias de um intervalo', async () => {
    const html = comJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Época balnear',
      startDate: '2027-06-13',
      endDate: '2027-09-13',
      url: 'https://www.cm-exemplo.pt/agenda/epoca-balnear',
    });

    const eventos = await municipalCmsAdapter.fetchEvents({
      source: {
        id: 'cm-exemplo',
        name: 'Câmara de Exemplo',
        kind: 'municipal_site',
        municipality_id: 'exemplo',
        region_id: null,
        venue_id: null,
        url: PAGINA,
        adapter: 'municipal-cms',
        config: {},
        is_enabled: true,
        baseline_item_count: null,
        min_expected_items: 0,
        consecutive_failures: 0,
        circuit_open_until: null,
      },
      http: new HttpClient({
        minHostIntervalMs: 0,
        sleep: () => Promise.resolve(),
        fetchImpl: () => Promise.resolve(new Response(html, { status: 200 })),
      }),
      log: registo(),
    });

    expect(eventos).toHaveLength(1);
    // Noventa e três dias de época balnear, duas linhas na base de dados.
    expect(eventos[0]?.dates).toHaveLength(2);
    expect(eventos[0]?.isOngoing).toBe(true);
  });
});
