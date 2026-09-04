import { describe, expect, it } from 'vitest';
import {
  findNearDuplicates,
  mergeSourceDuplicates,
  occurrenceBase,
  slugBase,
  tituloSemEdicao,
} from './dedup';
import type { RawEvent } from './types';

function event(partial: Partial<RawEvent> & { sourceKey: string; title: string }): RawEvent {
  return { dates: [], ...partial };
}

describe('slugBase', () => {
  it('descarta os sufixos que os CMS acrescentam', () => {
    expect(slugBase('insegura-uma-tragedia')).toBe('insegura-uma-tragedia');
    expect(slugBase('insegura-uma-tragedia-2')).toBe('insegura-uma-tragedia');
    expect(slugBase('insegura-uma-tragedia-2-2-2')).toBe('insegura-uma-tragedia');
  });
});

describe('occurrenceBase', () => {
  it('reconhece a data no fim do endereço', () => {
    expect(occurrenceBase('https://x.pt/evento/concerto/2026-05-10/')).toBe(
      'https://x.pt/evento/concerto/',
    );
    expect(occurrenceBase('https://x.pt/evento/concerto/2026-05-10')).toBe(
      'https://x.pt/evento/concerto/',
    );
  });

  it('deixa em paz os endereços normais', () => {
    expect(occurrenceBase('https://x.pt/evento/concerto/')).toBe(null);
    expect(occurrenceBase(null)).toBe(null);
  });
});

describe('mergeSourceDuplicates', () => {
  it('funde entradas com o mesmo conteúdo, somando as sessões', () => {
    const result = mergeSourceDuplicates(
      [
        event({
          sourceKey: 'concerto',
          title: 'Concerto de Reis',
          description: 'A filarmónica toca.',
          dates: [{ date: '2026-01-06' }],
        }),
        event({
          sourceKey: 'concerto-2',
          title: 'Concerto de Reis',
          description: 'A filarmónica toca.',
          dates: [{ date: '2026-01-07' }],
        }),
      ],
      'tomar',
    );

    expect(result.events).toHaveLength(1);
    expect(result.mergedCount).toBe(1);
    expect(result.events[0]!.dates.map((d) => d.date)).toEqual(['2026-01-06', '2026-01-07']);
  });

  it('dá a identidade ao membro mais completo, não ao primeiro', () => {
    const result = mergeSourceDuplicates(
      [
        event({
          sourceKey: 'concerto-1',
          title: 'Concerto de Reis',
          description: 'Texto.',
          dates: [{ date: '2026-01-07' }],
        }),
        event({
          sourceKey: 'concerto',
          title: 'Concerto de Reis',
          description: 'Texto.',
          imageUrl: 'https://x.pt/cartaz.jpg',
          dates: [{ date: '2026-01-06' }],
        }),
      ],
      'tomar',
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.sourceKey).toBe('concerto');
    expect(result.events[0]!.imageUrl).toBe('https://x.pt/cartaz.jpg');
  });

  it('funde variantes de slug com janelas de datas sobrepostas', () => {
    const result = mergeSourceDuplicates(
      [
        event({
          sourceKey: 'fados',
          title: 'Noite de Fados',
          description: 'Primeira sessão, com Ana.',
          dates: [{ date: '2026-03-10' }],
        }),
        event({
          sourceKey: 'fados-1',
          title: 'Noite de Fados',
          description: 'Segunda sessão, com Bruno.',
          dates: [{ date: '2026-03-10', startTime: '22:00' }],
        }),
      ],
      'tomar',
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.dates).toHaveLength(2);
  });

  it('NÃO funde uma reposição noutro mês', () => {
    const result = mergeSourceDuplicates(
      [
        event({
          sourceKey: 'fados',
          title: 'Noite de Fados',
          description: 'Estreia.',
          dates: [{ date: '2026-03-10' }],
        }),
        event({
          sourceKey: 'fados-1',
          title: 'Noite de Fados',
          description: 'Reposição.',
          dates: [{ date: '2026-09-10' }],
        }),
      ],
      'tomar',
    );

    expect(result.events).toHaveLength(2);
  });

  it('funde uma programação publicada com um endereço por data', () => {
    const result = mergeSourceDuplicates(
      [
        event({
          sourceKey: 'a',
          sourceUrl: 'https://x.pt/evento/hora-do-conto/2026-05-10/',
          title: 'Hora do Conto',
          description: 'Sessão de 10 de maio.',
          dates: [{ date: '2026-05-10' }],
        }),
        event({
          sourceKey: 'b',
          sourceUrl: 'https://x.pt/evento/hora-do-conto/2026-05-17/',
          title: 'Hora do Conto',
          description: 'Sessão de 17 de maio.',
          dates: [{ date: '2026-05-17' }],
        }),
      ],
      'tomar',
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.dates).toHaveLength(2);
  });

  it('não funde eventos diferentes que apenas partilham o espaço', () => {
    const result = mergeSourceDuplicates(
      [
        event({ sourceKey: 'a', title: 'Concerto de Reis', dates: [{ date: '2026-01-06' }] }),
        event({
          sourceKey: 'b',
          title: 'Exposição de Fotografia',
          dates: [{ date: '2026-01-06' }],
        }),
      ],
      'tomar',
    );

    expect(result.events).toHaveLength(2);
    expect(result.mergedCount).toBe(0);
  });

  it('não perde sessões repetidas em entradas diferentes', () => {
    const result = mergeSourceDuplicates(
      [
        event({
          sourceKey: 'a',
          title: 'Fado',
          description: 'x',
          dates: [{ date: '2026-01-06', startTime: '21:00' }],
        }),
        event({
          sourceKey: 'a-2',
          title: 'Fado',
          description: 'x',
          dates: [{ date: '2026-01-06', startTime: '21:00' }],
        }),
      ],
      'tomar',
    );

    expect(result.events[0]!.dates).toHaveLength(1);
  });
});

describe('findNearDuplicates', () => {
  const existing = [
    { title: 'Concerto de Reis', date_start: '2026-01-06', municipality_id: 'tomar' },
    { title: 'Exposição de Fotografia', date_start: '2026-01-06', municipality_id: 'tomar' },
    { title: 'Concerto de Reis', date_start: '2026-01-06', municipality_id: 'ourem' },
  ];

  it('assinala o quase-igual do mesmo concelho', () => {
    const found = findNearDuplicates(
      { title: 'Concerto dos Reis', date: '2026-01-06', municipalityId: 'tomar' },
      existing,
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.event.title).toBe('Concerto de Reis');
  });

  it('não atravessa concelhos', () => {
    const found = findNearDuplicates(
      { title: 'Concerto de Reis', date: '2026-01-06', municipalityId: 'abrantes' },
      existing,
    );
    expect(found).toHaveLength(0);
  });

  it('não atravessa a janela de dias', () => {
    const found = findNearDuplicates(
      { title: 'Concerto de Reis', date: '2026-02-06', municipalityId: 'tomar' },
      existing,
    );
    expect(found).toHaveLength(0);
  });

  it('não casa títulos sem relação', () => {
    const found = findNearDuplicates(
      { title: 'Marcha de São João', date: '2026-01-06', municipalityId: 'tomar' },
      existing,
    );
    expect(found).toHaveLength(0);
  });
});

describe('mergeSameRun — a fonte que serve o mesmo evento duas vezes', () => {
  // Os dois «Feira de S.bartolomeu» que a API de Ourém serviu à produção:
  // identificadores de backends diferentes, sem sourceUrl, e cada um com a
  // sua descrição escrita por outra pessoa.
  const feira = (sourceKey: string, description: string) =>
    event({
      sourceKey,
      title: 'Feira de S.bartolomeu',
      description,
      sourceUrl: null,
      dates: [
        { date: '2026-08-29', startTime: null },
        { date: '2026-08-30', startTime: null },
      ],
    });

  it('funde o que as outras três passagens não conseguem agarrar', () => {
    const { events, mergedCount } = mergeSourceDuplicates(
      [
        feira('708a9714-2145-11f1-b0be-17f73afd5908', 'A Feira de São Bartolomeu em Caxarias…'),
        feira(
          '9e523534-9a4a-11f1-8511-9be515701332',
          'Realização da Tradicional Feira de S.Bartolomeu',
        ),
      ],
      'ourem',
    );

    expect(events).toHaveLength(1);
    expect(mergedCount).toBe(1);
    // As sessões dos dois ficam, sem repetir os mesmos dias.
    expect(events[0]?.dates.map((d) => d.date).sort()).toEqual(['2026-08-29', '2026-08-30']);
  });

  it('atravessa a diferença de ordinal entre «13ª Edição» e «13º»', () => {
    const trail = (sourceKey: string, title: string) =>
      event({
        sourceKey,
        title,
        sourceUrl: null,
        dates: [
          { date: '2026-10-24', startTime: null },
          { date: '2026-10-25', startTime: null },
        ],
      });

    const { events } = mergeSourceDuplicates(
      [
        trail('22b71570-ec9e-11f0-95c1-cf898350adfa', '13ª Edição Trail de Fátima'),
        trail('8a93d4a0-221b-11f1-8976-a78fdae40855', '13º Trail de Fátima'),
      ],
      'ourem',
    );

    expect(events).toHaveLength(1);
  });

  // O que se segue é o que a passagem NÃO pode fazer. Tirar o número da
  // edição só é seguro porque a janela de datas tem de bater certo.
  it('não funde duas edições do mesmo evento em anos diferentes', () => {
    const { events } = mergeSourceDuplicates(
      [
        event({
          sourceKey: 'a',
          title: '13º Trail de Fátima',
          dates: [{ date: '2026-10-24', startTime: null }],
        }),
        event({
          sourceKey: 'b',
          title: '14º Trail de Fátima',
          dates: [{ date: '2027-10-23', startTime: null }],
        }),
      ],
      'ourem',
    );

    expect(events).toHaveLength(2);
  });

  it('não funde o que apenas se sobrepõe — só o que coincide', () => {
    // Uma exposição de um mês cruza-se com tudo o que aconteça nesse mês. As
    // outras passagens aceitam sobreposição porque têm o slug a segurá-las;
    // esta não tem, e por isso exige a janela exata.
    const { events } = mergeSourceDuplicates(
      [
        event({
          sourceKey: 'a',
          title: 'Magusto',
          description: 'O magusto do mês inteiro, em várias freguesias.',
          sourceUrl: null,
          dates: [
            { date: '2026-11-01', startTime: null },
            { date: '2026-11-30', startTime: null },
          ],
        }),
        event({
          sourceKey: 'b',
          title: 'Magusto',
          description: 'O magusto de Espite, no coreto.',
          sourceUrl: null,
          dates: [{ date: '2026-11-11', startTime: null }],
        }),
      ],
      'ourem',
    );

    expect(events).toHaveLength(2);
  });

  it('não toca em eventos sem data — esses vão à fila, não à fusão', () => {
    const { events } = mergeSourceDuplicates(
      [
        event({ sourceKey: 'a', title: 'Sem data', description: 'um', dates: [] }),
        event({ sourceKey: 'b', title: 'Sem data', description: 'outro', dates: [] }),
      ],
      'ourem',
    );

    expect(events).toHaveLength(2);
  });
});

describe('tituloSemEdicao', () => {
  it('tira o ordinal e a palavra edição', () => {
    expect(tituloSemEdicao('13ª Edição Trail de Fátima')).toBe(
      tituloSemEdicao('13º Trail de Fátima'),
    );
    expect(tituloSemEdicao('18ª Edição da Feirinha de Setembro')).toBe(
      tituloSemEdicao('Feirinha de Setembro'),
    );
  });

  it('não come um título que começa por número e é o nome', () => {
    // «1143» é o ano da fundação, não uma edição — mas mesmo que fosse comido,
    // a janela de datas segura. O que não pode é devolver vazio.
    expect(tituloSemEdicao('1143')).not.toBe('');
  });

  it('deixa em paz um título sem ordinal nenhum', () => {
    expect(tituloSemEdicao('Mercados Ecorurais')).toBe(tituloSemEdicao('Mercados Ecorurais'));
    expect(tituloSemEdicao('Mercados Ecorurais')).not.toBe('');
  });
});
