import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { StatTable, type StatColumn } from '@/src/components/StatTable';
import {
  TOP_LIMIT,
  eventStatsOverview,
  type EventStatRow,
  type MunicipalityStatRow,
} from '@/src/lib/analytics/queries';
import { hasAnalytics, hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Estatísticas' };

interface Props {
  searchParams: Promise<{ municipality?: string }>;
}

const numberFormat = new Intl.NumberFormat('pt-PT');

function count(value: number): string {
  return numberFormat.format(value);
}

/** Um `id` de concelho é um slug. Qualquer outra coisa não é para ir à base. */
function readMunicipality(value: string | undefined): string | null {
  if (!value) return null;
  return /^[a-z0-9-]{1,60}$/.test(value) ? value : null;
}

function eventColumns(municipalityNames: Map<string, string>): Array<StatColumn<EventStatRow>> {
  return [
    {
      key: 'title',
      label: 'Evento',
      isRowHeader: true,
      render: (row) => (
        <Link href={`/evento/${row.slug}`} className="underline underline-offset-4">
          {row.title}
        </Link>
      ),
    },
    {
      key: 'municipality',
      label: 'Concelho',
      render: (row) => municipalityNames.get(row.municipalityId) ?? row.municipalityId,
    },
    {
      key: 'date',
      label: 'Data',
      render: (row) =>
        row.dateStart ? <time dateTime={row.dateStart}>{row.dateStart}</time> : '—',
    },
    { key: 'views', label: 'Aberturas', isNumeric: true, render: (row) => count(row.views) },
    {
      key: 'ticket_clicks',
      label: 'Bilhética',
      isNumeric: true,
      render: (row) => count(row.ticketClicks),
    },
    {
      key: 'ical_downloads',
      label: 'Calendário',
      isNumeric: true,
      render: (row) => count(row.icalDownloads),
    },
    { key: 'shares', label: 'Partilhas', isNumeric: true, render: (row) => count(row.shares) },
    { key: 'clicks', label: 'Cliques', isNumeric: true, render: (row) => count(row.clicks) },
  ];
}

const MUNICIPALITY_COLUMNS: Array<StatColumn<MunicipalityStatRow>> = [
  {
    key: 'municipality',
    label: 'Concelho',
    isRowHeader: true,
    render: (row) => row.municipalityName,
  },
  {
    key: 'events',
    label: 'Eventos com contagens',
    isNumeric: true,
    render: (row) => count(row.eventsCounted),
  },
  { key: 'views', label: 'Aberturas', isNumeric: true, render: (row) => count(row.views) },
  {
    key: 'ticket_clicks',
    label: 'Bilhética',
    isNumeric: true,
    render: (row) => count(row.ticketClicks),
  },
  {
    key: 'ical_downloads',
    label: 'Calendário',
    isNumeric: true,
    render: (row) => count(row.icalDownloads),
  },
  { key: 'shares', label: 'Partilhas', isNumeric: true, render: (row) => count(row.shares) },
  { key: 'clicks', label: 'Cliques', isNumeric: true, render: (row) => count(row.clicks) },
];

export default async function Estatisticas({ searchParams }: Props) {
  if (!hasServiceRole) {
    return (
      <>
        <PageHeader title="Estatísticas" />
        <p className="text-muted">
          Falta <code>SUPABASE_SERVICE_ROLE_KEY</code>. Sem ela não há contadores para ler.
        </p>
      </>
    );
  }

  const params = await searchParams;
  const requested = readMunicipality(params.municipality);
  const { topByViews, topByClicks, byMunicipality, total } = await eventStatsOverview(requested);

  const municipalityNames = new Map(
    byMunicipality.map((row) => [row.municipalityId, row.municipalityName]),
  );
  const selected = requested ? (municipalityNames.get(requested) ?? null) : null;
  const scope = selected ?? 'todos os concelhos';
  const columns = eventColumns(municipalityNames);

  const totalRow: MunicipalityStatRow = {
    municipalityId: '',
    municipalityName: 'Total',
    eventsCounted: total.eventsCounted,
    views: total.views,
    ticketClicks: total.ticketClicks,
    icalDownloads: total.icalDownloads,
    shares: total.shares,
    clicks: total.clicks,
  };

  return (
    <>
      <PageHeader
        title="Estatísticas"
        lead="Quantas vezes cada evento foi aberto e quantas vezes se carregou nos seus botões. São contagens agregadas, sem qualquer identificação de quem visitou."
      />

      <section aria-labelledby="como-ler" className="mb-8 border border-border bg-surface p-4">
        <h2 id="como-ler" className="font-semibold">
          Como ler estes números
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>
            <strong>Aberturas</strong> conta fichas abertas, não pessoas: sem cookies nem
            identificador, duas visitas da mesma pessoa contam duas vezes.
          </li>
          <li>
            <strong>Bilhética</strong>, <strong>Calendário</strong> e <strong>Partilhas</strong>{' '}
            contam cliques no respetivo botão da ficha. <strong>Cliques</strong> é a soma dos três.
          </li>
          <li>
            Uma partilha conta quando se carrega no botão — o sistema não diz se a mensagem chegou a
            ser enviada.
          </li>
          <li>
            Um evento sem contagens não aparece nas duas primeiras tabelas; na tabela por concelho
            aparecem sempre os onze.
          </li>
        </ul>
      </section>

      <nav aria-label="Filtrar por concelho" className="mb-8 text-sm">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li>
            {requested ? (
              <Link
                href="/admin/estatisticas"
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                Todos
              </Link>
            ) : (
              <span aria-current="true" className="inline-flex min-h-11 items-center font-semibold">
                Todos
              </span>
            )}
          </li>
          {byMunicipality.map((row) => (
            <li key={row.municipalityId}>
              {row.municipalityId === requested ? (
                <span
                  aria-current="true"
                  className="inline-flex min-h-11 items-center font-semibold"
                >
                  {row.municipalityName}
                </span>
              ) : (
                <Link
                  href={`/admin/estatisticas?municipality=${row.municipalityId}`}
                  className="inline-flex min-h-11 items-center underline underline-offset-4"
                >
                  {row.municipalityName}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {requested && !selected ? (
        <p className="mb-8 text-highlight">
          O concelho <code>{requested}</code> não existe. As tabelas abaixo estão vazias por isso.
        </p>
      ) : null}

      <section aria-labelledby="mais-vistos" className="mb-10">
        <h2 id="mais-vistos" className="text-lg font-semibold">
          Mais vistos
        </h2>
        <StatTable
          caption={`Os ${TOP_LIMIT} eventos com mais aberturas de ficha em ${scope}, com os cliques de cada um.`}
          columns={columns}
          rows={topByViews}
          rowKey={(row) => row.eventId}
          emptyMessage="Ainda sem aberturas contadas."
        />
      </section>

      <section aria-labelledby="mais-clicados" className="mb-10">
        <h2 id="mais-clicados" className="text-lg font-semibold">
          Mais clicados
        </h2>
        <StatTable
          caption={`Os ${TOP_LIMIT} eventos com mais cliques em ${scope}, somando bilhética, calendário e partilhas.`}
          columns={columns}
          rows={topByClicks}
          rowKey={(row) => row.eventId}
          emptyMessage="Ainda sem cliques contados."
        />
      </section>

      <section aria-labelledby="por-concelho" className="mb-10">
        <h2 id="por-concelho" className="text-lg font-semibold">
          Por concelho
        </h2>
        <StatTable
          caption="Totais de aberturas e cliques por concelho, com o total da região na última linha."
          columns={MUNICIPALITY_COLUMNS}
          rows={byMunicipality}
          rowKey={(row) => row.municipalityId}
          emptyMessage="Sem contagens."
          totalRow={totalRow}
        />
      </section>

      <section aria-labelledby="medicao" className="border-t border-border pt-4 text-sm text-muted">
        <h2 id="medicao" className="font-semibold text-ink">
          De onde vêm estes números
        </h2>
        <p className="mt-1">
          São contadores do próprio sítio, guardados na base de dados sem identificar quem visita. É
          esta a fonte de verdade para «quantos cliques teve este evento».
        </p>
        <p className="mt-1">
          {hasAnalytics
            ? 'O PostHog está configurado e corre em modo sem cookies, alojado na União Europeia. Serve para ver o uso do sítio no seu conjunto; não é daí que vêm os números desta página.'
            : 'O PostHog não está configurado — não corre no sítio. Estes contadores não dependem dele.'}
        </p>
      </section>
    </>
  );
}
