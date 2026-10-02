/**
 * Um código QR, desenhado aqui e sem dependências (C2-032, C4-022).
 *
 * O cartaz A4 da semana leva um QR para a agenda do concelho: é o que faz de
 * uma folha afixada no café uma porta para o sítio. Uma biblioteca de QR seria
 * a primeira dependência do sítio para desenhar uma figura que a norma define
 * por inteiro — e esta casa já escreve o que é pequeno e fechado em vez de o
 * importar (o leitor de PDF do email, o iCal, o leitor de HTML da recolha).
 * Este é pequeno e fechado: um modo, um nível de correção, dez versões.
 *
 * O que faz, e só isto (ISO/IEC 18004, a mesma ordem de passos da norma):
 *
 * - **modo byte**, com o texto em UTF-8. Um endereço tem minúsculas, e o modo
 *   alfanumérico só tem maiúsculas: para endereços, é o byte ou nada;
 * - **correção M** — recupera cerca de 15 % do símbolo, o nível que se usa
 *   para papel: uma folha afixada apanha dobras, fita-cola e sol;
 * - **versões 1 a 10**, a mais pequena onde o texto cabe. A 10 leva 213 bytes
 *   em M; o endereço de um concelho anda pelos 50. Acima disso, recusa — um
 *   QR que não se lê é pior do que nenhum, e um endereço desse tamanho é um
 *   erro a corrigir na origem, não um símbolo a desenhar;
 * - **as oito máscaras**, e escolhe-se a de menor penalização, pelas quatro
 *   regras da norma.
 *
 * O teste (`qr.test.ts`) confere o desenho, módulo a módulo, contra o de uma
 * implementação de referência, e o símbolo foi lido por um descodificador
 * independente quando isto se escreveu.
 */

/** Os códigos de correção, por versão (1 a 10), no nível M. */
const ECC_POR_BLOCO = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26] as const;
const BLOCOS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5] as const;

/** O nível M nos bits de formato (L = 01, M = 00, Q = 11, H = 10). */
const NIVEL_M = 0b00;

export const VERSAO_MAXIMA = 10;

/** Um QR desenhado: `modulos[y][x]` é `true` onde o módulo é escuro. */
export interface CodigoQR {
  versao: number;
  mascara: number;
  tamanho: number;
  modulos: boolean[][];
}

/* -------- Aritmética no corpo de Galois GF(2⁸), módulo 0x11D -------------- */

function multiplicar(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

/** O divisor de Reed–Solomon de um dado grau (coeficientes do maior para o menor, sem o 1 de cabeça). */
function divisor(grau: number): number[] {
  const resultado: number[] = new Array(grau).fill(0);
  resultado[grau - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grau; i++) {
    for (let j = 0; j < resultado.length; j++) {
      resultado[j] = multiplicar(resultado[j] as number, raiz);
      if (j + 1 < resultado.length)
        resultado[j] = (resultado[j] as number) ^ (resultado[j + 1] as number);
    }
    raiz = multiplicar(raiz, 0x02);
  }
  return resultado;
}

/** O resto da divisão dos dados pelo divisor: os códigos de correção do bloco. */
function resto(dados: readonly number[], div: readonly number[]): number[] {
  const resultado: number[] = new Array(div.length).fill(0);
  for (const byte of dados) {
    const fator = byte ^ (resultado.shift() as number);
    resultado.push(0);
    div.forEach((coeficiente, i) => {
      resultado[i] = (resultado[i] as number) ^ multiplicar(coeficiente, fator);
    });
  }
  return resultado;
}

/* -------- Capacidades ------------------------------------------------------ */

/** Quantos módulos de dados (e correção) cabem numa versão, tirados os padrões fixos. */
function modulosDeDados(versao: number): number {
  let resultado = (16 * versao + 128) * versao + 64;
  if (versao >= 2) {
    const alinhamentos = Math.floor(versao / 7) + 2;
    resultado -= (25 * alinhamentos - 10) * alinhamentos - 55;
    if (versao >= 7) resultado -= 36;
  }
  return resultado;
}

function codewordsDeDados(versao: number): number {
  return (
    Math.floor(modulosDeDados(versao) / 8) -
    (ECC_POR_BLOCO[versao] as number) * (BLOCOS[versao] as number)
  );
}

/** As posições dos centros dos padrões de alinhamento, numa linha ou coluna. */
function posicoesDeAlinhamento(versao: number): number[] {
  if (versao === 1) return [];
  const tamanho = versao * 4 + 17;
  const quantos = Math.floor(versao / 7) + 2;
  const passo = Math.ceil((versao * 4 + 4) / (quantos * 2 - 2)) * 2;
  const resultado = [6];
  for (let pos = tamanho - 7; resultado.length < quantos; pos -= passo) {
    resultado.splice(1, 0, pos);
  }
  return resultado;
}

/* -------- Os bits ---------------------------------------------------------- */

function juntarBits(bits: number[], valor: number, quantos: number): void {
  for (let i = quantos - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
}

/** Os codewords de dados: modo, contagem, o texto, o terminador e o enchimento. */
function codewords(bytes: Uint8Array, versao: number): number[] {
  const capacidade = codewordsDeDados(versao) * 8;
  const bits: number[] = [];
  juntarBits(bits, 0b0100, 4);
  juntarBits(bits, bytes.length, versao <= 9 ? 8 : 16);
  for (const byte of bytes) juntarBits(bits, byte, 8);
  juntarBits(bits, 0, Math.min(4, capacidade - bits.length));
  juntarBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let enchimento = 0xec; bits.length < capacidade; enchimento ^= 0xec ^ 0x11) {
    juntarBits(bits, enchimento, 8);
  }
  const resultado: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] as number);
    resultado.push(byte);
  }
  return resultado;
}

/** Divide em blocos, junta a correção de cada um, e entrelaça como a norma manda. */
function comCorrecao(dados: readonly number[], versao: number): number[] {
  const blocos = BLOCOS[versao] as number;
  const eccPorBloco = ECC_POR_BLOCO[versao] as number;
  const total = Math.floor(modulosDeDados(versao) / 8);
  const curtos = blocos - (total % blocos);
  const tamanhoCurto = Math.floor(total / blocos);
  const div = divisor(eccPorBloco);

  const todos: number[][] = [];
  let k = 0;
  for (let i = 0; i < blocos; i++) {
    const parte = dados.slice(k, k + tamanhoCurto - eccPorBloco + (i < curtos ? 0 : 1));
    k += parte.length;
    const ecc = resto(parte, div);
    // O bloco curto leva um lugar vago, para os blocos ficarem alinhados ao
    // entrelaçar; o lugar salta-se lá em baixo.
    todos.push([...parte, ...(i < curtos ? [0] : []), ...ecc]);
  }

  const resultado: number[] = [];
  for (let i = 0; i < (todos[0] as number[]).length; i++) {
    todos.forEach((bloco, j) => {
      if (i !== tamanhoCurto - eccPorBloco || j >= curtos) resultado.push(bloco[i] as number);
    });
  }
  return resultado;
}

/* -------- O desenho --------------------------------------------------------- */

class Grelha {
  readonly tamanho: number;
  readonly modulos: boolean[][];
  /** Os módulos dos padrões fixos — os dados e a máscara passam-lhes ao lado. */
  readonly fixo: boolean[][];

  constructor(tamanho: number) {
    this.tamanho = tamanho;
    this.modulos = Array.from({ length: tamanho }, () => new Array<boolean>(tamanho).fill(false));
    this.fixo = Array.from({ length: tamanho }, () => new Array<boolean>(tamanho).fill(false));
  }

  fixar(x: number, y: number, escuro: boolean): void {
    (this.modulos[y] as boolean[])[x] = escuro;
    (this.fixo[y] as boolean[])[x] = true;
  }
}

function desenharPadroes(grelha: Grelha, versao: number): void {
  const { tamanho } = grelha;
  // Os padrões de temporização.
  for (let i = 0; i < tamanho; i++) {
    grelha.fixar(6, i, i % 2 === 0);
    grelha.fixar(i, 6, i % 2 === 0);
  }
  // Os três olhos, com a margem clara à volta.
  for (const [cx, cy] of [
    [3, 3],
    [tamanho - 4, 3],
    [3, tamanho - 4],
  ] as const) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const distancia = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < tamanho && y >= 0 && y < tamanho) {
          grelha.fixar(x, y, distancia !== 2 && distancia !== 4);
        }
      }
    }
  }
  // Os alinhamentos, menos os três que cairiam em cima dos olhos.
  const posicoes = posicoesDeAlinhamento(versao);
  const ultimo = posicoes.length - 1;
  posicoes.forEach((px, i) => {
    posicoes.forEach((py, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === ultimo) || (i === ultimo && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          grelha.fixar(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    });
  });
  // Reserva o lugar do formato (desenhado a sério depois de escolhida a máscara).
  desenharFormato(grelha, 0);
  if (versao >= 7) desenharVersao(grelha, versao);
}

function bit(valor: number, i: number): boolean {
  return ((valor >>> i) & 1) !== 0;
}

/** Os 15 bits do formato — nível e máscara, com o BCH(15,5) — nas duas cópias. */
function desenharFormato(grelha: Grelha, mascara: number): void {
  const { tamanho } = grelha;
  const dados = (NIVEL_M << 3) | mascara;
  let r = dados;
  for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
  const bits = ((dados << 10) | r) ^ 0x5412;

  for (let i = 0; i <= 5; i++) grelha.fixar(8, i, bit(bits, i));
  grelha.fixar(8, 7, bit(bits, 6));
  grelha.fixar(8, 8, bit(bits, 7));
  grelha.fixar(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) grelha.fixar(14 - i, 8, bit(bits, i));

  for (let i = 0; i < 8; i++) grelha.fixar(tamanho - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) grelha.fixar(8, tamanho - 15 + i, bit(bits, i));
  // O módulo escuro, sempre escuro.
  grelha.fixar(8, tamanho - 8, true);
}

/** Os 18 bits da versão (a partir da 7), com o BCH(18,6), nos dois cantos. */
function desenharVersao(grelha: Grelha, versao: number): void {
  let r = versao;
  for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
  const bits = (versao << 12) | r;
  for (let i = 0; i < 18; i++) {
    const a = grelha.tamanho - 11 + (i % 3);
    const b = Math.floor(i / 3);
    grelha.fixar(a, b, bit(bits, i));
    grelha.fixar(b, a, bit(bits, i));
  }
}

/** Os dados em ziguezague, duas colunas de cada vez, de baixo para cima e de volta. */
function desenharDados(grelha: Grelha, dados: readonly number[]): void {
  const { tamanho } = grelha;
  let i = 0;
  for (let direita = tamanho - 1; direita >= 1; direita -= 2) {
    if (direita === 6) direita = 5;
    for (let vertical = 0; vertical < tamanho; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = direita - j;
        const subir = ((direita + 1) & 2) === 0;
        const y = subir ? tamanho - 1 - vertical : vertical;
        if (!(grelha.fixo[y] as boolean[])[x] && i < dados.length * 8) {
          (grelha.modulos[y] as boolean[])[x] = bit(dados[i >>> 3] as number, 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

const MASCARAS: ReadonlyArray<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Aplica (ou desfaz — é a mesma operação) uma máscara aos módulos de dados. */
function aplicarMascara(grelha: Grelha, mascara: number): void {
  const inverter = MASCARAS[mascara] as (x: number, y: number) => boolean;
  for (let y = 0; y < grelha.tamanho; y++) {
    for (let x = 0; x < grelha.tamanho; x++) {
      if (!(grelha.fixo[y] as boolean[])[x] && inverter(x, y)) {
        (grelha.modulos[y] as boolean[])[x] = !(grelha.modulos[y] as boolean[])[x];
      }
    }
  }
}

/* -------- A penalização, pelas quatro regras da norma ------------------------ */

function contarPadroesDeOlho(historia: readonly number[]): number {
  const n = historia[1] as number;
  const nucleo =
    n > 0 && historia[2] === n && historia[3] === n * 3 && historia[4] === n && historia[5] === n;
  return (
    (nucleo && (historia[0] as number) >= n * 4 && (historia[6] as number) >= n ? 1 : 0) +
    (nucleo && (historia[6] as number) >= n * 4 && (historia[0] as number) >= n ? 1 : 0)
  );
}

function penalizacao(grelha: Grelha): number {
  const { tamanho, modulos } = grelha;
  let total = 0;

  const juntarHistoria = (corrida: number, historia: number[]) => {
    // A primeira corrida conta com a margem clara de fora.
    const comMargem = historia[0] === 0 ? corrida + tamanho : corrida;
    historia.pop();
    historia.unshift(comMargem);
  };
  const fecharEContar = (escura: boolean, corrida: number, historia: number[]) => {
    let resto = corrida;
    if (escura) {
      juntarHistoria(resto, historia);
      resto = 0;
    }
    juntarHistoria(resto + tamanho, historia);
    return contarPadroesDeOlho(historia);
  };

  // Regras 1 e 3, por linhas e por colunas.
  for (const porLinha of [true, false]) {
    for (let a = 0; a < tamanho; a++) {
      let cor = false;
      let corrida = 0;
      const historia = [0, 0, 0, 0, 0, 0, 0];
      for (let b = 0; b < tamanho; b++) {
        const modulo = porLinha ? (modulos[a] as boolean[])[b] : (modulos[b] as boolean[])[a];
        if (modulo === cor) {
          corrida++;
          if (corrida === 5) total += 3;
          else if (corrida > 5) total++;
        } else {
          juntarHistoria(corrida, historia);
          if (!cor) total += contarPadroesDeOlho(historia) * 40;
          cor = modulo as boolean;
          corrida = 1;
        }
      }
      total += fecharEContar(cor, corrida, historia) * 40;
    }
  }

  // Regra 2: blocos de 2 × 2 da mesma cor.
  for (let y = 0; y < tamanho - 1; y++) {
    for (let x = 0; x < tamanho - 1; x++) {
      const cor = (modulos[y] as boolean[])[x];
      if (
        cor === (modulos[y] as boolean[])[x + 1] &&
        cor === (modulos[y + 1] as boolean[])[x] &&
        cor === (modulos[y + 1] as boolean[])[x + 1]
      ) {
        total += 3;
      }
    }
  }

  // Regra 4: o equilíbrio entre escuros e claros.
  let escuros = 0;
  for (const linha of modulos) for (const modulo of linha) if (modulo) escuros++;
  const area = tamanho * tamanho;
  total += (Math.ceil(Math.abs(escuros * 20 - area * 10) / area) - 1) * 10;
  return total;
}

/* -------- A entrada --------------------------------------------------------- */

/**
 * O QR de um texto, no nível M, na versão mais pequena em que caiba.
 *
 * `mascara` força uma das oito — só para o teste comparar com a referência;
 * quem desenha deixa a escolha à penalização. Devolve `null` quando o texto
 * não cabe na versão 10.
 */
export function codigoQR(texto: string, mascara?: number): CodigoQR | null {
  const bytes = new TextEncoder().encode(texto);
  let versao = 0;
  for (let v = 1; v <= VERSAO_MAXIMA; v++) {
    const bitsUsados = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
    if (bitsUsados <= codewordsDeDados(v) * 8) {
      versao = v;
      break;
    }
  }
  if (versao === 0) return null;

  const grelha = new Grelha(versao * 4 + 17);
  desenharPadroes(grelha, versao);
  desenharDados(grelha, comCorrecao(codewords(bytes, versao), versao));

  let escolhida = mascara ?? -1;
  if (escolhida < 0) {
    let menor = Number.POSITIVE_INFINITY;
    for (let m = 0; m < MASCARAS.length; m++) {
      aplicarMascara(grelha, m);
      desenharFormato(grelha, m);
      const pontos = penalizacao(grelha);
      if (pontos < menor) {
        menor = pontos;
        escolhida = m;
      }
      aplicarMascara(grelha, m);
    }
  }
  aplicarMascara(grelha, escolhida);
  desenharFormato(grelha, escolhida);

  return { versao, mascara: escolhida, tamanho: grelha.tamanho, modulos: grelha.modulos };
}

/**
 * O desenho em SVG: um só caminho, com a margem clara de quatro módulos que a
 * norma exige à volta — sem ela, a câmara não acha os olhos.
 *
 * Em `viewBox` de módulos e não de píxeis: o tamanho escolhe-o quem o põe na
 * página, e em papel é o milímetro que manda. `crispEdges` para os módulos
 * vizinhos não deixarem uma linha clara entre eles ao serem escalados.
 */
export function caminhoDoQR(codigo: CodigoQR, margem = 4): { viewBox: string; d: string } {
  const partes: string[] = [];
  codigo.modulos.forEach((linha, y) => {
    let x = 0;
    while (x < linha.length) {
      if (!linha[x]) {
        x++;
        continue;
      }
      // Uma corrida de módulos escuros na mesma linha é um retângulo só.
      let fim = x;
      while (fim < linha.length && linha[fim]) fim++;
      partes.push(`M${x + margem} ${y + margem}h${fim - x}v1h-${fim - x}z`);
      x = fim;
    }
  });
  const lado = codigo.tamanho + margem * 2;
  return { viewBox: `0 0 ${lado} ${lado}`, d: partes.join('') };
}
