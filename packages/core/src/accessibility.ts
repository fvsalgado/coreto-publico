/**
 * Acessibilidade e duração, lidas da prosa.
 *
 * Quase nenhuma fonte preenche campos de acessibilidade, mas muitas dizem-no
 * por escrito na descrição. Ler daqui cobre todas as fontes de uma vez, em vez
 * de acrescentar um campo a cada adaptador. Um adaptador que resolva o campo
 * ganha sempre: isto só escreve onde a fonte se calou.
 */

export interface AccessibilityFlags {
  has_sign_language: boolean;
  has_audio_description: boolean;
  has_subtitles: boolean;
  is_relaxed_performance: boolean;
  wheelchair_accessible?: boolean;
}

const SIGN_LANGUAGE = /\b(?:lingua gestual portuguesa|lingua gestual|lgp|interpretacao gestual)\b/;
const AUDIO_DESCRIPTION = /\b(?:audiodescricao|audio-descricao|audio descricao)\b/;
const SUBTITLES = /\b(?:legendad[oa]s?|legendagem|com legendas|surdos e ensurdecidos)\b/;
const RELAXED = /\b(?:sessao relaxada|espetaculo relaxado|performance relaxada|sessao sensorial)\b/;
const WHEELCHAIR = /\b(?:acessivel a cadeiras? de rodas|mobilidade reduzida|cadeira de rodas)\b/;
// Uma negação explícita vale mais do que a menção: «sem acesso a cadeiras de
// rodas» aparece tantas vezes como a afirmação.
const NO_WHEELCHAIR =
  /\b(?:sem acesso|nao acessivel|acesso condicionado)\b[^.]{0,40}\b(?:cadeiras? de rodas|mobilidade reduzida)\b/;

function fold(...texts: Array<string | null | undefined>): string {
  return texts
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

export function extractAccessibility(
  ...texts: Array<string | null | undefined>
): AccessibilityFlags {
  const folded = fold(...texts);
  const flags: AccessibilityFlags = {
    has_sign_language: SIGN_LANGUAGE.test(folded),
    has_audio_description: AUDIO_DESCRIPTION.test(folded),
    has_subtitles: SUBTITLES.test(folded),
    is_relaxed_performance: RELAXED.test(folded),
  };
  if (NO_WHEELCHAIR.test(folded)) flags.wheelchair_accessible = false;
  else if (WHEELCHAIR.test(folded)) flags.wheelchair_accessible = true;
  return flags;
}

const DURATION_CEILING = 12 * 60;
const HOURS_MINUTES_RE = /\b(\d{1,2})\s*h(?:oras?)?\s*(?:e\s*)?(\d{1,2})?\s*(?:m|min|minutos?)?\b/g;
const MINUTES_RE = /\b(\d{1,3})\s*(?:m|min|mins|minutos?)\b/g;
const DURATION_CUE = /\bduracao\b|\bdura\b|\bcerca de\b|\baproximadamente\b/;

/**
 * Duração total em minutos, quando o texto a declara.
 *
 * Devolve `null` em vez de adivinhar — uma duração errada engana quem está a
 * contar com o último autocarro.
 */
export function parseDurationMinutes(...texts: Array<string | null | undefined>): number | null {
  const folded = fold(...texts);
  if (!folded.trim()) return null;

  for (const match of folded.matchAll(HOURS_MINUTES_RE)) {
    const hours = Number(match[1]);
    const minutes = match[2] ? Number(match[2]) : 0;
    if (minutes >= 60) continue;
    const total = hours * 60 + minutes;
    if (total > 0 && total <= DURATION_CEILING) return total;
  }

  const cued = DURATION_CUE.test(folded);
  for (const match of folded.matchAll(MINUTES_RE)) {
    const total = Number(match[1]);
    // «45 min» é seguro; «45» sozinho não é. A pista só protege leituras curtas.
    if (total > 0 && total <= DURATION_CEILING && (cued || total >= 30)) return total;
  }
  return null;
}

const AGE_PATTERNS: Array<RegExp> = [
  // A barra é opcional: metade das salas escreve «M/12», a outra metade «M12».
  /\bm\s*\/?\s*(\d{1,2})\b/,
  /\bmaiores?\s*(?:de)?\s*(\d{1,2})\s*anos?\b/,
  /\ba\s+partir\s+(?:dos?\s*)?(\d{1,2})\s*anos?\b/,
];

/**
 * «Público em geral» é a forma que a API de Ourém usa.
 *
 * Nos doze eventos capturados em `ourem-api.json` aparece seis vezes; um
 * sétimo diz «Todos», e os outros cinco não dizem nada. Estava a faltar, e o
 * resultado era um concelho inteiro a chegar sem público declarado tendo a
 * fonte declarado o de todos. `todos` sozinho entra pelo mesmo motivo: é o
 * que lá está escrito quando não é «público em geral».
 */
/*
 * «Todos» sozinho saiu desta rede, e a medição diz porquê.
 *
 * A palavra aparece em «todos os dias, das 10h00 às 13h00», em «todos os
 * concertos têm entrada livre», em «são convidados todos os naturais desta
 * freguesia». Nenhuma dessas frases fala de idades — e no entanto, a 31 de
 * agosto de 2026, **onze dos trinta e cinco** eventos marcados «para todas as
 * idades» tinham-no só por causa dela. Entre eles o Almoço dos Idosos.
 *
 * É o mesmo erro que o classificador de categorias evita de propósito: uma
 * palavra comum num texto longo não é uma declaração sobre o evento. As
 * expressões que ficam dizem-no à letra.
 */
const ALL_AGES_KEYWORDS =
  /\b(?:todas as idades|todos os publicos|para todos|publico em geral|publico geral)\b/;
const FAMILY_KEYWORDS = /\b(?:familia|familias|infantil|criancas?|mais novos)\b/;
const SCHOOL_KEYWORDS = /\b(?:escolas|publico escolar|servico educativo|atividade educativa)\b/;

/** Acima desta idade mínima o evento deixa de ser programação de família. */
const FAMILY_AGE_CEILING = 12;

export interface ParsedAudience {
  audience?: 'all_ages' | 'family' | 'children' | 'youth' | 'adults' | 'seniors' | 'schools';
  min_age?: number;
}

/** Lê público-alvo e idade mínima de rótulos como «M/12» ou «para famílias». */
export function parseAudience(...texts: Array<string | null | undefined>): ParsedAudience {
  const folded = fold(...texts);
  if (!folded.trim()) return {};
  const out: ParsedAudience = {};

  for (const pattern of AGE_PATTERNS) {
    const match = folded.match(pattern);
    if (match) {
      const age = Number(match[1]);
      if (age >= 0 && age <= 21) out.min_age = age;
      break;
    }
  }

  // A ordem importa, e a barra de idade subiu.
  //
  // «M/16» é uma classificação etária: quem a escreve está a dizer que
  // menores não entram. Uma frase de apresentação a dizer «para todos» é
  // linguagem de cartaz, e não desmente a bilheteira. Enquanto o teclado de
  // palavras vinha primeiro, um espetáculo M/16 saía daqui marcado «para
  // todas as idades» — o Festival Z de Ferreira do Zêzere, lido a 31 de
  // agosto de 2026, era exactamente isso.
  //
  // As escolas continuam à frente de tudo: uma sessão marcada para escolas é
  // uma sessão fechada, e isso manda sobre o resto.
  if (SCHOOL_KEYWORDS.test(folded)) out.audience = 'schools';
  else if (out.min_age !== undefined && out.min_age >= 16) out.audience = 'adults';
  else if (ALL_AGES_KEYWORDS.test(folded)) out.audience = 'all_ages';
  else if (FAMILY_KEYWORDS.test(folded)) out.audience = 'family';
  else if (out.min_age !== undefined && out.min_age <= FAMILY_AGE_CEILING) out.audience = 'family';

  return out;
}
