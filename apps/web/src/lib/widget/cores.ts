/**
 * A cor que quem embebe escolhe, e o contraste que nós garantimos.
 *
 * Uma câmara tem cor. Se a caixa da agenda entra no sítio dela com o turquesa
 * desta casa, entra como corpo estranho — e é isso que faz um widget parecer
 * um anúncio. Por isso `data-cor` aceita a cor da instituição.
 *
 * Só que uma cor de marca é escolhida para um logótipo, não para texto pequeno
 * sobre fundo claro. O amarelo de uma autarquia costeira dá 1,2:1 contra
 * branco: existe, e não se lê. Aceitar a cor tal e qual seria pôr a assinatura
 * desta casa numa caixa ilegível.
 *
 * O que se faz é isto: a cor entra como foi dada onde é superfície — o fundo
 * de uma pastilha, um filete —, e onde é **texto** é escurecida ou aclarada até
 * passar os 4,5:1 da WCAG contra o fundo em que assenta. Quem escolheu a cor
 * continua a reconhecê-la; quem lê consegue lê-la. Não há aqui escolha entre
 * as duas coisas.
 */

/** `#abc`, `#aabbcc`, `aabbcc`, com ou sem espaços à volta. */
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Normaliza para `#rrggbb` minúsculo, ou nada se não for uma cor. */
export function lerCor(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpo = valor.trim();
  const match = HEX.exec(limpo);
  if (!match) return null;

  const bruto = (match[1] as string).toLowerCase();
  const seis =
    bruto.length === 3
      ? bruto
          .split('')
          .map((c) => c + c)
          .join('')
      : bruto;
  return `#${seis}`;
}

function canais(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function paraHex(canal: number): string {
  return Math.max(0, Math.min(255, Math.round(canal)))
    .toString(16)
    .padStart(2, '0');
}

/**
 * Luminância relativa, tal como a WCAG a define.
 *
 * Não é o brilho ingénuo `(r+g+b)/3`: o olho é muito mais sensível ao verde do
 * que ao azul, e é por isso que o azul-escuro e o verde-escuro com os mesmos
 * números se comportam de maneira diferente sob texto branco.
 */
export function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((canal) => {
    const s = canal / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** O rácio de contraste entre duas cores, de 1 (igual) a 21 (preto e branco). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return (claro + 0.05) / (escuro + 0.05);
}

/** Mistura `cor` com `destino` na proporção dada. */
function misturar(cor: string, destino: string, parte: number): string {
  const a = canais(cor);
  const b = canais(destino);
  return `#${a.map((canal, i) => paraHex(canal + ((b[i] as number) - canal) * parte)).join('')}`;
}

/** O mínimo da WCAG para texto normal. */
const ALVO = 4.5;

/**
 * A mesma cor, puxada até se ler sobre este fundo.
 *
 * Escurece contra fundo claro e aclara contra fundo escuro, em passos de 5%,
 * até chegar aos 4,5:1. Se nem o preto nem o branco lá chegarem — não
 * acontece com fundos reais, mas o código não vive de suposições —, devolve o
 * extremo, que é o melhor que essa cor consegue dar.
 *
 * Uma cor que já passa sai intacta: quem escolheu bem não é corrigido.
 */
export function legivelSobre(cor: string, fundo: string, alvo = ALVO): string {
  if (contraste(cor, fundo) >= alvo) return cor;

  const destino = luminancia(fundo) > 0.5 ? '#000000' : '#ffffff';
  for (let parte = 0.05; parte <= 1; parte += 0.05) {
    const tentativa = misturar(cor, destino, parte);
    if (contraste(tentativa, fundo) >= alvo) return tentativa;
  }
  return destino;
}

/**
 * Preto ou branco por cima desta cor, o que se ler melhor.
 *
 * Para o texto de uma pastilha cheia com a cor da instituição. Aqui não se
 * mexe na cor de fundo — ela é a assinatura — e escolhe-se a tinta.
 */
export function tintaSobre(fundo: string): string {
  return contraste('#ffffff', fundo) >= contraste('#000000', fundo) ? '#ffffff' : '#000000';
}

/** Uma versão muito diluída, para fundos de pastilha e filetes. */
export function suave(cor: string, fundo: string): string {
  return misturar(cor, fundo, luminancia(fundo) > 0.5 ? 0.88 : 0.82);
}

export interface PaletaWidget {
  /** A cor tal como foi dada — superfícies, filetes, pastilhas cheias. */
  marca: string;
  /** A mesma cor, garantidamente legível como texto sobre o fundo. */
  texto: string;
  /** A tinta que se lê por cima de `marca`. */
  contraMarca: string;
  /** Fundo de pastilha: a cor quase dissolvida no papel. */
  fundo: string;
}

/**
 * A paleta completa a partir de uma cor e de um fundo.
 *
 * `null` quando não há cor escolhida — e aí o widget usa os seus próprios
 * tokens, que é o que já fazia.
 */
export function paletaDoWidget(cor: string | null | undefined, fundo: string): PaletaWidget | null {
  const marca = lerCor(cor);
  if (!marca) return null;
  return {
    marca,
    texto: legivelSobre(marca, fundo),
    contraMarca: tintaSobre(marca),
    fundo: suave(marca, fundo),
  };
}
