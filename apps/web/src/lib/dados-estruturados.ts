import { addDays, isoWithLisbonOffset, type VenueKind } from '@coreto/core';
import { migalhasDoConcelho, migalhasDoEspaco, migalhasDoEvento, type Migalha } from './migalhas';
import { descricaoInstitucional, tituloDoSitio, type Regiao } from './regiao';
import type { EventDetail, Venue } from './queries/types';

/**
 * O que o Coreto diz às máquinas.
 *
 * Isto é schema.org — o bloco `application/ld+json` que faz um evento do
 * Sardoal aparecer no painel de eventos de um motor de busca ao lado de um do
 * Porto, e que um motor de resposta lê quando alguém pergunta o que há em
 * Ourém no sábado.
 *
 * A regra é a mesma do resto da casa, e aqui é mais dura do que em qualquer
 * outro lado: **só se declara o que a base sabe**. Um campo em falta não custa
 * nada; um campo errado é uma pessoa à porta de um espectáculo que não é
 * àquela hora, ou uma bilheteira anunciada como entrada livre. Este ficheiro
 * já teve as duas coisas — declarava «isto paga-se» em todos os eventos de que
 * ninguém sabia o preço, e inventava um promotor a partir do nome do concelho
 * — e é por isso que os construtores estão aqui, puros e testados, em vez de
 * dentro dos componentes.
 */

export type JsonLdValue =
  string | number | boolean | JsonLdValue[] | { [chave: string]: JsonLdValue | undefined };

/**
 * O identificador do sítio no grafo, para as páginas se lhe agarrarem.
 *
 * É função da origem e não constante de módulo: cada região tem o seu grafo
 * no seu domínio, e um `@id` cunhado na origem de uma região dentro das
 * páginas de outra atava os dois sítios num só.
 */
export function idDoSitio(origem: string): string {
  return `${origem}/#sitio`;
}

/** O identificador de quem promove — no nosso espaço de nomes, não no dela. */
export function idDoPromotor(origem: string): string {
  return `${origem}/#promotor`;
}

type Morada = {
  '@type': 'PostalAddress';
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
  addressRegion?: string;
  addressCountry: 'PT';
};

type Coordenadas = {
  '@type': 'GeoCoordinates';
  latitude: number;
  longitude: number;
};

/**
 * O que cada tipo de espaço é, em schema.org.
 *
 * O mapa é exaustivo sobre `VenueKind` de propósito: um tipo novo na base
 * parte a compilação aqui, em vez de cair em silêncio no genérico. E o
 * genérico é a resposta honesta para metade deles — um coreto, um largo, um
 * mercado ou uma sede de coletividade não têm tipo próprio no vocabulário, e
 * inventar-lhes um é dizer à máquina uma coisa que não sabemos.
 */
const TIPO_DO_ESPACO: Record<VenueKind, string> = {
  theatre: 'PerformingArtsTheater',
  cinema: 'MovieTheater',
  museum: 'Museum',
  library: 'Library',
  gallery: 'ArtGallery',
  heritage: 'LandmarksOrHistoricalBuildings',
  religious: 'PlaceOfWorship',
  cultural_centre: 'Place',
  auditorium: 'Place',
  bandstand: 'Place',
  association: 'Place',
  market: 'Place',
  outdoor: 'Place',
  education: 'Place',
  other: 'Place',
};

function morada(
  rua: string | null,
  codigoPostal: string | null,
  localidade: string | null,
  distrito: string | null,
): Morada | undefined {
  if (!rua && !codigoPostal && !localidade) return undefined;
  return {
    '@type': 'PostalAddress',
    streetAddress: rua ?? undefined,
    postalCode: codigoPostal ?? undefined,
    addressLocality: localidade ?? undefined,
    // O distrito é a divisão administrativa de primeiro nível de Portugal, que
    // é o que o `addressRegion` do schema.org pede. O Médio Tejo é uma NUTS
    // III e não serve aqui — está no nome do sítio e na prosa, que é onde
    // pertence.
    addressRegion: distrito ?? undefined,
    addressCountry: 'PT',
  };
}

function coordenadas(latitude: number | null, longitude: number | null): Coordenadas | undefined {
  if (latitude === null || longitude === null) return undefined;
  return { '@type': 'GeoCoordinates', latitude, longitude };
}

/**
 * O princípio e o fim de um evento, com fuso e sem mentiras.
 *
 * Três coisas que estavam mal e que esta função existe para não deixarem de
 * estar: uma sessão sem hora de fim ficava com o `endDate` na data seca, o que
 * punha o evento a acabar à meia-noite do dia em que começa — isto é, antes de
 * começar; uma sessão que atravessa a meia-noite acabava no dia anterior ao
 * que acaba; e as horas saíam nuas, sem fuso, num sítio cujo calendário do
 * lado escreve `TZID=Europe/Lisbon`.
 *
 * A comparação final é lexicográfica, e é segura porque as duas cadeias
 * começam pela data no mesmo formato — quem a «arrumar» com um `new Date()`
 * ganha um problema de fusos que não tinha.
 */
function quandoComecaEAcaba(evento: EventDetail): { inicio: string; fim?: string } | null {
  const primeira = evento.sessions[0];
  const ultima = evento.sessions[evento.sessions.length - 1];

  const inicio = primeira
    ? isoWithLisbonOffset(primeira.session_date, primeira.start_time)
    : evento.date_start;
  if (!inicio) return null;

  let fim: string | undefined;
  if (ultima) {
    if (ultima.end_time) {
      // Acabar «às duas» quando começou «às onze» é acabar no dia seguinte. É
      // a mesma regra que o `.ics` aplica ao escrever o calendário.
      const passaDaMeiaNoite = ultima.start_time !== null && ultima.end_time <= ultima.start_time;
      const dia = passaDaMeiaNoite ? addDays(ultima.session_date, 1) : ultima.session_date;
      fim = isoWithLisbonOffset(dia, ultima.end_time);
    } else if (primeira && ultima.session_date > primeira.session_date) {
      // Sem hora de fim mas com mais do que um dia: o que se sabe é o último
      // dia, e é isso que se diz. Uma data sem hora é uma data, não é
      // meia-noite.
      fim = ultima.session_date;
    }
  } else if (evento.date_end) {
    fim = evento.date_end;
  }

  if (fim && !(fim > inicio)) fim = undefined;
  return { inicio, fim };
}

/**
 * O preço, quando há preço.
 *
 * Um intervalo — «de 5 a 15 euros» — é um `AggregateOffer` e não um `Offer` a
 * 5: anunciar o mínimo como se fosse o preço é o género de verdade parcial que
 * leva alguém à bilheteira com metade do dinheiro. Sem preço nenhum não sai
 * oferta nenhuma.
 *
 * **E nenhuma de um evento que já aconteceu.** Toda a oferta daqui leva
 * `availability: InStock`, que é uma afirmação sobre **agora**: «isto está à
 * venda». Num registo de arquivo é falsa, e é o género de falsidade que um
 * motor de busca repete numa caixa de resultados com um preço ao lado. Ver
 * `construirEvento`.
 *
 * O `isAccessibleForFree` fica, e a diferença é essa mesma: «a entrada era
 * livre» é um facto sobre o que houve, e continua verdadeiro depois de
 * acontecer. «Está disponível» não.
 */
function oferta(evento: EventDetail, url: string): JsonLdValue | undefined {
  const onde = evento.ticketing_url ?? evento.source_url ?? url;
  const comum = {
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
    url: onde,
  } as const;

  if (evento.is_free) return { '@type': 'Offer', price: '0', ...comum };
  if (evento.price_min === null) return undefined;
  if (evento.price_max !== null && evento.price_max !== evento.price_min) {
    return {
      '@type': 'AggregateOffer',
      lowPrice: String(evento.price_min),
      highPrice: String(evento.price_max),
      ...comum,
    };
  }
  return { '@type': 'Offer', price: String(evento.price_min), ...comum };
}

/**
 * Entrada livre, sim ou não — ou nada.
 *
 * `isAccessibleForFree: false` é uma afirmação: «isto paga-se». Estava a ser
 * escrita em todos os eventos cujo preço ninguém conhece, que são muitos, só
 * porque a coluna `is_free` tem `false` por omissão. Ou se sabe que é grátis,
 * ou se sabe o preço, ou não se diz nada.
 */
function entradaLivre(evento: EventDetail): boolean | undefined {
  if (evento.is_free) return true;
  if (evento.price_min !== null) return false;
  return undefined;
}

interface Concelho {
  id: string;
  name: string;
  district?: string | null;
}

/** As migalhas de pão: onde é que esta página fica dentro do sítio. */
/**
 * As migalhas do sítio, ditas em schema.org.
 *
 * A trilha vem de `lib/migalhas.ts` — a mesma que o cabeçalho da página
 * desenha — e aqui só muda de forma: os endereços passam a absolutos, porque
 * é o que o `BreadcrumbList` quer. Antes esta trilha era montada à mão dentro
 * de cada construtor, e era por isso que a máquina sabia o caminho e a pessoa
 * que estava a ler não via nenhum.
 */
function degrausDe(
  origem: string,
  trilha: readonly Migalha[],
): Array<{ nome: string; url: string }> {
  return trilha.map((degrau) => ({
    nome: degrau.label,
    url: degrau.href === '/' ? `${origem}/` : `${origem}${degrau.href}`,
  }));
}

function migalhas(id: string, degraus: ReadonlyArray<{ nome: string; url: string }>): JsonLdValue {
  return {
    '@type': 'BreadcrumbList',
    '@id': id,
    itemListElement: degraus.map((degrau, indice) => ({
      '@type': 'ListItem',
      position: indice + 1,
      name: degrau.nome,
      item: degrau.url,
    })),
  };
}

/** O invólucro de qualquer ficha: a página em si, atada ao sítio. */
function pagina(
  origem: string,
  url: string,
  atualizada: string | null,
  principal: string,
): JsonLdValue {
  return {
    '@type': 'WebPage',
    '@id': url,
    url,
    inLanguage: 'pt-PT',
    dateModified: atualizada ?? undefined,
    isPartOf: { '@id': idDoSitio(origem) },
    mainEntity: { '@id': principal },
    breadcrumb: { '@id': `${url}#migalhas` },
  };
}

/**
 * O sítio e quem o promove, uma vez por página.
 *
 * É o nó que diz a uma máquina o que é isto e quem responde por isto — e o que
 * a página `/informacoes` já diz por extenso a quem lê. O `@id` do promotor é
 * na nossa origem: cunhar um identificador na origem da CIM era falar por ela.
 * Não chega olhar para o nome — o sítio vive em `coreto.mediotejo.pt`, que é
 * um subdomínio do domínio deles e é nosso à mesma.
 */
export function construirSitio(regiao: Regiao, origem: string): JsonLdValue {
  const sitio: JsonLdValue = {
    '@type': 'WebSite',
    '@id': idDoSitio(origem),
    url: `${origem}/`,
    name: 'Coreto',
    alternateName: tituloDoSitio(regiao),
    description: descricaoInstitucional(regiao),
    inLanguage: 'pt-PT',
    // Sem promotor — só a região de recurso, num build sem base — o sítio
    // não afirma editor nenhum: um campo em falta não custa nada.
    publisher: regiao.promotor ? { '@id': idDoPromotor(origem) } : undefined,
  };

  const nos: JsonLdValue[] = [sitio];
  if (regiao.promotor) {
    nos.push({
      '@type': 'Organization',
      '@id': idDoPromotor(origem),
      name: regiao.promotor.nome,
      url: regiao.promotor.url,
    });
  }

  return { '@context': 'https://schema.org', '@graph': nos };
}

interface ArgumentosDoEvento {
  evento: EventDetail;
  url: string;
  /** A origem pública da região — a base dos `@id` e das ligações do grafo. */
  origem: string;
  concelho: Concelho | null;
  espaco: Venue | null;
  ciclo: { id: string; name: string } | null;
  regiao: Regiao;
  /** Um registo de arquivo não anuncia bilhetes à venda — ver `oferta`. */
  jaAconteceu?: boolean;
}

export function construirEvento({
  evento,
  url,
  origem,
  concelho,
  espaco,
  ciclo,
  regiao,
  jaAconteceu = false,
}: ArgumentosDoEvento): JsonLdValue | null {
  const quando = quandoComecaEAcaba(evento);
  if (!quando) return null;

  const idEvento = `${url}#evento`;
  const nomeDoLugar = espaco?.name ?? evento.location_name ?? concelho?.name ?? regiao.nome;

  // A morada do evento e a morada do espaço são coisas diferentes quando o
  // evento traz a sua: juntar-lhes o código postal do espaço seria colar duas
  // moradas numa só. Aqui não há código postal nenhum — o `Venue` não o traz —,
  // e a nota fica para quem vier acrescentá-lo.
  const ruaDoEvento = evento.location_address ?? espaco?.address ?? null;

  const lugar: JsonLdValue = {
    '@type': 'Place',
    ...(espaco ? { '@id': `${origem}/espaco/${espaco.id}#local` } : {}),
    name: nomeDoLugar,
    address: morada(ruaDoEvento, null, concelho?.name ?? null, concelho?.district ?? null),
    geo: coordenadas(
      evento.latitude ?? espaco?.latitude ?? null,
      evento.longitude ?? espaco?.longitude ?? null,
    ),
    url: espaco ? `${origem}/espaco/${espaco.id}` : undefined,
  };

  const acontecimento: JsonLdValue = {
    '@type': 'Event',
    '@id': idEvento,
    name: evento.title,
    description: evento.description_short ?? evento.description ?? undefined,
    inLanguage: 'pt-PT',
    url,
    image: evento.image_url ?? undefined,
    startDate: quando.inicio,
    endDate: quando.fim,
    // O estado da linha é sempre «publicado» — o que cancela um evento aqui é
    // não sobrar nenhuma sessão de pé.
    eventStatus:
      evento.sessions.length > 0 && evento.sessions.every((sessao) => sessao.is_cancelled)
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    isAccessibleForFree: entradaLivre(evento),
    location: lugar,
    offers: jaAconteceu ? undefined : oferta(evento, url),
    // Não há `organizer`: a base não guarda quem organiza, e o espaço onde uma
    // coisa acontece não é quem a faz. Volta quando houver coluna para isso.
    superEvent: ciclo
      ? {
          '@type': 'EventSeries',
          '@id': `${origem}/ciclo/${ciclo.id}`,
          name: ciclo.name,
          url: `${origem}/ciclo/${ciclo.id}`,
        }
      : undefined,
  };

  const degraus = degrausDe(origem, migalhasDoEvento(evento, concelho));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      acontecimento,
      pagina(origem, url, evento.updated_at, idEvento),
      migalhas(`${url}#migalhas`, degraus),
    ],
  };
}

interface ArgumentosDoEspaco {
  espaco: Venue & { postal_code?: string | null; phone?: string | null; email?: string | null };
  url: string;
  origem: string;
  concelho: Concelho | null;
}

export function construirEspaco({
  espaco,
  url,
  origem,
  concelho,
}: ArgumentosDoEspaco): JsonLdValue {
  const idLugar = `${url}#local`;

  const lugar: JsonLdValue = {
    '@type': TIPO_DO_ESPACO[espaco.kind],
    '@id': idLugar,
    name: espaco.name,
    url,
    description: espaco.description ?? undefined,
    address: morada(
      espaco.address,
      espaco.postal_code ?? null,
      concelho?.name ?? null,
      concelho?.district ?? null,
    ),
    geo: coordenadas(espaco.latitude, espaco.longitude),
    image: espaco.image_url ?? undefined,
    sameAs: espaco.website_url ?? undefined,
    telephone: espaco.phone ?? undefined,
    email: espaco.email ?? undefined,
    // Não há `publicAccess`: dizia «isto é aberto ao público» sobre os oitenta
    // espaços do catálogo, escolas e igrejas incluídas, sem ninguém ter
    // verificado nenhum. A ausência não afirma o contrário — não afirma nada,
    // que é a verdade.
    amenityFeature:
      espaco.wheelchair_accessible === null
        ? undefined
        : [
            {
              '@type': 'LocationFeatureSpecification',
              name: 'Acesso a cadeiras de rodas',
              value: espaco.wheelchair_accessible,
            },
          ],
  };

  const degraus = degrausDe(origem, migalhasDoEspaco(espaco, concelho));

  return {
    '@context': 'https://schema.org',
    '@graph': [lugar, pagina(origem, url, null, idLugar), migalhas(`${url}#migalhas`, degraus)],
  };
}

interface ArgumentosDaListagem {
  /** O nome da página, como o `<h1>` a diz. */
  nome: string;
  descricao?: string | null;
  /** O endereço canónico da listagem — nunca o do filtro que a produziu. */
  url: string;
  origem: string;
  itens: ReadonlyArray<{ nome: string; url: string }>;
  /** Quantos existem ao todo, quando é mais do que a página mostra. */
  total?: number;
  trilha: readonly Migalha[];
}

/**
 * Uma listagem — a agenda, os espaços — dita em schema.org.
 *
 * Estas eram as páginas com mais tráfego e o único bloco estruturado que
 * tinham era o do sítio, herdado do layout: um motor de busca via texto e
 * ligações, e nada que dissesse que aquilo é uma lista de coisas com nome e
 * endereço. A ficha de concelho já tinha `ItemList` desde que respondeu à
 * pergunta geográfica; isto é a mesma ideia onde ela faltava.
 *
 * **O `url` é o canónico e não o pedido.** Uma listagem filtrada
 * (`?categoria=musica&page=3`) é a mesma coleção vista por uma frincha: dizer
 * que cada combinação de filtros é uma `CollectionPage` própria era cunhar
 * centenas de identificadores para uma página só. Quem chama passa o canónico
 * que já calculou para o `<link rel="canonical">`.
 *
 * **Só os nomes e os endereços**, como no concelho: os detalhes vivem na ficha
 * de cada um, e repeti-los aqui era duplicar a mesma afirmação em dois sítios
 * e arriscar que divirjam.
 */
export function construirListagem({
  nome,
  descricao,
  url,
  origem,
  itens,
  total,
  trilha,
}: ArgumentosDaListagem): JsonLdValue {
  const idLista = `${url}#lista`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': url,
        url,
        name: nome,
        description: descricao ?? undefined,
        inLanguage: 'pt-PT',
        isPartOf: { '@id': idDoSitio(origem) },
        mainEntity: { '@id': idLista },
        breadcrumb: { '@id': `${url}#migalhas` },
      },
      {
        '@type': 'ItemList',
        '@id': idLista,
        name: nome,
        // `numberOfItems` é quantos a lista tem, e a lista é esta página. O
        // total da coleção, quando é maior, não entra: prometer duzentos numa
        // lista com vinte é uma contagem que não bate com o que lá está.
        numberOfItems: itens.length,
        ...(total !== undefined && total > itens.length
          ? { description: `${itens.length} de ${total}` }
          : {}),
        itemListElement: itens.map((item, indice) => ({
          '@type': 'ListItem',
          position: indice + 1,
          name: item.nome,
          url: item.url,
        })),
      },
      migalhas(`${url}#migalhas`, degrausDe(origem, trilha)),
    ],
  };
}

interface Pergunta {
  /** O texto do cabeçalho, tal como está na página. */
  pergunta: string;
  /** A resposta em texto corrido, montada das mesmas constantes que a página mostra. */
  resposta: string;
  /** O `id` da secção, para a pergunta ter endereço próprio. */
  ancora: string;
}

interface ArgumentosDaFaq {
  perguntas: readonly Pergunta[];
  nome: string;
  descricao?: string | null;
  url: string;
  origem: string;
  atualizada?: string | null;
  trilha: readonly Migalha[];
}

/**
 * Uma página de perguntas e respostas.
 *
 * **Não é para aparecer no Google.** Os resultados enriquecidos de `FAQPage`
 * foram retirados em agosto de 2023 para toda a gente menos sítios de saúde e
 * de governo — quem puser isto à espera de umas setas a abrir debaixo do
 * resultado vai ficar à espera. O que isto serve é o outro lado: um motor de
 * resposta que leia esta página encontra a pergunta e a resposta emparelhadas,
 * em vez de ter de as adivinhar da prosa. A diferença prática é entre ser
 * citado e ser resumido — e um resumo errado de «o que é o Coreto» é o género
 * de coisa que ninguém corrige depois.
 *
 * **A regra que torna isto honesto: a resposta declarada tem de ser a resposta
 * visível.** É requisito da própria Google e é bom senso — marcar uma resposta
 * que a página não dá é spam de dados estruturados, e uma penalização é uma
 * coisa que se apanha depressa e se perde devagar. Por isso quem chama monta
 * cada `resposta` das **mesmas constantes** que o JSX mostra, e não de uma
 * segunda cópia da prosa: duas cópias divergem sempre, e a que diverge é a que
 * ninguém está a ler.
 *
 * Sem perguntas não há bloco nenhum. Uma `FAQPage` com `mainEntity` vazio é
 * uma promessa por cumprir escrita em JSON.
 */
export function construirFaq({
  perguntas,
  nome,
  descricao,
  url,
  origem,
  atualizada,
  trilha,
}: ArgumentosDaFaq): JsonLdValue | null {
  if (perguntas.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': url,
        url,
        name: nome,
        description: descricao ?? undefined,
        inLanguage: 'pt-PT',
        dateModified: atualizada ?? undefined,
        isPartOf: { '@id': idDoSitio(origem) },
        // Cada pergunta é uma entidade do grafo com endereço próprio: a
        // âncora que a página já usa na navegação interna. Quem citar tem
        // para onde apontar, e aponta para o sítio onde a resposta está.
        mainEntity: perguntas.map((item) => ({ '@id': `${url}#${item.ancora}` })),
        breadcrumb: { '@id': `${url}#migalhas` },
      },
      ...perguntas.map((item) => ({
        '@type': 'Question' as const,
        '@id': `${url}#${item.ancora}`,
        name: item.pergunta,
        acceptedAnswer: {
          '@type': 'Answer' as const,
          text: item.resposta,
          url: `${url}#${item.ancora}`,
        },
      })),
      migalhas(`${url}#migalhas`, degrausDe(origem, trilha)),
    ],
  };
}

interface ArgumentosDoConcelho {
  concelho: Concelho;
  url: string;
  origem: string;
  eventos: ReadonlyArray<{ slug: string; title: string }>;
}

/**
 * A página de um concelho — que é a que responde à pergunta geográfica.
 *
 * «O que há em Mação este fim de semana» é a pergunta que traz aqui a maior
 * parte das pessoas, e era a única página do sítio sem um único bloco de dados
 * estruturados: um motor de busca via texto e ligações, e nada que dissesse
 * que aquilo é uma lista de eventos de um território com nome.
 *
 * O `ItemList` traz o que a página mostra e nada mais — os nomes e os
 * endereços dos eventos listados. Os detalhes de cada um estão na ficha dele,
 * que é onde o `Event` completo vive; repeti-los aqui era duplicar a mesma
 * afirmação em dois sítios e arriscar que divirjam.
 */
export function construirConcelho({
  concelho,
  url,
  origem,
  eventos,
}: ArgumentosDoConcelho): JsonLdValue {
  const idTerritorio = `${url}#concelho`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': url,
        url,
        name: `Agenda cultural de ${concelho.name}`,
        inLanguage: 'pt-PT',
        isPartOf: { '@id': idDoSitio(origem) },
        about: { '@id': idTerritorio },
        breadcrumb: { '@id': `${url}#migalhas` },
      },
      {
        '@type': 'AdministrativeArea',
        '@id': idTerritorio,
        name: concelho.name,
        address: morada(null, null, concelho.name, concelho.district ?? null),
      },
      {
        '@type': 'ItemList',
        '@id': `${url}#lista`,
        name: `Eventos em ${concelho.name}`,
        numberOfItems: eventos.length,
        itemListElement: eventos.map((evento, indice) => ({
          '@type': 'ListItem',
          position: indice + 1,
          name: evento.title,
          url: `${origem}/evento/${evento.slug}`,
        })),
      },
      // Coreto › Mapa › concelho. O degrau do meio é novo, e é o certo: é do
      // mapa que se chega a cada uma das onze páginas, e é assim que a
      // navegação principal as arruma. A mesma trilha que o cabeçalho desenha.
      migalhas(`${url}#migalhas`, degrausDe(origem, migalhasDoConcelho(concelho))),
    ],
  };
}
