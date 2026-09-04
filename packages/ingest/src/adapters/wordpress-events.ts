/**
 * A API REST do The Events Calendar — o plugin de agenda do WordPress.
 *
 * É o plugin de eventos mais instalado do WordPress, e o WordPress é o que
 * corre metade dos sítios de juntas, associações e salas deste país. Quem o
 * tem serve, sem saber, uma API aberta em `/wp-json/tribe/events/v1/events`:
 * identificador estável, datas em ISO com hora, dia inteiro declarado, sítio
 * com morada e coordenadas, cartaz, preço e categorias. É tudo o que o HTML
 * de uma agenda não dá, e vem sem se raspar nada.
 *
 * Uma fonte aponta para o sítio (`https://jf-exemplo.pt/`) ou para a API; a
 * que aponta para o sítio ganha o caminho da API daqui. Pede-se o que começa
 * hoje ou depois, cinquenta por página, até quatro páginas — uma agenda de
 * junta não tem duzentos eventos por vir, e uma que tenha é um arquivo com
 * outro nome.
 *
 * O que **não** se afirma: `website` é a página do organizador, não a
 * bilheteira, e fica em `payload` em vez de ir para `ticketingUrl`; um preço
 * que não seja claramente «grátis» fica em `priceRaw` para o harmonizador
 * ler, em vez de se decidir aqui que é pago.
 */

import { z } from 'zod';
import { addDays, todayInLisbon, type RawEvent } from '@coreto/core';
import {
  parseAdapterConfig,
  type Adapter,
  type AdapterContext,
  type SourceDates,
} from '../adapter.js';
import { absoluteUrl, sourceKeyFromUrl, splitIsoDateTime, stripTags } from '../html.js';
import { sessionsForRange } from './municipal-cms.js';

/** Páginas seguidas por execução. Quatro de cinquenta é uma agenda; mais é arquivo. */
const MAX_PAGES = 4;
const PER_PAGE = 50;
/** Tecto de eventos devolvidos, seja qual for a paginação. */
const MAX_ITEMS = 200;

const CAMINHO_DA_API = '/wp-json/tribe/events/v1/events';

/**
 * O que a API devolve por evento, campo a campo, e tudo tolerante.
 *
 * É input externo de um plugin que muda de versão sem avisar: uma chave que
 * desapareça não pode derrubar a recolha. O indispensável — título e data de
 * início — verifica-se depois, por evento, e o que não o tem é deixado cair
 * com aviso em vez de inventado.
 *
 * Dois campos têm forma dupla, e a fixture mostra-o: `venue` é um objeto
 * quando há sítio e **uma lista vazia** quando não há; `image` é um objeto
 * com `url` quando há cartaz e **`false`** quando não há.
 */
const tribeVenueSchema = z.object({
  venue: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  zip: z.string().nullish(),
  geo_lat: z.union([z.number(), z.string(), z.boolean()]).nullish(),
  geo_lng: z.union([z.number(), z.string(), z.boolean()]).nullish(),
});

const tribeEventSchema = z.object({
  id: z.union([z.number(), z.string()]).nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  excerpt: z.string().nullish(),
  url: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  all_day: z.boolean().nullish(),
  cost: z.union([z.string(), z.number()]).nullish(),
  website: z.string().nullish(),
  image: z.union([z.object({ url: z.string().nullish() }), z.string(), z.boolean()]).nullish(),
  venue: z.union([tribeVenueSchema, z.array(z.unknown())]).nullish(),
  categories: z.array(z.object({ name: z.string().nullish() })).nullish(),
});

const tribePageSchema = z.object({
  events: z.array(z.unknown()).default([]),
  next_rest_url: z.string().nullish(),
});

export type TribeEvent = z.infer<typeof tribeEventSchema>;

export interface TribeReadOptions {
  /** O espaço a assumir quando o evento não declara sítio e a fonte é de uma casa só. */
  venueName?: string;
}

export interface TribePage {
  events: RawEvent[];
  /** A página seguinte, quando a API a anuncia. */
  next: string | null;
  /** Registos que a API devolveu sem a forma esperada, ou sem título ou data. */
  dropped: number;
}

/**
 * O endereço da API a partir do que está em `sources.url`.
 *
 * Aceita o sítio ou a API. Os parâmetros que a fonte já traga ganham: uma
 * fonte que queira só uma categoria ou outro `per_page` escreve-o no URL.
 */
export function tribeEndpoint(sourceUrl: string, today: string): string {
  let base = sourceUrl.trim();
  if (!/\/wp-json\//i.test(base)) base = `${base.replace(/\/+$/, '')}${CAMINHO_DA_API}`;

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new Error(`endereço da fonte ilegível: ${sourceUrl}`);
  }
  if (!url.searchParams.has('per_page')) url.searchParams.set('per_page', String(PER_PAGE));
  if (!url.searchParams.has('start_date')) url.searchParams.set('start_date', today);
  return url.toString();
}

function limpo(value: string | null | undefined, max: number): string | null {
  const text = stripTags(value ?? '');
  return text ? text.slice(0, max) : null;
}

/**
 * As sessões de um evento a partir de `start_date`/`end_date`/`all_day`.
 *
 * Um dia inteiro não tem hora — a API escreve `00:00:00` e `23:59:59` na
 * mesma, e importá-los punha uma feira à meia-noite. Um fim no dia seguinte
 * antes das seis da manhã é a mesma noite, não um período de dois dias — o
 * critério de `saneEndTime` em `@coreto/core`. O resto é `sessionsForRange`:
 * um intervalo dá os dois extremos e a marca de estar em cartaz, nunca um
 * dia por cada dia lá pelo meio.
 */
export function lerDatasTribe(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  allDay: boolean,
): SourceDates {
  const inicio = splitIsoDateTime(startDate);
  if (!inicio.date) return { sessions: [], isOngoing: false };

  const fim = splitIsoDateTime(endDate);
  const startTime = allDay ? null : inicio.time;
  const endTime = allDay ? null : fim.time;
  let ultimoDia = fim.date;

  if (
    !allDay &&
    ultimoDia !== null &&
    endTime !== null &&
    endTime < '06:00' &&
    ultimoDia === addDays(inicio.date, 1)
  ) {
    ultimoDia = null;
  }

  return sessionsForRange(inicio.date, startTime, ultimoDia, endTime);
}

/** As formas de dizer «não se paga» que uma pessoa escreve no campo do preço. */
const GRATIS =
  /^(?:free|gratis|gratuito|gratuita|entrada livre|entrada gratuita|livre|0|0[.,]00|0 ?(?:€|eur)|(?:€|eur) ?0)$/;

/**
 * O preço tal como a fonte o escreve, e se é claramente de graça.
 *
 * Só se afirma `isFree` quando o campo diz isso e mais nada. «5€ / grátis
 * para sócios» fica em `priceRaw`, que é onde o harmonizador o lê com o
 * leitor de preços da casa — decidir aqui era decidir duas vezes.
 */
export function lerCusto(cost: string | number | null | undefined): {
  priceRaw: string | null;
  isFree: boolean | null;
} {
  const bruto = typeof cost === 'number' ? String(cost) : limpo(cost, 500);
  if (!bruto) return { priceRaw: null, isFree: null };
  const chave = bruto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { priceRaw: bruto, isFree: GRATIS.test(chave) ? true : null };
}

/** Uma coordenada que é um número dentro do mundo. Zero é o valor por omissão, não um sítio. */
function coordenada(valor: unknown, maximo: number): number | null {
  const numero =
    typeof valor === 'number'
      ? valor
      : typeof valor === 'string'
        ? Number.parseFloat(valor.replace(',', '.'))
        : Number.NaN;
  if (!Number.isFinite(numero) || numero === 0 || Math.abs(numero) > maximo) return null;
  return numero;
}

export function tribeToRawEvent(
  event: TribeEvent,
  pageUrl: string,
  options: TribeReadOptions = {},
): RawEvent | null {
  const title = limpo(event.title, 300);
  const datas = lerDatasTribe(event.start_date, event.end_date, event.all_day === true);
  if (!title || datas.sessions.length === 0) return null;

  const sourceUrl = absoluteUrl(pageUrl, event.url);
  const id = event.id === null || event.id === undefined ? null : String(event.id).trim() || null;
  const sourceKey = (
    id ??
    sourceKeyFromUrl(sourceUrl) ??
    `${datas.sessions[0]?.date}-${title}`
  ).slice(0, 300);

  const venue = event.venue && !Array.isArray(event.venue) ? event.venue : null;
  const venueName = limpo(venue?.venue, 200) ?? options.venueName ?? null;
  const morada = [venue?.address, venue?.zip, venue?.city]
    .map((parte) => limpo(parte, 200))
    .filter((parte): parte is string => parte !== null);
  const latitude = coordenada(venue?.geo_lat, 90);
  const longitude = coordenada(venue?.geo_lng, 180);
  const comCoordenadas = latitude !== null && longitude !== null;

  const imagem =
    typeof event.image === 'string'
      ? event.image
      : event.image && typeof event.image === 'object'
        ? event.image.url
        : null;

  const categoriesRaw: string[] = [];
  for (const categoria of event.categories ?? []) {
    const nome = limpo(categoria.name, 120);
    if (nome && !categoriesRaw.includes(nome)) categoriesRaw.push(nome);
  }

  const { priceRaw, isFree } = lerCusto(event.cost);

  return {
    sourceKey,
    sourceUrl,
    title,
    description: limpo(event.description, 20_000) ?? limpo(event.excerpt, 20_000),
    dates: datas.sessions,
    isOngoing: datas.isOngoing,
    venueName,
    locationAddress: morada.length > 0 ? morada.join(', ') : null,
    latitude: comCoordenadas ? latitude : null,
    longitude: comCoordenadas ? longitude : null,
    categoriesRaw: categoriesRaw.slice(0, 20),
    priceRaw,
    isFree,
    imageUrl: absoluteUrl(pageUrl, imagem),
    payload: {
      extractedBy: 'wordpress-events',
      id,
      allDay: event.all_day ?? false,
      startDate: event.start_date ?? null,
      endDate: event.end_date ?? null,
      cost: event.cost ?? null,
      website: event.website ?? null,
    },
  };
}

/**
 * Uma página da API, já lida.
 *
 * Rebenta — de propósito — quando a resposta não é JSON ou não tem a forma
 * de uma página de eventos: um sítio que passou a devolver HTML, ou uma API
 * que mudou, não é uma agenda vazia e não pode passar por uma.
 */
export function parseTribePage(
  json: string,
  pageUrl: string,
  options: TribeReadOptions = {},
): TribePage {
  let decodificado: unknown;
  try {
    decodificado = JSON.parse(json);
  } catch {
    throw new Error('a API de eventos respondeu com o que não é JSON');
  }

  const pagina = tribePageSchema.safeParse(decodificado);
  if (!pagina.success) {
    throw new Error(
      `a API de eventos mudou de forma: ${pagina.error.issues[0]?.message ?? 'sem detalhe'}`,
    );
  }

  const events: RawEvent[] = [];
  const vistos = new Set<string>();
  let dropped = 0;

  for (const bruto of pagina.data.events) {
    const lido = tribeEventSchema.safeParse(bruto);
    const raw = lido.success ? tribeToRawEvent(lido.data, pageUrl, options) : null;
    if (!raw) {
      dropped += 1;
      continue;
    }
    if (vistos.has(raw.sourceKey)) continue;
    vistos.add(raw.sourceKey);
    events.push(raw);
  }

  return { events, next: pagina.data.next_rest_url?.trim() || null, dropped };
}

function mesmoAnfitriao(a: string, b: string): boolean {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

export const wordpressEventsAdapter: Adapter = {
  id: 'wordpress-events',

  async fetchEvents({ source, http, log }: AdapterContext): Promise<RawEvent[]> {
    const { config, unknownKeys } = parseAdapterConfig(source.config);
    if (unknownKeys.length > 0) {
      log.warn('config com chaves que ninguém lê', unknownKeys.join(', '));
    }

    const limite = Math.min(config.maxItems ?? MAX_ITEMS, MAX_ITEMS);
    const primeira = tribeEndpoint(source.url, todayInLisbon());
    const recolhidos = new Map<string, RawEvent>();
    let proxima: string | null = primeira;
    let paginas = 0;
    let deixadosCair = 0;

    while (proxima !== null && paginas < MAX_PAGES && recolhidos.size < limite) {
      const resposta = await http.get(proxima);
      if (!resposta.ok) {
        if (paginas === 0) {
          throw new Error(`a API de eventos não respondeu: ${resposta.error ?? resposta.status}`);
        }
        // A primeira página já deu o que dava; uma seguinte que falhe custa
        // o resto, não o que já se leu.
        log.warn(
          `página seguinte sem resposta utilizável: ${proxima}`,
          resposta.error ?? undefined,
        );
        break;
      }
      paginas += 1;

      const pagina = parseTribePage(resposta.body, resposta.url, { venueName: config.venueName });
      deixadosCair += pagina.dropped;
      for (const event of pagina.events) {
        if (!recolhidos.has(event.sourceKey)) recolhidos.set(event.sourceKey, event);
      }

      // Só se segue uma «página seguinte» no mesmo servidor: a API é de quem
      // nos deixa ler, e não é ela que decide a que outros sítios vamos.
      proxima = pagina.next !== null && mesmoAnfitriao(pagina.next, primeira) ? pagina.next : null;
    }

    if (proxima !== null && paginas >= MAX_PAGES) {
      log.warn('tecto de páginas da API atingido', `${MAX_PAGES} páginas de ${PER_PAGE}`);
    }
    if (deixadosCair > 0) {
      log.warn(`${deixadosCair} registos sem título, sem data ou com outra forma`);
    }

    const events = [...recolhidos.values()].slice(0, limite);
    // Uma lista vazia que chegou com sucesso é indistinguível de uma agenda
    // que esvaziou. Quem decide é a reconciliação, com o histórico à frente —
    // mas o aviso tem de sair, senão a execução fica verde a não trazer nada.
    if (events.length === 0) log.warn(`a API de eventos de ${source.name} devolveu zero eventos`);
    else log.info(`${events.length} eventos na API de eventos de ${source.name}`);

    return events;
  },
};
