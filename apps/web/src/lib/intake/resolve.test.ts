import { normalizeForHash } from '@coreto/core';
import { describe, expect, it } from 'vitest';
import {
  resolveLocation,
  submissionConfidence,
  type MunicipalityRef,
  type VenueRef,
} from './resolve';

/** Uma amostra dos onze concelhos, com os nomes que dão falsos positivos. */
const MUNICIPALITIES: MunicipalityRef[] = [
  { id: 'abrantes', name: 'Abrantes' },
  { id: 'constancia', name: 'Constância' },
  { id: 'entroncamento', name: 'Entroncamento' },
  // «Mação» escreve-se «MACAO» num cartaz em maiúsculas, e é esse o caso que
  // obriga a comparação a ser sem acentos.
  { id: 'macao', name: 'Mação' },
  { id: 'tomar', name: 'Tomar' },
  { id: 'torres-novas', name: 'Torres Novas' },
  { id: 'vila-nova-da-barquinha', name: 'Vila Nova da Barquinha' },
];

const VENUES: Array<[string, VenueRef]> = [
  ['Cine-Teatro Paraíso', { id: 'cine-teatro-paraiso', municipalityId: 'tomar' }],
  ['Cineteatro Paraíso', { id: 'cine-teatro-paraiso', municipalityId: 'tomar' }],
  ['CT Paraíso', { id: 'cine-teatro-paraiso', municipalityId: 'tomar' }],
  ['Teatro Virgínia', { id: 'teatro-virginia', municipalityId: 'torres-novas' }],
  ['CITA', { id: 'castelo-de-almourol', municipalityId: 'vila-nova-da-barquinha' }],
  [
    'Centro Cultural do Entroncamento',
    { id: 'centro-cultural-entroncamento', municipalityId: 'entroncamento' },
  ],
];

const ALIASES = new Map(VENUES.map(([alias, venue]) => [normalizeForHash(alias), venue]));

/**
 * Um nome que se repete na região, com a resposta presa a um concelho.
 *
 * «Centro Cultural», sem mais nada, é cinco espaços diferentes nesta região —
 * e está mesmo na fila dos por resolver, escrito assim, vindo da programação
 * em rede CAMINHOS. Um alias preso ao concelho é a única forma de o desfazer.
 */
const ALIASES_DE_CONCELHO = new Map([
  [
    'vila-nova-da-barquinha',
    new Map([
      [
        'centrocultural',
        { id: 'centro-cultural-barquinha', municipalityId: 'vila-nova-da-barquinha' },
      ],
    ]),
  ],
]);

function resolve(
  text: string,
  extra: {
    venueName?: string;
    municipalityId?: string;
    venueAliasesByMunicipality?: typeof ALIASES_DE_CONCELHO;
  } = {},
) {
  return resolveLocation({
    text,
    municipalities: MUNICIPALITIES,
    venueAliases: ALIASES,
    ...extra,
  });
}

describe('resolução do espaço', () => {
  it('resolve pelo nome que a extração leu, mesmo numa grafia alternativa', () => {
    expect(resolve('', { venueName: 'Cineteatro Paraíso' })).toEqual({
      venueId: 'cine-teatro-paraiso',
      municipalityId: 'tomar',
    });
  });

  it('um nome repetido vai para o espaço do concelho que o email nomeia', () => {
    expect(
      resolve('', {
        venueName: 'Centro Cultural',
        municipalityId: 'vila-nova-da-barquinha',
        venueAliasesByMunicipality: ALIASES_DE_CONCELHO,
      }),
    ).toEqual({
      venueId: 'centro-cultural-barquinha',
      municipalityId: 'vila-nova-da-barquinha',
    });
  });

  it('e sem concelho no email não resolve nada, que é o honesto', () => {
    // Escolher entre os alias de onze concelhos sem saber de qual se fala era
    // adivinhar, e aqui não se adivinha. Fica por resolver, e vai para a fila.
    expect(
      resolve('', {
        venueName: 'Centro Cultural',
        venueAliasesByMunicipality: ALIASES_DE_CONCELHO,
      }),
    ).toEqual({ venueId: null, municipalityId: null });
  });

  it('o nome por extenso resolve sem precisar de concelho nenhum', () => {
    expect(resolve('', { venueName: 'Centro Cultural do Entroncamento' })).toEqual({
      venueId: 'centro-cultural-entroncamento',
      municipalityId: 'entroncamento',
    });
  });

  it('resolve uma sigla curta quando ela vem como nome do espaço', () => {
    expect(resolve('', { venueName: 'CITA' }).venueId).toBe('castelo-de-almourol');
  });

  it('resolve pelo corpo do email quando a extração não leu o espaço', () => {
    const text = 'O concerto é no Cine-Teatro Paraíso, às 21h30.';
    expect(resolve(text)).toEqual({
      venueId: 'cine-teatro-paraiso',
      municipalityId: 'tomar',
    });
  });

  it('não procura siglas curtas dentro do texto', () => {
    expect(resolve('Como se cita no programa, a entrada é livre.').venueId).toBe(null);
  });

  it('desiste quando o email nomeia dois espaços', () => {
    const text = 'Uma itinerância pelo Cine-Teatro Paraíso e pelo Teatro Virgínia.';
    expect(resolve(text).venueId).toBe(null);
  });

  it('o espaço decide o concelho, mesmo com outra terra mencionada', () => {
    const text = 'Espetáculo no Teatro Virgínia, uma coprodução com Abrantes.';
    expect(resolve(text)).toEqual({
      venueId: 'teatro-virginia',
      municipalityId: 'torres-novas',
    });
  });
});

describe('resolução do concelho', () => {
  it('aceita o que a extração propõe quando está na lista fechada', () => {
    expect(resolve('sem pistas nenhumas', { municipalityId: 'macao' }).municipalityId).toBe(
      'macao',
    );
  });

  it('ignora um concelho que não existe', () => {
    expect(resolve('sem pistas nenhumas', { municipalityId: 'lisboa' }).municipalityId).toBe(null);
  });

  it('lê o nome do concelho escrito no texto', () => {
    expect(resolve('A festa é em Abrantes, no largo.').municipalityId).toBe('abrantes');
  });

  it('lê um nome composto', () => {
    expect(resolve('Sessão em Vila Nova da Barquinha.').municipalityId).toBe(
      'vila-nova-da-barquinha',
    );
  });

  it('lê o nome sem acentos e em maiúsculas, como vem nos cartazes', () => {
    expect(resolve('CONCERTO EM MACAO').municipalityId).toBe('macao');
  });

  it('não confunde o verbo com a terra', () => {
    expect(resolve('Depois do espetáculo vamos tomar um café.').municipalityId).toBe(null);
  });

  it('não confunde a palavra corrente com a terra', () => {
    expect(resolve('Um trabalho de rara constância e entrega.').municipalityId).toBe(null);
  });

  it('desiste quando o email nomeia dois concelhos', () => {
    expect(resolve('Uma parceria entre Tomar e Abrantes.').municipalityId).toBe(null);
  });

  it('não apanha um nome colado a outra palavra', () => {
    expect(resolve('Abrantesmania nao e uma terra').municipalityId).toBe(null);
  });
});

describe('confiança de uma submissão por email', () => {
  it('nunca passa do tecto do canal, por muito que a extração se declare certa', () => {
    expect(submissionConfidence({ declared: 1, hasDate: true, hasMunicipality: true })).toBe(0.7);
  });

  it('desce quando não há data', () => {
    expect(submissionConfidence({ declared: 0.9, hasDate: false, hasMunicipality: true })).toBe(
      0.5,
    );
  });

  it('desce mais quando também não há concelho', () => {
    expect(submissionConfidence({ declared: 0.9, hasDate: false, hasMunicipality: false })).toBe(
      0.4,
    );
  });

  it('respeita uma extração que se declara insegura', () => {
    expect(submissionConfidence({ declared: 0.3, hasDate: true, hasMunicipality: true })).toBe(0.3);
  });

  it('nunca desce abaixo de zero', () => {
    expect(submissionConfidence({ declared: 0, hasDate: false, hasMunicipality: false })).toBe(0);
  });
});
