import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * O ESLint dos pacotes e dos scripts.
 *
 * Só o `apps/web` tinha análise estática. Os dois pacotes declaravam
 * `"lint": "tsc --noEmit"` — que é o `typecheck` outra vez, com outro nome — e
 * os `scripts/*.mjs` não passavam por linter nenhum. Eram cerca de vinte mil
 * linhas de recolha e seiscentas de ferramentas, incluindo os próprios
 * auditores de acessibilidade, a correr sem uma única regra a olhar para elas.
 *
 * Esta configuração não pode reutilizar a do sítio: o `eslint-config-next` é
 * de React e de Next, e aqui não há nem um nem outro. As duas regras que o
 * projeto trata como condição — e não como preferência — repetem-se por isso à
 * mão, com os mesmos valores de `apps/web/eslint.config.mjs`.
 *
 * O `apps/web` continua a ter a sua, e é ela que lá corre: o `pnpm lint` da
 * raiz é `pnpm -r`, que entra em cada workspace e usa a configuração de lá.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      'apps/web/**',
      'instantaneos/**',
      'supabase/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // O projeto proíbe `any`. A regra por omissão é aviso; aqui é erro, como
      // no sítio, e o CI trata-a como tal.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Os scripts são JavaScript e não TypeScript: as regras que precisam de
    // tipos não têm aqui o que ler.
    files: ['scripts/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
