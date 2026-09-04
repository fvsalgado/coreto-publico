import { describe, expect, it } from 'vitest';
import { eventFingerprint } from './fingerprint';
import {
  cleanEventDescription,
  fixShoutyTitle,
  normalizeForHash,
  normalizeTitle,
  numeroPorExtenso,
  slugify,
  trigramSimilarity,
  truncate,
  unescapeHtml,
} from './text';

/**
 * Valores de referência produzidos por um Postgres real com as migrações
 * aplicadas (`scripts/verify-migrations.sh`). Não são inventados: cada linha
 * saiu de `select normalize_for_hash(v), slugify(v), event_fingerprint(v, ...)`.
 *
 * São a garantia de que as duas implementações — TypeScript na recolha, SQL
 * na aprovação de submissões — continuam a produzir a mesma chave. Se algum
 * destes falhar, o catálogo vai duplicar: não se «arranja» o teste, arranja-se
 * a divergência.
 */
const PG_GOLDEN = [
  {
    input: 'Concerto de Ano Novo',
    norm: 'concertodeanonovo',
    slug: 'concerto-de-ano-novo',
    fingerprint: 'f3898385b1d58e3e8034b5797f54f6747e69a79a49c5e497b28e07f772f7d6d6',
  },
  {
    input: '2ª Feira de São Brás',
    norm: '2feiradesaobras',
    slug: '2-feira-de-sao-bras',
    fingerprint: '6eb08924857f87d9422ad4d7b8c2298f38f819e796bff77c6a22bba66445362f',
  },
  {
    input: 'Ourém: Vila Medieval',
    norm: 'ouremvilamedieval',
    slug: 'ourem-vila-medieval',
    fingerprint: '5171d00a27e3c067d4d205ddbc04222bffaa89d6f32a61917db2cea21887779e',
  },
  {
    input: 'Festa da Nossa Senhora da Piedade — 3º dia',
    norm: 'festadanossasenhoradapiedade3dia',
    slug: 'festa-da-nossa-senhora-da-piedade-3-dia',
    fingerprint: '0c4ba98d92ebb38677a252bba9f1d91f14a2248a069cd002794ff0928675b064',
  },
  {
    input: 'Ferreira do Zêzere',
    norm: 'ferreiradozezere',
    slug: 'ferreira-do-zezere',
    fingerprint: 'e2263cbdef8f806e87a6fdb8d0fdba073e23f16e19bc34334263d9e2833471e1',
  },
  {
    input: 'Cão & Gato',
    norm: 'caogato',
    slug: 'cao-gato',
    fingerprint: '936d7c46f029f4f267c82351c43ec32c92795da0d4374012ef92bc65414b421f',
  },
  {
    input: 'Café-Concerto  «Fados»',
    norm: 'cafeconcertofados',
    slug: 'cafe-concerto-fados',
    fingerprint: 'b3ad151322d784e2ad5859c40b914867fd287b42631d52b7661c106343e295df',
  },
  {
    input: 'Exposição: «O Tejo»',
    norm: 'exposicaootejo',
    slug: 'exposicao-o-tejo',
    fingerprint: 'e6a3127163aacef1a7806060cd973090bf3a7e1fabe45534225101d2fffb6b92',
  },
  {
    input: 'Straße',
    norm: 'strasse',
    slug: 'strasse',
    fingerprint: 'bb47002fe7962796a9eb42d67c8074c9586f2730c803282deec078e1b2063023',
  },
  {
    input: 'ÀÁÂÃÇÉÊÍÓÔÕÚÜ',
    norm: 'aaaaceeiooouu',
    slug: 'aaaaceeiooouu',
    fingerprint: '62a0ada13396bd799270ea3b5e1878b4134bd220bde8d4cfd6fc945d62bee5ef',
  },
  {
    input: 'Mação 100% — Ação!',
    norm: 'macao100acao',
    slug: 'macao-100-acao',
    fingerprint: 'baf5df60422ca73d1e10d267d8c044ec56aafe498cecfa2d697a1f1da84f8f0c',
  },
] as const;

describe('paridade com o Postgres', () => {
  it.each(PG_GOLDEN)('normalizeForHash($input)', ({ input, norm }) => {
    expect(normalizeForHash(input)).toBe(norm);
  });

  it.each(PG_GOLDEN)('slugify($input)', ({ input, slug }) => {
    expect(slugify(input)).toBe(slug);
  });

  it.each(PG_GOLDEN)('eventFingerprint($input)', ({ input, fingerprint }) => {
    expect(eventFingerprint(input, '2026-05-10', 'tomar')).toBe(fingerprint);
  });
});

describe('normalizeForHash', () => {
  it('ignora pontuação, espaços e caixa', () => {
    expect(normalizeForHash('  concerto DE ano-novo!! ')).toBe(
      normalizeForHash('Concerto de Ano Novo'),
    );
  });

  it('trata aspas tipográficas e retas como equivalentes', () => {
    expect(normalizeForHash('«Fados»')).toBe(normalizeForHash('"Fados"'));
  });

  it('devolve cadeia vazia para entrada vazia', () => {
    expect(normalizeForHash(null)).toBe('');
    expect(normalizeForHash(undefined)).toBe('');
    expect(normalizeForHash('')).toBe('');
  });
});

describe('eventFingerprint', () => {
  it('separa concelhos', () => {
    expect(eventFingerprint('Fado', '2026-05-10', 'tomar')).not.toBe(
      eventFingerprint('Fado', '2026-05-10', 'ourem'),
    );
  });

  it('separa datas', () => {
    expect(eventFingerprint('Fado', '2026-05-10', 'tomar')).not.toBe(
      eventFingerprint('Fado', '2026-05-11', 'tomar'),
    );
  });

  it('trata data em falta como cadeia vazia, sem rebentar', () => {
    expect(eventFingerprint('Fado', null, 'tomar')).toHaveLength(64);
  });
});

describe('unescapeHtml', () => {
  it('descodifica entidades nomeadas e numéricas', () => {
    expect(unescapeHtml('Miguel Gameiro &amp; Pólo Norte')).toBe('Miguel Gameiro & Pólo Norte');
    expect(unescapeHtml('Tomar &#8211; Abrantes')).toBe('Tomar – Abrantes');
  });

  it('desfaz dupla codificação', () => {
    expect(unescapeHtml('Tomar &amp;#8211; Abrantes')).toBe('Tomar – Abrantes');
  });

  it('deixa em paz o que não é entidade', () => {
    expect(unescapeHtml('50% & mais')).toBe('50% & mais');
  });
});

describe('fixShoutyTitle', () => {
  it('desliga o CAPS LOCK com as minúsculas do português', () => {
    expect(fixShoutyTitle('NOITE DE FADOS NO CORETO')).toBe('Noite de Fados no Coreto');
    expect(fixShoutyTitle('FESTA DA NOSSA SENHORA DA PIEDADE')).toBe(
      'Festa da Nossa Senhora da Piedade',
    );
  });

  it('mantém em maiúsculas a palavra inicial mesmo sendo curta', () => {
    expect(fixShoutyTitle('OS SINOS DE MAÇÃO')).toBe('Os Sinos de Mação');
  });

  it('deixa siglas em paz', () => {
    expect(fixShoutyTitle('MIAA')).toBe('MIAA');
    expect(fixShoutyTitle('CCV Alviela')).toBe('CCV Alviela');
    expect(fixShoutyTitle('EXPOSIÇÃO NO MIAA')).toBe('Exposição no MIAA');
    expect(fixShoutyTitle('CONCERTO NA SCOCS')).toBe('Concerto na SCOCS');
  });

  it('não mexe num título já em caixa normal', () => {
    expect(fixShoutyTitle('Concerto de Ano Novo')).toBe('Concerto de Ano Novo');
  });
});

describe('normalizeTitle', () => {
  it('colapsa espaços e descodifica entidades', () => {
    expect(normalizeTitle('  Fado   &amp;  Guitarra ')).toBe('Fado & Guitarra');
  });
});

describe('truncate', () => {
  it('corta na palavra e acrescenta reticências', () => {
    expect(truncate('um dois três quatro', 12)).toBe('um dois…');
  });

  it('devolve o texto intacto quando cabe', () => {
    expect(truncate('curto', 40)).toBe('curto');
  });
});

describe('trigramSimilarity', () => {
  it('dá 1 a cadeias iguais depois de normalizadas', () => {
    expect(trigramSimilarity('Concerto de Reis', 'CONCERTO DE REIS!')).toBe(1);
  });

  it('dá valores altos a variantes próximas', () => {
    expect(trigramSimilarity('Concerto de Reis', 'Concerto dos Reis')).toBeGreaterThan(0.5);
  });

  it('dá valores baixos a títulos sem relação', () => {
    expect(trigramSimilarity('Concerto de Reis', 'Exposição de Fotografia')).toBeLessThan(0.2);
  });
});

describe('numeroPorExtenso', () => {
  it('escreve os números das CIM reais em português europeu', () => {
    expect(numeroPorExtenso(11)).toBe('onze');
    expect(numeroPorExtenso(13)).toBe('treze');
    expect(numeroPorExtenso(16)).toBe('dezasseis');
    expect(numeroPorExtenso(19)).toBe('dezanove');
    expect(numeroPorExtenso(21)).toBe('vinte e um');
  });

  it('cobre as pontas do intervalo', () => {
    expect(numeroPorExtenso(0)).toBe('zero');
    expect(numeroPorExtenso(1)).toBe('um');
    expect(numeroPorExtenso(20)).toBe('vinte');
    expect(numeroPorExtenso(99)).toBe('noventa e nove');
  });

  it('degrada para algarismos fora do intervalo, nunca inventa palavras', () => {
    expect(numeroPorExtenso(100)).toBe('100');
    expect(numeroPorExtenso(-1)).toBe('-1');
    expect(numeroPorExtenso(2.5)).toBe('2.5');
  });
});

describe('cleanEventDescription', () => {
  it('corta o título repetido em maiúsculas no arranque', () => {
    const limpo = cleanEventDescription(
      "Vamos Somar Km's em 2026!",
      "VAMOS SOMAR KM'S EM 2026! O projeto Somar Km's teve início o ano passado.",
    );
    expect(limpo).toBe("O projeto Somar Km's teve início o ano passado.");
  });

  it('corta a tabela de propriedades achatada no fim', () => {
    const limpo = cleanEventDescription(
      'Passeio',
      'Um passeio pela vila. Informação do evento Data 19/01/2026 19:30 Data de fim do evento 21/12/2026 22:00 Local Mação',
    );
    expect(limpo).toBe('Um passeio pela vila.');
  });

  it('não toca no que não reconhece, e devolve null quando não sobra nada', () => {
    expect(cleanEventDescription('Concerto', 'Uma noite de fado com data marcada.')).toBe(
      'Uma noite de fado com data marcada.',
    );
    expect(cleanEventDescription('Feira', 'FEIRA')).toBeNull();
    expect(cleanEventDescription('Feira', null)).toBeNull();
  });
});
