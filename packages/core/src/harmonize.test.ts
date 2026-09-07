import { describe, expect, it } from 'vitest';
import {
  harmonizeEvent,
  resolveVenue,
  resolveVenueInMunicipality,
  type HarmonizeContext,
} from './harmonize';
import { eventFingerprint } from './fingerprint';
import type { RawEvent } from './types';

const context: HarmonizeContext = {
  municipalityId: 'tomar',
  sourceId: 'cm-tomar',
  categoryAliases: new Map([
    ['musica', 'musica'],
    ['exposicao', 'exposicoes'],
  ]),
  venueAliases: new Map([
    ['cineteatroparaiso', 'cine-teatro-paraiso'],
    ['ctparaiso', 'cine-teatro-paraiso'],
  ]),
  venueKinds: new Map([['cine-teatro-paraiso', 'theatre']]),
  makeId: () => '0191b0f0-0000-7000-8000-000000000001',
  now: () => '2026-05-01T00:00:00.000Z',
};

function raw(partial: Partial<RawEvent> = {}): RawEvent {
  return {
    sourceKey: 'concerto-de-reis',
    title: 'Concerto de Reis',
    dates: [{ date: '2027-01-06', startTime: '21:00' }],
    ...partial,
  };
}

describe('resolveVenue', () => {
  it('resolve pelo alias normalizado', () => {
    expect(resolveVenue('Cine-Teatro Paraíso', context.venueAliases)).toBe('cine-teatro-paraiso');
    expect(resolveVenue('CT PARAÍSO', context.venueAliases)).toBe('cine-teatro-paraiso');
  });

  it('devolve null em vez de inventar um espaço', () => {
    expect(resolveVenue('Salão da Junta', context.venueAliases)).toBe(null);
    expect(resolveVenue(null, context.venueAliases)).toBe(null);
  });
});

describe('harmonizeEvent', () => {
  it('produz um evento canónico completo', () => {
    const { event, sessions } = harmonizeEvent(
      raw({
        venueName: 'Cine-Teatro Paraíso',
        categoriesRaw: ['Música'],
        description: 'A filarmónica local toca o programa de ano novo. Duração: 90 min.',
        priceRaw: '10€',
        sourceUrl: 'https://www.cm-tomar.pt/agenda/concerto-de-reis',
      }),
      context,
    );

    expect(event.title).toBe('Concerto de Reis');
    expect(event.municipality_id).toBe('tomar');
    expect(event.venue_id).toBe('cine-teatro-paraiso');
    expect(event.category_slug).toBe('musica');
    expect(event.date_start).toBe('2027-01-06');
    expect(event.date_end).toBe('2027-01-06');
    expect(event.price_min).toBe(10);
    expect(event.duration_minutes).toBe(90);
    expect(event.status).toBe('draft');
    expect(event.origin).toBe('scraper');
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.start_time).toBe('21:00');
  });

  it('calcula a mesma impressão digital que o Postgres', () => {
    const { event } = harmonizeEvent(raw(), context);
    expect(event.fingerprint).toBe(eventFingerprint('Concerto de Reis', '2027-01-06', 'tomar'));
  });

  it('guarda o nome do sítio como local livre quando o espaço não é do catálogo', () => {
    const { event, unresolvedVenueName } = harmonizeEvent(
      raw({ venueName: 'Salão da Junta de Freguesia' }),
      context,
    );
    expect(event.venue_id).toBe(null);
    expect(event.location_name).toBe('Salão da Junta de Freguesia');
    expect(unresolvedVenueName).toBe('Salão da Junta de Freguesia');
  });

  it('regista as etiquetas que não conhece, em vez de as adivinhar', () => {
    const { event, unknownTags } = harmonizeEvent(
      raw({ title: 'Sarau', categoriesRaw: ['Sarau Cultural'] }),
      context,
    );
    expect(unknownTags).toEqual(['Sarau Cultural']);
    expect(event.category_slug).toBe(null);
  });

  it('ordena e desdupla as sessões', () => {
    const { event, sessions } = harmonizeEvent(
      raw({
        dates: [
          { date: '2027-01-07', startTime: '18:00' },
          { date: '2027-01-06', startTime: '21:00' },
          { date: '2027-01-06', startTime: '21:00' },
        ],
      }),
      context,
    );
    expect(sessions.map((s) => s.session_date)).toEqual(['2027-01-06', '2027-01-07']);
    expect(event.date_start).toBe('2027-01-06');
    expect(event.date_end).toBe('2027-01-07');
  });

  it('desliga o CAPS LOCK e guarda a forma original', () => {
    const { event } = harmonizeEvent(raw({ title: 'CONCERTO DE ANO NOVO' }), context);
    expect(event.title).toBe('Concerto de Ano Novo');
    expect(event.title_raw).toBe('CONCERTO DE ANO NOVO');
  });

  it('dá menos confiança a um evento sem data, espaço nem categoria', () => {
    const semNada = harmonizeEvent(raw({ dates: [], title: 'Sarau' }), context).event;
    const completo = harmonizeEvent(
      raw({ venueName: 'Cine-Teatro Paraíso', categoriesRaw: ['Música'] }),
      context,
    ).event;
    expect(semNada.confidence).toBeLessThan(0.5);
    expect(completo.confidence).toBeGreaterThan(semNada.confidence);
  });

  it('lê «entrada livre» da descrição quando não há campo de preço', () => {
    const { event } = harmonizeEvent(raw({ description: 'Entrada livre até à lotação.' }), context);
    expect(event.is_free).toBe(true);
    expect(event.price_display).toBe('Entrada livre');
  });
});

/**
 * Dois «Cine-Teatro São Pedro», um em cada concelho.
 *
 * É o caso real que partiu: a tabela de alias tem uma linha por nome, e o nome
 * curto ficou com o de Abrantes. Um evento em Alcanena que dissesse só
 * «Cine-Teatro São Pedro» ia parar ao teatro errado, a setenta quilómetros.
 */
const NOMES_REPETIDOS = new Map([
  ['cineteatrosaopedro', 'cine-teatro-sao-pedro-abrantes'],
  ['cineteatrosaopedrodealcanena', 'cine-teatro-sao-pedro-alcanena'],
]);

const CONCELHO_DO_ESPACO = new Map([
  ['cine-teatro-sao-pedro-abrantes', 'abrantes'],
  ['cine-teatro-sao-pedro-alcanena', 'alcanena'],
]);

/** O catálogo com os nomes repetidos, sem alias preso a concelho nenhum. */
const REGIONAL = {
  venueAliases: NOMES_REPETIDOS,
  venueMunicipalities: CONCELHO_DO_ESPACO,
};

/** O mesmo, com a resposta para Alcanena escrita à mão. */
const COM_ALIAS_DE_CONCELHO = {
  ...REGIONAL,
  venueAliasesByMunicipality: new Map([
    ['alcanena', new Map([['cineteatrosaopedro', 'cine-teatro-sao-pedro-alcanena']])],
  ]),
};

describe('resolveVenueInMunicipality', () => {
  it('recusa o espaço que fica noutro concelho', () => {
    expect(resolveVenueInMunicipality('Cine-Teatro São Pedro', 'alcanena', REGIONAL)).toBe(null);
  });

  it('aceita-o quando o concelho é o mesmo', () => {
    expect(resolveVenueInMunicipality('Cine-Teatro São Pedro', 'abrantes', REGIONAL)).toBe(
      'cine-teatro-sao-pedro-abrantes',
    );
  });

  it('sem concelho conhecido para o espaço não recusa nada', () => {
    // Silêncio não é contradição: um catálogo incompleto não pode desfazer as
    // ligações que já estavam certas.
    expect(
      resolveVenueInMunicipality('Cine-Teatro São Pedro', 'alcanena', {
        venueAliases: NOMES_REPETIDOS,
        venueMunicipalities: new Map(),
      }),
    ).toBe('cine-teatro-sao-pedro-abrantes');
    expect(
      resolveVenueInMunicipality('Cine-Teatro São Pedro', 'alcanena', {
        venueAliases: NOMES_REPETIDOS,
      }),
    ).toBe('cine-teatro-sao-pedro-abrantes');
  });

  it('um nome que não casa continua a não casar', () => {
    expect(resolveVenueInMunicipality('Salão da Junta', 'alcanena', REGIONAL)).toBe(null);
  });

  it('o alias preso ao concelho resolve o que o regional só sabia recusar', () => {
    // É a razão de a tabela ter ganho concelho: recusar é melhor do que
    // errar, mas não é resolver.
    expect(
      resolveVenueInMunicipality('Cine-Teatro São Pedro', 'alcanena', COM_ALIAS_DE_CONCELHO),
    ).toBe('cine-teatro-sao-pedro-alcanena');
  });

  it('e não estraga o concelho que já resolvia pelo regional', () => {
    expect(
      resolveVenueInMunicipality('Cine-Teatro São Pedro', 'abrantes', COM_ALIAS_DE_CONCELHO),
    ).toBe('cine-teatro-sao-pedro-abrantes');
  });

  it('o alias preso ganha ao regional mesmo quando o regional casava', () => {
    // Quem prende um alias a um concelho já respondeu à pergunta. Não se lhe
    // passa por cima com uma coincidência de nomes.
    expect(
      resolveVenueInMunicipality('Cine-Teatro São Pedro', 'abrantes', {
        ...REGIONAL,
        venueAliasesByMunicipality: new Map([
          ['abrantes', new Map([['cineteatrosaopedro', 'cine-teatro-sao-pedro-alcanena']])],
        ]),
      }),
    ).toBe('cine-teatro-sao-pedro-alcanena');
  });

  it('um alias de outro concelho não se aplica a este', () => {
    expect(
      resolveVenueInMunicipality('Cine-Teatro São Pedro', 'tomar', COM_ALIAS_DE_CONCELHO),
    ).toBe(null);
  });

  it('sem concelho no evento, só o regional vale', () => {
    // Uma fonte regional sem concelho por evento não pode escolher entre os
    // alias de onze concelhos — escolher seria adivinhar.
    expect(resolveVenueInMunicipality('Cine-Teatro São Pedro', null, COM_ALIAS_DE_CONCELHO)).toBe(
      'cine-teatro-sao-pedro-abrantes',
    );
  });
});

describe('o harmonizador e os nomes que se repetem', () => {
  const emAlcanena: HarmonizeContext = {
    ...context,
    municipalityId: 'alcanena',
    venueAliases: NOMES_REPETIDOS,
    venueMunicipalities: CONCELHO_DO_ESPACO,
  };

  it('não põe um evento de Alcanena no teatro de Abrantes', () => {
    const { event, unresolvedVenueName } = harmonizeEvent(
      raw({ venueName: 'Cine-Teatro São Pedro' }),
      emAlcanena,
    );
    expect(event.venue_id).toBe(null);
    // E o nome vai para a lista de por resolver, que é onde alguém lhe dá o
    // alias certo uma vez e todas as recolhas seguintes ficam a saber.
    expect(unresolvedVenueName).toBe('Cine-Teatro São Pedro');
  });

  it('o nome longo casa, porque é o do concelho certo', () => {
    const { event } = harmonizeEvent(
      raw({ venueName: 'Cine-Teatro São Pedro de Alcanena' }),
      emAlcanena,
    );
    expect(event.venue_id).toBe('cine-teatro-sao-pedro-alcanena');
  });

  it('um id escrito pelo adaptador ganha ao alias', () => {
    // Quem nomeia um id já respondeu à pergunta que os alias tentam responder:
    // não se lhe passa por cima com uma coincidência de nomes.
    const { event } = harmonizeEvent(
      raw({ venueId: 'cine-teatro-sao-pedro-alcanena', venueName: 'Um Nome Qualquer' }),
      emAlcanena,
    );
    expect(event.venue_id).toBe('cine-teatro-sao-pedro-alcanena');
  });

  /*
   * Esta regra mudou a 7 de setembro de 2026, e vale a pena dizer porquê.
   *
   * O teste que aqui estava chamava-se «um id escrito pelo adaptador ganha
   * sempre», e o comentário defendia-o: quem nomeia um id sabe o que faz.
   * Sabe — e continua a saber tudo o que sabia sobre qual é o espaço. O que
   * não pode é pôr um evento de Alcanena num espaço de Abrantes, porque a
   * 0130 passou a recusá-lo na base, e porque a 0129 copia o acesso do espaço
   * para uma coluna publicada do evento: um espaço do concelho errado faz o
   * Coreto afirmar acessibilidade que não mediu.
   *
   * A recusa é do espaço e não do evento, e o nome segue para os espaços por
   * resolver — o caminho que um nome sem alias já percorria.
   */
  it('mas nem um id escrito pelo adaptador atravessa o concelho', () => {
    const { event, unresolvedVenueName } = harmonizeEvent(
      raw({ venueId: 'cine-teatro-sao-pedro-abrantes', venueName: 'Cine-Teatro São Pedro' }),
      emAlcanena,
    );
    expect(event.venue_id).toBe(null);
    expect(unresolvedVenueName).toBe('Cine-Teatro São Pedro');
  });

  it('nem o espaço de uma fonte de espaço só', () => {
    const { event } = harmonizeEvent(raw({}), {
      ...emAlcanena,
      defaultVenueId: 'cine-teatro-sao-pedro-abrantes',
    });
    expect(event.venue_id).toBe(null);
  });

  it('e um espaço sem concelho conhecido continua a passar', () => {
    // Silêncio não é contradição — é a mesma regra de `resolveVenueInMunicipality`.
    const { event } = harmonizeEvent(raw({ venueId: 'espaco-que-o-catalogo-nao-conhece' }), {
      ...emAlcanena,
      defaultVenueId: null,
    });
    expect(event.venue_id).toBe('espaco-que-o-catalogo-nao-conhece');
  });
});

/**
 * A hora que a prosa afirma.
 *
 * Em produção, 22 dos 108 eventos publicados por vir não tinham hora em sessão
 * nenhuma — e numa boa parte deles a hora estava no texto, à vista de quem
 * lesse. Uma hora dita uma vez extrai-se; duas são uma ambiguidade e ficam
 * por resolver.
 */
describe('o harmonizador e a hora que a prosa afirma', () => {
  it('uma hora dita uma vez no texto preenche a sessão que não a tinha', () => {
    const { sessions } = harmonizeEvent(
      raw({
        dates: [{ date: '2026-09-12' }],
        description:
          'No dia 12 de setembro, sábado, entre as 10h00 e as 13h00, a Rua Luís Falcão de Sommer recebe a Feira para Todos.',
      }),
      context,
    );
    expect(sessions[0]!.start_time).toBe('10:00');
    expect(sessions[0]!.end_time).toBe('13:00');
  });

  /*
   * A mesma frase, e o campo que este teste não olhava.
   *
   * Verificava a hora — que estava certa — e passava a verde com a duração
   * fabricada mesmo ao lado: «entre as 10h00 e as 13h00» dava dez horas de
   * duração, porque o leitor devolvia à primeira hora que encontrasse. Nove
   * das 128 fichas publicadas diziam «Duração: 10h» por causa disto, e o
   * teste que usava a frase culpada nunca teve de o notar.
   */
  it('e a mesma frase não fabrica duração nenhuma', () => {
    const { event } = harmonizeEvent(
      raw({
        dates: [{ date: '2026-09-12' }],
        description:
          'No dia 12 de setembro, sábado, entre as 10h00 e as 13h00, a Rua Luís Falcão de Sommer recebe a Feira para Todos.',
      }),
      context,
    );
    expect(event.duration_minutes).toBeNull();
  });

  it('duas horas no texto são uma ambiguidade, e ficam por resolver', () => {
    const { sessions } = harmonizeEvent(
      raw({
        dates: [{ date: '2026-06-20' }],
        description: 'Todos os sábados – Jardim Zona Verde às 19h30 e domingos às 10h00.',
      }),
      context,
    );
    expect(sessions[0]!.start_time).toBe(null);
    expect(sessions[0]!.end_time).toBe(null);
  });

  it('a hora que o adaptador deu ganha sempre à prosa', () => {
    const { sessions } = harmonizeEvent(
      raw({
        dates: [{ date: '2026-09-12', startTime: '17:00' }],
        description: 'Inauguração às 18h30.',
      }),
      context,
    );
    expect(sessions[0]!.start_time).toBe('17:00');
    expect(sessions[0]!.end_time).toBe(null);
  });

  it('as notas da sessão valem antes do texto do evento', () => {
    const { sessions } = harmonizeEvent(
      raw({
        dates: [{ date: '2026-09-12', notes: 'às 16h' }, { date: '2026-09-13' }],
        description: 'Sessões às 21h30.',
      }),
      context,
    );
    expect(sessions.map((s) => s.start_time)).toEqual(['16:00', '21:30']);
  });

  it('num período só o dia de abrir recebe a hora da prosa', () => {
    // Uma exposição de 15 de julho a 31 de agosto, «inauguração às 18h30»: é
    // um facto sobre o primeiro dia e nenhum sobre o último.
    const { sessions } = harmonizeEvent(
      raw({
        dates: [{ date: '2026-07-15' }, { date: '2026-08-31' }],
        isOngoing: true,
        description: 'Inauguração: 15 de julho | 18h30 | Galeria Carlos Saramago.',
      }),
      context,
    );
    expect(sessions.map((s) => s.start_time)).toEqual(['18:30', null]);
  });

  it('um fim antes do início só fica se atravessar a meia-noite', () => {
    const { sessions } = harmonizeEvent(
      raw({
        dates: [
          { date: '2026-09-04', startTime: '19:30', endTime: '03:00' },
          { date: '2026-09-05', startTime: '21:00', endTime: '16:00' },
        ],
      }),
      context,
    );
    expect(sessions.map((s) => s.end_time)).toEqual(['03:00', null]);
  });
});

/**
 * As quatro colunas do preço não se podem contradizer.
 *
 * O par a evitar é «`price_display` = 'Entrada livre'» com «`is_free` =
 * false»: no cartão o evento aparece grátis, no filtro dos grátis não aparece,
 * e nos dados estruturados sai `isAccessibleForFree: false`. Três respostas
 * para a mesma pergunta, escritas na mesma linha, na mesma noite.
 */
describe('harmonizeEvent e a coerência do preço', () => {
  const preco = (partial: Partial<RawEvent>) => harmonizeEvent(raw(partial), context).event;

  it('quem diz «Entrada livre» no rótulo diz sempre que sim no filtro', () => {
    for (const partial of [
      { priceRaw: 'Entrada livre' },
      { priceRaw: 'Gratuito' },
      { priceRaw: '0€' },
      { isFree: true, priceRaw: 'Bilhetes na bilheteira' },
      { priceRaw: null, description: 'A entrada é gratuita e não carece de inscrição.' },
    ]) {
      const event = preco(partial);
      expect([event.price_display, event.is_free]).toEqual(['Entrada livre', true]);
    }
  });

  it('e quem não é grátis nunca diz que é', () => {
    for (const partial of [
      { priceRaw: '12€' },
      { priceRaw: '1000€' },
      { priceRaw: 'Consultar bilheteira' },
      { priceRaw: 'Donativo' },
    ]) {
      const event = preco(partial);
      expect(event.is_free).toBe(false);
      expect(event.price_display).not.toBe('Entrada livre');
    }
  });

  /*
   * O caso do Entroncamento, medido em produção a 7 de setembro de 2026: o
   * único rótulo de preço do catálogo em forma estrangeira, porque a palavra
   * «Prémio» do título vetava o campo que a fonte dedicou ao preço.
   */
  it('a prosa deixa de vetar o campo do preço', () => {
    const event = preco({
      title: 'XXIX Grande Prémio Museu Nacional Ferroviário',
      priceRaw: '€2.00',
      description: 'A prova tem o custo de 2€ com t-shirt técnica e troféus para os 3 primeiros.',
    });
    expect(event.price_display).toBe('2 €');
    expect(event.price_min).toBe(2);
    expect(event.is_free).toBe(false);
  });
});
