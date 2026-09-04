import { reportarErro } from '../registo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';

/**
 * Travas de custo da extração automática.
 *
 * Três travas, por ordem de dureza: um remetente bloqueado à mão, a quota
 * diária de cada remetente e o orçamento diário de toda a casa. Qualquer uma
 * delas trava a **extração** — nenhuma delas recusa a **submissão**. O email
 * fica guardado em bruto, com o motivo escrito na própria linha, e alguém o
 * trata à mão. Perder um anexo é um contratempo; perder o email é perder a
 * programação de uma coletividade.
 *
 * O dia é o dia de Lisboa e não o dia UTC. Em julho, à meia-noite e meia de
 * Lisboa, o UTC ainda está no dia anterior: com o dia errado, uma quota
 * reiniciava-se uma hora depois da meia-noite e o orçamento diário contava
 * duas noites como uma.
 *
 * Sem `server-only`: este módulo não vai buscar cliente nenhum — recebe-o de
 * quem o chama. É isso que permite exercitar a decisão sem base de dados.
 */

/**
 * Remetente que não se conseguiu ler do cabeçalho `From`.
 *
 * Continua a gastar quota, com esta chave, por duas razões: o custo tem de
 * entrar no orçamento diário (senão bastava estragar o `From` para o
 * contornar) e uma enxurrada anónima tem de travar como qualquer outra. Os
 * parênteses garantem que nunca colide com um endereço a sério.
 */
export const UNKNOWN_SENDER = '(remetente por identificar)';

export interface QuotaLimits {
  /** Extrações por remetente e por dia. Zero desliga a extração. */
  senderDailyLimit: number;
  /** Gasto máximo do dia, em milionésimos de euro. Zero desliga a extração. */
  dailyBudgetMicros: number;
}

/** O que a base de dados sabe sobre este remetente, hoje. */
export interface QuotaState {
  isBlocked: boolean;
  blockReason: string | null;
  /** Extrações já feitas hoje por este remetente. */
  senderExtractions: number;
  /** Gasto de toda a casa hoje, em milionésimos de euro. */
  dayCostMicros: number;
}

export type QuotaDecision = { allowed: true } | { allowed: false; reason: string };

/** Estado de quem nunca cá apareceu — e o que se assume quando a leitura falha. */
export const EMPTY_QUOTA_STATE: QuotaState = {
  isBlocked: false,
  blockReason: null,
  senderExtractions: 0,
  dayCostMicros: 0,
};

export function quotaLimitsFromEnv(): QuotaLimits {
  return {
    senderDailyLimit: env.EXTRACTION_SENDER_DAILY_LIMIT,
    dailyBudgetMicros: env.EXTRACTION_DAILY_BUDGET_MICROS,
  };
}

/**
 * A decisão, sem I/O: dá para exercitar com uma tabela de casos.
 *
 * O motivo é escrito para ser lido por quem modera, e vai tal e qual para
 * `submissions.extraction_error`. «skipped» sem motivo é indistinguível de um
 * canal avariado.
 */
export function decideExtraction(state: QuotaState, limits: QuotaLimits): QuotaDecision {
  if (state.isBlocked) {
    const reason = state.blockReason?.trim();
    return {
      allowed: false,
      reason: reason ? `remetente bloqueado: ${reason}` : 'remetente bloqueado',
    };
  }

  // Um limite a zero é a maneira de desligar a extração sem tirar a chave:
  // o canal continua a receber e a guardar, e nada é gasto.
  if (limits.senderDailyLimit <= 0 || limits.dailyBudgetMicros <= 0) {
    return { allowed: false, reason: 'extração automática desligada na configuração' };
  }

  if (state.senderExtractions >= limits.senderDailyLimit) {
    return {
      allowed: false,
      reason: `quota diária do remetente esgotada (${limits.senderDailyLimit} extrações)`,
    };
  }

  if (state.dayCostMicros >= limits.dailyBudgetMicros) {
    return { allowed: false, reason: 'orçamento diário de extração esgotado' };
  }

  return { allowed: true };
}

interface QuotaStateRow {
  blocked: boolean | null;
  block_note: string | null;
  sender_extractions: number | null;
  day_cost_micros: number | string | null;
}

/**
 * O estado da quota numa só ida à base de dados.
 *
 * A função `extraction_quota_state` também trata da viragem do dia: uma linha
 * de ontem conta como zero, em vez de bloquear hoje com as contas de ontem.
 */
export async function readQuotaState(
  supabase: SupabaseClient,
  sender: string,
  today: string,
): Promise<QuotaState> {
  const { data, error } = await supabase.rpc('extraction_quota_state', {
    p_sender: sender,
    p_day: today,
  });

  if (error) {
    // Sem leitura da quota não se gasta: a trava falha fechada, ao contrário
    // do limitador de tráfego. Enganar-se a gastar dinheiro é pior do que
    // enganar-se a não gastar — e a submissão fica guardada de qualquer modo.
    reportarErro('extraction_quota_state', error);
    return { ...EMPTY_QUOTA_STATE, isBlocked: true, blockReason: 'quota indisponível' };
  }

  const row = (Array.isArray(data) ? data[0] : data) as QuotaStateRow | null | undefined;
  if (!row) return EMPTY_QUOTA_STATE;

  return {
    isBlocked: row.blocked ?? false,
    blockReason: row.block_note,
    senderExtractions: row.sender_extractions ?? 0,
    // `bigint` chega como cadeia sempre que não cabe num número de JavaScript.
    dayCostMicros: Number(row.day_cost_micros ?? 0),
  };
}

/**
 * Regista o que este email consumiu.
 *
 * Uma linha por remetente, sem histórico: para travar custo basta saber o dia
 * corrente, e guardar quem manda o quê ao longo do tempo seria guardar mais
 * do que é preciso.
 */
export async function recordQuotaUsage(
  supabase: SupabaseClient,
  sender: string,
  today: string,
  usage: { submissions?: number; extractions?: number; costMicros?: number },
): Promise<void> {
  const { error } = await supabase.rpc('sender_quota_record', {
    p_sender: sender,
    p_day: today,
    p_submissions: usage.submissions ?? 0,
    p_extractions: usage.extractions ?? 0,
    p_cost_micros: usage.costMicros ?? 0,
  });
  // Falhar a contabilidade não pode fazer cair um email que já está guardado.
  if (error) reportarErro('sender_quota_record', error);
}

/** Lê o estado e decide, com os limites da configuração. */
export async function checkExtractionQuota(
  supabase: SupabaseClient,
  sender: string,
  today: string,
): Promise<QuotaDecision> {
  const state = await readQuotaState(supabase, sender, today);
  return decideExtraction(state, quotaLimitsFromEnv());
}
