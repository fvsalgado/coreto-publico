import { describe, expect, it } from 'vitest';
import { ressalvaDaCategoria } from './taxonomy';

describe('ressalvaDaCategoria', () => {
  it('cala-se quando a fonte disse a categoria', () => {
    expect(ressalvaDaCategoria('Música', 0.95, 'alias')).toBeNull();
  });

  it('cala-se quando uma palavra do título a decidiu', () => {
    expect(ressalvaDaCategoria('Música', 0.7, 'keyword')).toBeNull();
  });

  it('ressalva o palpite pelo tipo do espaço, e diz porquê', () => {
    const ressalva = ressalvaDaCategoria('Exposições', 0.4, 'venue_kind');
    expect(ressalva?.rotulo).toBe('Provavelmente exposições');
    expect(ressalva?.porque).toMatch(/tipo do espaço/);
  });

  it('nunca ressalva o que uma pessoa decidiu, por muito baixa que a confiança esteja', () => {
    // Foi este o defeito que a 0138 corrigiu: o cadeado travava o
    // `category_slug` e não a confiança, e havia duas fichas em que uma pessoa
    // tinha escolhido a categoria com a nota escrita ao lado. Escrever
    // «provavelmente» por cima dessa decisão é a plataforma a desdizer quem a
    // opera.
    expect(ressalvaDaCategoria('Desporto e natureza', 0.4, 'person')).toBeNull();
    expect(ressalvaDaCategoria('Desporto e natureza', 1, 'person')).toBeNull();
  });

  it('sem categoria não há nada para ressalvar', () => {
    expect(ressalvaDaCategoria(null, 0.4, 'venue_kind')).toBeNull();
  });

  it('sem confiança nenhuma cala-se, em vez de ressalvar o que não mediu', () => {
    // Uma confiança nula é «não consegui saber» e não «tenho pouca certeza»;
    // pôr «provavelmente» por cima dela era inventar uma dúvida com número.
    expect(ressalvaDaCategoria('Música', null, null)).toBeNull();
  });
});
