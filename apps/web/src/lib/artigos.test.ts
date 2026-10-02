import { describe, expect, it } from 'vitest';
import { aNome, contracao, deNome, emNome, porNome } from './artigos';

describe('os nomes com artigo', () => {
  it('compõe a contração com o artigo que a base declara', () => {
    // A caixa dizia «Agenda de Entroncamento» no sítio da Câmara Municipal do
    // Entroncamento (C4-020).
    expect(deNome('Entroncamento', 'o')).toBe('do Entroncamento');
    expect(emNome('Sardoal', 'o')).toBe('no Sardoal');
    expect(deNome('Golegã', 'a')).toBe('da Golegã');
    expect(emNome('Caldas da Rainha', 'as')).toBe('nas Caldas da Rainha');
    expect(porNome('Comunidade Intermunicipal do Vale', 'a')).toBe(
      'pela Comunidade Intermunicipal do Vale',
    );
    expect(porNome('Município de Mação', 'o')).toBe('pelo Município de Mação');
    // «Voltar a Vila da Charamela» lia-se na folha da semana (C2-032).
    expect(aNome('Vila da Charamela', 'a')).toBe('à Vila da Charamela');
    expect(aNome('Entroncamento', 'o')).toBe('ao Entroncamento');
  });

  it('sem artigo, a preposição fica sozinha — que é o caso de quase todos os concelhos', () => {
    expect(deNome('Tomar', null)).toBe('de Tomar');
    expect(emNome('Torres Novas', undefined)).toBe('em Torres Novas');
    expect(porNome('Tomar', null)).toBe('por Tomar');
    expect(aNome('Tomar', null)).toBe('a Tomar');
  });

  it('um artigo que o código não conhece vale «sem artigo», e não inventa um', () => {
    expect(deNome('Tomar', 'lo')).toBe('de Tomar');
    expect(emNome('Tomar', '')).toBe('em Tomar');
  });
});

describe('a contração sozinha', () => {
  it('é a preposição com o artigo, para quando o nome vai numa ligação à parte', () => {
    // «Promovido pela Município…» era o rodapé de uma região de uma câmara (C1-031).
    expect(contracao('por', 'o')).toBe('pelo');
    expect(contracao('por', 'a')).toBe('pela');
    expect(contracao('de', 'os')).toBe('dos');
    expect(contracao('a', 'as')).toBe('às');
    expect(contracao('por', null)).toBe('por');
  });
});
