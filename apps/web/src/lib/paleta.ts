/**
 * A cor de cada região, e a paleta que sai dela (C4-006, C4-027).
 *
 * Todas as regiões vestiam o turquesa do Médio Tejo — estava escrito no
 * `@theme` de `globals.css` —, e a página do produto prometia que «cada agenda
 * leva a identidade do seu território». Uma CIM nova, criada no painel, nascia
 * com a cor de outra. A região passa a declarar a sua (`regions.brand_color`,
 * 0167), e o resto da paleta sai dela, aqui, pelas mesmas contas que estavam
 * feitas à mão no comentário do `globals.css`:
 *
 * - **o toldo é a cor tal como a região a publica**, sem correção: é a cor da
 *   marca, e é a mesma de dia e de noite;
 * - **por cima dela vai a tinta que se lê** — branco ou o grafite da casa, a
 *   que tiver mais contraste, e pelo menos 4,5:1. Uma cor onde nenhuma das
 *   duas chega não se aceita (a base recusa-a, e este módulo também);
 * - **o acento é a mesma cor à luz a que se lê**: a mesma matiz, escurecida
 *   até passar os 4,5:1 sobre o papel e sob o branco dos botões — com folga —
 *   e, no tema escuro, clareada até passar sobre o papel escuro;
 * - **o fundo suave é a mesma matiz quase sem cor**, e o acento por cima dele
 *   continua a passar os 4,5:1 (é o par das pílulas «1 evento marcado»).
 *
 * As duas paletas que já existiam, afinadas à mão, ficam como estavam: o
 * turquesa do Médio Tejo e o vermelho do produto. Para essas não se calcula
 * nada — devolve-se o que estava escrito, para nenhuma das duas mudar um byte.
 */

import { CORES_DO_TOLDO } from './marca';

/** Os tokens que mudam de região para região. O resto da casa é de todas. */
export type TokenDaPaleta =
  'brand' | 'on-brand' | 'accent' | 'accent-soft' | 'on-accent' | 'highlight' | 'focus';

export interface Paleta {
  claro: Record<TokenDaPaleta, string>;
  escuro: Omit<Record<TokenDaPaleta, string>, 'brand' | 'on-brand'>;
}

/**
 * A cor de uma região nova: o vermelho do produto, até ela dizer a sua. É o
 * mesmo valor do toldo da montra, e lê-se de lá para não haver dois.
 */
export const COR_POR_OMISSAO: string = CORES_DO_TOLDO.montra;

/** O turquesa do Médio Tejo, que é o `@theme` de `globals.css`. */
export const COR_DO_TEMA: string = CORES_DO_TOLDO.cim;

/** O papel, a superfície e as tintas da casa — os fundos contra os quais se mede. */
const PAPEL = '#f6fafb';
const SUPERFICIE = '#ffffff';
const PAPEL_ESCURO = '#131418';
const SUPERFICIE_ESCURA = '#1c1d24';
const BRANCO = '#ffffff';
const GRAFITE = '#181921';
const TINTA_ESCURA = '#101319';

/** O mínimo AA para texto, e a folga com que se calcula para não ficar à justa. */
export const MINIMO = 4.5;
const FOLGA = 5;

/** As paletas afinadas à mão, que não se recalculam. */
const AFINADAS: Record<string, Paleta> = {
  [COR_DO_TEMA]: {
    claro: {
      brand: '#40c0c4',
      'on-brand': '#181921',
      accent: '#14676b',
      'accent-soft': '#dbf1f2',
      'on-accent': '#ffffff',
      highlight: '#14676b',
      focus: '#14676b',
    },
    escuro: {
      accent: '#40c0c4',
      'accent-soft': '#172d30',
      'on-accent': '#101319',
      highlight: '#40c0c4',
      focus: '#40c0c4',
    },
  },
  [COR_POR_OMISSAO]: {
    claro: {
      brand: '#c2281c',
      'on-brand': '#ffffff',
      accent: '#b3261e',
      'accent-soft': '#fbe6e3',
      'on-accent': '#ffffff',
      highlight: '#b3261e',
      focus: '#b3261e',
    },
    escuro: {
      accent: '#f4806f',
      'accent-soft': '#3a1c19',
      'on-accent': '#101319',
      highlight: '#f4806f',
      focus: '#f4806f',
    },
  },
};

/** `#rrggbb`, e mais nada: é o que a base guarda e o que o CSS recebe. */
export function corValida(cor: string | null | undefined): cor is string {
  return typeof cor === 'string' && /^#[0-9a-f]{6}$/i.test(cor);
}

function rgb(cor: string): [number, number, number] {
  const n = Number.parseInt(cor.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex([r, g, b]: [number, number, number]): string {
  const canal = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

/** A luminância relativa da WCAG 2.1. */
export function luminancia(cor: string): number {
  const [r, g, b] = rgb(cor).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** O contraste entre duas cores, de 1 a 21. */
export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (escuro + 0.05);
}

/**
 * A tinta que se lê por cima da cor da marca: a de mais contraste entre o
 * branco e o grafite, ou `null` quando nenhuma chega aos 4,5:1 — e então a cor
 * não serve para toldo, porque o nome do sítio e a navegação ficavam ilegíveis
 * em cima dela.
 */
export function tintaSobre(marca: string): string | null {
  const [melhor] = [BRANCO, GRAFITE].sort((a, b) => contraste(marca, b) - contraste(marca, a));
  return melhor && contraste(marca, melhor) >= MINIMO ? melhor : null;
}

type Hsl = [number, number, number];

function paraHsl(cor: string): Hsl {
  const [r, g, b] = rgb(cor).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function deHsl([h, s, l]: Hsl): string {
  if (s === 0) return hex([l * 255, l * 255, l * 255]);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canal = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return hex([canal(h + 1 / 3) * 255, canal(h) * 255, canal(h - 1 / 3) * 255]);
}

/** A mesma matiz, com a luz a descer (ou a subir) até `basta` dizer que chega. */
function ajustarLuz(cor: string, sentido: -1 | 1, basta: (candidata: string) => boolean): string {
  const [h, s, l] = paraHsl(cor);
  for (let luz = l; luz >= 0 && luz <= 1; luz += sentido * 0.005) {
    const candidata = deHsl([h, s, luz]);
    if (basta(candidata)) return candidata;
  }
  return sentido < 0 ? '#000000' : '#ffffff';
}

/**
 * A paleta inteira de uma cor de marca, ou `null` quando a cor não serve —
 * mal escrita, ou sem tinta que se leia por cima.
 */
export function paletaDaMarca(marca: string | null | undefined): Paleta | null {
  if (!corValida(marca)) return null;
  const cor = marca.toLowerCase();
  const afinada = AFINADAS[cor];
  if (afinada) return afinada;

  const sobreAMarca = tintaSobre(cor);
  if (!sobreAMarca) return null;
  const [h, s] = paraHsl(cor);

  // Claro: o acento desce até se ler sobre o papel e sob o branco dos botões,
  // e o fundo suave é a matiz quase sem cor, com o acento a ler-se em cima.
  const suave = deHsl([h, Math.min(s, 0.6), 0.93]);
  const acento = ajustarLuz(
    cor,
    -1,
    (c) =>
      contraste(c, PAPEL) >= FOLGA &&
      contraste(c, SUPERFICIE) >= FOLGA &&
      contraste(c, BRANCO) >= FOLGA &&
      contraste(c, suave) >= MINIMO,
  );

  // Escuro: o acento sobe até se ler sobre o papel e a superfície escuros, e
  // a tinta escura dos botões lê-se em cima dele.
  const suaveEscuro = deHsl([h, Math.min(s, 0.45), 0.14]);
  const acentoEscuro = ajustarLuz(
    cor,
    1,
    (c) =>
      contraste(c, PAPEL_ESCURO) >= FOLGA &&
      contraste(c, SUPERFICIE_ESCURA) >= MINIMO &&
      contraste(c, TINTA_ESCURA) >= MINIMO &&
      contraste(c, suaveEscuro) >= MINIMO,
  );

  return {
    claro: {
      brand: cor,
      'on-brand': sobreAMarca,
      accent: acento,
      'accent-soft': suave,
      'on-accent': BRANCO,
      highlight: acento,
      focus: acento,
    },
    escuro: {
      accent: acentoEscuro,
      'accent-soft': suaveEscuro,
      'on-accent': TINTA_ESCURA,
      highlight: acentoEscuro,
      focus: acentoEscuro,
    },
  };
}

/**
 * A folha que veste uma região: os tokens da paleta no âmbito
 * `[data-paleta='regiao']`, nos três estados do tema da casa — claro, escuro
 * pedido, e escuro do sistema sem pedido nenhum —, como o `[data-paleta='montra']`
 * de `globals.css` faz para a página do produto.
 */
export function folhaDaPaleta(paleta: Paleta): string {
  const declarar = (tokens: Partial<Record<TokenDaPaleta, string>>) =>
    Object.entries(tokens)
      .map(([token, valor]) => `--color-${token}:${valor}`)
      .join(';');
  const ambito = "[data-paleta='regiao']";
  return (
    `${ambito}{${declarar(paleta.claro)}}` +
    `:root[data-theme='dark'] ${ambito}{${declarar(paleta.escuro)}}` +
    `@media (prefers-color-scheme: dark){:root:not([data-theme='light']) ${ambito}{${declarar(paleta.escuro)}}}`
  );
}
