import type { CategorySource } from '@coreto/core';

import type { EventAudience, VenueKind } from '@coreto/core';

/** Um evento tal como aparece num cartão de listagem. */
export interface EventCard {
  id: string;
  slug: string;
  title: string;
  description_short: string | null;
  municipality_id: string;
  venue_id: string | null;
  location_name: string | null;
  category_slug: string | null;
  /**
   * O quanto se confia na categoria, e de onde ela veio (0138).
   *
   * Viajam no cartão porque o `/api/events` serve o cartão; **o cartão não as
   * desenha**. A ficha é que o faz: abaixo de 0,7 escreve «provavelmente», e
   * diz porquê. `person` ganha sempre, e vem com 1,0.
   */
  category_confidence: number | null;
  category_source: CategorySource;
  date_start: string | null;
  date_end: string | null;
  /**
   * O evento é um período e não um compromisso: uma exposição patente, uma
   * época balnear, uma temporada em cartaz.
   *
   * Está no cartão e não só na ficha porque é o que distingue duas sessões que
   * são dois concertos de duas sessões que são a abertura e o encerramento de
   * uma exposição. Sem ele, o calendário escrevia dois compromissos para o que
   * é um período só — e quem o subscrevesse ficava com o dia de abrir e o dia
   * de fechar marcados na agenda, e os quatro meses do meio em branco.
   */
  is_ongoing: boolean;
  is_free: boolean;
  price_display: string | null;
  image_url: string | null;
  image_alt: string | null;
  /**
   * Dá para entrar numa cadeira de rodas?
   *
   * Vem da coluna derivada `wheelchair_accessible_resolved` (0129) por alias
   * — o do evento quando ele o declara, o do espaço quando ele se cala. É a
   * mesma regra que a ficha aplicava em TypeScript, e é agora a única: cartão,
   * filtro e ficha leem a mesma resposta. O nome não muda porque o campo é
   * publicado (`/api/events`, documentado em `/levar`).
   */
  wheelchair_accessible: boolean | null;
  has_sign_language: boolean;
  has_audio_description: boolean;
  has_subtitles: boolean;
  is_relaxed_performance: boolean;
  audience: EventAudience | null;
}

/**
 * Um evento visto do mapa: onde é, quando, e para onde se vai a partir dali.
 *
 * As coordenadas são as do próprio evento, que quase nunca existem — quem as
 * tem é o espaço. Ficam aqui porque quando existem são as melhores: a API de
 * Ourém dá o ponto do evento, e esse é mais fino do que o do equipamento.
 */
export interface EventPoint {
  id: string;
  slug: string;
  title: string;
  municipality_id: string;
  venue_id: string | null;
  location_name: string | null;
  date_start: string | null;
  date_end: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  image_alt: string | null;
  category_slug: string | null;
  source_url: string | null;
}

export interface EventSession {
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  location_override: string | null;
  is_cancelled: boolean;
  notes: string | null;
}

export interface EventDetail extends EventCard {
  /** `published` ou `archived` — ver `DETAIL_EVENT_FIELDS` e a migração 0132. */
  status: string;
  subtitle: string | null;
  description: string | null;
  location_address: string | null;
  parish: string | null;
  latitude: number | null;
  longitude: number | null;
  how_to_arrive: string | null;
  series_id: string | null;
  tags: string[];
  min_age: number | null;
  duration_minutes: number | null;
  price_min: number | null;
  price_max: number | null;
  price_raw: string | null;
  ticketing_url: string | null;
  has_sign_language: boolean;
  has_audio_description: boolean;
  has_subtitles: boolean;
  is_relaxed_performance: boolean;
  accessibility_notes: string | null;
  image_credit: string | null;
  /**
   * As medidas do cartaz, quando a recolha as conseguiu ler (migração 0126).
   *
   * Nulas é o caso normal e não uma falha — um formato que não se lê, um
   * servidor em baixo na noite da recolha, um cartaz que chegou por submissão.
   * A vitrine da ficha reserva altura mínima quando não as tem, e reserva a
   * caixa exacta quando as tem.
   */
  image_width: number | null;
  image_height: number | null;
  origin: string;
  source_url: string | null;
  updated_at: string;
  sessions: EventSession[];
}

export interface Municipality {
  id: string;
  name: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  sort_order: number;
  /**
   * Quantas freguesias tem o concelho (0136), ou `null` enquanto ninguém as
   * tiver contado. É o denominador de «X das Y juntas já publicam na agenda
   * regional» — e o nulo é a diferença entre «este concelho não tem juntas
   * ligadas» e «ninguém contou as freguesias deste concelho».
   */
  parish_count: number | null;
}

export interface Venue {
  id: string;
  name: string;
  municipality_id: string;
  parish: string | null;
  kind: VenueKind;
  status: string;
  is_association: boolean;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  how_to_arrive: string | null;
  website_url: string | null;
  wheelchair_accessible: boolean | null;
  accessibility_notes: string | null;
  image_url: string | null;
  /** Apresentação editorial do espaço. As notas internas não saem da moderação. */
  description: string | null;
}

export interface Coreto {
  id: string;
  name: string;
  parish: string | null;
  municipality_id: string;
  latitude: number | null;
  longitude: number | null;
  year_built: number | null;
  is_confirmed: boolean;
  venue_id: string | null;
  photo_url: string | null;
  photo_credit: string | null;
  description: string | null;
}

export interface Category {
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface Series {
  id: string;
  name: string;
  kind: string;
  municipality_id: string | null;
  description: string | null;
  website_url: string | null;
  is_regional: boolean;
}

/**
 * Um evento visto da página do seu ciclo.
 *
 * Traz `status` porque um ciclo tem passado: os dez espetáculos do CAMINHOS
 * estão arquivados por já terem acontecido, e é justamente isso que a página
 * mostra. Um evento arquivado não tem ficha no Coreto — daí o `source_url`,
 * que é para onde se manda quem quiser saber mais.
 */
export interface SeriesEvent extends EventCard {
  status: string;
  source_url: string | null;
  series_id: string | null;
}

/**
 * Uma fonte, vista de fora.
 *
 * Só as colunas que a 0049 abriu à chave pública: a apresentação, não o
 * caderno. `config`, `notes` e `last_error` ficam do lado de dentro e nem
 * sequer são pedidos.
 */
export interface PublicSource {
  id: string;
  name: string;
  kind: string;
  /** O leitor que sabe ler esta fonte (0139). O `config` dele não é público. */
  adapter: string | null;
  municipality_id: string | null;
  /** A região de uma fonte sem concelho; nula quando o concelho a deriva. */
  region_id: string | null;
  venue_id: string | null;
  url: string;
  is_enabled: boolean;
  last_success_at: string | null;
  /** Quando foi tentada, com ou sem sucesso. */
  last_run_at: string | null;
  /** Até quando está calada por decisão, e não por avaria (0159). */
  pausada_ate: string | null;
  /** Porquê — obrigatório enquanto a pausa durar. */
  pausa_motivo: string | null;
  public_note: string | null;
}
