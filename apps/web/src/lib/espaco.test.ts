import { describe, expect, it } from 'vitest';
import type { VenueKind } from '@coreto/core';
import {
  corDoEspaco,
  filtrarEspacos,
  freguesiaCurta,
  nomeCasaCom,
  ordenarEspacos,
  perfilDoEspaco,
} from './espaco';

const GENEROS: VenueKind[] = [
  'theatre',
  'cinema',
  'museum',
  'library',
  'gallery',
  'cultural_centre',
  'auditorium',
  'bandstand',
  'heritage',
  'religious',
  'association',
  'market',
  'outdoor',
  'education',
  'other',
];

describe('perfilDoEspaco', () => {
  it('dá a cada género um locativo em português', () => {
    // Um género novo no `VenueKind` sem entrada aqui sairia como «neste
    // espaço» sem ninguém dar por isso; o teste percorre o catálogo inteiro.
    for (const kind of GENEROS) {
      const { locativo } = perfilDoEspaco(kind, false);
      expect(locativo, kind).toMatch(/^n(este|esta) .+/);
    }
  });

  it('trata o coreto e o parque como espaços sem porta', () => {
    expect(perfilDoEspaco('bandstand', false).aoArLivre).toBe(true);
    expect(perfilDoEspaco('outdoor', false).aoArLivre).toBe(true);
    expect(perfilDoEspaco('bandstand', false).temBalcao).toBe(false);
  });

  it('conta com balcão num teatro ou numa biblioteca', () => {
    expect(perfilDoEspaco('theatre', false).temBalcao).toBe(true);
    expect(perfilDoEspaco('library', false).temBalcao).toBe(true);
  });

  it('chama coletividade a uma coletividade, seja qual for a casa', () => {
    // A SMUT está registada como `association`, mas o Choral Phydellius podia
    // estar como `auditorium` e continuava a ser uma coletividade.
    expect(perfilDoEspaco('auditorium', true).locativo).toBe('nesta coletividade');
    expect(perfilDoEspaco('association', false).locativo).toBe('nesta coletividade');
  });

  it('não dá por certo o balcão de uma coletividade ao ar livre', () => {
    // O perfil de acesso vem do sítio, não do estatuto: uma coletividade que
    // programa num coreto continua a não ter porta.
    expect(perfilDoEspaco('bandstand', true).temBalcao).toBe(false);
    expect(perfilDoEspaco('bandstand', true).locativo).toBe('nesta coletividade');
  });
});

describe('nomeCasaCom', () => {
  it('encontra o teatro sem o til que ninguém escreve no telemóvel', () => {
    expect(nomeCasaCom('Teatro Virgínia', 'virginia')).toBe(true);
    expect(nomeCasaCom('Teatro Virgínia', 'VIRGÍNIA')).toBe(true);
  });

  it('procura por conter e não por começar', () => {
    // Metade do catálogo começa pelo género da casa. Quem escreve «gil
    // vicente» tem na cabeça o nome, não o «Cine-Teatro» que vem à frente.
    expect(nomeCasaCom('Cine-Teatro Gil Vicente', 'gil vicente')).toBe(true);
    expect(nomeCasaCom('Sociedade Filarmónica Gualdim Pais', 'filarmonica')).toBe(true);
  });

  it('deixa passar tudo quando não há procura', () => {
    // A página serve-se disto: sem `?q=` o filtro não pode esconder nada.
    expect(nomeCasaCom('Teatro Virgínia', '')).toBe(true);
    expect(nomeCasaCom('Teatro Virgínia', '   ')).toBe(true);
  });

  it('não devolve o que não casa', () => {
    expect(nomeCasaCom('Teatro Virgínia', 'museu')).toBe(false);
  });
});

/**
 * «Um sítio onde se entre de cadeira de rodas» (C2-012). A caixa mostra o que
 * o espaço declara, e só isso: quem se cala fica de fora, como quem diz que
 * não — e nada se infere do género do espaço.
 */
describe('filtrarEspacos', () => {
  const ESPACOS = [
    {
      name: 'Cine-Teatro da Vila',
      kind: 'theatre',
      is_association: false,
      wheelchair_accessible: true,
    },
    {
      name: 'Teatro do Largo',
      kind: 'theatre',
      is_association: false,
      wheelchair_accessible: null,
    },
    {
      name: 'Coreto do Jardim',
      kind: 'bandstand',
      is_association: false,
      wheelchair_accessible: false,
    },
    {
      name: 'Sociedade Filarmónica',
      kind: 'association',
      is_association: true,
      wheelchair_accessible: true,
    },
  ];
  const SEM_FILTRO = { procura: '', tipo: null, soColetividades: false, soAcessiveis: false };
  const nomes = (lista: readonly { name: string }[]) => lista.map((espaco) => espaco.name);

  it('só os que declaram acesso — o silêncio e o «não» ficam de fora', () => {
    expect(nomes(filtrarEspacos(ESPACOS, { ...SEM_FILTRO, soAcessiveis: true }))).toEqual([
      'Cine-Teatro da Vila',
      'Sociedade Filarmónica',
    ]);
  });

  it('soma-se aos outros filtros', () => {
    expect(
      nomes(filtrarEspacos(ESPACOS, { ...SEM_FILTRO, soAcessiveis: true, tipo: 'theatre' })),
    ).toEqual(['Cine-Teatro da Vila']);
    expect(
      nomes(filtrarEspacos(ESPACOS, { ...SEM_FILTRO, soAcessiveis: true, soColetividades: true })),
    ).toEqual(['Sociedade Filarmónica']);
  });

  it('sem filtros, passam todos', () => {
    expect(filtrarEspacos(ESPACOS, SEM_FILTRO)).toHaveLength(ESPACOS.length);
  });
});

describe('corDoEspaco', () => {
  it('dá a cada género uma das cores com par de contraste medido', () => {
    // Só os pares que o `cores.test.ts` mede: uma família com a tinta da capa,
    // ou o turquesa da casa com a tinta dele. Uma cor nova aqui era uma cor
    // que nenhum teste tinha medido.
    for (const kind of GENEROS) {
      expect(corDoEspaco(kind, false), kind).toMatch(
        /^(bg-cat-[a-z]+ text-on-cat|bg-accent text-on-accent)$/,
      );
    }
  });

  it('pinta a coletividade como coletividade, seja qual for a casa', () => {
    expect(corDoEspaco('cultural_centre', true)).toBe(corDoEspaco('association', false));
  });

  it('não parte com um género que o catálogo ainda não conhece', () => {
    expect(corDoEspaco('planetario', false)).toBe(corDoEspaco('other', false));
  });
});

describe('ordenarEspacos', () => {
  const ESPACOS = [
    { id: 'centro', name: 'Centro Cultural', is_association: false },
    { id: 'banda', name: 'Sociedade Filarmónica', is_association: true },
    { id: 'teatro', name: 'Teatro', is_association: false },
    { id: 'biblioteca', name: 'Biblioteca', is_association: false },
  ];

  it('põe primeiro os que têm alguma coisa marcada', () => {
    const ordem = ordenarEspacos(ESPACOS, { teatro: 40, biblioteca: 1 }).map((e) => e.id);
    expect(ordem.slice(0, 2).sort()).toEqual(['biblioteca', 'teatro']);
  });

  it('não premeia quem publica mais: com eventos, a ordem é a do nome', () => {
    const ordem = ordenarEspacos(ESPACOS, { teatro: 40, biblioteca: 1 }).map((e) => e.id);
    expect(ordem.slice(0, 2)).toEqual(['biblioteca', 'teatro']);
  });

  it('mantém as coletividades à frente dentro de cada grupo', () => {
    const ordem = ordenarEspacos(ESPACOS, {}).map((e) => e.id);
    expect(ordem[0]).toBe('banda');
    const comEventos = ordenarEspacos(ESPACOS, { banda: 2, teatro: 3 }).map((e) => e.id);
    expect(comEventos.slice(0, 2)).toEqual(['banda', 'teatro']);
  });
});

describe('freguesiaCurta', () => {
  it('tira o «União das freguesias de» e mais nada', () => {
    expect(
      freguesiaCurta('União das freguesias de Torres Novas (Santa Maria, Salvador e Santiago)'),
    ).toBe('Torres Novas (Santa Maria, Salvador e Santiago)');
    expect(freguesiaCurta('União das Freguesias de Alvega e Concavada')).toBe('Alvega e Concavada');
  });

  it('deixa os parênteses, que às vezes dizem a aldeia', () => {
    expect(freguesiaCurta('Malhou, Louriceira e Espinheiro (Louriceira)')).toBe(
      'Malhou, Louriceira e Espinheiro (Louriceira)',
    );
  });

  it('não inventa nada quando não há freguesia', () => {
    expect(freguesiaCurta(null)).toBeNull();
  });
});
