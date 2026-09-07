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
  /*
   * `que` e `se` entraram por um título publicado, e é o único defeito desta
   * função que o catálogo de hoje tem materializado.
   *
   * A fonte de Abrantes publica «PAI QUE SE TORNOU MÃE»
   * (`__fixtures__/abrantes-proxy.json:23`), e a base de produção guarda
   * **«Pai Que Se Tornou Mãe»** — medido a 7 de setembro de 2026. Sem estas
   * duas linhas, o pronome relativo e o pronome reflexo ficam capitalizados
   * como se fossem substantivos.
   */
  'que',
  'se',
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
  // O Festival Internacional de Folclore de Abrantes. A fonte escreve-o em
  // caixa mista («FIF Abrantes») e por isso a função nem lhe toca hoje — está
  // aqui para o dia em que o cartaz venha gritado, que é como metade vem.
  'FIF',
  'IPT',
  'MARG',
  'MIAA',
  'SCOCS',
  'SF',
  'SMUT',
  'TV',
]);

/**
 * Um numeral romano, pela forma e não por lista.
 *
 * Esta é a única família em que uma regra ganha à lista, e é por ser
 * **fechada**: os numerais romanos são um sistema de escrita, não um
 * vocabulário que cresce. «XV», «II», «XXIV» são o que qualquer cartaz de
 * edição escreve, e enumerá-los seria enumerar os inteiros.
 *
 * O padrão é o estrito — a forma canónica, com as subtrações — e não
 * `[IVXLCDM]+`, que aceitaria «IIII» e «VX». Medido: apanha XV, II, IV, VII,
 * XVI, XIX, XXI, XXIV, XL; recusa MIL, CIVIL, DVD, CID, VIM, LIMA, CLIMA,
 * LIVRO.
 *
 * **A colisão conhecida, e porque se aceita.** «MIX» é um numeral romano
 * válido (M + IX = 1009), e por isso «MIX DE VERÃO NO CORETO» passa a dar
 * «MIX de Verão» em vez de «Mix de Verão». O mesmo vale para CD, CM, DC, MC,
 * LI, DI, CI, MI. Aceita-se porque o engano **cai do lado seguro**: preserva a
 * caixa que a fonte escreveu em vez de inventar uma. A regra da casa é essa —
 * na dúvida, não fabricar —, e afrouxar o padrão para evitar o «MIX» era
 * trocar um título com a caixa da fonte por dezenas de numerais partidos.
 */
const ROMAN_NUMERAL = /^(?=[IVXLCDM]{2,}$)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/**
 * Uma sigla pontuada: «A.R.C.A.», «S.C.P.».
 *
 * A forma não é ambígua — letra, ponto, letra, ponto — e nenhuma palavra
 * portuguesa se escreve assim. Hoje dá «A.r.c.a.», porque o `bare` do ramo das
 * siglas tira os pontos e procura «ARCA» na lista, que lá não está.
 */
const DOTTED_ACRONYM = /^(?:\p{Lu}\.){2,}$/u;

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

      /*
       * Três formas de dizer «isto não é uma palavra gritada», por ordem de
       * certeza: a regra fechada, a regra de forma, e a lista.
       *
       * **Todas marcam `seenWord`.** Não é detalhe: `seenWord` é o que diz se
       * a próxima palavra ainda é a primeira do título, e a primeira nunca
       * fica em minúscula mesmo sendo preposição. Um ramo que devolva o token
       * sem a marcar faz «XV DE AGOSTO» dar «XV De Agosto» — pior do que o
       * «Xv de Agosto» de hoje, que é o modo de falha mais irritante que uma
       * correção pode ter.
       */
      if (ROMAN_NUMERAL.test(bare) || DOTTED_ACRONYM.test(token) || KNOWN_ACRONYMS.has(bare)) {
        seenWord = true;
        return token;
      }

      const lower = token.toLowerCase();
      const isFirst = !seenWord;
      seenWord = true;
      if (!isFirst && MINOR_WORDS.has(lower)) return lower;

      /*
       * A primeira letra, e a que vem depois de um hífen ou de uma barra.
       *
       * Sem isto, «CINE-TEATRO PARAÍSO» dava «Cine-teatro Paraíso»: o
       * `replace` sem `g` capitalizava só a primeira minúscula do token, e o
       * que vinha depois do hífen ficava por levantar. «Cine-Teatro» é como o
       * espaço se chama, e é como o catálogo o escreve.
       *
       * **O apóstrofo fica de fora, e é de propósito.** Alargar isto a
       * «qualquer não-letra» era a forma natural de o escrever e dava
       * «Km'S» — «VAMOS SOMAR KM'S EM 2026!» é um título real, e está no
       * `text.test.ts` desde antes desta correção.
       */
      return lower.replace(
        /(^|[-–—/])(\p{Ll})/gu,
        (_, antes, letra: string) => `${antes}${letra.toUpperCase()}`,
      );
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
 * A legenda que o ofuscador de emails do Joomla deixa na prosa.
 *
 * O plugin `emailcloak` do Joomla substitui cada endereço de email por um
 * bloco de JavaScript **e** por um texto de recurso para quem não o corra
 * (`JLIB_HTML_CLOAKING`). O `stripTags` da recolha salta o `<script>` — isso
 * está certo e é o que ele faz —, mas a legenda vive num `<span>`, num
 * `<noscript>` ou num `<joomla-hidden-mail>`, e desses o texto passa. O que
 * chega ao público é mobília da plataforma apresentada como programação:
 *
 *   «Inscrições gratuitas até 31 de agosto para Este endereço de email está
 *   protegido contra piratas. Necessita ativar o JavaScript para o
 *   visualizar.»
 *
 * **Nove eventos publicados do Médio Tejo, em cinco concelhos**, tinham-na a
 * 7 de setembro de 2026 — Barquinha, Alcanena, Entroncamento, Mação e Tomar.
 *
 * **Duas frases, e é preciso aceitar as duas.** O Joomla traduz o recurso de
 * formas diferentes conforme a versão: sete eventos dizem «Necessita **ativar**
 * o JavaScript» e dois «Necessita **ter** o JavaScript **autorizado**». Uma
 * regra escrita contra uma delas deixava a outra na rua. Daí a âncora ser o
 * arranque da frase, confirmado pela palavra `javascript` — e não a frase
 * inteira.
 *
 * **Presa a uma frase, de propósito.** As duas regras acima cortam
 * `[\s\S]*$` porque são o fim da ficha; esta não é: a legenda aparece a meio
 * da prosa, e uma regra gulosa comia o resto do texto do evento.
 *
 * **O que fica por arranjar, e é uma decisão.** Removida a legenda, sobra o
 * conector: «Inscrições gratuitas até 31 de agosto para». Apará-lo é editar a
 * prosa da fonte, e uma frase incompleta é verdadeira — a legenda é que não
 * era. Fica.
 *
 * **O que isto não faz, e nunca deve fazer:** apagar endereços de email da
 * descrição. Um email que o organizador escreveu («inscrições por
 * geral@junta.pt») é informação verdadeira do evento; perdê-la é perder campo,
 * que é o mesmo pecado por outro lado.
 */
const OFUSCADOR_DE_EMAIL =
  /\s*(?:este endere[çc]o de e-?mail (?:est[áa]|encontra-se)[^.]*?\.(?:[^.]*?javascript[^.]*?\.)?|this e-?mail address is being protected from spambots\.?[^.]*?javascript[^.]*?(?:\.|$))/gi;

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
 *   3. A legenda do ofuscador de emails do Joomla — «Este endereço de email
 *      está protegido contra piratas. Necessita ativar o JavaScript para o
 *      visualizar.» Nove eventos publicados do Médio Tejo tinham-na no meio da
 *      prosa a 7 de setembro de 2026, em cinco concelhos.
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
    .replace(OFUSCADOR_DE_EMAIL, '')
    // O corte deixa espaço a mais onde a legenda estava. Isto é arrumação
    // mecânica e não edição: junta espaços seguidos e não deixa três linhas
    // em branco onde havia texto.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text.length > 0 ? text : null;
}
