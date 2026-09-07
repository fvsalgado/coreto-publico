/**
 * Preços em prosa.
 *
 * As fontes quase nunca publicam um número: publicam «Entrada livre»,
 * «12€», «de 8 a 25 euros», «5€ / 3€ (estudantes)». Sem isto, filtrar por
 * «grátis» — que é o filtro mais usado numa agenda de território — não
 * funcionava.
 *
 * A regra que manda aqui é a da casa: **nunca fabricar**. Um preço publicado é
 * uma afirmação sobre quanto alguém vai pagar à porta. Quando a leitura não
 * chega para a fazer, mostra-se a cadeia que a fonte escreveu — o que ela diz,
 * mesmo por formatar, é sempre mais verdadeiro do que um número nosso.
 */

/**
 * O tecto de plausibilidade de um bilhete, e o que ele faz quando dispara.
 *
 * Números grandes em agendas municipais quase nunca são bilhetes: são
 * orçamentos, prémios, apoios. Acima do tecto **não se afirma número nenhum** —
 * nem o número lido, nem uma parte dele. Até 7 de setembro de 2026 o tecto era
 * aplicado ao valor já truncado pelo leitor, e por isso deixava passar
 * exactamente o que devia travar: «1500€» chegava cá como 500, que é igual ao
 * tecto, e publicava-se «500 €».
 *
 * Um bilhete a 501 € existe e fica de fora. Fica de fora com honestidade: o
 * rótulo cai para a cadeia da fonte, que continua a dizer «501€» a quem lê.
 */
const PRICE_CEILING = 500;

const FREE_PATTERNS = [
  /\bentrada\s+(?:livre|gratuita|franca)\b/,
  /\bentrada\s+e\s+livre\b/,
  /\bacesso\s+(?:livre|gratuito)\b/,
  /\bgratuit[oa]s?\b/,
  /\bgratis\b/,
  /\boferta\s+da\s+casa\b/,
  /\bsem\s+custos?\b/,
  /\blivre\s+acesso\b/,
];

/** Contextos em que um número não é um preço de bilhete. */
const NOT_A_PRICE = /\b(?:premio|premios|bolsa|orcamento|investimento|apoio de|financiamento)\b/;

/**
 * Um número de dinheiro, com fronteira dos dois lados.
 *
 * O `\d{1,3}` de antes não tinha fronteira nenhuma, e um motor de expressões
 * regulares que falha numa posição recomeça na seguinte: em «1500€» falhava no
 * `1` e casava a partir do `5`. Media-se, e dava isto — «1500€» → 500 €,
 * «1000€» → 0 € (que o formatador anunciava como entrada livre), «1200 €» →
 * 200 €, «10.000 €» → entrada livre. Ler um número de dentro de outro é a
 * forma mais directa de fabricar que este código tinha.
 *
 * O milhar à portuguesa distingue-se do decimal pelo **número de dígitos** a
 * seguir ao separador, e não há terceira forma: três dígitos são milhar
 * («1.500» e «1 500» são mil e quinhentos), um ou dois são decimal («2.00» e
 * «2,50» são dois euros e dois e meio). É por isso que o `€2.00` do Joomla e o
 * `1.500 €` de um orçamento podem viver na mesma regra.
 *
 * O espaço aparece cá dentro sem os seus primos tipográficos porque o `fold`
 * já normalizou tudo o que é espaço num espaço só.
 */
const NUMERO = String.raw`(?<![\d.,])(?:\d{1,3}(?:[. ]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d,])`;

const RANGE_RE = new RegExp(
  `(${NUMERO})\\s*(?:€|euros?)?\\s*(?:a|-|ate|–|—|/)\\s*(${NUMERO})\\s*(?:€|euros?)`,
  'g',
);
const SINGLE_RE = new RegExp(`(?:€\\s*(${NUMERO})|(${NUMERO})\\s*(?:€|euros?\\b))`, 'g');

function fold(input: string): string {
  return input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const semMilhar = value.replace(/[. ](\d{3})(?!\d)/g, '$1');
  const parsed = Number.parseFloat(semMilhar.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export interface ParsedPrice {
  isFree?: boolean;
  priceMin?: number;
  priceMax?: number;
}

function lerValores(folded: string): number[] {
  const amounts: number[] = [];
  for (const match of folded.matchAll(RANGE_RE)) {
    for (const value of [toNumber(match[1]), toNumber(match[2])]) {
      if (value !== null) amounts.push(value);
    }
  }
  if (amounts.length > 0) return amounts;
  for (const match of folded.matchAll(SINGLE_RE)) {
    const value = toNumber(match[1] ?? match[2]);
    if (value !== null) amounts.push(value);
  }
  return amounts;
}

/**
 * Lê um texto só, e diz se pode vetá-lo por contexto.
 *
 * O veto (`NOT_A_PRICE`) existe para a **prosa**, onde «prémio» e «orçamento»
 * aparecem ao lado de números que não são bilhetes. Aplicá-lo ao campo que a
 * fonte dedicou ao preço era deitar fora a única informação boa que havia.
 */
function lerPreco(texto: string | null | undefined, vetavel: boolean): ParsedPrice {
  if (!texto?.trim()) return {};
  const folded = fold(texto);
  if (vetavel && NOT_A_PRICE.test(folded)) return {};

  const amounts = lerValores(folded);
  const foraDeEscala = amounts.some((value) => value < 0 || value > PRICE_CEILING);

  const out: ParsedPrice = {};
  if (amounts.length > 0 && !foraDeEscala) {
    out.priceMin = Math.min(...amounts);
    out.priceMax = Math.max(...amounts);
  }

  // Um zero literal é uma declaração de gratuitidade tão boa como a palavra —
  // e agora é uma declaração de confiança, porque depois da âncora acima já
  // não existe o zero que vinha truncado de «1000€».
  const pago = amounts.some((value) => value > 0);
  const zeroHonesto = !foraDeEscala && amounts.length > 0 && amounts.every((value) => value === 0);
  if (!pago && (zeroHonesto || FREE_PATTERNS.some((re) => re.test(folded)))) {
    out.isFree = true;
    if (out.priceMin === undefined) out.priceMin = 0;
  }
  return out;
}

function decidiu(price: ParsedPrice): boolean {
  return price.isFree !== undefined || price.priceMin !== undefined;
}

/**
 * Lê `priceMin`/`priceMax`/`isFree` do campo do preço e, em último caso, da prosa.
 *
 * **Os dois textos não valem o mesmo, e é essa a correção de 7 de setembro de
 * 2026.** Até aqui a função juntava-os numa cadeia só e julgava o conjunto: um
 * «prémio» na descrição vetava o campo do preço, e o Coreto publicava «€2.00»
 * em vez de «2 €» no XXIX Grande Prémio do Museu Nacional Ferroviário — o
 * único evento do catálogo com rótulo de preço em forma estrangeira. A ficha
 * dizia «€2.00» e os dados estruturados da mesma página diziam 2. O campo do
 * preço é o que a fonte dedicou à pergunta; a prosa é onde ela fala de outra
 * coisa. Lê-se o primeiro sozinho, e só se ele não decidir se vai à segunda.
 *
 * Um valor pago ganha sempre à palavra «gratuito»: as agendas anunciam a toda
 * a hora «entrada livre para menores de 12» ao lado de um bilhete a sério.
 */
export function parsePrice(priceRaw?: string | null, description?: string | null): ParsedPrice {
  const doCampo = lerPreco(priceRaw, false);
  if (decidiu(doCampo)) return doCampo;
  return lerPreco(description, true);
}

/** Rótulo curto para mostrar no cartão do evento. */
export function formatPrice(price: ParsedPrice, fallback?: string | null): string | null {
  if (price.isFree) return 'Entrada livre';
  const { priceMin, priceMax } = price;
  if (priceMin === undefined) return fallback ?? null;
  /*
   * Um zero sozinho **sem gratuitidade declarada** é leitura falhada, e não um
   * bilhete a zero euros.
   *
   * Esta linha dizia «Entrada livre», e era o segundo juiz da gratuitidade:
   * `is_free` saía de `parsePrice` e o rótulo saía daqui, com regras
   * diferentes. Juntando-se ao número lido de dentro de outro, «1000€»
   * publicava-se como entrada livre — o pior engano que uma agenda pode
   * cometer, porque manda alguém à porta sem dinheiro.
   *
   * Dizer «0 €» também não serve: seria afirmar um preço que ninguém escreveu.
   * Quem lê um zero honesto («0€») sai de `parsePrice` já com `isFree`, e
   * apanha o `return` de cima. O resto cai para a cadeia da fonte.
   *
   * Um intervalo que começa em zero — «de 0 a 5 euros» — não passa por aqui:
   * tem `priceMax` e continua a desenhar-se «0 € – 5 €».
   */
  if (priceMin === 0 && (priceMax === undefined || priceMax === 0)) return fallback ?? null;
  if (priceMax === undefined || priceMax === priceMin) return escreverEuros(priceMin);
  return `${escreverEuros(priceMin)} – ${escreverEuros(priceMax)}`;
}

/**
 * Um número em euros, à portuguesa: vírgula decimal, e sem os cêntimos quando
 * são zero.
 *
 * Está exportado porque não era o único sítio a escrever dinheiro. O
 * `formatOffer` do leitor de JSON-LD (`packages/ingest/src/html.ts`) fazia-o
 * com uma interpolação — `${low} ${currency}` —, e uma oferta de 7,50 saía de
 * lá como «7.5 €». Duas formas de escrever a mesma coisa é uma a mais.
 */
export function escreverEuros(value: number): string {
  return `${value.toFixed(2).replace('.', ',').replace(',00', '')} €`;
}
