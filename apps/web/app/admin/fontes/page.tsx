import { emLisboa } from '@coreto/core/dates';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { ambitoDoPainel } from '@/src/lib/admin/ambito';
import { erroEmPortugues, estadoDaFonte } from '@/src/lib/admin/fontes';
import { listRecentRuns, listSourceHealth, STALE_SOURCE_HOURS } from '@/src/lib/admin/queries';
import { ESTADO_DA_RECOLHA, rotulo } from '@/src/lib/admin/rotulos';
import { hasServiceRole } from '@/src/lib/env';
import { formatLongDate, formatTime } from '@/src/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Um nome só: «Fontes». O menu chamava-lhe uma coisa e a página outra («Saúde
 * da recolha»), e quem procurava uma não reconhecia a outra (C4-032).
 */
export const metadata: Metadata = { title: 'Fontes' };

interface Props {
  searchParams: Promise<{ regiao?: string }>;
}

/** «2 de outubro, 06h15», na hora de Lisboa. */
function quando(instante: string): string {
  const { date, time } = emLisboa(Date.parse(instante));
  return `${formatLongDate(date).replace(/ de \d{4}$/, '')}, ${formatTime(time) ?? time}`;
}

/**
 * As fontes da região, e o que se passa com cada uma.
 *
 * Uma lista de leitura com uma saída por linha: a ficha da fonte, onde está o
 * erro por extenso e os botões de pausar e reabrir. Aqui fica o que serve para
 * decidir qual abrir — o estado numa palavra, o último sucesso, e o porquê em
 * português quando a fonte não está a ser lida.
 */
export default async function Fontes({ searchParams }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Fontes" />;

  // As fontes da região escolhida, e as execuções delas (C4-015).
  const ambito = await ambitoDoPainel({ pedida: (await searchParams).regiao });
  const sources = await listSourceHealth(ambito);
  const runs = await listRecentRuns(
    40,
    ambito.regioes === null ? undefined : sources.map((fonte) => fonte.id),
  );
  const runsBySource = new Map<string, typeof runs>();
  for (const run of runs) {
    const list = runsBySource.get(run.source_id) ?? [];
    list.push(run);
    runsBySource.set(run.source_id, list);
  }

  return (
    <>
      <PageHeader
        title="Fontes"
        lead={`Os sítios de onde a agenda se lê, uma vez por dia — é este ecrã que evita que um concelho desapareça sem ninguém dar por isso. Uma fonte ligada e sem sucesso há mais de ${STALE_SOURCE_HOURS} horas aparece assinalada; cada uma abre a sua ficha, com o erro por extenso e os botões de pausar e reabrir.`}
      />

      {sources.length === 0 ? (
        <p className="text-muted">Esta região ainda não tem fontes.</p>
      ) : (
        <ul className="border-t border-border">
          {sources.map((source) => {
            const sourceRuns = runsBySource.get(source.id) ?? [];
            const ultima = sourceRuns[0];
            const estado = estadoDaFonte(source);
            const porque =
              !source.em_pausa && (source.is_stale || source.breaker_open)
                ? (erroEmPortugues(source.last_error) ?? source.last_error)
                : null;
            return (
              <li key={source.id} className="border-b border-border py-3">
                <p className="font-medium">
                  <Link
                    href={`/admin/fontes/${encodeURIComponent(source.id)}`}
                    className="underline underline-offset-4"
                  >
                    {source.name}
                  </Link>{' '}
                  <span
                    className={`text-sm font-normal ${estado.alerta ? 'text-highlight' : 'text-muted'}`}
                  >
                    · {estado.rotulo}
                  </span>
                </p>
                <p className="text-sm text-muted">
                  {source.hours_since_success === null
                    ? 'nunca lida com sucesso'
                    : `último sucesso há ${source.hours_since_success} h`}
                  {source.consecutive_failures > 0
                    ? ` · ${source.consecutive_failures} ${source.consecutive_failures === 1 ? 'falha seguida' : 'falhas seguidas'}`
                    : ''}
                  {ultima
                    ? ` · última leitura a ${quando(ultima.started_at)}: ${rotulo(ESTADO_DA_RECOLHA, ultima.status)}, ${ultima.items_found} ${ultima.items_found === 1 ? 'evento encontrado' : 'eventos encontrados'}`
                    : ''}
                  {ultima?.layout_drift ? ' — a página parece ter mudado de forma' : ''}
                </p>
                {source.em_pausa && source.pausa_motivo ? (
                  <p className="text-sm">
                    <span className="text-muted">Porquê: </span>
                    {source.pausa_motivo}
                  </p>
                ) : null}
                {porque ? <p className="text-sm text-highlight">{porque}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
