/**
 * Registo de adaptadores.
 *
 * A coluna `sources.adapter` é uma cadeia escrita em SQL, e uma gralha aí não
 * pode passar despercebida: uma fonte com um adaptador desconhecido tem de
 * falhar alto, com o nome da fonte e a lista do que existe. O modo silencioso
 * — «não conheço, salto» — dava uma recolha verde com um concelho a menos.
 */

import type { Adapter } from '../adapter.js';
import { abrantesProxyAdapter } from './abrantes-proxy.js';
import { caminhosAdapter } from './caminhos.js';
import { eventsCalendarAdapter } from './events-calendar.js';
import { genericHtmlAdapter } from './generic-html.js';
import { icalAdapter } from './ical.js';
import { joomlaEventBookingAdapter } from './joomla-eventbooking.js';
import { municipalCmsAdapter } from './municipal-cms.js';
import { ouremApiAdapter } from './ourem-api.js';
import { paraisoAdapter } from './paraiso.js';
import { portalFreguesiaAdapter } from './portal-freguesia.js';
import { rssEventosAdapter } from './rss-eventos.js';
import { teatroVirginiaAdapter } from './teatro-virginia.js';
import { wordpressEventsAdapter } from './wordpress-events.js';

const REGISTRY = new Map<string, Adapter>(
  [
    abrantesProxyAdapter,
    caminhosAdapter,
    eventsCalendarAdapter,
    municipalCmsAdapter,
    genericHtmlAdapter,
    icalAdapter,
    joomlaEventBookingAdapter,
    ouremApiAdapter,
    paraisoAdapter,
    portalFreguesiaAdapter,
    rssEventosAdapter,
    teatroVirginiaAdapter,
    wordpressEventsAdapter,
  ].map((adapter) => [adapter.id, adapter]),
);

export function knownAdapterIds(): string[] {
  return [...REGISTRY.keys()].sort();
}

export function findAdapter(id: string): Adapter | null {
  return REGISTRY.get(id) ?? null;
}

export function getAdapter(id: string): Adapter {
  const adapter = findAdapter(id);
  if (!adapter) {
    throw new Error(`adaptador «${id}» desconhecido — existem: ${knownAdapterIds().join(', ')}`);
  }
  return adapter;
}

export {
  abrantesProxyAdapter,
  caminhosAdapter,
  eventsCalendarAdapter,
  genericHtmlAdapter,
  icalAdapter,
  joomlaEventBookingAdapter,
  municipalCmsAdapter,
  ouremApiAdapter,
  paraisoAdapter,
  portalFreguesiaAdapter,
  rssEventosAdapter,
  teatroVirginiaAdapter,
  wordpressEventsAdapter,
};
