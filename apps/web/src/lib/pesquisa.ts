/**
 * De uma frase a uma consulta de texto integral.
 *
 * A pesquisa da agenda corre no Postgres, na configuração `portugues` da
 * migração 0116 (sem acentos, pelo radical). O que chega aqui é o que uma
 * pessoa escreveu na caixa; o que sai é o que o `to_tsquery` aceita: uma
 * palavra por termo, cada uma com prefixo — «fad» encontra «fado» e «fados»,
 * e quem escreve meia palavra no telemóvel encontra na mesma —, todas
 * obrigatórias.
 *
 * O que se tira são os operadores do `tsquery` e as aspas: um `&` ou um `!`
 * escritos por engano não podem virar sintaxe, e um `'` a meio de «d'Ouro»
 * partia a consulta em vez de a alargar. As palavras que o dicionário
 * considera vazias («de», «a», «o») caem do lado do Postgres, e uma consulta
 * só com elas não encontra nada — que é a resposta certa para «de».
 */

/** Mais do que isto é uma frase, não uma pesquisa. */
const PALAVRAS_MAX = 8;

export function consultaDePesquisa(texto: string): string | null {
  const palavras = texto
    .replace(/[&|!():*'"<>\\]/g, ' ')
    .split(/\s+/)
    .filter((palavra) => palavra.length > 0)
    .slice(0, PALAVRAS_MAX);
  if (palavras.length === 0) return null;
  return palavras.map((palavra) => `${palavra}:*`).join(' & ');
}
