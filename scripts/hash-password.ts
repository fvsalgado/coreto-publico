/**
 * Gera o valor de `ADMIN_PASSWORD_HASH`.
 *
 * A área interna do Coreto não tem contas nem registo: tem uma palavra-passe,
 * e dessa palavra-passe o servidor só conhece um hash com sal. Este utilitário
 * é a única forma prevista de o produzir.
 *
 * Uso preferido — a palavra-passe entra por `stdin` e não fica no histórico
 * da shell nem na lista de processos:
 *
 *     printf '%s' 'a-palavra-passe' | pnpm dlx tsx scripts/hash-password.ts
 *
 * Também aceita um argumento, para quem estiver a correr isto num sítio onde
 * o histórico não interessa:
 *
 *     pnpm dlx tsx scripts/hash-password.ts 'a-palavra-passe'
 *
 * O que sai é uma linha `scrypt$N$r$p$sal$hash`, com sal e hash em base64,
 * pronta a colar na variável de ambiente. Cada execução dá um valor
 * diferente para a mesma palavra-passe — o sal é novo de cada vez, e é isso
 * que se pretende.
 *
 * **Pôr este valor no ambiente fecha as sessões que estiverem abertas.** O
 * token da área interna é assinado com o segredo e com este hash
 * (`admin/session.ts`, `chaveDaSessao`), e um hash novo faz as assinaturas
 * antigas deixarem de conferir. Quem troca a palavra-passe porque desconfia
 * de alguma coisa expulsa quem lá estiver, que é o que se espera de trocar
 * uma palavra-passe — e até aqui não era o que acontecia.
 */

import { randomBytes, scryptSync } from 'node:crypto';

/**
 * Parâmetros do scrypt.
 *
 * N = 2^15 com r = 8 pede 32 MiB de memória por verificação, o que está muito
 * acima do que uma placa gráfica consegue paralelizar em condições e é
 * irrelevante para um servidor que faz isto uma vez por entrada. `maxmem` tem
 * de ser dado à mão: o valor por omissão do Node fica exatamente no limite
 * destes parâmetros e a chamada rebentaria.
 */
const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 128 * COST * BLOCK_SIZE * 2;

/**
 * Comprimento mínimo. Isto protege a agenda inteira do Médio Tejo.
 *
 * Dizia «treze concelhos», que é o número de antes de 2022 — a Sertã e Vila de
 * Rei saíram da CIM. O sítio onde a conta se faz é `MUNICIPALITIES`, em
 * `@coreto/core`, e é o único onde ela deve estar escrita.
 */
const MIN_PASSWORD_LENGTH = 12;

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      buffer += chunk;
    });
    process.stdin.on('end', () => resolve(buffer));
    process.stdin.on('error', reject);
  });
}

async function readPassword(): Promise<string> {
  const fromArgv = process.argv[2];
  if (typeof fromArgv === 'string' && fromArgv.length > 0) return fromArgv;

  if (process.stdin.isTTY) {
    throw new Error(
      'Passa a palavra-passe por stdin ou como argumento.\n' +
        "  printf '%s' 'a-palavra-passe' | pnpm dlx tsx scripts/hash-password.ts",
    );
  }
  // Só a primeira linha: um `echo` sem `-n` acrescenta um newline que ninguém
  // quer ver a fazer parte da palavra-passe.
  return (await readStdin()).split('\n')[0] ?? '';
}

function encodeHash(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    maxmem: MAX_MEMORY,
  });
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

async function main(): Promise<void> {
  const password = await readPassword();

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A palavra-passe tem de ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  // O hash vai para `stdout` sozinho, sem rótulo, para poder ser redirecionado
  // ou copiado sem limpeza. As instruções vão para `stderr`.
  process.stderr.write('Acrescenta esta linha ao ambiente do servidor:\n\n');
  process.stdout.write(`ADMIN_PASSWORD_HASH=${encodeHash(password)}\n`);
  process.stderr.write(
    '\nFalta ainda ADMIN_SESSION_SECRET, com pelo menos 32 caracteres aleatorios:\n' +
      "  node -e \"console.log(require('node:crypto').randomBytes(48).toString('base64url'))\"\n" +
      '\nTrocar a palavra-passe invalida as sessoes abertas: o token e assinado\n' +
      'com o segredo e com este hash, e um hash novo faz cair as assinaturas\n' +
      'antigas. Ate repor a MESMA palavra-passe expulsa toda a gente, porque o\n' +
      'sal e novo de cada vez.\n',
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
