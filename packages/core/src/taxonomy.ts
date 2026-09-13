/**
 * Classificação por catálogo fechado.
 *
 * Uma etiqueta da fonte só vira categoria se houver um alias que o diga. Não
 * se adivinha: uma categoria errada é pior do que nenhuma, porque desvia o
 * evento do filtro onde as pessoas o procuram. O que não casa é registado
 * como etiqueta desconhecida e revisto — é assim que o mapa de aliases cresce.
 */

import { normalizeForHash } from './text';

export interface CategoryResolution {
  categorySlug: string | null;
  confidence: number;
  /** Como se chegou à categoria — útil para saber em que confiar. */
  source: 'alias' | 'keyword' | 'venue_kind' | 'none';
  unknownTags: string[];
}

/**
 * Palavras do título/descrição que decidem sozinhas, quando as etiquetas da
 * fonte não chegam. Deliberadamente curta e sem ambiguidades: cada entrada
 * aqui é uma aposta feita em nome de quem procura.
 *
 * ## O que a auditoria de 30 de agosto encontrou
 *
 * Sessenta e cinco dos cento e trinta e nove eventos publicados não tinham
 * categoria nenhuma — quase metade da agenda fora de todos os filtros. A
 * causa não era ambiguidade: era **morfologia**. As regras estavam escritas
 * no singular e ancoradas em `\b`, e por isso «Noite de Fados» não casava com
 * `fado`, «Feirinha de Setembro» não casava com `feira`, «Mercados
 * Ecorurais» não casava com `mercadinho`. E `festa em honra` exigia as três
 * palavras seguidas, o que deixava passar «Festa de Verão em Honra de S.
 * Sebastião» — a forma mais comum de todas.
 *
 * O que se acrescenta continua a ser só o inequívoco. Um «trail», um
 * «torneio» ou um «magusto» não são outra coisa nenhuma; um «encontro» ou uma
 * «comemoração» são tudo, e por isso continuam de fora — a leitura do título
 * cala-se e o evento fica sem categoria, que é a resposta honesta.
 */
const KEYWORD_RULES: Array<[RegExp, string]> = [
  /*
   * A **forma** vem antes do **assunto**, e é de propósito.
   *
   * «Workshop de Danças» é uma oficina de dança, e quem filtra por «Dança»
   * quer ver espetáculos, não inscrever-se numa aula. A categoria «Formação e
   * oficinas» diz-se, à letra, «oficinas, cursos, residências e ateliês» — é
   * o sítio onde se aprende, e é o que distingue este evento dos outros.
   *
   * Sem esta ordem, corrigir o plural de «dança» mudava «Workshop de Danças»
   * de formação para dança sem ninguém ter pedido. Foi assim que esta linha
   * subiu: pela conta de que os seis eventos com «oficina», «workshop»,
   * «atelier» ou «curso» no título já estavam todos em formação.
   */
  [/\b(?:oficina|oficinas|workshop|atelier|curso de)\b/, 'formacao'],
  // O plural do fado é a forma comum: «Noite de Fados», e não «de Fado».
  [
    /\b(?:concerto|recital|filarmonica|tuna|orquestra|coro|fados?|jazz|samba|quarteto|acordeao)\b/,
    'musica',
  ],
  [/\b(?:teatro|peca de teatro|marionetas|comedia teatral)\b/, 'teatro'],
  [/\b(?:danca|dancas|bailado|rancho folclorico)\b/, 'danca'],
  [/\b(?:cinema|filme|curtas|documentario|sessao de cinema)\b/, 'cinema'],
  [/\b(?:exposicao|exposicoes|mostra de pintura|fotografia de|vernissage)\b/, 'exposicoes'],
  [
    /\b(?:apresentacao do livro|lancamento do livro|tertulia|conferencia|congresso|coloquio|clube de leitura)\b/,
    'literatura',
  ],
  [/\b(?:visita guiada|percurso interpretativo|roteiro historico)\b/, 'patrimonio'],
  /*
   * A festa da terra, que é o que a maior parte das juntas publica.
   *
   * Três formas, e a ordem entre elas não interessa porque não se cruzam:
   *
   *   · **`romaria`, `arraial`, `marchas populares`, `magusto`, `procissão`** —
   *     palavras que não são outra coisa nenhuma;
   *   · **«Festa … em honra de»** com palavras pelo meio, que é como se
   *     escreve «Festa de Verão em Honra de S. Sebastião»;
   *   · **«Festa/Festas de|do|da …» no princípio do título** — a forma seca,
   *     sem santo declarado: «Festa de Águas Belas», «Festa de Cem Soldos»,
   *     «Festas da Portela, Colmeal e Cabeça Ruiva».
   *
   * A terceira é a que faltava, e é a que precisa de justificação, porque à
   * primeira vista parece larga demais. Não é, e a razão é a âncora:
   *
   *   · **no princípio**, e por isso «Acordeão em Festa!» continua a ser
   *     música — ali «em festa» é o adjectivo, não o género do evento;
   *   · **`festas?` com fronteira**, e por isso «Festival da Saúde» e
   *     «Festival ao Alto» ficam de fora. Um festival é programado por
   *     alguém; uma festa da terra acontece porque é aquela semana do ano;
   *   · **com a preposição a seguir**, que é o que separa o nome de um lugar
   *     ou de um padroeiro de um título que apenas começa pela palavra.
   *
   * A exclusão que se segue é curta de propósito: são os substantivos que
   * nomeiam um domínio para o qual o catálogo **já tem prateleira**. Uma
   * «Festa do Livro» é literatura e uma «Festa do Cinema» é cinema; mandá-las
   * para as festas populares seria o erro que este ficheiro diz ser pior do
   * que não classificar. Tudo o resto que vem depois de «Festa de» — um
   * lugar, um santo, uma estação do ano, uma colectividade — é a festa da
   * terra.
   *
   * Medido contra os 140 títulos publicados a 30 de agosto de 2026: apanha
   * seis, todos certos, e não apanha nenhum a mais.
   */
  [
    /\b(?:romaria|arraial|marchas populares|festas do concelho|magusto|procissao)\b|\bfestas?\b[^,.;]{0,24}\bem honra\b|^ ?festas?\s+d[eoa]s?\s+(?!livros?\b|cinema\b|musica\b|teatro\b|danca\b|poesia\b|ciencia\b)/,
    'festas-populares',
  ],
  [
    /\b(?:feiras?|feirinha|mercadinho|mercados?|mostra de artesanato|mostra gastronomica)\b/,
    'feiras-mercados',
  ],
  [/\b(?:hora do conto|contadores de historias|teatro infantil|para os mais novos)\b/, 'infantil'],
  [
    /\b(?:caminhada|passeio pedestre|percurso pedestre|btt|trail|downhill|kayak|canoagem|yoga|torneio)\b/,
    'desporto-natureza',
  ],
];

/** Categoria por defeito de um tipo de espaço, quando tudo o resto falha. */
const VENUE_KIND_DEFAULTS: Record<string, string> = {
  library: 'literatura',
  museum: 'exposicoes',
  gallery: 'exposicoes',
  cinema: 'cinema',
  bandstand: 'musica',
  heritage: 'patrimonio',
  market: 'feiras-mercados',
};

export interface ResolveOptions {
  /** Mapa alias normalizado → slug de categoria, vindo de `category_aliases`. */
  aliases: ReadonlyMap<string, string>;
  rawTags?: readonly string[];
  title?: string | null;
  description?: string | null;
  venueKind?: string | null;
}

function fold(input: string | null | undefined): string {
  if (!input) return '';
  return input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

export function resolveCategory(options: ResolveOptions): CategoryResolution {
  const unknownTags: string[] = [];

  // 1. As etiquetas da própria fonte, via mapa de aliases. É a via de maior
  //    confiança: alguém decidiu explicitamente que aquela etiqueta é aquilo.
  for (const tag of options.rawTags ?? []) {
    const key = normalizeForHash(tag);
    if (!key) continue;
    const slug = options.aliases.get(key);
    if (slug) return { categorySlug: slug, confidence: 0.95, source: 'alias', unknownTags };
    unknownTags.push(tag);
  }

  // 2. Palavras inequívocas no título — e só no título. A descrição menciona
  //    «concerto» em metade dos eventos que não são concertos.
  const title = fold(options.title);
  for (const [pattern, slug] of KEYWORD_RULES) {
    if (pattern.test(title)) {
      return { categorySlug: slug, confidence: 0.7, source: 'keyword', unknownTags };
    }
  }

  // 3. O tipo de espaço, como último recurso e com confiança em conformidade.
  const byVenue = options.venueKind ? VENUE_KIND_DEFAULTS[options.venueKind] : undefined;
  if (byVenue) {
    return { categorySlug: byVenue, confidence: 0.4, source: 'venue_kind', unknownTags };
  }

  return { categorySlug: null, confidence: 0, source: 'none', unknownTags };
}

/**
 * O limiar a partir do qual a categoria se afirma sem ressalva.
 *
 * 0,7 é a confiança de uma palavra inequívoca do título — «concerto», «feira»,
 * «magusto» —, e essa afirma-se. Abaixo fica só o tipo do espaço (0,4), que é
 * o último recurso do `resolveCategory` e o único palpite que esta casa faz
 * sobre o assunto de um evento a partir de onde ele acontece.
 */
export const CATEGORIA_SEM_RESSALVA = 0.7;

export interface RessalvaDaCategoria {
  /** O nome da categoria com a ressalva à frente, para se ler de seguida. */
  rotulo: string;
  /** Porque é que há ressalva, em linguagem de quem lê e não de quem programa. */
  porque: string;
}

/**
 * A ressalva a pôr ao lado de uma categoria, ou `null` quando não há nenhuma.
 *
 * É a doutrina do posicionamento aplicada a um campo: o que a casa não sabe
 * fica **ao lado** do que sabe, e não escondido nem apagado. Uma categoria
 * atribuída pelo tipo do espaço é um palpite — o CIRA é um museu, logo aquilo
 * seria uma exposição — e publicá-la sem dizer que é um palpite é afirmar o
 * que não se sabe.
 *
 * **Quem decidiu foi uma pessoa nunca leva ressalva, e é a parte que importa.**
 * Antes da 0138 o cadeado travava o `category_slug` e deixava a confiança da
 * máquina por baixo: havia duas fichas em que uma pessoa tinha escolhido a
 * categoria, com a nota escrita ao lado a explicar porquê, e esta função —
 * lendo só a confiança — teria posto «provavelmente» por cima da decisão dela.
 */
export function ressalvaDaCategoria(
  nome: string | null,
  confidence: number | null,
  source: 'alias' | 'keyword' | 'venue_kind' | 'person' | null,
): RessalvaDaCategoria | null {
  if (!nome) return null;
  if (source === 'person') return null;
  if (confidence === null || confidence >= CATEGORIA_SEM_RESSALVA) return null;

  return {
    rotulo: `Provavelmente ${nome.toLocaleLowerCase('pt-PT')}`,
    porque:
      source === 'venue_kind'
        ? 'A fonte não disse de que tipo é este evento. A categoria vem do tipo do espaço onde acontece, e pode não ser a certa.'
        : 'A fonte não disse de que tipo é este evento, e o que se leu não chega para o afirmar.',
  };
}
