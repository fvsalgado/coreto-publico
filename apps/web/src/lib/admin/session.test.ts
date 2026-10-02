import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  chaveDaPorta,
  chaveDaSessao,
  conferirAssinaturaDaPessoa,
  createPersonToken,
  createSessionToken,
  lerSessaoNaPorta,
  readSessionToken,
} from './session';

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

/**
 * O que a `chaveDaSessao` promete, e que era falso até 21 de setembro de 2026:
 * trocar a palavra-passe fecha as sessões abertas.
 *
 * Os hashes são de mentira e chegam — estes testes são do mecanismo da chave,
 * não do scrypt, que tem o `password.test.ts` dele. O que importa é que sejam
 * dois valores diferentes, como são dois valores diferentes os que o
 * `hash-password.ts` produz a cada execução.
 */
const HASH = 'scrypt$32768$8$1$c2FsdG9tZWx1$aGFzaG9tZWx1';
const HASH_NOVO = 'scrypt$32768$8$1$b3V0cm9zYWw$b3V0cm9oYXNo';

describe('trocar a palavra-passe fecha as sessões abertas', () => {
  it('um token continua bom enquanto o hash não muda', async () => {
    const token = await createSessionToken('gestor', chaveDaSessao(SECRET, HASH));
    expect((await readSessionToken(token, chaveDaSessao(SECRET, HASH)))?.actor).toBe('gestor');
  });

  it('e deixa de conferir assim que o hash muda, com o mesmo segredo', async () => {
    const token = await createSessionToken('gestor', chaveDaSessao(SECRET, HASH));
    expect(await readSessionToken(token, chaveDaSessao(SECRET, HASH_NOVO))).toBe(null);
  });

  it('o segredo sozinho já não abre nada — era a chave antiga', async () => {
    const token = await createSessionToken('gestor', chaveDaSessao(SECRET, HASH));
    expect(await readSessionToken(token, SECRET)).toBe(null);
  });

  it('o separador não deixa duas configurações diferentes darem a mesma chave', () => {
    // Sem o `\n`, `('ab', 'cd')` e `('a', 'bcd')` assinavam com a mesma cadeia
    // — e uma troca de palavra-passe podia, por azar, não revogar nada.
    expect(chaveDaSessao('ab', 'cd')).not.toBe(chaveDaSessao('a', 'bcd'));
  });
});

/**
 * A sessão de uma pessoa (0170): três partes, duas assinaturas.
 *
 * A porta (o middleware) confere a segunda sem ir à base; o servidor confere
 * a primeira com o hash da palavra-passe dessa pessoa. As duas metades têm de
 * valer sozinhas — e nenhuma pode deixar passar um token do dono como de uma
 * pessoa, nem o contrário.
 */
describe('a sessão de uma pessoa', () => {
  const PESSOA = '0b8e5c2e-4b7a-4c55-9a3f-2f6a1d2b3c4d';
  const chaves = () => ({
    daPessoa: chaveDaSessao(SECRET, HASH),
    daPorta: chaveDaPorta(SECRET),
  });

  it('passa a porta, e diz de quem é', async () => {
    const token = await createPersonToken(PESSOA, 'Ana Silva · ana@cim.pt', chaves());
    const naPorta = await lerSessaoNaPorta(token, {
      doDono: chaveDaSessao(SECRET, HASH_NOVO),
      daPorta: chaveDaPorta(SECRET),
    });
    expect(naPorta).toMatchObject({ tipo: 'pessoa', pessoaId: PESSOA });
  });

  it('a assinatura da pessoa confere com o hash dela, e deixa de conferir quando ele muda', async () => {
    const token = await createPersonToken(PESSOA, 'Ana', chaves());
    expect(await conferirAssinaturaDaPessoa(token, chaveDaSessao(SECRET, HASH))).toBe(true);
    expect(await conferirAssinaturaDaPessoa(token, chaveDaSessao(SECRET, HASH_NOVO))).toBe(false);
  });

  it('recusa à porta uma assinatura da porta feita com outro segredo', async () => {
    const token = await createPersonToken(PESSOA, 'Ana', {
      daPessoa: chaveDaSessao(SECRET, HASH),
      daPorta: chaveDaPorta(randomBytes(32).toString('base64url')),
    });
    expect(
      await lerSessaoNaPorta(token, { doDono: null, daPorta: chaveDaPorta(SECRET) }),
    ).toBeNull();
  });

  it('recusa um corpo trocado por baixo das mesmas assinaturas', async () => {
    const token = await createPersonToken(PESSOA, 'Ana', chaves());
    const [, daPessoa, daPorta] = token.split('.');
    const outro = Buffer.from(
      JSON.stringify({ sub: PESSOA.replace('0b8e', '1b8e'), actor: 'Ana', exp: 9e9, jti: 'x' }),
    ).toString('base64url');
    expect(
      await lerSessaoNaPorta(`${outro}.${daPessoa}.${daPorta}`, {
        doDono: null,
        daPorta: chaveDaPorta(SECRET),
      }),
    ).toBeNull();
  });

  it('um token de pessoa nunca é lido como do dono, nem um do dono como de uma pessoa', async () => {
    const daPessoa = await createPersonToken(PESSOA, 'Ana', chaves());
    expect(await readSessionToken(daPessoa, chaveDaSessao(SECRET, HASH))).toBeNull();

    // Um token de duas partes com o `sub` de uma pessoa não foi emitido por
    // este servidor — nem que esteja assinado com a chave do dono.
    const forjado = await createSessionToken(
      'Ana',
      chaveDaSessao(SECRET, HASH),
      Date.now(),
      PESSOA,
    );
    expect(
      await lerSessaoNaPorta(forjado, {
        doDono: chaveDaSessao(SECRET, HASH),
        daPorta: chaveDaPorta(SECRET),
      }),
    ).toBeNull();
  });

  it('as sessões do dono abertas antes das contas — sem `sub` — continuam a ser do dono', async () => {
    const antigo = await createSessionToken('gestor', chaveDaSessao(SECRET, HASH));
    expect(
      await lerSessaoNaPorta(antigo, {
        doDono: chaveDaSessao(SECRET, HASH),
        daPorta: chaveDaPorta(SECRET),
      }),
    ).toMatchObject({ tipo: 'dono', payload: { actor: 'gestor' } });
  });

  it('a chave da porta não é a chave do dono, nem o segredo em bruto da barreira', () => {
    expect(chaveDaPorta(SECRET)).not.toBe(SECRET);
    expect(chaveDaPorta(SECRET)).not.toBe(chaveDaSessao(SECRET, HASH));
  });

  it('uma sessão de pessoa expirada não passa a porta', async () => {
    const token = await createPersonToken(PESSOA, 'Ana', chaves(), Date.now() - 9 * 60 * 60 * 1000);
    expect(
      await lerSessaoNaPorta(token, { doDono: null, daPorta: chaveDaPorta(SECRET) }),
    ).toBeNull();
  });
});
