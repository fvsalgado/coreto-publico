import {
  eventFilterSchema,
  janelaDaSemana,
  janelaDeHoje,
  janelaDoFimDeSemana,
  type EventFilter,
  type JanelaDeDatas,
} from '@coreto/core';
import { PATH } from './caminhos';
import { formatLongDate, formatShortDate, formatWeekdayDate } from './format';

/**
 * A parte da agenda que não fala com a base nem com o React.
 *
 * Estava tudo dentro de `app/[regiao]/agenda/page.tsx` e não tinha um único
 * teste — não por desleixo, mas porque importar a página arrasta o `next/cache`
 * e o cliente do Supabase, e a partir daí não há teste que corra. Aqui é código
 * puro: entra um filtro, sai um endereço ou uma decisão.
 *
 * É o que permite travar a regressão que interessa — que o endereço de um
 * atalho seja **exactamente** o canónico da vista a que ele leva.
 */

// O caminho vive em `caminhos.ts`, sem dependências, para a lupa do toldo o
// poder ler sem arrastar este módulo para o navegador. Daqui sai igual.
export { PATH };

/** Os defaults do schema, para não repetir números mágicos por aqui. */
export const DEFAULTS = eventFilterSchema.parse({});

export const FILTER_KEYS = [
  'municipality',
  'category',
  'from',
  'to',
  'free',
  'accessible',
  'lgp',
  'audiodescricao',
  'legendas',
  'relaxada',
  'familia',
  'venue',
  'series',
  'q',
  'page',
  'limit',
] as const;

/** Os campos que se mostram como fichas removíveis. `page` e `limit` não são filtros. */
export type FilterKey =
  | 'q'
  | 'from'
  | 'to'
  | 'municipality'
  | 'category'
  | 'venue'
  | 'series'
  | 'free'
  | 'familia'
  | EixoDeAcessibilidade;

/**
 * Os cinco eixos da acessibilidade, com o nome que têm no endereço.
 *
 * Uma lista só, e é dela que saem o esquema, a consulta, as caixas do
 * formulário e as fichas dos filtros a valer. Acrescentar um eixo em quatro
 * sítios à mão era garantir que um dia faltava num deles — foi o que já
 * aconteceu: as colunas existem desde a 0004 e o filtro só conhecia uma.
 */
export const EIXOS_DE_ACESSIBILIDADE = [
  {
    chave: 'accessible',
    coluna: 'wheelchair_accessible_resolved',
    rotulo: 'Acesso a cadeiras de rodas',
    nome: 'acesso a cadeiras de rodas',
  },
  {
    chave: 'lgp',
    coluna: 'has_sign_language',
    rotulo: 'Língua Gestual Portuguesa',
    nome: 'Língua Gestual Portuguesa',
  },
  {
    chave: 'audiodescricao',
    coluna: 'has_audio_description',
    rotulo: 'Com audiodescrição',
    nome: 'audiodescrição',
  },
  { chave: 'legendas', coluna: 'has_subtitles', rotulo: 'Com legendagem', nome: 'legendagem' },
  {
    chave: 'relaxada',
    coluna: 'is_relaxed_performance',
    rotulo: 'Sessão relaxada',
    nome: 'sessão relaxada',
  },
] as const satisfies readonly { chave: string; coluna: string; rotulo: string; nome: string }[];

export type EixoDeAcessibilidade = (typeof EIXOS_DE_ACESSIBILIDADE)[number]['chave'];
type Eixo = (typeof EIXOS_DE_ACESSIBILIDADE)[number];

/** O que o formulário faz com os eixos da acessibilidade, e o que diz dos que não oferece. */
export interface EixosDoFormulario {
  /** As caixas que se oferecem. */
  oferecidos: Eixo[];
  /** Os que nenhum evento da agenda inteira declara — com ou sem caixa. */
  nenhumNaAgenda: Eixo[];
  /** Os que a agenda tem, mas nenhum dos eventos deste recorte (que não está vazio). */
  nenhumNoRecorte: Eixo[];
}

/**
 * Que caixas de acessibilidade se oferecem, e o que se diz das outras.
 *
 * **As caixas.** Sem contagem — um build sem base, ou uma janela grande de
 * mais para se contar — oferece-se a das cadeiras de rodas e mais nada: é o
 * que existia antes disto e o único eixo que se sabe estar preenchido em
 * produção. Com contagem, oferece-se o que tem eventos, mais o que já esteja a
 * valer no endereço (senão não havia como o desligar). Uma caixa que devolve
 * sempre zero é uma armadilha, e esta já foi uma.
 *
 * **O que se diz das outras (C2-010).** Esconder a caixa trocava a armadilha
 * por silêncio: quem vinha perguntar «há alguma sessão com Língua Gestual
 * Portuguesa?» não recebia nem sim nem não. Agora diz-se o não, e de que
 * tamanho ele é — **a agenda inteira** (`contagemDaAgenda`, sem filtro) não
 * tem nenhum, ou **este recorte** não tem, e a agenda tem. São frases
 * diferentes porque mandam fazer coisas diferentes: a primeira é para quem
 * organiza, a segunda para quem procura, que pode tirar um filtro. Sem uma
 * das contagens não se afirma nada — calar é melhor do que adivinhar.
 */
export function eixosDoFormulario(
  filter: EventFilter,
  contagem: Readonly<Record<string, number>> | null,
  contagemDaAgenda: Readonly<Record<string, number>> | null,
  /**
   * Quantos eventos tem o recorte. Num recorte vazio, «nenhum declara X» é
   * verdade de todos os eixos ao mesmo tempo, e dizê-lo é ruído: o vazio já
   * diz o que tem a dizer.
   */
  totalDoRecorte: number | null = null,
): EixosDoFormulario {
  const oferecidos = EIXOS_DE_ACESSIBILIDADE.filter((eixo) => {
    if (filter[eixo.chave]) return true;
    if (contagem === null) return eixo.chave === 'accessible';
    return (contagem[eixo.chave] ?? 0) > 0;
  });
  const naAgenda = (eixo: Eixo) => contagemDaAgenda?.[eixo.chave] ?? 0;
  return {
    oferecidos,
    nenhumNaAgenda:
      contagemDaAgenda === null
        ? []
        : EIXOS_DE_ACESSIBILIDADE.filter((eixo) => naAgenda(eixo) === 0),
    nenhumNoRecorte:
      contagemDaAgenda === null || contagem === null || totalDoRecorte === 0
        ? []
        : EIXOS_DE_ACESSIBILIDADE.filter(
            (eixo) => !oferecidos.includes(eixo) && naAgenda(eixo) > 0,
          ),
  };
}

/** «a, b ou c» — os nomes dos eixos numa frase, como se diz em português. */
export function nomesDosEixos(
  eixos: readonly { nome: string }[],
  tipo: 'conjunction' | 'disjunction' = 'disjunction',
): string {
  return new Intl.ListFormat('pt-PT', { style: 'long', type: tipo }).format(
    eixos.map((eixo) => eixo.nome),
  );
}

/**
 * «Para crianças e famílias», com o que os eventos já dizem de si (C2-009).
 *
 * O atalho «Para a família» levava à categoria «Infantil e família», que no
 * Médio Tejo tinha dois eventos — e deixava de fora o «Tafiti e os seus
 * amigos», um filme de animação de domingo de manhã que estava em «Cinema».
 * Uma categoria é um género; uma família procura um público.
 *
 * A regra usa só o que já está na base, sem inventar nada: a categoria
 * **ou** o público declarado — `family` ou `children`, que é o que o
 * `parseAudience` escreve quando a fonte fala de famílias, de crianças ou dos
 * mais novos, ou quando dá uma idade mínima até aos doze. E tira dois casos
 * que a contradizem: uma idade mínima acima dos doze (o mesmo tecto do
 * `parseAudience`) e uma sessão para escolas, que é fechada.
 *
 * Fica dito o que a regra não sabe: uma classificação «M/6» quer dizer
 * «permitido a partir dos seis», e entra aqui como família. É o que a fonte
 * declara, e a moderação corrige o público quando ele não serve.
 */
export const FAMILIA = {
  categoria: 'infantil',
  publicos: ['family', 'children'],
  idadeMaxima: 12,
  rotulo: 'Para crianças e famílias',
} as const;

export type SearchParams = Record<string, string | string[] | undefined>;

/** Um parâmetro repetido no endereço vale pela primeira ocorrência. */
function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Lê os filtros do endereço.
 *
 * Um formulário GET submete também os campos que ficaram por preencher
 * («from=»), e uma data vazia não passa no schema — daí limpar os vazios antes
 * de validar, senão bastava um campo em branco para o botão «Filtrar» deixar
 * de funcionar. Um parâmetro inválido cai nos defaults em vez de rebentar: quem
 * escreveu o endereço à mão vê a agenda, não uma página de erro.
 */
export function readFilter(searchParams: SearchParams): EventFilter {
  const raw: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = firstValue(searchParams[key])?.trim();
    if (value) raw[key] = value;
  }

  const parsed = eventFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULTS;
}

/**
 * Reconstrói o endereço a partir dos filtros já validados — nunca do que veio
 * em bruto.
 *
 * `omit` tira um filtro e leva de volta à primeira página: quem larga o
 * concelho estava na página 3 de uma lista que agora tem trinta, e cair num
 * «sem resultados» que é só uma página vazia seria dar-lhe a entender que
 * alargar o filtro tirou eventos.
 *
 * Aceita mais do que um campo porque um recorte de tempo são dois — `from` e
 * `to` — e larga-se inteiro: tirar só metade de uma janela deixava a agenda
 * «até domingo», que não é um filtro que alguém tenha pedido.
 */
export function buildHref(
  filter: EventFilter,
  page: number,
  omit?: FilterKey | readonly FilterKey[],
  /**
   * O caminho a que os filtros se colam. É a agenda por omissão; o mapa passa
   * o dele para levar os mesmos filtros — a mesma função, para os dois
   * endereços não poderem divergir num parâmetro.
   */
  base: string = PATH,
): string {
  const params = new URLSearchParams();
  const fora = new Set<FilterKey>(
    omit === undefined ? [] : typeof omit === 'string' ? [omit] : omit,
  );
  const keep = (key: FilterKey): boolean => !fora.has(key);

  if (filter.q && keep('q')) params.set('q', filter.q);
  if (filter.from && keep('from')) params.set('from', filter.from);
  if (filter.to && keep('to')) params.set('to', filter.to);
  if (filter.municipality && keep('municipality')) params.set('municipality', filter.municipality);
  if (filter.category && keep('category')) params.set('category', filter.category);
  if (filter.venue && keep('venue')) params.set('venue', filter.venue);
  if (filter.series && keep('series')) params.set('series', filter.series);
  if (filter.free && keep('free')) params.set('free', '1');
  if (filter.familia && keep('familia')) params.set('familia', '1');
  for (const eixo of EIXOS_DE_ACESSIBILIDADE) {
    if (filter[eixo.chave] && keep(eixo.chave)) params.set(eixo.chave, '1');
  }
  if (filter.limit !== DEFAULTS.limit) params.set('limit', String(filter.limit));
  if (page > 1) params.set('page', String(page));

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** O caminho do mapa, que aceita os mesmos filtros da agenda. */
export const PATH_DO_MAPA = '/mapa';

/**
 * Os dois recortes que se oferecem como pílulas, fora do formulário.
 *
 * O concelho e a categoria têm menos de quinze valores cada, e uma lista
 * suspensa escondia-os atrás de dois toques. Como pílulas ficam à vista, e
 * cada uma é uma ligação: o estado continua no endereço, sem JavaScript.
 */
export type Faceta = 'municipality' | 'category';

export interface Pilula {
  valor: string;
  rotulo: string;
  href: string;
  activa: boolean;
  /** Quantos eventos há com este valor, dado o resto do filtro; `null` quando não se contou. */
  quantos: number | null;
}

/**
 * As pílulas de uma faceta, já com endereço.
 *
 * Carregar na que está acesa tira-a; carregar noutra troca. Ambas voltam à
 * primeira página, pela mesma razão que as fichas de `activeFilters`. As
 * opções sem eventos ficam de fora quando há contagem — uma pílula que leva a
 * uma lista vazia é um convite para uma porta fechada —, excepto a que está
 * acesa, que tem de estar lá para se poder apagar.
 */
export function pilulasDeFaceta(
  filter: EventFilter,
  faceta: Faceta,
  opcoes: readonly { valor: string; rotulo: string }[],
  contagem: Readonly<Record<string, number>> | null,
): Pilula[] {
  const actual = filter[faceta];
  return opcoes
    .map((opcao) => {
      const activa = actual === opcao.valor;
      const quantos = contagem ? (contagem[opcao.valor] ?? 0) : null;
      const href = activa
        ? buildHref(filter, 1, faceta)
        : buildHref({ ...filter, [faceta]: opcao.valor }, 1);
      return { valor: opcao.valor, rotulo: opcao.rotulo, href, activa, quantos };
    })
    .filter((pilula) => pilula.activa || pilula.quantos === null || pilula.quantos > 0);
}

/**
 * Os concelhos que ficaram fora da fila por não terem nada neste recorte.
 *
 * As pílulas sem eventos saem — uma pílula que leva a uma lista vazia é um
 * convite para uma porta fechada —, e saíam em silêncio: três dos onze
 * concelhos do Médio Tejo desapareciam da agenda da CIM sem uma palavra
 * (C2-007), e quem procurava Ferreira do Zêzere concluía que não existia.
 * Continuam fora das pílulas, e passam a estar no fim da fila, com o zero à
 * vista e a ligação para a página do concelho — que é onde está a explicação
 * honesta de porque não há nada (a agenda da câmara que não se lê, ou um mês
 * sem programação). Nenhuma leva a uma lista vazia.
 *
 * Sem contagem (`null`), não se sabe quem está a zero, e não se diz nada.
 */
export function concelhosSemEventos(
  filter: EventFilter,
  opcoes: readonly { valor: string; rotulo: string }[],
  contagem: Readonly<Record<string, number>> | null,
): Array<{ valor: string; rotulo: string; href: string }> {
  if (!contagem) return [];
  return opcoes
    .filter((opcao) => opcao.valor !== filter.municipality && (contagem[opcao.valor] ?? 0) === 0)
    .map((opcao) => ({
      valor: opcao.valor,
      rotulo: opcao.rotulo,
      href: `/concelho/${opcao.valor}`,
    }));
}

/** Um filtro a menos: o que o vazio da agenda propõe tirar. */
export interface Alargamento {
  rotulo: string;
  href: string;
  filtro: EventFilter;
}

/**
 * Os filtros a valer, tirados um a um — o que o vazio propõe (C2-008).
 *
 * O vazio dizia «Alargue o intervalo de datas ou limpe alguns filtros» e o
 * único botão era «Enviar um evento»: uma frase que não diz qual alargar, e
 * um botão para quem programa na página de quem procura. Isto dá a lista do
 * que se pode tirar, com o endereço já feito; quem chama conta cada uma e
 * mostra as que têm alguma coisa. As datas tiram-se juntas, como na ficha.
 */
export function alargamentos(filter: EventFilter, names: NomesDosFiltros): Alargamento[] {
  const lista: Alargamento[] = [];
  const sem = (chaves: FilterKey | readonly FilterKey[], rotulo: string) => {
    const fora = typeof chaves === 'string' ? [chaves] : chaves;
    const filtro: EventFilter = { ...filter, page: 1 };
    for (const chave of fora) filtro[chave] = undefined;
    lista.push({ rotulo, href: buildHref(filter, 1, chaves), filtro });
  };

  if (filter.from || filter.to) sem(['from', 'to'], 'Em qualquer data');
  if (filter.free) sem('free', 'Com ou sem entrada livre');
  if (filter.familia) sem('familia', 'Para qualquer público');
  for (const eixo of EIXOS_DE_ACESSIBILIDADE) {
    if (filter[eixo.chave]) sem(eixo.chave, `Sem o filtro «${eixo.rotulo}»`);
  }
  if (filter.category) sem('category', 'Em todas as categorias');
  if (filter.municipality) sem('municipality', 'Em todos os concelhos');
  if (filter.venue) sem('venue', 'Em todos os espaços');
  if (filter.series) {
    sem('series', `Fora do ciclo «${names.series[filter.series] ?? filter.series}»`);
  }
  if (filter.q) sem('q', `Sem a pesquisa «${filter.q}»`);
  return lista;
}

/**
 * Os três recortes de tempo que a agenda oferece num clique.
 *
 * A ordem é a da distância: hoje, o fim de semana, a semana. É também a ordem
 * pela qual as perguntas se fazem.
 */
export const ATALHOS = [
  { id: 'hoje', rotulo: 'Hoje', janela: janelaDeHoje },
  { id: 'fim-de-semana', rotulo: 'Este fim de semana', janela: janelaDoFimDeSemana },
  { id: 'semana', rotulo: 'Esta semana', janela: janelaDaSemana },
] as const satisfies readonly {
  id: string;
  rotulo: string;
  janela: (hoje: string) => JanelaDeDatas;
}[];

export type AtalhoId = (typeof ATALHOS)[number]['id'];

export interface AtalhoDeData {
  id: AtalhoId;
  rotulo: string;
  href: string;
  activo: boolean;
}

/**
 * Qual dos recortes está a valer, se algum.
 *
 * Compara-se o **valor** e não a proveniência: quem escreveu as duas datas à
 * mão nos campos e calhou no fim de semana vê o atalho aceso, e está certo —
 * é o mesmo recorte, e dizer-lhe que não era seria mentir sobre o que está a
 * ver.
 */
export function janelaActiva(filter: EventFilter, hoje: string): AtalhoId | null {
  for (const atalho of ATALHOS) {
    const janela = atalho.janela(hoje);
    if (filter.from === janela.from && filter.to === janela.to) return atalho.id;
  }
  return null;
}

/**
 * Os atalhos, já com endereço.
 *
 * Construídos com o `buildHref` da própria página, e não com um
 * `URLSearchParams` à parte: é o que faz o endereço sair **byte a byte igual**
 * ao canónico da vista a que leva, e o que preserva os filtros que já estavam
 * a valer — incluindo o `venue` e a `series`, que só existem como campos
 * escondidos e que um endereço escrito à mão deitaria fora sem ninguém
 * perceber porquê.
 */
export function atalhosDeData(filter: EventFilter, hoje: string): AtalhoDeData[] {
  const activo = janelaActiva(filter, hoje);
  return ATALHOS.map((atalho) => ({
    id: atalho.id,
    rotulo: atalho.rotulo,
    href: buildHref({ ...filter, ...atalho.janela(hoje) }, 1),
    activo: activo === atalho.id,
  }));
}

/** As datas escolhidas, por extenso — «a sábado, 5 de setembro», «de 5 a 12 set». */
export function descreverDatas(from?: string, to?: string, hoje?: string): string | null {
  if (from && to) {
    // Um recorte com nome diz o nome. «Agenda: a sexta-feira, 11 de setembro»
    // é a mesma vista que «Agenda: hoje», e a segunda é a que se lê.
    if (hoje) {
      const atalho = janelaActiva({ from, to } as EventFilter, hoje);
      if (atalho) return ATALHOS.find((item) => item.id === atalho)?.rotulo.toLowerCase() ?? null;
    }
    if (from === to) return `a ${formatWeekdayDate(from)}`;
    return `de ${formatShortDate(from)} a ${formatShortDate(to)}`;
  }
  if (from) return `a partir de ${formatWeekdayDate(from)}`;
  if (to) return `até ${formatWeekdayDate(to)}`;
  return null;
}

/**
 * A parte de `deixaIndexar` que não precisa de ir à base.
 *
 * Cada combinação de filtros é um endereço, e há mais combinações do que
 * eventos. As três primeiras regras estão explicadas em `deixaIndexar`; esta
 * quarta é das datas, e é a mais recente:
 *
 * **Um intervalo de datas não é uma vista estável.**
 * `/agenda?from=2026-09-11&to=2026-09-13` é um endereço novo por semana, para
 * sempre — e, pior, é um endereço que **passa a mentir**: indexado em setembro,
 * é servido em novembro com o título a prometer «de 11 a 13 set» e uma lista
 * vazia por baixo. A regra do total só o apanha depois de o fim de semana
 * passar e depois de o rastreador voltar, e desindexar é fácil mas voltar ao
 * índice é lento.
 *
 * Está aqui em separado, e antes da leitura, por uma razão prática: assim uma
 * vista com datas nem sequer chega a pedir o total à base.
 */
export function filtroIndexavel(filter: EventFilter): boolean {
  if (filter.q || filter.venue || filter.series) return false;
  if (filter.from || filter.to) return false;
  return true;
}

/** Uma ficha de filtro a valer: o que está a filtrar, e o endereço sem ele. */
export interface FichaDeFiltro {
  label: string;
  href: string;
}

/** Os nomes por trás dos identificadores do filtro. */
export interface NomesDosFiltros {
  municipalities: Record<string, string>;
  categories: Record<string, string>;
  venues: Record<string, string>;
  series: Record<string, string>;
}

/**
 * As fichas dos filtros a valer, por extenso.
 *
 * O identificador é traduzido para nome sempre que há por onde: um concelho,
 * uma categoria, um espaço e um ciclo têm nome, e «Espaço: cine-teatro-paraiso»
 * não é uma coisa que se ponha à frente de quem lê. Quando o nome não se
 * encontra — um espaço apagado, um ciclo que mudou de identificador — mostra-se
 * o que veio no endereço, que é melhor do que esconder um filtro a valer.
 *
 * `base` é o caminho a que a ficha volta sem o filtro: a agenda por omissão, o
 * mapa quando é o mapa que as mostra.
 */
export function fichasDosFiltros(
  filter: EventFilter,
  hoje: string,
  names: NomesDosFiltros,
  base: string = PATH,
): FichaDeFiltro[] {
  const fichas: FichaDeFiltro[] = [];
  const ficha = (key: FilterKey, label: string) =>
    fichas.push({ label, href: buildHref(filter, 1, key, base) });

  if (filter.q) ficha('q', `«${filter.q}»`);
  if (filter.municipality)
    ficha('municipality', names.municipalities[filter.municipality] ?? filter.municipality);
  if (filter.category) ficha('category', names.categories[filter.category] ?? filter.category);
  if (filter.venue) ficha('venue', names.venues[filter.venue] ?? filter.venue);
  if (filter.series) ficha('series', names.series[filter.series] ?? filter.series);
  /*
   * Um recorte com nome é uma ficha só, e larga-se inteiro.
   *
   * Sem isto, «Hoje» aparecia como «De 5 de setembro» **e** «Até 5 de
   * setembro» — duas fichas para um filtro, removíveis uma de cada vez e a
   * deixar meia janela para trás. E o contador do formulário dizia «2», o que
   * levava quem carregou num atalho a pensar que tinha escondido dois filtros
   * que não pôs.
   */
  const atalho = janelaActiva(filter, hoje);
  if (atalho) {
    fichas.push({
      label: ATALHOS.find((item) => item.id === atalho)?.rotulo ?? 'Datas',
      href: buildHref(filter, 1, ['from', 'to'], base),
    });
  } else {
    if (filter.from) ficha('from', `De ${formatLongDate(filter.from)}`);
    if (filter.to) ficha('to', `Até ${formatLongDate(filter.to)}`);
  }
  if (filter.free) ficha('free', 'Entrada livre');
  if (filter.familia) ficha('familia', FAMILIA.rotulo);
  for (const eixo of EIXOS_DE_ACESSIBILIDADE) {
    if (filter[eixo.chave]) ficha(eixo.chave, eixo.rotulo);
  }

  return fichas;
}
