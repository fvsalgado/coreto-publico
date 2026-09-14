/**
 * O `robots.txt`, lido como ele é e não como se gostaria que fosse.
 *
 * Durante meses esta casa não o leu, e dizia-o por escrito na `/fontes` — o
 * que era honesto e era pouco. A decisão de o passar a cumprir foi do dono, e
 * veio depois de se medir o que custava: o `robots.txt` das quarenta fontes,
 * contado antes de se escrever uma linha disto.
 *
 * **A norma é a RFC 9309**, e as partes que importam são quatro:
 *
 *   1. O ficheiro divide-se em grupos. Cada grupo abre com uma ou mais linhas
 *      `User-agent:` e segue com `Allow:` e `Disallow:`. Uma linha de agente
 *      depois de uma regra começa um grupo novo.
 *   2. **Vale um grupo só** — o mais específico que case com quem bate à
 *      porta. O `*` é a rede de segurança e só conta quando nenhum outro casa.
 *   3. Dentro do grupo escolhido ganha a **regra mais comprida** que case com
 *      o caminho. Empate ganha o `Allow` — é a leitura da norma e é a
 *      prudente, porque quem escreveu as duas quis deixar passar.
 *   4. `*` casa qualquer sequência e `$` prende o fim do caminho. `Disallow:`
 *      sem valor não proíbe nada; é a forma de dizer «pode tudo».
 *
 * **O que não se faz aqui, de propósito:** não se procura um grupo cujo nome
 * *pareça* o nosso. O agente desta casa é `Coreto`, e só casa com `coreto`
 * escrito por extenso ou com `*`. Um grupo escrito para `CoretoBot` ou para
 * `Core` não é para nós, e apanhá-lo seria obedecer a uma ordem que ninguém
 * nos deu — ou, pior, ignorar uma que nos deram.
 */

/** Uma regra de caminho, como o ficheiro a escreveu. */
interface Regra {
  readonly permite: boolean;
  readonly padrao: string;
}

/** O que se guarda de um `robots.txt` já lido. */
export interface RegrasDoRobots {
  /** As regras do grupo que nos diz respeito, já escolhido. */
  readonly regras: readonly Regra[];
  /** Que grupo ganhou — para se poder dizer porquê, num registo. */
  readonly grupo: string | null;
}

/** Um ficheiro que não impõe nada. */
export const SEM_RESTRICOES: RegrasDoRobots = { regras: [], grupo: null };

/** O nome por que esta casa se dá a conhecer num `robots.txt`. */
export const PRODUTO = 'coreto';

interface Grupo {
  agentes: string[];
  regras: Regra[];
}

/**
 * Lê o texto de um `robots.txt` e fica com o grupo que nos diz respeito.
 *
 * Tudo o que não seja `user-agent`, `allow` ou `disallow` é ignorado em
 * silêncio — `sitemap`, `crawl-delay` e o que mais lá venha. Ignorar não é
 * desprezar: são campos que esta função não promete tratar, e prometer de
 * menos é melhor do que fingir.
 */
export function lerRobots(texto: string, produto: string = PRODUTO): RegrasDoRobots {
  const grupos: Grupo[] = [];
  let atual: Grupo | null = null;
  // Uma linha de agente **depois** de uma regra abre um grupo novo; antes de
  // qualquer regra, junta-se ao grupo que está a ser montado. É isto que faz
  // «User-agent: a» e «User-agent: b» seguidos partilharem as mesmas regras.
  let aColecionarAgentes = false;

  for (const bruta of texto.split(/\r?\n/)) {
    // O comentário pode vir a meio da linha, e o valor acaba onde ele começa.
    const linha = bruta.split('#')[0]?.trim() ?? '';
    if (!linha) continue;

    const separador = linha.indexOf(':');
    if (separador < 0) continue;

    const campo = linha.slice(0, separador).trim().toLowerCase();
    const valor = linha.slice(separador + 1).trim();

    if (campo === 'user-agent' || campo === 'useragent') {
      if (!aColecionarAgentes || !atual) {
        atual = { agentes: [], regras: [] };
        grupos.push(atual);
        aColecionarAgentes = true;
      }
      if (valor) atual.agentes.push(valor.toLowerCase());
      continue;
    }

    if (campo !== 'allow' && campo !== 'disallow') continue;
    // Uma regra sem grupo nenhum antes dela não pertence a ninguém.
    if (!atual) continue;
    aColecionarAgentes = false;

    // `Disallow:` vazio é «pode tudo» e não é uma proibição de nada; guardar
    // o padrão vazio só encheria a lista de regras que nunca casam.
    if (!valor) continue;
    atual.regras.push({ permite: campo === 'allow', padrao: valor });
  }

  const alvo = produto.toLowerCase();
  const especifico = grupos.filter((g) => g.agentes.includes(alvo));
  const genericos = grupos.filter((g) => g.agentes.includes('*'));

  // Um sítio pode escrever o mesmo agente em dois blocos separados; as regras
  // dos dois valem, e é isso que `flatMap` faz.
  if (especifico.length > 0) {
    return { regras: especifico.flatMap((g) => g.regras), grupo: alvo };
  }
  if (genericos.length > 0) {
    return { regras: genericos.flatMap((g) => g.regras), grupo: '*' };
  }
  return SEM_RESTRICOES;
}

/**
 * O padrão do ficheiro, traduzido para uma expressão que case caminhos.
 *
 * Só `*` e `$` são especiais. Tudo o resto vai escapado, porque um caminho
 * verdadeiro traz parênteses, pontos e sinais de mais, e nenhum deles quer
 * dizer ali o que quer dizer numa expressão regular.
 */
function paraExpressao(padrao: string): RegExp {
  let fonte = '';
  for (let i = 0; i < padrao.length; i += 1) {
    const c = padrao[i]!;
    if (c === '*') {
      fonte += '.*';
    } else if (c === '$' && i === padrao.length - 1) {
      fonte += '$';
    } else {
      fonte += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp('^' + fonte);
}

/**
 * O comprimento com que uma regra disputa a especificidade.
 *
 * A norma manda contar os caracteres do padrão, e o `*` conta como um. O `$`
 * final não conta: prende o fim, não acrescenta caminho.
 */
function peso(padrao: string): number {
  return padrao.endsWith('$') ? padrao.length - 1 : padrao.length;
}

/**
 * Se o caminho pode ser lido, à luz das regras já escolhidas.
 *
 * Recebe o caminho com a interrogação e o que vem depois dela — o `robots.txt`
 * fala de caminhos, e `\/api\/index.php?service=list_eventos` é um caminho
 * diferente de `\/api\/index.php`. Deitar fora a interrogação faria uma regra
 * escrita para a consulta deixar de casar.
 */
export function podeLer(regras: RegrasDoRobots, caminho: string): boolean {
  let melhor: Regra | null = null;
  let melhorPeso = -1;

  for (const regra of regras.regras) {
    if (!paraExpressao(regra.padrao).test(caminho)) continue;
    const p = peso(regra.padrao);
    // Empate ganha o `Allow`: quem escreveu as duas regras para o mesmo
    // caminho quis deixar passar, e na dúvida é a leitura que não inventa
    // uma proibição.
    if (p > melhorPeso || (p === melhorPeso && regra.permite && !melhor?.permite)) {
      melhor = regra;
      melhorPeso = p;
    }
  }

  return melhor ? melhor.permite : true;
}

/** O caminho de um endereço, como o `robots.txt` o entende. */
export function caminhoDe(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return '/';
  }
}

/** O endereço do `robots.txt` que manda num endereço qualquer. */
export function robotsDe(url: string): string | null {
  try {
    return new URL('/robots.txt', url).toString();
  } catch {
    return null;
  }
}
