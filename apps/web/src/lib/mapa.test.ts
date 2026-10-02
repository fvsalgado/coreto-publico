import { describe, expect, it } from 'vitest';
import {
  agruparEmLugares,
  agruparNoEcra,
  contornosDosConcelhos,
  folgaDoEnquadramento,
  limitesDaRegiao,
  type ConcelhoNoMapa,
  type Precisao,
  type EspacoNoMapa,
  type EventoNoMapa,
  nomeDaMarca,
  rotuloDaMarca,
  LOCALE_DO_MAPA,
  ATRIBUICAO_DO_MAPA_DE_BASE,
  comAtribuicaoEmPortugues,
  camadaAEsconder,
  ancoraDoCoreto,
  juntarCoretosNoEcra,
  limitesDosCoretos,
  nomeDaMarcaDeCoretos,
  type CoretoNoMapa,
  type Marca,
} from './mapa';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/**
 * Três concelhos de mentira, com as coordenadas verdadeiras de Tomar, Abrantes
 * e Alcanena.
 *
 * Os identificadores são inventados de propósito: o enquadramento verdadeiro é
 * o dos contornos desenhados, e com identificadores reais estes testes deixavam
 * de medir a projeção para passarem a medir a forma do Médio Tejo. A geografia
 * a sério tem o seu próprio teste, mais abaixo.
 */
const CONCELHOS: ConcelhoNoMapa[] = [
  { id: 'norte', name: 'Norte', latitude: 39.6039, longitude: -8.4103 },
  { id: 'nascente', name: 'Nascente', latitude: 39.4644, longitude: -8.1979 },
  { id: 'poente', name: 'Poente', latitude: 39.4592, longitude: -8.6714 },
];

const ESPACOS: EspacoNoMapa[] = [
  {
    id: 'cine-teatro-paraiso',
    name: 'Cine-Teatro Paraíso',
    municipality_id: 'norte',
    latitude: 39.6045,
    longitude: -8.4139,
  },
  {
    id: 'espaco-sem-coordenadas',
    name: 'Espaço sem coordenadas',
    municipality_id: 'norte',
    latitude: null,
    longitude: null,
  },
];

function evento(over: Partial<EventoNoMapa> & { id: string }): EventoNoMapa {
  return {
    slug: over.id,
    title: `Evento ${over.id}`,
    municipality_id: 'norte',
    venue_id: null,
    location_name: null,
    date_start: '2026-09-10',
    date_end: null,
    latitude: null,
    longitude: null,
    image_url: null,
    image_miniatura: null,
    image_alt: null,
    category_slug: null,
    source_url: null,
    ...over,
  };
}

describe('agruparEmLugares', () => {
  it('põe no espaço quem tem espaço com coordenadas', () => {
    const lugares = agruparEmLugares(
      [evento({ id: 'a', venue_id: 'cine-teatro-paraiso' })],
      ESPACOS,
      CONCELHOS,
    );
    expect(lugares).toHaveLength(1);
    expect(lugares[0]?.id).toBe('cine-teatro-paraiso');
    expect(lugares[0]?.nome).toBe('Cine-Teatro Paraíso');
    expect(lugares[0]?.precisao).toBe('exacta');
    expect(lugares[0]?.latitude).toBe(39.6045);
  });

  it('junta num ponto só os eventos do mesmo espaço', () => {
    const lugares = agruparEmLugares(
      [
        evento({ id: 'a', venue_id: 'cine-teatro-paraiso' }),
        evento({ id: 'b', venue_id: 'cine-teatro-paraiso' }),
      ],
      ESPACOS,
      CONCELHOS,
    );
    // Dois pontos sobrepostos faziam do clique uma lotaria sobre qual dos dois
    // está por cima.
    expect(lugares).toHaveLength(1);
    expect(lugares[0]?.eventos.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('manda para o centro do concelho quem não tem espaço, e diz que é aproximado', () => {
    const lugares = agruparEmLugares([evento({ id: 'a', location_name: 'Minde' })], [], CONCELHOS);
    expect(lugares[0]?.id).toBe('concelho:norte');
    expect(lugares[0]?.precisao).toBe('concelho');
    expect(lugares[0]?.latitude).toBe(39.6039);
  });

  it('não deixa um espaço sem coordenadas fingir que sabe onde é', () => {
    // O espaço existe no catálogo mas ninguém lhe pôs coordenadas. Herdar as do
    // concelho e continuar a dizer «exacta» seria pôr uma morada onde não há.
    const lugares = agruparEmLugares(
      [evento({ id: 'a', venue_id: 'espaco-sem-coordenadas' })],
      ESPACOS,
      CONCELHOS,
    );
    expect(lugares[0]?.precisao).toBe('concelho');
    expect(lugares[0]?.id).toBe('concelho:norte');
  });

  it('prefere as coordenadas do próprio evento às do espaço', () => {
    // A API de Ourém dá o ponto do evento, que é mais fino do que o do
    // equipamento onde ele acontece.
    const lugares = agruparEmLugares(
      [evento({ id: 'a', venue_id: 'cine-teatro-paraiso', latitude: 39.61, longitude: -8.42 })],
      ESPACOS,
      CONCELHOS,
    );
    expect(lugares[0]?.latitude).toBe(39.61);
    expect(lugares[0]?.precisao).toBe('exacta');
  });

  it('deixa de fora o evento de um concelho que não existe', () => {
    const lugares = agruparEmLugares(
      [evento({ id: 'a', municipality_id: 'lisboa' })],
      [],
      CONCELHOS,
    );
    // Sem coordenadas de lado nenhum não há ponto para desenhar — e inventar
    // um seria pôr o evento num sítio que ninguém afirmou.
    expect(lugares).toEqual([]);
  });

  it('ordena do mais cheio para o mais vazio', () => {
    const lugares = agruparEmLugares(
      [
        evento({ id: 'a', municipality_id: 'nascente' }),
        evento({ id: 'b' }),
        evento({ id: 'c' }),
        evento({ id: 'd' }),
      ],
      [],
      CONCELHOS,
    );
    // Os pequenos desenham-se por cima dos grandes, senão ficavam tapados.
    expect(lugares.map((lugar) => lugar.eventos.length)).toEqual([3, 1]);
  });
});

describe('a geografia verdadeira', () => {
  /*
   * Este bloco já leu os contornos reais do Médio Tejo de um módulo gerado e
   * confrontou-os com os onze centros. Essa verdade mudou de casa quando as
   * fronteiras passaram à base (migração 0105): quem prende os DADOS é agora
   * o gerador (`buscar-fronteiras.py` confere a área oficial de cada
   * concelho) e as schema-checks (anéis fechados, dentro da caixa da região).
   * O que fica aqui é o COMPORTAMENTO das funções, com uma região sintética
   * de dois concelhos quadrados — pequena o suficiente para se ler.
   */
  const QUADRADO_OESTE: [number, number][] = [
    [-8.6, 39.4],
    [-8.5, 39.4],
    [-8.5, 39.5],
    [-8.6, 39.5],
    [-8.6, 39.4],
  ];
  // Aberto de propósito: o último par não repete o primeiro, e é a função
  // que o tem de fechar.
  const QUADRADO_LESTE_ABERTO: [number, number][] = [
    [-8.4, 39.4],
    [-8.3, 39.4],
    [-8.3, 39.5],
    [-8.4, 39.5],
  ];

  const REGIAO: ConcelhoNoMapa[] = [
    { id: 'oeste', name: 'Oeste', latitude: 39.45, longitude: -8.55, boundary: QUADRADO_OESTE },
    {
      id: 'leste',
      name: 'Leste',
      latitude: 39.45,
      longitude: -8.35,
      boundary: QUADRADO_LESTE_ABERTO,
    },
    // Um concelho ainda sem contorno entra nos limites pelo centro e fica de
    // fora da camada de contornos — o mapa nunca deixa de se desenhar.
    { id: 'sem-contorno', name: 'Sem Contorno', latitude: 39.6, longitude: -8.45, boundary: null },
  ];

  /** Regra do número de voltas, por lançamento de raio. */
  function dentro(poligono: readonly number[][], [px, py]: [number, number]): boolean {
    let acumulado = false;
    for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
      const [xi, yi] = poligono[i]! as [number, number];
      const [xj, yj] = poligono[j]! as [number, number];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        acumulado = !acumulado;
      }
    }
    return acumulado;
  }

  it('desenha um contorno por concelho que o tenha, e salta os que não têm', () => {
    const contornos = contornosDosConcelhos(REGIAO);
    expect(contornos.features.map((feature) => feature.properties.id)).toEqual(['oeste', 'leste']);
  });

  it('fecha cada anel, como o GeoJSON exige — mesmo os que chegam abertos', () => {
    for (const feature of contornosDosConcelhos(REGIAO).features) {
      const anel = feature.geometry.coordinates[0]!;
      expect(anel.length).toBeGreaterThan(3);
      expect(anel[0]).toEqual(anel[anel.length - 1]);
    }
  });

  it('o centro de um concelho cai dentro do contorno desse concelho', () => {
    // É a forma sintética do teste que apanhava um contorno trocado quando os
    // dados viviam aqui: se as funções baralhassem ids e anéis, o centro
    // deixava de pertencer ao seu polígono.
    const contornos = new Map(
      contornosDosConcelhos(REGIAO).features.map((feature) => [
        feature.properties.id,
        feature.geometry.coordinates[0]!,
      ]),
    );

    for (const concelho of REGIAO) {
      if (!concelho.boundary) continue;
      const anel = contornos.get(concelho.id);
      expect(anel, concelho.id).toBeDefined();
      expect(dentro(anel!, [concelho.longitude!, concelho.latitude!]), concelho.id).toBe(true);
    }
  });

  it('leva a contagem de eventos para dentro das propriedades', () => {
    const contornos = contornosDosConcelhos(REGIAO, { oeste: 7 });
    const oeste = contornos.features.find((feature) => feature.properties.id === 'oeste');
    const leste = contornos.features.find((feature) => feature.properties.id === 'leste');

    expect(oeste!.properties.eventos).toBe(7);
    // Um concelho sem nada marcado entra na mesma, a zero. Deixá-lo de fora
    // dizia que não existe.
    expect(leste!.properties.eventos).toBe(0);
  });

  it('os limites cobrem os contornos, e não só os centros', () => {
    const limites = limitesDaRegiao(REGIAO)!;
    expect(limites).not.toBeNull();

    const [[oeste, sul], [este, norte]] = limites;
    for (const feature of contornosDosConcelhos(REGIAO).features) {
      for (const [longitude, latitude] of feature.geometry.coordinates[0]!) {
        expect(longitude!).toBeGreaterThanOrEqual(oeste);
        expect(longitude!).toBeLessThanOrEqual(este);
        expect(latitude!).toBeGreaterThanOrEqual(sul);
        expect(latitude!).toBeLessThanOrEqual(norte);
      }
    }

    // E são maiores do que a nuvem dos centros: com os centros, metade de um
    // concelho de fronteira ficava fora do enquadramento.
    expect(oeste).toBeLessThan(-8.55);
    expect(este).toBeGreaterThan(-8.35);
  });

  it('sem contornos nenhuns, os limites degradam para os centros', () => {
    const soCentros = REGIAO.map((concelho) => ({ ...concelho, boundary: null }));
    const limites = limitesDaRegiao(soCentros)!;
    expect(limites).not.toBeNull();
    const [[oeste, sul], [este, norte]] = limites;
    expect(oeste).toBe(-8.55);
    expect(este).toBe(-8.35);
    expect(sul).toBe(39.45);
    expect(norte).toBe(39.6);
  });

  it('sem geografia nenhuma não há limites', () => {
    expect(limitesDaRegiao([])).toBeNull();
  });
});

describe('agruparNoEcra', () => {
  /** Lugares com posições de ecrã ditadas por nós, para a conta ser a matéria. */
  function lugar(id: string, x: number, y: number, quantos: number, precisao: Precisao) {
    return {
      lugar: {
        id,
        nome: id,
        concelhoId: 'tomar',
        concelhoNome: 'Tomar',
        latitude: 39.6 + x / 10000,
        longitude: -8.4 + y / 10000,
        precisao,
        eventos: Array.from({ length: quantos }, (_, i) => evento({ id: `${id}-${i}` })),
      },
      x,
      y,
    };
  }

  function agrupar(entradas: ReturnType<typeof lugar>[], raio?: number) {
    const posicoes = new Map(entradas.map((entrada) => [entrada.lugar.id, entrada]));
    return agruparNoEcra(
      entradas.map((entrada) => entrada.lugar),
      (candidato) => {
        const entrada = posicoes.get(candidato.id)!;
        return { x: entrada.x, y: entrada.y };
      },
      raio,
    );
  }

  it('deixa em paz as marcas que não se tocam', () => {
    const marcas = agrupar([
      lugar('a', 0, 0, 1, 'exacta'),
      lugar('b', 300, 300, 1, 'exacta'),
      lugar('c', 600, 0, 1, 'exacta'),
    ]);
    expect(marcas).toHaveLength(3);
  });

  it('junta as que ficariam por cima umas das outras', () => {
    // Vinte pixéis é menos do que o alvo de toque: a de baixo era impossível
    // de carregar, ao rato e ao dedo.
    const marcas = agrupar([lugar('a', 100, 100, 2, 'exacta'), lugar('b', 110, 105, 3, 'exacta')]);
    expect(marcas).toHaveLength(1);
    expect(marcas[0]!.eventos).toBe(5);
    expect(marcas[0]!.lugares).toHaveLength(2);
  });

  it('a âncora é a que tem mais programação, e fica onde estava', () => {
    const cheia = lugar('cheia', 500, 500, 9, 'exacta');
    const vazia = lugar('vazia', 520, 500, 1, 'exacta');
    // Pela ordem contrária, para provar que não é a ordem de entrada que manda.
    const marcas = agrupar([vazia, cheia]);

    expect(marcas).toHaveLength(1);
    expect(marcas[0]!.id).toBe('cheia');
    expect(marcas[0]!.latitude).toBe(cheia.lugar.latitude);
  });

  it('uma marca que junta os dois casos é mista, e não um deles', () => {
    // Chamar-lhe «exacta» prometia uma morada a quem não a tem; chamar-lhe
    // «concelho» apagava a morada que se sabe.
    const marcas = agrupar([
      lugar('teatro', 200, 200, 3, 'exacta'),
      lugar('centro', 205, 202, 4, 'concelho'),
    ]);
    expect(marcas).toHaveLength(1);
    expect(marcas[0]!.precisao).toBe('mista');
  });

  it('com um raio menor, as mesmas marcas separam-se — é o que o zoom faz', () => {
    const entradas = [lugar('a', 100, 100, 1, 'exacta'), lugar('b', 130, 100, 1, 'exacta')];
    expect(agrupar(entradas)).toHaveLength(1);
    expect(agrupar(entradas, 20)).toHaveLength(2);
  });

  it('sem lugares não há marcas', () => {
    expect(agruparNoEcra([], () => ({ x: 0, y: 0 }))).toEqual([]);
  });
});

function lugar(nome: string, concelhoNome: string, precisao: 'exacta' | 'concelho', eventos = 1) {
  return {
    id: `${concelhoNome}:${nome}`,
    nome,
    concelhoId: concelhoNome.toLowerCase(),
    concelhoNome,
    latitude: 39.6,
    longitude: -8.4,
    precisao,
    eventos: Array.from({ length: eventos }, (_, i) => ({ id: `${nome}-${i}` })),
  } as unknown as Parameters<typeof nomeDaMarca>[0]['lugares'][number];
}

function marca(lugares: ReturnType<typeof lugar>[], eventos: number) {
  return {
    id: 'marca',
    latitude: 39.6,
    longitude: -8.4,
    lugares,
    eventos,
    precisao: 'exacta',
  } as Parameters<typeof nomeDaMarca>[0];
}

describe('nomeDaMarca', () => {
  it('um sítio com morada diz o nome do sítio e o concelho que a marca mostra', () => {
    expect(nomeDaMarca(marca([lugar('Cine-Teatro Paraíso', 'Tomar', 'exacta')], 3))).toBe(
      'Cine-Teatro Paraíso, Tomar — 3 eventos',
    );
  });

  it('não repete o concelho quando o nome do sítio já o traz', () => {
    expect(nomeDaMarca(marca([lugar('Aquapolis Abrantes', 'Abrantes', 'exacta')], 2))).toBe(
      'Aquapolis Abrantes — 2 eventos',
    );
  });

  it('um sítio sem morada diz «algures» e o concelho', () => {
    expect(nomeDaMarca(marca([lugar('Mação', 'Mação', 'concelho')], 1))).toBe(
      'Algures em Mação — 1 evento',
    );
  });

  it('uma marca junta de um só concelho nomeia esse concelho', () => {
    const junta = marca(
      [lugar('Paraíso', 'Tomar', 'exacta'), lugar('Levada', 'Tomar', 'exacta')],
      9,
    );
    expect(nomeDaMarca(junta)).toBe('2 sítios em Tomar — 9 eventos');
  });

  it('uma marca que atravessa dois concelhos diz os dois', () => {
    // `agruparNoEcra` junta por distância em pixéis e não conhece fronteiras:
    // afastado o mapa, dois concelhos vizinhos caem na mesma marca. Dizer o
    // concelho do primeiro lugar da lista afirmava dos outros uma coisa que
    // não se verificou.
    const junta = marca(
      [
        lugar('Jardim da Aranha', 'Entroncamento', 'exacta'),
        lugar('Zibreira', 'Torres Novas', 'exacta'),
      ],
      4,
    );
    expect(nomeDaMarca(junta)).toBe('2 sítios em Entroncamento e Torres Novas — 4 eventos');
  });

  it('a partir de três concelhos diz quantos são', () => {
    const junta = marca(
      [
        lugar('a', 'Tomar', 'exacta'),
        lugar('b', 'Ourém', 'exacta'),
        lugar('c', 'Alcanena', 'exacta'),
      ],
      6,
    );
    expect(nomeDaMarca(junta)).toBe('3 sítios em 3 concelhos — 6 eventos');
  });

  it('contém o que a marca mostra: o número e a etiqueta de baixo (WCAG 2.5.3)', () => {
    // Quem comanda o ecrã pela voz diz o que lê, e o comando só encontra a
    // marca se o nome a contiver. A auditoria (`label-content-name-mismatch`)
    // reprovou as marcas do `/mapa` a 2 de outubro, e este é o lado do nome.
    const marcas = [
      marca([lugar('Cine-Teatro Paraíso', 'Tomar', 'exacta')], 7),
      marca([lugar('Mação', 'Mação', 'concelho')], 1),
      marca([lugar('Paraíso', 'Tomar', 'exacta'), lugar('Levada', 'Tomar', 'exacta')], 9),
      marca(
        [lugar('Aquapolis', 'Abrantes', 'exacta'), lugar('Cine-Teatro', 'Constância', 'exacta')],
        8,
      ),
      marca(
        [
          lugar('a', 'Tomar', 'exacta'),
          lugar('b', 'Ourém', 'exacta'),
          lugar('c', 'Mação', 'exacta'),
        ],
        10,
      ),
    ];
    for (const m of marcas) {
      expect(nomeDaMarca(m)).toContain(String(m.eventos));
      expect(nomeDaMarca(m)).toContain(rotuloDaMarca(m));
    }
  });
});

describe('folgaDoEnquadramento', () => {
  it('é um décimo do lado menor, com 24 px de mínimo', () => {
    expect(folgaDoEnquadramento(358, 320)).toBe(32);
    expect(folgaDoEnquadramento(1024, 560)).toBe(56);
    expect(folgaDoEnquadramento(200, 900)).toBe(24);
  });

  it('numa caixa sem medida ainda, fica pelo mínimo', () => {
    expect(folgaDoEnquadramento(0, 0)).toBe(24);
    expect(folgaDoEnquadramento(Number.NaN, 400)).toBe(24);
  });
});

describe('rotuloDaMarca', () => {
  const lugar = (concelhoNome: string) => ({
    id: concelhoNome,
    nome: concelhoNome,
    concelhoId: concelhoNome.toLowerCase(),
    concelhoNome,
    latitude: 0,
    longitude: 0,
    precisao: 'concelho' as const,
    eventos: [],
  });
  const marca = (...nomes: string[]): Marca => ({
    id: 'm',
    latitude: 0,
    longitude: 0,
    lugares: nomes.map(lugar),
    eventos: nomes.length,
    precisao: 'concelho',
  });

  it('diz o concelho de uma marca de um concelho só', () => {
    expect(rotuloDaMarca(marca('Tomar', 'Tomar'))).toBe('Tomar');
  });

  it('diz os dois quando são dois, e quantos quando são mais', () => {
    expect(rotuloDaMarca(marca('Tomar', 'Ourém'))).toBe('Tomar e Ourém');
    expect(rotuloDaMarca(marca('Tomar', 'Ourém', 'Mação'))).toBe('3 concelhos');
  });
});

describe('LOCALE_DO_MAPA', () => {
  /*
   * As chaves vêm do próprio MapLibre, lidas do ficheiro que ele publica: uma
   * versão que acrescente uma chave faz este teste dizer qual falta, em vez de
   * o controlo novo aparecer em inglês sem ninguém dar por isso.
   */
  it('traduz todas as chaves que o MapLibre usa', () => {
    const require = createRequire(import.meta.url);
    const pasta = require.resolve('maplibre-gl/package.json').replace(/package\.json$/, '');
    const fonte = readFileSync(`${pasta}dist/maplibre-gl-dev.mjs`, 'utf8');
    const bloco = fonte.slice(fonte.indexOf('const defaultLocale = {'));
    const chaves = [
      ...bloco.slice(0, bloco.indexOf('};')).matchAll(/"([A-Za-z]+\.[A-Za-z]+)":/g),
    ].map((m) => m[1]);
    expect(chaves.length).toBeGreaterThan(10);
    for (const chave of chaves) expect(LOCALE_DO_MAPA, chave).toHaveProperty([chave as string]);
  });

  it('não deixa os botões de aproximar e afastar em inglês', () => {
    expect(LOCALE_DO_MAPA['NavigationControl.ZoomIn']).toBe('Aproximar');
    expect(LOCALE_DO_MAPA['NavigationControl.ZoomOut']).toBe('Afastar');
  });
});

describe('comAtribuicaoEmPortugues', () => {
  // A forma dos estilos do OpenFreeMap: uma fonte vetorial por TileJSON e o
  // relevo do Natural Earth em mosaicos de imagem.
  const estilo = {
    version: 8 as const,
    layers: [],
    sources: {
      openmaptiles: { type: 'vector' as const, url: 'https://tiles.openfreemap.org/planet' },
      ne2_shaded: {
        type: 'raster' as const,
        tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png'],
      },
      concelhos: {
        type: 'geojson' as const,
        data: { type: 'FeatureCollection' as const, features: [] },
      },
    },
  };

  it('põe a atribuição dos mosaicos em português, sem perder nenhum dos três créditos', () => {
    const traduzido = comAtribuicaoEmPortugues(estilo);
    const fonte = traduzido.sources['openmaptiles'];
    expect(fonte && 'attribution' in fonte ? fonte.attribution : null).toBe(
      ATRIBUICAO_DO_MAPA_DE_BASE,
    );
    expect(ATRIBUICAO_DO_MAPA_DE_BASE).not.toMatch(/Data from/);
    for (const credito of ['OpenFreeMap', '© OpenMapTiles', 'openstreetmap.org/copyright']) {
      expect(ATRIBUICAO_DO_MAPA_DE_BASE).toContain(credito);
    }
  });

  it('não escreve o crédito do OpenFreeMap em fontes que não são vetoriais dele', () => {
    const traduzido = comAtribuicaoEmPortugues(estilo);
    expect(traduzido.sources['ne2_shaded']).toEqual(estilo.sources.ne2_shaded);
    expect(traduzido.sources['concelhos']).toEqual(estilo.sources.concelhos);
  });
});

describe('camadaAEsconder', () => {
  it('esconde os países e os distritos dos dois estilos, e mais nada', () => {
    for (const id of ['label_country_1', 'place_country_major', 'label_state', 'place_state']) {
      expect(camadaAEsconder({ id, type: 'symbol' }), id).toBe(true);
    }
    for (const id of ['label_town', 'place_city', 'water_name']) {
      expect(camadaAEsconder({ id, type: 'symbol' }), id).toBe(false);
    }
    expect(camadaAEsconder({ id: 'boundary_country', type: 'line' })).toBe(false);
  });
});

describe('o mapa dos coretos', () => {
  /**
   * Coretos de mentira, com a longitude a fazer de píxel: a junção é em píxeis
   * do ecrã, e é isso que se mede — a projeção é do MapLibre.
   */
  function coreto(id: string, x: number, concelhoNome = 'Tomar', confirmado = true): CoretoNoMapa {
    return { id, nome: `Coreto ${id}`, concelhoNome, latitude: 39.6, longitude: x, confirmado };
  }
  const noEcra = (c: CoretoNoMapa) => ({ x: c.longitude, y: 0 });

  it('separa os que estão longe e junta os que cabem no mesmo alvo de 44 px', () => {
    const marcas = juntarCoretosNoEcra([coreto('a', 0), coreto('b', 30), coreto('c', 200)], noEcra);
    expect(marcas.map((marca) => marca.coretos.map((c) => c.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('a âncora de uma junção é um coreto confirmado, mesmo que o por confirmar venha primeiro', () => {
    const marcas = juntarCoretosNoEcra(
      [coreto('a', 0, 'Tomar', false), coreto('b', 20, 'Tomar', true)],
      noEcra,
    );
    expect(marcas).toHaveLength(1);
    expect(marcas[0]!.id).toBe('b');
    expect(marcas[0]!.longitude).toBe(20);
  });

  it('um coreto diz o nome e o concelho, e a dúvida quando a há', () => {
    const [confirmado] = juntarCoretosNoEcra([coreto('a', 0)], noEcra);
    const [duvidoso] = juntarCoretosNoEcra([coreto('b', 0, 'Ourém', false)], noEcra);
    expect(nomeDaMarcaDeCoretos(confirmado!)).toBe('Coreto a, Tomar');
    expect(nomeDaMarcaDeCoretos(duvidoso!)).toBe('Coreto b, Ourém — por confirmar');
  });

  it('vários dizem quantos, onde, e o que o botão faz — sem afirmar um concelho que não é', () => {
    const [doMesmo] = juntarCoretosNoEcra([coreto('a', 0), coreto('b', 10)], noEcra);
    const [deDois] = juntarCoretosNoEcra([coreto('a', 0), coreto('b', 10, 'Ourém')], noEcra);
    const [deTres] = juntarCoretosNoEcra(
      [coreto('a', 0), coreto('b', 10, 'Ourém'), coreto('c', 20, 'Abrantes')],
      noEcra,
    );
    expect(nomeDaMarcaDeCoretos(doMesmo!)).toBe('2 coretos em Tomar — aproximar o mapa');
    expect(nomeDaMarcaDeCoretos(deDois!)).toBe('2 coretos em Tomar e Ourém — aproximar o mapa');
    expect(nomeDaMarcaDeCoretos(deTres!)).toBe('3 coretos em 3 concelhos — aproximar o mapa');
  });

  it('a caixa de uns quantos coretos é a que os envolve, e sem coretos não há caixa', () => {
    expect(
      limitesDosCoretos([
        { ...coreto('a', -8.4), latitude: 39.5 },
        { ...coreto('b', -8.2), latitude: 39.7 },
      ]),
    ).toEqual([
      [-8.4, 39.5],
      [-8.2, 39.7],
    ]);
    expect(limitesDosCoretos([])).toBeNull();
  });

  it('a âncora do cartão é a mesma que a marca aponta', () => {
    expect(ancoraDoCoreto('coreto-alvega')).toBe('coreto-coreto-alvega');
  });
});
