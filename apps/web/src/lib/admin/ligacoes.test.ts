import { describe, expect, it } from 'vitest';
import { enderecoPublico, ligacoesPublicas, portaDoAnfitriao } from './ligacoes';

describe('as ligações do painel para as páginas públicas (C4-017)', () => {
  it('saem para o domínio da região, por https', () => {
    expect(enderecoPublico('mediotejo.coreto.org', '/evento/x')).toBe(
      'https://mediotejo.coreto.org/evento/x',
    );
  });

  it('as bases locais servem-se por http e na porta do painel', () => {
    expect(enderecoPublico('mediotejo.localhost', '/evento/x', '3000')).toBe(
      'http://mediotejo.localhost:3000/evento/x',
    );
    // A porta só se usa onde o domínio é local: em produção não se inventa.
    expect(enderecoPublico('mediotejo.coreto.org', '/evento/x', '3000')).toBe(
      'https://mediotejo.coreto.org/evento/x',
    );
  });

  it('a porta lê-se do anfitrião do pedido', () => {
    expect(portaDoAnfitriao('localhost:3000')).toBe('3000');
    expect(portaDoAnfitriao('coreto.org')).toBeNull();
    expect(portaDoAnfitriao(null)).toBeNull();
  });

  it('pela região de um concelho, e sem ligação nenhuma onde a região não tem domínio', () => {
    const ligacoes = ligacoesPublicas(
      [
        { id: 'medio-tejo', domain: 'mediotejo.coreto.org' },
        { id: 'sem-casa', domain: '' },
      ],
      new Map([
        ['tomar', 'medio-tejo'],
        ['algures', 'sem-casa'],
      ]),
      'coreto.org',
    );
    expect(ligacoes.doConcelho('tomar', '/evento/x')).toBe('https://mediotejo.coreto.org/evento/x');
    expect(ligacoes.doConcelho('algures', '/evento/x')).toBeNull();
    expect(ligacoes.doConcelho('desconhecido', '/evento/x')).toBeNull();
    expect(ligacoes.daRegiao(null, '/')).toBeNull();
  });
});
