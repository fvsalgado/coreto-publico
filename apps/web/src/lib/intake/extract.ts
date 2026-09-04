import 'server-only';
import { extractedEventSchema, type ExtractedEvent } from '@coreto/core';
import { env } from '../env';

/**
 * Extração estruturada de um evento a partir de texto solto.
 *
 * O que chega por email é o que uma coletividade escreve a um vizinho: um
 * parágrafo, uma data no meio de uma frase, às vezes só um cartaz em anexo.
 * Isto tenta ler daí um evento.
 *
 * Três invariantes, por esta ordem de importância:
 *
 * 1. **Nada disto publica.** A saída é uma proposta que entra na fila de
 *    moderação, e é uma pessoa que decide.
 * 2. **Degrada para o manual.** Sem chave configurada, sem orçamento ou com a
 *    quota do remetente esgotada, a submissão fica em bruto e alguém trata
 *    dela à mão. Foi assim que a implementação de referência decidiu fazer
 *    isto por inteiro; aqui é o caminho de degradação, e continua a ser um
 *    caminho que funciona.
 * 3. **Campo em falta é `null`, nunca inventado.** Uma data errada leva
 *    alguém a uma porta fechada.
 */

export type ExtractionOutcome =
  | { status: 'ok'; event: ExtractedEvent; model: string; costMicros: number }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string; retryable: boolean };

export interface ExtractionInput {
  /**
   * «do Médio Tejo», «da Travessia do Zêzere» — a região a quem o email foi
   * dirigido, quando o destinatário a denuncia. Nula quando não se sabe: o
   * prompt fala então de «uma agenda cultural regional», que é a verdade.
   */
  regiaoPorExtenso?: string | null;
  subject: string;
  text: string;
  /** Nomes e slugs dos concelhos, para a extração escolher de uma lista fechada. */
  municipalities: ReadonlyArray<{ id: string; name: string }>;
  categories: ReadonlyArray<{ slug: string; name: string }>;
  /** Data de referência para resolver «sábado» ou «dia 12». */
  today: string;
}

/** Tempo máximo de espera. Um webhook não pode ficar pendurado. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Tentativas antes de desistir e deixar em bruto. */
export const MAX_EXTRACTION_ATTEMPTS = 5;

/**
 * Recuo exponencial entre tentativas, em minutos: 2, 4, 8, 16, 32.
 *
 * Com tecto: uma fonte em baixo não vale uma espera de dias, e ao fim da
 * quinta tentativa desiste-se de vez.
 */
export function nextAttemptDelayMinutes(attempts: number): number {
  return Math.min(2 ** Math.max(1, attempts), 60);
}

export function nextAttemptAt(attempts: number, now = Date.now()): string {
  return new Date(now + nextAttemptDelayMinutes(attempts) * 60_000).toISOString();
}

function buildPrompt(input: ExtractionInput): string {
  const municipalities = input.municipalities
    .map((municipality) => `${municipality.id} (${municipality.name})`)
    .join(', ');
  const categories = input.categories
    .map((category) => `${category.slug} (${category.name})`)
    .join(', ');

  const quem = input.regiaoPorExtenso
    ? `És um assistente de catalogação de uma agenda cultural ${input.regiaoPorExtenso}, em Portugal.`
    : 'És um assistente de catalogação de uma agenda cultural regional, em Portugal.';

  return [
    quem,
    'Lê a mensagem abaixo e devolve UM objeto JSON com o evento que ela anuncia.',
    '',
    'Regras:',
    '- Devolve APENAS JSON, sem texto à volta e sem blocos de código.',
    '- Nunca inventes. Um campo que a mensagem não diga fica a null.',
    '- Datas no formato AAAA-MM-DD e horas em HH:MM (24 horas).',
    `- Hoje é ${input.today}. Resolve datas relativas a partir daí.`,
    `- municipalityId tem de ser um destes ou null: ${municipalities}.`,
    `- categorySlug tem de ser um destes ou null: ${categories}.`,
    '- confidence entre 0 e 1: o quanto tens a certeza de que leste bem.',
    '',
    'Campos: title, description, municipalityId, venueName, locationName, parish,',
    'dates (lista de {date, startTime}), categorySlug, audienceRaw, isFree, priceRaw,',
    'ticketingUrl, accessibilityNotes, organiser, confidence.',
    '',
    `Assunto: ${input.subject}`,
    '',
    'Mensagem:',
    input.text.slice(0, 12_000),
  ].join('\n');
}

/**
 * Custo estimado, em milionésimos de euro.
 *
 * Estimado e não medido: nem todas as respostas trazem contagem de tokens. O
 * valor serve para travar o gasto diário, não para faturar — e uma estimativa
 * que trava é melhor do que uma medição exata que chega tarde.
 */
function estimateCostMicros(inputTokens: number, outputTokens: number): number {
  const INPUT_MICROS_PER_1K = 800;
  const OUTPUT_MICROS_PER_1K = 4000;
  return Math.round(
    (inputTokens / 1000) * INPUT_MICROS_PER_1K + (outputTokens / 1000) * OUTPUT_MICROS_PER_1K,
  );
}

interface ApiResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

/** Retira o JSON de uma resposta que possa vir embrulhada em texto ou cercas. */
export function extractJsonObject(raw: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  const body = fenced?.[1] ?? raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  return body.slice(start, end + 1);
}

export async function extractEvent(input: ExtractionInput): Promise<ExtractionOutcome> {
  if (!env.EXTRACTION_API_KEY) {
    return { status: 'skipped', reason: 'sem chave de extração configurada' };
  }
  if (input.text.trim().length < 20) {
    return { status: 'skipped', reason: 'mensagem curta de mais para ler' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.EXTRACTION_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.EXTRACTION_MODEL,
        max_tokens: 1500,
        temperature: 0,
        messages: [{ role: 'user', content: buildPrompt(input) }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // 429 e 5xx passam; um 400 é um pedido mal feito e repeti-lo não ajuda.
      const retryable = response.status === 429 || response.status >= 500;
      return { status: 'failed', reason: `HTTP ${response.status}`, retryable };
    }

    const payload = (await response.json()) as ApiResponse;
    const text = payload.content?.find((part) => part.type === 'text')?.text ?? '';
    const json = extractJsonObject(text);
    if (!json) {
      return { status: 'failed', reason: 'resposta sem JSON legível', retryable: false };
    }

    const parsed = extractedEventSchema.safeParse(JSON.parse(json));
    if (!parsed.success) {
      // Saída fora do schema nunca é escrita. Repetir raramente ajuda: o
      // problema costuma estar na mensagem, não na chamada.
      return {
        status: 'failed',
        reason: `saída inválida: ${parsed.error.issues[0]?.message ?? 'schema'}`,
        retryable: false,
      };
    }

    return {
      status: 'ok',
      event: parsed.data,
      model: env.EXTRACTION_MODEL,
      costMicros: estimateCostMicros(
        payload.usage?.input_tokens ?? 0,
        payload.usage?.output_tokens ?? 0,
      ),
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      status: 'failed',
      reason: aborted ? 'tempo esgotado' : String(error),
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
  }
}
