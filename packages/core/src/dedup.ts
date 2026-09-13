/**
 * Deduplicação.
 *
 * Duas coisas diferentes, de propósito separadas:
 *
 * 1. **Fusão automática**, dentro de uma recolha: o mesmo evento publicado
 *    pela fonte em vários endereços. Só se funde com prova — mesma impressão
 *    digital de conteúdo, ou mesma base de URL com data no fim. Isto é seguro
 *    porque a prova é a própria fonte a repetir-se.
 *
 * 2. **Candidatos a duplicado**, entre fontes e canais: a câmara e a
 *    coletividade a anunciar o mesmo concerto com títulos diferentes. Isto
 *    NÃO se funde sozinho — assinala-se e espera decisão humana. Fundir dois
 *    eventos parecidos que afinal eram dois espetáculos apaga programação, e
 *    apagar programação é o oposto do que esta agenda existe para fazer.
 */

import { contentHash } from './fingerprint';
import type { RawEvent, RawSession } from './types';
import { normalizeForHash, trigramSimilarity } from './text';

/** Chave de uma sessão, para não a contar duas vezes. */
function sessionKey(session: RawSession): string {
  return [session.date, session.startTime ?? '', session.venueOverride ?? ''].join('|');
}

/** Descarta os sufixos que os CMS acrescentam ao duplicar: `x-1`, `x-2-2` → `x`. */
export function slugBase(sourceKey: string | null | undefined): string {
  return (sourceKey ?? '').replace(/(?:-\d+)+$/, '');
}

const OCCURRENCE_DATE_RE = /\/\d{4}-\d{2}-\d{2}\/?$/;

/** Para `…/<slug>/<AAAA-MM-DD>/` devolve `…/<slug>/`; caso contrário, `null`. */
export function occurrenceBase(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl || !OCCURRENCE_DATE_RE.test(sourceUrl)) return null;
  return sourceUrl.replace(OCCURRENCE_DATE_RE, '/');
}

/**
 * Impressão digital de conteúdo de um evento em bruto.
 *
 * Título + concelho + os primeiros 500 caracteres da descrição. A descrição
 * truncada evita falsos negativos por uma gralha corrigida; incluí-la evita
 * fundir reposições, que repetem o título mas mudam o texto.
 */
export function rawContentFingerprint(raw: RawEvent, municipalityId: string): string {
  return contentHash([raw.title, municipalityId, raw.description ?? '']);
}

/**
 * Qual dos membros de um grupo fica com a identidade.
 *
 * Não é «o primeiro»: quando o site emite um `<slug>-1` magro antes do
 * `<slug>` completo, é o completo que tem de ganhar, senão a linha boa fica
 * órfã. Ordena-se por riqueza intrínseca — as sessões são acumuladas de
 * qualquer maneira.
 */
function richness(event: RawEvent): [number, number, number, number] {
  const key = event.sourceKey ?? '';
  return [
    slugBase(key) === key ? 1 : 0,
    event.dates.length,
    (event.description ?? '').length,
    event.imageUrl ? 1 : 0,
  ];
}

function richerThan(a: RawEvent, b: RawEvent): boolean {
  const left = richness(a);
  const right = richness(b);
  for (let i = 0; i < left.length; i += 1) {
    if (left[i]! !== right[i]!) return left[i]! > right[i]!;
  }
  return false;
}

function dateWindow(event: RawEvent): [string, string] | null {
  const dates = event.dates
    .map((session) => session.date)
    .filter(Boolean)
    .sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first && last ? [first, last] : null;
}

function overlaps(a: [string, string], b: [string, string]): boolean {
  return (a[0] > b[0] ? a[0] : b[0]) <= (a[1] < b[1] ? a[1] : b[1]);
}

interface Group {
  canonical: RawEvent;
  sessions: RawSession[];
  seen: Set<string>;
}

/**
 * O concelho explícito do evento — vazio quando herda o da fonte.
 *
 * Uma fonte regional devolve a mesma produção uma vez por concelho, com o
 * mesmo título, o mesmo endereço e datas que se sobrepõem. Nenhuma das
 * passagens de fusão pode juntá-las: não são a fonte a repetir-se, são duas
 * entradas da agenda de dois concelhos. Nas fontes de um concelho só, isto é
 * vazio em todos os eventos e não muda nada.
 */
function concelhoExplicito(event: RawEvent): string {
  return event.municipalityId ?? '';
}

function newGroup(event: RawEvent): Group {
  const sessions = [...event.dates];
  return {
    canonical: { ...event, dates: sessions },
    sessions,
    seen: new Set(sessions.map(sessionKey)),
  };
}

function absorb(group: Group, event: RawEvent): void {
  for (const session of event.dates) {
    const key = sessionKey(session);
    if (group.seen.has(key)) continue;
    group.sessions.push(session);
    group.seen.add(key);
  }
  if (richerThan(event, group.canonical)) {
    group.canonical = { ...event, dates: group.sessions };
  } else {
    group.canonical.dates = group.sessions;
  }
}

export interface MergeResult {
  events: RawEvent[];
  mergedCount: number;
}

/**
 * Funde, dentro de uma recolha, os eventos que a fonte publicou repetidos.
 *
 * Quatro passagens, da prova mais forte para a mais fraca:
 *   1. mesma impressão digital de conteúdo (título + concelho + descrição);
 *   2. mesma base de slug + títulos iguais + janelas de datas sobrepostas —
 *      a sobreposição é a salvaguarda contra reposições, que repetem o slug
 *      mas caem noutro mês;
 *   3. mesma base de URL com data no fim (`/evento/<slug>/2026-05-10/`), que
 *      é como alguns CMS publicam uma programação recorrente;
 *   4. mesmo título e **exatamente** a mesma janela de datas, para a fonte que
 *      não dá pista de identidade nenhuma — nem slug comum, nem URL, nem a
 *      mesma prosa. Aqui a salvaguarda tem de ser mais apertada do que nas
 *      outras: sem slug a segurar, a sobreposição não chega.
 */
export function mergeSourceDuplicates(events: RawEvent[], municipalityId: string): MergeResult {
  const byFingerprint = new Map<string, Group>();
  const order: string[] = [];

  for (const event of events) {
    const key = rawContentFingerprint(event, event.municipalityId ?? municipalityId);
    const existing = byFingerprint.get(key);
    if (existing) {
      absorb(existing, event);
      continue;
    }
    byFingerprint.set(key, newGroup(event));
    order.push(key);
  }

  const afterFingerprint = order.map((key) => byFingerprint.get(key)!.canonical);
  const afterSlug = mergeSlugVariants(afterFingerprint);
  const afterOccurrence = mergeOccurrenceUrls(afterSlug);
  // Por último, e de propósito: as outras três agarram-se a pistas mais
  // fortes, e esta só vê o que sobrar depois de elas terem feito o seu.
  const afterSameRun = mergeSameRun(afterOccurrence);

  return { events: afterSameRun, mergedCount: events.length - afterSameRun.length };
}

/**
 * O número da edição, tirado do princípio do título.
 *
 * `13ª Edição Trail de Fátima` e `13º Trail de Fátima` são o mesmo trail,
 * escritos por dois editores. Tirar o ordinal e a palavra «edição» junta-os.
 *
 * Tirar o número parece perigoso — passaria a casar a 13.ª com a 14.ª — e não
 * é, porque quem usa isto exige **a mesma janela de datas**. Duas edições do
 * mesmo evento nunca acontecem nos mesmos dias; é precisamente essa a
 * propriedade que torna a comparação segura.
 */
export function tituloSemEdicao(title: string | null | undefined): string {
  const semOrdinal = (title ?? '')
    .trim()
    // O artigo a seguir entra também: «18ª Edição da Feirinha» e «Feirinha»
    // são a mesma feira, e é o backend que decide se escreve o «da».
    .replace(/^\s*\d+\s*[.ºªo°]*\s*(?:edi[çc][ãa]o\s+)?(?:d[aeo]s?\s+)?/i, '');
  return normalizeForHash(semOrdinal || (title ?? ''));
}

/**
 * A fonte que serve o mesmo evento duas vezes, sem dar por onde o agarrar.
 *
 * As três passagens acima precisam todas de uma pista de identidade: prosa
 * igual, uma raiz de slug comum, ou um endereço por ocorrência. A API de Ourém
 * não dá nenhuma das três — são dois backends com espaços de identificadores
 * diferentes, o `sourceUrl` vem a nulo, e cada backend traz a sua descrição
 * escrita por outra pessoa:
 *
 *     708a9714-…  «A Feira de São Bartolomeu em Caxarias, mais conhecida…»
 *     9e523534-…  «Realização da Tradicional Feira de S.Bartolomeu»
 *
 * O mesmo evento, os mesmos dois dias, duas linhas no catálogo.
 *
 * O que resta comparar é o título e as datas — e é quanto basta, com a
 * condição estreita: a janela de datas tem de ser **exatamente a mesma**, e
 * não apenas sobreposta como nas outras passagens. Dois espetáculos distintos
 * com o mesmo título no mesmo concelho e exatamente nos mesmos dias é um caso
 * que não se conhece; sobrepostos, conhece-se bem — uma exposição de um mês
 * cruza-se com tudo o que aconteça nesse mês.
 */
function mergeSameRun(events: RawEvent[]): RawEvent[] {
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();

  for (const event of events) {
    const window = dateWindow(event);
    const titulo = tituloSemEdicao(event.title);
    const key =
      window && titulo ? `${concelhoExplicito(event)}|${titulo}|${window[0]}|${window[1]}` : null;
    const target = key === null ? undefined : byKey.get(key);

    if (target) {
      absorb(target, event);
      continue;
    }

    const group = newGroup(event);
    groups.push(group);
    if (key !== null) byKey.set(key, group);
  }

  return groups.map((group) => group.canonical);
}

function mergeSlugVariants(events: RawEvent[]): RawEvent[] {
  const groups: Group[] = [];

  for (const event of events) {
    const window = dateWindow(event);
    const titleKey = normalizeForHash(event.title);
    const base = slugBase(event.sourceKey);

    let target: Group | undefined;
    if (window && titleKey && base) {
      target = groups.find((group) => {
        const other = dateWindow(group.canonical);
        return (
          concelhoExplicito(group.canonical) === concelhoExplicito(event) &&
          normalizeForHash(group.canonical.title) === titleKey &&
          slugBase(group.canonical.sourceKey) === base &&
          other !== null &&
          overlaps(other, window)
        );
      });
    }

    if (target) absorb(target, event);
    else groups.push(newGroup(event));
  }

  return groups.map((group) => group.canonical);
}

function mergeOccurrenceUrls(events: RawEvent[]): RawEvent[] {
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();

  for (const event of events) {
    const base = occurrenceBase(event.sourceUrl);
    const key =
      base === null ? null : `${concelhoExplicito(event)}|${base}|${normalizeForHash(event.title)}`;
    const target = key === null ? undefined : byKey.get(key);

    if (target) {
      absorb(target, event);
      continue;
    }
    const group = newGroup(event);
    groups.push(group);
    if (key !== null) byKey.set(key, group);
  }

  return groups.map((group) => group.canonical);
}

/**
 * Limiar a partir do qual dois títulos merecem ser vistos por uma pessoa.
 *
 * Igual ao usado por `public.find_duplicate_candidates`, para que a recolha e
 * a base de dados assinalem o mesmo conjunto.
 */
export const NEAR_DUPLICATE_THRESHOLD = 0.55;

/** Janela, em dias, dentro da qual duas datas são «a mesma ocasião». */
export const NEAR_DUPLICATE_DATE_WINDOW_DAYS = 3;

export interface DuplicateCandidate<T> {
  event: T;
  similarity: number;
}

interface CandidateShape {
  title: string;
  date_start: string | null;
  municipality_id: string;
}

/**
 * Encontra candidatos a duplicado entre eventos já existentes.
 *
 * Devolve-os ordenados; NÃO decide nada. Quem decide é quem modera.
 */
export function findNearDuplicates<T extends CandidateShape>(
  candidate: { title: string; date: string | null; municipalityId: string },
  existing: readonly T[],
  threshold: number = NEAR_DUPLICATE_THRESHOLD,
): Array<DuplicateCandidate<T>> {
  const out: Array<DuplicateCandidate<T>> = [];

  for (const other of existing) {
    if (other.municipality_id !== candidate.municipalityId) continue;
    if (candidate.date && other.date_start) {
      if (Math.abs(daysBetween(candidate.date, other.date_start)) > NEAR_DUPLICATE_DATE_WINDOW_DAYS)
        continue;
    }
    const similarity = trigramSimilarity(candidate.title, other.title);
    if (similarity >= threshold) out.push({ event: other, similarity });
  }

  return out.sort((a, b) => b.similarity - a.similarity);
}

function daysBetween(a: string, b: string): number {
  const left = Date.parse(`${a}T00:00:00Z`);
  const right = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return Number.POSITIVE_INFINITY;
  return Math.round((left - right) / 86_400_000);
}
