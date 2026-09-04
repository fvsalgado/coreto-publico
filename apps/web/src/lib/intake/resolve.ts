import { normalizeForHash } from '@coreto/core';

/**
 * Concelho e espaço, resolvidos a partir do que veio escrito.
 *
 * Podia deixar-se tudo para a moderação, e durante uma semana ninguém dava
 * pela diferença. Ao fim de um mês dava: cada submissão que chega com o
 * concelho por preencher é um menu para abrir e uma escolha para fazer, vezes
 * a quantidade de emails que onze concelhos produzem. O que a base já sabe —
 * os aliases dos espaços, os nomes dos concelhos — resolve-se aqui.
 *
 * A regra é a mesma do resto da casa: **na dúvida, `null`**. Dois concelhos
 * mencionados no mesmo email não são meio concelho cada; são uma decisão que
 * não é nossa. Um concelho errado é pior do que um concelho por preencher,
 * porque ninguém volta a olhar para ele.
 */

export interface MunicipalityRef {
  id: string;
  name: string;
}

export interface VenueRef {
  id: string;
  municipalityId: string;
}

export interface ResolutionInput {
  /** Assunto, corpo e o texto que se conseguiu ler dos anexos. */
  text: string;
  /** O nome do espaço tal como a extração o leu, quando houver. */
  venueName?: string | null;
  /** O concelho que a extração propôs, a confirmar contra a lista fechada. */
  municipalityId?: string | null;
  municipalities: ReadonlyArray<MunicipalityRef>;
  /**
   * Alias normalizado → espaço. Inclui o nome canónico de cada espaço.
   *
   * Só os que valem em toda a região. Um alias preso a um concelho não pode
   * entrar aqui: valeria em todo o lado, que é exatamente o contrário do que
   * quem o prendeu quis dizer.
   */
  venueAliases: ReadonlyMap<string, VenueRef>;
  /**
   * Concelho → (alias normalizado → espaço).
   *
   * Só se consulta quando o email diz de que concelho fala. Sem concelho não
   * há como escolher entre os alias de onze, e escolher seria adivinhar.
   */
  venueAliasesByMunicipality?: ReadonlyMap<string, ReadonlyMap<string, VenueRef>>;
}

export interface Resolution {
  municipalityId: string | null;
  venueId: string | null;
}

/**
 * Comprimento mínimo de um alias para valer a pena procurá-lo no corpo do
 * email.
 *
 * Os aliases curtos do catálogo são siglas — «CEFT», «CITA», «SCOCS» — e
 * algumas são também palavras ou pedaços de palavras portuguesas. Procurar
 * «cita» dentro de um texto resolvia o Castelo de Almourol a partir de
 * «cita-se». Como alias exato, vindo da extração, continuam todos a valer.
 */
const MIN_LOOSE_ALIAS_LENGTH = 9;

export function resolveLocation(input: ResolutionInput): Resolution {
  const venue = resolveVenue(input);
  // O espaço manda: um espaço do catálogo já sabe em que concelho está, e
  // sabe-o melhor do que um nome de terra apanhado no meio de uma frase.
  if (venue) return { municipalityId: venue.municipalityId, venueId: venue.id };

  return { municipalityId: resolveMunicipalityId(input), venueId: null };
}

/**
 * O espaço: primeiro pelo nome que a extração leu, depois pelo corpo do email.
 *
 * A segunda passagem é uma procura de subcadeia sobre o texto normalizado —
 * sem espaços nem pontuação, que é como os aliases estão guardados. É isso
 * que faz «no Cine-Teatro Paraíso, em Tomar» encontrar `cine-teatro-paraiso`
 * sem ser preciso adivinhar onde acaba o nome.
 */
function resolveVenue(input: ResolutionInput): VenueRef | null {
  const escrito = input.venueName ? normalizeForHash(input.venueName) : null;

  // O alias preso ao concelho que o email nomeia ganha ao regional: foi
  // escrito exatamente para desfazer a ambiguidade que o regional tem.
  const concelhoProposto = input.municipalityId?.trim();
  if (escrito && concelhoProposto) {
    const doConcelho = input.venueAliasesByMunicipality?.get(concelhoProposto)?.get(escrito);
    if (doConcelho) return doConcelho;
  }

  const named = escrito ? input.venueAliases.get(escrito) : null;
  if (named) return named;

  const haystack = normalizeForHash(input.text);
  if (haystack.length === 0) return null;

  const found = new Map<string, VenueRef>();
  for (const [alias, venue] of input.venueAliases) {
    if (alias.length < MIN_LOOSE_ALIAS_LENGTH) continue;
    if (haystack.includes(alias)) found.set(venue.id, venue);
  }

  // Um email que nomeia dois espaços é uma itinerância ou um programa inteiro.
  // Escolher um dos dois seria escolher ao acaso.
  if (found.size !== 1) return null;
  return [...found.values()][0] ?? null;
}

/**
 * O concelho: o que a extração propôs, se existir; senão, o que o texto nomeia.
 *
 * A procura no texto exige o nome escrito como nome próprio — «em Tomar» ou
 * «TOMAR», nunca «vamos tomar um café». Vários destes onze concelhos
 * chamam-se como uma palavra corrente («Tomar», «Constância»,
 * «Entroncamento», «Mação»), e sem a exigência da maiúscula um email sobre um
 * evento em Abrantes acabava em Tomar por causa do café.
 */
function resolveMunicipalityId(input: ResolutionInput): string | null {
  const proposed = input.municipalityId?.trim();
  if (proposed && input.municipalities.some((municipality) => municipality.id === proposed)) {
    return proposed;
  }

  const haystack = foldKeepingCase(input.text);
  const found = new Set<string>();
  for (const municipality of input.municipalities) {
    if (mentionsPlace(haystack, municipality.name)) found.add(municipality.id);
  }

  return found.size === 1 ? ([...found][0] as string) : null;
}

/** Sem acentos, com as maiúsculas por onde estão. */
function foldKeepingCase(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * O nome de uma terra, escrito como nome próprio.
 *
 * Aceita a grafia canónica («Vila Nova da Barquinha») e a versão toda em maiúsculas, que
 * é como meio cartaz escreve o nome da terra. Não aceita a versão em
 * minúsculas, que é onde vivem os falsos positivos.
 */
function mentionsPlace(haystack: string, name: string): boolean {
  const words = foldKeepingCase(name).split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (words.length === 0) return false;

  const canonical = words.join('\\s+');
  const shouted = words.map((word) => word.toUpperCase()).join('\\s+');
  const pattern = new RegExp(
    `(?<![\\p{Letter}\\p{Number}])(?:${canonical}|${shouted})(?![\\p{Letter}\\p{Number}])`,
    'u',
  );
  return pattern.test(haystack);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tecto de confiança do canal de email.
 *
 * Nada que chegue por email se aproxima de publicável sem uma pessoa pelo
 * meio: o que a extração declara é a certeza dela sobre a leitura, não sobre o
 * facto. O tecto mantém estas submissões sempre abaixo do 0,9 de quem edita a
 * agenda por dentro, e por isso sempre na fila.
 */
export const EMAIL_CONFIDENCE_CEILING = 0.7;

/**
 * A confiança que fica guardada na submissão.
 *
 * Desce com o que ficou por resolver, porque é isso que a fila ordena: uma
 * proposta sem data é a que mais trabalho dá a quem modera, e tem de aparecer
 * como tal.
 */
export function submissionConfidence(input: {
  declared: number;
  hasDate: boolean;
  hasMunicipality: boolean;
}): number {
  let score = Math.min(input.declared, EMAIL_CONFIDENCE_CEILING);
  if (!input.hasDate) score -= 0.2;
  if (!input.hasMunicipality) score -= 0.1;
  return Math.max(0, Number(score.toFixed(3)));
}
