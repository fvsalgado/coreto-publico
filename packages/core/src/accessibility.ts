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
/**
 * A cadeira de rodas, e o que se diz **à volta** dela.
 *
 * **A menção nua não afirma nada, e afirmava.** A rede antiga tinha «cadeira
 * de rodas» como alternativa solta: qualquer frase que a nomeasse marcava o
 * evento como acessível. Pior do que isso — e é o defeito que esta correção
 * existe para tapar — a negação escrita da forma mais comum em português
 * escapava-lhe. O padrão de negação exigia «nao acessivel» com as duas
 * palavras encostadas, e a frase real é «**não é** acessível a pessoas em
 * cadeira de rodas»: o «é» pelo meio bastava para a negação não casar, a
 * menção casar, e o Coreto publicar **acesso verdadeiro sobre uma frase que
 * diz o contrário**. Não é uma imprecisão de catálogo: é mandar alguém em
 * cadeira de rodas a uma porta com degraus.
 *
 * A leitura passa a ser em três tempos, dentro da frase onde a menção
 * aparece: negação ganha, afirmação vem a seguir, e o silêncio fica silêncio.
 * A frase é a unidade certa — «Espaço acessível. Não há lugares para cadeiras
 * de rodas» são duas afirmações sobre coisas diferentes, e juntá-las numa
 * janela de caracteres faria uma delas mentir sobre a outra.
 */
const CADEIRA_DE_RODAS = /\b(?:cadeiras? de rodas|mobilidade (?:reduzida|condicionada))\b/;

/**
 * As formas da negação, medidas na prosa das câmaras.
 *
 * O `nao` seguido de até duas palavras curtas cobre «não é acessível», «não
 * está acessível», «não se encontra acessível» e «não acessível» com uma
 * regra só. Sem isso, cada forma nova precisava de uma alternativa nova — e a
 * que faltava era a mais comum de todas.
 */
const NEGACAO_DE_ACESSO =
  /\b(?:sem acesso|sem acessibilidade|sem condicoes de acesso|nao(?:\s+\w{1,6}){0,2}\s+(?:acessivel|adaptad[oa]s?|preparad[oa]s?)|nao (?:dispoe|tem|possui|oferece)|inacessivel|acesso condicionado|acesso limitado)\b/;

/**
 * O que faz de uma menção uma afirmação.
 *
 * Uma palavra de acesso na mesma frase da cadeira de rodas: «espaço acessível
 * a cadeiras de rodas», «entrada adaptada», «lugares reservados a pessoas com
 * mobilidade reduzida». Sem nenhuma delas, o texto nomeou a cadeira de rodas
 * e não disse nada sobre ela — o que acontece em «venha de carro, de autocarro
 * ou de cadeira de rodas».
 */
const AFIRMACAO_DE_ACESSO =
  /\b(?:acessivel|acessibilidade|acesso|adaptad[oa]s?|preparad[oa]s?|reservad[oa]s?|rampa|elevador)\b/;

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
  const acesso = lerAcessoEmCadeiraDeRodas(folded);
  if (acesso !== undefined) flags.wheelchair_accessible = acesso;
  return flags;
}

/**
 * O que o texto diz sobre entrar em cadeira de rodas — ou nada.
 *
 * Percorre as frases e não o texto inteiro, e devolve à primeira frase que
 * nomeie a cadeira de rodas **e** diga alguma coisa sobre ela. Uma negação em
 * qualquer frase manda sobre uma afirmação noutra: entre «tem rampa» e «a
 * sala do primeiro piso não é acessível», quem precisa da informação é quem
 * fica na segunda.
 */
function lerAcessoEmCadeiraDeRodas(folded: string): boolean | undefined {
  let afirmado: boolean | undefined;

  for (const frase of folded.split(/[.;!?\n]+/)) {
    if (!CADEIRA_DE_RODAS.test(frase)) continue;
    if (NEGACAO_DE_ACESSO.test(frase)) return false;
    if (AFIRMACAO_DE_ACESSO.test(frase)) afirmado = true;
  }

  return afirmado;
}

const DURATION_CEILING = 12 * 60;
const HOURS_MINUTES_RE = /\b(\d{1,2})\s*h(?:oras?)?\s*(?:e\s*)?(\d{1,2})?\s*(?:m|min|minutos?)?\b/g;
const MINUTES_RE = /\b(\d{1,3})\s*(?:m|min|mins|minutos?)\b/g;
const DURATION_CUE = /\bduracao\b|\bdura\b|\bcerca de\b|\baproximadamente\b/;

/** A janela à esquerda onde a pista de duração ainda governa o número. */
const ALCANCE_DA_PISTA = 30;

/**
 * O que vem antes de uma hora de relógio.
 *
 * «entre as 10h00», «das 9h», «às 21h30», «a partir das 15h», «até às 18h».
 * Sem acentos, porque o texto já vem dobrado.
 */
const PREPOSICAO_DE_RELOGIO =
  /\b(?:as|das|desde|entre|ate|pelas|para as|a partir d[oa]s?|marcad[oa] para)\s*$/;

/** O que vem depois: o outro extremo de um intervalo. */
const FECHO_DE_INTERVALO = /^\s*(?:[-–—]|as|ate as|ate|e as)\s*\d{1,2}\s*h/;

/** Um número escrito com a palavra por extenso nunca é um relógio. */
const POR_EXTENSO = /\d\s*(?:horas?|minutos?)\b/;

/**
 * Duração total em minutos, quando o texto a declara.
 *
 * Devolve `null` em vez de adivinhar — uma duração errada engana quem está a
 * contar com o último autocarro.
 *
 * **O que aqui esteve, e o que publicou.** O ramo das horas devolvia à
 * primeira, sem pista nenhuma: qualquer «10h00» num texto virava uma duração
 * de dez horas. Das 128 fichas publicadas, 30 mostravam duração e **14 eram
 * horas de relógio** — nove delas a dizer «Duração: 10h». A contradição
 * ficava na mesma página: «A Arte do Calafate», em Constância, mostrava a
 * sessão das 9h às 11h e, ao lado, «Duração: 9h».
 *
 * Duas guardas, e são diferentes porque os dois enganos são diferentes:
 *
 * 1. **Contexto de relógio recusa-se.** Um número precedido de «às», «das»,
 *    «entre as» — ou seguido do outro extremo de um intervalo — é uma hora do
 *    dia. É o que apanha «entre as 10h00 e as 13h00» sem precisar de saber
 *    mais nada sobre a frase.
 * 2. **Uma duração precisa de se declarar.** Ou uma pista à esquerda
 *    («duração», «cerca de», «aproximadamente»), ou a palavra por extenso —
 *    «1 hora e 20 minutos», que nenhum relógio escreve assim. Uma hora nua no
 *    meio da prosa não é uma duração, e o que ela custa é maior do que o que
 *    dava: o campo desaparece de umas fichas e deixa de mentir em catorze.
 *
 * As durações verdadeiras não passam por aqui: vêm de `raw.durationMinutes`,
 * declarado pelo adaptador, e ganham sempre (ver `harmonize.ts`).
 */
export function parseDurationMinutes(...texts: Array<string | null | undefined>): number | null {
  const folded = fold(...texts);
  if (!folded.trim()) return null;

  for (const match of folded.matchAll(HOURS_MINUTES_RE)) {
    const minutes = match[2] ? Number(match[2]) : 0;
    if (minutes >= 60) continue;
    const total = Number(match[1]) * 60 + minutes;
    if (total <= 0 || total > DURATION_CEILING) continue;

    const antes = folded.slice(0, match.index);
    const depois = folded.slice(match.index + match[0].length);
    if (PREPOSICAO_DE_RELOGIO.test(antes) || FECHO_DE_INTERVALO.test(depois)) continue;

    const pista = DURATION_CUE.test(antes.slice(-ALCANCE_DA_PISTA)) || POR_EXTENSO.test(match[0]);
    if (pista) return total;
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
