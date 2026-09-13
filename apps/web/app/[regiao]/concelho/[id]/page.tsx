import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { todayInLisbon } from '@coreto/core';
import { BandstandMark } from '@/src/components/BandstandMark';
import { EmptyState } from '@/src/components/EmptyState';
import { EventList } from '@/src/components/EventList';
import { PageHeader } from '@/src/components/PageHeader';
import { MunicipalityStructuredData } from '@/src/components/StructuredData';
import { VenueCard } from '@/src/components/VenueCard';
import { espacosPorConfirmar } from '@/src/lib/coreto';
import { enderecos } from '@/src/lib/enderecos';
import { SITE_URL } from '@/src/lib/env';
import {
  countEventsByVenue,
  listCoretos,
  listEvents,
  listMunicipalities,
  listPublicSources,
  listVenues,
} from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { migalhasDoConcelho } from '@/src/lib/migalhas';
import { seccaoLigada } from '@/src/lib/queries/seccoes';
import type { Municipality } from '@/src/lib/queries/types';
import { urlDoSitio } from '@/src/lib/regiao';

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
    title: `Agenda cultural de ${municipality.name}`,
    description: `O que há para fazer em ${municipality.name}: concertos, teatro, exposições, festas, cinema e visitas. Espaços, coretos e feeds do concelho.`,
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
  const [result, venues, coretos, venueCounts, sources] = await Promise.all([
    listEvents(regiao.id, { municipality: municipality.id, page: 1, limit: EVENT_LIMIT }),
    listVenues(regiao.id, municipality.id),
    listCoretos(regiao.id),
    countEventsByVenue(regiao.id),
    listPublicSources(regiao.id),
  ]);

  const localCoretos = coretos.filter((coreto) => coreto.municipality_id === municipality.id);

  // A mesma regra da lista dos espaços — agora a sério, e da mesma função.
  // Estava aqui uma cópia que só olhava para `is_confirmed`, e por isso punha
  // o selo da dúvida no Jardim Municipal de Torres Novas, que existe.
  const porConfirmar = espacosPorConfirmar(coretos, venues);

  // As coletividades primeiro: são elas que sustentam metade da programação
  // desta região e as que costumam ficar em último em toda a parte.
  const orderedVenues = venues
    .slice()
    .sort(
      (a, b) =>
        Number(b.is_association) - Number(a.is_association) ||
        (venueCounts[b.id] ?? 0) - (venueCounts[a.id] ?? 0) ||
        a.name.localeCompare(b.name, 'pt'),
    );

  const localSources = sources.filter(
    (source) => source.is_enabled && source.municipality_id === municipality.id,
  );
  const venueNames: Record<string, string> = Object.fromEntries(
    venues.map((venue) => [venue.id, venue.name]),
  );
  const agendaHref = `/agenda?municipality=${municipality.id}`;
  const [haCoretos, haFontes] = await Promise.all([
    seccaoLigada(regiao.id, 'coretos'),
    seccaoLigada(regiao.id, 'fontes'),
  ]);

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
          migalhas. */}
      <PageHeader
        migalhas={migalhasDoConcelho(municipality)}
        title={municipality.name}
        lead={
          regiao.promotor
            ? `Concelho do distrito de ${municipality.district}, na ${regiao.promotor.nome}.`
            : `Concelho do distrito de ${municipality.district}.`
        }
      />

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

        <div className="mt-4">
          {result.events.length > 0 ? (
            <EventList
              events={result.events}
              today={today}
              venueNames={venueNames}
              showMunicipality={false}
              dayHeadingLevel={3}
              idPrefix="concelho"
            />
          ) : (
            <EmptyState
              title={`Ainda não há programação publicada em ${municipality.name}.`}
              description="O concelho continua aqui, à espera. Quem organiza — câmara, coletividade, associação ou junta — pode enviar o que se prepara e fica na agenda da região."
              action={{ href: '/submeter', label: 'Enviar um evento' }}
            />
          )}
        </div>
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
          <ul className="mt-4 grid gap-3 sm:auto-rows-fr sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
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
            <ul className="mt-4 grid gap-3 sm:auto-rows-fr sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {localCoretos.map((coreto) => (
                <li
                  key={coreto.id}
                  className={`flex h-full overflow-hidden rounded-lg border bg-surface sm:flex-col ${
                    coreto.is_confirmed ? 'border-border' : 'border-dashed border-border'
                  }`}
                >
                  <div className="ct-grain relative aspect-square w-24 shrink-0 self-stretch overflow-hidden border-r border-border bg-accent-soft sm:aspect-[5/3] sm:w-full sm:border-r-0 sm:border-b">
                    {coreto.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coreto.photo_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BandstandMark className="absolute inset-0 m-auto size-10 text-ink opacity-[0.12] sm:size-14" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-3.5">
                    <p className="font-medium leading-snug">{coreto.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {[coreto.parish, coreto.year_built ? `de ${coreto.year_built}` : null]
                        .filter((part) => part !== null)
                        .join(' · ')}
                    </p>
                    {!coreto.is_confirmed ? (
                      <p className="mt-auto pt-2 text-xs font-semibold tracking-wide text-muted uppercase">
                        Por confirmar
                      </p>
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

        {localSources.length > 0 ? (
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

      <section aria-labelledby="levar" className="mt-12">
        <h2 id="levar" className="ct-heading">
          Levar esta agenda
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          A programação de {municipality.name} sai daqui em formato aberto — para o sítio da câmara,
          para o calendário do telemóvel ou para um leitor de notícias.
        </p>

        <ul className="mt-4 space-y-2">
          <li>
            <a
              href={`/feed/${municipality.id}.xml`}
              className="inline-flex min-h-11 items-center underline underline-offset-4 sm:min-h-0"
            >
              Feed RSS de {municipality.name}
            </a>
          </li>
          <li>
            <a
              href={`/agenda/${municipality.id}.ics`}
              className="inline-flex min-h-11 items-center underline underline-offset-4 sm:min-h-0"
            >
              Calendário iCal de {municipality.name}
            </a>
          </li>
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
              Widget para embeber num sítio
            </Link>
          </li>
        </ul>
      </section>
    </>
  );
}
