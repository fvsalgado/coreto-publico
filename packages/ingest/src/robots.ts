/**
 * O `robots.txt`, lido como ele é e não como se gostaria que fosse.
 *
 * Durante meses esta casa não o leu, e dizia-o por escrito na `/fontes` — o
 * que era honesto e era pouco. A decisão de o passar a cumprir foi do dono, e
 * veio depois de se medir o que custava: o `robots.txt` das quarenta fontes,
 * contado antes de se escrever uma linha disto. Trinta e duas responderam, e
 * as trinta e duas deixam ler a agenda.
 *
 * **A norma é a RFC 9309**, e as partes que importam são cinco:
 *
 *   1. O ficheiro divide-se em grupos. Cada grupo abre com uma ou mais linhas
 *      `User-agent:` e segue com `Allow:` e `Disallow:`. Uma linha de agente
 *      depois de uma regra começa um grupo novo.
 *   2. **Vale um grupo só** — o mais específico que case com quem bate à
 *      porta. O `*` é a rede de segurança e só conta quando nenhum outro casa.
 *   3. Dentro do grupo escolhido ganha a regra com **mais octetos** que case
 *      com o caminho. Empate ganha o `Allow`.
 *   4. `*` casa qualquer sequência e `$` prende o fim do caminho. `Disallow:`
 *      sem valor não proíbe nada.
 *   5. Antes de comparar, **normaliza-se dos dois lados** (§2.2.2). Um caminho
 *      com acentos chega aqui percent-encodado pelo `URL`, e uma regra escrita
 *      à mão chega em texto: sem normalizar, nunca casariam.
 *
 * **O que não se faz aqui, de propósito:** não se procura um grupo cujo nome
 * *pareça* o nosso. O produto desta casa é `Coreto`, e só casa com `coreto` ou
 * com `*`. Um grupo escrito para `CoretoBot` não é para nós, e apanhá-lo seria
 * obedecer a uma ordem que ninguém nos deu.
 *
 * **Este ficheiro foi atacado antes de entrar.** Seis agentes — três a partir,
 * três a julgar o que os primeiros diziam — confrontaram-no com a letra da RFC
 * e com ficheiros do mundo real. O que se segue leva as correções que
 * sobreviveram ao julgamento, cada uma anotada onde mora.
 */

/** Uma regra de caminho, já normalizada. */
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
  /**
   * Segundos que este sítio pede entre pedidos, ou `null` se não pedir nada.
   *
   * O `Crawl-delay` não está na RFC 9309 e a Google ignora-o. **Esta casa
   * obedece-lhe**, e a razão não é jurídica: é que um administrador que
   * escreve aquela linha está a dizer «este servidor é frágil, tenham calma».
   * Ignorá-la por não estar na norma seria ler o ficheiro à procura do que nos
   * dá jeito, e a `/fontes` promete o contrário.
   */
  readonly atrasoSegundos: number | null;
}

/** Um ficheiro que não impõe nada. */
export const SEM_RESTRICOES: RegrasDoRobots = { regras: [], grupo: null, atrasoSegundos: null };

/** O nome por que esta casa se dá a conhecer num `robots.txt`. */
export const PRODUTO = 'coreto';

/**
 * Quanto de um `robots.txt` se lê antes de parar.
 *
 * A RFC 9309 §2.5 manda analisar **pelo menos** 500 KiB. Sem tecto nenhum, um
 * ficheiro de sete megabytes era lido e analisado do princípio ao fim — medido
 * em 2,6 s, e servido por uma máquina que não é nossa. A §3 diz o resto:
 * «Implementors should treat the content of a robots.txt file as untrusted
 * content.»
 */
export const MAX_ROBOTS_BYTES = 512 * 1024;

interface Grupo {
  agentes: string[];
  regras: Regra[];
  /** Segundos que este grupo pede entre pedidos, se os pedir. */
  atraso: number | null;
}

/**
 * O nome do produto, cortado onde a norma o manda cortar.
 *
 * A ABNF da §2.2.1 diz `product-token = identifier / "*"`, e um `identifier` é
 * só letras, `_` e `-`. O agente desta casa apresenta-se como
 * `Coreto/1.0 (+https://…)`, e é **dos registos do servidor que um
 * administrador copia o nome** quando nos quer travar — escrevendo, com toda a
 * naturalidade, `User-agent: Coreto/1.0`.
 *
 * A versão anterior comparava o valor inteiro por igualdade. O único grupo que
 * alguém escrevia para nós era o único que ignorávamos, e caía-se no `*`, que
 * nestas fontes é permissivo. O analisador de referência da Google corta no
 * primeiro carácter inválido; é o que se faz aqui.
 */
function tokenDe(valor: string): string {
  if (valor === '*') return '*';
  return (/^[A-Za-z_-]+/.exec(valor)?.[0] ?? '').toLowerCase();
}

/**
 * Percent-encoding canónico, aplicado **aos dois lados** da comparação.
 *
 * A §2.2.2 é um MUST: «Octets in the URI and robots.txt paths outside the
 * range of the ASCII coded character set (…) MUST be percent-encoded (…) prior
 * to comparison.» O `caminhoDe` devolve sempre o caminho já encodado pelo
 * `URL` (`/programa%C3%A7%C3%A3o/`), e o padrão vem do ficheiro em texto cru
 * (`/programação/`). Sem esta função, os dois nunca se encontram — e perde-se
 * nos dois sentidos: uma proibição acentuada não prende, e um `Allow:`
 * acentuado não liberta.
 *
 * **O que NÃO se faz, e é a parte que custou a acertar.** A correção óbvia —
 * «encodar tudo o que seja reservado» — troca um defeito por outro pior:
 * `Disallow: /*?*` viraria `/*%3F*` e deixaria de proibir seja o que for.
 * `/index.php?` e `/search?` são das linhas mais comuns que há, e a própria
 * Figura 4 da §2.2.2 mostra `?` e `=` a ficarem como estão. O que se faz é
 * normalizar: encodar o que está fora do ASCII, desfazer os `%XX` que escondem
 * um carácter não reservado, e deixar em paz o ASCII que é legal num caminho.
 */
function normalizar(texto: string): string {
  // 1. O que está fora do ASCII passa a percent-encoding de UTF-8.
  let saida = texto.replace(/[^\x00-\x7F]/gu, (ch) =>
    [...new TextEncoder().encode(ch)]
      .map((b) => '%' + b.toString(16).toUpperCase().padStart(2, '0'))
      .join(''),
  );

  // 2. Um `%XX` que esconda um carácter não reservado desfaz-se — é a linha 5
  //    da Figura 4 da §2.2.2, onde `/foo/bar/%62%61%7A` casa `/foo/bar/baz`.
  //    O resto fica, em maiúsculas, que é a forma canónica do RFC 3986.
  saida = saida.replace(/%([0-9a-fA-F]{2})/g, (_todo, hex: string) => {
    const codigo = Number.parseInt(hex, 16);
    const ch = String.fromCharCode(codigo);
    return /[A-Za-z0-9\-._~]/.test(ch) ? ch : `%${hex.toUpperCase()}`;
  });

  return saida;
}

/**
 * Lê o texto de um `robots.txt` e fica com o grupo que nos diz respeito.
 *
 * Trata `user-agent`, `allow`, `disallow` e `crawl-delay`. O resto — o
 * `sitemap` e o que mais lá venha — é ignorado em silêncio: são campos que
 * esta função não promete tratar, e prometer de menos é melhor do que fingir.
 */
export function lerRobots(texto: string, produto: string = PRODUTO): RegrasDoRobots {
  const grupos: Grupo[] = [];
  let atual: Grupo | null = null;
  // Uma linha de agente **depois** de uma regra abre um grupo novo; antes de
  // qualquer regra, junta-se ao grupo que está a ser montado. É isto que faz
  // «User-agent: a» e «User-agent: b» seguidos partilharem as mesmas regras.
  let aColecionarAgentes = false;

  // `\r` sozinho é terminador de linha em ficheiros antigos, e há servidores
  // que ainda os servem. Com `\r?\n` o ficheiro inteiro vinha como uma linha
  // só, e um `robots.txt` que proíbe tudo passava a não proibir nada.
  for (const bruta of texto.slice(0, MAX_ROBOTS_BYTES).split(/\r\n|\r|\n/)) {
    // O comentário pode vir a meio da linha, e o valor acaba onde ele começa.
    const linha = bruta.split('#')[0]?.trim() ?? '';
    if (!linha) continue;

    const separador = linha.indexOf(':');
    if (separador < 0) continue;

    const campo = linha.slice(0, separador).trim().toLowerCase();
    const valor = linha.slice(separador + 1).trim();

    if (campo === 'user-agent' || campo === 'useragent') {
      if (!aColecionarAgentes || !atual) {
        atual = { agentes: [], regras: [], atraso: null };
        grupos.push(atual);
        aColecionarAgentes = true;
      }
      const token = tokenDe(valor);
      if (token) atual.agentes.push(token);
      continue;
    }

    if (campo === 'crawl-delay' || campo === 'crawldelay') {
      // Fecha a colheita de agentes como qualquer regra: `User-agent: a` /
      // `Crawl-delay: 1` / `User-agent: b` são **dois** grupos, e sem esta
      // linha o segundo agente entrava no primeiro grupo.
      if (!atual) continue;
      aColecionarAgentes = false;
      const segundos = Number.parseFloat(valor.replace(',', '.'));
      if (Number.isFinite(segundos) && segundos > 0) atual.atraso = segundos;
      continue;
    }

    if (campo !== 'allow' && campo !== 'disallow') continue;
    // Uma regra sem grupo nenhum antes dela não pertence a ninguém.
    if (!atual) continue;
    aColecionarAgentes = false;

    // `Disallow:` vazio é «pode tudo» e não é uma proibição de nada; guardar
    // o padrão vazio só encheria a lista de regras que nunca casam.
    if (!valor) continue;
    atual.regras.push({ permite: campo === 'allow', padrao: normalizar(valor) });
  }

  const alvo = tokenDe(produto);
  const especifico = grupos.filter((g) => g.agentes.includes(alvo));
  const genericos = grupos.filter((g) => g.agentes.includes('*'));

  // Um sítio pode escrever o mesmo agente em dois blocos separados; as regras
  // dos dois valem — a §2.2.1 manda combiná-las («the matching groups' rules
  // MUST be combined into one group»), e é isso que o `flatMap` faz.
  const escolhido = especifico.length > 0 ? especifico : genericos.length > 0 ? genericos : null;
  if (!escolhido) return SEM_RESTRICOES;

  return {
    regras: escolhido.flatMap((g) => g.regras),
    grupo: especifico.length > 0 ? alvo : '*',
    atrasoSegundos: atrasoDe(escolhido, grupos),
  };
}

/**
 * Quantos segundos este sítio nos pede entre pedidos.
 *
 * **A regra do nosso grupo primeiro, e o mínimo do ficheiro depois.** A
 * segunda metade parece estranha e é a que faz falta, porque estes ficheiros
 * são escritos à mão e agrupam mal. O do Cine-Teatro Paraíso, medido a 15 de
 * setembro de 2026, é assim:
 *
 *     User-agent: *
 *     Allow:
 *     User-agent: Googlebot
 *     Allow:
 *     …
 *     User-agent: Adsbot-Google
 *     Allow:
 *
 *     Disallow: /admin/
 *     Crawl-Delay: 10
 *
 * Lido à letra, aquele `Crawl-Delay: 10` pertence ao **Adsbot-Google** — é o
 * último agente nomeado antes dele —, e a linha em branco não devolve nada ao
 * grupo do `*`. Pela norma, não nos diz respeito. Pelo que ali está escrito à
 * vista de qualquer pessoa, diz: quem escreveu aquilo quis dez segundos para
 * toda a gente, e enganou-se na arrumação.
 *
 * **Escolher a leitura que nos deixa ir sete vezes mais depressa, por causa de
 * uma linha em branco, é advocacia e não é leitura.** Por isso, quando o nosso
 * grupo nada diz, vale o menor atraso declarado no ficheiro: é o mais pequeno
 * compromisso que honra a intenção, e nunca inventa um número que lá não está.
 *
 * O mínimo, e não o máximo, protege do caso contrário — um ficheiro que peça
 * um segundo para nós e uma hora para um robô específico não nos põe a esperar
 * uma hora.
 */
function atrasoDe(escolhido: readonly Grupo[], todos: readonly Grupo[]): number | null {
  const nosso = escolhido.map((g) => g.atraso).filter((a): a is number => a !== null);
  if (nosso.length > 0) return Math.max(...nosso);

  const quaisquer = todos.map((g) => g.atraso).filter((a): a is number => a !== null);
  return quaisquer.length > 0 ? Math.min(...quaisquer) : null;
}

/**
 * Casar um padrão com um caminho, em tempo linear.
 *
 * **Aqui esteve uma expressão regular, e era uma porta aberta.** Cada `*` do
 * padrão virava `.*`, e o motor de expressões regulares faz retrocesso
 * exponencial sobre isso. Medido contra um caminho de quarenta caracteres:
 * seis `*` levavam 14 ms, oito 165 ms, dez 1 s, doze 4 s, catorze 9 s — e uma
 * linha de vinte, que cabe em quarenta e cinco bytes, não acabava nesta vida.
 *
 * O `podeLer` é síncrono e a recolha é um processo só: uma linha dessas num
 * `robots.txt` de uma bilheteira qualquer segurava as quarenta fontes, sem
 * erro, sem registo e sem tempo esgotado. A avaria mais difícil de
 * diagnosticar que este módulo podia produzir, e vinda de um ficheiro que, por
 * definição, é escrito por outra pessoa.
 *
 * Isto é o algoritmo do analisador de referência da RFC: guarda-se o conjunto
 * de posições do caminho que ainda são candidatas; um carácter normal filtra
 * esse conjunto, um `*` alarga-o a tudo o que vem a seguir, e um `$` final
 * exige que alguma candidata seja o fim. Nunca recua — é O(n × m) no pior
 * caso, e não tem pior caso escondido.
 */
function casa(padrao: string, caminho: string): boolean {
  const fim = caminho.length;
  let posicoes = [0];

  for (let i = 0; i < padrao.length; i += 1) {
    const c = padrao[i]!;

    if (c === '$' && i === padrao.length - 1) {
      return posicoes.includes(fim);
    }

    if (c === '*') {
      // A partir da primeira candidata, tudo o que vem a seguir passa a
      // candidato. As posições ficam por ordem, que é o que o `$` acima usa.
      const primeira = posicoes[0]!;
      posicoes = [];
      for (let p = primeira; p <= fim; p += 1) posicoes.push(p);
      continue;
    }

    const seguintes: number[] = [];
    for (const p of posicoes) {
      if (p < fim && caminho[p] === c) seguintes.push(p + 1);
    }
    if (seguintes.length === 0) return false;
    posicoes = seguintes;
  }

  return posicoes.length > 0;
}

/**
 * O comprimento com que uma regra disputa a especificidade.
 *
 * **O `$` conta.** A versão anterior descontava-o, com um comentário que dizia
 * que «a norma manda contar os caracteres do padrão, e o `*` conta como um» —
 * a primeira metade é verdade e a segunda era invenção minha. A §2.2.2 diz
 * apenas: «The most specific match is the match that has the most octets.» O
 * analisador de referência devolve `pattern.length()`, com o `$` lá dentro.
 *
 * O que isso custava: `Allow: /agenda` e `Disallow: /agenda$` empatavam a
 * sete, o desempate dava o `Allow`, e lia-se uma página que o sítio tinha
 * fechado à mão. Com oito contra sete não há empate nenhum.
 *
 * Depois de `normalizar`, tudo o que pode casar é ASCII, por isso contar
 * caracteres é contar octetos.
 */
function peso(padrao: string): number {
  return padrao.length;
}

/**
 * Se o caminho pode ser lido, à luz das regras já escolhidas.
 *
 * Recebe o caminho com a interrogação e o que vem depois dela — o `robots.txt`
 * fala de caminhos, e `/api/index.php?service=list_eventos` é um caminho
 * diferente de `/api/index.php`. Deitar fora a interrogação faria uma regra
 * escrita para a consulta deixar de casar.
 */
export function podeLer(regras: RegrasDoRobots, caminho: string): boolean {
  const alvo = normalizar(caminho);
  let melhor: Regra | null = null;
  let melhorPeso = -1;

  for (const regra of regras.regras) {
    if (!casa(regra.padrao, alvo)) continue;
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

/**
 * A autoridade que manda num endereço — esquema incluído.
 *
 * A chave da cache era só o hospedeiro, e a §2.3 diz que a autoridade é
 * `scheme:[//authority]`. Com `http://x.pt` e `https://x.pt` a partilharem a
 * mesma entrada, o ficheiro de um mandava no outro: uma fonte configurada em
 * `http://` fazia com que o `robots.txt` do `http` — ou o 404 dele — governasse
 * tudo o que se pedisse depois em `https`. Do lado permissivo, que é o que
 * custa a quem confia na promessa.
 */
export function autoridadeDe(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
