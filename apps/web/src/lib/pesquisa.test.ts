import { describe, expect, it } from 'vitest';
import { consultaDePesquisa } from './pesquisa';

describe('consultaDePesquisa', () => {
  it('uma palavra vira um prefixo: quem escreve meia palavra encontra', () => {
    expect(consultaDePesquisa('fad')).toBe('fad:*');
  });

  it('várias palavras são todas obrigatórias', () => {
    expect(consultaDePesquisa('noite de fados')).toBe('noite:* & de:* & fados:*');
  });

  it('os acentos ficam: quem os tira é o dicionário, do lado da base', () => {
    expect(consultaDePesquisa('Virgínia')).toBe('Virgínia:*');
  });

  it('os operadores do tsquery e as aspas não viram sintaxe', () => {
    expect(consultaDePesquisa("d'Ouro & (teatro) | !cinema")).toBe(
      'd:* & Ouro:* & teatro:* & cinema:*',
    );
  });

  it('espaços a mais não contam', () => {
    expect(consultaDePesquisa('  marchas   populares  ')).toBe('marchas:* & populares:*');
  });

  it('sem uma palavra, não há consulta', () => {
    expect(consultaDePesquisa('')).toBeNull();
    expect(consultaDePesquisa('   ')).toBeNull();
    expect(consultaDePesquisa('& | !')).toBeNull();
  });

  it('uma frase inteira fica pelas primeiras oito palavras', () => {
    const consulta = consultaDePesquisa('um dois três quatro cinco seis sete oito nove dez');
    expect(consulta?.split(' & ')).toHaveLength(8);
    expect(consulta).not.toContain('nove');
  });
});
