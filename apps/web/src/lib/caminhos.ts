/**
 * Os caminhos que os componentes de cliente também precisam de saber.
 *
 * Vivem à parte e não importam nada, e a razão é de peso — à letra. A lupa do
 * toldo é um componente de cliente que está em todas as páginas, e ia buscar o
 * caminho da agenda a `lib/agenda.ts`: isso levava para o navegador o módulo
 * inteiro e, atrás dele, o esquema do `@coreto/core` e o zod. Medido com o
 * `check:desempenho` a 1 de outubro de 2026, o JavaScript de cada rota passava
 * de 145 kB para 365 kB, com o tecto nos 170.
 *
 * Quem acrescentar aqui um caminho importa-o daqui, e não de um módulo com
 * dependências: este ficheiro é para continuar sem nenhuma.
 */

/** A agenda — o destino de todos os filtros. */
export const PATH = '/agenda';

/** A âncora da caixa de pesquisa na agenda: é para lá que a lupa do toldo leva. */
export const ANCORA_DA_PESQUISA = 'pesquisa';
