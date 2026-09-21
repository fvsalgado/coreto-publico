/**
 * A montra da entrada: o que quem administra escolheu, e o que se escolhe
 * sozinho para a encher.
 *
 * A fila de cartazes mostrava os primeiros da semana por ordem de
 * `agenda_date` — a ordem da consulta a fazer de montra. Todas as agendas
 * municipais com que o Coreto se compara têm uma escolha humana à cabeça; o
 * que o Coreto não tem, e não vai ter, é uma redação que a faça todas as
 * segundas.
 *
 * A regra que resolve as duas coisas: **quem administra fixa os que quer, e o
 * que faltar preenche-se com a semana**. Uma montra nunca fica vazia por
 * ninguém ter tido tempo, e nunca deixa de honrar uma escolha feita.
 *
 * **O «aleatório» é por dia e não por visita, e é uma decisão e não uma
 * limitação.** A entrada é servida de cache com uma hora de vida; um sorteio
 * por pedido faria a montra mudar a meio de uma leitura — e, pior, o que se
 * via dependia de qual das cópias em cache respondeu. Baralhado por dia, o
 * dia inteiro vê a mesma montra, ela muda sozinha de manhã, e duas pessoas na
 * mesma vila veem a mesma coisa, que é o que se espera de uma agenda.
 */

/**
 * Um número pseudoaleatório a partir de uma semente de texto.
 *
 * FNV-1a para transformar o texto em trinta e dois bits, mulberry32 para os
 * espalhar. São dez linhas e não trazem dependência nenhuma; o que se pede a
 * isto não é qualidade criptográfica — é que a mesma semente dê sempre a mesma
 * ordem, e que dois dias seguidos deem ordens diferentes.
 */
function geradorDe(semente: string): () => number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < semente.length; i += 1) {
    hash ^= semente.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  let estado = hash >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Baralha uma lista de forma repetível.
 *
 * Fisher-Yates de trás para a frente, que é o único que dá todas as
 * permutações com a mesma probabilidade — o baralhar ingénuo
 * (`sort(() => Math.random() - 0.5)`) não dá, e enviesa para a ordem de
 * partida, que aqui é exatamente a ordem que se quer deixar de ter.
 *
 * Não mexe na lista que recebe.
 */
export function baralharComSemente<T>(itens: readonly T[], semente: string): T[] {
  const saida = [...itens];
  const sorteio = geradorDe(semente);
  for (let i = saida.length - 1; i > 0; i -= 1) {
    const j = Math.floor(sorteio() * (i + 1));
    const a = saida[i] as T;
    const b = saida[j] as T;
    saida[i] = b;
    saida[j] = a;
  }
  return saida;
}

/** O mínimo que uma fila de cartazes precisa para ser uma montra e não dois cartazes. */
export const MINIMO_DE_DESTAQUES = 3;

export interface EntradaDeDestaque {
  id: string;
  /** Último dia do evento, ou o primeiro quando não há fim. Para não destacar o que já passou. */
  ate: string | null;
}

export interface ComposicaoDeDestaques<T extends EntradaDeDestaque> {
  /** Os que quem administra fixou, pela ordem que lhes deu. */
  fixados: readonly T[];
  /** O que a semana tem, para encher o que faltar. */
  daSemana: readonly T[];
  /** Quantos a região quer mostrar. Zero desliga a montra. */
  alvo: number;
  /** Hoje em Lisboa: o que já acabou não é destaque. */
  hoje: string;
  /** A semente do dia — normalmente `<região>:<hoje>`. */
  semente: string;
}

/**
 * A montra final.
 *
 * Por esta ordem, e cada passo tem uma razão:
 *
 * 1. **Os fixados primeiro, pela ordem dada.** Quem os fixou pô-los por
 *    ordem; reordená-los seria desfazer a escolha que a tabela existe para
 *    guardar.
 * 2. **Sem os que já acabaram.** Um destaque fixado em setembro para um
 *    evento de setembro continua fixado em outubro, e a montra não é sítio
 *    para o que já passou. Não se apaga nada — quem fixou é que decide isso —,
 *    esconde-se.
 * 3. **O resto vem da semana, baralhado pelo dia**, e sem repetir o que já
 *    entrou pelos fixados.
 * 4. **Corta-se no alvo.** Mais fixados do que o alvo é uma escolha
 *    igualmente legítima: mostram-se os primeiros, e o painel diz quantos
 *    ficaram de fora.
 */
export function comporDestaques<T extends EntradaDeDestaque>({
  fixados,
  daSemana,
  alvo,
  hoje,
  semente,
}: ComposicaoDeDestaques<T>): T[] {
  if (alvo <= 0) return [];

  const aDecorrer = (item: T) => item.ate === null || item.ate >= hoje;

  const escolhidos: T[] = [];
  const vistos = new Set<string>();
  for (const item of fixados) {
    if (!aDecorrer(item) || vistos.has(item.id)) continue;
    vistos.add(item.id);
    escolhidos.push(item);
    if (escolhidos.length >= alvo) return escolhidos;
  }

  const sobra = daSemana.filter((item) => !vistos.has(item.id) && aDecorrer(item));
  for (const item of baralharComSemente(sobra, semente)) {
    escolhidos.push(item);
    if (escolhidos.length >= alvo) break;
  }
  return escolhidos;
}
