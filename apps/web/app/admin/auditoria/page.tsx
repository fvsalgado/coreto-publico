import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { listAdminActions } from '@/src/lib/admin/queries';
import { hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Auditoria' };

const PER_PAGE = 50;

/** As ligações da paginação, como as da agenda pública (`Pagination.tsx`): alvo de 44 px. */
const LIGACAO =
  'inline-flex min-h-11 items-center rounded border border-border px-4 text-sm underline-offset-4 hover:underline';

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function Auditoria({ searchParams }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Auditoria" />;

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const actions = await listAdminActions(page, PER_PAGE);

  return (
    <>
      <PageHeader
        title="Auditoria"
        lead="Todas as ações de moderação passam pelas funções da base de dados, e todas deixam rasto aqui."
      />

      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Tabela, deslocável na horizontal"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Registo de ações de administração</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-2 pr-4">
                Quando
              </th>
              <th scope="col" className="py-2 pr-4">
                Quem
              </th>
              <th scope="col" className="py-2 pr-4">
                O quê
              </th>
              <th scope="col" className="py-2 pr-4">
                Sobre
              </th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action.id} className="border-b border-border">
                <td className="py-2 pr-4 text-muted">
                  {action.created_at.slice(0, 16).replace('T', ' ')}
                </td>
                <td className="py-2 pr-4">{action.actor}</td>
                <td className="py-2 pr-4">{action.action}</td>
                <td className="py-2 pr-4 text-muted">
                  {action.entity_type} {action.entity_id.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actions.length === 0 ? <p className="mt-4 text-muted">Sem registos nesta página.</p> : null}

      <nav aria-label="Paginação" className="mt-6 flex gap-4 text-sm">
        {page > 1 ? (
          <Link href={`/admin/auditoria?page=${page - 1}`} className={LIGACAO}>
            ← Mais recentes
          </Link>
        ) : null}
        {actions.length === PER_PAGE ? (
          <Link href={`/admin/auditoria?page=${page + 1}`} className={LIGACAO}>
            Mais antigos →
          </Link>
        ) : null}
      </nav>
    </>
  );
}
