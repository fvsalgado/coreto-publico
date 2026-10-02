import { describe, expect, it } from 'vitest';
import {
  actorDaPessoa,
  actorDoDono,
  emailDoDonoConfere,
  pode,
  podeEmTodas,
  primeiroNome,
  regioesComPapel,
  tokenDeConviteValido,
  type Sessao,
} from './papeis';

/**
 * O que cada papel pode, numa tabela (C4-015).
 *
 * É a decisão de que depende uma moderadora de uma CIM não ver a fila de outra.
 * Os casos são os do `CONTAS.md`: o dono pode tudo, incluindo o que não tem
 * região; o gestor de uma região faz tudo o que o editor faz, e só nela; o
 * editor modera; e quem não tem papel numa região não lhe toca.
 */
const DONO: Sessao = { tipo: 'dono', actor: 'dono' };
const ANA: Sessao = {
  tipo: 'pessoa',
  actor: 'Ana Silva · ana@cim.pt',
  pessoa: { id: '00000000-0000-4000-8000-000000000001', nome: 'Ana Silva', email: 'ana@cim.pt' },
  papeis: [
    { region_id: 'mirante', papel: 'gestor' },
    { region_id: 'travessia', papel: 'editor' },
  ],
};
const SEM_PAPEL: Sessao = { ...ANA, papeis: [] };

describe('quem pode o quê', () => {
  it.each([
    [DONO, 'medio-tejo', 'gestor', true],
    [DONO, null, 'gestor', true],
    [ANA, 'mirante', 'gestor', true],
    [ANA, 'mirante', 'editor', true],
    [ANA, 'travessia', 'editor', true],
    [ANA, 'travessia', 'gestor', false],
    [ANA, 'medio-tejo', 'editor', false],
    [ANA, null, 'editor', false],
    [SEM_PAPEL, 'mirante', 'editor', false],
  ] as const)('%#: na região %s, com o mínimo %s', (sessao, regiao, minimo, esperado) => {
    expect(pode(sessao, regiao, minimo)).toBe(esperado);
  });

  it('um lote só passa se todas as regiões passarem', () => {
    expect(podeEmTodas(ANA, ['mirante', 'travessia'], 'editor')).toBe(true);
    expect(podeEmTodas(ANA, ['mirante', 'medio-tejo'], 'editor')).toBe(false);
    expect(podeEmTodas(DONO, ['mirante', null], 'gestor')).toBe(true);
  });

  it('as regiões de uma pessoa, pelo papel mínimo; o dono tem «todas», que não é uma lista', () => {
    expect(regioesComPapel(ANA, 'editor')).toEqual(['mirante', 'travessia']);
    expect(regioesComPapel(ANA, 'gestor')).toEqual(['mirante']);
    expect(regioesComPapel(SEM_PAPEL, 'editor')).toEqual([]);
    expect(regioesComPapel(DONO, 'editor')).toBe('todas');
  });
});

describe('quem fica na auditoria', () => {
  it('uma pessoa fica com o nome e o email', () => {
    expect(actorDaPessoa({ nome: ' Ana Silva ', email: 'ana@cim.pt' })).toBe(
      'Ana Silva · ana@cim.pt',
    );
  });

  it('o dono fica com o email, quando o declara, e nunca com «gestor»', () => {
    expect(actorDoDono('Dono@Coreto.org')).toBe('dono · dono@coreto.org');
    expect(actorDoDono(undefined)).toBe('dono');
  });

  it('o cumprimento usa o primeiro nome', () => {
    expect(primeiroNome('  Ana Maria Silva ')).toBe('Ana');
  });
});

describe('a senha do dono, e o email que a acompanha', () => {
  it('sem ADMIN_EMAIL, qualquer email serve — o segredo é a palavra-passe', () => {
    expect(emailDoDonoConfere('qualquer@coisa.pt', undefined)).toBe(true);
  });

  it('com ADMIN_EMAIL, tem de bater, sem distinguir maiúsculas', () => {
    expect(emailDoDonoConfere(' Dono@Coreto.org ', 'dono@coreto.org')).toBe(true);
    expect(emailDoDonoConfere('ana@cim.pt', 'dono@coreto.org')).toBe(false);
  });
});

describe('a forma de uma ligação de convite', () => {
  it('são 43 caracteres de base64url', () => {
    expect(tokenDeConviteValido('a'.repeat(43))).toBe(true);
    expect(tokenDeConviteValido('a'.repeat(42))).toBe(false);
    expect(tokenDeConviteValido(`${'a'.repeat(42)}=`)).toBe(false);
    expect(tokenDeConviteValido('')).toBe(false);
  });
});
