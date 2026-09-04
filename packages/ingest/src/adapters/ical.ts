/**
 * Qualquer calendário público em iCalendar.
 *
 * É o primeiro leitor a experimentar numa fonte nova: se a casa tem um botão
 * «subscrever o calendário», um Google Calendar público ou um `.ics` no
 * sítio, entra por aqui com uma linha em `sources` e sem código. Não é de
 * região nenhuma nem de CMS nenhum — é do formato.
 *
 * O que sai é o que o calendário afirma, e nada mais: título, descrição,
 * sítio, ligação, categorias, e as datas convertidas para Lisboa pelo leitor
 * de `../ical.ts`. Um calendário exportado traz a história inteira; o que já
 * acabou fica de fora aqui, e não na moderação, porque um evento de 2019
 * não é uma dúvida a resolver — é arquivo.
 *
 * Uma `RRULE` dá **uma** ocorrência, a primeira, com a regra guardada em
 * `payload`. É o preço de não fabricar: a fonte escreveu uma regra, não
 * catorze datas, e o dia em que a série for cancelada a meio ninguém nos
 * avisa. Quem precisar das outras datas tem a regra à mão para decidir.
 */

import { addDays, todayInLisbon, type RawEvent } from '@coreto/core';
import { parseAdapterConfig, type Adapter, type AdapterContext } from '../adapter.js';
import { sourceKeyFromUrl } from '../html.js';
import { parseIcal, type IcalEvent } from '../ical.js';
import { sessionsForRange } from './municipal-cms.js';

/** Tecto de eventos devolvidos. Um calendário com mais do que isto por vir é arquivo. */
const MAX_ITEMS = 200;

export interface IcalReadOptions {
  /** O espaço a assumir quando o calendário é de uma casa só. */
  venueName?: string;
  maxItems?: number;
  /** Dia de referência para deixar cair o passado. Por omissão, hoje em Lisboa. */
  today?: string;
}

export interface IcalReadResult {
  events: RawEvent[];
  skipped: {
    cancelled: number;
    /** Acabaram antes de anteontem. */
    past: number;
    /** Sem título ou sem data — uma linha de calendário, não um evento. */
    incomplete: number;
  };
  /** Quantos dos devolvidos trazem `RRULE`: de cada um ficou só a primeira ocorrência. */
  recurring: number;
}

export function icalToRawEvent(event: IcalEvent, options: IcalReadOptions = {}): RawEvent | null {
  const title = (event.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!title || !event.startDate) return null;

  const datas = sessionsForRange(event.startDate, event.startTime, event.endDate, event.endTime);

  // Uma ocorrência alterada à mão partilha o `UID` da série; sem o
  // `RECURRENCE-ID` na chave, a série e a exceção colapsavam num evento só.
  const uid = event.uid
    ? event.recurrenceId
      ? `${event.uid}@${event.recurrenceId}`
      : event.uid
    : null;
  const sourceKey = (uid ?? sourceKeyFromUrl(event.url) ?? `${event.startDate}-${title}`).slice(
    0,
    300,
  );

  // O `LOCATION` é o que a fonte escreveu sobre o sítio, e vai sempre para
  // algum lado. Sem `venueName` configurado é ele o candidato a espaço, e o
  // harmonizador guarda-o como texto do local quando não casa com o catálogo.
  // Com `venueName` configurado — o calendário é de uma casa só — o
  // `LOCATION` é o detalhe («Sala 2», a morada) e fica como local.
  const venueName = options.venueName ?? event.location;
  const locationName = options.venueName ? event.location : null;

  return {
    sourceKey,
    sourceUrl: event.url,
    title,
    description: event.description ? event.description.slice(0, 20_000) : null,
    dates: datas.sessions,
    isOngoing: datas.isOngoing,
    venueName: venueName ? venueName.slice(0, 200) : null,
    locationName: locationName ? locationName.slice(0, 200) : null,
    categoriesRaw: event.categories,
    payload: {
      extractedBy: 'ical',
      uid: event.uid,
      recurrenceId: event.recurrenceId,
      location: event.location,
      tzid: event.tzid,
      allDay: event.allDay,
      // A regra, por expandir. Ver o cabeçalho.
      rrule: event.rrule,
    },
  };
}

/**
 * Os eventos por vir de um calendário, por ordem de data.
 *
 * A ordem importa por causa do tecto: um ficheiro exportado não vem por data,
 * e cortar pela ordem do ficheiro deixava de fora o concerto de sábado para
 * ficar com um de daqui a dois anos.
 */
export function parseIcalEvents(text: string, options: IcalReadOptions = {}): IcalReadResult {
  const today = options.today ?? todayInLisbon();
  // Ontem ainda conta: uma recolha de madrugada apanha o que acabou à noite,
  // e o pipeline é que sabe o que fazer com isso.
  const limiar = addDays(today, -1);
  const limite = Math.min(options.maxItems ?? MAX_ITEMS, MAX_ITEMS);

  const skipped = { cancelled: 0, past: 0, incomplete: 0 };
  const vistos = new Set<string>();
  const eventos: RawEvent[] = [];

  for (const event of parseIcal(text)) {
    if (event.isCancelled) {
      skipped.cancelled += 1;
      continue;
    }
    const raw = icalToRawEvent(event, options);
    if (!raw) {
      skipped.incomplete += 1;
      continue;
    }
    if ((event.endDate ?? event.startDate ?? '') < limiar) {
      skipped.past += 1;
      continue;
    }
    if (vistos.has(raw.sourceKey)) continue;
    vistos.add(raw.sourceKey);
    eventos.push(raw);
  }

  eventos.sort(
    (a, b) =>
      (a.dates[0]?.date ?? '').localeCompare(b.dates[0]?.date ?? '') ||
      (a.dates[0]?.startTime ?? '').localeCompare(b.dates[0]?.startTime ?? ''),
  );

  const events = eventos.slice(0, limite);
  return {
    events,
    skipped,
    recurring: events.filter((event) => Boolean(event.payload?.['rrule'])).length,
  };
}

export const icalAdapter: Adapter = {
  id: 'ical',

  async fetchEvents({ source, http, log }: AdapterContext): Promise<RawEvent[]> {
    const { config, unknownKeys } = parseAdapterConfig(source.config);
    if (unknownKeys.length > 0) {
      log.warn('config com chaves que ninguém lê', unknownKeys.join(', '));
    }

    const resposta = await http.get(source.url);
    if (!resposta.ok) {
      throw new Error(`o calendário não respondeu: ${resposta.error ?? resposta.status}`);
    }
    // Um endereço que passou a servir HTML — o sítio mudou, o calendário foi
    // desligado — não é um calendário vazio, e não pode passar por um.
    if (!/BEGIN:VCALENDAR/i.test(resposta.body)) {
      throw new Error('a resposta não é um iCalendar: o endereço mudou ou serve outra coisa');
    }

    const lido = parseIcalEvents(resposta.body, {
      venueName: config.venueName,
      maxItems: config.maxItems,
    });

    if (lido.skipped.cancelled > 0) {
      log.warn(`${lido.skipped.cancelled} eventos cancelados pela fonte, não importados`);
    }
    if (lido.skipped.incomplete > 0) {
      log.warn(`${lido.skipped.incomplete} entradas sem título ou sem data`);
    }
    if (lido.recurring > 0) {
      log.info(
        `${lido.recurring} eventos com regra de recorrência — fica só a primeira ocorrência de cada`,
      );
    }

    if (lido.events.length === 0) {
      log.warn(`nenhum evento por vir no calendário de ${source.name}`);
    } else {
      log.info(
        `${lido.events.length} eventos por vir no calendário de ${source.name}`,
        lido.skipped.past > 0 ? `${lido.skipped.past} já passados ficaram de fora` : undefined,
      );
    }

    return lido.events;
  },
};
