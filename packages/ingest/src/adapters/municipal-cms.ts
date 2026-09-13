/**
 * Adaptador do CMS partilhado pelos sites municipais do Médio Tejo.
 *
 * A leitura é feita por camadas, da fonte mais fiável para a mais frágil:
 *
 *   1. **JSON-LD schema.org `Event`** — é um contrato publicado pelo próprio
 *      site, com datas em ISO e local identificado. Muitos CMS municipais
 *      publicam-no sem que ninguém no município saiba, e é de longe a melhor
 *      via: sobrevive a mudanças de tema.
 *   2. **Microdados** no corpo da listagem, que é a mesma informação escrita
 *      de outra maneira.
 *   3. **Seletores**, com valores por omissão para uma agenda municipal e
 *      possibilidade de os afinar em `sources.config`.
 *
 * Cada camada só corre se a anterior não deu nada. Assim um site que ganhe
 * JSON-LD amanhã passa automaticamente a ser lido pela via boa, sem se mexer
 * em configuração nenhuma.
 */

import {
  parsePortugueseDates,
  parsePortugueseTime,
  type RawEvent,
  type RawSession,
} from '@coreto/core';
import {
  absoluteUrl,
  metaContent,
  microdataValue,
  readJsonLdEvents,
  selectAll,
  sourceKeyFromUrl,
  stripTags,
  textFrom,
  type JsonLdEvent,
} from '../html.js';
import {
  parseAdapterConfig,
  type Adapter,
  type AdapterConfig,
  type AdapterContext,
  type SourceDates,
} from '../adapter.js';
import type { RunLogger } from '../run-logger.js';
import {
  extractBySelectors,
  listUrls,
  sessionsFromText,
  type SelectorDefaults,
} from './generic-html.js';
import { seguirDetalhes } from './detalhe.js';

/**
 * Seletores por omissão de uma agenda municipal.
 *
 * São nomes de classe portugueses porque os temas destes sites são feitos em
 * português. Cada lista é tentada por ordem e fica-se pela primeira que casa.
 *
 * **Hoje nenhuma fonte usa este adaptador.** As câmaras que aqui estavam
 * passaram para adaptadores próprios — `joomla-eventbooking`,
 * `portal-freguesia`, `generic-html` — que sabem a forma exacta de cada sítio.
 * Isto fica para o caso de um site municipal voltar a ter de ser lido por
 * seletores, e é o que evita ter de escrever uma `config` inteira à mão para
 * o experimentar.
 */
export const MUNICIPAL_DEFAULTS: SelectorDefaults = {
  list: [
    '.agenda-item',
    '.item-agenda',
    '.evento',
    '.item-evento',
    '.lista-eventos li',
    '.eventos .item',
    'article.post',
    'article',
  ],
  title: ['h2 a', 'h3 a', '.titulo', '.title', 'h2', 'h3'],
  date: ['time', '.data', '.date', '.data-evento', '.evento-data'],
  time: ['.hora', '.horario', '.evento-hora'],
  link: ['h2 a', 'h3 a', '.titulo a', 'a'],
  image: ['img'],
  description: ['.resumo', '.descricao', '.description', '.excerto', '.intro', 'p'],
  category: ['.categoria', '.tipo', '.etiqueta', '.tag'],
  venue: ['.local', '.espaco', '.localizacao', '.venue'],
  price: ['.preco', '.price', '.bilhete'],
};

/** Páginas de detalhe visitadas por execução, quando `followLinks` está ligado. */
const DEFAULT_MAX_DETAIL_PAGES = 40;

/**
 * Um intervalo declarado — `startDate` e `endDate` — nas duas pontas e mais
 * nada.
 *
 * Isto expandia o intervalo dia a dia, com um tecto de 92 dias. Uma exposição
 * de três meses saía daqui com **93 sessões**: 93 linhas na ficha, 93 factos
 * que a câmara nunca afirmou, e 93 entradas na agenda de quem subscrevesse o
 * calendário do concelho. A justificação escrita era «uma exposição é mesmo
 * uma ocorrência por dia — é assim que aparece a quem procura o que há hoje»,
 * e é onde estava o erro: quem procura o que há hoje é servido por
 * `date_start`/`date_end`, que a consulta compara com a data de hoje sem
 * precisar de uma linha por dia. As sessões não são um índice — são a lista
 * dos compromissos que a fonte assumiu, e uma exposição assume dois: abre a X,
 * fecha a Y.
 *
 * É a regra escrita em `packages/core/src/dates.ts` («nunca fabricar»), a
 * mesma que o `ourem-api`, o `abrantes-proxy` e o `joomla-eventbooking` já
 * seguiam à letra. Este era o adaptador que ia por outro caminho.
 *
 * O que se ganha em troca das 91 linhas fabricadas é `isOngoing`: a fonte
 * disse que aquilo está patente de X a Y, e é isso que fica escrito — em vez
 * de ficar implícito num número de sessões que ninguém consegue interpretar.
 */
export function sessionsForRange(
  startDate: string | null,
  startTime: string | null,
  endDate: string | null,
  endTime: string | null,
): SourceDates {
  if (!startDate) return { sessions: [], isOngoing: false };

  const first: RawSession = { date: startDate, startTime, endTime: endTime ?? null };
  // Um fim anterior ao início é um engano de quem escreveu, não um intervalo.
  if (!endDate || endDate <= startDate) return { sessions: [first], isOngoing: false };

  return {
    sessions: [first, { date: endDate, startTime, endTime: endTime ?? null }],
    isOngoing: true,
  };
}

/** Guarda o registo original só quando é pequeno o bastante para valer a pena. */
function compactPayload(
  node: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  try {
    const encoded = JSON.stringify(node);
    if (encoded && encoded.length <= 20_000) return { ...extra, jsonLd: node };
  } catch {
    // Estruturas circulares não vêm de JSON.parse, mas o registo em bruto
    // nunca pode ser o motivo de uma recolha falhar.
  }
  return extra;
}

export function jsonLdToRawEvent(event: JsonLdEvent, pageUrl: string): RawEvent | null {
  const title = event.name.trim();
  if (!title) return null;

  const sourceUrl = absoluteUrl(pageUrl, event.url ?? event.id);
  const sourceKey = sourceKeyFromUrl(sourceUrl ?? event.id) ?? title.slice(0, 300);

  // Uma data que não venha em ISO ainda pode vir escrita em português dentro
  // do mesmo campo — há CMS que põem «10 de maio de 2026» no `startDate`.
  const declaredStart = typeof event.raw['startDate'] === 'string' ? event.raw['startDate'] : null;
  const startDate = event.startDate ?? parsePortugueseDates(declaredStart)[0] ?? null;
  const startTime = event.startTime ?? parsePortugueseTime(declaredStart);

  const datas = sessionsForRange(startDate, startTime, event.endDate, event.endTime);
  const description = event.description ? stripTags(event.description) : null;

  return {
    sourceKey,
    sourceUrl,
    title,
    description: description || null,
    dates: datas.sessions,
    venueName: event.locationName,
    locationAddress: event.address,
    latitude: event.latitude,
    longitude: event.longitude,
    categoriesRaw: event.categories,
    audienceRaw: event.ageRange,
    priceRaw: event.priceRaw,
    isFree: event.isFree,
    ticketingUrl: absoluteUrl(pageUrl, event.ticketingUrl),
    imageUrl: absoluteUrl(pageUrl, event.image),
    isOngoing: datas.isOngoing,
    payload: compactPayload(event.raw, { extractedBy: 'json-ld', listUrl: pageUrl }),
  };
}

function fromJsonLd(html: string, pageUrl: string, log: RunLogger): RawEvent[] {
  const out: RawEvent[] = [];

  for (const event of readJsonLdEvents(html)) {
    if (event.isCancelled) {
      // Não se importa um cancelamento como se fosse programação. Fica o
      // aviso na execução para que alguém veja o que deixou de acontecer.
      log.warn('evento marcado como cancelado ou adiado pela fonte', event.name);
      continue;
    }
    const raw = jsonLdToRawEvent(event, pageUrl);
    if (raw) out.push(raw);
  }

  return out;
}

/** Segunda camada: a mesma informação, escrita em microdados. */
function fromMicrodata(html: string, pageUrl: string): RawEvent[] {
  const out: RawEvent[] = [];

  for (const block of selectAll(html, '[itemtype*="Event"]', 200)) {
    const scope = block.inner;
    const title = (microdataValue(scope, 'name') ?? '').trim();
    if (!title) continue;

    const sourceUrl = absoluteUrl(pageUrl, microdataValue(scope, 'url'));
    const rawStart = microdataValue(scope, 'startDate');
    const rawEnd = microdataValue(scope, 'endDate');

    const startDate = parseDateValue(rawStart);
    const datas = sessionsForRange(
      startDate,
      parsePortugueseTime(rawStart) ?? null,
      parseDateValue(rawEnd),
      null,
    );

    const locationBlock = selectAll(scope, '[itemprop="location"]', 1)[0];
    const venueName = locationBlock
      ? (microdataValue(locationBlock.inner, 'name') ?? stripTags(locationBlock.inner))
      : null;

    out.push({
      sourceKey: sourceKeyFromUrl(sourceUrl) ?? title.slice(0, 300),
      sourceUrl,
      title: title.slice(0, 300),
      // O microdata traz a descrição com as entidades já desescapadas pelo
      // leitor de atributos, e por isso um `&lt;p&gt;` no HTML da câmara chega
      // aqui como `<p>` literal. É o mecanismo que o plano descreve — e é
      // aqui que ele acontece de verdade, não no harmonizador.
      description: stripTags(microdataValue(scope, 'description') ?? '') || null,
      dates: datas.sessions,
      venueName: venueName ? venueName.slice(0, 200) : null,
      imageUrl: absoluteUrl(pageUrl, microdataValue(scope, 'image')),
      isOngoing: datas.isOngoing,
      payload: { extractedBy: 'microdata', listUrl: pageUrl },
    });
  }

  return out;
}

function parseDateValue(value: string | null): string | null {
  if (!value) return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  if (iso) return iso[1] ?? null;
  return parsePortugueseDates(value)[0] ?? null;
}

function extractLayered(
  html: string,
  pageUrl: string,
  config: AdapterConfig,
  log: RunLogger,
): RawEvent[] {
  const jsonLd = fromJsonLd(html, pageUrl, log);
  if (jsonLd.length > 0) {
    log.info(`${jsonLd.length} eventos lidos por JSON-LD`, pageUrl);
    return jsonLd;
  }

  const microdata = fromMicrodata(html, pageUrl);
  if (microdata.length > 0) {
    log.info(`${microdata.length} eventos lidos por microdados`, pageUrl);
    return microdata;
  }

  const bySelectors = extractBySelectors({
    html,
    pageUrl,
    config,
    defaults: MUNICIPAL_DEFAULTS,
    log,
  });
  log.info(`${bySelectors.length} eventos lidos por seletores`, pageUrl);
  return bySelectors;
}

/**
 * `true` quando ainda falta ao evento algo que a página de detalhe costuma ter.
 *
 * Exportado, com `mergeDetail`, para o `events-calendar` — que lê o mesmo
 * JSON-LD e completa pelo mesmo ciclo — não ter de o escrever outra vez.
 */
export function needsDetail(event: RawEvent): boolean {
  return !event.description || event.dates.length === 0 || !event.imageUrl;
}

/**
 * As datas de um evento depois de se ter aberto a página dele, por ordem de
 * confiança: a listagem, o JSON-LD do detalhe, o texto da página.
 *
 * As três vias devolvem agora a mesma coisa — sessões **e** se elas delimitam
 * um período — e é isso que permite ao `isOngoing` viajar junto com as datas
 * em vez de ficar para trás. Enquanto a última via chamava
 * `parsePortugueseDates`, uma exposição cuja data só estivesse escrita no
 * corpo da página («patente de 3 de junho a 27 de setembro») entrava com dois
 * extremos e sem a marca de estar em cartaz: a ficha dizia «2 sessões» e
 * afirmava, por omissão, que nos quatro meses pelo meio não havia nada.
 */
function datasDoDetalhe(event: RawEvent, detail: RawEvent | undefined, html: string): SourceDates {
  if (event.dates.length > 0) {
    return { sessions: event.dates, isOngoing: event.isOngoing ?? false };
  }
  if (detail) return { sessions: detail.dates, isOngoing: detail.isOngoing ?? false };

  return sessionsFromText(
    textFrom(html, ['.data', 'time']),
    textFrom(html, ['.hora', '.data', 'time']),
  );
}

/**
 * Completa um evento com o que a página de detalhe acrescenta.
 *
 * Só preenche o que está em falta: o que a listagem já deu ganha sempre, para
 * que uma página de detalhe com um cabeçalho genérico não substitua um título
 * bom por «Agenda Municipal».
 */
export function mergeDetail(
  event: RawEvent,
  html: string,
  pageUrl: string,
  log: RunLogger,
): RawEvent {
  const detail = readJsonLdEvents(html)
    .filter((candidate) => !candidate.isCancelled)
    .map((candidate) => jsonLdToRawEvent(candidate, pageUrl))
    .find((candidate): candidate is RawEvent => candidate !== null);

  const description =
    event.description ??
    detail?.description ??
    // Pela mesma razão do microdata: o valor de um atributo `content` chega
    // com as entidades desescapadas, e uma câmara que escreva `&lt;p&gt;` na
    // meta-descrição publicava a etiqueta em texto.
    (metaContent(html, 'og:description')
      ? stripTags(metaContent(html, 'og:description') ?? '') || null
      : null) ??
    textFrom(html, ['.descricao', '.conteudo', '.entry-content', 'article p']);

  const datas = datasDoDetalhe(event, detail, html);

  if (datas.sessions.length === 0) log.warn('página de detalhe sem data legível', pageUrl);

  return {
    ...event,
    description: description ? description.slice(0, 20_000) : null,
    dates: datas.sessions,
    isOngoing: datas.isOngoing,
    venueName: event.venueName ?? detail?.venueName ?? null,
    locationAddress: event.locationAddress ?? detail?.locationAddress ?? null,
    latitude: event.latitude ?? detail?.latitude ?? null,
    longitude: event.longitude ?? detail?.longitude ?? null,
    priceRaw: event.priceRaw ?? detail?.priceRaw ?? null,
    isFree: event.isFree ?? detail?.isFree ?? null,
    ticketingUrl: event.ticketingUrl ?? detail?.ticketingUrl ?? null,
    imageUrl:
      event.imageUrl ?? detail?.imageUrl ?? absoluteUrl(pageUrl, metaContent(html, 'og:image')),
    categoriesRaw:
      event.categoriesRaw && event.categoriesRaw.length > 0
        ? event.categoriesRaw
        : (detail?.categoriesRaw ?? []),
  };
}

export const municipalCmsAdapter: Adapter = {
  id: 'municipal-cms',

  async fetchEvents(context: AdapterContext): Promise<RawEvent[]> {
    const { config, unknownKeys } = parseAdapterConfig(context.source.config);
    if (unknownKeys.length > 0) {
      context.log.warn('config com chaves que ninguém lê', unknownKeys.join(', '));
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

      for (const event of extractLayered(response.body, response.url, config, context.log)) {
        if (!collected.has(event.sourceKey)) collected.set(event.sourceKey, event);
      }
    }

    if (reached === 0) throw new Error('nenhuma página de listagem respondeu');

    const events = [...collected.values()];
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
