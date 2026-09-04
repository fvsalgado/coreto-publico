import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Configuração «flat» do ESLint.
 *
 * O `eslint-config-next` da versão 16 já exporta configuração flat. Passar por
 * `FlatCompat` — que é o caminho antigo, para configurações em `eslintrc` —
 * fazia o ESLint rebentar com «Converting circular structure to JSON»: o
 * compat tenta serializar um objeto de configuração que se referencia a si
 * próprio. Importar diretamente resolve, e é o que a versão 16 espera.
 */
const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // O projeto proíbe `any`. A regra por omissão do Next é um aviso;
      // aqui é erro, e o CI trata-a como tal.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];

export default config;
