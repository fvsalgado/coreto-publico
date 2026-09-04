import type { Metadata } from 'next';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { listRecentRuns, listSourceHealth, STALE_SOURCE_HOURS } from '@/src/lib/admin/queries';
import { hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Saúde da recolha' };

export default async function Fontes() {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Saúde da recolha" />;

  const [sources, runs] = await Promise.all([listSourceHealth(), listRecentRuns()]);
  const runsBySource = new Map<string, typeof runs>();
  for (const run of runs) {
    const list = runsBySource.get(run.source_id) ?? [];
    list.push(run);
    runsBySource.set(run.source_id, list);
  }

  return (
    <>
      <PageHeader
        title="Saúde da recolha"
        lead={`É este ecrã que evita que um concelho desapareça do site sem ninguém dar por isso. Uma fonte ligada e sem sucesso há mais de ${STALE_SOURCE_HOURS} horas aparece assinalada.`}
      />

      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Tabela, deslocável na horizontal"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Estado de cada fonte de recolha</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-2 pr-4">
                Fonte
              </th>
              <th scope="col" className="py-2 pr-4">
                Último sucesso
              </th>
              <th scope="col" className="py-2 pr-4">
                Falhas
              </th>
              <th scope="col" className="py-2 pr-4">
                Últimas execuções
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const sourceRuns = runsBySource.get(source.id) ?? [];
              const drift = sourceRuns.some((run) => run.layout_drift);

              return (
                <tr key={source.id} className="border-b border-border align-top">
                  <th scope="row" className="py-2 pr-4 text-left font-medium">
                    {source.name}
                    {!source.is_enabled ? (
                      <span className="ml-2 text-muted">(desligada)</span>
                    ) : null}
                    {source.breaker_open ? (
                      <span className="ml-2 text-highlight">disjuntor aberto</span>
                    ) : null}
                    {drift ? (
                      <span className="ml-2 text-highlight">alteração de layout</span>
                    ) : null}
                  </th>
                  <td className={`py-2 pr-4 ${source.is_stale ? 'text-highlight' : 'text-muted'}`}>
                    {source.hours_since_success === null
                      ? 'nunca'
                      : `há ${source.hours_since_success}h`}
                  </td>
                  <td className="py-2 pr-4 text-muted">{source.consecutive_failures}</td>
                  <td className="py-2 pr-4 text-muted">
                    {sourceRuns.length === 0 ? (
                      '—'
                    ) : (
                      <ul className="space-y-0.5">
                        {sourceRuns.slice(0, 3).map((run) => (
                          <li key={run.id}>
                            {run.started_at.slice(0, 16).replace('T', ' ')} · {run.status} ·{' '}
                            {run.items_found} encontrados, {run.items_new} novos
                            {run.layout_drift ? ' · layout' : ''}
                            {run.error ? ` · ${run.error.slice(0, 60)}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
