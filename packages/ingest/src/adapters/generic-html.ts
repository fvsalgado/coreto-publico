/**
 * Adaptador guiado por seletores.
 *
 * Existe para as fontes que fogem ao molde do CMS partilhado — a agenda de
 * Ourém, que vive num subdomínio de serviços, e o Cine-Teatro Paraíso. Tudo
 * o que sabe vem da coluna `config`: um site que
 * muda de tema resolve-se com um `update` em SQL, sem deploy e sem esperar
 * pela janela de recolha seguinte.
 *
 * A extração por seletores está aqui, e não em cada adaptador, porque é
 * também o último recurso do adaptador municipal.
 */

import {
  parseEventDates,
  parsePortugueseTime,
  slugify,
  type RawEvent,
  type RawSession,
} from '@coreto/core';
import {
  absoluteUrl,
  attributeFrom,
  selectAll,
  selectFirstMatching,
  sourceKeyFromUrl,
  stripTags,
  textFrom,
} from '../html.js';
import {
  parseAdapterConfig,
  type Adapter,
  type AdapterConfig,
  type AdapterContext,
  type SourceDates,
} from '../adapter.js';
import type { RunLogger } from '../run-logger.js';
import { seguirDetalhes } from './detalhe.js';

/** Seletores por omissão de um adaptador. Cada lista é tentada por ordem. */
export interface SelectorDefaults {
  list: readonly string[];
  title: readonly string[];
  date: readonly string[];
  time: readonly string[];
  link: readonly string[];
  image: readonly string[];
  description: readonly string[];
  category: readonly string[];
  venue: readonly string[];
  price: readonly string[];
}

const EMPTY_DEFAULTS: SelectorDefaults = {
  list: [],
  title: [],
  date: [],
  time: [],
  link: [],
  image: [],
  description: [],
  category: [],
  venue: [],
  price: [],
};

/** Tecto de itens lidos de uma listagem, quando a configuração não o define. */
const DEFAULT_MAX_ITEMS = 200;

/**
 * Atributos de onde uma imagem pode vir.
 *
 * Um tema com carregamento diferido deixa o `src` com um GIF transparente de
 * um pixel e põe a imagem verdadeira em `data-src`. Ler só o `src` dava uma
 * agenda inteira de cartões com o mesmo pixel cinzento.
 */
const IMAGE_ATTRIBUTES = ['src', 'data-src', 'data-lazy-src', 'data-original'] as const;

function clamp(text: string | null, max: number): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
}

function selectors(configured: string[] | undefined, fallback: readonly string[]): string[] {
  return configured && configured.length > 0 ? configured : [...fallback];
}

/** Texto de um elemento, preferindo um atributo quando ele existe. */
function valueFrom(html: string, list: readonly string[], attribute?: string): string | null {
  if (attribute) {
    const fromAttribute = attributeFrom(html, list, attribute);
    if (fromAttribute) return fromAttribute.trim();
  }
  return textFrom(html, list);
}

function imageFrom(html: string, list: readonly string[], pageUrl: string): string | null {
  for (const selector of list) {
    for (const element of selectAll(html, selector, 6)) {
      for (const attribute of IMAGE_ATTRIBUTES) {
        const value = element.attributes[attribute];
        const resolved = value ? absoluteUrl(pageUrl, value) : null;
        // Um pixel de carregamento diferido não é a imagem do evento.
        if (resolved && !/^data:/i.test(value ?? '')) return resolved;
      }
      const srcset = element.attributes['srcset'];
      const first = srcset?.split(',')[0]?.trim().split(/\s+/)[0];
      const resolved = first ? absoluteUrl(pageUrl, first) : null;
      if (resolved) return resolved;
    }
  }
  return null;
}

/** Todas as etiquetas que casarem, sem repetições. */
function categoriesFrom(html: string, list: readonly string[]): string[] {
  const out: string[] = [];
  for (const selector of list) {
    for (const element of selectAll(html, selector, 20)) {
      const text = clamp(stripTags(element.inner), 120);
      if (text && !out.includes(text)) out.push(text);
    }
    if (out.length > 0) break;
  }
  return out.slice(0, 20);
}

/**
 * As ocorrências que um pedaço de texto anuncia.
 *
 * Chama `parseEventDates` e não `parsePortugueseDates` por causa de uma coisa
 * só, que a segunda deita fora: o `isRange`. As duas leem «10 a 12 de junho»
 * como duas datas — 10 e 12, os extremos, que é a leitura certa — mas só a
 * primeira diz que aquilo é um intervalo. Sem essa distinção a ficha ficava a
 * afirmar «2 sessões» e a listar o 10 e o 12, o que é dizer a quem lê que **no
 * dia 11 não há nada** — enquanto o cartão ao lado dizia «10–12 jun», porque
 * `date_start` e `date_end` saem dos mesmos extremos e ficam certos. A mesma
 * página a contradizer-se.
 *
 * O intervalo só se dá por assente quando a leitura deu **exactamente** os
 * dois extremos. «Exposição de 10 a 12 de junho. Visita guiada a 20.» também
 * traz `isRange`, mas as datas são três e o período entre a primeira e a
 * última não está todo preenchido: marcá-lo como contínuo prometia os dias 13
 * a 19, que ninguém anunciou. Nesse caso ficam as datas como sessões, que é o
 * que já acontecia — na dúvida não se acrescenta afirmação nenhuma.
 */
export function sessionsFromText(dateText: string | null, timeText: string | null): SourceDates {
  const { dates, isRange } = parseEventDates(dateText);
  if (dates.length === 0) return { sessions: [], isOngoing: false };

  const startTime = parsePortugueseTime(timeText) ?? parsePortugueseTime(dateText);
  return {
    sessions: dates.map((date) => ({ date, startTime })),
    isOngoing: isRange && dates.length === 2,
  };
}

export interface ExtractOptions {
  html: string;
  /** Endereço da página lida, para resolver ligações relativas. */
  pageUrl: string;
  config: AdapterConfig;
  defaults?: SelectorDefaults;
  log: RunLogger;
}

/**
 * Lê uma listagem inteiramente a partir de seletores.
 *
 * Um item sem título ou sem ligação é deixado de fora com um aviso: quase
 * sempre é o bloco de paginação ou um cartão promocional que casou com o
 * seletor da lista, e inventar-lhe um título só sujava o catálogo.
 */
export function extractBySelectors(options: ExtractOptions): RawEvent[] {
  const { html, pageUrl, config, log } = options;
  const defaults = options.defaults ?? EMPTY_DEFAULTS;
  const maxItems = config.maxItems ?? DEFAULT_MAX_ITEMS;

  const items = selectFirstMatching(html, selectors(config.listSelector, defaults.list), maxItems);
  if (items.length === 0) return [];

  const out: RawEvent[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const scope = item.inner;
    const linkSelectors = selectors(config.linkSelector, defaults.link);
    const href =
      attributeFrom(scope, linkSelectors, 'href') ??
      (item.tag === 'a' ? item.attributes['href'] : undefined) ??
      null;
    const sourceUrl = absoluteUrl(pageUrl, href);

    const title = clamp(
      textFrom(scope, selectors(config.titleSelector, defaults.title)) ??
        (item.tag === 'a' ? stripTags(item.inner) : null),
      300,
    );

    const dateText = valueFrom(
      scope,
      selectors(config.dateSelector, defaults.date),
      config.dateAttribute ?? 'datetime',
    );
    const timeText = valueFrom(scope, selectors(config.timeSelector, defaults.time));
    // Sem seletor de data que case, tenta-se o texto do item inteiro: um mês
    // por extenso ou uma data numérica são reconhecíveis sem contexto, e
    // perder a data é perder o evento.
    //
    // Salvo onde a fonte declara `dateOnlyFromSelector`, porque aí o cartão tem
    // mais do que uma data e a que sobra é a errada. Ver a nota da opção.
    const datas = sessionsFromText(
      dateText ?? (config.dateOnlyFromSelector ? null : stripTags(scope)),
      timeText ?? dateText,
    );

    if (!title) {
      log.warn('item sem título ignorado', sourceUrl ?? pageUrl);
      continue;
    }

    const sourceKey = sourceKeyFromUrl(sourceUrl) ?? fallbackKey(title, datas.sessions);
    if (seen.has(sourceKey)) continue;
    seen.add(sourceKey);

    out.push({
      sourceKey,
      sourceUrl,
      title,
      description: clamp(
        textFrom(scope, selectors(config.descriptionSelector, defaults.description)),
        20_000,
      ),
      dates: datas.sessions,
      isOngoing: datas.isOngoing,
      venueName:
        config.venueName ??
        clamp(textFrom(scope, selectors(config.venueSelector, defaults.venue)), 200),
      imageUrl: imageFrom(scope, selectors(config.imageSelector, defaults.image), pageUrl),
      priceRaw: clamp(textFrom(scope, selectors(config.priceSelector, defaults.price)), 500),
      categoriesRaw: categoriesFrom(scope, selectors(config.categorySelector, defaults.category)),
      payload: { extractedBy: 'selectors', listUrl: pageUrl, dateText },
    });
  }

  return out;
}

/**
 * Chave para um item sem ligação própria.
 *
 * Título mais primeira data: é o par que se mantém entre recolhas. Sem a data,
 * uma agenda com dois «Hora do Conto» por mês colapsava num evento só.
 */
function fallbackKey(title: string, dates: readonly RawSession[]): string {
  const date = dates[0]?.date ?? 'sem-data';
  return `${slugify(title).slice(0, 120) || 'evento'}-${date}`;
}

/** Páginas de listagem a percorrer, na ordem em que foram configuradas. */
export function listUrls(context: AdapterContext, config: AdapterConfig): string[] {
  const urls =
    config.listUrls && config.listUrls.length > 0 ? config.listUrls : [context.source.url];
  return [...new Set(urls)];
}

/**
 * O que a página do evento acrescenta ao que a listagem deu.
 *
 * Ao contrário do `municipal-cms`, aqui **não se adivinha**: o que se lê é o
 * que a fonte declarou em `detailDescriptionSelector` e
 * `detailCategorySelector`, e mais nada. A tentação era cair para
 * `og:description` quando o seletor não casasse — e o Centro Cultural Gil
 * Vicente é a prova de que seria um erro: o `og:description` de cada
 * espetáculo é «10/outubro | 21h30», a data, que é uma frase perfeitamente
 * válida e não é uma descrição. Guardá-la seria pior do que o campo vazio,
 * porque tem ar de estar preenchido.
 *
 * Só preenche o que falta. Uma listagem que já trouxe descrição ganha sempre
 * — é ela o resumo que a fonte escolheu mostrar.
 */
function completarPorSeletores(config: AdapterConfig) {
  return (event: RawEvent, html: string, pageUrl: string, log: RunLogger): RawEvent => {
    const description =
      event.description ??
      clamp(textFrom(html, selectors(config.detailDescriptionSelector, [])), 20_000);

    if (!description) log.warn('página de detalhe sem descrição legível', pageUrl);

    const categoriesRaw =
      event.categoriesRaw && event.categoriesRaw.length > 0
        ? event.categoriesRaw
        : categoriesFrom(html, selectors(config.detailCategorySelector, []));

    return { ...event, description, categoriesRaw };
  };
}

/** Vale a pena gastar um pedido? Só se falta o que o detalhe pode dar. */
function faltaOQueODetalheDa(event: RawEvent): boolean {
  return !event.description || !event.categoriesRaw || event.categoriesRaw.length === 0;
}

export const genericHtmlAdapter: Adapter = {
  id: 'generic-html',

  async fetchEvents(context: AdapterContext): Promise<RawEvent[]> {
    const { config, unknownKeys } = parseAdapterConfig(context.source.config);
    if (unknownKeys.length > 0) {
      context.log.warn('config com chaves que ninguém lê', unknownKeys.join(', '));
    }

    if (!config.listSelector || config.listSelector.length === 0) {
      throw new Error(
        `a fonte «${context.source.id}» usa o adaptador generic-html sem «listSelector» em config`,
      );
    }

    const collected = new Map<string, RawEvent>();
    let reached = 0;

    for (const url of listUrls(context, config)) {
      const response = await context.http.get(url);
      if (!response.ok) {
        context.log.warn(`listagem sem resposta utilizável: ${url}`, response.error ?? undefined);
        continue;
      }
      reached += 1;

      const events = extractBySelectors({
        html: response.body,
        pageUrl: response.url,
        config,
        log: context.log,
      });
      for (const event of events) {
        if (!collected.has(event.sourceKey)) collected.set(event.sourceKey, event);
      }
    }

    if (reached === 0) throw new Error('nenhuma página de listagem respondeu');

    const events = [...collected.values()];
    if (!config.followLinks) return events;

    return seguirDetalhes({
      events,
      context,
      cap: config.maxDetailPages,
      precisa: faltaOQueODetalheDa,
      completar: completarPorSeletores(config),
    });
  },
};
