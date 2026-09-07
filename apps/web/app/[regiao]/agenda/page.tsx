import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { todayInLisbon, type EventFilter } from '@coreto/core';
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
  withCardTimes,
} from '@/src/lib/queries/events';
import { listFeedSessions } from '@/src/lib/feeds/data';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { enderecos } from '@/src/lib/enderecos';
import { SITE_URL } from '@/src/lib/env';
import { formatLongDate } from '@/src/lib/format';
import {
  ATALHOS,
  PATH,
  atalhosDeData,
  buildHref,
  descreverDatas,
  filtroIndexavel,
  janelaActiva,
  readFilter,
  type FilterKey,
  type SearchParams,
} from '@/src/lib/agenda';
import { urlDoSitio, type Regiao } from '@/src/lib/regiao';

interface Props {
  params: Promise<{ regiao: string }>;
  searchParams: Promise<SearchParams>;
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
async function describeFilter(
  regiao: Regiao,
  filter: EventFilter,
  hoje: string,
): Promise<Descricao> {
  const [municipalities, categories] = await Promise.all([
    listMunicipalities(regiao.id),
    listCategories(),
  ]);
  const municipality = municipalities.find((item) => item.id === filter.municipality);
  const category = categories.find((item) => item.slug === filter.category);
  const datas = descreverDatas(filter.from, filter.to, hoje);

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
  if (!filtroIndexavel(filter)) return false;
  const { total } = await listEvents(regiao.id, filter);
  return total > 0;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const origem = urlDoSitio(regiao, SITE_URL);
  const filter = readFilter(await searchParams);
  const hoje = todayInLisbon();
  const description = await describeFilter(regiao, filter, hoje);

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
  hoje: string,
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
      href: buildHref(filter, 1, ['from', 'to']),
    });
  } else {
    if (filter.from) ficha('from', `De ${formatLongDate(filter.from)}`);
    if (filter.to) ficha('to', `Até ${formatLongDate(filter.to)}`);
  }
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

  // A hora de cada cartão, na mesma leitura de sessões que a API pública faz
  // para esta mesma página. As regras — e a razão de não ser coluna do cartão
  // — estão em `withCardTimes`.
  const events = await withCardTimes(result.events, today, listFeedSessions);

  const municipalityNames: Record<string, string> = Object.fromEntries(
    municipalities.map((municipality) => [municipality.id, municipality.name]),
  );

  const fichas = activeFilters(filter, today, {
    municipalities: municipalityNames,
    categories: Object.fromEntries(categories.map((category) => [category.slug, category.name])),
    venues: venueNames,
    series: Object.fromEntries(series.map((item) => [item.id, item.name])),
  });

  const descricao = await describeFilter(regiao, filter, today);
  const atalhos = atalhosDeData(filter, today);
  const totalPages = Math.max(1, Math.ceil(result.total / filter.limit));
  const origem = urlDoSitio(regiao, SITE_URL);

  /*
   * **Uma página além do fim não existe, e a resposta certa é dizê-lo.**
   *
   * `/agenda?page=99` numa agenda com três páginas respondia 500 — o
   * PostgREST recusava o intervalo e o erro subia até à fronteira. A camada
   * de consultas já não o transforma em avaria (`ehPaginaAlemDoFim`, em
   * `queries/falhas.ts`) e devolve a lista vazia com o total verdadeiro; o
   * que sobra é o que esta página deve fazer com ela.
   *
   * 404 e não uma agenda vazia com «Sem resultados para estes filtros»: essa
   * frase aconselha a alargar as datas, e alargar as datas não faz aparecer
   * uma página 99. Um endereço que não existe responde que não existe, e o
   * rastreador que o construiu sozinho a partir da paginação para de o
   * pedir. A página 1 nunca é 404, mesmo a zero: uma agenda vazia é um estado
   * legítimo e tem texto próprio.
   */
  if (filter.page > 1 && filter.page > totalPages) notFound();

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

  /*
   * E só quando não há recorte nenhum a valer.
   *
   * `deixaIndexar` deixa passar o concelho, a categoria e as caixas, por isso
   * `indexavel` sozinho não chegava: `/agenda?category=musica` publicava uma
   * `CollectionPage` com o endereço da agenda inteira — `url` vira `@id` — e
   * vinte eventos de música lá dentro. É a mesma falha que o comentário acima
   * diz estar a evitar, por uma porta que ele não cobria.
   */
  const afirmaAListaInteira = indexavel && fichas.length === 0;

  const summary =
    result.total === 0
      ? 'Nenhum evento corresponde a estes filtros.'
      : result.total === 1
        ? '1 evento encontrado.'
        : `${result.total} eventos encontrados.`;

  return (
    <>
      {afirmaAListaInteira ? (
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

      {/* Fora do recolhível de propósito: no telemóvel o formulário está
          fechado por omissão e sem JavaScript, e um atalho atrás de uma gaveta
          é um campo de formulário com outro nome. São três fichas numa linha,
          não os dois ecrãs de formulário que o recolhível existe para poupar. */}
      <nav aria-label="Atalhos de data" className="mt-5">
        <ul className="flex flex-wrap gap-2">
          {atalhos.map((atalho) => (
            <li key={atalho.id}>
              <Link
                href={atalho.href}
                aria-current={atalho.activo ? 'page' : undefined}
                className={
                  atalho.activo
                    ? 'inline-flex min-h-11 items-center rounded-full border border-accent bg-accent-soft px-4 text-sm font-semibold text-accent'
                    : 'inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium hover:border-accent/40'
                }
              >
                {atalho.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

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
        {events.length > 0 ? (
          <EventList
            events={events}
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
