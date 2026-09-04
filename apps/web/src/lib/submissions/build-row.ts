import {
  eventFingerprint,
  extractAccessibility,
  formatPrice,
  normalizeTitle,
  parseAudience,
  parseDurationMinutes,
  parsePrice,
  resolveCategory,
  truncate,
  type EventRow,
  type PublicSubmission,
  type SessionRow,
} from '@coreto/core';

/**
 * Formulário validado → linha de `public.submissions`.
 *
 * Pura de propósito. É aqui que se decide o que fica guardado de uma
 * submissão pública, e uma peça que decide isso tem de poder ser exercitada
 * sem base de dados, sem pedido HTTP e sem relógio. O que precisa de I/O — o
 * limite de tráfego, a verificação do concelho, a escrita — fica em
 * `intake.ts`.
 */

/**
 * O candidato a evento, no formato em que `public.approve_submission` o
 * espera receber de volta.
 *
 * Nomes e tipos vêm de `EventRow` por construção: a moderação lê este objeto,
 * corrige-o e devolve-o à função de aprovação como `p_event`. Se as colunas
 * mudarem, isto deixa de compilar — que é exatamente o momento em que se quer
 * dar por isso.
 */
export type EventCandidate = Pick<
  EventRow,
  | 'title'
  | 'title_raw'
  | 'description'
  | 'description_short'
  | 'municipality_id'
  | 'venue_id'
  | 'location_name'
  | 'how_to_arrive'
  | 'category_slug'
  | 'category_confidence'
  | 'date_start'
  | 'date_end'
  | 'is_ongoing'
  | 'duration_minutes'
  | 'audience'
  | 'min_age'
  | 'is_free'
  | 'price_min'
  | 'price_max'
  | 'price_display'
  | 'price_raw'
  | 'ticketing_url'
  | 'source_url'
  | 'wheelchair_accessible'
  | 'has_sign_language'
  | 'has_audio_description'
  | 'has_subtitles'
  | 'is_relaxed_performance'
  | 'accessibility_notes'
  | 'origin'
  | 'fingerprint'
> & {
  /** As ocorrências, prontas para `p_sessions`. */
  sessions: SessionRow[];
};

/** Uma linha por escrever em `public.submissions`. */
export interface SubmissionRow {
  channel: 'form';
  status: 'pending';
  payload: EventCandidate;
  municipality_id: string;
  venue_id: string | null;
  fingerprint: string;
  confidence: number;
  sender_email: string;
  sender_name: string | null;
  sender_organisation: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  raw_subject: string;
  extraction_status: 'skipped';
}

/** O que se sabe do pedido, e não do evento. */
export interface SubmissionMeta {
  /** Hash com sal do endereço, nunca o endereço. `null` sem sal configurado. */
  ipHash: string | null;
  /** Útil para distinguir abuso de uso. Mais nada é registado. */
  userAgent: string | null;
}

export type BuiltSubmission = { outcome: 'discard' } | { outcome: 'store'; row: SubmissionRow };

/**
 * Confiança de uma submissão humana identificada.
 *
 * Não é uma nota de qualidade: é «o quanto isto se aproxima de estar pronto a
 * publicar». Fica acima da recolha automática — houve uma pessoa a escrever e
 * um email a que se pode responder — e bem abaixo do 0,9 de quem edita a
 * agenda por dentro, porque metade dos campos vem escrita à mão e é
 * exatamente aí que aparecem o ano errado na data e o espaço que não existe
 * no catálogo. 0,6 é o número que mantém isto sempre na fila de moderação.
 */
export const FORM_CONFIDENCE = 0.6;

/** Comprimento do resumo, igual ao do harmonizador da recolha. */
const SHORT_DESCRIPTION_LENGTH = 400;

function nullIfBlank(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * As ocorrências de uma submissão.
 *
 * Um dia só é uma sessão. Um intervalo — «de X a Y» — é um período, e um
 * período guarda-se como os dois extremos mais `is_ongoing`, nunca como um
 * dia por cada dia lá pelo meio. É a regra de `docs/ARQUITETURA.md` («um
 * intervalo não é uma lista») e é o que a recolha faz desde a 0114 — ver
 * `sessionsForRange`, no adaptador `municipal-cms`, e a ficha pública, que
 * lê `is_ongoing` primeiro e escreve «em cartaz de X a Y».
 *
 * Isto expandia um fim de semana em três sessões e só acima de 45 dias
 * guardava os extremos. Era o pior dos dois mundos: a exposição de três
 * semanas entrava com vinte e uma sessões que ninguém afirmou, e um festival
 * «de sexta a domingo» com três, quando o que a pessoa escreveu foi um
 * intervalo. O formulário não tem forma de dar dias soltos — tem um início,
 * um fim e uma hora, e mais nada —, por isso o que aqui chega como intervalo
 * é sempre um período. Se um dia o schema ganhar uma lista de datas, essa
 * lista é que dá uma sessão por dia, e não isto.
 *
 * A hora vai nos dois extremos, como em `sessionsForRange`: é a hora que a
 * pessoa declarou para o evento, e não uma leitura da prosa que só se
 * pudesse atribuir ao dia de abrir.
 */
function buildSessions(input: PublicSubmission): {
  sessions: SessionRow[];
  dateEnd: string | null;
  isOngoing: boolean;
} {
  const startTime = input.startTime ?? null;
  const session = (date: string): SessionRow => ({
    session_date: date,
    start_time: startTime,
    end_time: null,
    venue_id: null,
    location_override: null,
    is_cancelled: false,
    notes: null,
  });

  // Um fim igual ao início é um dia só; um fim anterior o schema já recusou,
  // e esta função não confia em quem a chama. A comparação é de cadeias, e
  // chega: as duas são `AAAA-MM-DD`.
  const end = input.endDate;
  if (!end || end <= input.startDate) {
    return { sessions: [session(input.startDate)], dateEnd: null, isOngoing: false };
  }

  return { sessions: [session(input.startDate), session(end)], dateEnd: end, isOngoing: true };
}

export function buildSubmissionRow(input: PublicSubmission, meta: SubmissionMeta): BuiltSubmission {
  // Última porta antes da escrita. A receção já deitou fora o que caiu na
  // armadilha, mas esta função não confia em quem a chama: é a única coisa
  // entre um robô e uma linha na fila de moderação.
  if ((input.website ?? '').trim().length > 0) return { outcome: 'discard' };

  const title = normalizeTitle(input.title);
  const description = nullIfBlank(input.description);
  const accessibilityNotes = nullIfBlank(input.accessibilityNotes);
  const priceRaw = nullIfBlank(input.priceRaw);
  const venueId = nullIfBlank(input.venueId);

  const { sessions, dateEnd, isOngoing } = buildSessions(input);

  // O preço lê-se do que a pessoa escreveu na caixa do preço e mais nada: a
  // descrição de um evento pago menciona «entrada livre para sócios» vezes
  // que cheguem para não valer a pena arriscar.
  const price = parsePrice(priceRaw);
  const isFree = input.isFree || price.isFree === true;

  const accessibility = extractAccessibility(title, description, accessibilityNotes);
  const audience = parseAudience(title, description);

  // Sem aliases: quem submete escolhe a categoria numa lista fechada, e
  // quando a deixa em branco só as palavras inequívocas do título decidem.
  const category = input.categorySlug
    ? { categorySlug: input.categorySlug, confidence: 1 }
    : resolveCategory({ aliases: new Map(), title, description });

  const fingerprint = eventFingerprint(title, input.startDate, input.municipalityId);

  const payload: EventCandidate = {
    title,
    title_raw: input.title === title ? null : input.title,
    description,
    description_short: truncate(description, SHORT_DESCRIPTION_LENGTH),
    municipality_id: input.municipalityId,
    venue_id: venueId,
    // Sem espaço do catálogo, o que a pessoa escreveu passa a local livre.
    location_name: nullIfBlank(input.locationName),
    how_to_arrive: nullIfBlank(input.howToArrive),
    category_slug: category.categorySlug,
    category_confidence: category.categorySlug ? category.confidence : null,
    date_start: input.startDate,
    date_end: dateEnd,
    is_ongoing: isOngoing,
    duration_minutes: parseDurationMinutes(description),
    audience: audience.audience ?? null,
    min_age: audience.min_age ?? null,
    is_free: isFree,
    price_min: isFree ? 0 : (price.priceMin ?? null),
    price_max: isFree ? null : (price.priceMax ?? null),
    price_display: isFree ? 'Entrada livre' : formatPrice(price, priceRaw),
    price_raw: priceRaw,
    ticketing_url: nullIfBlank(input.ticketingUrl),
    source_url: nullIfBlank(input.sourceUrl),
    wheelchair_accessible: accessibility.wheelchair_accessible ?? null,
    has_sign_language: accessibility.has_sign_language,
    has_audio_description: accessibility.has_audio_description,
    has_subtitles: accessibility.has_subtitles,
    is_relaxed_performance: accessibility.is_relaxed_performance,
    accessibility_notes: accessibilityNotes,
    origin: 'form',
    fingerprint,
    sessions,
  };

  return {
    outcome: 'store',
    row: {
      channel: 'form',
      status: 'pending',
      payload,
      municipality_id: input.municipalityId,
      venue_id: venueId,
      fingerprint,
      confidence: FORM_CONFIDENCE,
      sender_email: input.contactEmail.trim().toLowerCase(),
      sender_name: nullIfBlank(input.contactName),
      sender_organisation: nullIfBlank(input.organisation),
      ip_hash: meta.ipHash,
      user_agent: meta.userAgent,
      // A fila de moderação mostra uma coluna só, venha a submissão de um
      // email ou deste formulário. Sem isto, as linhas do formulário
      // apareciam sem assunto no meio das outras.
      raw_subject: title,
      // Não há nada para extrair: o formulário já entrega os campos.
      extraction_status: 'skipped',
    },
  };
}
