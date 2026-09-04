import type { Metadata } from 'next';
import { eventFilterSchema, todayInLisbon, type EventFilter } from '@coreto/core';
import { ActiveFilters, type ActiveFilter } from '@/src/components/ActiveFilters';
import { EmptyState } from '@/src/components/EmptyState';
import { EventList } from '@/src/components/EventList';
import { FilterBar } from '@/src/components/FilterBar';
import { PageHeader } from '@/src/components/PageHeader';
import { Pagination } from '@/src/components/Pagination';
import { ListagemStructuredData } from '@/src/components/StructuredData';
import {
  listCategories,
  listEvents,
  listMunicipalities,
  listSeries,
  listVenueNames,
} from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { enderecos } from '@/src/lib/enderecos';
import { SITE_URL } from '@/src/lib/env';
import { formatLongDate, formatShortDate, formatWeekdayDate } from '@/src/lib/format';
import { urlDoSitio, type Regiao } from '@/src/lib/regiao';

type SearchParams = Record<string, string | string[] | undefined>;

interface Props {
  params: Promise<{ regiao: string }>;
  searchParams: Promise<SearchParams>;
}

const PATH = '/agenda';

/** Os defaults do schema, para não repetir números mágicos por aqui. */
const DEFAULTS = eventFilterSchema.parse({});

const FILTER_KEYS = [
  'municipality',
  'category',
  'from',
  'to',
  'free',
  'accessible',
  'venue',
  'series',
  'q',
  'page',
  'limit',
] as const;

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
function readFilter(searchParams: SearchParams): EventFilter {
  const raw: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = firstValue(searchParams[key])?.trim();
    if (value) raw[key] = value;
  }

  const parsed = eventFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULTS;
}

/** Os campos que se mostram como fichas removíveis. `page` e `limit` não são filtros. */
type FilterKey =
  'q' | 'from' | 'to' | 'municipality' | 'category' | 'venue' | 'series' | 'free' | 'accessible';

/**
 * Reconstrói o endereço a partir dos filtros já validados — nunca do que veio
 * em bruto.
 *
 * `omit` tira um filtro e leva de volta à primeira página: quem larga o
 * concelho estava na página 3 de uma lista que agora tem trinta, e cair num
 * «sem resultados» que é só uma página vazia seria dar-lhe a entender que
 * alargar o filtro tirou eventos.
 */
function buildHref(filter: EventFilter, page: number, omit?: FilterKey): string {
  const params = new URLSearchParams();
  const keep = (key: FilterKey): boolean => key !== omit;

  if (filter.q && keep('q')) params.set('q', filter.q);
  if (filter.from && keep('from')) params.set('from', filter.from);
  if (filter.to && keep('to')) params.set('to', filter.to);
  if (filter.municipality && keep('municipality')) params.set('municipality', filter.municipality);
  if (filter.category && keep('category')) params.set('category', filter.category);
  if (filter.venue && keep('venue')) params.set('venue', filter.venue);
  if (filter.series && keep('series')) params.set('series', filter.series);
  if (filter.free && keep('free')) params.set('free', '1');
  if (filter.accessible && keep('accessible')) params.set('accessible', '1');
  if (filter.limit !== DEFAULTS.limit) params.set('limit', String(filter.limit));
  if (page > 1) params.set('page', String(page));

  const query = params.toString();
  return query ? `${PATH}?${query}` : PATH;
}

/** As datas escolhidas, por extenso — «a sábado, 5 de setembro», «de 5 a 12 set». */
function descreverDatas(from?: string, to?: string): string | null {
  if (from && to) {
    if (from === to) return `a ${formatWeekdayDate(from)}`;
    return `de ${formatShortDate(from)} a ${formatShortDate(to)}`;
  }
  if (from) return `a partir de ${formatWeekdayDate(from)}`;
  if (to) return `até ${formatWeekdayDate(to)}`;
  return null;
}

interface Descricao {
  /** Curto, para o título do separador e o cabeçalho da página. */
  rotulo: string;
  /** Uma frase inteira, para a descrição que vai para os motores de busca. */
  frase: string;
}

/**
 * Os filtros activos por extenso — em duas medidas, e não numa.
 *
 * Havia uma cadeia só a servir o título e a descrição, e daí saíam frases como
 * «Eventos Música em Ourém nos onze concelhos do Médio Tejo», que diz uma
 * coisa e o contrário dela. E o intervalo de datas não entrava em nenhuma das
 * duas: a agenda de um fim-de-semana anunciava-se como a agenda inteira, sem
 * dizer de que dias falava — no título, na descrição e no cabeçalho da página.
 */
async function describeFilter(regiao: Regiao, filter: EventFilter): Promise<Descricao> {
  const [municipalities, categories] = await Promise.all([
    listMunicipalities(regiao.id),
    listCategories(),
  ]);
  const municipality = municipalities.find((item) => item.id === filter.municipality);
  const category = categories.find((item) => item.slug === filter.category);
  const datas = descreverDatas(filter.from, filter.to);

  const partes: string[] = [];
  if (category) partes.push(category.name);
  if (municipality) partes.push(`em ${municipality.name}`);
  if (filter.free) partes.push('com entrada livre');
  if (filter.accessible) partes.push('com acesso a cadeiras de rodas');
  if (filter.q) partes.push(`sobre «${filter.q}»`);

  // As datas ficam para o fim e atrás de uma vírgula: «Música em Tomar, a
  // partir de domingo» lê-se; sem a vírgula, os dois complementos colam-se.
  const semDatas = partes.join(' ');
  const rotulo = datas ? (semDatas ? `${semDatas}, ${datas}` : datas) : semDatas;
  // «nos onze concelhos» só quando não há concelho escolhido: com um escolhido,
  // a frase estaria a dizer que é em Ourém e nos onze ao mesmo tempo.
  const onde =
    municipality || regiao.concelhosDeclarados === 0
      ? ''
      : ` nos ${regiao.concelhosPorExtenso} concelhos ${regiao.doNome}`;
  return { rotulo, frase: rotulo ? `Eventos ${rotulo}${onde}.` : '' };
}

/**
 * O que se deixa indexar de uma agenda com filtros.
 *
 * Cada combinação de filtros é um endereço, e há mais combinações do que
 * eventos: um espaço por cada ficha de espaço, um concelho por cada página de
 * concelho, mais datas, categorias e caixas. Deixá-los todos indexáveis é
 * encher um motor de busca de páginas que dizem a mesma coisa — e as melhores
 * já existem, com nome próprio.
 *
 * Três regras, e cada uma tem um porquê diferente:
 *
 * - **Uma pesquisa por texto** gera endereços sem fim que ninguém procurou.
 * - **Um filtro por espaço ou por ciclo** duplica `/espaco/<id>` e
 *   `/ciclo/<id>`, que são páginas próprias, com contexto e com dados
 *   estruturados. A agenda filtrada é a versão pobre da mesma coisa.
 * - **Uma lista vazia** não é uma página: é um filtro que não deu nada.
 *   Acontece com um concelho ou uma categoria inventados no endereço, e
 *   também com um intervalo de datas já passado. Continua a responder 200 a
 *   quem lá chegar — o `EmptyState` explica-se e dá por onde sair —, mas não
 *   se oferece a quem indexa.
 *
 * Fica de fora desta lista a paginação: um `noindex` mantido acaba tratado
 * como `nofollow`, e é pela paginação que se chega ao fundo da agenda.
 *
 * **A terceira regra depende de um total, e um total pode estar errado.** Este
 * era o irmão silencioso do defeito das leituras em cache: `listEvents`
 * devolvia `total: 0` quando a consulta errava, e daqui saía `noindex` — uma
 * falha de segundos desindexava a página mais importante do sítio, com o
 * `noindex` guardado uma hora pelo ISR e o motor de busca a lê-lo entretanto.
 * Desindexar é fácil e voltar ao índice é lento; não é uma decisão para se
 * tomar sobre um número que não se sabe se é verdade.
 *
 * Desde `queries/falhas.ts` esse número já não mente: ou é o total, ou não há
 * número nenhum porque `listEvents` lançou. E é de propósito que o erro passa
 * por aqui sem ser apanhado — a página responde 500, que nenhum motor de busca
 * interpreta como instrução, e o ISR não guarda 500. Um erro é uma coisa que
 * se repete daqui a pouco; um `noindex` é uma coisa que se acredita.
 */
async function deixaIndexar(regiao: Regiao, filter: EventFilter): Promise<boolean> {
  if (filter.q || filter.venue || filter.series) return false;
  const { total } = await listEvents(regiao.id, filter);
  return total > 0;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const origem = urlDoSitio(regiao, SITE_URL);
  const filter = readFilter(await searchParams);
  const description = await describeFilter(regiao, filter);

  return {
    title: description.rotulo ? `Agenda: ${description.rotulo}` : 'Agenda',
    description:
      description.frase ||
      `Todos os eventos dos ${regiao.concelhosPorExtenso} concelhos ${regiao.doNome}, com filtros por data, categoria, concelho, entrada livre e acessibilidade.`,
    // O canónico sai do filtro já validado, e não do endereço tal como veio:
    // assim os campos vazios, o `page=1` e um `limit` escrito à mão colapsam
    // todos no mesmo endereço.
    alternates: enderecos(origem, buildHref(filter, filter.page)),
    robots: (await deixaIndexar(regiao, filter)) ? undefined : { index: false, follow: true },
  };
}

/**
 * As fichas dos filtros a valer, por extenso.
 *
 * O identificador é traduzido para nome sempre que há por onde: um concelho,
 * uma categoria, um espaço e um ciclo têm nome, e «Espaço: cine-teatro-paraiso»
 * não é uma coisa que se ponha à frente de quem lê. Quando o nome não se
 * encontra — um espaço apagado, um ciclo que mudou de identificador — mostra-se
 * o que veio no endereço, que é melhor do que esconder um filtro a valer.
 */
function activeFilters(
  filter: EventFilter,
  names: {
    municipalities: Record<string, string>;
    categories: Record<string, string>;
    venues: Record<string, string>;
    series: Record<string, string>;
  },
): ActiveFilter[] {
  const fichas: ActiveFilter[] = [];
  const ficha = (key: FilterKey, label: string) =>
    fichas.push({ label, href: buildHref(filter, 1, key) });

  if (filter.q) ficha('q', `«${filter.q}»`);
  if (filter.municipality)
    ficha('municipality', names.municipalities[filter.municipality] ?? filter.municipality);
  if (filter.category) ficha('category', names.categories[filter.category] ?? filter.category);
  if (filter.venue) ficha('venue', names.venues[filter.venue] ?? filter.venue);
  if (filter.series) ficha('series', names.series[filter.series] ?? filter.series);
  if (filter.from) ficha('from', `De ${formatLongDate(filter.from)}`);
  if (filter.to) ficha('to', `Até ${formatLongDate(filter.to)}`);
  if (filter.free) ficha('free', 'Entrada livre');
  if (filter.accessible) ficha('accessible', 'Acesso a cadeiras de rodas');

  return fichas;
}

export default async function AgendaPage({ params, searchParams }: Props) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const filter = readFilter(await searchParams);
  const today = todayInLisbon();

  const [result, municipalities, categories, venueNames, series] = await Promise.all([
    listEvents(regiao.id, filter),
    listMunicipalities(regiao.id),
    listCategories(),
    // Sem concelho no filtro, os nomes de espaço vêm todos: é o que permite
    // dar nome ao espaço filtrado mesmo quando o concelho não está escolhido.
    listVenueNames(regiao.id, filter.municipality),
    listSeries(regiao.id),
  ]);

  const municipalityNames: Record<string, string> = Object.fromEntries(
    municipalities.map((municipality) => [municipality.id, municipality.name]),
  );

  const fichas = activeFilters(filter, {
    municipalities: municipalityNames,
    categories: Object.fromEntries(categories.map((category) => [category.slug, category.name])),
    venues: venueNames,
    series: Object.fromEntries(series.map((item) => [item.id, item.name])),
  });

  const descricao = await describeFilter(regiao, filter);
  const totalPages = Math.max(1, Math.ceil(result.total / filter.limit));
  const origem = urlDoSitio(regiao, SITE_URL);

  /*
   * A lista dita à máquina — e só na vista que se indexa.
   *
   * `deixaIndexar` é a mesma condição do `robots` dos metadados, e é
   * deliberado partilhá-la: uma vista filtrada leva `noindex` e o seu canónico
   * é a agenda inteira, por isso publicar aqui uma `CollectionPage` com o
   * endereço canónico descrevia a agenda toda com o conteúdo de uma frincha —
   * vinte eventos de uma categoria a fazerem-se passar pela lista completa.
   * Onde não se indexa, não se afirma.
   */
  const indexavel = await deixaIndexar(regiao, filter);

  const summary =
    result.total === 0
      ? 'Nenhum evento corresponde a estes filtros.'
      : result.total === 1
        ? '1 evento encontrado.'
        : `${result.total} eventos encontrados.`;

  return (
    <>
      {indexavel ? (
        <ListagemStructuredData
          nome="Agenda"
          descricao={`A programação dos ${regiao.concelhosPorExtenso} concelhos ${regiao.doNome}.`}
          url={`${origem}${PATH}`}
          origem={origem}
          total={result.total}
          itens={result.events.map((evento) => ({
            nome: evento.title,
            url: `${origem}/evento/${evento.slug}`,
          }))}
          trilha={[
            { href: '/', label: 'Coreto' },
            { href: PATH, label: 'Agenda' },
          ]}
        />
      ) : null}

      {/* Com filtros a valer, o cabeçalho diz quais — a mesma frase que vai
          para o título do separador. As fichas por baixo dão-nos um a um e
          deixam tirá-los; isto é a leitura de conjunto, para quem chega de
          fora e cai numa lista já recortada sem saber por quê. */}
      <PageHeader
        title="Agenda"
        eyebrow="A programação"
        lead={
          descricao.rotulo
            ? `A mostrar: ${descricao.rotulo}. Cada filtro é uma ligação — dá para guardar nos favoritos e para partilhar tal como está.`
            : `A programação dos ${regiao.concelhosPorExtenso} concelhos ${regiao.doNome}. Cada filtro é uma ligação — dá para guardar nos favoritos e para partilhar tal como está.`
        }
      />

      <FilterBar
        filter={filter}
        municipalities={municipalities}
        categories={categories}
        action={PATH}
        activeCount={fichas.length}
      />

      <ActiveFilters filters={fichas} clearHref={PATH} />

      <p role="status" className="mt-5 text-sm text-muted">
        {summary}
        {totalPages > 1 ? ` A mostrar a página ${filter.page} de ${totalPages}.` : ''}
      </p>

      <div className="mt-4">
        {result.events.length > 0 ? (
          <EventList
            events={result.events}
            today={today}
            municipalityNames={municipalityNames}
            venueNames={venueNames}
            showMunicipality={!filter.municipality}
            dayHeadingLevel={2}
            idPrefix="agenda"
          />
        ) : (
          <EmptyState
            title="Sem resultados para estes filtros."
            description="Alargue o intervalo de datas ou limpe alguns filtros."
            action={{ href: '/submeter', label: 'Enviar um evento' }}
          />
        )}
      </div>

      <Pagination
        page={filter.page}
        totalPages={totalPages}
        previousHref={filter.page > 1 ? buildHref(filter, filter.page - 1) : null}
        nextHref={filter.page < totalPages ? buildHref(filter, filter.page + 1) : null}
      />
    </>
  );
}
