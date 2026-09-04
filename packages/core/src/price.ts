/**
 * Preços em prosa.
 *
 * As fontes quase nunca publicam um número: publicam «Entrada livre»,
 * «12€», «de 8 a 25 euros», «5€ / 3€ (estudantes)». Sem isto, filtrar por
 * «grátis» — que é o filtro mais usado numa agenda de território — não
 * funcionava.
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

const RANGE_RE =
  /(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|euros?)?\s*(?:a|-|ate|–|—|\/)\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|euros?)/g;
const SINGLE_RE = /(?:€\s*(\d{1,3}(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|euros?\b))/g;

function fold(input: string): string {
  return input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export interface ParsedPrice {
  isFree?: boolean;
  priceMin?: number;
  priceMax?: number;
}

/**
 * Lê `priceMin`/`priceMax`/`isFree` de um ou mais textos.
 *
 * Devolve apenas as chaves de que tem confiança. Um valor pago ganha sempre à
 * palavra «gratuito»: as agendas anunciam a toda a hora «entrada livre para
 * menores de 12» ao lado de um bilhete a sério.
 */
export function parsePrice(...texts: Array<string | null | undefined>): ParsedPrice {
  const joined = texts.filter(Boolean).join(' \n ');
  if (!joined.trim()) return {};
  const folded = fold(joined);
  if (NOT_A_PRICE.test(folded)) return {};

  const amounts: number[] = [];
  for (const match of folded.matchAll(RANGE_RE)) {
    for (const value of [toNumber(match[1]), toNumber(match[2])]) {
      if (value !== null) amounts.push(value);
    }
  }
  if (amounts.length === 0) {
    for (const match of folded.matchAll(SINGLE_RE)) {
      const value = toNumber(match[1] ?? match[2]);
      if (value !== null) amounts.push(value);
    }
  }

  const usable = amounts.filter((value) => value >= 0 && value <= PRICE_CEILING);
  const out: ParsedPrice = {};
  if (usable.length > 0) {
    out.priceMin = Math.min(...usable);
    out.priceMax = Math.max(...usable);
  }

  if (FREE_PATTERNS.some((re) => re.test(folded)) && !usable.some((value) => value > 0)) {
    out.isFree = true;
    if (out.priceMin === undefined) out.priceMin = 0;
  }
  return out;
}

/** Rótulo curto para mostrar no cartão do evento. */
export function formatPrice(price: ParsedPrice, fallback?: string | null): string | null {
  if (price.isFree) return 'Entrada livre';
  const { priceMin, priceMax } = price;
  if (priceMin === undefined) return fallback ?? null;
  if (priceMin === 0 && (priceMax === undefined || priceMax === 0)) return 'Entrada livre';
  const format = (value: number): string =>
    `${value.toFixed(2).replace('.', ',').replace(',00', '')} €`;
  if (priceMax === undefined || priceMax === priceMin) return format(priceMin);
  return `${format(priceMin)} – ${format(priceMax)}`;
}
