/**
 * Um nome com artigo ou sem ele, tal como a base o declara — o de um concelho
 * (0165), o de quem promove a região.
 *
 * Nulo quer dizer «sem artigo», e é o caso de quase todos os concelhos:
 * «de Tomar», «em Ourém». Os outros são os que a base diz: «do Entroncamento»,
 * «no Sardoal». Um valor que este código não conhece vale sem artigo — é o
 * erro mais pequeno que se pode cometer com um topónimo.
 *
 * Num módulo sem dependências, à parte de `regiao.ts`, porque o construtor do
 * widget também compõe estas frases e corre no navegador: puxar a região
 * inteira para lá era puxar o `@coreto/core` atrás dela.
 */

type Artigo = 'o' | 'a' | 'os' | 'as';

const DE: Record<Artigo, string> = { o: 'do', a: 'da', os: 'dos', as: 'das' };
const EM: Record<Artigo, string> = { o: 'no', a: 'na', os: 'nos', as: 'nas' };
const POR: Record<Artigo, string> = { o: 'pelo', a: 'pela', os: 'pelos', as: 'pelas' };
const A: Record<Artigo, string> = { o: 'ao', a: 'à', os: 'aos', as: 'às' };

function artigoOuNada(artigo: string | null | undefined): Artigo | null {
  return artigo === 'o' || artigo === 'a' || artigo === 'os' || artigo === 'as' ? artigo : null;
}

type Preposicao = 'de' | 'em' | 'por' | 'a';

const CONTRACOES: Record<Preposicao, Record<Artigo, string>> = { de: DE, em: EM, por: POR, a: A };

/**
 * A preposição contraída com o artigo, sozinha — «da», «no», «pelo», «à» —, ou
 * a preposição nua sem artigo. É para quando o nome vai noutro elemento: o
 * rodapé escreve «Promovido pelo» e o nome é uma ligação.
 */
export function contracao(preposicao: Preposicao, artigo: string | null | undefined): string {
  const certo = artigoOuNada(artigo);
  return certo ? CONTRACOES[preposicao][certo] : preposicao;
}

/** «de Tomar», «do Entroncamento», «da Golegã». */
export function deNome(nome: string, artigo: string | null | undefined): string {
  return `${contracao('de', artigo)} ${nome}`;
}

/** «em Tomar», «no Entroncamento», «na Golegã». */
export function emNome(nome: string, artigo: string | null | undefined): string {
  return `${contracao('em', artigo)} ${nome}`;
}

/** «por Tomar», «pelo Município de Mação», «pela Comunidade Intermunicipal…». */
export function porNome(nome: string, artigo: string | null | undefined): string {
  return `${contracao('por', artigo)} ${nome}`;
}

/** «a Tomar», «ao Entroncamento», «à Vila da Charamela» — «Voltar a …». */
export function aNome(nome: string, artigo: string | null | undefined): string {
  return `${contracao('a', artigo)} ${nome}`;
}
