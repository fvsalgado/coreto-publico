import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SourceRow } from '../adapter.js';
import { HttpClient } from '../http.js';
import { RunLogger } from '../run-logger.js';
import { icalAdapter, parseIcalEvents } from './ical.js';

/**
 * O calendário inventado de `../__fixtures__/agenda-inventada.ics`, lido
 * com «hoje» fixo a 1 de setembro de 2026 — o dia em que o arraial de agosto
 * já passou e tudo o resto está por vir. Os testes do adaptador em si usam
 * datas em 2099, porque esses correm com o «hoje» verdadeiro e não podem
 * envelhecer.
 */
const calendario = readFileSync(
  fileURLToPath(new URL('../__fixtures__/agenda-inventada.ics', import.meta.url)),
  'utf8',
);

const HOJE = '2026-09-01';

function calendarioCom(...eventos: string[][]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...eventos.map((linhas) => ['BEGIN:VEVENT', ...linhas, 'END:VEVENT'].join('\r\n')),
    'END:VCALENDAR',
  ].join('\r\n');
}

function fonte(config: Record<string, unknown> = {}): SourceRow {
  return {
    id: 'cine-teatro-ical',
    name: 'Cine-Teatro — calendário',
    kind: 'feed',
    municipality_id: 'vila-da-charamela',
    region_id: null,
    venue_id: null,
    url: 'https://cineteatro.example/agenda.ics',
    adapter: 'ical',
    config,
    is_enabled: true,
    baseline_item_count: null,
    min_expected_items: 0,
    consecutive_failures: 0,
    circuit_open_until: null,
  };
}

function stubHttp(corpo: string, status = 200): HttpClient {
  return new HttpClient({
    minHostIntervalMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: () => Promise.resolve(new Response(corpo, { status })),
  });
}

const registo = () => new RunLogger({ sourceId: 'cine-teatro-ical', output: () => undefined });

describe('parseIcalEvents contra o calendário inventado', () => {
  const lido = parseIcalEvents(calendario, { today: HOJE });

  it('devolve os cinco eventos por vir e diz o que deixou de fora', () => {
    expect(lido.events).toHaveLength(5);
    expect(lido.skipped).toEqual({ cancelled: 1, past: 1, incomplete: 0 });
    expect(lido.recurring).toBe(1);
  });

  it('ordena por data, para o tecto cortar pelo fim e não ao acaso', () => {
    expect(lido.events.map((evento) => evento.dates[0]?.date)).toEqual([
      '2026-09-08',
      '2026-09-12',
      '2026-09-19',
      '2026-10-03',
      '2026-10-10',
    ]);
  });

  it('o UID é a chave e a ligação é o endereço', () => {
    const concerto = lido.events.find((evento) => evento.title.startsWith('Concerto'));
    expect(concerto?.sourceKey).toBe('evt-0001@agenda-inventada.example');
    expect(concerto?.sourceUrl).toBe('https://agenda-inventada.example/eventos/concerto-da-banda');
  });

  it('o LOCATION é o candidato a espaço quando a fonte não declara um', () => {
    const concerto = lido.events.find((evento) => evento.title.startsWith('Concerto'));
    expect(concerto?.venueName).toBe(
      'Cine-Teatro da Charamela, Rua do Coreto 1, Vila da Charamela',
    );
    expect(concerto?.locationName).toBeNull();
  });

  it('com venueName configurado, o LOCATION fica como local', () => {
    const [primeiro] = parseIcalEvents(calendario, {
      today: HOJE,
      venueName: 'Cine-Teatro da Charamela',
    }).events;
    expect(primeiro?.venueName).toBe('Cine-Teatro da Charamela');
    expect(primeiro?.locationName).toBe('Cine-Teatro da Charamela');
  });

  it('uma sessão com hora leva a hora e o fim', () => {
    const concerto = lido.events.find((evento) => evento.title.startsWith('Concerto'));
    expect(concerto?.dates).toEqual([{ date: '2026-09-12', startTime: '21:30', endTime: '23:00' }]);
    expect(concerto?.isOngoing).toBe(false);
  });

  it('uma exposição de dia inteiro são dois extremos, marcados como em cartaz', () => {
    const exposicao = lido.events.find((evento) => evento.title.startsWith('Exposição'));
    expect(exposicao?.dates.map((sessao) => sessao.date)).toEqual(['2026-10-10', '2026-11-08']);
    expect(exposicao?.dates[0]?.startTime).toBeNull();
    expect(exposicao?.isOngoing).toBe(true);
  });

  it('uma recorrência dá só a primeira ocorrência e guarda a regra', () => {
    const oficina = lido.events.find((evento) => evento.title.startsWith('Oficina de teatro'));
    expect(oficina?.dates).toHaveLength(1);
    expect(oficina?.dates[0]?.date).toBe('2026-09-08');
    expect(oficina?.payload?.['rrule']).toBe('FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T235959Z');
  });

  it('as categorias e a descrição vão como a fonte as escreve', () => {
    const concerto = lido.events.find((evento) => evento.title.startsWith('Concerto'));
    expect(concerto?.categoriesRaw).toEqual(['Música', 'Bandas filarmónicas']);
    expect(concerto?.description).toContain('entrada livre.\nTraga cadeira.');
  });

  it('o cancelado não vem', () => {
    expect(lido.events.some((evento) => evento.title.includes('cerâmica'))).toBe(false);
  });
});

describe('parseIcalEvents e o que fica de fora', () => {
  it('ontem ainda conta; anteontem já não; o que ainda está patente conta sempre', () => {
    const lido = parseIcalEvents(
      calendarioCom(
        ['UID:ontem', 'DTSTART;VALUE=DATE:20260831', 'SUMMARY:Ontem'],
        ['UID:anteontem', 'DTSTART;VALUE=DATE:20260830', 'SUMMARY:Anteontem'],
        [
          'UID:patente',
          'DTSTART;VALUE=DATE:20260701',
          'DTEND;VALUE=DATE:20261001',
          'SUMMARY:Exposição',
        ],
      ),
      { today: HOJE },
    );
    expect(lido.events.map((evento) => evento.sourceKey)).toEqual(['patente', 'ontem']);
    expect(lido.skipped.past).toBe(1);
  });

  it('sem título ou sem data não é um evento', () => {
    const lido = parseIcalEvents(
      calendarioCom(
        ['UID:sem-titulo', 'DTSTART;VALUE=DATE:20260912'],
        ['UID:sem-data', 'SUMMARY:Sem data'],
        ['UID:titulo-vazio', 'DTSTART;VALUE=DATE:20260912', 'SUMMARY: '],
      ),
      { today: HOJE },
    );
    expect(lido.events).toEqual([]);
    expect(lido.skipped.incomplete).toBe(3);
  });

  it('sem UID, a chave é a ligação; sem ligação, o dia e o título', () => {
    const lido = parseIcalEvents(
      calendarioCom(
        ['DTSTART;VALUE=DATE:20260912', 'SUMMARY:Com ligação', 'URL:https://x.example/eventos/1'],
        ['DTSTART;VALUE=DATE:20260913', 'SUMMARY:Sem ligação'],
      ),
      { today: HOJE },
    );
    expect(lido.events.map((evento) => evento.sourceKey)).toEqual([
      'eventos/1',
      '2026-09-13-Sem ligação',
    ]);
  });

  it('uma ocorrência alterada à mão não colapsa com a série', () => {
    const lido = parseIcalEvents(
      calendarioCom(
        ['UID:serie', 'DTSTART;VALUE=DATE:20260908', 'RRULE:FREQ=WEEKLY', 'SUMMARY:Oficina'],
        [
          'UID:serie',
          'RECURRENCE-ID;VALUE=DATE:20260915',
          'DTSTART;VALUE=DATE:20260916',
          'SUMMARY:Oficina (adiada)',
        ],
      ),
      { today: HOJE },
    );
    expect(lido.events.map((evento) => evento.sourceKey)).toEqual(['serie', 'serie@20260915']);
  });

  it('não repete a mesma UID', () => {
    const lido = parseIcalEvents(
      calendarioCom(
        ['UID:a', 'DTSTART;VALUE=DATE:20260912', 'SUMMARY:A'],
        ['UID:a', 'DTSTART;VALUE=DATE:20260912', 'SUMMARY:A'],
      ),
      { today: HOJE },
    );
    expect(lido.events).toHaveLength(1);
  });

  it('respeita o tecto de itens, e corta pelo fim', () => {
    const lido = parseIcalEvents(calendario, { today: HOJE, maxItems: 2 });
    expect(lido.events.map((evento) => evento.dates[0]?.date)).toEqual([
      '2026-09-08',
      '2026-09-12',
    ]);
  });

  it('um calendário vazio dá zero, sem rebentar', () => {
    expect(parseIcalEvents('', { today: HOJE }).events).toEqual([]);
    expect(parseIcalEvents('BEGIN:VCALENDAR\r\nEND:VCALENDAR', { today: HOJE }).events).toEqual([]);
  });
});

describe('icalAdapter', () => {
  const futuro = calendarioCom(
    ['UID:um', 'DTSTART;TZID=Europe/Lisbon:20990110T213000', 'SUMMARY:Concerto', 'LOCATION:Sala 2'],
    ['UID:dois', 'DTSTART;VALUE=DATE:20990117', 'SUMMARY:Feira'],
    ['UID:tres', 'DTSTART;VALUE=DATE:20990124', 'SUMMARY:Cancelado', 'STATUS:CANCELLED'],
  );

  it('lê o calendário da fonte e avisa do que a fonte cancelou', async () => {
    const log = registo();
    const eventos = await icalAdapter.fetchEvents({ source: fonte(), http: stubHttp(futuro), log });

    expect(eventos.map((evento) => evento.sourceKey)).toEqual(['um', 'dois']);
    expect(log.warnings.map((aviso) => aviso.message)).toContain(
      '1 eventos cancelados pela fonte, não importados',
    );
  });

  it('passa o venueName da configuração, e o LOCATION fica como local', async () => {
    const eventos = await icalAdapter.fetchEvents({
      source: fonte({ venueName: 'Cine-Teatro da Charamela' }),
      http: stubHttp(futuro),
      log: registo(),
    });
    expect(eventos[0]?.venueName).toBe('Cine-Teatro da Charamela');
    expect(eventos[0]?.locationName).toBe('Sala 2');
  });

  it('avisa das chaves de configuração que ninguém lê', async () => {
    const log = registo();
    await icalAdapter.fetchEvents({ source: fonte({ cor: 'azul' }), http: stubHttp(futuro), log });
    expect(log.warnings[0]?.message).toBe('config com chaves que ninguém lê');
    expect(log.warnings[0]?.detail).toBe('cor');
  });

  it('rebenta quando a resposta não é um calendário', async () => {
    await expect(
      icalAdapter.fetchEvents({
        source: fonte(),
        http: stubHttp('<html><body>A agenda mudou de sítio</body></html>'),
        log: registo(),
      }),
    ).rejects.toThrow(/não é um iCalendar/);
  });

  it('rebenta quando o calendário não responde', async () => {
    await expect(
      icalAdapter.fetchEvents({ source: fonte(), http: stubHttp('', 500), log: registo() }),
    ).rejects.toThrow(/não respondeu/);
  });

  it('um calendário sem nada por vir dá zero, com aviso', async () => {
    const log = registo();
    const eventos = await icalAdapter.fetchEvents({
      source: fonte(),
      http: stubHttp(calendarioCom(['UID:velho', 'DTSTART;VALUE=DATE:20190101', 'SUMMARY:Velho'])),
      log,
    });
    expect(eventos).toEqual([]);
    expect(log.warnings.map((aviso) => aviso.message)).toContain(
      'nenhum evento por vir no calendário de Cine-Teatro — calendário',
    );
  });
});
