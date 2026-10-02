import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { todayInLisbon } from '@coreto/core';
import { CapaDoEspaco } from '@/src/components/CapaDoEspaco';
import { EmptyState, quaisAgendasPorLer } from '@/src/components/EmptyState';
import { EventList } from '@/src/components/EventList';
import { FotografiaDoEspaco } from '@/src/components/FotografiaDoEspaco';
import { listFeedSessions } from '@/src/lib/feeds/data';
import { HowToArriveSection } from '@/src/components/HowToArriveSection';
import { NotaDiscreta } from '@/src/components/NotaDiscreta';
import { PageHeader } from '@/src/components/PageHeader';
import { Sinais, Sinal } from '@/src/components/Sinais';
import { PlaceStructuredData } from '@/src/components/StructuredData';
import { SITE_URL } from '@/src/lib/env';
import { perfilDoEspaco } from '@/src/lib/espaco';
import { fonteDaFotografia } from '@/src/lib/fotografia';
import { avaliarRecolha, leituraDoConcelho } from '@/src/lib/estado';
import { formatLongDate, formatVenueKind } from '@/src/lib/format';
import {
  eventosComAcessoDoEspaco,
  getVenueDetail,
  listCoretos,
  listEvents,
  withCardTimes,
  listMunicipalities,
  listPublicSources,
  listVenues,
} from '@/src/lib/queries/events';
import { exigirRegiao, planeadorDaRegiao } from '@/src/lib/queries/regioes';
import { migalhasDoEspaco } from '@/src/lib/migalhas';
import { seccaoLigada } from '@/src/lib/queries/seccoes';
import { urlDoSitio } from '@/src/lib/regiao';
import { sinaisDeAcessibilidade } from '@/src/lib/sinais';
import { telefones } from '@/src/lib/telefone';

export const revalidate = 3600;

interface Props {
  params: Promise<{ regiao: string; id: string }>;
}

/** Quantos eventos mostrar antes de remeter para a agenda filtrada. */
const EVENT_LIMIT = 24;

export async function generateStaticParams({
  params,
}: {
  params: { regiao: string };
}): Promise<Array<{ id: string }>> {
  const venues = await listVenues(params.regiao);
  return venues.map((venue) => ({ id: venue.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId, id } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const venue = await getVenueDetail(regiao.id, id);
  if (!venue) return { title: 'Espaço não encontrado', robots: { index: false, follow: true } };

  const municipalities = await listMunicipalities(regiao.id);
  const municipality = municipalities.find((item) => item.id === venue.municipality_id);
  const where = municipality ? ` em ${municipality.name}` : '';
  const description =
    venue.description ??
    `${formatVenueKind(venue.kind)}${where}. Programação, morada, contactos e acessibilidade.`;

  /*
   * O concelho no título, mas só quando o nome não o traz já.
   *
   * «Cine-Teatro Paraíso» não diz a ninguém — nem a um motor de busca — que
   * fica em Tomar, e há fichas em que o concelho não aparecia em sítio nenhum
   * que uma máquina leia. Mas metade do catálogo já tem a terra dentro do
   * nome, e a fórmula crua dava «Castelo de Torres Novas, Torres Novas».
   */
  const titulo =
    municipality && !venue.name.includes(municipality.name)
      ? `${venue.name}, ${municipality.name}`
      : venue.name;

  return {
    title: titulo,
    description,
    alternates: { canonical: `/espaco/${venue.id}` },
    openGraph: {
      type: 'website',
      title: titulo,
      description,
      url: `/espaco/${venue.id}`,
      locale: 'pt_PT',
      images: venue.image_url ? [{ url: venue.image_url, alt: venue.name }] : undefined,
    },
  };
}

export default async function VenuePage({ params }: Props) {
  const { regiao: regiaoId, id } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const venue = await getVenueDetail(regiao.id, id);
  if (!venue) notFound();

  const origem = urlDoSitio(regiao, SITE_URL);
  const today = todayInLisbon();
  const [municipalities, result, coretos, sources] = await Promise.all([
    listMunicipalities(regiao.id),
    listEvents(regiao.id, { venue: venue.id, page: 1, limit: EVENT_LIMIT }),
    listCoretos(regiao.id),
    listPublicSources(regiao.id),
  ]);
  // De que eventos o acesso a cadeiras de rodas é o deste espaço (C2-011).
  // E a hora de cada cartão, pela mesma leitura da agenda e da entrada: o
  // mesmo evento dizia «3 out · 10h30» na agenda e «3 out» aqui, e quem abre
  // a página do concelho ou do espaço tinha de abrir cada ficha (C2-002).
  const [acessoDoEspaco, eventos] = await Promise.all([
    eventosComAcessoDoEspaco(result.events),
    withCardTimes(result.events, today, listFeedSessions),
  ]);

  const [haCoretos, haFontes] = await Promise.all([
    seccaoLigada(regiao.id, 'coretos'),
    seccaoLigada(regiao.id, 'fontes'),
  ]);

  const municipality = municipalities.find((item) => item.id === venue.municipality_id) ?? null;
  const agendaHref = `/agenda?venue=${venue.id}`;
  const perfil = perfilDoEspaco(venue.kind, venue.is_association);

  const numeros = telefones(venue.phone);
  const temContactos =
    numeros.length > 0 || venue.email || venue.website_url || venue.ticketing_url;
  const acessibilidade = sinaisDeAcessibilidade(venue);

  // Um coreto do levantamento é a mesma pedra que a página dos coretos
  // apresenta. Quem chega aqui pela agenda pode não saber que há um
  // levantamento; quem chega de lá quer saber se há programação.
  const coreto = coretos.find((item) => item.venue_id === venue.id) ?? null;

  // A fonte que lê a programação deste espaço, quando é o próprio espaço que
  // a publica — o Cine-Teatro Paraíso, o Teatro Virgínia. Dizer de onde vem o
  // que está nesta página é o mesmo princípio da página das fontes, aplicado
  // à ficha.
  const fonteDoEspaco = sources.find((source) => source.is_enabled && source.venue_id === venue.id);
  /*
   * E se ela está a ser lida. A nota dizia «é lida todas as noites» em
   * qualquer caso — uma promessa de hora que a recolha não cumpre (corre uma
   * vez por dia, quando o GitHub a deixa) e uma afirmação que deixava de ser
   * verdade no dia em que a agenda do espaço deixasse de se ler. A mesma régua
   * da página do concelho: por ler, diz-se desde quando.
   */
  const leituraDoEspaco = fonteDoEspaco ? leituraDoConcelho(avaliarRecolha([fonteDoEspaco])) : null;
  const dominioDaFonte = (() => {
    if (!fonteDoEspaco?.url) return null;
    try {
      return new URL(fonteDoEspaco.url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  })();

  return (
    <>
      <PlaceStructuredData
        venue={venue}
        url={`${origem}/espaco/${venue.id}`}
        origem={origem}
        municipality={municipality ?? null}
      />

      <PageHeader
        migalhas={migalhasDoEspaco(venue, municipality)}
        title={venue.name}
        eyebrow={[formatVenueKind(venue.kind), venue.is_association ? 'Coletividade' : null]
          .filter((part): part is string => Boolean(part))
          .join(' · ')}
        lead={[venue.parish, municipality?.name]
          .filter((part): part is string => Boolean(part))
          .join(' · ')}
      />

      {/* A ficha afirma que o espaço existe só por estar publicada. Quando o
          levantamento dos coretos diz que não se confirmou que exista, é isso
          que se escreve — e escreve-se antes de tudo o resto.

          A dúvida vem de `coretos.is_confirmed` e não do `status` do espaço:
          `provisional` quer dizer que a ficha entrou por fonte secundária e
          não foi verificada no terreno, o que também é verdade do cineteatro
          de Abrantes, que existe, está aberto e tem programação. Pendurar
          aqui a dúvida no `status` era dizer ao leitor uma coisa falsa sobre
          cinco espaços para dizer uma verdadeira sobre três.

          **E a dúvida é sobre o coreto, não sobre o lugar que o alberga.**
          Esta ficha abria com «Este registo está por confirmar» no Jardim
          Municipal de Torres Novas — um jardim que existe, tem morada e tem
          fotografia verificada, e onde o que está por confirmar é o coreto.
          Quando o espaço não é ele próprio um coreto, diz-se o que é mesmo
          verdade. A mesma regra em `lib/coreto.ts` decide o selo em /espacos
          e na página do concelho. */}
      {coreto && !coreto.is_confirmed ? (
        venue.kind === 'bandstand' ? (
          <p className="mt-4 rounded border border-dashed border-border bg-surface px-4 py-3 text-sm">
            <span className="font-medium">Este registo está por confirmar.</span> Entrou no
            levantamento a partir de uma indicação que não conseguimos verificar. Se conhece o
            lugar,{' '}
            <Link href="/submeter" className="underline underline-offset-4">
              diga-nos o que sabe
            </Link>{' '}
            — é assim que a lista se corrige.
          </p>
        ) : (
          <p className="mt-4 rounded border border-dashed border-border bg-surface px-4 py-3 text-sm">
            <span className="font-medium">Há aqui um coreto por confirmar.</span> O levantamento
            aponta o {coreto.name} a este espaço a partir de uma indicação que não conseguimos
            verificar — a dúvida é sobre o coreto, e não sobre o lugar. Se conhece isto,{' '}
            <Link href="/submeter" className="underline underline-offset-4">
              diga-nos o que sabe
            </Link>
            .
          </p>
        )
      ) : null}

      {venue.is_association ? (
        <p className="mt-4 rounded border border-border border-l-4 border-l-accent bg-accent-soft px-4 py-3 text-sm">
          Uma coletividade da região — filarmónica, rancho, cineclube ou casa do povo. É programação
          feita por quem cá vive, e tem aqui o mesmo lugar que um cine-teatro municipal.
        </p>
      ) : null}

      {/*
        A fotografia, na medida do ecrã, e a capa do espaço por baixo dela.

        Era um `<img>` do endereço guardado, a 1600 píxeis pedidos ao Commons
        — que os arredonda para 1920: 1,5 MB para um ecrã de 360, a encher o
        primeiro ecrã com uma caixa vazia enquanto chegava (C3-005), e o ícone
        de imagem partida com o crédito por baixo quando não chegava (C1-016).
        Passa a pedir a medida que a caixa usa, servida pelo próprio sítio
        quando é do Commons (`lib/fotografia.ts`), e a capa fica sempre por
        baixo.

        A caixa tem medidas antes de a fotografia chegar — `aspect-ratio`, com
        tecto na secretária —, e por isso a página não salta quando ela chega.

        Sem fotografia nenhuma, a capa fica sozinha e mais baixa: diz o que o
        espaço é, e não ocupa o primeiro ecrã a dizê-lo.
      */}
      {venue.image_url ? (
        <FotografiaDoEspaco
          {...fonteDaFotografia(venue.image_url, [500, 960, 1280])}
          sizes="(min-width: 64rem) 62rem, 100vw"
          alt={`Fotografia de ${venue.name}`}
          credito={venue.image_credit}
        >
          <CapaDoEspaco kind={venue.kind} isAssociation={venue.is_association} />
        </FotografiaDoEspaco>
      ) : (
        <div className="relative mt-6 h-36 overflow-hidden rounded-lg border border-border sm:h-44">
          <CapaDoEspaco kind={venue.kind} isAssociation={venue.is_association} />
        </div>
      )}

      {venue.description ? <p className="mt-6 max-w-2xl text-lg">{venue.description}</p> : null}

      <section aria-labelledby="programacao" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="programacao" className="ct-heading">
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

        <div className="mt-4">
          {result.events.length > 0 ? (
            <EventList
              events={eventos}
              today={today}
              acessoDoEspaco={acessoDoEspaco}
              showMunicipality={false}
              dayHeadingLevel={3}
              idPrefix="espaco"
            />
          ) : (
            <EmptyState
              title={`Ainda não há nada marcado ${perfil.locativo}.`}
              action={{ href: '/submeter', label: 'Enviar um evento' }}
            />
          )}
        </div>
      </section>

      {/* De onde vem o que está aqui, dito a quem visita (C2-017): «lida em
          Cine-Teatro Paraíso» era a frase da equipa, e a promessa de «todas
          as noites» não era nossa. O endereço do sítio é o que quem lê
          reconhece, e a ligação deixa-o confirmar. */}
      {fonteDoEspaco && leituraDoEspaco?.tipo === 'por-ler' ? (
        // A mesma nota discreta da página do concelho (C1-022): estava na
        // cor das ligações, e lia-se como coisa que se carrega.
        <NotaDiscreta className="mt-4">
          Pode faltar programação. {quaisAgendasPorLer(leituraDoEspaco.fontes, formatLongDate)}
          {haFontes ? (
            <>
              {' '}
              <Link href="/fontes" className="text-ink underline underline-offset-4">
                Como lemos as agendas
              </Link>
              .
            </>
          ) : null}
        </NotaDiscreta>
      ) : fonteDoEspaco && leituraDoEspaco ? (
        <p className="mt-4 max-w-2xl text-sm text-muted">
          Lemos todos os dias a programação que o espaço publica
          {dominioDaFonte && fonteDoEspaco.url ? (
            <>
              {' '}
              em{' '}
              <a
                href={fonteDoEspaco.url}
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                {dominioDaFonte}
              </a>
            </>
          ) : null}
          .
          {haFontes ? (
            <>
              {' '}
              <Link href="/fontes" className="underline underline-offset-4">
                Como lemos as agendas
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : null}

      {/* Contactos e acessibilidade numa ficha só.
          Eram duas secções, e num coreto de jardim as duas estavam vazias:
          três títulos, dois deles a explicar o que não havia. Juntas, o que
          existe enche uma lista e o que falta ocupa uma linha — que é a
          proporção certa entre o espaço e as suas lacunas. */}
      <section aria-labelledby="ficha" className="mt-10">
        <h2 id="ficha" className="ct-heading">
          A ficha
        </h2>

        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {/* O horário vem primeiro e ocupa a largura toda, porque num museu,
              numa biblioteca ou num castelo é a primeira pergunta de quem vai
              — e porque não cabe numa linha: uma casa com época alta e baixa
              gasta três.

              A data anda sempre com ele. Um horário sem data afirma sobre hoje
              o que era verdade num dia que ninguém sabe qual é, e manda alguém
              a uma porta fechada com a nossa assinatura em baixo. A base de
              dados não deixa gravar um sem o outro; aqui mostram-se os dois. */}
          {venue.opening_hours ? (
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted">Horário</dt>
              <dd>
                {venue.opening_hours}
                {venue.opening_hours_checked_on ? (
                  // A data diz o que a segunda frase dizia: um horário lido
                  // há meses é um horário a confirmar, e quem lê a data
                  // percebe-o sem que se lho expliquem.
                  <span className="mt-1 block text-muted">
                    Lido na fonte oficial a {formatLongDate(venue.opening_hours_checked_on)}.
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}

          {numeros.length > 0 ? (
            <div>
              <dt className="text-sm text-muted">
                {numeros.length === 1 ? 'Telefone' : 'Telefones'}
              </dt>
              <dd className="flex flex-col">
                {numeros.map((numero) => (
                  <a
                    key={numero.href}
                    href={numero.href}
                    className="inline-flex min-h-11 items-center underline underline-offset-4 sm:min-h-0"
                  >
                    {numero.etiqueta}
                  </a>
                ))}
              </dd>
            </div>
          ) : null}

          {venue.email ? (
            <div>
              <dt className="text-sm text-muted">Email</dt>
              <dd className="break-words">
                <a
                  href={`mailto:${venue.email}`}
                  className="inline-flex min-h-11 items-center underline underline-offset-4 sm:min-h-0"
                >
                  {venue.email}
                </a>
              </dd>
            </div>
          ) : null}

          {venue.website_url ? (
            <div>
              <dt className="text-sm text-muted">Sítio</dt>
              <dd className="break-words">
                <a
                  href={venue.website_url}
                  rel="noopener nofollow"
                  className="inline-flex min-h-11 items-center underline underline-offset-4 sm:min-h-0"
                >
                  {venue.website_url.replace(/^https?:\/\//, '')}
                </a>
              </dd>
            </div>
          ) : null}

          {venue.ticketing_url ? (
            <div>
              <dt className="text-sm text-muted">Bilheteira</dt>
              <dd className="break-words">
                <a
                  href={venue.ticketing_url}
                  rel="noopener nofollow"
                  className="inline-flex min-h-11 items-center underline underline-offset-4 sm:min-h-0"
                >
                  Comprar bilhetes
                </a>
              </dd>
            </div>
          ) : null}

          {/*
            Marca ou nada. Sem informação, o que estava aqui era uma linha de
            tabela a explicar que a tabela estava vazia — em quase todos os
            espaços, porque quase nenhuma fonte municipal declara acessos.
          */}
          {acessibilidade.length > 0 || venue.accessibility_notes ? (
            <div className={venue.accessibility_notes ? 'sm:col-span-2' : undefined}>
              <dt className="text-sm text-muted">Acessibilidade</dt>
              <dd className="mt-1">
                {acessibilidade.length > 0 ? (
                  <Sinais>
                    {acessibilidade.map((sinal) => (
                      <Sinal
                        key={sinal.rotulo}
                        icone={sinal.icone}
                        rotulo={sinal.rotulo}
                        tom={sinal.tom}
                      >
                        {sinal.curto}
                      </Sinal>
                    ))}
                  </Sinais>
                ) : null}
                {venue.accessibility_notes ? (
                  <span className="mt-1 block text-muted">{venue.accessibility_notes}</span>
                ) : null}
              </dd>
            </div>
          ) : null}

          {!temContactos && perfil.temBalcao ? (
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted">Contactos</dt>
              <dd className="text-muted">
                Não temos telefone nem email deste espaço.{' '}
                <Link href="/submeter" className="underline underline-offset-4">
                  Se os souber, diga-nos
                </Link>
                .
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="como-chegar" className="mt-10">
        <h2 id="como-chegar" className="ct-heading">
          Como chegar
        </h2>
        <HowToArriveSection
          text={venue.how_to_arrive}
          placeName={null}
          // O nome não se imprime na morada — é o título da página — mas é ele
          // que abre a ficha do espaço no Google em vez de um alfinete.
          searchName={venue.name}
          address={[venue.address, venue.postal_code].filter(Boolean).join(', ') || null}
          parish={venue.parish}
          municipalityName={municipality?.name ?? null}
          latitude={venue.latitude}
          longitude={venue.longitude}
          planeador={await planeadorDaRegiao(regiao.id)}
        />
      </section>

      <p className="mt-10 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        {municipality ? (
          <Link
            href={`/concelho/${municipality.id}`}
            className="inline-flex min-h-11 items-center underline underline-offset-4 sm:min-h-0"
          >
            Ver tudo o que há em {municipality.name}
          </Link>
        ) : null}
        {coreto && haCoretos ? (
          <Link
            href="/coretos"
            className="inline-flex min-h-11 items-center underline underline-offset-4 sm:min-h-0"
          >
            Este coreto no levantamento da região
          </Link>
        ) : null}
      </p>
    </>
  );
}
