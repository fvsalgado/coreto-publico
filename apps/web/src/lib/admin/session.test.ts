import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createSessionToken, readSessionToken } from './session';

/**
 * Gerado a cada execução, e não escrito no ficheiro: uma cadeia com ar de
 * segredo num ficheiro versionado é indistinguível de um segredo a sério para
 * quem varre o repositório, e um alerta que se aprende a ignorar deixa de
 * valer alguma coisa. Os testes verificam o mecanismo, não um valor concreto.
 */
const SECRET = randomBytes(32).toString('base64url');

describe('sessão da área interna', () => {
  it('aceita o próprio token', async () => {
    const token = await createSessionToken('gestor', SECRET);
    expect((await readSessionToken(token, SECRET))?.actor).toBe('gestor');
  });

  it('recusa um token assinado com outro segredo', async () => {
    const token = await createSessionToken('gestor', SECRET);
    expect(await readSessionToken(token, randomBytes(32).toString('base64url'))).toBe(null);
  });

  it('recusa um payload trocado por baixo da mesma assinatura', async () => {
    const token = await createSessionToken('gestor', SECRET);
    const signature = token.slice(token.lastIndexOf('.') + 1);
    const forged = Buffer.from(JSON.stringify({ actor: 'intruso', exp: 9e9, jti: 'x' })).toString(
      'base64url',
    );
    expect(await readSessionToken(`${forged}.${signature}`, SECRET)).toBe(null);
  });

  it('recusa uma assinatura adulterada', async () => {
    const token = await createSessionToken('gestor', SECRET);
    const cut = token.lastIndexOf('.');
    const body = token.slice(0, cut);
    const signature = token.slice(cut + 1);
    const flipped = signature.slice(0, -1) + (signature.endsWith('a') ? 'b' : 'a');
    expect(await readSessionToken(`${body}.${flipped}`, SECRET)).toBe(null);
  });

  it('recusa um token expirado', async () => {
    const nineHoursAgo = Date.now() - 9 * 60 * 60 * 1000;
    const token = await createSessionToken('gestor', SECRET, nineHoursAgo);
    expect(await readSessionToken(token, SECRET)).toBe(null);
  });

  it('aceita um token ainda dentro do prazo de oito horas', async () => {
    const sevenHoursAgo = Date.now() - 7 * 60 * 60 * 1000;
    const token = await createSessionToken('gestor', SECRET, sevenHoursAgo);
    expect(await readSessionToken(token, SECRET)).not.toBe(null);
  });

  it('recusa lixo em vez de rebentar', async () => {
    for (const value of ['', 'sem-ponto', '.', 'a.b', undefined]) {
      expect(await readSessionToken(value, SECRET)).toBe(null);
    }
  });

  it('não repete o mesmo token para a mesma sessão', async () => {
    const [first, second] = await Promise.all([
      createSessionToken('gestor', SECRET),
      createSessionToken('gestor', SECRET),
    ]);
    expect(first).not.toBe(second);
  });
});
