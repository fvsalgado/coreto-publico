/**
 * Schemas de validação.
 *
 * Regra da casa: nada que venha de fora entra sem passar por aqui — resposta
 * de um site, corpo de um email, submissão de um formulário, saída de uma
 * extração automática. O que não valida não entra; e o que não entra fica
 * guardado em bruto para alguém ver.
 */

import { z } from 'zod';
import { isValidIsoDate } from './dates';

const isoDate = z
  .string()
  .refine(isValidIsoDate, { message: 'data tem de ser AAAA-MM-DD e existir no calendário' });

const isoTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'hora tem de ser HH:MM');

const httpUrl = z
  .string()
  .max(2048)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), { message: 'apenas http(s)' });

export const rawSessionSchema = z.object({
  date: isoDate,
  startTime: isoTime.nullish(),
  endTime: isoTime.nullish(),
  venueOverride: z.string().max(200).nullish(),
  notes: z.string().max(500).nullish(),
});

export const rawEventSchema = z.object({
  sourceKey: z.string().min(1).max(300),
  sourceUrl: httpUrl.nullish(),
  title: z.string().min(2).max(300),
  subtitle: z.string().max(300).nullish(),
  description: z.string().max(20_000).nullish(),
  dates: z.array(rawSessionSchema).max(400),
  venueName: z.string().max(200).nullish(),
  venueId: z.string().max(120).nullish(),
  municipalityId: z.string().max(120).nullish(),
  locationName: z.string().max(200).nullish(),
  locationAddress: z.string().max(300).nullish(),
  parish: z.string().max(120).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  howToArrive: z.string().max(1000).nullish(),
  categoriesRaw: z.array(z.string().max(120)).max(20).optional(),
  audienceRaw: z.string().max(200).nullish(),
  minAge: z.number().int().min(0).max(21).nullish(),
  durationMinutes: z.number().int().min(1).max(1440).nullish(),
  priceRaw: z.string().max(500).nullish(),
  isFree: z.boolean().nullish(),
  ticketingUrl: httpUrl.nullish(),
  imageUrl: httpUrl.nullish(),
  imageCredit: z.string().max(200).nullish(),
  accessibilityNotes: z.string().max(2000).nullish(),
  seriesId: z.string().max(120).nullish(),
  isOngoing: z.boolean().nullish(),
  // O Zod 4 exige o tipo da chave por extenso; o 3 deixava-o implícito.
  payload: z.record(z.string(), z.unknown()).nullish(),
});

export type RawEventInput = z.infer<typeof rawEventSchema>;

/**
 * Formulário público — mínimo, sem conta.
 *
 * `website` é uma armadilha para robôs: um campo escondido no HTML que uma
 * pessoa nunca preenche. Vindo preenchido, a submissão é aceite com um 200
 * e deitada fora — dizer «apanhei-te» só ensina o robô a contornar.
 */
const publicSubmissionFields = z.object({
  title: z.string().trim().min(3, 'O título é obrigatório.').max(200),
  description: z.string().trim().max(5000).optional().default(''),
  municipalityId: z.string().min(1, 'Escolhe o concelho.').max(80),
  venueId: z.string().max(120).optional(),
  locationName: z.string().trim().max(200).optional().default(''),
  startDate: isoDate,
  endDate: isoDate.optional(),
  startTime: isoTime.optional(),
  categorySlug: z.string().max(80).optional(),
  isFree: z.boolean().optional().default(false),
  priceRaw: z.string().trim().max(200).optional().default(''),
  ticketingUrl: httpUrl.optional().or(z.literal('')),
  sourceUrl: httpUrl.optional().or(z.literal('')),
  contactName: z.string().trim().max(120).optional().default(''),
  contactEmail: z.string().email('Endereço de email inválido.').max(200),
  organisation: z.string().trim().max(200).optional().default(''),
  accessibilityNotes: z.string().trim().max(1000).optional().default(''),
  howToArrive: z.string().trim().max(1000).optional().default(''),
  consent: z.literal(true, {
    error: 'É preciso aceitar a política de privacidade.',
  }),
  website: z.string().max(0).optional(),
});

export const publicSubmissionSchema = publicSubmissionFields
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: 'A data de fim não pode ser anterior à de início.',
    path: ['endDate'],
  })
  .refine((data) => Boolean(data.venueId) || data.locationName.trim().length > 0, {
    message: 'Indica o espaço ou escreve o local.',
    path: ['locationName'],
  });

export type PublicSubmission = z.infer<typeof publicSubmissionSchema>;

/**
 * Saída da extração automática de um email, PDF ou cartaz.
 *
 * Tudo é opcional exceto o título: um extractor que devolva metade dos campos
 * é útil — o que não pode é devolver campos inventados. `confidence` é a
 * própria extração a declarar o quanto está segura, e entra no score do
 * evento.
 */
export const extractedEventSchema = z.object({
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(5000).nullish(),
  municipalityId: z.string().max(80).nullish(),
  venueName: z.string().max(200).nullish(),
  locationName: z.string().max(200).nullish(),
  parish: z.string().max(120).nullish(),
  dates: z
    .array(z.object({ date: isoDate, startTime: isoTime.nullish() }))
    .max(60)
    .default([]),
  categorySlug: z.string().max(80).nullish(),
  audienceRaw: z.string().max(200).nullish(),
  isFree: z.boolean().nullish(),
  priceRaw: z.string().max(200).nullish(),
  ticketingUrl: httpUrl.nullish(),
  accessibilityNotes: z.string().max(1000).nullish(),
  organiser: z.string().max(200).nullish(),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ExtractedEvent = z.infer<typeof extractedEventSchema>;

/** Anexo de um email recebido. */
export const inboundAttachmentSchema = z.object({
  filename: z.string().max(300).default('anexo'),
  contentType: z.string().max(150).default('application/octet-stream'),
  /** Conteúdo em base64. O limite de tamanho é imposto antes de chegar aqui. */
  content: z.string(),
});

/** Corpo do webhook de email recebido. */
export const inboundEmailSchema = z.object({
  from: z.string().max(320),
  to: z.string().max(320).optional(),
  subject: z.string().max(500).default(''),
  text: z.string().max(200_000).default(''),
  html: z.string().max(500_000).optional(),
  messageId: z.string().max(500).optional(),
  attachments: z.array(inboundAttachmentSchema).max(10).default([]),
});

export type InboundEmail = z.infer<typeof inboundEmailSchema>;

/** Filtros das listagens públicas. Também valida os parâmetros do widget. */
export const eventFilterSchema = z.object({
  municipality: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  free: z.coerce.boolean().optional(),
  /*
   * Os eixos da acessibilidade, um filtro cada.
   *
   * `accessible` é o acesso a cadeiras de rodas e tinha o nome de todos —
   * ficou com o dele por já viver em endereços partilhados e em favoritos de
   * quem os guardou. Os outros quatro são os que o `extractAccessibility` já
   * lê da prosa e que a base já guarda em colunas próprias: língua gestual,
   * audiodescrição, legendagem, sessão relaxada.
   *
   * Quem precisa de audiodescrição para decidir se sai de casa não faz a
   * mesma pergunta de quem precisa de uma rampa, e até aqui a agenda só sabia
   * responder à segunda.
   */
  accessible: z.coerce.boolean().optional(),
  lgp: z.coerce.boolean().optional(),
  audiodescricao: z.coerce.boolean().optional(),
  legendas: z.coerce.boolean().optional(),
  relaxada: z.coerce.boolean().optional(),
  venue: z.string().max(120).optional(),
  series: z.string().max(120).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(200).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export type EventFilter = z.infer<typeof eventFilterSchema>;

/** Extrai o email nu de um cabeçalho `From` («Nome <a@b.pt>»). */
export function extractEmailAddress(from: string): string | null {
  const angled = from.match(/<([^>]+)>/);
  const candidate = (angled?.[1] ?? from).trim().toLowerCase();
  return z.string().email().safeParse(candidate).success ? candidate : null;
}
