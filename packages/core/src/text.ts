/**
 * Normalização de texto.
 *
 * Estas funções TÊM de produzir exatamente o mesmo resultado que as suas
 * gémeas em SQL (`public.normalize_for_hash`, `public.slugify`), porque a
 * impressão digital de deduplicação é calculada dos dois lados: pela recolha,
 * em TypeScript, e pela aprovação de submissões, em Postgres. Se divergirem,
 * o mesmo evento entra duas vezes.
 *
 * O detalhe que custa caro: o Postgres usa `unaccent`, que NÃO é o mesmo que
 * `String.normalize('NFKD')`. O NFKD converte «ª» em «a» e «º» em «o»; o
 * `unaccent` não lhes toca — deixa-os passar para a expressão regular, que os
 * apaga. Como «2ª edição» e «3º dia» são correntes em português, um NFKD
 * ingénuo aqui produzia chaves diferentes das do Postgres em metade dos
 * títulos com numeral ordinal.
 *
 * Por isso: NFD (decomposição canónica, que não mexe em «ª»/«º») + remoção
 * das marcas combinatórias + um mapa explícito para as letras que o
 * `unaccent` transcreve mas que não decompõem («ß» → «ss», «æ» → «ae»).
 */

/** Letras que o `unaccent` do Postgres transcreve e que o NFD não decompõe. */
const UNACCENT_MAP: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ð: 'd',
  þ: 'th',
  đ: 'd',
  ł: 'l',
  ħ: 'h',
  ı: 'i',
  ŋ: 'n',
  ŧ: 't',
};

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Minúsculas + transliteração equivalente ao `unaccent` do Postgres. */
function unaccent(input: string): string {
  const lowered = input.toLowerCase();
  const stripped = lowered.normalize('NFD').replace(COMBINING_MARKS, '');
  let out = '';
  for (const char of stripped) {
    out += UNACCENT_MAP[char] ?? char;
  }
  return out;
}

/**
 * Chave de comparação: só letras e dígitos.
 *
 * Espelha `public.normalize_for_hash`. Duas grafias que só diferem num
 * espaço, numa vírgula ou numas aspas tipográficas produzem a mesma chave —
 * que é exatamente o que se quer de uma chave de deduplicação.
 */
export function normalizeForHash(input: string | null | undefined): string {
  if (!input) return '';
  return unaccent(input).replace(/[^a-z0-9]/g, '');
}

/** Slug ASCII para URLs. Espelha `public.slugify`. */
export function slugify(input: string | null | undefined): string {
  if (!input) return '';
  return unaccent(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Descodifica entidades HTML deixadas pela fonte («&amp;», «&#8211;»).
 *
 * Duas passagens porque há sites que codificam duas vezes: «&amp;#8211;»
 * desfaz-se em «&#8211;» e só depois no travessão. Uma cadeia estável sai à
 * primeira.
 */
export function unescapeHtml(input: string | null | undefined): string | null {
  if (!input) return input ?? null;
  let text = input;
  for (let pass = 0; pass < 2; pass += 1) {
    const decoded = decodeEntities(text);
    if (decoded === text) break;
    text = decoded;
  }
  return text;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  aacute: 'á',
  agrave: 'à',
  acirc: 'â',
  atilde: 'ã',
  ccedil: 'ç',
  eacute: 'é',
  ecirc: 'ê',
  iacute: 'í',
  oacute: 'ó',
  ocirc: 'ô',
  otilde: 'õ',
  uacute: 'ú',
  uuml: 'ü',
  ordf: 'ª',
  ordm: 'º',
  deg: '°',
  euro: '€',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/**
 * Palavras que ficam em minúsculas no meio de um título português, salvo na
 * primeira posição.
 */
const MINOR_WORDS = new Set([
  'a',
  'à',
  'às',
  'ao',
  'aos',
  'as',
  'com',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'entre',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'ou',
  'para',
  'pela',
  'pelas',
  'pelo',
  'pelos',
  'por',
  'sem',
  'sob',
  'sobre',
  'um',
  'uma',
]);

/**
 * Siglas da região que sobrevivem à normalização de caixa.
 *
 * Uma lista curta e explícita ganha a qualquer heurística: «MIAA» tem vogais
 * a mais para ser detetada como sigla e «NO» tem-nas a menos para deixar de
 * o parecer. Acrescentar uma sigla nova aqui é uma linha.
 */
const KNOWN_ACRONYMS = new Set([
  'CAORG',
  'CCV',
  'CEFT',
  'CIMT',
  'CITA',
  'CT',
  'IPT',
  'MARG',
  'MIAA',
  'SCOCS',
  'SF',
  'SMUT',
  'TV',
]);

/**
 * Devolve à caixa normal um título publicado em CAIXA ALTA.
 *
 * Metade dos cartazes vem GRITADA, e o título gritado seguia para as
 * listagens, para o Google e para os cartões de partilha. Só se mexe quando o
 * título é maioritariamente maiúsculo; a forma original fica guardada em
 * `title_raw`, por isso nada se perde.
 */
export function fixShoutyTitle(title: string): string {
  const letters = title.replace(/[^\p{L}]/gu, '');
  if (letters.length < 5) return title;

  const upper = title.replace(/[^\p{Lu}]/gu, '').length;
  if (upper / letters.length < 0.7) return title;

  let seenWord = false;
  return title
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token)) return token;

      const bare = token.replace(/[^\p{L}\p{N}]/gu, '');
      if (KNOWN_ACRONYMS.has(bare)) {
        seenWord = true;
        return token;
      }

      const lower = token.toLowerCase();
      const isFirst = !seenWord;
      seenWord = true;
      if (!isFirst && MINOR_WORDS.has(lower)) return lower;
      return lower.replace(/\p{Ll}/u, (c) => c.toUpperCase());
    })
    .join('');
}

/** Colapsa espaços, descodifica entidades e desliga o CAPS LOCK. */
export function normalizeTitle(title: string): string {
  const decoded = (unescapeHtml(title) ?? '').replace(/\s+/g, ' ').trim();
  return fixShoutyTitle(decoded);
}

/** Corta um texto no espaço anterior ao limite, com reticências. */
export function truncate(text: string | null | undefined, maxLength: number): string | null {
  if (!text) return null;
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

/**
 * Semelhança entre duas cadeias no intervalo [0,1], por trigramas.
 *
 * Aproxima o `similarity()` do `pg_trgm`, que é o que a base de dados usa em
 * `find_duplicate_candidates`. Os valores não são idênticos ao dígito — serve
 * para ordenar candidatos do lado da recolha, não para decidir sozinho.
 */
export function trigramSimilarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 && right.size === 0) return 1;
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const gram of left) {
    if (right.has(gram)) shared += 1;
  }
  return shared / (left.size + right.size - shared);
}

function trigrams(input: string): Set<string> {
  const padded = `  ${normalizeForHash(input)} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i += 1) {
    out.add(padded.slice(i, i + 3));
  }
  return out;
}

const UNIDADES = [
  'zero',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'catorze',
  'quinze',
  'dezasseis',
  'dezassete',
  'dezoito',
  'dezanove',
] as const;

const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
] as const;

/**
 * Um inteiro pequeno por extenso, em português europeu: «onze», «dezanove»,
 * «vinte e um».
 *
 * Serve a prosa institucional — «a agenda cultural dos onze concelhos» — que
 * deixou de poder ser escrita à mão quando a contagem passou a vir da base,
 * região a região. Cobre 0–99, que chega e sobra: a maior CIM do país tem 19
 * concelhos. Fora do intervalo (ou com decimais) devolve os algarismos, que é
 * uma degradação visível e verdadeira — nunca uma palavra inventada.
 */
export function numeroPorExtenso(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  if (n < 20) return UNIDADES[n] as string;
  const dezena = DEZENAS[Math.floor(n / 10)] as string;
  const resto = n % 10;
  return resto === 0 ? dezena : `${dezena} e ${UNIDADES[resto] as string}`;
}

/**
 * Limpa a prosa que a fonte cola à volta da descrição.
 *
 * Dois vícios concretos, vistos nas agendas municipais:
 *
 *   1. O título repetido no arranque, muitas vezes EM MAIÚSCULAS — «VAMOS
 *      SOMAR KM'S EM 2026! O projeto…». A comparação usa a mesma normalização
 *      da impressão digital, para a caixa e os acentos não esconderem a
 *      repetição.
 *   2. A tabela de propriedades achatada em texto no fim — «Informação do
 *      evento Data 19/01/2026 19:30 … Local Mação». As datas já vêm do campo
 *      próprio; em prosa são só ruído.
 *
 * Não inventa nada: só corta o que reconhece, e devolve `null` quando não
 * sobra texto nenhum.
 */
export function cleanEventDescription(
  title: string | null | undefined,
  description: string | null | undefined,
): string | null {
  if (!description) return null;
  let text = description.trim();

  const key = normalizeForHash(title ?? '');
  if (key.length > 0) {
    let acc = '';
    let consumed = 0;
    for (let i = 0; i < text.length && acc.length < key.length; i += 1) {
      acc += normalizeForHash(text[i] as string);
      consumed = i + 1;
    }
    if (acc === key) {
      text = text.slice(consumed).replace(/^[\s\-–—:.!?|]+/, '');
    }
  }

  text = text
    .replace(/\s*informação do evento\s+data\b[\s\S]*$/i, '')
    .replace(
      /\s*data\s+\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2})?\s+data de fim do evento\b[\s\S]*$/i,
      '',
    )
    .trim();

  return text.length > 0 ? text : null;
}
