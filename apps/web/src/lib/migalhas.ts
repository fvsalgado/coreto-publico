/**
 * O caminho até à página onde se está — escrito uma vez, lido duas.
 *
 * Este sítio já dizia a um motor de busca que a ficha de um evento vive
 * debaixo do concelho dela: o `BreadcrumbList` dos dados estruturados existe
 * desde que há fichas. O que nunca existiu foi dizê-lo a quem lê. Uma pessoa
 * que chegue a um evento por uma partilha via o título e mais nada — sem uma
 * palavra sobre onde estava nem por onde subir. A máquina sabia; a pessoa não.
 *
 * Daí este ficheiro. As migalhas são construídas aqui e servem os dois: o
 * cabeçalho da página desenha-as, e `dados-estruturados.ts` publica-as. Duas
 * listas mantidas à mão divergiam — é a lição que o rodapé desta casa já
 * aprendeu uma vez.
 *
 * A última migalha é a página onde se está. Tem nome e endereço porque o
 * `BreadcrumbList` os quer; o cabeçalho não a desenha, porque logo por baixo
 * está o `<h1>` a dizer o mesmo, e repetir o título duas vezes seguidas é
 * ruído para quem lê e para quem ouve.
 */

export interface Migalha {
  /** Endereço absoluto ou interno. Sempre presente: o schema.org quer-o. */
  href: string;
  label: string;
}

interface Concelho {
  id: string;
  name: string;
}

/** A raiz, que é o nome da casa. Todas as trilhas começam aqui. */
const CASA: Migalha = { href: '/', label: 'Coreto' };

/**
 * A ficha de um evento: Coreto › concelho › evento.
 *
 * O concelho e não a agenda, e é uma escolha: quem está a ver um concerto em
 * Mação tem mais probabilidade de querer «o que mais há em Mação» do que «a
 * agenda dos onze concelhos», e o segundo está sempre no cabeçalho. É também
 * a trilha que os dados estruturados já publicavam.
 */
export function migalhasDoEvento(
  evento: { slug: string; title: string },
  concelho: Concelho | null,
): Migalha[] {
  const trilha = [CASA];
  if (concelho) trilha.push({ href: `/concelho/${concelho.id}`, label: concelho.name });
  trilha.push({ href: `/evento/${evento.slug}`, label: evento.title });
  return trilha;
}

/** A ficha de um espaço: Coreto › concelho › espaço. */
export function migalhasDoEspaco(
  espaco: { id: string; name: string },
  concelho: Concelho | null,
): Migalha[] {
  const trilha = [CASA];
  if (concelho) trilha.push({ href: `/concelho/${concelho.id}`, label: concelho.name });
  trilha.push({ href: `/espaco/${espaco.id}`, label: espaco.name });
  return trilha;
}

/**
 * A página de um concelho: Coreto › Mapa › concelho.
 *
 * O mapa é o pai destas onze páginas — é de lá que se chega a cada uma, e é
 * assim que a navegação principal as arruma (`/concelho` é prefixo do destino
 * «Mapa»). Esta trilha é nova nos dois lados: a página de concelho não tinha
 * migalhas nem no HTML nem nos dados estruturados.
 */
export function migalhasDoConcelho(concelho: Concelho): Migalha[] {
  return [
    CASA,
    { href: '/mapa', label: 'Mapa' },
    { href: `/concelho/${concelho.id}`, label: concelho.name },
  ];
}

/**
 * A página de um ciclo: Coreto › Ciclos e festivais › ciclo.
 *
 * Só se chega aqui com a secção dos ciclos ligada — desligada, a rota devolve
 * 404 —, por isso a migalha do meio nunca aponta para uma página que não
 * existe.
 */
export function migalhasDoCiclo(ciclo: { id: string; name: string }): Migalha[] {
  return [
    CASA,
    { href: '/ciclos', label: 'Ciclos e festivais' },
    { href: `/ciclo/${ciclo.id}`, label: ciclo.name },
  ];
}

/** As que o cabeçalho desenha: todas menos a própria página. */
export function ascendentes(trilha: readonly Migalha[]): Migalha[] {
  return trilha.slice(0, -1);
}
