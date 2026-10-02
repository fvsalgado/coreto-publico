/**
 * Quantas pílulas de uma fila ficam à vista, e quais.
 *
 * O Selo pede no máximo nove opções por nível de navegação (requisito 3.1 da
 * lista «Conteúdo», que o `check:selo` mede contando as ligações de cada
 * `<nav>`). As categorias da agenda chegam a catorze, e os concelhos de uma
 * região a onze — doze e onze de uma vez, numa fila só, contados com dados a
 * 2 de outubro de 2026 (`docs/SELO.md`). O resto passa para um segundo nível,
 * atrás de um «Mais».
 *
 * Ficam à vista as que estão acesas — tirar da vista o filtro que está aplicado
 * era esconder o botão de o desfazer — e depois as que têm mais eventos: é o
 * que mais gente procura, e é o que a contagem já diz. Na ordem em que vieram,
 * que é a da taxonomia ou a dos concelhos, para a fila não se baralhar de um
 * dia para o outro. Sem contagem, ficam as primeiras.
 *
 * Com uma só a mais não há segundo nível: um «Mais» que abre uma pílula ocupa
 * o lugar dela e acrescenta um toque.
 */
export function primeiroNivel<T extends { activa: boolean; quantos?: number | null }>(
  pilulas: readonly T[],
  maximo: number,
): { aVista: T[]; resto: T[] } {
  if (pilulas.length <= maximo + 1) return { aVista: [...pilulas], resto: [] };

  const prioridade = pilulas
    .map((pilula, indice) => ({ pilula, indice }))
    .sort(
      (a, b) =>
        Number(b.pilula.activa) - Number(a.pilula.activa) ||
        (b.pilula.quantos ?? -1) - (a.pilula.quantos ?? -1) ||
        a.indice - b.indice,
    );
  const escolhidas = new Set(prioridade.slice(0, maximo).map(({ indice }) => indice));

  return {
    aVista: pilulas.filter((_, indice) => escolhidas.has(indice)),
    resto: pilulas.filter((_, indice) => !escolhidas.has(indice)),
  };
}
