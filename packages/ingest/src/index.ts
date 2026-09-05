/**
 * Superfície pública do pacote de recolha.
 *
 * Quem a consome hoje é o CLI (`cli.ts`) e mais ninguém: `apps/web` não depende
 * deste pacote, e o painel não tem por onde correr uma fonte à mão. Ficou aqui
 * escrito que existia para isso, e não existia — a nota fica trocada por esta
 * enquanto o painel não ganhar esse botão.
 *
 * As regras que o `apps/web` também precisa de saber não moram aqui: moram em
 * `@coreto/core`, que é o pacote de que os dois dependem. É o que evita duas
 * cópias da mesma regra, que é como `detectLayoutDrift` e `nextBaseline`
 * chegaram a ter duas fórmulas diferentes e duas suites de testes verdes a
 * afirmar coisas contrárias.
 */

export * from './adapter.js';
export * from './adapters/index.js';
export * from './db.js';
export * from './html.js';
export * from './http.js';
export * from './pipeline.js';
export * from './run-logger.js';
