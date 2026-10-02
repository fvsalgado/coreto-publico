import { describe, expect, it } from 'vitest';
import { eventFilterSchema } from '@coreto/core';
import {
  EIXOS_DE_ACESSIBILIDADE,
  FAMILIA,
  PATH_DO_MAPA,
  alargamentos,
  atalhosDeData,
  buildHref,
  concelhosSemEventos,
  descreverDatas,
  eixosDoFormulario,
  fichasDosFiltros,
  filtroIndexavel,
  janelaActiva,
  nomesDosEixos,
  pilulasDeFaceta,
  readFilter,
} from './agenda';

/** Um filtro válido a partir do que se escreveria no endereço. */
const filtro = (raw: Record<string, string> = {}) => eventFilterSchema.parse(raw);

// 2026-09-09 é uma quarta-feira; o fim de semana dessa semana é 11 a 13.
const QUARTA = '2026-09-09';

describe('readFilter', () => {
  it('deita fora os campos vazios que um formulário GET submete na mesma', () => {
    expect(readFilter({ from: '', to: '', municipality: 'tomar' }).municipality).toBe('tomar');
  });

  it('um parâmetro repetido vale pela primeira ocorrência', () => {
    expect(readFilter({ municipality: ['tomar', 'ourem'] }).municipality).toBe('tomar');
  });
});

describe('buildHref', () => {
  it('colapsa os vazios, o limite de omissão e a primeira página', () => {
    expect(buildHref(filtro(), 1)).toBe('/agenda');
    expect(buildHref(filtro({ limit: '24' }), 1)).toBe('/agenda');
  });

  // Quem volta à primeira página é quem chama — `activeFilters` passa sempre
  // `1` ao largar uma ficha. A função honra a página que lhe dão, e é o que
  // permite à paginação usar a mesma função.
  it('larga um filtro e mantém a página que lhe derem', () => {
    const atual = filtro({ municipality: 'tomar', category: 'musica' });
    expect(buildHref(atual, 1, 'category')).toBe('/agenda?municipality=tomar');
    expect(buildHref(atual, 3, 'category')).toBe('/agenda?municipality=tomar&page=3');
  });

  it('larga os dois campos de uma janela de uma vez', () => {
    const atual = filtro({ from: '2026-09-11', to: '2026-09-13', municipality: 'tomar' });
    expect(buildHref(atual, 1, ['from', 'to'])).toBe('/agenda?municipality=tomar');
  });

  // O mapa leva os mesmos filtros pela mesma função: é o que faz «Ver no
  // mapa» e «Ver em lista» irem e voltarem sem perder um parâmetro.
  it('cola os mesmos filtros a outro caminho quando lho pedem', () => {
    const atual = filtro({ municipality: 'tomar', free: '1' });
    expect(buildHref(atual, 1, undefined, PATH_DO_MAPA)).toBe('/mapa?municipality=tomar&free=1');
    expect(buildHref(filtro(), 1, undefined, PATH_DO_MAPA)).toBe('/mapa');
  });
});

describe('os eixos da acessibilidade', () => {
  const NOMES = { municipalities: {}, categories: {}, venues: {}, series: {} };

  /*
   * As colunas dos cinco eixos existem desde a 0004 e o filtro conhecia uma.
   * Quem precisa de audiodescrição para decidir se sai de casa não faz a
   * mesma pergunta de quem precisa de uma rampa.
   */
  it('são cinco, e cada um vai para o endereço com o seu nome', () => {
    expect(EIXOS_DE_ACESSIBILIDADE.map((e) => e.chave)).toEqual([
      'accessible',
      'lgp',
      'audiodescricao',
      'legendas',
      'relaxada',
    ]);
    const todos = filtro({
      accessible: '1',
      lgp: '1',
      audiodescricao: '1',
      legendas: '1',
      relaxada: '1',
    });
    expect(buildHref(todos, 1)).toBe(
      '/agenda?accessible=1&lgp=1&audiodescricao=1&legendas=1&relaxada=1',
    );
  });

  it('cada um larga-se sozinho, sem levar os outros atrás', () => {
    const atual = filtro({ lgp: '1', legendas: '1' });
    expect(buildHref(atual, 1, 'lgp')).toBe('/agenda?legendas=1');
  });

  it('cada um aparece como ficha com o nome por extenso', () => {
    const fichas = fichasDosFiltros(filtro({ audiodescricao: '1' }), QUARTA, NOMES);
    expect(fichas.map((f) => f.label)).toEqual(['Com audiodescrição']);
    expect(fichas[0]?.href).toBe('/agenda');
  });

  // O nome antigo fica: vive em endereços partilhados e em favoritos de quem
  // os guardou, e renomeá-lo partia-os todos de uma vez.
  it('o acesso a cadeiras de rodas manteve o nome que já tinha', () => {
    expect(buildHref(filtro({ accessible: '1' }), 1)).toBe('/agenda?accessible=1');
  });
});

/**
 * Que caixas o formulário oferece, e o que diz das outras (C2-010).
 *
 * As contagens são as do Médio Tejo: acesso a cadeiras de rodas em oito
 * eventos (todos pelo espaço), e nenhum com Língua Gestual Portuguesa,
 * audiodescrição, legendagem ou sessão relaxada.
 */
describe('eixosDoFormulario', () => {
  const ZERO = { lgp: 0, audiodescricao: 0, legendas: 0, relaxada: 0 };
  const AGENDA = { accessible: 8, ...ZERO };
  const chaves = (eixos: readonly { chave: string }[]) => eixos.map((eixo) => eixo.chave);

  it('esconde a caixa que devolve sempre zero — e diz porquê, em vez de se calar', () => {
    const { oferecidos, nenhumNaAgenda, nenhumNoRecorte } = eixosDoFormulario(
      filtro(),
      AGENDA,
      AGENDA,
    );
    expect(chaves(oferecidos)).toEqual(['accessible']);
    expect(chaves(nenhumNaAgenda)).toEqual(['lgp', 'audiodescricao', 'legendas', 'relaxada']);
    expect(nenhumNoRecorte).toEqual([]);
    expect(nomesDosEixos(nenhumNaAgenda)).toBe(
      'Língua Gestual Portuguesa, audiodescrição, legendagem ou sessão relaxada',
    );
  });

  it('a caixa pedida no endereço fica, para se poder desligar — e o zero diz-se na mesma', () => {
    const { oferecidos, nenhumNaAgenda } = eixosDoFormulario(
      filtro({ lgp: '1' }),
      { accessible: 0, ...ZERO },
      AGENDA,
    );
    expect(chaves(oferecidos)).toEqual(['lgp']);
    expect(chaves(nenhumNaAgenda)).toContain('lgp');
  });

  it('distingue o zero do recorte do zero da agenda inteira', () => {
    // Em Tomar não há audiodescrição; noutro concelho há.
    const { oferecidos, nenhumNaAgenda, nenhumNoRecorte } = eixosDoFormulario(
      filtro({ municipality: 'tomar' }),
      { accessible: 3, ...ZERO },
      { ...AGENDA, audiodescricao: 2 },
    );
    expect(chaves(oferecidos)).toEqual(['accessible']);
    expect(chaves(nenhumNoRecorte)).toEqual(['audiodescricao']);
    expect(chaves(nenhumNaAgenda)).toEqual(['lgp', 'legendas', 'relaxada']);
  });

  it('num recorte vazio não se fala do recorte: o vazio já diz o que tem a dizer', () => {
    const { nenhumNoRecorte } = eixosDoFormulario(
      filtro({ lgp: '1' }),
      { accessible: 0, ...ZERO },
      AGENDA,
      0,
    );
    expect(nenhumNoRecorte).toEqual([]);
  });

  it('sem contagem não se afirma nada: oferece as cadeiras de rodas, como antes, e cala-se', () => {
    const { oferecidos, nenhumNaAgenda, nenhumNoRecorte } = eixosDoFormulario(filtro(), null, null);
    expect(chaves(oferecidos)).toEqual(['accessible']);
    expect(nenhumNaAgenda).toEqual([]);
    expect(nenhumNoRecorte).toEqual([]);
  });

  it('sem a contagem do recorte, o zero da agenda inteira continua a poder dizer-se', () => {
    const { nenhumNaAgenda, nenhumNoRecorte } = eixosDoFormulario(filtro(), null, AGENDA);
    expect(chaves(nenhumNaAgenda)).toEqual(['lgp', 'audiodescricao', 'legendas', 'relaxada']);
    // O recorte é que não se pode comparar com nada.
    expect(nenhumNoRecorte).toEqual([]);
  });

  it('os nomes juntam-se como se diz em português', () => {
    const [, lgp, ad] = EIXOS_DE_ACESSIBILIDADE;
    if (!lgp || !ad) throw new Error('faltam eixos');
    expect(nomesDosEixos([lgp])).toBe('Língua Gestual Portuguesa');
    expect(nomesDosEixos([lgp, ad], 'conjunction')).toBe(
      'Língua Gestual Portuguesa e audiodescrição',
    );
  });
});

describe('pilulasDeFaceta', () => {
  const concelhos = [
    { valor: 'tomar', rotulo: 'Tomar' },
    { valor: 'ourem', rotulo: 'Ourém' },
    { valor: 'sardoal', rotulo: 'Sardoal' },
  ];

  it('uma pílula apagada liga o valor; a acesa desliga-o', () => {
    const atual = filtro({ municipality: 'tomar', category: 'musica' });
    const pilulas = pilulasDeFaceta(atual, 'municipality', concelhos, null);
    expect(pilulas.find((p) => p.valor === 'tomar')).toMatchObject({
      activa: true,
      href: '/agenda?category=musica',
    });
    expect(pilulas.find((p) => p.valor === 'ourem')).toMatchObject({
      activa: false,
      href: '/agenda?municipality=ourem&category=musica',
    });
  });

  it('com contagem, esconde as opções vazias mas nunca a acesa', () => {
    const atual = filtro({ municipality: 'sardoal' });
    const pilulas = pilulasDeFaceta(atual, 'municipality', concelhos, { tomar: 4, ourem: 0 });
    expect(pilulas.map((p) => [p.valor, p.quantos])).toEqual([
      ['tomar', 4],
      ['sardoal', 0],
    ]);
  });

  it('sem contagem, mostra todas e não inventa números', () => {
    const pilulas = pilulasDeFaceta(filtro(), 'category', concelhos, null);
    expect(pilulas).toHaveLength(3);
    expect(pilulas.every((p) => p.quantos === null)).toBe(true);
  });
});

/**
 * Os concelhos a zero saem das pílulas e ficam no fim da fila (C2-007): três
 * dos onze concelhos do Médio Tejo desapareciam da agenda sem uma palavra.
 */
/**
 * «Para crianças e famílias» é um filtro de público e não um atalho para a
 * categoria (C2-009) — e vive no endereço como os outros.
 */
describe('o filtro da família', () => {
  it('lê-se e escreve-se no endereço', () => {
    const atual = readFilter({ familia: '1', free: '1' });
    expect(atual.familia).toBe(true);
    expect(buildHref(atual, 1)).toBe('/agenda?free=1&familia=1');
  });

  it('tem ficha própria, que se tira sozinha', () => {
    const fichas = fichasDosFiltros(filtro({ familia: '1', free: '1' }), QUARTA, {
      municipalities: {},
      categories: {},
      venues: {},
      series: {},
    });
    expect(fichas).toContainEqual({ label: FAMILIA.rotulo, href: '/agenda?free=1' });
  });

  it('a regra usa a categoria e o público que os eventos já têm, e mais nada', () => {
    expect(FAMILIA).toMatchObject({
      categoria: 'infantil',
      publicos: ['family', 'children'],
      idadeMaxima: 12,
    });
  });
});

describe('concelhosSemEventos', () => {
  const concelhos = [
    { valor: 'tomar', rotulo: 'Tomar' },
    { valor: 'entroncamento', rotulo: 'Entroncamento' },
    { valor: 'ferreira-do-zezere', rotulo: 'Ferreira do Zêzere' },
  ];

  it('dá os que estão a zero, a ligar para a página deles e não para uma lista vazia', () => {
    expect(concelhosSemEventos(filtro(), concelhos, { tomar: 5 })).toEqual([
      { valor: 'entroncamento', rotulo: 'Entroncamento', href: '/concelho/entroncamento' },
      {
        valor: 'ferreira-do-zezere',
        rotulo: 'Ferreira do Zêzere',
        href: '/concelho/ferreira-do-zezere',
      },
    ]);
  });

  it('o concelho escolhido não se repete no fim da fila — tem a sua pílula acesa', () => {
    const atual = filtro({ municipality: 'entroncamento' });
    expect(concelhosSemEventos(atual, concelhos, { tomar: 5 }).map((c) => c.valor)).toEqual([
      'ferreira-do-zezere',
    ]);
  });

  it('sem contagem, não se sabe quem está a zero, e não se diz', () => {
    expect(concelhosSemEventos(filtro(), concelhos, null)).toEqual([]);
  });
});

/**
 * O vazio da agenda propõe tirar um filtro de cada vez (C2-008), com o
 * endereço já feito — e as datas tiram-se juntas, como a ficha as tira.
 */
describe('alargamentos', () => {
  const nomes = { municipalities: {}, categories: {}, venues: {}, series: {} };

  it('um por filtro a valer, com o filtro sem ele e o endereço canónico', () => {
    const atual = filtro({
      from: '2026-10-03',
      to: '2026-10-03',
      category: 'infantil',
      free: '1',
    });
    const lista = alargamentos(atual, nomes);
    expect(lista.map((a) => [a.rotulo, a.href])).toEqual([
      ['Em qualquer data', '/agenda?category=infantil&free=1'],
      ['Com ou sem entrada livre', '/agenda?from=2026-10-03&to=2026-10-03&category=infantil'],
      ['Em todas as categorias', '/agenda?from=2026-10-03&to=2026-10-03&free=1'],
    ]);
    expect(lista[0]?.filtro).toMatchObject({
      from: undefined,
      to: undefined,
      category: 'infantil',
    });
  });

  it('uma agenda sem filtros não tem nada a tirar', () => {
    expect(alargamentos(filtro(), nomes)).toEqual([]);
  });

  it('a pesquisa diz-se pelo que se escreveu', () => {
    expect(alargamentos(filtro({ q: 'ópera' }), nomes)[0]?.rotulo).toBe('Sem a pesquisa «ópera»');
  });
});

describe('atalhosDeData', () => {
  it('dá os três recortes, e nenhum aceso numa agenda sem datas', () => {
    const atalhos = atalhosDeData(filtro(), QUARTA);
    expect(atalhos.map((a) => a.id)).toEqual(['hoje', 'fim-de-semana', 'semana']);
    expect(atalhos.every((a) => !a.activo)).toBe(true);
  });

  it('o endereço leva as datas da janela e volta à primeira página', () => {
    const atalhos = atalhosDeData(filtro({ page: '4' }), QUARTA);
    const fimDeSemana = atalhos.find((a) => a.id === 'fim-de-semana');
    expect(fimDeSemana?.href).toBe('/agenda?from=2026-09-11&to=2026-09-13');
  });

  it('preserva os filtros a valer — incluindo os que só existem escondidos', () => {
    const atual = filtro({
      municipality: 'tomar',
      category: 'musica',
      venue: 'cine-teatro-paraiso',
      series: 'bons-sons',
      free: '1',
      accessible: '1',
      q: 'fado',
    });
    const href = atalhosDeData(atual, QUARTA).find((a) => a.id === 'hoje')?.href ?? '';
    for (const esperado of [
      'municipality=tomar',
      'category=musica',
      'venue=cine-teatro-paraiso',
      'series=bons-sons',
      'free=1',
      'accessible=1',
      'q=fado',
    ]) {
      expect(href).toContain(esperado);
    }
  });

  /*
   * A regressão que interessa travar.
   *
   * O canónico da agenda sai de `buildHref(filter, filter.page)`. Se um atalho
   * fosse construído com um `URLSearchParams` à parte, o endereço que a pessoa
   * carrega e o endereço que a página declara como canónico podiam divergir na
   * ordem das chaves — e um canónico que não é o endereço da própria página é
   * um sinal contraditório para quem indexa.
   */
  it('o endereço de um atalho é exactamente o canónico da vista a que leva', () => {
    const atual = filtro({ municipality: 'tomar' });
    for (const atalho of atalhosDeData(atual, QUARTA)) {
      const chegada = readFilter(
        Object.fromEntries(new URL(atalho.href, 'https://exemplo.pt').searchParams),
      );
      expect(buildHref(chegada, chegada.page)).toBe(atalho.href);
    }
  });
});

describe('a ficha de um dia só', () => {
  const NOMES = { municipalities: {}, categories: {}, venues: {}, series: {} };

  it('é uma ficha, e tira o dia inteiro (C2-020)', () => {
    const fichas = fichasDosFiltros(
      filtro({ from: '2026-09-12', to: '2026-09-12' }),
      QUARTA,
      NOMES,
    );
    expect(fichas).toEqual([{ label: 'Sábado, 12 de setembro', href: '/agenda' }]);
  });

  it('um intervalo continua a ser duas pontas, cada uma com a sua ficha', () => {
    const fichas = fichasDosFiltros(
      filtro({ from: '2026-09-12', to: '2026-09-20' }),
      QUARTA,
      NOMES,
    );
    expect(fichas.map((ficha) => ficha.label)).toEqual([
      'De 12 de setembro de 2026',
      'Até 20 de setembro de 2026',
    ]);
  });
});

describe('janelaActiva', () => {
  it('reconhece cada uma das três janelas', () => {
    expect(janelaActiva(filtro({ from: QUARTA, to: QUARTA }), QUARTA)).toBe('hoje');
    expect(janelaActiva(filtro({ from: '2026-09-11', to: '2026-09-13' }), QUARTA)).toBe(
      'fim-de-semana',
    );
    expect(janelaActiva(filtro({ from: QUARTA, to: '2026-09-15' }), QUARTA)).toBe('semana');
  });

  it('um dia a mais já não é a janela', () => {
    expect(janelaActiva(filtro({ from: '2026-09-11', to: '2026-09-14' }), QUARTA)).toBe(null);
  });

  it('meia janela não é janela nenhuma', () => {
    expect(janelaActiva(filtro({ from: '2026-09-11' }), QUARTA)).toBe(null);
  });
});

describe('descreverDatas', () => {
  it('diz o nome do recorte quando ele tem nome', () => {
    expect(descreverDatas(QUARTA, QUARTA, QUARTA)).toBe('hoje');
    expect(descreverDatas('2026-09-11', '2026-09-13', QUARTA)).toBe('este fim de semana');
    // Dentro de uma frase, e não o rótulo em minúsculas (C2-040).
    expect(descreverDatas(QUARTA, '2026-09-15', QUARTA)).toBe('nos próximos 7 dias');
  });

  it('um dia só leva o artigo que o dia leva, e amanhã é amanhã (C2-020)', () => {
    expect(descreverDatas('2026-09-12', '2026-09-12', QUARTA)).toBe('no sábado, 12 de setembro');
    expect(descreverDatas('2026-09-13', '2026-09-13', QUARTA)).toBe('no domingo, 13 de setembro');
    expect(descreverDatas('2026-09-11', '2026-09-11', QUARTA)).toBe(
      'na sexta-feira, 11 de setembro',
    );
    expect(descreverDatas('2026-09-10', '2026-09-10', QUARTA)).toBe('amanhã');
    expect(descreverDatas('2027-01-02', '2027-01-02', QUARTA)).toBe(
      'no sábado, 2 de janeiro de 2027',
    );
  });

  it('sem recorte com nome, continua a dizer as datas', () => {
    expect(descreverDatas('2026-09-11', '2026-09-14', QUARTA)).toContain('de 11');
    expect(descreverDatas('2026-09-11', undefined, QUARTA)).toContain('a partir de');
  });
});

describe('filtroIndexavel', () => {
  it('a agenda sem filtros indexa-se', () => {
    expect(filtroIndexavel(filtro())).toBe(true);
    expect(filtroIndexavel(filtro({ municipality: 'tomar' }))).toBe(true);
  });

  it('recusa a pesquisa, o espaço e o ciclo', () => {
    expect(filtroIndexavel(filtro({ q: 'fado' }))).toBe(false);
    expect(filtroIndexavel(filtro({ venue: 'cine-teatro-paraiso' }))).toBe(false);
    expect(filtroIndexavel(filtro({ series: 'bons-sons' }))).toBe(false);
  });

  it('recusa qualquer intervalo de datas — hoje é uma vista, amanhã é uma mentira', () => {
    expect(filtroIndexavel(filtro({ from: QUARTA, to: QUARTA }))).toBe(false);
    expect(filtroIndexavel(filtro({ from: QUARTA }))).toBe(false);
    expect(filtroIndexavel(filtro({ to: QUARTA }))).toBe(false);
  });
});
