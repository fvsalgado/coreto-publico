import { extractEmailAddress, eventFingerprint, todayInLisbon } from '@coreto/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/src/lib/env';
import { triageAttachments, type TriageResult } from '@/src/lib/intake/attachments';
import { MAX_EXTRACTION_ATTEMPTS, extractEvent, nextAttemptAt } from '@/src/lib/intake/extract';
import { readAttachmentText } from '@/src/lib/intake/ocr';
import { UNKNOWN_SENDER, checkExtractionQuota, recordQuotaUsage } from '@/src/lib/intake/quota';
import { resolveLocation, submissionConfidence } from '@/src/lib/intake/resolve';
import {
  createEmailSubmission,
  loadLookups,
  regiaoDoDestinatario,
  saveAttachments,
  setAttachmentOcr,
  updateSubmission,
} from '@/src/lib/intake/store';
import { plainTextOf, readInboundWebhook, webhookRejection } from '@/src/lib/intake/webhook';
import { hashIp } from '@/src/lib/ip';
import { checkRateLimit, tooManyRequests } from '@/src/lib/rate-limit';
import { reportarErro } from '@/src/lib/registo';
import { adminClient } from '@/src/lib/supabase/server';

/**
 * `POST /api/intake/email` — a caixa de correio da agenda.
 *
 * É este canal que traz a filarmónica, o rancho e a comissão de festas, que
 * não têm quem lhes faça o site e mandam um email com um cartaz em anexo. Tudo
 * o resto do desenho decorre daí:
 *
 * 1. **A submissão é criada antes de se tentar ler seja o que for.** Uma
 *    extração que rebente a meio custa um campo por preencher; um email
 *    perdido custa a programação de um mês, e ninguém a manda outra vez.
 * 2. **A um webhook válido responde-se sempre 200.** Um 500 faz o fornecedor
 *    voltar a entregar o mesmo email daí a pouco, e outra vez, e à terceira
 *    são três submissões iguais na fila. Os erros internos ficam escritos na
 *    própria submissão, que é onde uma pessoa os vai ler. As únicas exceções
 *    são anteriores à submissão existir — sem segredo, sem assinatura válida,
 *    sem corpo legível, ou sem base de dados onde escrever.
 * 3. **Nada disto publica.** A submissão entra em `pending` como todas as
 *    outras, e é uma pessoa que decide.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Dois patamares no mesmo balde, e uma só ida à base de dados.
 *
 * Acima do primeiro, o email continua a ser guardado — só não passa pela
 * extração, que é a parte que custa dinheiro. Acima do segundo já não é o
 * custo que está em causa mas a escrita em si: uma enxurrada enche a fila de
 * moderação, e aí a resposta certa é pedir ao fornecedor que abrande e volte
 * mais tarde, que é o que um 429 faz.
 */
const SENDER_HOURLY_LIMIT = 20;
const SENDER_HOURLY_CEILING = 100;

/** O suficiente para identificar um cliente; o resto não interessa a ninguém. */
const USER_AGENT_MAX_LENGTH = 300;

export async function POST(request: Request): Promise<Response> {
  const read = await readInboundWebhook(request, env.INBOUND_MAIL_SECRET);
  if (read.status !== 'ok') return webhookRejection(read);

  const { email } = read;
  const sender = extractEmailAddress(email.from);

  const traffic = await checkRateLimit(request, {
    route: 'intake:email',
    limit: SENDER_HOURLY_LIMIT,
    windowSeconds: 3600,
    // Sem remetente legível, o balde é o do endereço de onde veio o pedido —
    // que é o do fornecedor, e por isso um balde partilhado. É o mais apertado
    // que se consegue ser sem inventar uma identidade.
    key: sender ?? undefined,
  });
  if (traffic.hits > SENDER_HOURLY_CEILING) return tooManyRequests(traffic);

  const supabase = adminClient();
  if (!supabase) return unavailable();

  const text = plainTextOf(email);
  const triage = triageAttachments(email.attachments);

  const submissionId = await createEmailSubmission(supabase, {
    senderEmail: sender,
    senderName: displayNameOf(email.from),
    subject: email.subject,
    text,
    headers: notes(email.to, email.messageId, triage, []),
    ipHash: hashIp(request),
    userAgent: request.headers.get('user-agent')?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
  });
  if (!submissionId) return unavailable();

  try {
    await ingest(supabase, {
      submissionId,
      sender,
      subject: email.subject,
      text,
      to: email.to,
      messageId: email.messageId,
      triage,
      // Acima do primeiro patamar guarda-se na mesma, sem gastar extração.
      throttled: !traffic.allowed,
    });
  } catch (error) {
    // O email já está guardado. O que falhou fica escrito na submissão, e a
    // resposta continua a ser 200 — ver a nota no topo do ficheiro.
    reportarErro('POST /api/intake/email', error, { submissionId });
    await updateSubmission(supabase, submissionId, {
      extraction_status: 'failed',
      extraction_error: `erro interno ao tratar o email: ${messageOf(error)}`,
      next_attempt_at: null,
    });
  }

  return Response.json({ status: 'received', id: submissionId });
}

interface IngestContext {
  submissionId: string;
  sender: string | null;
  subject: string;
  text: string;
  to: string | undefined;
  messageId: string | undefined;
  triage: TriageResult;
  throttled: boolean;
}

/**
 * Anexos, leitura, resolução e extração — por esta ordem.
 *
 * Cada passo escreve o que conseguiu e segue. Nenhum deles pode fazer cair o
 * email, porque a essa altura o email já está guardado.
 */
async function ingest(supabase: SupabaseClient, context: IngestContext): Promise<void> {
  const { stored, failed } = await saveAttachments(
    supabase,
    context.submissionId,
    context.triage.accepted,
  );

  const attachmentTexts: string[] = [];
  for (const attachment of stored) {
    const outcome = readAttachmentText(attachment);
    await setAttachmentOcr(supabase, attachment.id, outcome);
    if (outcome.status === 'ok') attachmentTexts.push(outcome.text);
  }

  const fullText = [context.subject, context.text, ...attachmentTexts]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join('\n\n');

  const lookups = await loadLookups(supabase);

  // A região a quem o email foi dirigido — cada uma tem o seu endereço, e o
  // `to` é a única pista de região que um email traz. Fica na submissão como
  // pista de triagem e recorta a extração; a região definitiva continua a
  // ser a do concelho aprovado.
  const regiao = await regiaoDoDestinatario(supabase, context.to);
  const concelhosDaExtracao = regiao
    ? lookups.municipalities.filter((municipality) => municipality.region_id === regiao.id)
    : lookups.municipalities;

  // Resolve-se já com o que se sabe, antes de tentar extrair: se a extração
  // não chegar a correr, a moderação recebe na mesma o concelho preenchido.
  const early = resolveLocation({
    text: fullText,
    municipalities: concelhosDaExtracao,
    venueAliases: lookups.venueAliases,
    venueAliasesByMunicipality: lookups.venueAliasesByMunicipality,
  });

  const base = {
    raw_headers: notes(context.to, context.messageId, context.triage, failed),
    municipality_id: early.municipalityId,
    region_id: regiao?.id ?? null,
    venue_id: early.venueId,
  };

  const today = todayInLisbon();
  const quotaKey = context.sender ?? UNKNOWN_SENDER;
  await recordQuotaUsage(supabase, quotaKey, today, { submissions: 1 });

  if (context.throttled) {
    await updateSubmission(supabase, context.submissionId, {
      ...base,
      extraction_status: 'skipped',
      extraction_error: `limite de tráfego do remetente atingido (${SENDER_HOURLY_LIMIT} por hora)`,
    });
    return;
  }

  const quota = await checkExtractionQuota(supabase, quotaKey, today);
  if (!quota.allowed) {
    // A quota trava a extração, nunca a submissão: o email fica em bruto na
    // fila, com o motivo escrito, e alguém trata dele à mão.
    await updateSubmission(supabase, context.submissionId, {
      ...base,
      extraction_status: 'skipped',
      extraction_error: quota.reason,
    });
    return;
  }

  const outcome = await extractEvent({
    subject: context.subject,
    text: fullText,
    regiaoPorExtenso: regiao?.doNome ?? null,
    municipalities: concelhosDaExtracao,
    categories: lookups.categories,
    today,
  });

  if (outcome.status === 'skipped') {
    await updateSubmission(supabase, context.submissionId, {
      ...base,
      extraction_status: 'skipped',
      extraction_error: outcome.reason,
    });
    return;
  }

  if (outcome.status === 'failed') {
    const attempts = 1;
    await updateSubmission(supabase, context.submissionId, {
      ...base,
      extraction_status: 'failed',
      extraction_error: outcome.reason,
      extraction_attempts: attempts,
      next_attempt_at:
        outcome.retryable && attempts < MAX_EXTRACTION_ATTEMPTS ? nextAttemptAt(attempts) : null,
    });
    return;
  }

  await recordQuotaUsage(supabase, quotaKey, today, {
    extractions: 1,
    costMicros: outcome.costMicros,
  });

  // Segunda passagem, agora com o que a extração leu: um nome de espaço em
  // texto livre resolve-se por alias, e o concelho proposto confirma-se
  // contra a lista fechada.
  const resolved = resolveLocation({
    text: fullText,
    venueName: outcome.event.venueName,
    municipalityId: outcome.event.municipalityId,
    municipalities: concelhosDaExtracao,
    venueAliases: lookups.venueAliases,
    venueAliasesByMunicipality: lookups.venueAliasesByMunicipality,
  });

  const firstDate = outcome.event.dates[0]?.date ?? null;

  await updateSubmission(supabase, context.submissionId, {
    ...base,
    payload: { ...outcome.event },
    municipality_id: resolved.municipalityId,
    venue_id: resolved.venueId,
    fingerprint: eventFingerprint(outcome.event.title, firstDate, resolved.municipalityId),
    confidence: submissionConfidence({
      declared: outcome.event.confidence,
      hasDate: firstDate !== null,
      hasMunicipality: resolved.municipalityId !== null,
    }),
    /*
     * O que o texto de origem não confirma vai marcado, e nunca recusado.
     *
     * A proposta fica inteira: alguém modera à mão de qualquer maneira, e
     * deitar fora o resto por causa de um campo suspeito trocava uma linha por
     * confirmar por um formulário em branco — a troca que este canal existe
     * para evitar.
     *
     * E não se marca nova tentativa: repetir a mesma chamada sobre o mesmo
     * texto gasta o orçamento diário para dar exactamente o mesmo. Não é falha
     * transitória; é uma leitura que precisa de olhos.
     */
    extraction_status: outcome.naoVerificados.length > 0 ? 'unverified' : 'ok',
    extraction_error:
      outcome.naoVerificados.length > 0
        ? `o texto não confirma: ${outcome.naoVerificados.join(', ')}`
        : null,
    extraction_model: outcome.model,
    extraction_cost_micros: outcome.costMicros,
    extraction_attempts: 1,
    next_attempt_at: null,
  });
}

/**
 * O que se guarda dos cabeçalhos: o mínimo para reconhecer o email.
 *
 * `to` distingue os endereços de entrada quando houver mais do que um, e o
 * `messageId` é o que permite a quem modera casar uma submissão com o email
 * na caixa. Os anexos recusados ficam aqui porque é a única maneira de a
 * moderação saber que veio um ficheiro e não ficou nada dele.
 */
function notes(
  to: string | undefined,
  messageId: string | undefined,
  triage: TriageResult,
  failed: ReadonlyArray<{ filename: string; reason: string }>,
): Record<string, unknown> {
  return {
    to: to ?? null,
    messageId: messageId ?? null,
    rejectedAttachments: triage.rejected,
    failedAttachments: failed,
  };
}

/** «Banda Filarmónica <geral@filarmonica.pt>» → «Banda Filarmónica». */
function displayNameOf(from: string): string | null {
  const match = /^\s*"?([^"<]*?)"?\s*</.exec(from);
  const name = match?.[1]?.trim() ?? '';
  return name.length > 0 ? name.slice(0, 120) : null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 503, e não 200, quando não há onde guardar.
 *
 * É a única falha interna que se devolve ao fornecedor, e é de propósito: um
 * 200 aqui diria «recebido» a um email que não ficou em lado nenhum. Um 503
 * com `Retry-After` faz com que ele volte a entregar quando isto estiver de
 * pé — que é exatamente o que se quer.
 */
function unavailable(): Response {
  return Response.json(
    { error: 'canal de entrada temporariamente indisponível' },
    { status: 503, headers: { 'Retry-After': '900' } },
  );
}
