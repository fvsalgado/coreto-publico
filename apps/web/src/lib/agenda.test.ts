import { describe, expect, it } from 'vitest';
import { eventFilterSchema } from '@coreto/core';
import {
  EIXOS_DE_ACESSIBILIDADE,
  PATH_DO_MAPA,
  atalhosDeData,
  buildHref,
  descreverDatas,
  fichasDosFiltros,
  filtroIndexavel,
  janelaActiva,
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

describe('janelaActiva', () => {
  it('reconhece cada uma das três janelas', () => {
    expect(janelaActiva(filtro({ from: QUARTA, to: QUARTA }), QUARTA)).toBe('hoje');
    expect(janelaActiva(filtro({ from: '2026-09-11', to: '2026-09-13' }), QUARTA)).toBe(
      'fim-de-semana',
    );
    expect(janelaActiva(filtro({ from: QUARTA, to: '2026-09-16' }), QUARTA)).toBe('semana');
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
