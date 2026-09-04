/**
 * Quando um evento desaparece da fonte.
 *
 * Um evento cancelado ou retirado do site tem de sair do Coreto — deixá-lo lá
 * leva alguém a uma porta fechada. Mas retirar depressa de mais é pior: uma
 * falha de rede que devolve uma lista vazia «com sucesso» é indistinguível,
 * do lado de cá, de uma câmara que retirou toda a agenda. Reconciliar sobre
 * isso apaga a programação de um concelho inteiro em três noites, sem
 * ninguém dar por nada.
 *
 * Daí esta trava: antes de contar faltas, verifica-se se a recolha rendeu o
 * suficiente para se poder acreditar nela. Está aqui, e não em SQL, para
 * poder ser testada sem base de dados — é a decisão com mais consequências de
 * toda a recolha.
 */

/** Abaixo desta fração do catálogo, a recolha não é de confiança. */
export const LOW_YIELD_RATIO = 0.3;

/**
 * Catálogos pequenos não usam a razão.
 *
 * Numa fonte com três eventos, ver um só é normal — a agenda mudou. Aplicar a
 * razão a catálogos pequenos congelava-os para sempre.
 */
export const MIN_CATALOG_FOR_RATIO = 8;

/** Faltas seguidas antes de um evento futuro sair de cena. */
export const MISS_THRESHOLD = 3;

/** Dias depois do fim a partir dos quais um evento passado é arquivado. */
export const PAST_EVENT_DAYS = 90;

export interface ReconcileDecision {
  skip: boolean;
  reason: string | null;
}

/**
 * Decide se é seguro reconciliar o que a fonte deixou de mostrar.
 *
 * `existing` — eventos publicados que esta fonte tinha.
 * `seen` — eventos que esta recolha viu.
 */
export function reconcileDecision(existing: number, seen: number): ReconcileDecision {
  if (existing <= 0) {
    return { skip: false, reason: null };
  }
  if (seen === 0) {
    return {
      skip: true,
      reason: `a recolha não trouxe um único evento e a fonte tinha ${existing}`,
    };
  }
  if (existing >= MIN_CATALOG_FOR_RATIO && seen <= existing * LOW_YIELD_RATIO) {
    return {
      skip: true,
      reason: `a recolha trouxe ${seen} de ${existing} eventos (menos de ${Math.round(
        LOW_YIELD_RATIO * 100,
      )}%)`,
    };
  }
  return { skip: false, reason: null };
}

/** Atalho para quem só quer o booleano. */
export function shouldSkipReconcile(existing: number, seen: number): boolean {
  return reconcileDecision(existing, seen).skip;
}

/**
 * Alteração de layout: a recolha rendeu muito abaixo da linha de base.
 *
 * Parente próximo da trava acima, mas noutro momento — esta pergunta-se ANTES
 * de escrever seja o que for, comparando com o que a fonte costuma dar. Um
 * seletor que deixou de casar parece uma agenda vazia, e a diferença entre as
 * duas é o que impede um site com tema novo de apagar um concelho.
 */
export function detectLayoutDrift(found: number, baseline: number | null): boolean {
  if (baseline === null || baseline < 5) return false;
  return found < baseline / 2;
}

/**
 * Nova linha de base, com média móvel amortecida.
 *
 * Amortecida de propósito: a linha de base tem de acompanhar o crescimento
 * real de uma agenda sem ser arrastada por uma recolha má. Um salto para
 * baixo demora várias noites a instalar-se, o que dá tempo a alguém de ver o
 * alerta.
 */
export function nextBaseline(current: number | null, found: number): number {
  if (current === null) return found;
  if (found > current) return found;
  return Math.round(current * 0.8 + found * 0.2);
}

/**
 * Devolve aos campos corrigidos à mão o valor que uma pessoa lá pôs.
 *
 * É a metade em TypeScript do que a tabela `manual_overrides` guarda. O
 * problema que resolve é o que faz uma equipa desistir de moderar: um editor
 * corrige a data que a câmara publicou errada, nessa noite a recolha lê a
 * mesma data errada e escreve-a por cima, e de manhã o erro está de volta. À
 * terceira vez, ninguém corrige mais nada.
 *
 * Só os campos bloqueados. Congelar o evento inteiro por causa de uma data
 * corrigida é o erro simétrico: a agenda deixava de acompanhar a fonte em
 * tudo o resto.
 *
 * Devolve também os conflitos — os campos onde a fonte passou a discordar do
 * que lá está. O backoffice quer poder dizer «a fonte continua a dizer outra
 * coisa» em vez de esconder a discordância.
 */
export interface LockResult<T> {
  event: T;
  /** Campos que a recolha queria escrever e não escreveu. */
  blocked: string[];
  /** Campos bloqueados onde a fonte passou a discordar do que lá está. */
  conflicts: string[];
}

export function applyManualLocks<T extends object>(
  incoming: T,
  stored: Readonly<Record<string, unknown>> | null,
  lockedFields: readonly string[],
): LockResult<T> {
  if (!stored || lockedFields.length === 0) {
    return { event: incoming, blocked: [], conflicts: [] };
  }

  // A conversão está confinada a estas duas linhas de propósito. `EventRow` é
  // uma interface sem assinatura de índice — o que é bom, porque impede
  // escritas em campos que não existem — mas percorrer campos por nome exige
  // uma vista genérica sobre o objeto. Fora daqui, tudo continua tipado.
  const next = { ...incoming } as Record<string, unknown>;
  const blocked: string[] = [];
  const conflicts: string[] = [];

  for (const field of lockedFields) {
    if (!(field in stored)) continue;
    blocked.push(field);
    if (!Object.is(next[field] ?? null, stored[field] ?? null)) conflicts.push(field);
    next[field] = stored[field];
  }

  return { event: next as unknown as T, blocked: blocked.sort(), conflicts: conflicts.sort() };
}

/**
 * Tira as chaves nulas antes de escrever.
 *
 * Ausência não é ordem de apagar. Se a recolha desta noite não trouxe
 * descrição, isso quer dizer que não a leu — não que o evento deixou de a
 * ter. Uma escrita só acontece quando a fonte tem opinião; o que outro
 * escritor (moderação, extração) pagou para escrever fica.
 */
export function stripNullish<T extends Record<string, unknown>>(payload: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(payload)) {
    if (value === null || value === undefined || value === '') continue;
    out[field] = value;
  }
  return out as Partial<T>;
}
