/**
 * Harmonizador: evento em bruto → evento canónico + sessões.
 *
 * É aqui que a fronteira entre «o que o site publicou» e «o que a base de
 * dados guarda» é atravessada, uma vez, para todas as fontes. Um adaptador
 * que resolva um campo ganha sempre — isto só preenche onde a fonte se calou.
 */

import { extractAccessibility, parseAudience, parseDurationMinutes } from './accessibility';
import { parsePortugueseTimeRange, saneEndTime, type TimeRange } from './dates';
import { contentHash, eventFingerprint, eventSlug } from './fingerprint';
import { formatPrice, parsePrice } from './price';
import { resolveCategory } from './taxonomy';
import {
  cleanEventDescription,
  normalizeForHash,
  normalizeTitle,
  truncate,
  unescapeHtml,
} from './text';
import type { EventRow, RawEvent, SessionRow } from './types';

export interface HarmonizeContext {
  municipalityId: string;
  sourceId: string | null;
  /** Alias normalizado → slug de categoria. */
  categoryAliases: ReadonlyMap<string, string>;
  /** Alias normalizado → id de espaço. Os que valem em toda a região. */
  venueAliases: ReadonlyMap<string, string>;
  /**
   * Concelho → (alias normalizado → id de espaço).
   *
   * Os alias presos a um concelho, que é onde vive a resposta para um nome
   * que se repete na região. Ganham ao regional, e só ao seu concelho se
   * aplicam. Ver `resolveVenueInMunicipality`.
   */
  venueAliasesByMunicipality?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /**
   * Concelho de cada espaço.
   *
   * Existe para uma coisa só: impedir que um nome que se repete na região
   * case com o espaço do concelho errado. Ver `resolveVenueInMunicipality`.
   */
  venueMunicipalities?: ReadonlyMap<string, string>;
  /** Tipo de cada espaço, para a classificação de último recurso. */
  venueKinds?: ReadonlyMap<string, string>;
  /** Espaço a assumir quando a fonte é de um espaço só. */
  defaultVenueId?: string | null;
  /** Identificador determinístico. Injetável para os testes serem estáveis. */
  makeId: (raw: RawEvent) => string;
  now?: () => string;
}

export interface HarmonizedEvent {
  event: EventRow;
  sessions: SessionRow[];
  unknownTags: string[];
  unresolvedVenueName: string | null;
}

/** Resolve o nome de um espaço em texto livre para um id do catálogo. */
export function resolveVenue(
  venueName: string | null | undefined,
  aliases: ReadonlyMap<string, string>,
): string | null {
  if (!venueName) return null;
  return aliases.get(normalizeForHash(venueName)) ?? null;
}

/**
 * O mesmo, mas resolvendo dentro do concelho e recusando o que lhe é externo.
 *
 * Há nomes que se repetem na região. «Casa da Cultura» é um deles: há uma em
 * Ferreira do Zêzere, que se chama assim e mais nada, e há a Casa Municipal
 * da Cultura de Alcanena, a quem lá se chama o mesmo. Um evento do CAMINHOS
 * em Alcanena, num cartaz que dizia só o nome curto, ia parar ao espaço do
 * outro concelho e ficava lá: com a morada errada, as coordenadas erradas e
 * um ponto no mapa a cinquenta quilómetros de onde a peça se fez.
 *
 * Isto resolve-se em duas passagens, por esta ordem:
 *
 * 1. **O alias preso a este concelho.** É a linha de `venue_aliases` com
 *    `municipality_id` preenchido, e foi escrita exatamente para desfazer
 *    esta ambiguidade. Ganha sempre — quem a escreveu já respondeu à
 *    pergunta.
 * 2. **O alias regional**, com a recusa de sempre: um espaço só casa se ficar
 *    no concelho do evento. Quando o concelho do evento é conhecido e o do
 *    espaço também, e são diferentes, não se resolve — o nome vai para
 *    `unresolved_venues`, onde alguém lhe dá o alias certo uma vez e todas as
 *    recolhas seguintes ficam a saber.
 *
 * O `venueId` que um adaptador escreve à mão e o `defaultVenueId` de uma fonte
 * de espaço só passam pela mesma peneira — ver `espacoDesteConcelho`. Não
 * passavam: o comentário que aqui estava dizia que quem nomeia um id sabe o
 * que faz. Sabe, e continua a saber; o que mudou é que a base deixou de
 * aceitar a contradição (0130), e uma recusa nossa com o nome a ir parar aos
 * espaços por resolver é mais útil do que uma recusa do Postgres a meio de uma
 * recolha.
 */
export function resolveVenueInMunicipality(
  venueName: string | null | undefined,
  municipalityId: string | null,
  catalogo: Pick<
    HarmonizeContext,
    'venueAliases' | 'venueMunicipalities' | 'venueAliasesByMunicipality'
  >,
): string | null {
  if (!venueName) return null;

  if (municipalityId !== null) {
    const doConcelho = catalogo.venueAliasesByMunicipality
      ?.get(municipalityId)
      ?.get(normalizeForHash(venueName));
    if (doConcelho !== undefined) return doConcelho;
  }

  const venueId = resolveVenue(venueName, catalogo.venueAliases);
  if (venueId === null || municipalityId === null) return venueId;

  const doEspaco = catalogo.venueMunicipalities?.get(venueId);
  // Sem concelho conhecido para o espaço não há contradição — há silêncio, e
  // o silêncio não é razão para recusar o que já casava.
  if (doEspaco === undefined || doEspaco === municipalityId) return venueId;
  return null;
}

/**
 * Um espaço nomeado só serve se for do concelho do evento.
 *
 * Vale para o id que um adaptador escreve e para o espaço de uma fonte de
 * espaço só. A recusa é do espaço e não do evento: o nome cai em
 * `unresolved_venues`, onde alguém lhe dá o alias certo uma vez, e o evento
 * fica com o local em texto livre — que é o mesmo caminho que um nome sem
 * alias já percorria.
 *
 * O silêncio não é contradição: um espaço sem concelho conhecido passa, como
 * passa em `resolveVenueInMunicipality`.
 */
function espacoDesteConcelho(
  venueId: string | null | undefined,
  context: Pick<HarmonizeContext, 'municipalityId' | 'venueMunicipalities'>,
): string | null {
  if (!venueId) return null;
  if (context.municipalityId === null) return venueId;
  const doEspaco = context.venueMunicipalities?.get(venueId);
  if (doEspaco === undefined || doEspaco === context.municipalityId) return venueId;
  return null;
}

interface PrecoDecidido {
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  price_display: string | null;
}

/**
 * As quatro colunas do preço saem de uma decisão só.
 *
 * Saíam de duas. O `is_free` vinha de `parsePrice`; o `price_display` vinha de
 * `formatPrice`, que tinha uma regra sua para declarar gratuitidade. Dois
 * juízes independentes sobre a mesma pergunta, a escrever na mesma linha da
 * base — e um par «`price_display` = 'Entrada livre'» com «`is_free` = false»
 * é um evento que aparece grátis no cartão e fora do filtro dos grátis.
 *
 * Aqui a gratuitidade decide-se uma vez, e o rótulo segue-a: quando é grátis
 * diz-se «Entrada livre», quando não é o rótulo nunca o pode dizer por conta
 * própria. Cai para a cadeia da fonte, que é o que ela escreveu.
 */
function decidirPreco(raw: RawEvent, description: string | null): PrecoDecidido {
  const lido = parsePrice(raw.priceRaw, description);
  const livre = raw.isFree ?? lido.isFree ?? false;
  return {
    is_free: livre,
    price_min: lido.priceMin ?? null,
    price_max: lido.priceMax ?? null,
    price_display: livre
      ? 'Entrada livre'
      : formatPrice({ priceMin: lido.priceMin, priceMax: lido.priceMax }, raw.priceRaw ?? null),
  };
}

export function harmonizeEvent(raw: RawEvent, context: HarmonizeContext): HarmonizedEvent {
  const now = (context.now ?? (() => new Date().toISOString()))();
  const id = context.makeId(raw);

  const title = normalizeTitle(raw.title);
  const subtitle = unescapeHtml(raw.subtitle ?? null);
  const description = cleanEventDescription(title, unescapeHtml(raw.description ?? null));

  const sessions = buildSessions(raw);
  const dateStart = sessions[0]?.session_date ?? null;
  const dateEnd = sessions.length > 0 ? sessions[sessions.length - 1]!.session_date : null;

  const venueId =
    espacoDesteConcelho(raw.venueId, context) ??
    resolveVenueInMunicipality(raw.venueName, context.municipalityId, context) ??
    espacoDesteConcelho(context.defaultVenueId, context) ??
    null;
  const unresolvedVenueName = venueId === null ? (raw.venueName ?? null) : null;

  const category = resolveCategory({
    aliases: context.categoryAliases,
    rawTags: raw.categoriesRaw ?? [],
    title,
    description,
    venueKind: venueId ? (context.venueKinds?.get(venueId) ?? null) : null,
  });

  const price = decidirPreco(raw, description);
  const accessibility = extractAccessibility(title, subtitle, description, raw.accessibilityNotes);
  const audience = parseAudience(raw.audienceRaw, title, description);

  // Um evento tem de dizer onde é. Sem espaço resolvido, o nome que a fonte
  // escreveu passa a local livre — perder o sítio era pior do que guardá-lo
  // por normalizar.
  const locationName = raw.locationName ?? (venueId === null ? (raw.venueName ?? null) : null);

  const event: EventRow = {
    id,
    slug: eventSlug(title, id),
    title,
    title_raw: raw.title === title ? null : raw.title,
    subtitle: subtitle ?? null,
    description: description ?? null,
    description_short: truncate(description, 400),
    municipality_id: context.municipalityId,
    venue_id: venueId,
    location_name: locationName,
    location_address: raw.locationAddress ?? null,
    parish: raw.parish ?? null,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    how_to_arrive: raw.howToArrive ?? null,
    series_id: raw.seriesId ?? null,
    category_slug: category.categorySlug,
    category_confidence: category.categorySlug ? category.confidence : null,
    categories_raw: raw.categoriesRaw ?? [],
    tags: [],
    audience: audience.audience ?? null,
    min_age: raw.minAge ?? audience.min_age ?? null,
    date_start: dateStart,
    date_end: dateEnd,
    is_ongoing: raw.isOngoing ?? false,
    recurrence: null,
    duration_minutes:
      raw.durationMinutes ?? parseDurationMinutes(description, raw.accessibilityNotes),
    is_free: price.is_free,
    price_min: price.price_min,
    price_max: price.price_max,
    price_display: price.price_display,
    price_raw: raw.priceRaw ?? null,
    ticketing_url: raw.ticketingUrl ?? null,
    wheelchair_accessible: accessibility.wheelchair_accessible ?? null,
    has_sign_language: accessibility.has_sign_language,
    has_audio_description: accessibility.has_audio_description,
    has_subtitles: accessibility.has_subtitles,
    is_relaxed_performance: accessibility.is_relaxed_performance,
    accessibility_notes: raw.accessibilityNotes ?? null,
    image_url: raw.imageUrl ?? null,
    image_credit: raw.imageCredit ?? null,
    image_alt: raw.imageUrl ? title : null,
    /*
     * O harmonizador não mede cartazes, e não é por esquecimento.
     *
     * É código puro: recebe o que a fonte publicou e devolve o que se escreve,
     * sem ir à rede nem à base. Medir uma imagem obriga a ir buscá-la, e uma
     * função pura que faz um pedido HTTP deixa de se poder testar sem uma
     * fonte a responder. Quem mede é a recolha, que já está na rede e sabe
     * quando é que vale a pena — só quando o endereço é novo. Aqui, nulo.
     */
    image_width: null,
    image_height: null,
    status: 'draft',
    origin: 'scraper',
    confidence: scoreConfidence(raw, { venueId, category: category.categorySlug, sessions }),
    source_id: context.sourceId,
    source_key: raw.sourceKey,
    source_url: raw.sourceUrl ?? null,
    submission_id: null,
    fingerprint: eventFingerprint(title, dateStart, context.municipalityId),
    duplicate_group_id: null,
    is_canonical: true,
    content_hash: contentHash([title, description, dateStart, venueId, raw.priceRaw]),
    raw: raw.payload ?? null,
    published_at: null,
    last_seen_at: now,
    created_at: now,
    updated_at: now,
  };

  return {
    event,
    sessions,
    unknownTags: category.unknownTags,
    unresolvedVenueName,
  };
}

/**
 * A hora que o texto do evento afirma — uma vez, e sem ambiguidade.
 *
 * Um adaptador que resolva a hora ganha sempre; isto só preenche onde a fonte
 * se calou no campo próprio e falou na prosa. E falou mesmo: «Inauguração: 15
 * de julho | 18h30», «entre as 10h00 e as 13h00» são factos que a câmara
 * escreveu, e lê-los é extrair, não inventar. À data em que isto se escreveu,
 * 22 dos 108 eventos publicados por vir não tinham hora em sessão nenhuma, e
 * numa boa parte deles a hora estava no texto, à vista de quem lesse.
 *
 * Duas horas são outra coisa. «Sábados às 19h30 e domingos às 10h00» não diz
 * a que horas é a sessão de sábado 12 — diz duas coisas, e escolher uma delas
 * era adivinhar. Fica por resolver, que é o que a moderação existe para
 * fazer: `parsePortugueseTimeRange` devolve `null` nesse caso, e é esse
 * `null` que aqui se respeita.
 */
function horaDaProsa(raw: RawEvent): TimeRange | null {
  if (!raw.dates.some((session) => session.date && !session.startTime)) return null;
  return parsePortugueseTimeRange(raw.description);
}

function buildSessions(raw: RawEvent): SessionRow[] {
  const seen = new Set<string>();
  const out: SessionRow[] = [];

  const daProsa = horaDaProsa(raw);
  // Num período — uma exposição patente de X a Y — as sessões são os dois
  // extremos, e a prosa fala do dia de abrir: «inauguração às 18h30» é um
  // facto sobre o primeiro dia e nenhum sobre o último. Só o primeiro a recebe.
  const primeiraData = raw.isOngoing
    ? (raw.dates
        .map((session) => session.date)
        .filter(Boolean)
        .sort()[0] ?? null)
    : null;

  for (const session of raw.dates) {
    if (!session.date) continue;

    // As notas da própria sessão primeiro; a prosa do evento só depois, e só
    // para quem não tem hora — o adaptador que a deu ganha sempre.
    const lida = session.startTime
      ? null
      : (parsePortugueseTimeRange(session.notes) ??
        (primeiraData === null || session.date === primeiraData ? daProsa : null));
    const startTime = session.startTime ?? lida?.start ?? null;
    // Um fim antes do início só fica se atravessar a meia-noite; o resto é a
    // hora da matiné deixada na linha da noite. Ver `saneEndTime`.
    const endTime = saneEndTime(startTime, session.endTime ?? lida?.end ?? null);

    const key = `${session.date}|${startTime ?? ''}|${session.venueOverride ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      session_date: session.date,
      start_time: startTime,
      end_time: endTime,
      venue_id: null,
      location_override: session.venueOverride ?? null,
      is_cancelled: false,
      notes: session.notes ?? null,
    });
  }

  return out.sort((a, b) => {
    if (a.session_date !== b.session_date) return a.session_date < b.session_date ? -1 : 1;
    return (a.start_time ?? '').localeCompare(b.start_time ?? '');
  });
}

/**
 * Score de confiança [0,1].
 *
 * Não é uma medida de qualidade editorial: é «o quanto se pode publicar isto
 * sem alguém confirmar». Um evento sem data não chega a 0,5 e por isso nunca
 * passa sozinho pela fila de moderação.
 */
function scoreConfidence(
  raw: RawEvent,
  resolved: { venueId: string | null; category: string | null; sessions: SessionRow[] },
): number {
  let score = 0.4;
  if (resolved.sessions.length > 0) score += 0.2;
  if (resolved.sessions.some((session) => session.start_time)) score += 0.05;
  if (resolved.venueId) score += 0.15;
  if (resolved.category) score += 0.1;
  if ((raw.description ?? '').length > 120) score += 0.05;
  if (raw.imageUrl) score += 0.05;
  return Math.min(1, Number(score.toFixed(3)));
}
