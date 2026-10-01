import { describe, expect, it } from 'vitest';
import {
  consultaDaPalavra,
  filtroDaPalavra,
  formasDaPalavra,
  palavrasDaPesquisa,
  planoDePesquisa,
  type CatalogoDaPesquisa,
} from './pesquisa';

describe('palavrasDaPesquisa', () => {
  it('normaliza como a configuração da base: minúsculas e sem acentos', () => {
    expect(palavrasDaPesquisa('Virgínia')).toEqual(['virginia']);
    expect(palavrasDaPesquisa('EXPOSIÇÕES')).toEqual(['exposicoes']);
  });

  it('os operadores do tsquery e as aspas não viram sintaxe, e uma letra sozinha cai', () => {
    expect(palavrasDaPesquisa("d'Ouro & (teatro) | !cinema")).toEqual(['ouro', 'teatro', 'cinema']);
  });

  it('o hífen separa o que o catálogo tem separado', () => {
    expect(palavrasDaPesquisa('Cine-Teatro')).toEqual(['cine', 'teatro']);
  });

  it('uma frase inteira fica pelas primeiras oito palavras', () => {
    expect(palavrasDaPesquisa('um dois três quatro cinco seis sete oito nove dez')).toHaveLength(8);
  });
});

/**
 * O plural que o radical perde (C2-035): sem o til, «exposição» e
 * «exposições» davam radicais diferentes, e a pesquisa por uma não
 * encontrava a outra — 6 contra 1, medido em produção.
 */
describe('formasDaPalavra', () => {
  it.each([
    ['exposicoes', 'exposicao'],
    ['exposicao', 'exposicoes'],
    ['cancoes', 'cancao'],
    ['jovens', 'jovem'],
    ['viagem', 'viagens'],
    ['festivais', 'festival'],
    ['festival', 'festivais'],
    ['infantis', 'infantil'],
    ['flores', 'flor'],
    ['teatros', 'teatro'],
  ])('%s chega a %s', (palavra, outra) => {
    expect(formasDaPalavra(palavra)).toContain(outra);
  });

  it('uma palavra curta não ganha formas que encontrariam tudo', () => {
    expect(formasDaPalavra('sao')).toEqual(['sao']);
    expect(formasDaPalavra('mar')).toEqual(['mar']);
  });
});

describe('consultaDaPalavra', () => {
  it('uma palavra sem outras formas é um prefixo: quem escreve meia palavra encontra', () => {
    expect(consultaDaPalavra('fad')).toBe('fad:*');
  });

  it('com outras formas, encontra qualquer uma delas', () => {
    expect(consultaDaPalavra('exposicoes')).toBe('(exposicoes:* | exposicao:*)');
  });
});

describe('planoDePesquisa sem catálogo', () => {
  it('todas as palavras são obrigatórias, numa consulta de texto só', () => {
    expect(planoDePesquisa('noite de fados', null)).toEqual({
      texto: 'noite:* & de:* & (fados:* | fado:*)',
      alternativas: [],
    });
  });

  it('sem uma palavra, não há pesquisa', () => {
    expect(planoDePesquisa('', null)).toBeNull();
    expect(planoDePesquisa('   ', null)).toBeNull();
    expect(planoDePesquisa('& | !', null)).toBeNull();
  });
});

/**
 * As pesquisas do C2-034, com o catálogo que as fazia falhar. Os nomes são os
 * de produção e os da demonstração; os identificadores também.
 */
const CATALOGO: CatalogoDaPesquisa = {
  categorias: [
    { slug: 'cinema', name: 'Cinema' },
    { slug: 'danca', name: 'Dança' },
    { slug: 'exposicoes', name: 'Exposições' },
    { slug: 'infantil', name: 'Infantil e família' },
    { slug: 'musica', name: 'Música' },
    { slug: 'teatro', name: 'Teatro' },
  ],
  espacos: [
    { id: 'teatro-virginia', name: 'Teatro Virgínia' },
    { id: 'cine-teatro-paraiso', name: 'Cine-Teatro Paraíso — Sala de Espetáculos de Tomar' },
    { id: 'museu-do-bombo', name: 'Museu do Bombo' },
    { id: 'casa-da-cultura', name: 'Casa da Cultura' },
  ],
  concelhos: [
    { id: 'tomar', name: 'Tomar' },
    { id: 'torres-novas', name: 'Torres Novas' },
    { id: 'ponte-do-bombo', name: 'Ponte do Bombo' },
  ],
};

function alternativa(texto: string, palavra: string) {
  return planoDePesquisa(texto, CATALOGO)?.alternativas.find((item) => item.palavra === palavra);
}

describe('planoDePesquisa com o catálogo', () => {
  it('«cinema» encontra a categoria, que nenhum título diz', () => {
    expect(alternativa('cinema', 'cinema')?.categorias).toEqual(['cinema']);
  });

  it('«exposição» e «exposições» encontram a mesma categoria e as duas formas no texto', () => {
    for (const termo of ['exposição', 'exposições', 'exposicao']) {
      const plano = planoDePesquisa(termo, CATALOGO);
      expect(plano?.alternativas[0]?.categorias).toEqual(['exposicoes']);
      expect(plano?.alternativas[0]?.consulta).toMatch(
        /exposicao:\* \| exposicoes:\*|exposicoes:\* \| exposicao:\*/,
      );
    }
  });

  it('«Teatro Virgínia» encontra a sala, que os eventos dela só têm em `venue_id`', () => {
    const plano = planoDePesquisa('Teatro Virgínia', CATALOGO);
    expect(plano?.texto).toBeNull();
    expect(alternativa('Teatro Virgínia', 'virginia')?.espacos).toEqual(['teatro-virginia']);
    // E «teatro» sozinho é a categoria e as salas que se chamam teatro.
    expect(alternativa('Teatro Virgínia', 'teatro')).toMatchObject({
      categorias: ['teatro'],
      espacos: ['teatro-virginia', 'cine-teatro-paraiso'],
    });
  });

  it('«Paraíso», com ou sem acento, é o Cine-Teatro', () => {
    expect(alternativa('Paraíso', 'paraiso')?.espacos).toEqual(['cine-teatro-paraiso']);
    expect(alternativa('paraiso', 'paraiso')?.espacos).toEqual(['cine-teatro-paraiso']);
  });

  it('«concerto» é Música, como a recolha o entende num título', () => {
    expect(alternativa('concertos', 'concertos')?.categorias).toEqual(['musica']);
  });

  it('«crianças» é a categoria infantil', () => {
    expect(alternativa('crianças', 'criancas')?.categorias).toEqual(['infantil']);
  });

  it('«dança tomar» é a dança, em Tomar', () => {
    expect(alternativa('dança tomar', 'danca')?.categorias).toEqual(['danca']);
    expect(alternativa('dança tomar', 'tomar')?.concelhos).toEqual(['tomar']);
  });

  it('«Museu do Bombo»: o «do» não deixa a pesquisa a zero', () => {
    const plano = planoDePesquisa('Museu do Bombo', CATALOGO);
    expect(plano?.texto).toBeNull();
    expect(plano?.alternativas.map((item) => item.palavra)).toEqual(['museu', 'bombo']);
    expect(alternativa('Museu do Bombo', 'bombo')).toMatchObject({
      espacos: ['museu-do-bombo'],
      concelhos: ['ponte-do-bombo'],
    });
  });

  it('o que não é nome de nada fica no texto, junto, como sempre', () => {
    expect(planoDePesquisa('noite vadia', CATALOGO)).toEqual({
      texto: 'noite:* & vadia:*',
      alternativas: [],
    });
  });

  it('«fado» procura fado, e não a música toda', () => {
    // As palavras inequívocas da taxonomia classificam um título; numa
    // pesquisa, mandavam quem quer fado para todas as bandas filarmónicas.
    expect(planoDePesquisa('fado vadio', CATALOGO)).toEqual({
      texto: 'fado:* & vadio:*',
      alternativas: [],
    });
  });

  it('«de» sozinho continua a não encontrar nada — é a resposta certa', () => {
    expect(planoDePesquisa('de', CATALOGO)).toEqual({ texto: 'de:*', alternativas: [] });
  });

  it('duas letras não são o começo de um nome: «ab» não é Abrantes', () => {
    expect(planoDePesquisa('to', CATALOGO)?.alternativas).toEqual([]);
  });
});

describe('filtroDaPalavra', () => {
  it('escreve o `or` do PostgREST, com a consulta entre aspas', () => {
    const exposicao = alternativa('exposições', 'exposicoes');
    if (!exposicao) throw new Error('sem alternativa');
    expect(filtroDaPalavra(exposicao)).toBe(
      'search_vector.fts(portugues)."(exposicoes:* | exposicao:*)",category_slug.in.("exposicoes")',
    );
  });

  it('junta espaço e concelho quando a palavra os nomeia', () => {
    const bombo = alternativa('bombo', 'bombo');
    if (!bombo) throw new Error('sem alternativa');
    expect(filtroDaPalavra(bombo)).toBe(
      'search_vector.fts(portugues)."bombo:*",venue_id.in.("museu-do-bombo"),municipality_id.in.("ponte-do-bombo")',
    );
  });
});
