import { notFound } from 'next/navigation';

/**
 * Tudo o que numa região não é página nenhuma.
 *
 * Sem esta rota, um endereço que não existe — a ligação antiga de um evento,
 * um caminho mal copiado — não chegava ao `[regiao]/not-found.tsx`: o Next só
 * o usa quando é uma página da região a chamar `notFound()`, e um caminho que
 * não corresponde a rota nenhuma cai no 404 de raiz, que rende no esqueleto do
 * produto, sem toldo, sem barra de baixo, sem rodapé e sem saída (C1-023). Quem
 * vinha à procura de programação aterrava numa página que nem parecia do mesmo
 * sítio.
 *
 * A rota apanha o que sobra e chama o `notFound()` de dentro da região: o
 * layout dela fica de pé à volta da página de erro, e o estado continua a ser
 * 404. As rotas a sério ganham-lhe sempre — um segmento que apanha tudo é o
 * último que o Next tenta.
 *
 * Dinâmica de propósito: a página de erro oferece os atalhos de hoje, e um 404
 * guardado em cache levava o «Hoje» de outro dia.
 */
export const dynamic = 'force-dynamic';

export default function Resto(): never {
  notFound();
}
