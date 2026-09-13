/**
 * O `server-only` fora do Next.
 *
 * Os módulos que só podem correr no servidor começam por `import
 * 'server-only'`, e é o empacotador do Next que resolve esse nome — não há
 * pacote nenhum instalado. Fora dele, importar qualquer um desses módulos
 * rebenta antes de chegar ao teste.
 *
 * Este ficheiro vazio ocupa-lhe o lugar no Vitest. Não enfraquece nada: a
 * garantia de que estes módulos não vão parar ao cliente é dada pelo Next na
 * compilação, e o `next build` continua a dá-la. Aqui só se quer poder testar
 * as funções que lá vivem.
 */
export {};
