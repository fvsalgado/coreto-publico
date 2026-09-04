import { randomBytes, scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyPassword } from './password';

/**
 * Os valores usados nos testes são gerados a cada execução, e não escritos no
 * ficheiro.
 *
 * Não é cerimónia: uma cadeia com ar de palavra-passe num ficheiro versionado
 * é indistinguível de uma palavra-passe a sério para quem varre o repositório
 * à procura de segredos — e um alerta que se aprende a ignorar deixa de valer
 * alguma coisa. Gerar aqui remove o ruído e não custa nada aos testes, que
 * verificam o mecanismo e não um valor concreto.
 */
function randomSecret(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Parâmetros baixos de propósito: os de produção pedem 32 MiB por verificação
 * e tornariam a suíte lenta sem provar mais nada sobre o formato.
 */
const COST = 1024;
const BLOCK_SIZE = 8;

function encode(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, {
    N: COST,
    r: BLOCK_SIZE,
    p: 1,
    maxmem: 128 * COST * BLOCK_SIZE * 2,
  });
  return ['scrypt', COST, BLOCK_SIZE, 1, salt.toString('base64'), derived.toString('base64')].join(
    '$',
  );
}

describe('verifyPassword', () => {
  it('recusa um hash mal formado sem rebentar', () => {
    for (const encoded of ['', 'lixo', 'scrypt$16384$8$1$só-quatro', 'bcrypt$1$2$3$4$5']) {
      expect(verifyPassword(randomSecret(), encoded)).toBe(false);
    }
  });

  it('confere com a palavra-passe certa', () => {
    const password = randomSecret();
    expect(verifyPassword(password, encode(password))).toBe(true);
  });

  it('falha com a palavra-passe errada', () => {
    const password = randomSecret();
    const encoded = encode(password);
    expect(verifyPassword(randomSecret(), encoded)).toBe(false);
    expect(verifyPassword('', encoded)).toBe(false);
  });

  it('não aceita um hash de outra palavra-passe', () => {
    expect(verifyPassword(randomSecret(), encode(randomSecret()))).toBe(false);
  });
});
