import type { Metadata } from 'next';
import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { todayInLisbon } from '@coreto/core';
import { EmptyState, avisoDeFontesPorLer, vazioDoConcelho } from '@/src/components/EmptyState';
import { EventList } from '@/src/components/EventList';
import { FilaDePilulas } from '@/src/components/FilaDePilulas';
import { FotografiaDeCartao } from '@/src/components/FotografiaDeCartao';
import { NotaDiscreta } from '@/src/components/NotaDiscreta';
import { BotaoDeSubscrever, ReceberNoCalendario } from '@/src/components/ReceberNoCalendario';
import { listFeedSessions } from '@/src/lib/feeds/data';
import { PageHeader } from '@/src/components/PageHeader';
import { MunicipalityStructuredData } from '@/src/components/StructuredData';
import { VenueCard } from '@/src/components/VenueCard';
import { ATALHOS, DEFAULTS, atalhosDeData } from '@/src/lib/agenda';
import { espacosPorConfirmar } from '@/src/lib/coreto';
import { ordenarEspacos } from '@/src/lib/espaco';
import { avaliarRecolha, leituraDoConcelho } from '@/src/lib/estado';
import { formatLongDate } from '@/src/lib/format';
import { enderecos } from '@/src/lib/enderecos';
import { SITE_URL } from '@/src/lib/env';
import { enderecosDoCalendario } from '@/src/lib/subscrever';
import {
  countEventsByVenue,
  eventosComAcessoDoEspaco,
  fontesDoConcelhoOuNada,
  listCoretos,
  listEvents,
  withCardTimes,
  listMunicipalities,
  listVenues,
} from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { migalhasDoConcelho } from '@/src/lib/migalhas';
import { seccaoLigada } from '@/src/lib/queries/seccoes';
import type { Municipality } from '@/src/lib/queries/types';
import { deNome, emNome, urlDoSitio } from '@/src/lib/regiao';

export const revalidate = 3600;

interface Props {
  params: Promise<{ regiao: string; id: string }>;
}

/** Quantos eventos mostrar antes de remeter para a agenda filtrada. */
const EVENT_LIMIT = 24;

/**
 * O `id` do endereço só é usado depois de bater certo com um concelho da
 * região do pedido. É validação por lista fechada — mais apertada do que
 * qualquer schema, porque o conjunto de valores válidos é conhecido e
 * pequeno — e é também o guarda regional: um concelho de outra CIM não está
 * nesta lista, logo é 404.
 */
async function findMunicipality(regiaoId: string, id: string): Promise<Municipality | null> {
  const municipalities = await listMunicipalities(regiaoId);
  return municipalities.find((municipality) => municipality.id === id) ?? null;
}

/**
 * Os três recortes de tempo do concelho — «Hoje», «Este fim de semana»,
 * «Próximos 7 dias» —, já filtrados por ele, e só os que levam a alguma coisa.
 *
 * A página do concelho não tinha um único endereço para a agenda filtrada
 * (C2-019): quem a abria para saber o que há no sábado lia a lista corrida até
 * dezembro, ou ia à agenda e voltava a escolher o concelho. Os endereços saem
 * do `atalhosDeData` da própria agenda, para serem o canónico dela byte a byte
 * — e não uma cadeia escrita à mão aqui que um dia diverge.
 *
 * Contam-se antes de se oferecerem, como os da entrada: numa terça-feira sem
 * nada marcado, «Hoje» levava a uma lista vazia, que é a promessa que a casa
 * já tirou da rua. Uma linha por recorte (`limit: 1`), em cache como as
 * outras leituras da página.
 */
async function atalhosDoConcelho(regiaoId: string, concelhoId: string, hoje: string) {
  const filtro = { ...DEFAULTS, municipality: concelhoId };
  const atalhos = atalhosDeData(filtro, hoje);
  const totais = await Promise.all(
    ATALHOS.map(async (atalho) => {
      const { total } = await listEvents(regiaoId, {
        ...filtro,
        ...atalho.janela(hoje),
        page: 1,
        limit: 1,
      });
      return total;
    }),
  );
  return atalhos
    .map((atalho, indice) => ({ ...atalho, quantos: totais[indice] ?? 0 }))
    .filter((atalho) => atalho.quantos > 0);
}

/** Uma parte da linha dos números: o numeral e o que ele conta. */
interface Contagem {
  chave: string;
  numero: number;
  texto: string;
}

export async function generateStaticParams({
  params,
}: {
  params: { regiao: string };
}): Promise<Array<{ id: string }>> {
  const municipalities = await listMunicipalities(params.regiao);
  return municipalities.map((municipality) => ({ id: municipality.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId, id } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const origem = urlDoSitio(regiao, SITE_URL);
  const municipality = await findMunicipality(regiao.id, id);
  if (!municipality) return { title: 'Concelho não encontrado' };

  return {
    // «Tomar» sozinho não é um título de página: é uma palavra. O que a página
    // responde é «o que há para fazer em Tomar», e é essa a pergunta que
    // alguém escreve num motor de busca. O sufixo «· Coreto» vem do modelo do
    // layout.
    title: `Agenda cultural ${deNome(municipality.name, municipality.article)}`,
    description: `O que há para fazer ${emNome(municipality.name, municipality.article)}: concertos, teatro, exposições, festas, cinema e visitas. Espaços, coretos e feeds do concelho.`,
    // Os feeds são os do concelho e não os globais, e é por isso que esta
    // página passa os seus ao ajudante em vez de aceitar os de omissão. O
    // caminho vai por extenso: um `./` resolvia contra o caminho interno
    // (`/<regiao>/concelho/…`) nas páginas pré-geradas.
    alternates: enderecos(origem, `/concelho/${municipality.id}`, {
      'application/rss+xml': `${origem}/feed/${municipality.id}.xml`,
      'text/calendar': `${origem}/agenda/${municipality.id}.ics`,
    }),
  };
}

export default async function MunicipalityPage({ params }: Props) {
  const { regiao: regiaoId, id } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const municipality = await findMunicipality(regiao.id, id);
  if (!municipality) notFound();

  const origem = urlDoSitio(regiao, SITE_URL);
  const today = todayInLisbon();
  const [result, venues, coretos, venueCounts, sources, atalhos] = await Promise.all([
    listEvents(regiao.id, { municipality: municipality.id, page: 1, limit: EVENT_LIMIT }),
    listVenues(regiao.id, municipality.id),
    listCoretos(regiao.id),
    countEventsByVenue(regiao.id),
    fontesDoConcelhoOuNada(regiao.id),
    atalhosDoConcelho(regiao.id, municipality.id, today),
  ]);
  // De que eventos o acesso a cadeiras de rodas é o do espaço (C2-011).
  // E a hora de cada cartão, pela mesma leitura da agenda e da entrada: o
  // mesmo evento dizia «3 out · 10h30» na agenda e «3 out» aqui, e quem abre
  // a página do concelho ou do espaço tinha de abrir cada ficha (C2-002).
  const [acessoDoEspaco, eventos] = await Promise.all([
    eventosComAcessoDoEspaco(result.events),
    withCardTimes(result.events, today, listFeedSessions),
  ]);

  const localCoretos = coretos.filter((coreto) => coreto.municipality_id === municipality.id);

  // A mesma regra da lista dos espaços — agora a sério, e da mesma função.
  // Estava aqui uma cópia que só olhava para `is_confirmed`, e por isso punha
  // o selo da dúvida no Jardim Municipal de Torres Novas, que existe.
  const porConfirmar = espacosPorConfirmar(coretos, venues);

  // A mesma ordem da lista dos espaços: os que têm alguma coisa marcada
  // primeiro, e as coletividades à frente em cada grupo — as razões, e a de não
  // ordenar pela contagem, estão em `ordenarEspacos`.
  const orderedVenues = ordenarEspacos(venues, venueCounts);

  /*
   * As fontes deste concelho — e `null` quando não se conseguiu saber.
   *
   * **A leitura passou a degradar, ao contrário do que estava escrito.** A
   * `listPublicSources` propaga de propósito, e a razão continua boa para a
   * `/fontes`, que é a página delas. Aqui não: o assunto desta página é a
   * agenda, que já veio. O receio que a decisão antiga travava era o `[]` —
   * uma lista vazia por engano fazia esta página dizer «ainda não há aqui uma
   * agenda que possamos ler» sobre concelhos cuja câmara publica há anos. O
   * `null` desarma esse receio: não produz frase nenhuma, produz «não sei», e
   * as duas frases abaixo já sabem dizê-lo. Entre um 500 numa página cuja
   * agenda está lida e uma página que serve a agenda e confessa o que não
   * confirmou, é a segunda que presta contas.
   */
  const doConcelho =
    sources?.filter((source) => source.municipality_id === municipality.id) ?? null;
  const leitura = leituraDoConcelho(doConcelho ? avaliarRecolha(doConcelho) : null);
  const avisoDasFontes = avisoDeFontesPorLer(leitura, formatLongDate);
  // A lista que se mostra é só das ligadas: uma fonte desligada é uma decisão
  // de quem administra, não uma origem desta agenda. A saúde acima já as
  // ignora pela mesma razão, na `avaliarRecolha`.
  const localSources = doConcelho?.filter((source) => source.is_enabled) ?? null;
  const venueNames: Record<string, string> = Object.fromEntries(
    venues.map((venue) => [venue.id, venue.name]),
  );
  const agendaHref = `/agenda?municipality=${municipality.id}`;
  const [haCoretos, haFontes] = await Promise.all([
    seccaoLigada(regiao.id, 'coretos'),
    seccaoLigada(regiao.id, 'fontes'),
  ]);

  /*
   * A linha dos números, contados e não escritos: «13 eventos marcados · 22
   * espaços · 5 coretos». Era um título e uma frase, e quem chegava não sabia
   * se o concelho tinha três coisas ou trezentas antes de rolar a página
   * inteira (C1-021). Um zero não se escreve — o vazio de cada secção já se
   * explica lá em baixo, e «0 coretos» à cabeça da página de um concelho
   * pequeno era a frase que a casa existe para não dizer.
   *
   * Os coretos por confirmar contam-se à parte. Somados aos confirmados,
   * a linha afirmava sete coretos onde se sabe de cinco.
   */
  const coretosConfirmados = localCoretos.filter((coreto) => coreto.is_confirmed).length;
  const coretosPorConfirmar = localCoretos.length - coretosConfirmados;
  const contagens: Contagem[] = [];
  if (result.total > 0) {
    contagens.push({
      chave: 'eventos',
      numero: result.total,
      texto: result.total === 1 ? 'evento marcado' : 'eventos marcados',
    });
  }
  if (venues.length > 0) {
    contagens.push({
      chave: 'espacos',
      numero: venues.length,
      texto: venues.length === 1 ? 'espaço' : 'espaços',
    });
  }
  if (haCoretos && coretosConfirmados > 0) {
    const plural = coretosConfirmados === 1 ? 'coreto' : 'coretos';
    contagens.push({
      chave: 'coretos',
      numero: coretosConfirmados,
      texto: coretosPorConfirmar > 0 ? `${plural}, e ${coretosPorConfirmar} por confirmar` : plural,
    });
  } else if (haCoretos && coretosPorConfirmar > 0) {
    contagens.push({
      chave: 'coretos',
      numero: coretosPorConfirmar,
      texto: coretosPorConfirmar === 1 ? 'coreto por confirmar' : 'coretos por confirmar',
    });
  }

  const calendario = enderecosDoCalendario(origem, `/agenda/${municipality.id}.ics`);

  return (
    <>
      <MunicipalityStructuredData
        municipality={municipality}
        url={`${origem}/concelho/${municipality.id}`}
        origem={origem}
        events={result.events}
      />

      {/* A sobrancelha dizia «Concelho», e a migalha diz «Coreto › Mapa ›» —
          que é a mesma coisa, com o caminho de volta a mais. Ficam as
          migalhas.

          O cabeçalho é o da página que uma câmara mostra e liga do seu sítio
          (C1-021): o nome à escala de cartaz, o que lá há contado, a pergunta
          do fim de semana já respondida (C2-019) e a agenda do concelho para
          levar no calendário — subscrita, e não descarregada (C2-033). */}
      <PageHeader
        migalhas={migalhasDoConcelho(municipality)}
        title={municipality.name}
        grande
        lead={
          regiao.promotor
            ? `Concelho do distrito de ${municipality.district}, ${emNome(regiao.promotor.nome, regiao.promotor.artigo)}.`
            : `Concelho do distrito de ${municipality.district}.`
        }
      >
        {contagens.length > 0 ? (
          <p className="mt-4 text-muted">
            {contagens.map((contagem, indice) => (
              <Fragment key={contagem.chave}>
                {indice > 0 ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="sr-only">, </span>
                  </>
                ) : null}
                <span className="ct-numeral text-[1.375rem] leading-none text-ink">
                  {contagem.numero}
                </span>{' '}
                {contagem.texto}
              </Fragment>
            ))}
          </p>
        ) : null}

        <FilaDePilulas
          nome="Atalhos de data"
          rotulo="Quando"
          destaque
          className="mt-4"
          pilulas={atalhos.map((atalho) => ({
            chave: atalho.id,
            rotulo: atalho.rotulo,
            href: atalho.href,
            activa: false,
            quantos: atalho.quantos,
          }))}
        />

        {/* Também num concelho sem nada marcado: uma subscrição é do que vier,
            e é a forma de saber quando passar a haver sem ter de voltar aqui
            a ver. */}
        <p className="ct-sem-impressao mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <BotaoDeSubscrever nome={municipality.name} enderecos={calendario} />
          <a
            href="#levar"
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Outras formas de a receber
          </a>
        </p>
      </PageHeader>

      <section aria-labelledby="proximos" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="proximos" className="ct-heading">
            Próximos eventos
          </h2>
          {result.total > result.events.length ? (
            <Link
              href={agendaHref}
              className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
            >
              Ver os {result.total} eventos
            </Link>
          ) : null}
        </div>

        {/*
          A ressalva vai ANTES da lista, e não depois.
          -------------------------------------------------------------------
          Quem chega a esta secção lê os primeiros eventos e forma uma ideia
          ali mesmo; uma nota no fim chega tarde a quem já concluiu que são
          aqueles. Só aparece quando há fontes por ler — ver
          `avisoDeFontesPorLer`.
        */}
        {result.events.length > 0 && avisoDasFontes ? (
          <NotaDiscreta className="mt-3">
            {avisoDasFontes}
            {haFontes ? (
              <>
                {' '}
                <Link href="/fontes" className="text-ink underline underline-offset-4">
                  Saber mais
                </Link>
              </>
            ) : null}
          </NotaDiscreta>
        ) : null}

        <div className="mt-4">
          {result.events.length > 0 ? (
            <EventList
              events={eventos}
              today={today}
              venueNames={venueNames}
              acessoDoEspaco={acessoDoEspaco}
              showMunicipality={false}
              dayHeadingLevel={3}
              idPrefix="concelho"
            />
          ) : (
            <EmptyState
              {...vazioDoConcelho(municipality.name, leitura, formatLongDate, municipality.article)}
              action={{ href: '/submeter', label: 'Enviar um evento' }}
            />
          )}
        </div>
      </section>

      {/*
        Levar esta agenda, logo a seguir à lista — e não no fim da página,
        depois dos espaços e dos coretos, onde estava (C1-021). É o argumento
        da página para uma câmara, e quem o procura não o encontrava.

        O calendário vem primeiro e é uma subscrição (C2-033): era uma ligação
        chamada «Calendário iCal», que no telemóvel descarregava uma cópia do
        dia que nunca mais se atualizava.
      */}
      <section aria-labelledby="levar" className="ct-sem-impressao mt-12 scroll-mt-6">
        <h2 id="levar" className="ct-heading">
          Levar esta agenda
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          A programação {deNome(municipality.name, municipality.article)} sai daqui em formato
          aberto — para o calendário do telemóvel, para o sítio da câmara, para um leitor de
          notícias, e para a porta do café.
        </p>

        <h3 className="mt-5 font-semibold">No calendário</h3>
        <div className="mt-2">
          <ReceberNoCalendario
            nome={municipality.name}
            enderecos={calendario}
            caminho={`/agenda/${municipality.id}.ics`}
          />
        </div>

        <h3 className="mt-6 font-semibold">Noutros sítios</h3>
        <ul className="mt-2 space-y-2">
          <li>
            {/* Sem o `?municipality=`, que ninguém lia. O construtor não olha
                para a barra de endereços — `ConstrutorDeWidget` não tem
                `useSearchParams` — e o parâmetro andava aqui há muito a
                prometer uma pré-selecção que nunca aconteceu. Mandar para a
                âncora do construtor é o que se pode cumprir. */}
            <Link
              href="/levar#construtor"
              className="inline-flex min-h-11 items-center underline underline-offset-4 sm:min-h-0"
            >
              A caixa para colar no sítio da câmara
            </Link>
          </li>
          <li>
            <a
              href={`/feed/${municipality.id}.xml`}
              className="inline-flex min-h-11 items-center underline underline-offset-4 sm:min-h-0"
            >
              O feed RSS {deNome(municipality.name, municipality.article)}, para um leitor de
              notícias
            </a>
          </li>
        </ul>

        {/* Em papel (C2-032, C4-022): é o que uma junta ou uma biblioteca
            podem fazer sem sítio nenhum, e era o que faltava. */}
        <h3 className="mt-6 font-semibold">Em papel</h3>
        <p className="mt-2">
          <Link
            href={`/cartaz-semanal/${municipality.id}`}
            prefetch={false}
            className="inline-flex min-h-11 items-center underline underline-offset-4 sm:min-h-0"
          >
            O cartaz desta semana, numa folha A4 para imprimir e afixar
          </Link>
        </p>
      </section>

      <section aria-labelledby="espacos" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="espacos" className="ct-heading">
            Espaços
          </h2>
          <Link
            href="/espacos"
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Os espaços da região
          </Link>
        </div>

        {orderedVenues.length > 0 ? (
          <ul className="@container mt-4 grid gap-3 sm:auto-rows-fr sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {orderedVenues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                count={venueCounts[venue.id] ?? 0}
                porConfirmar={porConfirmar.has(venue.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">Ainda não há espaços registados neste concelho.</p>
        )}
      </section>

      {/* Os coretos do concelho são a montra local do levantamento da região.
          Com a secção desligada não há levantamento a que pertençam, e a
          secção sai inteira em vez de ficar sem o sítio para onde aponta. */}
      {haCoretos ? (
        <section aria-labelledby="coretos" className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="coretos" className="ct-heading">
              Coretos
            </h2>
            <Link
              href="/coretos"
              className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
            >
              O levantamento da região
            </Link>
          </div>

          {localCoretos.length > 0 ? (
            <ul className="@container mt-4 grid gap-3 sm:auto-rows-fr sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {localCoretos.map((coreto) => (
                <li
                  key={coreto.id}
                  className={`flex h-full overflow-hidden rounded-lg border bg-surface @max-[17rem]:flex-col sm:flex-col ${
                    coreto.is_confirmed ? 'border-border' : 'border-dashed border-border'
                  }`}
                >
                  {/* A mesma moldura dos espaços: a fotografia em fundo, servida
                      sem cookies de terceiros, e a capa por baixo quando falha
                      — era um `<img>`, e falhava com o ícone partido (C1-016). */}
                  <FotografiaDeCartao
                    url={coreto.photo_url}
                    kind="bandstand"
                    isAssociation={false}
                    semRotulo
                  />
                  <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-3.5">
                    <p className="font-medium leading-snug">{coreto.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {[coreto.parish, coreto.year_built ? `de ${coreto.year_built}` : null]
                        .filter((part) => part !== null)
                        .join(' · ')}
                    </p>
                    {!coreto.is_confirmed ? (
                      <p className="mt-auto pt-2 text-sm font-semibold text-muted">Por confirmar</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted">
              Ainda não há coretos registados em {municipality.name}.{' '}
              <Link href="/coretos" className="underline underline-offset-4">
                Ver o mapa da região
              </Link>
            </p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="de-onde" className="mt-12">
        <h2 id="de-onde" className="ct-heading">
          De onde vem esta programação
        </h2>

        {/*
          Três ramos e não dois: «não há fontes» e «não sei que fontes há» não
          se dizem com a mesma frase. O terceiro é novo, e é o que a leitura
          degradante trouxe — ver o comentário da `localSources` lá em cima.
        */}
        {localSources === null ? (
          <p className="mt-3 max-w-2xl text-muted">
            Não conseguimos confirmar, neste momento, de onde vem a programação de{' '}
            {municipality.name}. O que está acima foi lido; isto é o que não se conseguiu verificar
            agora.
          </p>
        ) : localSources.length > 0 ? (
          <>
            <ul className="mt-3 space-y-2">
              {localSources.map((source) => (
                <li key={source.id} className="flex gap-2.5">
                  <span aria-hidden="true" className="ct-octagon mt-2 size-2 shrink-0 bg-accent" />
                  <span>
                    <span className="font-medium">{source.name}</span>
                    {source.public_note ? (
                      <span className="text-muted"> — {source.public_note}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {/*
             * Em dias e não em noites: o cron do `scrape.yml` está às 03:20
             * UTC, mas a fila do GitHub atrasa-o horas — medido às 07:58,
             * 08:26, 10:11 e 15:28. A cadência cumpre-se; a hora não.
             */}
            <p className="mt-3 max-w-2xl text-sm text-muted">
              Lida uma vez por dia. O que não estiver publicado nestas fontes só chega aqui se
              alguém o enviar
              {haFontes ? (
                <>
                  {' '}
                  —{' '}
                  <Link href="/fontes" className="underline underline-offset-4">
                    as regras da recolha estão explicadas
                  </Link>
                </>
              ) : null}
              .
            </p>
          </>
        ) : (
          <p className="mt-3 max-w-2xl text-muted">
            Ainda não há aqui uma agenda que possamos ler todos os dias, e por isso o que aparece de{' '}
            {municipality.name} é o que nos enviam ou o que chega pela programação em rede da
            região.
            {haFontes ? (
              <>
                {' '}
                <Link href="/fontes" className="underline underline-offset-4">
                  A situação de cada concelho está aqui
                </Link>
                .
              </>
            ) : null}
          </p>
        )}
      </section>
    </>
  );
}
