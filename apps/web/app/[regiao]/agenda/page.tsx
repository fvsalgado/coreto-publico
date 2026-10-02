import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { todayInLisbon, type EventFilter } from '@coreto/core';
import { ActiveFilters } from '@/src/components/ActiveFilters';
import { CaixaDePesquisa } from '@/src/components/CaixaDePesquisa';
import { EmptyState } from '@/src/components/EmptyState';
import { EventList } from '@/src/components/EventList';
import { FilaDePilulas } from '@/src/components/FilaDePilulas';
import { FilterBar } from '@/src/components/FilterBar';
import { PageHeader } from '@/src/components/PageHeader';
import { Pagination } from '@/src/components/Pagination';
import { ListagemStructuredData } from '@/src/components/StructuredData';
import { VistaDaAgenda } from '@/src/components/VistaDaAgenda';
import {
  contarEixosDaAgenda,
  contarFacetas,
  eventosComAcessoDoEspaco,
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
import {
  PATH,
  PATH_DO_MAPA,
  atalhosDeData,
  buildHref,
  concelhosSemEventos,
  eixosDoFormulario,
  fichasDosFiltros,
  filtroIndexavel,
  nomesDosEixos,
  pilulasDeFaceta,
  readFilter,
  temCamposVazios,
  type SearchParams,
} from '@/src/lib/agenda';
import { descreverFiltro, saidasDoVazio, type PropostaDoVazio } from '@/src/lib/agenda-servidor';
import { urlDoSitio, type Regiao } from '@/src/lib/regiao';
import { formatCategory } from '@/src/lib/format';

interface Props {
  params: Promise<{ regiao: string }>;
  searchParams: Promise<SearchParams>;
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
  const description = await descreverFiltro(regiao, filter, hoje);

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

export default async function AgendaPage({ params, searchParams }: Props) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const pedidos = await searchParams;
  const filter = readFilter(pedidos);
  // Os campos vazios que o formulário GET submete saem do endereço (C2-037).
  if (temCamposVazios(pedidos)) redirect(buildHref(filter, filter.page));
  const today = todayInLisbon();

  const [result, municipalities, categories, venueNames, series, facetas, eixosDaAgenda] =
    await Promise.all([
      listEvents(regiao.id, filter),
      listMunicipalities(regiao.id),
      listCategories(),
      // Sem concelho no filtro, os nomes de espaço vêm todos: é o que permite
      // dar nome ao espaço filtrado mesmo quando o concelho não está escolhido.
      listVenueNames(regiao.id, filter.municipality),
      listSeries(regiao.id),
      // Os números das pílulas. Sem base, ou acima do tecto, vêm a `null` e as
      // pílulas saem sem número — nunca com um número errado.
      contarFacetas(regiao.id, filter),
      // Os eixos da acessibilidade na agenda inteira, para dizer o que nenhum
      // evento declara em vez de esconder a caixa calado (C2-010).
      contarEixosDaAgenda(regiao.id),
    ]);

  // A hora de cada cartão, na mesma leitura de sessões que a API pública faz
  // para esta mesma página. As regras — e a razão de não ser coluna do cartão
  // — estão em `withCardTimes`. E, ao lado, de que eventos o acesso a cadeiras
  // de rodas é o do espaço, para o cartão o dizer (C2-011).
  /*
   * As horas leem-se a partir do primeiro dia da janela, e não de hoje: num
   * recorte de dias que já passaram, o cartão diz a que horas foi; num de fim
   * de semana, o evento entra pelo dia da sessão que lá cai.
   */
  const inicio = filter.from ?? today;
  const [events, acessoDoEspaco] = await Promise.all([
    withCardTimes(result.events, inicio, listFeedSessions),
    eventosComAcessoDoEspaco(result.events),
  ]);
  // Uma ligação partilhada para um fim de semana que já passou mostrava o que
  // lá aconteceu como estando a acontecer (C2-016). Diz-se que passou.
  const janelaPassada = Boolean(filter.to && filter.to < today);

  const municipalityNames: Record<string, string> = Object.fromEntries(
    municipalities.map((municipality) => [municipality.id, municipality.name]),
  );

  const nomes = {
    municipalities: municipalityNames,
    categories: Object.fromEntries(categories.map((category) => [category.slug, category.name])),
    venues: venueNames,
    series: Object.fromEntries(series.map((item) => [item.id, item.name])),
  };
  const fichas = fichasDosFiltros(filter, today, nomes);

  const descricao = await descreverFiltro(regiao, filter, today);
  const atalhos = atalhosDeData(filter, today);

  /*
   * As três filas de pílulas: quando, onde, o quê.
   *
   * Por esta ordem porque é a ordem das perguntas. O concelho só se oferece
   * quando há por onde escolher — numa região de um concelho a fila dizia uma
   * coisa só. As categorias saem pela ordem da taxonomia, e as vazias caem
   * quando há contagem (ver `pilulasDeFaceta`).
   */
  const opcoesDeConcelho = municipalities.map((municipality) => ({
    valor: municipality.id,
    rotulo: municipality.name,
  }));
  const pilulasDeConcelho =
    municipalities.length > 1
      ? pilulasDeFaceta(filter, 'municipality', opcoesDeConcelho, facetas.municipality)
      : [];
  const concelhosAZero =
    municipalities.length > 1
      ? concelhosSemEventos(filter, opcoesDeConcelho, facetas.municipality)
      : [];
  const pilulasDeCategoria = pilulasDeFaceta(
    filter,
    'category',
    categories.map((category) => ({ valor: category.slug, rotulo: category.name })),
    facetas.category,
  );
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

  /*
   * Os eixos pedidos que nenhum evento da agenda inteira declara (C2-010).
   * Com `?lgp=1` e nenhuma sessão com Língua Gestual Portuguesa, o vazio
   * respondia «não temos eventos com estes filtros» a quem fez uma pergunta
   * de sim ou não — a resposta é «não há nenhum, por agora», e di-lo.
   */
  const pedidosSemNenhum = eixosDoFormulario(
    filter,
    facetas.acessibilidade,
    eixosDaAgenda,
  ).nenhumNaAgenda.filter((eixo) => filter[eixo.chave]);

  // Por onde sair de uma lista vazia — contado, e só quando está vazia.
  const saidas =
    result.total === 0 ? await saidasDoVazio(regiao, filter, nomes, facetas.municipality) : null;
  const propostas: PropostaDoVazio[] = saidas
    ? [
        ...(saidas.proximoDia ? [saidas.proximoDia] : []),
        ...saidas.alargar,
        ...saidas.outrosConcelhos.map((proposta) => ({
          ...proposta,
          rotulo: `Em ${proposta.rotulo}`,
        })),
      ]
    : [];

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
          fora e cai numa lista já recortada sem saber por quê. Sem filtros
          não há parágrafo nenhum: o que se quer ver primeiro é a programação,
          e a frase sobre os filtros passou para dentro do formulário. */}
      <PageHeader
        title="Agenda"
        eyebrow="A programação"
        compacto
        lead={descricao.rotulo ? `A mostrar: ${descricao.rotulo}.` : undefined}
        lado={
          <VistaDaAgenda
            vista="lista"
            hrefLista={buildHref(filter, 1)}
            hrefMapa={buildHref(filter, 1, undefined, PATH_DO_MAPA)}
          />
        }
      />

      {/* A pesquisa à vista, antes de tudo: é o atalho de quem já sabe o que
          quer, e estava atrás da gaveta dos filtros (C3-020). */}
      <CaixaDePesquisa filter={filter} alvoDaLupa className="mb-3 max-w-xl" />

      {/* Fora do recolhível de propósito: são ligações, funcionam sem
          JavaScript, e um atalho atrás de uma gaveta é um campo de formulário
          com outro nome. Quando, onde, o quê — três filas, cada uma na sua
          linha e com o nome à esquerda (C1-027): eram vinte e cinco pílulas
          iguais, e a partir do tablet as três embrulhavam umas nas outras sem
          nada que dissesse onde acabava o tempo e começava o lugar. No
          telemóvel cada uma desliza; a partir do tablet embrulha na sua linha.
          O tempo vem em destaque, porque é a pergunta mais comum, e cada
          categoria leva o ponto da cor da sua família — a legenda das cores
          dos cartões, que não existia em lado nenhum (C1-007). */}
      <div className="space-y-2">
        <FilaDePilulas
          nome="Atalhos de data"
          rotulo="Quando"
          destaque
          pilulas={atalhos.map((atalho) => ({
            chave: atalho.id,
            rotulo: atalho.rotulo,
            href: atalho.href,
            activa: atalho.activo,
          }))}
        />
        {/* Oito à vista e o resto atrás de um «Mais», nas duas filas que
            passam de nove — os concelhos de uma região grande e as catorze
            categorias (Selo 3.1, `primeiroNivel`). */}
        <FilaDePilulas
          nome="Concelhos"
          rotulo="Onde"
          maximo={8}
          pilulas={pilulasDeConcelho.map((pilula) => ({ ...pilula, chave: pilula.valor }))}
          semEventos={concelhosAZero.map((concelho) => ({ ...concelho, chave: concelho.valor }))}
        />
        <FilaDePilulas
          nome="Categorias"
          rotulo="O quê"
          maximo={8}
          pilulas={pilulasDeCategoria.map((pilula) => ({
            ...pilula,
            chave: pilula.valor,
            ponto: formatCategory(pilula.valor)?.dot,
          }))}
        />
      </div>

      <div className="mt-4">
        <FilterBar
          filter={filter}
          municipalities={municipalities}
          categories={categories}
          action={PATH}
          activeCount={fichas.length}
          eixosDeAcessibilidade={facetas.acessibilidade}
          eixosDaAgenda={eixosDaAgenda}
          total={result.total}
        />
      </div>

      <ActiveFilters filters={fichas} clearHref={PATH} />

      {/* A zero, a frase só se ouve: o vazio por baixo diz o mesmo à vista, e
          dizê-lo duas vezes seguidas era o eco que o C2-008 apontou. */}
      <p role="status" className={result.total === 0 ? 'sr-only' : 'mt-3 text-sm text-muted'}>
        {summary}
        {totalPages > 1 ? ` A mostrar a página ${filter.page} de ${totalPages}.` : ''}
      </p>

      {janelaPassada && events.length > 0 ? (
        <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <strong className="font-semibold">Estas datas já passaram.</strong> O que está aqui é o
          que houve, e não o que vem aí —{' '}
          <Link
            href={buildHref(filter, 1, ['from', 'to'])}
            className="underline underline-offset-4"
          >
            ver o que vem aí
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-4">
        {events.length > 0 ? (
          <EventList
            events={events}
            today={today}
            inicio={inicio}
            janelaPassada={janelaPassada}
            municipalityNames={municipalityNames}
            venueNames={venueNames}
            acessoDoEspaco={acessoDoEspaco}
            showMunicipality={!filter.municipality}
            dayHeadingLevel={2}
            idPrefix="agenda"
          />
        ) : (
          /*
           * O vazio responde com o que existe (C2-008): o dia mais próximo
           * com eventos, o que se pode tirar ao filtro e quantos aparecem, os
           * outros concelhos onde a mesma procura dá — e, num concelho cuja
           * agenda não se lê, que pode haver o que não chegou aqui. O «Enviar
           * um evento» era o único botão, para quem programa; fica em texto,
           * por baixo, para quem organiza.
           */
          <EmptyState
            title={
              pedidosSemNenhum.length > 0
                ? `Por agora, nenhum evento desta agenda declara ${nomesDosEixos(pedidosSemNenhum)}.`
                : filter.q && fichas.length === 1
                  ? `Não encontrámos «${filter.q}» nos próximos eventos.`
                  : 'Não temos eventos com estes filtros.'
            }
            description={saidas?.avisoDoConcelho ?? undefined}
            secundaria={
              pedidosSemNenhum.length > 0
                ? {
                    texto: 'Se organiza um,',
                    href: '/submeter',
                    label: 'diga-nos',
                    depois: '— aparece aqui.',
                  }
                : { texto: 'Organiza alguma coisa?', href: '/submeter', label: 'Envie-nos.' }
            }
          >
            {propostas.length > 0 ? (
              <ul aria-label="Por onde continuar" className="mx-auto mt-5 max-w-md space-y-1">
                {propostas.map((proposta) => (
                  <li key={proposta.href}>
                    <Link
                      href={proposta.href}
                      className="inline-flex min-h-11 items-center gap-2 font-medium"
                    >
                      <span className="underline underline-offset-4">{proposta.rotulo}</span>
                      <span className="text-sm font-normal text-muted">
                        — {proposta.quantos === 1 ? '1 evento' : `${proposta.quantos} eventos`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </EmptyState>
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
