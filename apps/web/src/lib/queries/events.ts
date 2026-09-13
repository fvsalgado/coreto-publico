import 'server-only';
import { unstable_cache } from 'next/cache';
import { todayInLisbon, type EventFilter } from '@coreto/core';
import type { AnelDeFronteira } from '../mapa';
import { consultaDePesquisa } from '../pesquisa';
import { publicClient } from '../supabase/server';
import { degradarForaDaCache, ehPaginaAlemDoFim, exigirLeitura } from './falhas';
import {
  CARD_EVENT_FIELDS,
  CORETO_FIELDS,
  DETAIL_EVENT_FIELDS,
  MAP_EVENT_FIELDS,
  PUBLIC_SOURCE_FIELDS,
  SERIES_EVENT_FIELDS,
  VENUE_FIELDS,
} from './fields';
import type {
  Category,
  Coreto,
  EventCard,
  EventDetail,
  EventPoint,
  EventSession,
  Municipality,
  PublicSource,
  Series,
  SeriesEvent,
  Venue,
} from './types';

/** O cliente da chave pública, já sem o `null` de «sem base configurada». */
type ClientePublico = NonNullable<ReturnType<typeof publicClient>>;

/**
 * Leituras públicas.
 *
 * Todas passam por `unstable_cache` com etiquetas: as páginas são servidas de
 * cache e a recolha noturna invalida por webhook o que mudou, em vez de
 * esperar que um tempo de vida expire. É isto que faz o site aguentar um pico
 * — quase tudo já está calculado quando o pico chega.
 *
 * Sem base de dados configurada, cada função devolve vazio. O site fica de pé
 * e mostra o estado; nunca dá erro 500 por falta de credenciais. Uma consulta
 * que **erra** é outra coisa, e desde `falhas.ts` trata-se como outra coisa:
 * lança de dentro da função cacheada — para o vazio do erro não ficar guardado
 * uma hora como se fosse verdade — e é quem chama que decide, já fora da
 * cache, se degrada (`degradarForaDaCache`) ou se deixa o erro subir. A regra
 * caso a caso está escrita em cada leitura.
 *
 * **A região entra pelo primeiro argumento** em tudo o que é regional. O
 * isolamento entre regiões faz-se pelas CHAVES de cache — o `unstable_cache`
 * inclui os argumentos na chave, por isso a mesma função serve as duas
 * agendas sem nunca as misturar. As etiquetas ficam globais de propósito: a
 * recolha é uma para todas as regiões, e invalidar `events` refaz as duas —
 * sobre-invalidar é barato; servir a agenda de uma CIM no domínio de outra
 * não tem preço que o pague. O recorte é sempre o mesmo: tudo pendura de
 * `municipality_id`, e o concelho pendura da região — daí o
 * `municipalities!inner()` nas consultas de eventos e espaços.
 * A taxonomia (categorias) é do produto e continua global.
 */

export const CACHE_TAGS = {
  events: 'events',
  venues: 'venues',
  coretos: 'coretos',
  taxonomy: 'taxonomy',
  sources: 'sources',
  /* O interruptor de cada secção. Invalidá-la refaz a navegação de todas as
     páginas, porque é o layout de raiz que a lê. */
  sections: 'sections',
  /* A identidade das regiões. Muda quando uma CIM entra ou edita a sua
     linha — isto é, quase nunca; a etiqueta existe para esse dia. */
  regions: 'regions',
  municipality: (id: string) => `events:${id}`,
} as const;

/** Uma hora. A recolha corre de madrugada; o webhook trata do resto. */
const REVALIDATE_SECONDS = 3600;

export interface EventListResult {
  events: EventCard[];
  total: number;
}

/**
 * A consulta de partida da agenda pública, com ou sem linhas.
 *
 * `contar: 'so'` pede o `head: true` do PostgREST: a mesma consulta sem trazer
 * uma única linha, só a contagem. É o que responde à pergunta «quantos são ao
 * todo» quando o intervalo pedido caiu além do fim e a resposta com linhas foi
 * recusada.
 */
function consultaDeEventos(supabase: ClientePublico, contar: 'com-linhas' | 'so') {
  return supabase.from('events').select(`${CARD_EVENT_FIELDS}, municipalities!inner()`, {
    count: 'exact',
    head: contar === 'so',
  });
}

type ConsultaDeEventos = ReturnType<typeof consultaDeEventos>;

/**
 * O recorte da agenda pública: a região, o que está publicado, e os filtros.
 *
 * Escrito uma vez e usado nas duas consultas — a que traz as linhas e a que
 * só conta. Duas cópias dos catorze filtros que um dia divergem são
 * exatamente como se põe um total a discordar da lista que ele conta.
 */
function filtrarEventos(
  query: ConsultaDeEventos,
  regiao: string,
  filter: EventFilter,
  from: string,
): ConsultaDeEventos {
  let q = query
    .eq('municipalities.region_id', regiao)
    .eq('status', 'published')
    .eq('is_canonical', true)
    // Um evento que já começou mas ainda não acabou continua a contar: uma
    // exposição de dois meses não desaparece da agenda no segundo dia.
    .or(`date_end.gte.${from},date_start.gte.${from}`);

  if (filter.to) q = q.lte('date_start', filter.to);
  if (filter.municipality) q = q.eq('municipality_id', filter.municipality);
  if (filter.category) q = q.eq('category_slug', filter.category);
  if (filter.venue) q = q.eq('venue_id', filter.venue);
  if (filter.series) q = q.eq('series_id', filter.series);
  if (filter.free) q = q.eq('is_free', true);
  /*
   * A coluna resolvida (0129), e não a do evento.
   *
   * Com `wheelchair_accessible`, este filtro devolvia **0 de 128** no Médio
   * Tejo: as câmaras não preenchem o campo do evento, e o leitor de prosa só
   * o escreve quando a descrição do evento fala de acesso. A informação
   * existia — em `venues` — e a ficha já a mostrava; o atalho da entrada é que
   * não a encontrava. Vinte e sete eventos passam a aparecer aqui, e são os
   * mesmos que a ficha já dizia serem acessíveis.
   */
  if (filter.accessible) q = q.eq('wheelchair_accessible_resolved', true);
  if (filter.q) {
    /*
     * Texto integral em português (0116): a coluna gerada `search_vector`
     * junta título, subtítulo, sítio e resumo sem acentos e pelo radical, e a
     * consulta leva prefixos — «fad» encontra «fado» e «fados». A configuração
     * vai sem esquema porque o PostgREST resolve `portugues` pelo
     * `search_path`, que inclui `public`.
     */
    const consulta = consultaDePesquisa(filter.q);
    if (consulta) q = q.textSearch('search_vector', consulta, { config: 'portugues' });
  }
  return q;
}

async function fetchEventList(regiao: string, filter: EventFilter): Promise<EventListResult> {
  const supabase = publicClient();
  if (!supabase) return { events: [], total: 0 };

  const from = filter.from ?? todayInLisbon();
  const query = filtrarEventos(consultaDeEventos(supabase, 'com-linhas'), regiao, filter, from);

  const offset = (filter.page - 1) * filter.limit;
  // Ordena por `agenda_date` e não por `date_start`: é o próximo dia que
  // interessa a quem lê — a estreia de um evento que ainda não abriu, o fecho
  // de um que já está a decorrer. Por data de início, as trinta exposições
  // abertas em maio e junho ficavam à frente de tudo, e a primeira página da
  // agenda não tinha um único concerto. A coluna é gerada na 0053.
  const { data, error, count } = await query
    .order('agenda_date', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true })
    .range(offset, offset + filter.limit - 1);

  /*
   * **Uma página além do fim é uma pergunta com resposta, não uma avaria.**
   *
   * O PostgREST recusa um `Range` que comece depois da última linha com um
   * 416 e o código `PGRST103`, e o `exigirLeitura` da linha seguinte
   * transformava isso num erro de leitura — que sobe até à fronteira de
   * `app/[regiao]/error.tsx` e sai como 500. `/agenda?page=99` e
   * `/api/events?page=99` respondiam 500 em produção: um endereço que
   * qualquer rastreador constrói sozinho, e que um dia entra no relatório de
   * erros ao lado das avarias a sério.
   *
   * A resposta certa é a lista vazia com o total verdadeiro — a agenda tem
   * 128 eventos e a página 99 não tem nenhum, que é a coisa que a paginação
   * já sabe desenhar. O total não vem na recusa (o `count` do supabase-js só
   * é lido de um cabeçalho de resposta com sucesso), e por isso pergunta-se
   * outra vez, com `head: true`: uma consulta que não traz linha nenhuma.
   * Custa um pedido a mais numa página que ninguém abre de propósito.
   */
  if (error && ehPaginaAlemDoFim(error)) {
    const { count: total, error: erroDaContagem } = await filtrarEventos(
      consultaDeEventos(supabase, 'so'),
      regiao,
      filter,
      from,
    );
    exigirLeitura('listEvents', erroDaContagem);
    return { events: [], total: total ?? 0 };
  }

  // **Propaga.** É o assunto da agenda, da página do concelho, do widget e de
  // todos os feeds: a lista vazia de um erro faz a página dizer «Sem
  // resultados para estes filtros — alargue o intervalo de datas», que culpa
  // quem visita por uma falha nossa e aconselha o que não pode resultar. Uma
  // página de erro honesta — a fronteira de `app/[regiao]/error.tsx` — é
  // melhor do que uma agenda vazia falsa, e o 500 não fica em cache.
  exigirLeitura('listEvents', error);
  return { events: (data ?? []) as unknown as EventCard[], total: count ?? 0 };
}

export function listEvents(regiao: string, filter: EventFilter): Promise<EventListResult> {
  const tags: string[] = [CACHE_TAGS.events];
  if (filter.municipality) tags.push(CACHE_TAGS.municipality(filter.municipality));
  return unstable_cache(fetchEventList, ['events', regiao, JSON.stringify(filter)], {
    tags,
    revalidate: REVALIDATE_SECONDS,
  })(regiao, filter);
}

/** O que dar a hora ao cartão precisa de saber de uma sessão, e nada mais. */
export interface SessionTime {
  session_date: string;
  start_time: string | null;
  is_cancelled: boolean;
}

/**
 * A hora com que um cartão abre — a da primeira sessão do dia que ele anuncia.
 *
 * Não é «a hora do evento», que para muitos eventos não existe: é a hora do
 * dia em que o cartão está. Um evento com duas sessões no mesmo dia mostra a
 * primeira; um evento cujas sessões são noutros dias não mostra nada.
 *
 * Três regras, e cada uma tem uma razão diferente:
 *
 * - **Um evento em cartaz (`is_ongoing`) nunca mostra hora.** É um período —
 *   uma exposição patente, uma festa de três dias — e a hora que a sessão de
 *   abertura traz é um horário de abertura, não a hora de uma sessão. É a
 *   mesma regra que o `EventDetailSessions` já aplica na ficha, e são quatro
 *   dos cinquenta eventos da primeira página do Médio Tejo: dizer «11–13 set ·
 *   18h» de uma festa que dura três dias é inventar um começo que não há.
 * - **Uma sessão cancelada não dá a hora.** A ficha mostra-a riscada, de
 *   propósito; um cartão que a anunciasse como a hora do evento mandava para
 *   a porta fechada quem já tinha bilhete.
 * - **Sem hora não se escreve nada** — nem traço, nem «por confirmar». São 26%
 *   das sessões da região, e numa lista de quarenta cartões a ausência de um
 *   sinal não é um sinal.
 */
function cardTime(event: EventCard, sessions: readonly SessionTime[] | undefined): string | null {
  if (event.is_ongoing || !event.date_start || !sessions) return null;

  let earliest: string | null = null;
  for (const session of sessions) {
    if (session.session_date !== event.date_start) continue;
    if (session.is_cancelled || !session.start_time) continue;
    if (earliest === null || session.start_time < earliest) earliest = session.start_time;
  }
  return earliest;
}

/**
 * Junta a hora aos eventos que a página vai desenhar.
 *
 * A hora existia em todo o lado menos onde a decisão se toma: sai na API
 * pública, vai nos feeds, aparece na ficha — e nenhum dos 128 cartões da
 * agenda a mostrava, porque as sessões só se carregavam em `loadFeed` e a
 * agenda e a entrada chamam `listEvents`. Uma agenda que não diz a que horas é
 * não é uma agenda; estava escrito na rota da API e nunca chegou às páginas.
 *
 * **Uma leitura à parte por identificadores, e não uma coluna a mais no
 * cartão.** As horas vivem em `event_sessions`, uma linha por sessão, e há
 * exposições com sessenta: não são coluna que se acrescente a
 * `CARD_EVENT_FIELDS`.
 *
 * **E é a leitura que a API já faz**, `listFeedSessions`, em vez de uma nova.
 * São as mesmas linhas, com a mesma cache e a mesma etiqueta — e na primeira
 * página da agenda são literalmente as mesmas, por isso a mais provável é já
 * estar quente. Uma leitura própria pouparia duas colunas (`end_time`,
 * `location_override`) em umas dezenas de linhas — cinquenta eventos do Médio
 * Tejo trazem cinquenta e sete sessões — e pagava-as com uma segunda entrada
 * de cache sobre as mesmas linhas e uma segunda definição de «as sessões
 * destes eventos» para manter a par da primeira. Lerem os dois pelo mesmo
 * sítio é o que impede a hora do cartão e a da API de voltarem a divergir, que
 * é o defeito de origem.
 *
 * **A leitura entra como argumento** porque `feeds/data.ts` importa daqui as
 * etiquetas de cache: importá-la deste lado fechava um ciclo entre os dois
 * módulos. Entrando por argumento, a decisão de degradar mora aqui e não
 * copiada em cada página.
 *
 * **E degrada.** Se `event_sessions` não se ler, os cartões saem sem hora —
 * como já saem os 26% que não a têm — e a agenda serve. `listFeedSessions`
 * propaga de propósito, e a razão está escrita lá: um `.ics` sem sessões suja
 * calendários já subscritos, com UID que não se limpam a partir daqui. Numa
 * listagem esse risco não existe, e responder 500 na página mais importante do
 * sítio por causa de um enfeite seria trocar a agenda inteira pela hora.
 *
 * A hora viaja no próprio evento e não num mapa à parte porque é dado do
 * evento, e porque assim atravessa a lista até ao cartão sem que nada pelo
 * caminho tenha de saber que ela existe.
 */
export async function withCardTimes<T extends EventCard>(
  events: readonly T[],
  from: string,
  readSessions: (
    eventIds: string[],
    from: string,
  ) => Promise<Readonly<Record<string, readonly SessionTime[]>>>,
): Promise<Array<T & { start_time: string | null }>> {
  const sessions = await degradarForaDaCache('withCardTimes', readSessions, () => ({}))(
    events.map((event) => event.id),
    from,
  );
  return events.map((event) => ({ ...event, start_time: cardTime(event, sessions[event.id]) }));
}

/**
 * Todos os eventos por acontecer, para o mapa.
 *
 * O mesmo recorte da agenda — publicado, canónico, ainda não acabou —, mas sem
 * paginação: um mapa que só mostrasse a primeira página seria um mapa que mente
 * por omissão. O tecto existe na mesma, porque uma consulta sem limite nenhum é
 * uma consulta que um dia traz tudo o que a base tiver.
 */
const MAX_MAP_EVENTS = 1000;

async function fetchEventsForMap(regiao: string): Promise<EventPoint[]> {
  const supabase = publicClient();
  if (!supabase) return [];

  const from = todayInLisbon();
  const { data, error } = await supabase
    .from('events')
    .select(`${MAP_EVENT_FIELDS}, municipalities!inner()`)
    .eq('municipalities.region_id', regiao)
    .eq('status', 'published')
    .eq('is_canonical', true)
    .or(`date_end.gte.${from},date_start.gte.${from}`)
    .order('agenda_date', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true })
    .limit(MAX_MAP_EVENTS);

  // **Propaga**, pela mesma razão da agenda: o mapa É esta lista. Um mapa sem
  // pontos não se lê como «não consegui ler» — lê-se como «não há nada a
  // acontecer nesta região», que é a afirmação mais errada que este sítio
  // pode fazer sobre quem programa cultura.
  exigirLeitura('listEventsForMap', error);
  return (data ?? []) as unknown as EventPoint[];
}

export const listEventsForMap = unstable_cache(fetchEventsForMap, ['events-map'], {
  tags: [CACHE_TAGS.events],
  revalidate: REVALIDATE_SECONDS,
});

async function fetchEvent(regiao: string, slug: string): Promise<EventDetail | null> {
  const supabase = publicClient();
  if (!supabase) return null;

  // O recorte pela região também aqui: um endereço do Médio Tejo aberto no
  // domínio de outra CIM é um 404, não um empréstimo de conteúdo.
  const { data, error } = await supabase
    .from('events')
    .select(`${DETAIL_EVENT_FIELDS}, municipalities!inner()`)
    .eq('municipalities.region_id', regiao)
    .eq('slug', slug)
    /*
     * O que está publicado, **e** o que foi arquivado por ter acontecido.
     *
     * Esta linha dizia `.eq('status', 'published')`, e era ela — e não a
     * política da base — que fazia 404 a todas as fichas do arquivo. A política
     * deixa passar o registo do que houve desde a 0064; uma consulta que exclui
     * nunca chega a perguntar se podia incluir, e assim ficou sessenta e seis
     * migrações.
     *
     * O recorte escreve-se aqui **e** na política, de propósito: é o que as
     * listagens já fazem (linhas 117-118 e 336-337), e uma consulta que confia
     * só no RLS alarga-se sozinha no dia em que alguém somar uma política.
     *
     * O `is_canonical` faltava a esta função e está em todas as outras. Corrige
     * zero fichas hoje — os 194 publicados são todos canónicos — e é o que
     * trava o duplicado arquivado na próxima desduplicação, porque a
     * `reconcile_source_events` escreve 'passado' sem olhar à canonicidade.
     */
    .or('status.eq.published,and(status.eq.archived,archived_reason.eq.passado)')
    .eq('is_canonical', true)
    .maybeSingle();

  // **Propaga o erro, mas não a ausência.** As duas situações davam `null`, e
  // `null` é 404 na ficha — ou seja, um evento que existe desaparecia durante
  // uma hora por causa de um soluço, com o 404 guardado pelo ISR. Agora
  // `null` quer dizer só uma coisa: a base respondeu e não tem este endereço
  // nesta região, que é um 404 verdadeiro e legítimo de guardar.
  exigirLeitura('getEvent', error);
  if (!data) return null;

  const { data: sessions, error: erroDasSessoes } = await supabase
    .from('event_sessions')
    .select('session_date, start_time, end_time, location_override, is_cancelled, notes')
    .eq('event_id', (data as unknown as { id: string }).id)
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true });

  // As sessões são os dias em que a coisa acontece — não são decoração da
  // ficha, são metade do que ela promete. Uma ficha meio lida guardada uma
  // hora é o mesmo defeito por outra porta.
  exigirLeitura('getEvent:sessoes', erroDasSessoes);

  return {
    ...(data as unknown as Omit<EventDetail, 'sessions'>),
    sessions: (sessions ?? []) as unknown as EventSession[],
  };
}

export function getEvent(regiao: string, slug: string): Promise<EventDetail | null> {
  return unstable_cache(fetchEvent, ['event', regiao, slug], {
    tags: [CACHE_TAGS.events],
    revalidate: REVALIDATE_SECONDS,
  })(regiao, slug);
}

/**
 * Os contornos dos concelhos, à parte dos concelhos.
 *
 * Não vão em `listMunicipalities` de propósito: os contornos pesam uns
 * dezanove quilobytes e os concelhos entram em quase todas as páginas —
 * misturá-los punha a geografia inteira na carga de qualquer página que só
 * quer os onze nomes. Só o mapa precisa disto, e é o mapa que o pede.
 */
const lerFronteiras = unstable_cache(
  async (regiao: string): Promise<Record<string, AnelDeFronteira>> => {
    const supabase = publicClient();
    if (!supabase) return {};
    const { data, error } = await supabase
      .from('municipalities')
      .select('id, boundary')
      .eq('region_id', regiao)
      .not('boundary', 'is', null);
    exigirLeitura('listMunicipalityBoundaries', error);
    return Object.fromEntries(
      ((data ?? []) as unknown as Array<{ id: string; boundary: AnelDeFronteira }>).map((linha) => [
        linha.id,
        linha.boundary,
      ]),
    );
  },
  ['municipality-boundaries'],
  { tags: [CACHE_TAGS.taxonomy], revalidate: REVALIDATE_SECONDS },
);

/**
 * **Degrada**, e é dos poucos sítios onde degradar é claramente melhor.
 *
 * Os contornos desenham-se por baixo dos pontos: sem eles o mapa fica sem as
 * linhas dos concelhos, mas continua a mostrar tudo o que há — e o que o mapa
 * afirma são os pontos, que vêm de `listEventsForMap` e esses propagam. Tirar
 * o mapa inteiro do ar por causa de uma coluna de geometria seria trocar uma
 * página imperfeita por página nenhuma.
 */
export const listMunicipalityBoundaries = degradarForaDaCache(
  'listMunicipalityBoundaries',
  lerFronteiras,
  () => ({}),
);

/**
 * **Propaga**, e é o caso mais caro de todos os desta pasta.
 *
 * Esta lista não é conteúdo: é a lista fechada por onde se valida um
 * endereço. A vazio, `findMunicipality` não encontra nada e `/concelho/<id>`
 * responde 404 nos onze concelhos ao mesmo tempo — e com eles o feed RSS de
 * cada um, o `.ics` e os widgets que já estão embebidos nos sítios das
 * câmaras. O ISR guarda esses 404. Um erro que sobe é um 500 de segundos; um
 * 404 guardado é uma hora a dizer a um motor de busca que aquelas páginas
 * deixaram de existir.
 */
export const listMunicipalities = unstable_cache(
  async (regiao: string): Promise<Municipality[]> => {
    const supabase = publicClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('municipalities')
      .select('id, name, district, latitude, longitude, sort_order')
      .eq('region_id', regiao)
      .order('sort_order');
    exigirLeitura('listMunicipalities', error);
    return (data ?? []) as unknown as Municipality[];
  },
  ['municipalities'],
  { tags: [CACHE_TAGS.taxonomy], revalidate: REVALIDATE_SECONDS },
);

/**
 * Os concelhos de todas as regiões, sem recorte.
 *
 * É a leitura das superfícies trans-regiões — a área interna e a validação do
 * intake trabalham sobre o catálogo inteiro do produto, não sobre o recorte
 * de um domínio. Nenhuma página pública a usa: as páginas usam a versão com
 * região, que é o que impede uma agenda de mostrar os concelhos da outra.
 *
 * **Propaga**, como a versão com região e pela mesma razão: é uma lista
 * fechada de validação. A vazio, o `checkReferences` do intake responde
 * «Escolhe um dos concelhos da lista» a quem escolheu um concelho que existe
 * — recusar uma submissão válida é mentir a uma pessoa, e uma submissão
 * recusada raramente é enviada segunda vez.
 */
export const listMunicipalitiesDeTodas = unstable_cache(
  async (): Promise<Array<Municipality & { region_id: string }>> => {
    const supabase = publicClient();
    if (!supabase) return [];
    // Com a região de cada um: quem lê o catálogo inteiro precisa de saber
    // de quem é cada concelho — o intake recorta a lista da extração por
    // região, e a submissão pública herda a região do concelho escolhido.
    const { data, error } = await supabase
      .from('municipalities')
      .select('id, name, district, latitude, longitude, sort_order, region_id')
      .order('sort_order');
    exigirLeitura('listMunicipalitiesDeTodas', error);
    return (data ?? []) as unknown as Array<Municipality & { region_id: string }>;
  },
  ['municipalities-todas'],
  { tags: [CACHE_TAGS.taxonomy], revalidate: REVALIDATE_SECONDS },
);

/**
 * A taxonomia do produto — uma tabela pequena, que não muda de mês a mês.
 *
 * **Propaga**, e a razão não é a agenda: aí, uma categoria sem nome é um
 * filtro feio e mais nada. É o intake. O `checkReferences` valida a categoria
 * de uma submissão contra esta lista, e uma lista vazia recusa todas as
 * categorias que existem com «Escolhe uma das categorias da lista». O mesmo
 * argumento dos concelhos: uma lista fechada vazia não valida nada — recusa
 * tudo.
 */
export const listCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const supabase = publicClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('categories')
      .select('slug, name, description, sort_order')
      .order('sort_order');
    exigirLeitura('listCategories', error);
    return (data ?? []) as unknown as Category[];
  },
  ['categories'],
  { tags: [CACHE_TAGS.taxonomy], revalidate: REVALIDATE_SECONDS },
);

/**
 * **Propaga**: é o assunto inteiro de `/coretos`.
 *
 * O levantamento é uma página que só tem isto. A vazio, anuncia que não há um
 * único coreto no território — vindo de um sítio que se chama Coreto, é a
 * afirmação mais absurda que ele podia fazer sobre si próprio.
 */
export const listCoretos = unstable_cache(
  async (regiao: string): Promise<Coreto[]> => {
    const supabase = publicClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('coretos')
      .select(`${CORETO_FIELDS}, municipalities!inner()`)
      .eq('municipalities.region_id', regiao)
      .order('name');
    exigirLeitura('listCoretos', error);
    return (data ?? []) as unknown as Coreto[];
  },
  ['coretos'],
  { tags: [CACHE_TAGS.coretos], revalidate: REVALIDATE_SECONDS },
);

/**
 * **Propaga**: é o assunto de `/espacos` e metade da página de cada concelho.
 *
 * «Ainda não há espaços registados neste concelho» é uma frase escrita para
 * dizer uma verdade sobre um concelho por começar. Dita por causa de um erro
 * de leitura, apaga as coletividades, os cine-teatros e as bibliotecas que lá
 * estão — e são elas que sustentam metade da programação desta região.
 */
export const listVenues = unstable_cache(
  async (regiao: string, municipalityId?: string): Promise<Venue[]> => {
    const supabase = publicClient();
    if (!supabase) return [];
    let query = supabase
      .from('venues')
      .select(`${VENUE_FIELDS}, municipalities!inner()`)
      .eq('municipalities.region_id', regiao)
      .neq('status', 'closed');
    if (municipalityId) query = query.eq('municipality_id', municipalityId);
    const { data, error } = await query.order('name');
    exigirLeitura('listVenues', error);
    return (data ?? []) as unknown as Venue[];
  },
  ['venues'],
  { tags: [CACHE_TAGS.venues], revalidate: REVALIDATE_SECONDS },
);

/**
 * Os espaços de todas as regiões — o par de `listMunicipalitiesDeTodas`.
 *
 * **Propaga** pela razão do par: é a lista fechada do `checkReferences`, e a
 * vazio responde «Esse espaço não está no catálogo» a quem escolheu um espaço
 * que está no catálogo.
 */
export const listVenuesDeTodas = unstable_cache(
  async (): Promise<Venue[]> => {
    const supabase = publicClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('venues')
      .select(VENUE_FIELDS)
      .neq('status', 'closed')
      .order('name');
    exigirLeitura('listVenuesDeTodas', error);
    return (data ?? []) as unknown as Venue[];
  },
  ['venues-todas'],
  { tags: [CACHE_TAGS.venues], revalidate: REVALIDATE_SECONDS },
);

const lerEspaco = unstable_cache(
  async (regiao: string, id: string): Promise<Venue | null> => {
    const supabase = publicClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('venues')
      .select(`${VENUE_FIELDS}, municipalities!inner()`)
      .eq('municipalities.region_id', regiao)
      .eq('id', id)
      .neq('status', 'closed')
      .maybeSingle();
    exigirLeitura('getVenue', error);
    return (data as unknown as Venue) ?? null;
  },
  ['venue'],
  { tags: [CACHE_TAGS.venues], revalidate: REVALIDATE_SECONDS },
);

/**
 * **Degrada** — ao contrário do `getVenueDetail`, que é o assunto de uma
 * página.
 *
 * Quem chama esta é a ficha de um evento, para dizer em que espaço ele é. A
 * ficha já sabe viver sem resposta: `null` é o caso corrente de um evento sem
 * espaço no catálogo, e aí mostra-se o `location_name` que vem no próprio
 * evento. Rebentar a ficha inteira porque não se leu o cartão do espaço era
 * perder a página para ganhar uma linha.
 */
export const getVenue = degradarForaDaCache('getVenue', lerEspaco, () => null);

/**
 * As fontes que a agenda lê, para a página que as apresenta.
 *
 * As desligadas vêm também, e de propósito: é uma fonte desligada que explica
 * porque é que falta a agenda de um concelho, e essa explicação vale mais do
 * que uma lista arrumada só com o que corre bem.
 *
 * **Propaga**: é o assunto de `/fontes`, a página que presta contas de onde
 * vem cada linha da agenda. A vazio, a página de um concelho passa a dizer
 * «Ainda não há aqui uma agenda que possamos ler todas as noites» sobre
 * concelhos cuja câmara publica agenda há anos — uma página de transparência
 * que engana é pior do que não a haver.
 */
export const listPublicSources = unstable_cache(
  async (regiao: string): Promise<PublicSource[]> => {
    const supabase = publicClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('sources')
      .select(PUBLIC_SOURCE_FIELDS)
      .order('name');
    exigirLeitura('listPublicSources', error);
    // O recorte é em memória e não por junção: uma fonte pode não ter
    // concelho (`municipality_id` nulo) e uma junção interior escondia-a de
    // todas as regiões. Sem concelho, quem diz a região é a própria fonte
    // (`sources.region_id`, migração 0106) — a região de prova no CI apanhou
    // as fontes regionais do Médio Tejo a aparecer na página de outra CIM.
    const concelhosDaRegiao = new Set(
      (await listMunicipalities(regiao)).map((municipality) => municipality.id),
    );
    return ((data ?? []) as unknown as PublicSource[]).filter((source) =>
      source.municipality_id === null
        ? source.region_id === regiao
        : concelhosDaRegiao.has(source.municipality_id),
    );
  },
  ['public-sources'],
  { tags: [CACHE_TAGS.sources], revalidate: REVALIDATE_SECONDS },
);

/**
 * **Propaga**: é o assunto de `/ciclos`.
 *
 * Um ciclo é uma coisa que se anuncia meses antes — a vazio, o índice diz que
 * a região não tem festivais nenhuns, e é aí que estão os nomes que as pessoas
 * procuram. Nas outras páginas isto serve só para dar nome a um filtro, e aí
 * propagar é um exagero; paga-se o exagero em vez de partir a leitura em duas,
 * porque duas leituras iguais com comportamentos diferentes é a próxima
 * armadilha a montar.
 */
export const listSeries = unstable_cache(
  async (regiao: string): Promise<Series[]> => {
    const supabase = publicClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('series')
      .select('id, name, kind, municipality_id, description, website_url, is_regional')
      .eq('region_id', regiao)
      .order('name');
    exigirLeitura('listSeries', error);
    return (data ?? []) as unknown as Series[];
  },
  ['series'],
  { tags: [CACHE_TAGS.taxonomy], revalidate: REVALIDATE_SECONDS },
);

/**
 * Os eventos de um ciclo — os que vêm aí e os que já passaram.
 *
 * É a única consulta desta casa que não filtra por `status = 'published'`, e é
 * de propósito: um ciclo é uma coisa que tem edições, e uma edição que já
 * aconteceu continua a ser o melhor argumento para a próxima. Quem decide o
 * que sai daqui não é este ficheiro — é a política de leitura da base, que
 * deixa passar os eventos arquivados só quando foram arquivados por terem
 * acontecido e são canónicos (migração 0132; até lá pedia-se também um ciclo
 * com nome, que era a 0064 escrita para o CAMINHOS). O que foi arquivado por
 * estar errado continua invisível, se se pedir ou não.
 */
async function fetchSeriesEvents(seriesId: string): Promise<SeriesEvent[]> {
  const supabase = publicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('events')
    .select(SERIES_EVENT_FIELDS)
    .eq('series_id', seriesId)
    .eq('is_canonical', true)
    .order('date_start', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true });

  // **Propaga**: é o assunto de `/ciclo/<id>`. A lista vazia diz que o ciclo
  // não tem uma única data registada — e o comentário acima explica que a
  // página existe precisamente para mostrar as que já houve.
  exigirLeitura('listSeriesEvents', error);
  return (data ?? []) as unknown as SeriesEvent[];
}

export function listSeriesEvents(seriesId: string): Promise<SeriesEvent[]> {
  return unstable_cache(fetchSeriesEvents, ['series-events', seriesId], {
    tags: [CACHE_TAGS.events, CACHE_TAGS.taxonomy],
    revalidate: REVALIDATE_SECONDS,
  })(seriesId);
}

/** Quantos eventos tem cada ciclo, indexado pelo `id` do ciclo. */
export interface ContagemDoCiclo {
  /** Tudo o que o ciclo tem registado, incluindo o que já passou. */
  total: number;
  /** Só o que ainda está publicado — o que está para vir. */
  porAcontecer: number;
}

export type SeriesEventCounts = Record<string, ContagemDoCiclo>;

/**
 * A contagem por ciclo, para o índice.
 *
 * Uma coluna só, de uma tabela que na região inteira tem poucas centenas de
 * linhas — conta-se em memória e acabou. O que sustenta esta decisão não é o
 * número de hoje: é o tecto de mil linhas que a API de dados devolve de uma vez.
 * Enquanto a tabela couber nele, esta consulta é exacta; passar disso obriga a
 * paginar, como já faz `fetchVenueEventCounts` aqui em baixo.
 *
 * As contagens por ciclo existem para duas coisas: separar os ciclos que já têm
 * programação registada dos que ainda são só um nome que sabemos existir, e —
 * dentro dos primeiros — separar o que está para vir do que já aconteceu.
 *
 * **A segunda separação não é um pormenor.** O índice mostrava «CAMINHOS · 10
 * datas» debaixo de «Com programação registada», e as dez são de abril e maio:
 * já passaram todas. Quem lesse aquilo esperava encontrar dez espetáculos por
 * ir ver. Uma agenda não pode contar o arquivo e o futuro no mesmo saco sem
 * dizer qual é qual.
 */
async function fetchSeriesEventCounts(regiao: string): Promise<SeriesEventCounts> {
  const supabase = publicClient();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from('events')
    .select('series_id, status, series!inner()')
    .eq('series.region_id', regiao)
    .eq('is_canonical', true)
    .not('series_id', 'is', null);

  exigirLeitura('countEventsBySeries', error);

  const counts: SeriesEventCounts = {};
  const linhas = (data ?? []) as unknown as Array<{ series_id: string | null; status: string }>;
  for (const row of linhas) {
    if (!row.series_id) continue;
    const contagem = counts[row.series_id] ?? { total: 0, porAcontecer: 0 };
    contagem.total += 1;
    if (row.status === 'published') contagem.porAcontecer += 1;
    counts[row.series_id] = contagem;
  }
  return counts;
}

/**
 * **Propaga**, e é a contagem que obrigou a afinar a regra.
 *
 * «As contagens degradam» era a resposta fácil, e está errada aqui: no índice
 * dos ciclos esta contagem não é um número ao lado de um nome — é o que
 * decide em qual das duas listas cada ciclo cai. A zero, todos os ciclos da
 * região passam para «por recolher» e cada cartão diz «sem datas registadas»,
 * incluindo o festival que tem dez. Um valor que se lê como uma afirmação não
 * pode ter por omissão o valor de uma afirmação falsa.
 */
export const countEventsBySeries = unstable_cache(fetchSeriesEventCounts, ['series-event-counts'], {
  tags: [CACHE_TAGS.events, CACHE_TAGS.taxonomy],
  revalidate: REVALIDATE_SECONDS,
});

/** Quantos eventos marcados tem cada concelho, indexado pelo `id` do concelho. */
export type MunicipalityEventCounts = Record<string, number>;

/**
 * Contagens por concelho, para a montra territorial.
 *
 * É um pedido com `head: true` por concelho, em vez de um `group by`, porque a API de
 * dados não agrega sem uma vista ou função dedicada — e um `select` da coluna
 * do concelho para contar em memória bate no limite de linhas da API e
 * devolveria contagens truncadas, que é pior do que contagem nenhuma. Onze
 * contagens exatas por hora custam pouco e nunca mentem.
 */
async function fetchMunicipalityEventCounts(regiao: string): Promise<MunicipalityEventCounts> {
  const supabase = publicClient();
  if (!supabase) return {};

  // Contar por concelho já é contar por região: cada concelho é de uma só.
  const municipalities = await listMunicipalities(regiao);
  const from = todayInLisbon();

  const entries = await Promise.all(
    municipalities.map(async (municipality) => {
      const { count, error } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .eq('is_canonical', true)
        .eq('municipality_id', municipality.id)
        .or(`date_end.gte.${from},date_start.gte.${from}`);

      // Uma contagem em erro dava zero, e zero, nesta grelha, escreve-se
      // «Ainda sem programação — enviem a vossa» debaixo do nome do
      // concelho. Guardar isso uma hora era pedir programação a quem já a
      // publicou. Onze contagens são uma leitura só: falha uma, falha a
      // leitura.
      exigirLeitura(`countEventsByMunicipality:${municipality.id}`, error);
      return [municipality.id, count ?? 0] as const;
    }),
  );

  return Object.fromEntries(entries);
}

/**
 * **Propaga**, pela mesma razão da contagem por ciclo: o zero desta grelha não
 * é um número que falta, é a frase «Ainda sem programação — enviem a vossa»
 * debaixo dos onze concelhos ao mesmo tempo.
 */
export const countEventsByMunicipality = unstable_cache(
  fetchMunicipalityEventCounts,
  ['municipality-event-counts'],
  { tags: [CACHE_TAGS.events, CACHE_TAGS.taxonomy], revalidate: REVALIDATE_SECONDS },
);

/** Quantos eventos marcados tem cada espaço, indexado pelo `id` do espaço. */
export type VenueEventCounts = Record<string, number>;

/**
 * Contagens por espaço, para o catálogo de espaços.
 *
 * Os concelhos são onze e levam onze contagens exatas; os espaços são
 * oitenta, e oitenta pedidos por hora só para números de cartão não se
 * justificam. Puxa-se a coluna do espaço de todos os eventos marcados,
 * página a página até a resposta vir por preencher, e conta-se em memória —
 * exato em qualquer tamanho de catálogo, sem depender do limite de linhas
 * da API.
 */
async function fetchVenueEventCounts(regiao: string): Promise<VenueEventCounts> {
  const supabase = publicClient();
  if (!supabase) return {};

  const from = todayInLisbon();
  const counts: VenueEventCounts = {};
  const PAGE = 1000;

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('events')
      .select('venue_id, municipalities!inner()')
      .eq('municipalities.region_id', regiao)
      .eq('status', 'published')
      .eq('is_canonical', true)
      .not('venue_id', 'is', null)
      .or(`date_end.gte.${from},date_start.gte.${from}`)
      .range(offset, offset + PAGE - 1);

    /*
     * **Um catálogo com exatamente mil eventos partia esta página.**
     *
     * A saída do ciclo é «vieram menos de mil»; com mil certos, a volta
     * seguinte pedia as linhas 1000–1999 de uma lista com mil, o PostgREST
     * recusava com 416 e `PGRST103`, e o `exigirLeitura` fazia disso um erro
     * de leitura — o catálogo de espaços inteiro a 500, num número redondo que
     * chega uma vez e depois passa. Aqui a recusa quer dizer o mesmo que a
     * saída normal do ciclo: não há mais linhas.
     */
    if (error && ehPaginaAlemDoFim(error)) break;
    exigirLeitura('countEventsByVenue', error);

    const rows = (data ?? []) as unknown as Array<{ venue_id: string | null }>;
    for (const row of rows) {
      if (row.venue_id) counts[row.venue_id] = (counts[row.venue_id] ?? 0) + 1;
    }
    if (rows.length < PAGE) break;
  }

  return counts;
}

const contarPorEspaco = unstable_cache(fetchVenueEventCounts, ['venue-event-counts'], {
  tags: [CACHE_TAGS.events, CACHE_TAGS.venues],
  revalidate: REVALIDATE_SECONDS,
});

/**
 * **Degrada** — e é a contagem que mostra onde está a fronteira.
 *
 * Esta é a única das três que o cartão do espaço só desenha quando é maior
 * que zero (`VenueCard`: `count > 0 ? …`). Sem ela, o cartão fica sem a linha
 * dos eventos e mais nada — o nome, a fotografia, o concelho e o selo do «por
 * confirmar» continuam lá. Não há frase nenhuma a ser dita em nome do espaço,
 * e por isso perder o catálogo inteiro de oitenta espaços por causa dos
 * números seria trocar muito por pouco.
 *
 * A contagem por concelho e a contagem por ciclo, aqui ao lado, propagam
 * precisamente porque o zero delas **é** uma frase.
 */
export const countEventsByVenue = degradarForaDaCache(
  'countEventsByVenue',
  contarPorEspaco,
  () => ({}),
);

/**
 * Só o nome de cada espaço, indexado por `id`.
 *
 * O catálogo completo traz dezasseis colunas, várias delas texto longo, e uma
 * lista de eventos só precisa de saber como se chama o espaço onde cada um é.
 * A mesma disciplina de colunas dos cartões, aplicada às consultas de apoio.
 */
const lerNomesDeEspacos = unstable_cache(
  async (regiao: string, municipalityId?: string): Promise<Record<string, string>> => {
    const supabase = publicClient();
    if (!supabase) return {};

    let query = supabase
      .from('venues')
      .select('id, name, municipalities!inner()')
      .eq('municipalities.region_id', regiao)
      .neq('status', 'closed');
    if (municipalityId) query = query.eq('municipality_id', municipalityId);

    const { data, error } = await query;
    exigirLeitura('listVenueNames', error);

    const rows = (data ?? []) as unknown as Array<{ id: string; name: string }>;
    return Object.fromEntries(rows.map((row) => [row.id, row.name]));
  },
  ['venue-names'],
  { tags: [CACHE_TAGS.venues], revalidate: REVALIDATE_SECONDS },
);

/**
 * **Degrada.** É um dicionário de nomes, e quem o consulta já tem um plano B
 * escrito: `evento.venue_id ? venueNames[venue_id] : undefined` cai no
 * `location_name` que vem no próprio evento. O cartão perde «Cine-Teatro
 * Paraíso» e fica com «Rua Serpa Pinto» — menos bonito, igualmente verdadeiro.
 * Deitar abaixo a agenda inteira porque faltou a tradução dos nomes seria
 * castigar a página pelo apoio.
 */
export const listVenueNames = degradarForaDaCache('listVenueNames', lerNomesDeEspacos, () => ({}));

/**
 * O espaço com os contactos, para a ficha.
 *
 * O catálogo não traz telefone nem email: uma grelha com cem espaços não os
 * mostra e não vale a pena pagá-los em cada listagem. A ficha é o único sítio
 * onde alguém os procura, e é aqui que se buscam.
 */
const VENUE_DETAIL_FIELDS = [
  VENUE_FIELDS,
  'short_name',
  'postal_code',
  'phone',
  'email',
  'ticketing_url',
  'image_credit',
  // O horário anda sempre com a data em que foi lido, e as duas colunas
  // pedem-se juntas por isso: mostrar uma sem a outra é afirmar sobre hoje o
  // que era verdade num dia que ninguém sabe qual é.
  'opening_hours',
  'opening_hours_checked_on',
].join(', ');

export interface VenueDetail extends Venue {
  short_name: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  ticketing_url: string | null;
  image_credit: string | null;
  opening_hours: string | null;
  /** ISO `YYYY-MM-DD`. Nunca nulo quando há horário — a base garante-o. */
  opening_hours_checked_on: string | null;
}

export const getVenueDetail = unstable_cache(
  async (regiao: string, id: string): Promise<VenueDetail | null> => {
    const supabase = publicClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('venues')
      .select(`${VENUE_DETAIL_FIELDS}, municipalities!inner()`)
      .eq('municipalities.region_id', regiao)
      .eq('id', id)
      .neq('status', 'closed')
      .maybeSingle();

    // **Propaga o erro, não a ausência** — a mesma separação do `getEvent`.
    // Isto é o assunto de `/espaco/<id>`, e a página faz `notFound()` com
    // `null`: com as duas situações a valer `null`, um soluço de leitura
    // apagava uma ficha que existe e o ISR guardava o 404. Agora `null` só
    // quer dizer que a base respondeu e não tem este espaço nesta região.
    exigirLeitura('getVenueDetail', error);
    return (data as unknown as VenueDetail) ?? null;
  },
  ['venue-detail'],
  { tags: [CACHE_TAGS.venues], revalidate: REVALIDATE_SECONDS },
);
