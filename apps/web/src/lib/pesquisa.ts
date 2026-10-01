/**
 * De uma frase a uma consulta — ao texto dos eventos e ao catálogo.
 *
 * A pesquisa da agenda corre no Postgres, na configuração `portugues` da
 * migração 0116 (sem acentos, pelo radical). O que chega aqui é o que uma
 * pessoa escreveu na caixa; o que sai é, palavra a palavra, onde a procurar.
 * Cada palavra leva prefixo — «fad» encontra «fado» e «fados», e quem escreve
 * meia palavra no telemóvel encontra na mesma — e todas são obrigatórias.
 *
 * **Até 1 de outubro de 2026 procurava-se só no texto do evento**, e isso
 * deixava de fora três coisas que quem pesquisa escreve primeiro (C2-034):
 *
 * - **o nome da sala.** «Teatro Virgínia» e «Paraíso» davam zero: os eventos
 *   das salas do catálogo trazem `venue_id` e o `location_name` vazio, e o
 *   vetor de pesquisa só lê o segundo;
 * - **o género.** «cinema» dava zero com dezassete filmes na categoria Cinema,
 *   porque nenhum deles tem a palavra no título — e na demonstração,
 *   «exposição» e «cinema» respondiam que não havia nada;
 * - **o concelho**, que só se lia quando por acaso estava no título.
 *
 * Agora cada palavra encontra também a categoria (pelo nome, e por uns poucos
 * sinónimos escritos abaixo), o espaço e o concelho com esse nome. Não é preciso
 * migração nenhuma: o catálogo é pequeno, vive em cache, e a correspondência
 * faz-se aqui, em código que se testa sem base. O que vai ao Postgres é, por
 * palavra, «o texto tem-na, **ou** o evento é desta categoria, deste espaço,
 * deste concelho».
 *
 * **E o plural (C2-035).** A configuração tira os acentos **antes** do
 * radical, e o radical português do Snowball só reconhece «-ção» e «-ções»
 * com o til: sem ele, «exposição» fica `exposica` e «exposições» fica
 * `exposico`, e uma não encontra a outra — medido, 6 contra 1. Mudar a
 * ordem não se faz numa configuração de pesquisa (o radical não passa a
 * palavra a mais ninguém), por isso a consulta leva as duas formas: a palavra
 * e o seu singular ou plural, nas terminações onde o radical se perde.
 */

/** Mais do que isto é uma frase, não uma pesquisa. */
const PALAVRAS_MAX = 8;

/**
 * As palavras que não querem dizer nada sozinhas.
 *
 * O Postgres tem a sua lista e tira-as da consulta de texto; esta é a parte
 * dela que interessa ao catálogo, onde uma «de» encontraria metade dos
 * espaços («Casa de…», «Centro de…»). Não precisa de estar completa: uma
 * palavra vazia que falte aqui só alarga a procura no catálogo.
 */
const PALAVRAS_VAZIAS = new Set([
  'a',
  'o',
  'as',
  'os',
  'um',
  'uma',
  'uns',
  'umas',
  'e',
  'ou',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'ao',
  'aos',
  'para',
  'por',
  'pelo',
  'pela',
  'pelos',
  'pelas',
  'com',
  'sem',
  'que',
  'se',
  'mais',
  'num',
  'numa',
  'entre',
  'sobre',
]);

/**
 * Palavras que se escrevem para procurar uma categoria e que o nome dela não
 * cobre — no singular, porque se comparam com as formas da palavra.
 *
 * Curta de propósito, e só com palavras **genéricas**: quem escreve
 * «concerto» procura música, mas quem escreve «fado» procura fado, e
 * mandá-lo para a categoria inteira enchia a resposta de bandas
 * filarmónicas. É por isso que as palavras inequívocas da taxonomia (que
 * classificam um título) não servem aqui: «fado» é música para classificar,
 * e é fado para procurar.
 */
const SINONIMOS_DE_CATEGORIA: Readonly<Record<string, readonly string[]>> = {
  musica: ['concerto', 'recital'],
  cinema: ['filme'],
  infantil: ['crianca', 'miudo', 'miuda', 'bebe'],
  'desporto-natureza': ['ioga', 'yoga'],
};

/** Minúsculas e sem acentos — o que a configuração `portugues` também faz. */
export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * As palavras de uma pesquisa, normalizadas.
 *
 * Partem-se em tudo o que não é letra nem algarismo: os operadores do
 * `tsquery`, as aspas e o apóstrofo de «d'Ouro» não podem virar sintaxe, e o
 * hífen de «Cine-Teatro» separa duas palavras que o catálogo tem separadas.
 * Uma letra sozinha cai — como prefixo, encontrava tudo o que começa por ela.
 */
export function palavrasDaPesquisa(texto: string): string[] {
  return normalizar(texto)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((palavra) => palavra.length > 1 || /\p{N}/u.test(palavra))
    .slice(0, PALAVRAS_MAX);
}

/**
 * A palavra e as suas outras formas, nas terminações onde o radical se perde.
 *
 * Só as do português que o radical, sem acentos, já não junta: «-ão/-ões/
 * -ães/-ãos», «-m/-ns», «-l/-is», e o plural em «-es» de «-r», «-z» e «-s».
 * O plural em «-s» simples o radical junta sozinho — fica aqui para o
 * catálogo, onde a comparação é por prefixo e «teatros» tem de encontrar
 * «Teatro». Nenhuma forma fica com menos de três letras antes da terminação:
 * um prefixo curto encontra tudo.
 */
export function formasDaPalavra(palavra: string): string[] {
  const formas = new Set([palavra]);
  const troca = (fim: string, ...novos: string[]): boolean => {
    if (palavra.length < fim.length + 3 || !palavra.endsWith(fim)) return false;
    const raiz = palavra.slice(0, -fim.length);
    for (const novo of novos) formas.add(raiz + novo);
    return true;
  };

  const nasal =
    troca('oes', 'ao') ||
    troca('aes', 'ao') ||
    troca('aos', 'ao') ||
    troca('ao', 'oes', 'aes', 'aos');
  const emM = troca('ns', 'm') || troca('m', 'ns');
  const emL =
    troca('ais', 'al') ||
    troca('eis', 'el', 'il') ||
    troca('ois', 'ol') ||
    troca('uis', 'ul') ||
    troca('is', 'il') ||
    troca('al', 'ais') ||
    troca('el', 'eis') ||
    troca('ol', 'ois') ||
    troca('ul', 'uis') ||
    troca('il', 'is');
  const emEs =
    troca('res', 'r') ||
    troca('zes', 'z') ||
    troca('ses', 's') ||
    troca('r', 'res') ||
    troca('z', 'zes');
  if (!nasal && !emM && !emL && !emEs) troca('s', '');

  return [...formas];
}

/** A consulta de texto de uma palavra: ela e as suas formas, cada uma prefixo. */
export function consultaDaPalavra(palavra: string): string {
  const formas = formasDaPalavra(palavra).map((forma) => `${forma}:*`);
  return formas.length === 1 ? (formas[0] as string) : `(${formas.join(' | ')})`;
}

/** O que a pesquisa compara com cada palavra, já lido da base. */
export interface CatalogoDaPesquisa {
  categorias: ReadonlyArray<{ slug: string; name: string }>;
  espacos: ReadonlyArray<{ id: string; name: string }>;
  concelhos: ReadonlyArray<{ id: string; name: string }>;
}

/** Uma palavra que é também nome de alguma coisa do catálogo. */
export interface PalavraDaPesquisa {
  palavra: string;
  consulta: string;
  categorias: string[];
  espacos: string[];
  concelhos: string[];
}

export interface PlanoDePesquisa {
  /** As palavras que só se procuram no texto, numa consulta só — ou `null`. */
  texto: string | null;
  /** As que também nomeiam uma categoria, um espaço ou um concelho. */
  alternativas: PalavraDaPesquisa[];
}

function palavrasDoNome(nome: string): string[] {
  return palavrasDaPesquisa(nome).filter((palavra) => !PALAVRAS_VAZIAS.has(palavra));
}

/**
 * Se a palavra procurada é uma das palavras do nome — inteira, ou o começo
 * dela, como no texto. O começo só conta a partir de três letras: «ab» não é
 * Abrantes.
 */
function nomeia(formas: readonly string[], nome: string): boolean {
  return palavrasDoNome(nome).some((doNome) =>
    formas.some((forma) => doNome === forma || (forma.length >= 3 && doNome.startsWith(forma))),
  );
}

function categoriasDaPalavra(
  formas: readonly string[],
  categorias: CatalogoDaPesquisa['categorias'],
): string[] {
  const achadas = new Set<string>();
  for (const categoria of categorias) {
    if (nomeia(formas, categoria.name)) achadas.add(categoria.slug);
    const sinonimos = SINONIMOS_DE_CATEGORIA[categoria.slug] ?? [];
    if (formas.some((forma) => sinonimos.includes(forma))) achadas.add(categoria.slug);
  }
  return [...achadas].sort();
}

/**
 * O plano de uma pesquisa: o que vai ao texto e o que vai também ao catálogo.
 *
 * As palavras sem correspondência no catálogo juntam-se numa consulta de
 * texto só, como sempre foi — e é lá que o Postgres tira as palavras vazias,
 * no meio das outras. As que nomeiam uma categoria, um espaço ou um concelho
 * vão cada uma com as suas alternativas. Sem catálogo (`null`), é tudo texto.
 *
 * **Uma consulta só de palavras vazias não encontra nada, e é de propósito**
 * — «de» é a resposta certa para nada. Mas ao lado de palavras do catálogo
 * cai: «Museu do Bombo» são duas palavras com nome e um «do», e um «do»
 * sozinho no texto dava zero a uma pesquisa que tem resposta.
 */
export function planoDePesquisa(
  texto: string,
  catalogo: CatalogoDaPesquisa | null,
): PlanoDePesquisa | null {
  const palavras = palavrasDaPesquisa(texto);
  if (palavras.length === 0) return null;

  const soNoTexto: string[] = [];
  const alternativas: PalavraDaPesquisa[] = [];
  for (const palavra of palavras) {
    const consulta = consultaDaPalavra(palavra);
    if (catalogo && !PALAVRAS_VAZIAS.has(palavra)) {
      const formas = formasDaPalavra(palavra);
      const categorias = categoriasDaPalavra(formas, catalogo.categorias);
      const espacos = catalogo.espacos
        .filter((espaco) => nomeia(formas, espaco.name))
        .map((espaco) => espaco.id);
      const concelhos = catalogo.concelhos
        .filter((concelho) => nomeia(formas, concelho.name))
        .map((concelho) => concelho.id);
      if (categorias.length + espacos.length + concelhos.length > 0) {
        alternativas.push({ palavra, consulta, categorias, espacos, concelhos });
        continue;
      }
    }
    soNoTexto.push(palavra);
  }

  const soVazias = soNoTexto.every((palavra) => PALAVRAS_VAZIAS.has(palavra));
  const consultaDeTexto =
    soNoTexto.length === 0 || (soVazias && alternativas.length > 0)
      ? null
      : soNoTexto.map(consultaDaPalavra).join(' & ');
  return { texto: consultaDeTexto, alternativas };
}

/** Um valor dentro de um filtro lógico do PostgREST, entre aspas. */
function aspas(valor: string): string {
  return `"${valor.replace(/["\\]/g, '')}"`;
}

/**
 * As alternativas de uma palavra, na sintaxe do `or` do PostgREST: o texto
 * tem-na, ou o evento é de uma destas categorias, espaços ou concelhos.
 *
 * Entre aspas, porque a consulta tem parênteses, dois pontos e barras, que o
 * PostgREST leria como sintaxe sua. A configuração vai sem esquema pela razão
 * que o `textSearch` já tinha: o PostgREST resolve `portugues` pelo
 * `search_path`, que inclui `public`.
 */
export function filtroDaPalavra(palavra: PalavraDaPesquisa): string {
  const partes = [`search_vector.fts(portugues).${aspas(palavra.consulta)}`];
  if (palavra.categorias.length > 0) {
    partes.push(`category_slug.in.(${palavra.categorias.map(aspas).join(',')})`);
  }
  if (palavra.espacos.length > 0) {
    partes.push(`venue_id.in.(${palavra.espacos.map(aspas).join(',')})`);
  }
  if (palavra.concelhos.length > 0) {
    partes.push(`municipality_id.in.(${palavra.concelhos.map(aspas).join(',')})`);
  }
  return partes.join(',');
}
