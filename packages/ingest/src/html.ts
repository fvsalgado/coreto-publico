/**
 * Leitura de HTML sem dependências.
 *
 * Não é um motor de CSS nem um parser conforme: é o mínimo que chega para ler
 * uma agenda municipal — blocos por etiqueta, classe, id ou atributo, com
 * descendentes separados por espaço. Uma biblioteca de parsing traria consigo
 * uma árvore de dependências maior do que este pacote inteiro, e a recolha
 * corre sem supervisão de madrugada: menos código de terceiros a correr sem
 * ninguém a ver é uma decisão de segurança, não de gosto.
 *
 * A ordem de preferência da leitura está aqui de propósito, e é sempre a
 * mesma: JSON-LD, depois metadados, e só no fim seletores. Os dois primeiros
 * são contratos publicados pelo site; o terceiro é uma leitura da aparência,
 * que muda quando o site muda de tema.
 */

import { unescapeHtml } from '@coreto/core';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** Elementos cujo conteúdo não é marcação e tem de ser saltado inteiro. */
const RAW_TEXT_ELEMENTS = new Set(['script', 'style']);

/**
 * Elementos que a norma deixa fechar sozinhos.
 *
 * Sem isto, um `<p>` sem `</p>` — que é como metade dos CMS escreve — engolia
 * o resto do documento e a descrição de um evento saía com a agenda toda lá
 * dentro.
 */
const OPTIONAL_END_TAGS = new Set([
  'p',
  'li',
  'td',
  'th',
  'tr',
  'dt',
  'dd',
  'option',
  'thead',
  'tbody',
]);

const BLOCK_ELEMENTS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'br',
  'div',
  'dd',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'section',
  'table',
  'td',
  'th',
  'tr',
  'ul',
]);

interface TagToken {
  name: string;
  attributes: Record<string, string>;
  closing: boolean;
  selfClosing: boolean;
  /** Índice do `<`. */
  start: number;
  /** Índice a seguir ao `>`. */
  end: number;
}

export interface HtmlElement {
  tag: string;
  attributes: Readonly<Record<string, string>>;
  /** Marcação entre a etiqueta de abertura e a de fecho. */
  inner: string;
  /** O elemento inteiro, etiquetas incluídas. */
  outer: string;
}

const ATTRIBUTE_RE =
  /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttributes(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of raw.matchAll(ATTRIBUTE_RE)) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    out[name] = unescapeHtml(value) ?? value;
  }
  return out;
}

/**
 * Lê a etiqueta que começa em `index`.
 *
 * A travessia respeita aspas porque `content="Ler mais >"` existe, e um `>`
 * dentro de aspas não fecha etiqueta nenhuma — foi assim que uma expressão
 * regular ingénua partiu um cartão de partilha ao meio.
 */
function readTag(html: string, index: number): TagToken | null {
  if (html[index] !== '<') return null;
  let cursor = index + 1;
  const closing = html[cursor] === '/';
  if (closing) cursor += 1;

  const nameMatch = /^[a-zA-Z][a-zA-Z0-9:-]*/.exec(html.slice(cursor, cursor + 64));
  if (!nameMatch) return null;
  const name = nameMatch[0].toLowerCase();
  cursor += nameMatch[0].length;

  const attributesStart = cursor;
  let quote: string | null = null;
  while (cursor < html.length) {
    const char = html[cursor] as string;
    if (quote !== null) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      break;
    }
    cursor += 1;
  }
  if (cursor >= html.length) return null;

  const rawAttributes = html.slice(attributesStart, cursor);
  return {
    name,
    attributes: closing ? {} : parseAttributes(rawAttributes),
    closing,
    selfClosing: rawAttributes.trimEnd().endsWith('/'),
    start: index,
    end: cursor + 1,
  };
}

/** Índice a seguir ao fecho de um `<script>`/`<style>`. */
function rawTextEnd(html: string, token: TagToken): number {
  const close = html.toLowerCase().indexOf(`</${token.name}`, token.end);
  if (close === -1) return html.length;
  const gt = html.indexOf('>', close);
  return gt === -1 ? html.length : gt + 1;
}

interface ReadElement {
  element: HtmlElement;
  /** Índice a seguir ao elemento inteiro. */
  end: number;
}

/**
 * Elementos que fecham implicitamente outro elemento ao abrir.
 *
 * Um `<p>` sem `</p>` seguido de um `<div>` é HTML válido, e é o que os
 * editores de conteúdo dos CMS produzem o dia inteiro. Sem esta tabela, o
 * resumo de um evento vinha com a etiqueta e a listagem toda lá dentro.
 */
const IMPLICIT_CLOSERS: Record<string, ReadonlySet<string>> = {
  p: BLOCK_ELEMENTS,
  li: new Set(['li']),
  dt: new Set(['dt', 'dd']),
  dd: new Set(['dt', 'dd']),
  td: new Set(['td', 'th', 'tr']),
  th: new Set(['td', 'th', 'tr']),
  tr: new Set(['tr']),
  option: new Set(['option']),
  thead: new Set(['tbody', 'tfoot']),
  tbody: new Set(['tbody', 'tfoot']),
};

type ElementBuilder = (inner: string, end: number) => ReadElement;

/**
 * Lê um elemento cujo fecho é opcional.
 *
 * Guarda-se a pilha do que foi aberto lá dentro: um fecho que não esteja na
 * pilha é o fecho de um antepassado, e nessa altura o elemento acabou —
 * mesmo que a etiqueta própria nunca tenha aparecido.
 */
function readLooseElement(html: string, token: TagToken, build: ElementBuilder): ReadElement {
  const closers = IMPLICIT_CLOSERS[token.name] ?? new Set<string>();
  const stack: string[] = [];
  let cursor = token.end;

  while (cursor < html.length) {
    const lt = html.indexOf('<', cursor);
    if (lt === -1) break;
    if (html.startsWith('<!--', lt)) {
      const commentEnd = html.indexOf('-->', lt);
      cursor = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    const next = readTag(html, lt);
    if (!next) {
      cursor = lt + 1;
      continue;
    }

    if (next.closing) {
      const openedAt = stack.lastIndexOf(next.name);
      if (openedAt >= 0) {
        stack.length = openedAt;
        cursor = next.end;
        continue;
      }
      if (next.name === token.name) return build(html.slice(token.end, next.start), next.end);
      return build(html.slice(token.end, next.start), next.start);
    }

    const empty = next.selfClosing || VOID_ELEMENTS.has(next.name);
    if (!empty && RAW_TEXT_ELEMENTS.has(next.name)) {
      cursor = rawTextEnd(html, next);
      continue;
    }
    if (!empty) {
      if (stack.length === 0 && (next.name === token.name || closers.has(next.name))) {
        return build(html.slice(token.end, next.start), next.start);
      }
      stack.push(next.name);
    }
    cursor = next.end;
  }

  return build(html.slice(token.end), html.length);
}

function readElement(html: string, token: TagToken): ReadElement {
  const build: ElementBuilder = (inner, end) => ({
    element: {
      tag: token.name,
      attributes: token.attributes,
      inner,
      outer: html.slice(token.start, end),
    },
    end,
  });

  if (token.selfClosing || VOID_ELEMENTS.has(token.name)) return build('', token.end);

  if (RAW_TEXT_ELEMENTS.has(token.name)) {
    const end = rawTextEnd(html, token);
    const close = html.lastIndexOf('<', end - 1);
    return build(html.slice(token.end, close > token.end ? close : end), end);
  }

  if (OPTIONAL_END_TAGS.has(token.name)) return readLooseElement(html, token, build);

  let depth = 1;
  let cursor = token.end;
  while (cursor < html.length) {
    const lt = html.indexOf('<', cursor);
    if (lt === -1) break;
    if (html.startsWith('<!--', lt)) {
      const commentEnd = html.indexOf('-->', lt);
      cursor = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    const next = readTag(html, lt);
    if (!next) {
      cursor = lt + 1;
      continue;
    }

    if (next.name === token.name) {
      if (next.closing) {
        depth -= 1;
        if (depth === 0) return build(html.slice(token.end, next.start), next.end);
      } else if (!next.selfClosing && !VOID_ELEMENTS.has(next.name)) {
        depth += 1;
      }
    }

    cursor = !next.closing && RAW_TEXT_ELEMENTS.has(next.name) ? rawTextEnd(html, next) : next.end;
  }

  // Etiqueta por fechar até ao fim do bloco: fica com o que resta. Um bloco
  // grande de mais é recuperável; perder o item não é.
  return build(html.slice(token.end), html.length);
}

// ---------------------------------------------------------------------------
// Seletores
// ---------------------------------------------------------------------------

type AttributeMatch = { name: string; value: string | null; contains: boolean };

export interface SelectorStep {
  tag: string | null;
  id: string | null;
  classes: string[];
  attributes: AttributeMatch[];
}

function parseStep(step: string): SelectorStep | null {
  const out: SelectorStep = { tag: null, id: null, classes: [], attributes: [] };
  let cursor = 0;

  const tagMatch = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(step);
  if (tagMatch) {
    out.tag = tagMatch[0].toLowerCase();
    cursor = tagMatch[0].length;
  }

  while (cursor < step.length) {
    const char = step[cursor];
    if (char === '.' || char === '#') {
      const name = /^[A-Za-z0-9_-]+/.exec(step.slice(cursor + 1));
      if (!name) return null;
      if (char === '.') out.classes.push(name[0]);
      else out.id = name[0];
      cursor += 1 + name[0].length;
      continue;
    }
    if (char === '[') {
      const close = step.indexOf(']', cursor);
      if (close === -1) return null;
      const body = step.slice(cursor + 1, close);
      const equals = body.indexOf('=');
      if (equals === -1) {
        out.attributes.push({ name: body.trim().toLowerCase(), value: null, contains: false });
      } else {
        let name = body.slice(0, equals).trim();
        const contains = name.endsWith('*') || name.endsWith('~');
        if (contains) name = name.slice(0, -1);
        const value = body
          .slice(equals + 1)
          .trim()
          .replace(/^["']|["']$/g, '');
        out.attributes.push({ name: name.toLowerCase(), value, contains });
      }
      cursor = close + 1;
      continue;
    }
    return null;
  }

  if (!out.tag && !out.id && out.classes.length === 0 && out.attributes.length === 0) return null;
  return out;
}

/** `.agenda .titulo a` → três passos de descendência. `null` se for ilegível. */
export function parseSelector(selector: string): SelectorStep[] | null {
  const steps: SelectorStep[] = [];
  for (const part of selector.trim().split(/\s+/)) {
    const step = parseStep(part);
    if (!step) return null;
    steps.push(step);
  }
  return steps.length > 0 ? steps : null;
}

function matchesStep(token: TagToken, step: SelectorStep): boolean {
  if (step.tag && step.tag !== token.name) return false;
  if (step.id && token.attributes['id'] !== step.id) return false;

  if (step.classes.length > 0) {
    const classes = (token.attributes['class'] ?? '').split(/\s+/);
    if (!step.classes.every((wanted) => classes.includes(wanted))) return false;
  }

  for (const attribute of step.attributes) {
    const actual = token.attributes[attribute.name];
    if (actual === undefined) return false;
    if (attribute.value === null) continue;
    if (attribute.contains) {
      if (!actual.toLowerCase().includes(attribute.value.toLowerCase())) return false;
    } else if (actual !== attribute.value) {
      return false;
    }
  }

  return true;
}

const DEFAULT_LIMIT = 400;

function findElements(html: string, step: SelectorStep, limit: number): HtmlElement[] {
  const out: HtmlElement[] = [];
  let cursor = 0;

  while (cursor < html.length && out.length < limit) {
    const lt = html.indexOf('<', cursor);
    if (lt === -1) break;

    if (html.startsWith('<!--', lt)) {
      const commentEnd = html.indexOf('-->', lt);
      cursor = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    const token = readTag(html, lt);
    if (!token) {
      cursor = lt + 1;
      continue;
    }
    if (token.closing) {
      cursor = token.end;
      continue;
    }

    if (matchesStep(token, step)) {
      const read = readElement(html, token);
      out.push(read.element);
      // Não se procura dentro do que já casou: numa listagem há `<article>`
      // dentro de `<article>` e o item é o de fora.
      cursor = Math.max(read.end, token.end);
      continue;
    }

    cursor = RAW_TEXT_ELEMENTS.has(token.name) ? rawTextEnd(html, token) : token.end;
  }

  return out;
}

/** Todos os elementos que casam com o seletor, sem sobreposição. */
export function selectAll(html: string, selector: string, limit = DEFAULT_LIMIT): HtmlElement[] {
  const steps = parseSelector(selector);
  if (!steps || !html) return [];

  let scopes: string[] = [html];
  let matches: HtmlElement[] = [];

  for (const step of steps) {
    matches = [];
    for (const scope of scopes) {
      for (const element of findElements(scope, step, limit)) {
        matches.push(element);
        if (matches.length >= limit) break;
      }
      if (matches.length >= limit) break;
    }
    scopes = matches.map((element) => element.inner);
  }

  return matches;
}

export function selectFirst(html: string, selector: string): HtmlElement | null {
  return selectAll(html, selector, 1)[0] ?? null;
}

/**
 * Aplica os seletores por ordem e devolve o primeiro que dá resultado.
 *
 * Os valores por omissão dos adaptadores são listas destas: um CMS municipal
 * chama `.evento` ao que o do concelho ao lado chama `.agenda-item`, e tentar
 * por ordem poupa uma configuração por fonte.
 */
export function selectFirstMatching(
  html: string,
  selectors: readonly string[],
  limit = DEFAULT_LIMIT,
): HtmlElement[] {
  for (const selector of selectors) {
    const found = selectAll(html, selector, limit);
    if (found.length > 0) return found;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

function collapse(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Texto visível de um fragmento: sem etiquetas, sem entidades, sem espaço a mais. */
export function stripTags(html: string | null | undefined): string {
  if (!html) return '';
  let out = '';
  let cursor = 0;

  while (cursor < html.length) {
    const lt = html.indexOf('<', cursor);
    if (lt === -1) {
      out += html.slice(cursor);
      break;
    }
    out += html.slice(cursor, lt);

    if (html.startsWith('<!--', lt)) {
      const commentEnd = html.indexOf('-->', lt);
      cursor = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    const token = readTag(html, lt);
    if (!token) {
      out += '<';
      cursor = lt + 1;
      continue;
    }

    out += BLOCK_ELEMENTS.has(token.name) ? '\n' : ' ';
    cursor =
      !token.closing && RAW_TEXT_ELEMENTS.has(token.name) ? rawTextEnd(html, token) : token.end;
  }

  return collapse(unescapeHtml(out) ?? out);
}

/** Texto do primeiro elemento que casar com um dos seletores. */
export function textFrom(html: string, selectors: readonly string[]): string | null {
  for (const selector of selectors) {
    const element = selectFirst(html, selector);
    if (!element) continue;
    const text = stripTags(element.inner);
    if (text) return text;
  }
  return null;
}

/** Atributo do primeiro elemento que casar com um dos seletores. */
export function attributeFrom(
  html: string,
  selectors: readonly string[],
  attribute: string,
): string | null {
  for (const selector of selectors) {
    for (const element of selectAll(html, selector, 8)) {
      const value = element.attributes[attribute];
      if (value) return value;
    }
  }
  return null;
}

/** Converte um endereço relativo em absoluto. Só devolve `http`/`https`. */
export function absoluteUrl(base: string, href: string | null | undefined): string | null {
  if (!href) return null;
  try {
    const resolved = new URL(href.trim(), base);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

/**
 * Chave estável de um evento a partir do seu endereço.
 *
 * O caminho, sem barras nas pontas, com a query — há CMS que identificam o
 * evento em `?id=1234` e cortar a query juntava a agenda toda numa chave só.
 * O domínio fica de fora: um site que passa de `www` para o domínio nu não
 * pode fazer entrar o catálogo inteiro como novo.
 */
export function sourceKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`.replace(/^\/+/, '').replace(/\/+$/, '');
    return path ? path.slice(0, 300) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Metadados
// ---------------------------------------------------------------------------

/** Conteúdo de `<meta property="og:title">` ou `<meta name="description">`. */
export function metaContent(html: string, key: string): string | null {
  const wanted = key.toLowerCase();
  for (const element of selectAll(html, 'meta', 200)) {
    const name = (element.attributes['property'] ?? element.attributes['name'] ?? '').toLowerCase();
    if (name !== wanted) continue;
    const content = element.attributes['content'];
    if (content) return collapse(content);
  }
  return null;
}

/** Valor de um `itemprop` de microdados, do texto ou do atributo próprio. */
export function microdataValue(html: string, property: string): string | null {
  for (const element of selectAll(html, `[itemprop="${property}"]`, 20)) {
    const explicit =
      element.attributes['content'] ??
      element.attributes['datetime'] ??
      (element.tag === 'a' ? element.attributes['href'] : undefined) ??
      (element.tag === 'img' ? element.attributes['src'] : undefined);
    if (explicit) return collapse(explicit);
    const text = stripTags(element.inner);
    if (text) return text;
  }
  return null;
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

const jsonLdTextSchema = z.union([z.string(), z.number()]).transform((value) => String(value));

const jsonLdAddressSchema = z.union([
  z.string(),
  z.object({
    streetAddress: jsonLdTextSchema.nullish(),
    addressLocality: jsonLdTextSchema.nullish(),
    postalCode: jsonLdTextSchema.nullish(),
  }),
]);

const jsonLdPlaceSchema = z.union([
  z.string(),
  z.object({
    name: jsonLdTextSchema.nullish(),
    address: jsonLdAddressSchema.nullish(),
    geo: z
      .object({
        latitude: z.union([z.string(), z.number()]).nullish(),
        longitude: z.union([z.string(), z.number()]).nullish(),
      })
      .nullish(),
  }),
]);

const jsonLdImageSchema = z.union([
  z.string(),
  z.object({ url: z.string().nullish(), contentUrl: z.string().nullish() }),
]);

const jsonLdOfferSchema = z.object({
  price: z.union([z.string(), z.number()]).nullish(),
  lowPrice: z.union([z.string(), z.number()]).nullish(),
  highPrice: z.union([z.string(), z.number()]).nullish(),
  priceCurrency: z.string().nullish(),
  url: z.string().nullish(),
});

const jsonLdEventSchema = z.object({
  '@id': z.string().nullish(),
  '@type': z.union([z.string(), z.array(z.string())]).nullish(),
  name: jsonLdTextSchema,
  description: jsonLdTextSchema.nullish(),
  url: z.string().nullish(),
  identifier: jsonLdTextSchema.nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  doorTime: z.string().nullish(),
  eventStatus: z.string().nullish(),
  isAccessibleForFree: z.boolean().nullish(),
  typicalAgeRange: jsonLdTextSchema.nullish(),
  location: z.union([jsonLdPlaceSchema, z.array(jsonLdPlaceSchema)]).nullish(),
  image: z.union([jsonLdImageSchema, z.array(jsonLdImageSchema)]).nullish(),
  offers: z.union([jsonLdOfferSchema, z.array(jsonLdOfferSchema)]).nullish(),
  genre: z.union([jsonLdTextSchema, z.array(jsonLdTextSchema)]).nullish(),
  keywords: z.union([jsonLdTextSchema, z.array(jsonLdTextSchema)]).nullish(),
  about: z.unknown().nullish(),
});

/** Um evento schema.org já lido, com as datas partidas em dia e hora. */
export interface JsonLdEvent {
  id: string | null;
  name: string;
  description: string | null;
  url: string | null;
  image: string | null;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  locationName: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  priceRaw: string | null;
  isFree: boolean | null;
  ticketingUrl: string | null;
  categories: string[];
  ageRange: string | null;
  /** `true` quando o próprio site declara o evento cancelado ou adiado. */
  isCancelled: boolean;
  raw: Record<string, unknown>;
}

const ISO_DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/;

/** Parte uma data ISO 8601 em dia e hora, ignorando o deslocamento de fuso. */
export function splitIsoDateTime(value: string | null | undefined): {
  date: string | null;
  time: string | null;
} {
  if (!value) return { date: null, time: null };
  const match = ISO_DATE_TIME_RE.exec(value.trim());
  if (!match) return { date: null, time: null };
  return { date: match[1] ?? null, time: match[2] ?? null };
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstString(entry);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return firstString(record['url'] ?? record['contentUrl'] ?? record['name']);
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringList(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(/[,;|]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap((entry) => toStringList(entry));
  return [];
}

/** Extrai os blocos `application/ld+json`, já desdobrados de `@graph` e arrays. */
export function readJsonLdNodes(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];

  for (const script of selectAll(html, 'script[type="application/ld+json"]', 40)) {
    const text = script.inner.replace(/^\s*\/\/\s*<!\[CDATA\[|\]\]>\s*$/g, '').trim();
    if (!text) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Há CMS que escapam o `&` dentro do JSON-LD como se fosse texto. Vale
      // uma segunda tentativa antes de desistir do bloco.
      const decoded = unescapeHtml(text);
      if (!decoded || decoded === text) continue;
      try {
        parsed = JSON.parse(decoded);
      } catch {
        continue;
      }
    }

    for (const node of flattenJsonLd(parsed)) out.push(node);
  }

  return out;
}

function flattenJsonLd(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 4 || value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((entry) => flattenJsonLd(entry, depth + 1));

  const record = value as Record<string, unknown>;
  const out: Record<string, unknown>[] = [record];
  for (const key of ['@graph', 'itemListElement', 'subEvent', 'item']) {
    const nested = record[key];
    if (nested) out.push(...flattenJsonLd(nested, depth + 1));
  }
  return out;
}

function isEventType(value: unknown): boolean {
  const types = Array.isArray(value) ? value : [value];
  return types.some((type) => typeof type === 'string' && /(^|[/#])\w*event$/i.test(type.trim()));
}

const CANCELLED_STATUS = /(cancelled|canceled|postponed)/i;

/** Todos os `Event` de schema.org publicados na página, já validados. */
export function readJsonLdEvents(html: string): JsonLdEvent[] {
  const out: JsonLdEvent[] = [];

  for (const node of readJsonLdNodes(html)) {
    if (!isEventType(node['@type'])) continue;

    const parsed = jsonLdEventSchema.safeParse(node);
    if (!parsed.success) continue;
    const event = parsed.data;

    const start = splitIsoDateTime(event.startDate);
    const end = splitIsoDateTime(event.endDate);
    const place = Array.isArray(event.location) ? event.location[0] : event.location;
    const offer = Array.isArray(event.offers) ? event.offers[0] : event.offers;

    const geo = place && typeof place === 'object' ? place.geo : null;
    const address = place && typeof place === 'object' ? place.address : null;

    out.push({
      id: event['@id'] ?? event.identifier ?? event.url ?? null,
      name: event.name,
      description: event.description ?? null,
      url: event.url ?? null,
      image: firstString(event.image),
      startDate: start.date,
      startTime: start.time ?? splitIsoDateTime(event.doorTime).time,
      endDate: end.date,
      endTime: end.time,
      locationName: typeof place === 'string' ? place : (place?.name ?? null),
      address: typeof address === 'string' ? address : formatAddress(address),
      latitude: toNumber(geo?.latitude),
      longitude: toNumber(geo?.longitude),
      priceRaw: formatOffer(offer),
      isFree: event.isAccessibleForFree ?? null,
      ticketingUrl: offer?.url ?? null,
      categories: [...toStringList(event.genre), ...toStringList(event.keywords)],
      ageRange: event.typicalAgeRange ?? null,
      isCancelled: CANCELLED_STATUS.test(event.eventStatus ?? ''),
      raw: node,
    });
  }

  return out;
}

function formatAddress(
  address:
    | { streetAddress?: string | null; addressLocality?: string | null; postalCode?: string | null }
    | null
    | undefined,
): string | null {
  if (!address) return null;
  const parts = [address.streetAddress, address.postalCode, address.addressLocality]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : null;
}

function formatOffer(offer: z.infer<typeof jsonLdOfferSchema> | null | undefined): string | null {
  if (!offer) return null;
  const currency =
    offer.priceCurrency === 'EUR' || !offer.priceCurrency ? '€' : offer.priceCurrency;
  const low = toNumber(offer.lowPrice ?? offer.price);
  const high = toNumber(offer.highPrice);
  if (low === null) return null;
  if (high !== null && high !== low) return `${low} ${currency} – ${high} ${currency}`;
  return `${low} ${currency}`;
}
