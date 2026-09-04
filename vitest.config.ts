import { defineConfig } from 'vitest/config';

/**
 * `TZ=UTC` de propósito: quase todos os erros de data desta casa só aparecem
 * quando o fuso do servidor não é o de Lisboa — que é exatamente o caso em
 * produção. Um teste que passasse por o portátil estar em Lisboa não valia
 * nada.
 */
export default defineConfig({
  /*
   * O JSX pelo runtime automático, como o Next o compila.
   *
   * O `tsconfig` de `apps/web` diz `jsx: preserve` — entrega o JSX ao Next e
   * não o transforma. O esbuild do vitest, sem isto, escolhia a forma clássica
   * (`React.createElement`) e um módulo `.tsx` sem `import React` rebentava a
   * correr com «React is not defined». É o caso da rota que desenha o cartão
   * de partilha: JSX que nunca vê um navegador, mas que tem de ser executado
   * para se provar que desenha.
   */
  esbuild: { jsx: 'automatic' },
  // O `server-only` é resolvido pelo empacotador do Next e não existe como
  // pacote. Sem este substituto, qualquer teste que toque num módulo de
  // servidor rebenta a carregar em vez de correr. A garantia que esse import
  // dá continua a ser dada onde importa — no `next build`.
  resolve: {
    alias: {
      'server-only': new URL('./test/stubs/server-only.ts', import.meta.url).pathname,
      // O `@/` é o alias do `tsconfig` de `apps/web` (`@/* → ./*`). O
      // middleware e os route handlers importam por ele, e são exatamente os
      // módulos que passam a ter testes; o resolvedor só o aplica a `@/…`,
      // nunca a pacotes com organização (`@supabase/…`).
      '@': new URL('./apps/web', import.meta.url).pathname,
    },
  },
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/web/src/**/*.test.ts',
      // O que vive fora de `src`: o middleware, na raiz da aplicação, e os
      // route handlers, ao lado de cada `route.ts`. O Next ignora ficheiros
      // que não sejam os especiais, por isso um `route.test.ts` dentro de
      // `app/` não é uma rota.
      'apps/web/middleware.test.ts',
      'apps/web/app/**/*.test.ts',
    ],
    environment: 'node',
    env: { TZ: 'UTC' },
  },
});
