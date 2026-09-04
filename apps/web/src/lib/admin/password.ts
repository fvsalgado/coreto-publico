import { scryptSync, timingSafeEqual } from 'node:crypto';
import { reportarErro } from '../registo';

/**
 * Verificação da palavra-passe da área interna.
 *
 * Ficheiro separado do token de sessão de propósito: isto usa scrypt do Node e
 * só corre no servidor, enquanto a verificação do token tem de correr também
 * no middleware, em edge.
 */

/**
 * Compara uma palavra-passe com o hash guardado
 * (`scrypt$N$r$p$sal$hash`, produzido por `scripts/hash-password.ts`).
 *
 * Um hash mal formado é tratado como «não confere» e registado. Deixar a
 * exceção subir daria uma resposta diferente para configuração inválida e para
 * palavra-passe errada — e isso conta a quem tenta em qual dos dois casos está.
 */
export function verifyPassword(password: string, encoded: string): boolean {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    reportarErro(
      'ADMIN_PASSWORD_HASH mal formado',
      'o valor não tem a forma scrypt$N$r$p$sal$hash',
    );
    return false;
  }

  const [, cost, blockSize, parallelism, salt, expected] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  try {
    const expectedBuffer = Buffer.from(expected, 'base64');
    const derived = scryptSync(password, Buffer.from(salt, 'base64'), expectedBuffer.length, {
      N: Number(cost),
      r: Number(blockSize),
      p: Number(parallelism),
      maxmem: 128 * Number(cost) * Number(blockSize) * 2,
    });
    return derived.length === expectedBuffer.length && timingSafeEqual(derived, expectedBuffer);
  } catch (error) {
    reportarErro('verifyPassword', error);
    return false;
  }
}
