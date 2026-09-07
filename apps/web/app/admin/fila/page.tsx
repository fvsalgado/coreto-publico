import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { listSubmissions } from '@/src/lib/admin/queries';
import { hasServiceRole } from '@/src/lib/env';
import { formatLongDate } from '@/src/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Fila de moderação' };

interface Props {
  searchParams: Promise<{ channel?: string; status?: string }>;
}

const CHANNELS = [
  { value: '', label: 'Todos' },
  { value: 'email', label: 'Email' },
  { value: 'form', label: 'Formulário' },
  { value: 'scraper', label: 'Recolha' },
];

const STATUSES = [
  { value: 'pending', label: 'Por rever' },
  { value: 'needs_info', label: 'À espera de resposta' },
  { value: 'approved', label: 'Aprovadas' },
  { value: 'rejected', label: 'Rejeitadas' },
  { value: 'duplicate', label: 'Duplicadas' },
];

export default async function Fila({ searchParams }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Fila de moderação" />;

  const params = await searchParams;
  const status = params.status ?? 'pending';
  const submissions = await listSubmissions({ status, channel: params.channel });

  return (
    <>
      <PageHeader title="Fila de moderação" />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="status" className="block text-sm font-medium">
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="mt-1 min-h-11 rounded border border-field bg-surface px-3 py-2 text-base text-ink"
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="channel" className="block text-sm font-medium">
            Canal
          </label>
          <select
            id="channel"
            name="channel"
            defaultValue={params.channel ?? ''}
            className="mt-1 min-h-11 rounded border border-field bg-surface px-3 py-2 text-base text-ink"
          >
            {CHANNELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="min-h-11 rounded bg-accent px-4 text-sm font-medium text-on-accent"
        >
          Filtrar
        </button>
      </form>

      <p role="status" className="mb-3 text-sm text-muted">
        {submissions.length === 0
          ? 'Nada nesta vista.'
          : `${submissions.length} submissã${submissions.length === 1 ? 'o' : 'es'}.`}
      </p>

      <ul>
        {submissions.map((submission) => {
          const title =
            typeof submission.payload.title === 'string' ? submission.payload.title : null;
          return (
            <li key={submission.id} className="border-b border-border py-3">
              <p className="text-sm text-muted">
                {formatLongDate(submission.created_at.slice(0, 10))} · {submission.channel}
                {submission.municipality_id ? ` · ${submission.municipality_id}` : ''}
                {submission.extraction_status === 'failed' ? ' · extração falhou' : ''}
                {submission.extraction_status === 'skipped' ? ' · em bruto' : ''}
                {submission.extraction_status === 'unverified' ? ' · por confirmar' : ''}
              </p>
              <p className="font-medium">
                <Link
                  href={`/admin/fila/${submission.id}`}
                  className="underline underline-offset-4"
                >
                  {title ?? submission.raw_subject ?? 'Sem título'}
                </Link>
              </p>
              {submission.sender_email ? (
                <p className="text-sm text-muted">{submission.sender_email}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
