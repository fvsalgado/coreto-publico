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

/** Abaixo desta linha de base não se tiram conclusões sobre a contagem. */
export const DRIFT_MIN_BASELINE = 5;

export interface DriftInput {
  itemsFound: number;
  baseline: number | null;
  minExpected: number;
}

/**
 * Abaixo desta fração da linha de base, a contagem deixa de ser normal.
 *
 * 0,7 e não 0,5: metade era o limiar que existia, e entre os dois havia uma
 * faixa inteira sem vigilância nenhuma — uma fonte que passasse de vinte
 * eventos para doze não acendia nada. Perder 40% da agenda de um concelho não
 * é uma oscilação; é meia agenda que ninguém vai ler.
 *
 * O número tem de deixar passar o que é sazonal, que é a razão de não ser
 * mais apertado. Agosto é legitimamente mais magro do que outubro, e a queda
 * de um mês para o outro anda nos 10 a 20% — dentro dos 30% que isto tolera.
 * A prova está em `lifecycle.test.ts`: a sequência 20, 18, 17, 16 não marca
 * nada e a sequência 20, 12, 12 marca as duas últimas.
 */
export const QUEDA_SUSPEITA = 0.7;

/**
 * O que se conclui de uma contagem.
 *
 * - `normal` — a contagem é de confiança: escreve-se e a linha de base
 *   aprende com ela.
 * - `queda` — rendeu bastante abaixo do costume, mas não o suficiente para se
 *   dizer que a página mudou de forma. Escreve-se o que veio (são eventos a
 *   sério e alguém os procura), mas a leitura **não conta como sucesso** e a
 *   linha de base fica congelada.
 * - `deriva` — rendeu tão abaixo que a explicação mais provável é o seletor
 *   ter deixado de casar. Não se escreve nada.
 */
export type LeituraDaContagem = 'normal' | 'queda' | 'deriva';

/**
 * O que dizer de uma contagem, comparada com o que a fonte costuma dar.
 *
 * Pergunta-se ANTES de escrever seja o que for. Um seletor que deixou de
 * casar parece exatamente uma agenda vazia, e a diferença entre as duas
 * coisas é tudo: sem esta verificação, o dia em que uma câmara mudasse de
 * tema o site apagava a programação inteira do concelho e ninguém dava por
 * isso até alguém reclamar.
 *
 * **Porque há três respostas e não duas.** A versão anterior devolvia um
 * booleano com o corte a metade da linha de base, e a faixa entre metade e o
 * costume ficava sem vigilância — pior do que sem vigilância, porque a média
 * móvel de `nextBaseline` aprendia a perda em três ou quatro noites: 20 → 17
 * → 15 → 14, e ao fim de uma semana o número novo era o normal. A fonte que
 * perdeu 40% da agenda acabava «em dia», com uma linha de base a dar-lhe
 * razão. O grau do meio existe para isso: escreve o que veio, e não deixa a
 * linha de base mover-se enquanto a perda durar.
 *
 * O mínimo esperado é a trava de quem sabe o que a fonte tem: uma fonte
 * configurada com `min_expected_items` maior que zero acusa a queda mesmo sem
 * história nenhuma, que é o que protege uma recolha nova.
 */
export function avaliarContagem(input: DriftInput): LeituraDaContagem {
  if (input.minExpected > 0 && input.itemsFound < input.minExpected) return 'deriva';
  if (input.baseline === null || input.baseline < DRIFT_MIN_BASELINE) return 'normal';
  if (input.itemsFound * 2 < input.baseline) return 'deriva';
  return input.itemsFound < input.baseline * QUEDA_SUSPEITA ? 'queda' : 'normal';
}

/**
 * Alteração de layout, em booleano.
 *
 * Sobrevive à `avaliarContagem` por ser a pergunta que decide se se escreve
 * ou não — a única em que os dois graus de cima se comportam de forma
 * diferente. Quem quiser saber se a leitura conta como sucesso pergunta pela
 * `avaliarContagem`, porque uma queda também não conta.
 */
export function detectLayoutDrift(input: DriftInput): boolean {
  return avaliarContagem(input) === 'deriva';
}

/**
 * Nova linha de base, suavizada.
 *
 * Média móvel em vez do último valor: a agenda de agosto é legitimamente mais
 * magra do que a de outubro, e uma linha de base que copiasse a última recolha
 * ficava presa no mês mais fraco — e deixava de dar pela mudança de layout que
 * ela existe para apanhar.
 *
 * **Quem a chama tem de ter perguntado primeiro à `avaliarContagem`.** Esta
 * função aprende com o que lhe derem, incluindo com uma perda: é o chamador
 * que sabe se a contagem é de confiança, e só a passa quando é.
 */
export function nextBaseline(current: number | null, found: number): number {
  if (current === null || current <= 0) return found;
  return Math.max(0, Math.round(current * 0.7 + found * 0.3));
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
