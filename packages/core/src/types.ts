/**
 * O contrato entre as três camadas.
 *
 * `RawEvent` é o que um adaptador de recolha devolve — camelCase, próximo do
 * que o site publica. `EventRow` é o que entra na base de dados — snake_case,
 * espelho exato das colunas. A fronteira entre os dois é o harmonizador, e é
 * de propósito que se nota: um adaptador nunca precisa de saber o esquema.
 */

export type EventStatus = 'draft' | 'published' | 'hidden' | 'cancelled' | 'postponed' | 'archived';

export type EventOrigin = 'scraper' | 'email' | 'form' | 'manual';

export type EventAudience =
  'all_ages' | 'family' | 'children' | 'youth' | 'adults' | 'seniors' | 'schools' | 'professionals';

export type SubmissionChannel = 'scraper' | 'email' | 'form';

export type SubmissionStatus =
  'pending' | 'approved' | 'rejected' | 'merged' | 'duplicate' | 'needs_info';

export type SourceKind = 'municipal_site' | 'venue_site' | 'pdf_agenda' | 'feed' | 'manual';

export type RunStatus = 'running' | 'success' | 'partial' | 'failed';

export type VenueKind =
  | 'theatre'
  | 'cinema'
  | 'museum'
  | 'library'
  | 'gallery'
  | 'cultural_centre'
  | 'auditorium'
  | 'bandstand'
  | 'heritage'
  | 'religious'
  | 'association'
  | 'market'
  | 'outdoor'
  | 'education'
  | 'other';

/** Uma ocorrência, tal como a fonte a publica. */
export interface RawSession {
  /** Data ISO `YYYY-MM-DD`. */
  date: string;
  /** Hora `HH:MM`, quando a fonte a dá. */
  startTime?: string | null;
  endTime?: string | null;
  /** Nome do espaço só desta sessão (itinerâncias). */
  venueOverride?: string | null;
  notes?: string | null;
}

/** O que um adaptador de recolha devolve. */
export interface RawEvent {
  /** Identificador do evento na fonte. Estável entre recolhas. */
  sourceKey: string;
  sourceUrl?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  dates: RawSession[];
  /** Nome do espaço em texto livre, como a fonte o escreve. */
  venueName?: string | null;
  /** Espaço já resolvido, quando a fonte é de um espaço só. */
  venueId?: string | null;
  /**
   * Concelho deste evento, quando a fonte cobre vários.
   *
   * As fontes de um concelho não o preenchem — o concelho vem da configuração
   * da fonte. Uma fonte regional (a programação em rede CAMINHOS) devolve um
   * `RawEvent` por concelho, cada um com o seu.
   */
  municipalityId?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  parish?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  howToArrive?: string | null;
  categoriesRaw?: string[];
  audienceRaw?: string | null;
  minAge?: number | null;
  /** Duração declarada pela fonte, em minutos, quando vem num campo próprio. */
  durationMinutes?: number | null;
  priceRaw?: string | null;
  isFree?: boolean | null;
  ticketingUrl?: string | null;
  imageUrl?: string | null;
  imageCredit?: string | null;
  accessibilityNotes?: string | null;
  seriesId?: string | null;
  isOngoing?: boolean | null;
  /** O registo original da fonte, guardado tal e qual. */
  payload?: Record<string, unknown> | null;
}

/** Uma linha de `public.events`. */
/**
 * Como se chegou à categoria de um evento (0138).
 *
 * As três primeiras são as vias do `resolveCategory`, por ordem de confiança;
 * `person` é alguém a decidir, e ganha sempre. `null` quando não há categoria —
 * «não consegui saber» não é uma via, é a ausência de uma.
 */
export type CategorySource = 'alias' | 'keyword' | 'venue_kind' | 'person' | null;

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  title_raw: string | null;
  subtitle: string | null;
  description: string | null;
  description_short: string | null;
  municipality_id: string;
  venue_id: string | null;
  location_name: string | null;
  location_address: string | null;
  parish: string | null;
  latitude: number | null;
  longitude: number | null;
  how_to_arrive: string | null;
  series_id: string | null;
  category_slug: string | null;
  category_confidence: number | null;
  /**
   * Como se chegou à categoria (0138). `person` não vem do `resolveCategory`:
   * é a base que o escreve quando alguém trava o campo, e é ela que ganha.
   */
  category_source: CategorySource;
  categories_raw: string[];
  tags: string[];
  audience: EventAudience | null;
  min_age: number | null;
  date_start: string | null;
  date_end: string | null;
  is_ongoing: boolean;
  recurrence: RecurrenceRule | null;
  duration_minutes: number | null;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  price_display: string | null;
  price_raw: string | null;
  ticketing_url: string | null;
  wheelchair_accessible: boolean | null;
  has_sign_language: boolean;
  has_audio_description: boolean;
  has_subtitles: boolean;
  is_relaxed_performance: boolean;
  accessibility_notes: string | null;
  image_url: string | null;
  image_credit: string | null;
  image_alt: string | null;
  /**
   * As medidas do cartaz, lidas do cabeçalho na recolha (migração 0126).
   *
   * Nulas é a resposta normal e não uma falha: um formato que não se lê, um
   * servidor que respondeu 503 nessa noite, um JPEG com EXIF grande de mais.
   * A ficha reserva a vitrine como sempre reservou quando não as tem.
   */
  image_width: number | null;
  image_height: number | null;
  status: EventStatus;
  origin: EventOrigin;
  confidence: number;
  source_id: string | null;
  source_key: string | null;
  source_url: string | null;
  submission_id: string | null;
  fingerprint: string;
  duplicate_group_id: string | null;
  is_canonical: boolean;
  content_hash: string | null;
  raw: Record<string, unknown> | null;
  published_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Uma linha de `public.event_sessions`. */
export interface SessionRow {
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  venue_id: string | null;
  location_override: string | null;
  is_cancelled: boolean;
  notes: string | null;
}

/**
 * Regra de recorrência, guardada por transparência.
 *
 * A base de dados guarda ocorrências, não regras: a recorrência é expandida
 * em sessões no momento da normalização. Guarda-se a regra para se poder
 * explicar ao editor de onde vieram vinte sessões — e para as reexpandir se
 * alguém corrigir a regra.
 */
export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  /** De 1 a 7, com 1 = segunda-feira (ISO). Só para `weekly`. */
  weekdays?: number[];
  /** Intervalo entre repetições (2 = de duas em duas semanas). */
  interval?: number;
  until: string;
  /** Datas ISO a excluir da expansão. */
  exceptions?: string[];
}

export interface MunicipalityRow {
  id: string;
  name: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
}

export interface VenueRow {
  id: string;
  name: string;
  municipality_id: string;
  parish: string | null;
  kind: VenueKind;
  is_association: boolean;
  latitude: number | null;
  longitude: number | null;
}
