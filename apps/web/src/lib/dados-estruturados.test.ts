import { describe, expect, it } from 'vitest';
import {
  construirEspaco,
  construirEvento,
  construirFaq,
  construirListagem,
  construirSitio,
} from './dados-estruturados';
import { migalhasDoEspaco, migalhasDoEvento } from './migalhas';
import { regiaoDaLinha, type LinhaDeRegiao } from './regiao';
import type { EventDetail, EventSession, Venue } from './queries/types';

/**
 * O formato que ninguém vê e que toda a gente lê.
 *
 * Estes testes existem porque o JSON-LD é a única saída desta casa que
 * ninguém confere a olho: um erro aqui não estraga uma página, estraga o que
 * um motor de busca conta a quem procura. Os casos escolhidos são os que já
 * estiveram errados em produção.
 */

const SESSAO: EventSession = {
  session_date: '2026-07-15',
  start_time: '21:30',
  end_time: null,
  location_override: null,
  is_cancelled: false,
  notes: null,
};

const EVENTO: EventDetail = {
  id: 'e1',
  slug: 'concerto-no-coreto',
  status: 'published',
  title: 'Concerto no coreto',
  subtitle: null,
  description: null,
  description_short: 'A filarmónica sobe ao coreto.',
  municipality_id: 'tomar',
  venue_id: null,
  location_name: 'Coreto do Jardim',
  location_address: null,
  parish: null,
  category_slug: 'musica',
  category_confidence: 0.95,
  category_source: 'alias',
  date_start: '2026-07-15',
  date_end: null,
  is_free: false,
  price_display: null,
  price_min: null,
  price_max: null,
  price_raw: null,
  ticketing_url: null,
  image_url: null,
  image_alt: null,
  image_credit: null,
  image_width: null,
  image_height: null,
  wheelchair_accessible: null,
  audience: null,
  latitude: null,
  longitude: null,
  how_to_arrive: null,
  series_id: null,
  tags: [],
  min_age: null,
  is_ongoing: false,
  duration_minutes: null,
  has_sign_language: false,
  has_audio_description: false,
  has_subtitles: false,
  is_relaxed_performance: false,
  accessibility_notes: null,
  origin: 'scrape',
  source_url: null,
  updated_at: '2026-07-01T10:00:00Z',
  sessions: [SESSAO],
};

const ESPACO: Venue = {
  id: 'cine-teatro-paraiso',
  name: 'Cine-Teatro Paraíso',
  municipality_id: 'tomar',
  parish: null,
  kind: 'cinema',
  status: 'active',
  is_association: false,
  address: 'Rua Serpa Pinto 1',
  latitude: 39.6,
  longitude: -8.41,
  how_to_arrive: null,
  website_url: null,
  wheelchair_accessible: null,
  accessibility_notes: null,
  image_url: null,
  description: null,
};

const TOMAR = { id: 'tomar', name: 'Tomar', district: 'Santarém' };

/**
 * A região por que os construtores respondem — o que era a constante
 * `PROMOTOR` passou a chegar por aqui. A prosa gerada tem o seu cadeado em
 * `regiao.test.ts`; esta linha é só o mínimo de que o grafo precisa.
 */
const LINHA_DA_REGIAO: LinhaDeRegiao = {
  id: 'medio-tejo',
  name: 'Médio Tejo',
  article: 'o',
  kind: 'cim',
  cim_name: 'Comunidade Intermunicipal do Médio Tejo',
  cim_url: 'https://mediotejo.pt',
  domain: 'coreto.mediotejo.pt',
  contact_email: 'coreto@mediotejo.pt',
  ical_uid_domain: 'coreto.mediotejo.pt',
  tagline: null,
  about_intro: null,
  about_story: null,
  funding_statement: null,
  funding_logo_path: null,
  funding_logo_width: null,
  funding_logo_height: null,
  funding_logo_alt: null,
  logo_on_graphite_path: null,
  logo_on_brand_path: null,
  logo_width: null,
  logo_height: null,
  og_image_path: null,
  og_image_alt: null,
  data_controller_name: null,
  data_controller_url: null,
  data_controller_nif: null,
  data_controller_address: null,
  data_controller_email: null,
  data_controller_dpo: null,
  data_controller_dpo_contact: null,
  expected_municipality_count: 11,
  bbox_lat_min: 39.3,
  bbox_lat_max: 39.85,
  bbox_lon_min: -8.8,
  bbox_lon_max: -7.8,
  gate_enabled: false,
};

const REGIAO = regiaoDaLinha(LINHA_DA_REGIAO);

/** O nó de um tipo, de dentro do `@graph`. */
function no(dados: unknown, tipo: string): Record<string, unknown> {
  const grafo = (dados as { '@graph': Array<Record<string, unknown>> })['@graph'];
  const encontrado = grafo.find((item) => item['@type'] === tipo);
  if (!encontrado) throw new Error(`não há nó ${tipo} no grafo`);
  return encontrado;
}

function evento(alteracoes: Partial<EventDetail> = {}, jaAconteceu = false) {
  return construirEvento({
    evento: { ...EVENTO, ...alteracoes },
    url: 'https://exemplo.pt/evento/concerto-no-coreto',
    origem: 'https://exemplo.pt',
    concelho: TOMAR,
    espaco: null,
    ciclo: null,
    regiao: REGIAO,
    jaAconteceu,
  });
}

describe('construirEvento — quando começa e quando acaba', () => {
  it('não inventa fim nenhum quando a sessão não tem hora de fim', () => {
    // O erro que isto trava: `endDate` ficava com a data seca, e um evento das
    // 21:30 passava a acabar à meia-noite do próprio dia em que começa — ou
    // seja, três horas antes de começar.
    const nó = no(evento(), 'Event');
    expect(nó.startDate).toBe('2026-07-15T21:30:00+01:00');
    expect(nó.endDate).toBeUndefined();
  });

  it('leva o fim para o dia seguinte quando a sessão atravessa a meia-noite', () => {
    const nó = no(
      evento({ sessions: [{ ...SESSAO, start_time: '23:00', end_time: '02:00' }] }),
      'Event',
    );
    expect(nó.startDate).toBe('2026-07-15T23:00:00+01:00');
    expect(nó.endDate).toBe('2026-07-16T02:00:00+01:00');
  });

  it('numa temporada sem horas, o fim é o último dia', () => {
    const nó = no(
      evento({
        sessions: [
          { ...SESSAO, start_time: null },
          { ...SESSAO, session_date: '2026-09-27', start_time: null },
        ],
      }),
      'Event',
    );
    expect(nó.startDate).toBe('2026-07-15');
    expect(nó.endDate).toBe('2026-09-27');
  });

  it('escreve o fuso, e o certo para cada metade do ano', () => {
    const inverno = no(evento({ sessions: [{ ...SESSAO, session_date: '2026-01-15' }] }), 'Event');
    expect(inverno.startDate).toBe('2026-01-15T21:30:00+00:00');
  });
});

describe('construirEvento — o preço', () => {
  it('não diz nada sobre entrada livre quando ninguém sabe o preço', () => {
    // `isAccessibleForFree: false` é uma afirmação, e a coluna `is_free` tem
    // `false` por omissão: dizia «isto paga-se» em toda a agenda.
    const nó = no(evento(), 'Event');
    expect(nó.isAccessibleForFree).toBeUndefined();
    expect(nó.offers).toBeUndefined();
  });

  it('declara entrada livre quando é entrada livre', () => {
    const nó = no(evento({ is_free: true }), 'Event');
    expect(nó.isAccessibleForFree).toBe(true);
    expect(nó.offers).toMatchObject({ '@type': 'Offer', price: '0', priceCurrency: 'EUR' });
  });

  it('anuncia o intervalo quando há intervalo, e não só o mínimo', () => {
    const nó = no(evento({ price_min: 5, price_max: 15 }), 'Event');
    expect(nó.isAccessibleForFree).toBe(false);
    expect(nó.offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: '5',
      highPrice: '15',
    });
  });

  it('um preço só continua a ser um Offer', () => {
    const nó = no(evento({ price_min: 10, price_max: 10 }), 'Event');
    expect(nó.offers).toMatchObject({ '@type': 'Offer', price: '10' });
  });
});

describe('construirEvento — o resto do grafo', () => {
  it('não inventa organizador nenhum', () => {
    // O espaço onde uma coisa acontece não é quem a faz, e «Tomar» não é uma
    // organização.
    expect(no(evento(), 'Event').organizer).toBeUndefined();
  });

  it('leva a morada com distrito e o concelho como localidade', () => {
    const nó = no(evento({ location_address: 'Largo do Coreto' }), 'Event');
    expect((nó.location as Record<string, unknown>).address).toMatchObject({
      streetAddress: 'Largo do Coreto',
      addressLocality: 'Tomar',
      addressRegion: 'Santarém',
      addressCountry: 'PT',
    });
  });

  it('aponta ao espaço com endereço absoluto e com o mesmo @id da ficha dele', () => {
    const dados = construirEvento({
      evento: EVENTO,
      url: 'https://exemplo.pt/evento/concerto-no-coreto',
      origem: 'https://exemplo.pt',
      concelho: TOMAR,
      espaco: ESPACO,
      ciclo: null,
      regiao: REGIAO,
    });
    const lugar = no(dados, 'Event').location as Record<string, unknown>;
    expect(lugar.url).toMatch(/^https?:\/\/.*\/espaco\/cine-teatro-paraiso$/);
    expect(lugar['@id']).toMatch(/\/espaco\/cine-teatro-paraiso#local$/);
  });

  it('diz a que ciclo pertence, quando pertence a um', () => {
    const dados = construirEvento({
      evento: EVENTO,
      url: 'https://exemplo.pt/evento/concerto-no-coreto',
      origem: 'https://exemplo.pt',
      concelho: TOMAR,
      espaco: null,
      ciclo: { id: 'caminhos', name: 'CAMINHOS' },
      regiao: REGIAO,
    });
    expect(no(dados, 'Event').superEvent).toMatchObject({
      '@type': 'EventSeries',
      name: 'CAMINHOS',
    });
  });

  it('traz as migalhas com três degraus verdadeiros e a data de alteração', () => {
    const dados = evento();
    const lista = no(dados, 'BreadcrumbList').itemListElement as Array<Record<string, unknown>>;
    expect(lista.map((degrau) => degrau.name)).toEqual(['Coreto', 'Tomar', 'Concerto no coreto']);
    expect(no(dados, 'WebPage').dateModified).toBe('2026-07-01T10:00:00Z');
  });

  it('devolve nada quando não há data nenhuma para declarar', () => {
    expect(evento({ sessions: [], date_start: null })).toBeNull();
  });
});

describe('construirEspaco', () => {
  it('diz o que o espaço é, quando o vocabulário tem palavra para isso', () => {
    const dados = construirEspaco({
      espaco: ESPACO,
      url: 'https://exemplo.pt/espaco/cine-teatro-paraiso',
      origem: 'https://exemplo.pt',
      concelho: TOMAR,
    });
    expect(no(dados, 'MovieTheater')).toMatchObject({ name: 'Cine-Teatro Paraíso' });
  });

  it('fica-se por «Place» quando não tem', () => {
    const dados = construirEspaco({
      espaco: { ...ESPACO, kind: 'bandstand' },
      url: 'https://exemplo.pt/espaco/coreto',
      origem: 'https://exemplo.pt',
      concelho: TOMAR,
    });
    expect(no(dados, 'Place')).toMatchObject({ name: 'Cine-Teatro Paraíso' });
  });

  it('não afirma que o espaço é aberto ao público', () => {
    // Dizia-o sobre os oitenta espaços do catálogo, escolas e igrejas
    // incluídas, sem ninguém ter verificado um único.
    const dados = construirEspaco({
      espaco: ESPACO,
      url: 'https://exemplo.pt/espaco/cine-teatro-paraiso',
      origem: 'https://exemplo.pt',
      concelho: TOMAR,
    });
    expect(no(dados, 'MovieTheater').publicAccess).toBeUndefined();
  });
});

describe('construirSitio', () => {
  it('declara o sítio e quem o promove, sem lhe atribuir identificadores alheios', () => {
    const dados = construirSitio(REGIAO, 'https://coreto.mediotejo.pt');
    const promotor = no(dados, 'Organization');
    expect(promotor.name).toBe('Comunidade Intermunicipal do Médio Tejo');
    expect(promotor.url).toBe('https://mediotejo.pt');

    // O `@id` é na nossa origem: cunhar um identificador na origem da CIM era
    // falar por ela.
    //
    // Isto já foi um «não contém mediotejo.pt», e deixou de servir no dia em
    // que o sítio passou a viver em `coreto.mediotejo.pt` — a partir daí a
    // asserção acusava o nosso próprio endereço. A fronteira que interessa
    // nunca foi o nome, é a origem: `coreto.mediotejo.pt` é nossa, ainda que
    // delegada, e `mediotejo.pt` é deles.
    const sitio = no(dados, 'WebSite');
    expect(String(promotor['@id'])).toBe(`${String(sitio.url)}#promotor`);
    expect(new URL(String(promotor['@id'])).origin).not.toBe(new URL(String(promotor.url)).origin);
    expect(no(dados, 'WebSite').publisher).toEqual({ '@id': promotor['@id'] });
  });

  it('com outra região, nada do Médio Tejo se infiltra no grafo', () => {
    // O anti-fuga do multi-inquilino: o construtor não pode ter uma letra
    // regional escrita dentro — tudo o que nomeia a região vem do argumento.
    const outra = regiaoDaLinha({
      ...LINHA_DA_REGIAO,
      id: 'travessia',
      name: 'Travessia do Zêzere',
      article: 'a',
      kind: 'cim',
      cim_name: 'Comunidade Intermunicipal da Travessia do Zêzere',
      cim_url: 'https://travessia.example',
      domain: 'coreto.travessia.example',
      contact_email: 'coreto@travessia.example',
      ical_uid_domain: 'coreto.travessia.example',
      expected_municipality_count: 2,
    });
    // Com a origem da própria região, o grafo inteiro tem de ser dela: nem a
    // prosa nem um único endereço podem trazer o Médio Tejo.
    const texto = JSON.stringify(construirSitio(outra, 'https://coreto.travessia.example'));
    expect(texto).not.toContain('Médio Tejo');
    expect(texto).not.toContain('mediotejo');
    expect(texto).toContain('da Travessia do Zêzere');
    expect(texto).toContain('https://coreto.travessia.example/#sitio');
  });
});

describe('as migalhas ditas à máquina são as mesmas que a pessoa vê', () => {
  /*
   * O erro que isto trava: as duas trilhas eram montadas em sítios
   * diferentes — a do `BreadcrumbList` dentro deste ficheiro, a do cabeçalho
   * em `components/Migalhas.tsx` — e podiam divergir sem ninguém dar por
   * isso, com o motor de busca a ouvir um caminho e a pessoa a ver outro.
   * Hoje saem as duas de `lib/migalhas.ts`, e este teste é o cadeado.
   */
  interface Degrau {
    name: string;
    item: string;
    position: number;
  }

  function trilhaDoGrafo(dados: unknown): Degrau[] {
    return no(dados, 'BreadcrumbList').itemListElement as Degrau[];
  }

  it('na ficha de um evento', () => {
    const trilha = trilhaDoGrafo(evento());
    expect(trilha.map((d) => d.name)).toEqual(migalhasDoEvento(EVENTO, TOMAR).map((m) => m.label));
    expect(trilha.every((d) => d.item.startsWith('http'))).toBe(true);
    expect(trilha.at(-1)?.item).toMatch(/\/evento\/concerto-no-coreto$/);
  });

  it('na ficha de um espaço', () => {
    const dados = construirEspaco({
      espaco: ESPACO,
      url: 'https://exemplo.pt/espaco/cine-teatro-paraiso',
      origem: 'https://exemplo.pt',
      concelho: TOMAR,
    });
    expect(trilhaDoGrafo(dados).map((d) => d.name)).toEqual(
      migalhasDoEspaco(ESPACO, TOMAR).map((m) => m.label),
    );
  });

  it('a posição de cada degrau começa em 1 e não salta', () => {
    const lista = trilhaDoGrafo(evento());
    expect(lista.map((d) => d.position)).toEqual(lista.map((_, i) => i + 1));
  });
});

describe('construirListagem', () => {
  const TRILHA = [
    { href: '/', label: 'Coreto' },
    { href: '/agenda', label: 'Agenda' },
  ];

  function listagem(alteracoes: Partial<Parameters<typeof construirListagem>[0]> = {}) {
    return construirListagem({
      nome: 'Agenda',
      url: 'https://exemplo.pt/agenda',
      origem: 'https://exemplo.pt',
      itens: [
        { nome: 'Concerto no coreto', url: 'https://exemplo.pt/evento/concerto-no-coreto' },
        { nome: 'Feira do livro', url: 'https://exemplo.pt/evento/feira-do-livro' },
      ],
      trilha: TRILHA,
      ...alteracoes,
    });
  }

  it('a lista traz o nome e o endereço de cada item, por ordem', () => {
    const lista = no(listagem(), 'ItemList');
    expect(lista.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Concerto no coreto',
        url: 'https://exemplo.pt/evento/concerto-no-coreto',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Feira do livro',
        url: 'https://exemplo.pt/evento/feira-do-livro',
      },
    ]);
  });

  it('a página agarra-se ao sítio e aponta à lista como entidade principal', () => {
    const pagina = no(listagem(), 'CollectionPage');
    expect(pagina.isPartOf).toEqual({ '@id': 'https://exemplo.pt/#sitio' });
    expect(pagina.mainEntity).toEqual({ '@id': 'https://exemplo.pt/agenda#lista' });
    expect(pagina.inLanguage).toBe('pt-PT');
  });

  it('`numberOfItems` conta o que a lista tem, não o que a coleção tem', () => {
    // Prometer duzentos numa lista com dois é uma contagem que não bate com o
    // que lá está — e é o género de divergência que um validador apanha.
    const lista = no(listagem({ total: 200 }), 'ItemList');
    expect(lista.numberOfItems).toBe(2);
    expect(lista.description).toBe('2 de 200');
  });

  it('sem total maior do que a página, não inventa uma descrição', () => {
    expect(no(listagem(), 'ItemList')).not.toHaveProperty('description');
    expect(no(listagem({ total: 2 }), 'ItemList')).not.toHaveProperty('description');
  });

  it('as migalhas são absolutas e a raiz leva barra', () => {
    const trilha = no(listagem(), 'BreadcrumbList').itemListElement as Array<
      Record<string, unknown>
    >;
    expect(trilha.map((degrau) => degrau.item)).toEqual([
      'https://exemplo.pt/',
      'https://exemplo.pt/agenda',
    ]);
  });

  it('uma listagem vazia continua a ser uma lista, com zero', () => {
    const lista = no(listagem({ itens: [] }), 'ItemList');
    expect(lista.numberOfItems).toBe(0);
    expect(lista.itemListElement).toEqual([]);
  });
});

describe('construirFaq', () => {
  const TRILHA = [
    { href: '/', label: 'Coreto' },
    { href: '/informacoes', label: 'Informações' },
  ];

  const PERGUNTAS = [
    {
      pergunta: 'O que é o Coreto?',
      resposta: 'É a agenda cultural da região.',
      ancora: 'o-que-e',
    },
    {
      pergunta: 'Porque se chama Coreto?',
      resposta: 'É o palco de quem não tem palco.',
      ancora: 'o-nome',
    },
  ];

  function faq(alteracoes: Partial<Parameters<typeof construirFaq>[0]> = {}) {
    return construirFaq({
      perguntas: PERGUNTAS,
      nome: 'Informações',
      url: 'https://exemplo.pt/informacoes',
      origem: 'https://exemplo.pt',
      trilha: TRILHA,
      ...alteracoes,
    });
  }

  it('cada pergunta é um nó com endereço próprio, e a resposta aponta para lá', () => {
    const grafo = (faq() as { '@graph': Array<Record<string, unknown>> })['@graph'];
    const questoes = grafo.filter((item) => item['@type'] === 'Question');
    expect(questoes).toHaveLength(2);
    expect(questoes[0]).toEqual({
      '@type': 'Question',
      '@id': 'https://exemplo.pt/informacoes#o-que-e',
      name: 'O que é o Coreto?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'É a agenda cultural da região.',
        url: 'https://exemplo.pt/informacoes#o-que-e',
      },
    });
  });

  it('a página aponta às perguntas por referência, na ordem em que aparecem', () => {
    const pagina = no(faq(), 'FAQPage');
    expect(pagina.mainEntity).toEqual([
      { '@id': 'https://exemplo.pt/informacoes#o-que-e' },
      { '@id': 'https://exemplo.pt/informacoes#o-nome' },
    ]);
    expect(pagina.isPartOf).toEqual({ '@id': 'https://exemplo.pt/#sitio' });
    expect(pagina.inLanguage).toBe('pt-PT');
  });

  it('sem perguntas não há bloco nenhum', () => {
    // Uma `FAQPage` de `mainEntity` vazio é uma promessa por cumprir escrita
    // em JSON — e um validador trata-a como erro, não como página sem FAQ.
    expect(faq({ perguntas: [] })).toBeNull();
  });

  it('as migalhas ditas são as mesmas que a pessoa vê', () => {
    const lista = no(faq(), 'BreadcrumbList');
    expect(lista.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Coreto', item: 'https://exemplo.pt/' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Informações',
        item: 'https://exemplo.pt/informacoes',
      },
    ]);
  });
});

/**
 * Um registo de arquivo não põe bilhetes à venda.
 *
 * A 0132 abriu as fichas do que já aconteceu, e com elas vinha uma afirmação
 * que ninguém escreveu de propósito: toda a oferta do JSON-LD leva
 * `availability: InStock` — «isto está à venda, agora». Num evento de abril é
 * falso, e é falso no sítio onde mais alastra: um motor de busca repete-o numa
 * caixa de resultados, com o preço ao lado.
 *
 * Medido a 13 de setembro de 2026: das 33 fichas que a 0132 abre, 8 emitiriam
 * uma oferta — as gratuitas, que saem por `is_free` e não por preço.
 */
describe('construirEvento — o arquivo não anuncia disponibilidade', () => {
  it('um evento que já aconteceu não emite oferta nenhuma', () => {
    const comPreco = { is_free: false, price_min: 12, price_max: 12 };
    expect(no(evento(comPreco), 'Event').offers).toBeDefined();
    expect(no(evento(comPreco, true), 'Event').offers).toBeUndefined();
  });

  it('nem quando a entrada era livre, que é o caso dos oito', () => {
    const gratuito = { is_free: true, price_min: 0, price_max: null };
    expect(no(evento(gratuito), 'Event').offers).toBeDefined();
    expect(no(evento(gratuito, true), 'Event').offers).toBeUndefined();
  });

  /*
   * E o que **fica**, que é a metade que distingue as duas afirmações: «a
   * entrada era livre» é um facto sobre o que houve e continua verdadeiro
   * depois de acontecer; «está disponível» é sobre agora, e deixa de ser.
   */
  it('mas «a entrada era livre» continua a dizer-se, porque é verdade no passado', () => {
    const arquivado = no(evento({ is_free: true, price_min: 0, price_max: null }, true), 'Event');
    expect(arquivado.isAccessibleForFree).toBe(true);
  });

  it('e o resto da ficha não muda por ter passado', () => {
    const arquivado = no(evento({}, true), 'Event');
    expect(arquivado.name).toBe('Concerto no coreto');
    expect(arquivado.startDate).toBeDefined();
    expect(arquivado.location).toBeDefined();
  });
});
