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
      // O «hoje» desta casa é o de Lisboa, e vem de `todayInLisbon()` em
      // `@coreto/core`. `new Date().toISOString().slice(0, 10)` é o dia em
      // UTC: entre as 00:00 e a 01:00 de verão é ontem, e foi assim que o
      // relatório mensal, os «futuros» e o estado da licença se calcularam
      // para o dia errado uma hora por dia — cinco sítios, apanhados a 19 de
      // setembro de 2026. A regra proíbe a forma, não a intenção: quem
      // precisar do dia UTC de propósito escreve-o com `getUTC*`.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='slice'][callee.object.callee.property.name='toISOString']",
          message:
            'O dia de hoje é todayInLisbon() de @coreto/core; toISOString().slice(...) dá o dia em UTC.',
        },
      ],
    },
  },
  {
    // `public/maplibre/` é o processador do MapLibre copiado do pacote, tal
    // como sai de lá; não é código nosso para o linter ler.
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/maplibre/**'],
  },
];

export default config;
