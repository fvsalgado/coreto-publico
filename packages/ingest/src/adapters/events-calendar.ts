/**
 * Qualquer página que embuta `schema.org/Event` em JSON-LD.
 *
 * É um contrato publicado pelo próprio sítio, e não a leitura de um tema:
 * um `<script type="application/ld+json">` com `@type: Event` — ou um dos
 * seus filhos, `TheaterEvent`, `MusicEvent`, `ScreeningEvent` —, com datas
 * em ISO, sítio identificado, cartaz e preço. A maioria dos plugins de
 * eventos do WordPress escreve-o, e muitos CMS também, sem que ninguém na
 * casa saiba. Quando existe, é de longe a melhor porta: sobrevive a mudanças
 * de tema e nunca precisou de um seletor.
 *
 * O `municipal-cms` já lia JSON-LD, mas como primeira de três camadas de um
 * adaptador pensado para os sítios municipais, com microdados e seletores a
 * seguir. Este lê **só** o JSON-LD, e diz que não encontrou nada quando não
 * encontra — em vez de cair para uma leitura da aparência que ninguém pediu.
 * A conversão de cada `Event` é a mesma, exportada de lá, para as duas
 * portas dizerem sempre a mesma coisa do mesmo evento.
 *
 * Com `followLinks`, abre a página de cada evento a que falte descrição,
 * data ou cartaz, e completa-o pelo JSON-LD dessa página — o mesmo ciclo do
 * `municipal-cms`, com o mesmo tecto de pedidos.
 */

import type { RawEvent } from '@coreto/core';
import { parseAdapterConfig, type Adapter, type AdapterContext } from '../adapter.js';
import { readJsonLdEvents } from '../html.js';
import { seguirDetalhes } from './detalhe.js';
import { listUrls } from './generic-html.js';
import { jsonLdToRawEvent, mergeDetail, needsDetail } from './municipal-cms.js';

/** Páginas de detalhe visitadas por execução, quando `followLinks` está ligado. */
const DEFAULT_MAX_DETAIL_PAGES = 40;
/** Tecto de eventos devolvidos por execução. */
const MAX_ITEMS = 200;

export interface EventsCalendarReadOptions {
  /** O espaço a assumir quando o evento não declara `location` e a fonte é de uma casa só. */
  venueName?: string;
}

export interface EventsCalendarPage {
  events: RawEvent[];
  /** Os nomes do que a fonte declarou cancelado ou adiado — não se importa, mas avisa-se. */
  cancelled: string[];
}

/** Todos os `Event` em JSON-LD de uma página, sem repetições e sem os cancelados. */
export function parseEventsCalendar(
  html: string,
  pageUrl: string,
  options: EventsCalendarReadOptions = {},
): EventsCalendarPage {
  const events: RawEvent[] = [];
  const cancelled: string[] = [];
  const vistos = new Set<string>();

  for (const event of readJsonLdEvents(html)) {
    if (event.isCancelled) {
      // Não se importa um cancelamento como se fosse programação. Fica o
      // nome para o aviso, para que alguém veja o que deixou de acontecer.
      cancelled.push(event.name);
      continue;
    }
    const raw = jsonLdToRawEvent(event, pageUrl);
    if (!raw) continue;
    // Há temas que escrevem o mesmo evento duas vezes — na lista e no
    // cartão — e o segundo não acrescenta nada ao primeiro.
    if (vistos.has(raw.sourceKey)) continue;
    vistos.add(raw.sourceKey);
    events.push({ ...raw, venueName: raw.venueName ?? options.venueName ?? null });
  }

  return { events, cancelled };
}

export const eventsCalendarAdapter: Adapter = {
  id: 'events-calendar',

  async fetchEvents(context: AdapterContext): Promise<RawEvent[]> {
    const { config, unknownKeys } = parseAdapterConfig(context.source.config);
    if (unknownKeys.length > 0) {
      context.log.warn('config com chaves que ninguém lê', unknownKeys.join(', '));
    }

    const limite = Math.min(config.maxItems ?? MAX_ITEMS, MAX_ITEMS);
    const recolhidos = new Map<string, RawEvent>();
    let respondidas = 0;

    for (const url of listUrls(context, config)) {
      const resposta = await context.http.get(url);
      if (!resposta.ok) {
        context.log.warn(`listagem sem resposta utilizável: ${url}`, resposta.error ?? undefined);
        continue;
      }
      respondidas += 1;

      const pagina = parseEventsCalendar(resposta.body, resposta.url, {
        venueName: config.venueName,
      });
      for (const nome of pagina.cancelled) {
        context.log.warn('evento marcado como cancelado ou adiado pela fonte', nome);
      }
      // Uma página sem JSON-LD nenhum é notícia: ou o sítio deixou de o
      // escrever, ou o endereço já não é o da agenda. Nos dois casos alguém
      // tem de olhar, e o aviso é o que o faz olhar.
      if (pagina.events.length === 0) {
        context.log.warn('nenhum evento em JSON-LD nesta página', resposta.url);
      } else {
        context.log.info(`${pagina.events.length} eventos lidos por JSON-LD`, resposta.url);
      }

      for (const event of pagina.events) {
        if (!recolhidos.has(event.sourceKey)) recolhidos.set(event.sourceKey, event);
      }
    }

    if (respondidas === 0) throw new Error('nenhuma página de listagem respondeu');

    const events = [...recolhidos.values()].slice(0, limite);
    if (!config.followLinks) return events;

    return seguirDetalhes({
      events,
      context,
      cap: config.maxDetailPages ?? DEFAULT_MAX_DETAIL_PAGES,
      precisa: needsDetail,
      completar: mergeDetail,
    });
  },
};
