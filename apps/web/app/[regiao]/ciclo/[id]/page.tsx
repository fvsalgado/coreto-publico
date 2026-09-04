import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { todayInLisbon } from '@coreto/core';
import { Capa } from '@/src/components/Capa';
import { EmptyState } from '@/src/components/EmptyState';
import { PageHeader } from '@/src/components/PageHeader';
import { edicoesDoCiclo } from '@/src/lib/ciclo';
import { SITE_URL } from '@/src/lib/env';
import { urlDoSitio } from '@/src/lib/regiao';
import { formatCategory, formatEventDates, formatSeriesKind } from '@/src/lib/format';
import {
  countEventsBySeries,
  listMunicipalities,
  listSeries,
  listSeriesEvents,
  listVenueNames,
} from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { migalhasDoCiclo } from '@/src/lib/migalhas';
import { exigirSeccao } from '@/src/lib/queries/seccoes';
import type { SeriesEvent } from '@/src/lib/queries/types';

export const revalidate = 3600;

interface Props {
  params: Promise<{ regiao: string; id: string }>;
}

export async function generateStaticParams({
  params,
}: {
  params: { regiao: string };
}): Promise<Array<{ id: string }>> {
  // Só os ciclos que já têm programação registada. Os outros existem na mesma
  // e a página abre a pedido — o que não se faz é gerar dez páginas iguais a
  // dizer que ainda não há nada.
  const counts = await countEventsBySeries(params.regiao);
  return Object.keys(counts).map((id) => ({ id }));
}

/**
 * O ciclo, mas só se for desta região. `listSeries` já filtra por
 * `region_id`, e é esse filtro que faz de guarda: um endereço de ciclo do
 * Médio Tejo aberto no domínio de outra CIM não encontra nada — 404.
 */
async function findSeries(regiaoId: string, id: string) {
  const series = await listSeries(regiaoId);
  return series.find((item) => item.id === id) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId, id } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const cycle = await findSeries(regiao.id, id);
  if (!cycle) return { title: 'Ciclo não encontrado', robots: { index: false, follow: true } };

  const origem = urlDoSitio(regiao, SITE_URL);
  const description =
    cycle.description ??
    `${formatSeriesKind(cycle.kind)} ${regiao.noNome}: o programa, edição a edição.`;

  return {
    title: cycle.name,
    description,
    alternates: { canonical: `${origem}/ciclo/${cycle.id}` },
    openGraph: { title: cycle.name, description, url: `${origem}/ciclo/${cycle.id}` },
  };
}

/**
 * Um evento de um ciclo, no cartão que ele pode ter.
 *
 * Não é o `EventCard` da agenda, e a diferença é toda numa linha: o que já
 * passou não tem ficha no Coreto — o arquivo é legível, mas não é navegável —
 * e por isso o título leva à página oficial de onde o evento veio. Quem ainda
 * está por acontecer leva à sua ficha, como em todo o lado.
 */
function CartaoDoCiclo({
  event,
  today,
  municipalityName,
  venueName,
}: {
  event: SeriesEvent;
  today: string;
  municipalityName: string | null;
  venueName: string | null;
}) {
  const category = formatCategory(event.category_slug);
  const where = venueName ?? event.location_name;
  const past = event.status !== 'published';
  const href = past ? event.source_url : `/evento/${event.slug}`;

  return (
    <article className="ct-lift relative flex gap-4 rounded-lg border border-border bg-surface p-3 sm:p-4">
      <Capa event={event} today={today} className="w-21 shrink-0 self-start sm:w-27" />

      <div className="min-w-0 flex-1 py-0.5">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
          <time dateTime={event.date_start ?? undefined} className="font-medium text-highlight">
            {formatEventDates(event.date_start, event.date_end, today)}
          </time>
          {category ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`ct-octagon size-2 ${category.dot}`} />
              {category.label}
            </span>
          ) : null}
        </p>

        <h3 className="font-display mt-1 text-lg leading-snug font-semibold sm:text-xl">
          {href ? (
            <Link
              href={href}
              className="underline-offset-4 hover:underline after:absolute after:inset-0 after:content-['']"
              {...(past ? { target: '_blank', rel: 'noreferrer' } : {})}
            >
              {event.title}
              {past ? (
                <span className="sr-only"> (abre a página oficial noutro separador)</span>
              ) : null}
            </Link>
          ) : (
            event.title
          )}
        </h3>

        {where || municipalityName ? (
          <p className="mt-1 text-sm text-muted">
            {[where, municipalityName !== where ? municipalityName : null]
              .filter((part): part is string => Boolean(part))
              .join(' · ')}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default async function CicloPage({ params }: Props) {
  const { regiao: regiaoId, id } = await params;
  const regiao = await exigirRegiao(regiaoId);

  // Desligada no painel, esta página não existe. O guarda vem antes de
  // qualquer leitura: não vale a pena ir à base buscar o que não se mostra.
  await exigirSeccao(regiao.id, 'ciclos');

  const [cycle, events, municipalities, venueNames] = await Promise.all([
    findSeries(regiao.id, id),
    listSeriesEvents(id),
    listMunicipalities(regiao.id),
    listVenueNames(regiao.id),
  ]);
  if (!cycle) notFound();

  const today = todayInLisbon();
  const municipalityNames: Record<string, string> = Object.fromEntries(
    municipalities.map((municipality) => [municipality.id, municipality.name]),
  );

  const edicoes = edicoesDoCiclo(events);
  const porAcontecer = events.filter((event) => event.status === 'published');
  const concelhos = new Set(events.map((event) => event.municipality_id));
  const casa = cycle.municipality_id ? municipalityNames[cycle.municipality_id] : null;

  /*
   * Uma linha, e não duas.
   *
   * Havia aqui um parágrafo a dizer «programação em rede do Médio Tejo» por
   * baixo de uma descrição que já dizia exatamente isso, e outro a contar os
   * concelhos. Três frases para dois factos. O território e a contagem cabem
   * na mesma linha, e quando a contagem já diz «em dez concelhos» não é
   * preciso mais ninguém dizer que a coisa é regional.
   */
  const partes: string[] = [];
  if (!cycle.is_regional && casa) partes.push(`Acontece em ${casa}`);
  if (events.length > 0) {
    const quantas =
      events.length === 1 ? 'uma data registada' : `${events.length} datas registadas`;
    partes.push(
      concelhos.size > 1 ? `${quantas} em ${concelhos.size} concelhos` : quantas,
      porAcontecer.length > 0 ? `${porAcontecer.length} ainda por acontecer` : 'todas já passadas',
    );
  } else if (cycle.is_regional) {
    partes.push(
      regiao.promotor
        ? `Programação em rede da ${regiao.promotor.nome}`
        : 'Programação em rede da região',
    );
  }

  return (
    <>
      <PageHeader
        migalhas={migalhasDoCiclo(cycle)}
        title={cycle.name}
        eyebrow={formatSeriesKind(cycle.kind)}
        lead={cycle.description ?? undefined}
      >
        {partes.length > 0 ? (
          <p className="mt-3 text-sm text-muted">{`${partes.join(', ')}.`}</p>
        ) : null}
      </PageHeader>

      {edicoes.length === 0 ? (
        <EmptyState
          title="Ainda não há programação recolhida deste ciclo"
          description="O ciclo existe e está no levantamento; o que falta é uma fonte de onde ler o programa. Quem o organiza pode enviar-nos as datas por email."
          action={{ href: '/submeter', label: 'Como enviar um evento' }}
        />
      ) : (
        <div className="space-y-12">
          {edicoes.map((edicao) => (
            <section key={edicao.ano} aria-labelledby={`edicao-${edicao.ano}`}>
              <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-2">
                <h2 id={`edicao-${edicao.ano}`} className="ct-heading">
                  Edição de {edicao.ano}
                </h2>
                <p className="text-sm text-muted">
                  {edicao.eventos.length === 1 ? 'Uma data' : `${edicao.eventos.length} datas`}
                  {edicao.passou ? ' · já aconteceu' : ''}
                </p>
              </div>

              {edicao.passou ? (
                <p className="mb-4 max-w-2xl text-sm text-muted">
                  Esta edição já passou. Fica aqui porque é o melhor argumento para a próxima — e
                  porque quem quiser ver o que foi feito tem direito a encontrá-lo. Cada título leva
                  à página oficial do evento.
                </p>
              ) : null}

              <ul className="grid gap-3 sm:grid-cols-2">
                {edicao.eventos.map((event) => (
                  <li key={event.id}>
                    <CartaoDoCiclo
                      event={event}
                      today={today}
                      municipalityName={municipalityNames[event.municipality_id] ?? null}
                      venueName={event.venue_id ? (venueNames[event.venue_id] ?? null) : null}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-12 border-t border-border pt-6 text-sm text-muted">
        <Link href="/ciclos" className="underline underline-offset-4">
          Todos os ciclos e festivais da região
        </Link>
      </p>
    </>
  );
}
