import { describe, expect, it } from 'vitest';
import { eventFilterSchema } from '@coreto/core';
import {
  atalhosDeData,
  buildHref,
  descreverDatas,
  filtroIndexavel,
  janelaActiva,
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
