import 'server-only';
import { reportarErro } from '../registo';
import type { ZodIssue } from 'zod';
import { publicSubmissionSchema } from '@coreto/core';
import { hashIp } from '../ip';
import { checkRateLimit, type RateLimitResult } from '../rate-limit';
import { listCategories, listMunicipalitiesDeTodas, listVenuesDeTodas } from '../queries/events';
import { exigirRegiao } from '../queries/regioes';
import { REGIAO_PRINCIPAL } from '../regiao-host';
import { adminClient } from '../supabase/server';
import { buildSubmissionRow } from './build-row';

/**
 * O vocabulário de campos de uma submissão, na ordem por que se reportam.
 *
 * Viveu em `form.ts` enquanto houve formulário; o formulário saiu (o envio
 * público é por email) e o vocabulário ficou aqui, porque quem o usa são os
 * canais que restam — a rota JSON e o email.
 */
export const SUBMIT_FIELD_NAMES = [
  'title',
  'description',
  'categorySlug',
  'startDate',
  'endDate',
  'startTime',
  'municipalityId',
  'venueId',
  'locationName',
  'howToArrive',
  'isFree',
  'priceRaw',
  'ticketingUrl',
  'sourceUrl',
  'accessibilityNotes',
  'contactName',
  'contactEmail',
  'organisation',
  'consent',
] as const;

export type SubmitFieldName = (typeof SUBMIT_FIELD_NAMES)[number];

/**
 * A armadilha para robôs.
 *
 * Chama-se `website` porque é o nome que um preenchedor automático procura.
 * Vem preenchida, a submissão é aceite com sucesso aparente e deitada fora —
 * dizer «apanhei-te» só ensina o robô a contornar.
 */
export const HONEYPOT_FIELD = 'website';

/** `true` quando a caixa foi marcada, venha de JSON ou de um formulário. */
export function isChecked(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'on' || normalized === 'true' || normalized === '1';
}

/**
 * Receção de uma submissão pública.
 *
 * Houve aqui dois pontos de entrada — a Server Action do formulário e a rota
 * `POST /api/submissions`. O formulário saiu e a porta pública passou a ser o
 * email; ficou a rota, para quem tem os eventos noutro sistema. O caminho
 * continua a ser um só, e é o que garante que uma submissão vinda de fora
 * gasta o mesmo balde de tráfego e escreve a mesma linha que qualquer outra.
 *
 * Nada aqui publica. Uma submissão fica sempre em `pending` e é uma pessoa
 * que decide — é essa a única razão de a fila existir.
 */

/** Uma pessoa a corrigir o formulário não é abuso; um robô a repetir é. */
const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 20;

/** O suficiente para identificar um cliente; o resto não interessa a ninguém. */
const USER_AGENT_MAX_LENGTH = 300;

export type IntakeOutcome =
  /** Recebida — ou apanhada na armadilha, que dá o mesmo por fora. */
  | { kind: 'accepted' }
  | { kind: 'invalid'; message: string; fieldErrors: Partial<Record<SubmitFieldName, string>> }
  | { kind: 'rate_limited'; message: string; rateLimit: RateLimitResult }
  | { kind: 'unavailable'; message: string }
  | { kind: 'failed'; message: string };

/** Lê um campo, venha de um formulário ou de um corpo JSON. */
export type FieldReader = (name: string) => string;

export function formDataReader(form: FormData): FieldReader {
  return (name) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  };
}

export function jsonReader(body: Record<string, unknown>): FieldReader {
  return (name) => {
    const value = body[name];
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value ? 'on' : '';
    return '';
  };
}

const BOOLEAN_FIELDS = new Set<string>(['isFree', 'consent']);

/**
 * Campos que seguem sempre, mesmo vazios.
 *
 * Um campo obrigatório em branco tem de chegar ao schema como cadeia vazia
 * para dar a mensagem que se escreveu para ele; se fosse omitido, o Zod
 * responderia «Required», que não ajuda ninguém.
 */
const ALWAYS_SENT = new Set<string>(['title', 'municipalityId', 'startDate', 'contactEmail']);

/** O que veio escrito, para devolver ao formulário quando há erros. */
export function readSubmittedValues(read: FieldReader): Partial<Record<SubmitFieldName, string>> {
  const values: Partial<Record<SubmitFieldName, string>> = {};
  for (const name of SUBMIT_FIELD_NAMES) {
    const value = read(name).trim();
    if (value.length > 0) values[name] = value;
  }
  return values;
}

function toCandidate(read: FieldReader): Record<string, unknown> {
  const candidate: Record<string, unknown> = {};
  for (const name of SUBMIT_FIELD_NAMES) {
    const value = read(name).trim();
    if (BOOLEAN_FIELDS.has(name)) {
      candidate[name] = isChecked(value);
    } else if (value.length > 0 || ALWAYS_SENT.has(name)) {
      candidate[name] = value;
    }
  }
  return candidate;
}

/** Campos onde um erro de formato só pode ser um endereço mal escrito. */
const URL_FIELDS = new Set<string>(['ticketingUrl', 'sourceUrl']);

const URL_MESSAGE = 'Tem de ser um endereço completo, a começar por https://.';

/**
 * Mensagens do schema partilhado que ficam telegráficas à frente de um campo.
 *
 * O `publicSubmissionSchema` também valida o que a recolha e a extração
 * produzem, e aí uma mensagem curta e técnica é a certa — vai para um registo,
 * não para uma pessoa. Aqui vai para uma pessoa que está a preencher um
 * formulário no telemóvel, e a diferença nota-se. Se o núcleo mudar o texto, o
 * original volta a passar: perde-se o afinamento, não se perde a mensagem.
 */
const REPHRASED: Record<string, string> = {
  'data tem de ser AAAA-MM-DD e existir no calendário':
    'Indica uma data no formato AAAA-MM-DD — por exemplo, 2027-01-01.',
  'hora tem de ser HH:MM': 'Indica a hora no formato HH:MM — por exemplo, 21:30.',
};

/**
 * Mensagem em português para um problema de validação.
 *
 * Nem todas as regras do schema trazem mensagem própria, e as que não trazem
 * caem no texto por omissão do Zod, que é inglês. Um «Invalid url» à frente de
 * um campo é o género de coisa que faz uma pessoa fechar a página.
 */
function translateIssue(issue: ZodIssue): string {
  const field = typeof issue.path[0] === 'string' ? issue.path[0] : '';

  const rephrased = REPHRASED[issue.message];
  if (rephrased) return rephrased;

  if (URL_FIELDS.has(field) && issue.code !== 'too_big') return URL_MESSAGE;

  switch (issue.code) {
    case 'too_big':
      return typeof issue.maximum === 'number'
        ? `Não pode passar dos ${issue.maximum} caracteres.`
        : 'Texto demasiado longo.';
    case 'invalid_string':
      return issue.validation === 'url' ? URL_MESSAGE : issue.message;
    case 'invalid_type':
      return issue.received === 'undefined' ? 'Falta preencher este campo.' : issue.message;
    default:
      return issue.message;
  }
}

/**
 * Primeiro erro de cada campo, indexado pelo nome do campo.
 *
 * Percorre os campos do formulário e não os problemas do validador: assim, um
 * problema num campo que o formulário não mostra — a armadilha, por exemplo —
 * nunca chega a aparecer no ecrã de ninguém.
 */
function fieldErrorsFrom(issues: readonly ZodIssue[]): Partial<Record<SubmitFieldName, string>> {
  const errors: Partial<Record<SubmitFieldName, string>> = {};
  for (const name of SUBMIT_FIELD_NAMES) {
    const issue = issues.find((candidate) => candidate.path[0] === name);
    if (issue) errors[name] = translateIssue(issue);
  }
  return errors;
}

export async function receiveSubmission(
  request: Request,
  read: FieldReader,
): Promise<IntakeOutcome> {
  // A armadilha decide-se antes de tudo o resto: preenchida, não há nada a
  // validar, nada a limitar e nada a escrever.
  if (read(HONEYPOT_FIELD).trim().length > 0) return { kind: 'accepted' };

  const supabase = adminClient();
  if (!supabase) {
    // Fingir que se recebeu era pior do que dizer que não dá: quem submete
    // ficava à espera de uma publicação que nunca ia acontecer.
    return {
      kind: 'unavailable',
      message: 'O envio de eventos está temporariamente indisponível. Tenta mais tarde.',
    };
  }

  const parsed = publicSubmissionSchema.safeParse(toCandidate(read));
  if (!parsed.success) {
    return {
      kind: 'invalid',
      message: 'Falta corrigir alguns campos antes de enviar.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }
  const input = parsed.data;

  const referential = await checkReferences(
    input.municipalityId,
    input.venueId,
    input.categorySlug,
  );
  if (referential) {
    return {
      kind: 'invalid',
      message: 'Falta corrigir alguns campos antes de enviar.',
      fieldErrors: referential,
    };
  }

  // O balde só é gasto por uma submissão que já está pronta a escrever. Quem
  // se engana três vezes num campo não fica sem quota por isso.
  const limited = await enforceRateLimits(request);
  if (limited) return limited;

  const built = buildSubmissionRow(input, {
    ipHash: hashIp(request),
    userAgent: request.headers.get('user-agent')?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
  });
  if (built.outcome === 'discard') return { kind: 'accepted' };

  // A submissão herda a região do concelho escolhido — o canal JSON, ao
  // contrário do email, traz sempre um concelho válido (checkReferences), e
  // o concelho sabe de que região é.
  const concelhos = await listMunicipalitiesDeTodas();
  const regiaoDoConcelho =
    concelhos.find((municipality) => municipality.id === input.municipalityId)?.region_id ?? null;

  const { error } = await supabase
    .from('submissions')
    .insert({ ...built.row, region_id: regiaoDoConcelho });
  if (error) {
    reportarErro('receiveSubmission', error);
    return {
      kind: 'failed',
      message: 'Não foi possível guardar a submissão. Tenta outra vez daqui a pouco.',
    };
  }

  return { kind: 'accepted' };
}

/**
 * Concelho, espaço e categoria têm de existir mesmo.
 *
 * As três colunas são chaves estrangeiras: sem esta verificação, um valor
 * inventado num pedido direto à rota rebentava no `insert` e devolvia um erro
 * de servidor por aquilo que é, afinal, um campo mal preenchido. E o espaço
 * tem de ser do concelho escolhido — a lista mostra todos, agrupados, e é
 * fácil escolher o teatro do concelho ao lado.
 */
async function checkReferences(
  municipalityId: string,
  venueId: string | undefined,
  categorySlug: string | undefined,
): Promise<Partial<Record<SubmitFieldName, string>> | null> {
  const [municipalities, venues, categories] = await Promise.all([
    listMunicipalitiesDeTodas(),
    listVenuesDeTodas(),
    listCategories(),
  ]);

  const errors: Partial<Record<SubmitFieldName, string>> = {};

  if (!municipalities.some((municipality) => municipality.id === municipalityId)) {
    errors.municipalityId = 'Escolhe um dos concelhos da lista.';
  }

  if (venueId) {
    const venue = venues.find((candidate) => candidate.id === venueId);
    if (!venue) errors.venueId = 'Esse espaço não está no catálogo. Escreve antes o local.';
    else if (venue.municipality_id !== municipalityId) {
      errors.venueId = 'Esse espaço é de outro concelho.';
    }
  }

  if (categorySlug && !categories.some((category) => category.slug === categorySlug)) {
    errors.categorySlug = 'Escolhe uma das categorias da lista.';
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Dois baldes por endereço: um à hora e outro ao dia.
 *
 * O da hora trava a rajada, o do dia trava a insistência. Um só balde não
 * chega para os dois casos — cinco à hora deixaria passar cento e vinte por
 * dia, e vinte ao dia não travaria vinte no mesmo minuto.
 */
async function enforceRateLimits(request: Request): Promise<IntakeOutcome | null> {
  const hourly = await checkRateLimit(request, {
    route: 'submissions:hourly',
    limit: HOURLY_LIMIT,
    windowSeconds: 3600,
  });
  // O contacto da mensagem é o da região principal: o intake é um só para
  // todas as regiões até a fase 5 lhe dar região própria.
  if (!hourly.allowed) return rateLimited(hourly, (await exigirRegiao(REGIAO_PRINCIPAL)).email);

  const daily = await checkRateLimit(request, {
    route: 'submissions:daily',
    limit: DAILY_LIMIT,
    windowSeconds: 86_400,
  });
  if (!daily.allowed) return rateLimited(daily, (await exigirRegiao(REGIAO_PRINCIPAL)).email);

  return null;
}

function rateLimited(rateLimit: RateLimitResult, email: string): IntakeOutcome {
  return {
    kind: 'rate_limited',
    message:
      'Já recebemos vários eventos deste sítio há pouco. Tenta daqui a algum tempo — ou escreve ' +
      `para ${email} se tiveres muitos eventos para enviar de uma vez.`,
    rateLimit,
  };
}
