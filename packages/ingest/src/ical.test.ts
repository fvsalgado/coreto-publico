import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MAX_EVENTS, parseIcal, unescapeIcalText } from './ical.js';

/**
 * O calendário é inventado, ao contrário do resto das fixtures, e é por isso
 * que serve: o que este leitor lê não é a exportação de um sítio em
 * particular — é a RFC 5545, que é a mesma em todos. Cada evento do ficheiro
 * exercita uma regra da norma que já se viu ler mal: linhas dobradas, texto
 * escapado, `DTEND` exclusivo, UTC, um alarme com descrição própria.
 */
const calendario = readFileSync(
  fileURLToPath(new URL('./__fixtures__/agenda-inventada.ics', import.meta.url)),
  'utf8',
);

function calendarioCom(...linhas: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    ...linhas,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function porUid(uid: string) {
  const evento = parseIcal(calendario).find((candidato) => candidato.uid === uid);
  expect(evento, `não há evento com o UID ${uid}`).toBeDefined();
  return evento!;
}

describe('parseIcal contra o calendário inventado', () => {
  it('lê os sete VEVENT, pela ordem do ficheiro, e mais nada', () => {
    // O VTIMEZONE também tem DTSTART e RRULE, e não é um evento.
    expect(parseIcal(calendario).map((evento) => evento.uid)).toEqual([
      'evt-0001@agenda-inventada.example',
      'evt-0002@agenda-inventada.example',
      'evt-0003@agenda-inventada.example',
      'evt-0004@agenda-inventada.example',
      'evt-0005@agenda-inventada.example',
      'evt-0006@agenda-inventada.example',
      'evt-0007@agenda-inventada.example',
    ]);
  });

  it('desdobra as linhas partidas e desfaz o que a norma escapa', () => {
    const concerto = porUid('evt-0001@agenda-inventada.example');
    expect(concerto.description).toBe(
      'A banda toca o repertório de verão, com convidados; entrada livre.\nTraga cadeira.',
    );
    expect(concerto.location).toBe('Cine-Teatro da Charamela, Rua do Coreto 1, Vila da Charamela');
  });

  it('a descrição do alarme não passa por descrição do evento', () => {
    const concerto = porUid('evt-0001@agenda-inventada.example');
    expect(concerto.description).not.toContain('Lembrete');
  });

  it('hora de parede com o fuso de Lisboa fica como está', () => {
    const concerto = porUid('evt-0001@agenda-inventada.example');
    expect(concerto.startDate).toBe('2026-09-12');
    expect(concerto.startTime).toBe('21:30');
    expect(concerto.endDate).toBeNull();
    expect(concerto.endTime).toBe('23:00');
    expect(concerto.allDay).toBe(false);
    expect(concerto.tzid).toBe('Europe/Lisbon');
  });

  it('um dia inteiro cujo DTEND é o dia seguinte é um dia só', () => {
    // A feira é no dia 19; o `DTEND:…20` é exclusivo. Lido à letra, punha a
    // feira também no domingo — que é o dia em que não há feira.
    const feira = porUid('evt-0002@agenda-inventada.example');
    expect(feira.allDay).toBe(true);
    expect(feira.startDate).toBe('2026-09-19');
    expect(feira.startTime).toBeNull();
    expect(feira.endDate).toBeNull();
  });

  it('um instante em UTC sai em hora de Lisboa, com a hora de verão', () => {
    // 20:00Z a 3 de outubro: Lisboa ainda está em +01:00.
    const cinema = porUid('evt-0003@agenda-inventada.example');
    expect(cinema.startDate).toBe('2026-10-03');
    expect(cinema.startTime).toBe('21:00');
    expect(cinema.endTime).toBe('23:00');
  });

  it('um cancelamento fica marcado em vez de desaparecer', () => {
    expect(porUid('evt-0004@agenda-inventada.example').isCancelled).toBe(true);
    expect(parseIcal(calendario).filter((evento) => !evento.isCancelled)).toHaveLength(6);
  });

  it('a regra de recorrência fica guardada e não expandida', () => {
    const oficina = porUid('evt-0005@agenda-inventada.example');
    expect(oficina.rrule).toBe('FREQ=WEEKLY;BYDAY=TU;UNTIL=20261215T235959Z');
    expect(oficina.startDate).toBe('2026-09-08');
    expect(oficina.endDate).toBeNull();
  });

  it('uma exposição de dia inteiro acaba no dia anterior ao DTEND', () => {
    const exposicao = porUid('evt-0007@agenda-inventada.example');
    expect(exposicao.startDate).toBe('2026-10-10');
    expect(exposicao.endDate).toBe('2026-11-08');
    expect(exposicao.allDay).toBe(true);
  });

  it('CATEGORIES separa pela vírgula que não está escapada', () => {
    expect(porUid('evt-0001@agenda-inventada.example').categories).toEqual([
      'Música',
      'Bandas filarmónicas',
    ]);
    expect(porUid('evt-0002@agenda-inventada.example').categories).toEqual([]);
  });

  it('a ligação sai tal e qual', () => {
    expect(porUid('evt-0001@agenda-inventada.example').url).toBe(
      'https://agenda-inventada.example/eventos/concerto-da-banda',
    );
    expect(porUid('evt-0003@agenda-inventada.example').url).toBeNull();
  });
});

describe('parseIcal e as datas que a norma deixa escrever de várias maneiras', () => {
  it('uma noite que atravessa a meia-noite é uma sessão só', () => {
    const [baile] = parseIcal(
      calendarioCom(
        'UID:baile',
        'DTSTART:20261031T220000',
        'DTEND:20261101T010000',
        'SUMMARY:Baile de Outono',
      ),
    );
    expect(baile?.startDate).toBe('2026-10-31');
    expect(baile?.endDate).toBeNull();
    expect(baile?.endTime).toBe('01:00');
  });

  it('um fim no dia seguinte, de manhã, é mesmo outro dia', () => {
    const [feira] = parseIcal(
      calendarioCom('UID:x', 'DTSTART:20261031T100000', 'DTEND:20261101T180000', 'SUMMARY:Feira'),
    );
    expect(feira?.endDate).toBe('2026-11-01');
    expect(feira?.endTime).toBe('18:00');
  });

  it('em dezembro o UTC é a hora de Lisboa', () => {
    const [evento] = parseIcal(calendarioCom('UID:x', 'DTSTART:20261212T180000Z', 'SUMMARY:S'));
    expect(evento?.startDate).toBe('2026-12-12');
    expect(evento?.startTime).toBe('18:00');
  });

  it('a meia-noite UTC de verão é o dia anterior em Lisboa — não, é o mesmo dia, uma hora depois', () => {
    // 23:30Z de 12 de setembro são 00:30 de 13 de setembro em Lisboa. O dia
    // muda, e é o dia de Lisboa que conta.
    const [evento] = parseIcal(calendarioCom('UID:x', 'DTSTART:20260912T233000Z', 'SUMMARY:S'));
    expect(evento?.startDate).toBe('2026-09-13');
    expect(evento?.startTime).toBe('00:30');
  });

  it('um TZID de outro fuso converte-se para Lisboa', () => {
    // 21:30 em Madrid (+02:00) são 20:30 em Lisboa (+01:00).
    const [evento] = parseIcal(
      calendarioCom('UID:x', 'DTSTART;TZID=Europe/Madrid:20260912T213000', 'SUMMARY:S'),
    );
    expect(evento?.startDate).toBe('2026-09-12');
    expect(evento?.startTime).toBe('20:30');
    expect(evento?.tzid).toBe('Europe/Madrid');
  });

  it('um TZID que o sistema não conhece lê-se como hora de parede', () => {
    // É o que o Outlook escreve. Deitar fora a hora era pior do que assumir
    // que uma fonte portuguesa escreve a hora de Lisboa.
    const [evento] = parseIcal(
      calendarioCom('UID:x', 'DTSTART;TZID=GMT Standard Time:20260912T213000', 'SUMMARY:S'),
    );
    expect(evento?.startTime).toBe('21:30');
  });

  it('um TZID entre aspas é o mesmo TZID', () => {
    const [evento] = parseIcal(
      calendarioCom('UID:x', 'DTSTART;TZID="Europe/Lisbon":20260912T213000', 'SUMMARY:S'),
    );
    expect(evento?.startTime).toBe('21:30');
    expect(evento?.tzid).toBe('Europe/Lisbon');
  });

  it('um parâmetro entre aspas pode ter ponto e vírgula e dois pontos', () => {
    const [evento] = parseIcal(
      calendarioCom('UID:x', 'DTSTART;X-NOTA="a;b:c":20260912T213000', 'SUMMARY:S'),
    );
    expect(evento?.startDate).toBe('2026-09-12');
    expect(evento?.startTime).toBe('21:30');
  });

  it('uma data que não existe não é uma data', () => {
    expect(
      parseIcal(calendarioCom('UID:x', 'DTSTART;VALUE=DATE:20261332', 'SUMMARY:S'))[0]?.startDate,
    ).toBeNull();
    expect(
      parseIcal(calendarioCom('UID:x', 'DTSTART:20260912T253000', 'SUMMARY:S'))[0]?.startDate,
    ).toBeNull();
    expect(
      parseIcal(calendarioCom('UID:x', 'DTSTART:brevemente', 'SUMMARY:S'))[0]?.startDate,
    ).toBeNull();
  });

  it('aguenta LF em vez de CRLF', () => {
    const [evento] = parseIcal(
      calendarioCom('UID:x', 'DTSTART:20260912T213000', 'SUMMARY:S').replace(/\r\n/g, '\n'),
    );
    expect(evento?.startTime).toBe('21:30');
  });
});

describe('parseIcal com o que não é um calendário', () => {
  it('um ficheiro vazio, ou que não é um calendário, dá uma lista vazia', () => {
    expect(parseIcal('')).toEqual([]);
    expect(parseIcal('<html><body>404 Not Found</body></html>')).toEqual([]);
    expect(parseIcal('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n')).toEqual([]);
  });

  it('um VEVENT sem fecho não engole o ficheiro', () => {
    expect(parseIcal('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Sem fim\r\n')).toEqual([]);
  });

  it('respeita o tecto de eventos', () => {
    const muitos = [
      'BEGIN:VCALENDAR',
      ...Array.from({ length: MAX_EVENTS + 5 }, (_, i) =>
        ['BEGIN:VEVENT', `UID:${i}`, 'DTSTART;VALUE=DATE:20260912', 'SUMMARY:S', 'END:VEVENT'].join(
          '\r\n',
        ),
      ),
      'END:VCALENDAR',
    ].join('\r\n');
    expect(parseIcal(muitos)).toHaveLength(MAX_EVENTS);
  });
});

describe('unescapeIcalText', () => {
  it('desfaz as quatro sequências da norma, e só essas', () => {
    expect(unescapeIcalText('um\\, dois\\; três\\Nquatro')).toBe('um, dois; três\nquatro');
    expect(unescapeIcalText('a\\\\b')).toBe('a\\b');
    expect(unescapeIcalText('caminho\\x')).toBe('caminho\\x');
  });
});
