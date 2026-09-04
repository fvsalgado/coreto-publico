import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { listRegionsAdmin } from '@/src/lib/admin/queries';
import { hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ aviso?: string }>;
}

/**
 * As regiões que esta instalação serve, uma linha por CIM.
 *
 * Uma região nova nasce em `/admin/regioes/nova`, pela função `create_region`
 * (migração 0121) — já com os concelhos, e com o espaço provisório e a fonte
 * desligada que as schema-checks exigem a cada um. Não é uma migração, e não
 * o era antes: uma região é um dado desta instalação, não do repositório, e
 * o CI faz nascer uma de prova em cada corrida para provar que o caminho
 * funciona (`docs/NOVA-CIM.md`). O que aqui se gere é o dia-a-dia do que já
 * nasceu: a prosa, os contactos, os logótipos, as licenças, as secções.
 */
export default async function Regioes({ searchParams }: Props) {
  const params = await searchParams;

  if (!hasServiceRole) {
    return (
      <>
        <PageHeader title="Regiões" />
        <p className="text-muted">
          Falta <code>SUPABASE_SERVICE_ROLE_KEY</code>. Sem ela o backoffice não lê nada.
        </p>
      </>
    );
  }

  const regioes = await listRegionsAdmin();

  return (
    <>
      <PageHeader
        title="Regiões"
        lead="Cada linha é uma CIM servida por esta instalação, no seu domínio. Editar mexe na prosa, nos contactos e nos logótipos; uma região nova nasce em «Nova região», já com os concelhos — e o domínio entra depois, pelo guia docs/NOVA-CIM.md."
      >
        <p className="mt-4">
          <Link
            href="/admin/regioes/nova"
            className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm font-medium hover:bg-surface"
          >
            Nova região
          </Link>
        </p>
      </PageHeader>

      {params.aviso ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          {params.aviso}
        </p>
      ) : null}

      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Tabela, deslocável na horizontal"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">As regiões desta instalação</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-2 pr-4">
                Região
              </th>
              <th scope="col" className="py-2 pr-4">
                Domínio
              </th>
              <th scope="col" className="py-2 pr-4">
                Contacto
              </th>
              <th scope="col" className="py-2 pr-4">
                Concelhos
              </th>
              <th scope="col" className="py-2 pr-4">
                Ordem
              </th>
              <th scope="col" className="py-2 pr-4">
                Estado
              </th>
              <th scope="col" className="py-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {regioes.map((regiao) => (
              <tr key={regiao.id} className="border-b border-border align-top">
                <th scope="row" className="py-2 pr-4 text-left font-medium">
                  {regiao.name} <span className="font-normal text-muted">{regiao.id}</span>
                  {regiao.kind === 'montra' ? (
                    <span className="ml-2 font-normal text-muted">(montra)</span>
                  ) : null}
                </th>
                <td className="py-2 pr-4 text-muted">{regiao.domain}</td>
                <td className="py-2 pr-4 text-muted">{regiao.contact_email}</td>
                <td className="py-2 pr-4 text-muted">{regiao.expected_municipality_count}</td>
                <td className="py-2 pr-4 text-muted">{regiao.sort_order}</td>
                <td className={`py-2 pr-4 ${regiao.is_enabled ? 'text-muted' : 'text-highlight'}`}>
                  {regiao.is_enabled ? 'Ligada' : 'Desligada'}
                </td>
                <td className="py-2">
                  <Link
                    href={`/admin/regioes/${encodeURIComponent(regiao.id)}`}
                    className="underline underline-offset-4"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
