import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { PublicadoAgora } from '@/src/components/PublicadoAgora';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { ambitoDoPainel } from '@/src/lib/admin/ambito';
import { proposedFromPayload } from '@/src/lib/admin/fields';
import { ligacoesPublicas } from '@/src/lib/admin/ligacoes';
import { listSubmissions } from '@/src/lib/admin/queries';
import { CANAL, ESTADO_DA_PROPOSTA, LEITURA_AUTOMATICA, rotulo } from '@/src/lib/admin/rotulos';
import { hasServiceRole } from '@/src/lib/env';
import { daysBetween, emLisboa, todayInLisbon } from '@coreto/core/dates';
import { formatLongDate } from '@/src/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Fila de moderação' };

interface Props {
  searchParams: Promise<{
    channel?: string;
    status?: string;
    regiao?: string;
    /** O que uma ação acabou de fazer, ou porque é que não fez. */
    aviso?: string;
    /** O evento que a aprovação acabou de publicar (C4-013). */
    publicado?: string;
  }>;
}

// Os rótulos são os do dicionário do painel (C4-011): «Formulário» dizia um
// canal que o sítio já não tem — o que entra por `form` é o envio por programa.
const CHANNELS = [
  { value: '', label: 'Todos' },
  ...(['email', 'form', 'scraper'] as const).map((canal) => ({
    value: canal,
    label: rotulo(CANAL, canal),
  })),
];

const STATUSES = [
  { value: 'pending', label: 'Por rever' },
  { value: 'needs_info', label: 'À espera de resposta' },
  { value: 'approved', label: 'Publicadas' },
  { value: 'rejected', label: 'Recusadas' },
  { value: 'duplicate', label: 'Duplicadas' },
];

/** O limite da leitura da fila (`listSubmissions`). */
const LIMITE_DA_FILA = 100;

/**
 * «5 propostas por rever», «1 proposta recusada» — a contagem por cima da
 * lista, que é a primeira linha que quem modera lê todas as manhãs. Dizia
 * «5 submissães» (C4-012).
 */
function contagem(n: number, estado: string): string {
  const nome = rotulo(ESTADO_DA_PROPOSTA, estado);
  // «por rever» e «à espera de resposta» não variam; «publicada» e as outras sim.
  const noPlural = n === 1 || nome.includes(' ') ? nome : `${nome}s`;
  if (n >= LIMITE_DA_FILA)
    return `As ${LIMITE_DA_FILA} propostas mais recentes ${noPlural} — há mais.`;
  return `${n} ${n === 1 ? 'proposta' : 'propostas'} ${noPlural}.`;
}

export default async function Fila({ searchParams }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Fila de moderação" />;

  const params = await searchParams;
  const status = params.status ?? 'pending';
  // A fila da região escolhida no cimo, e só das regiões onde esta sessão
  // modera (C4-015): os emails em bruto de uma CIM não são da outra.
  const ambito = await ambitoDoPainel({ pedida: params.regiao });
  const submissions = await listSubmissions({ status, channel: params.channel, recorte: ambito });
  const hoje = todayInLisbon();
  /** «à espera de resposta há 5 dias» — desde que se perguntou (C4-030). */
  const aEsperaHa = (desde: string | null): string | null => {
    if (!desde) return null;
    const dias = daysBetween(emLisboa(Date.parse(desde)).date, hoje);
    return dias <= 0
      ? 'perguntado hoje'
      : `à espera de resposta há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  };

  return (
    <>
      <PageHeader title="Fila de moderação" />

      <PublicadoAgora
        eventoId={params.publicado}
        ambito={ambito}
        ligacoes={ligacoesPublicas(
          ambito.disponiveis,
          ambito.regiaoDoConcelho,
          (await headers()).get('host'),
        )}
        voltar="/admin/fila"
      />

      {params.aviso ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          {params.aviso}
        </p>
      ) : null}

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
        {submissions.length === 0 ? 'Nada nesta vista.' : contagem(submissions.length, status)}
      </p>

      <ul>
        {submissions.map((submission) => {
          // O título das três formas de payload — a recolha guarda-o dentro de
          // `event`, e a lista lia só a forma lisa: as propostas da recolha
          // apareciam todas como «Sem título».
          const title =
            proposedFromPayload(submission.payload, {
              municipality_id: submission.municipality_id,
              venue_id: null,
            }).title ||
            submission.raw_subject ||
            'Proposta sem título';
          // A leitura automática só existe no email: no envio por programa e
          // na recolha «sem leitura automática» é o normal, e dizê-lo em todas
          // as linhas era ruído.
          const leitura =
            submission.channel === 'email'
              ? LEITURA_AUTOMATICA[submission.extraction_status]
              : null;
          return (
            <li key={submission.id} className="border-b border-border py-3">
              <p className="text-sm text-muted">
                chegou a {formatLongDate(emLisboa(Date.parse(submission.created_at)).date)} ·{' '}
                {rotulo(CANAL, submission.channel)}
                {submission.municipality_id
                  ? ` · ${ambito.nomeDoConcelho.get(submission.municipality_id) ?? submission.municipality_id}`
                  : ''}
                {leitura ? ` · ${leitura}` : ''}
              </p>
              <p className="font-medium">
                <Link
                  href={`/admin/fila/${submission.id}`}
                  className="underline underline-offset-4"
                >
                  {title}
                </Link>
              </p>
              {/* O motivo à vista, na lista e não só na ficha: é ele que
                  distingue trinta propostas de um adaptador que lê mal de
                  trinta problemas (docs/OPERACAO.md). */}
              {submission.status === 'pending' && submission.review_notes ? (
                <p className="text-sm">
                  <span className="text-muted">Está na fila porque </span>
                  {submission.review_notes}
                </p>
              ) : null}
              {submission.sender_email ? (
                <p className="text-sm text-muted">{submission.sender_email}</p>
              ) : null}
              {submission.status === 'needs_info' && aEsperaHa(submission.reviewed_at) ? (
                <p className="text-sm text-highlight">{aEsperaHa(submission.reviewed_at)}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
