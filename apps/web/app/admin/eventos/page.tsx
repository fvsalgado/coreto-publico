import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { bulkSetEventStatus } from '@/src/lib/admin/actions';
import { LOTE_MAX } from '@/src/lib/admin/fields';
import { LACUNAS } from '@/src/lib/admin/lacunas';
import {
  countEventsByStatus,
  listEvents,
  listSourcesParaFiltro,
  EVENTS_PAGE_SIZE,
  type AdminEventRow,
} from '@/src/lib/admin/queries';
import { listMunicipalitiesDeTodas } from '@/src/lib/queries/events';
import { hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Eventos' };

const CAMPO = 'mt-1 min-h-11 rounded border border-field bg-surface px-3 py-2 text-base text-ink';
const BOTAO =
  'inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium';
const ROTULO = 'block text-sm font-medium';

const ESTADOS = [
  { value: 'todos', label: 'Todos' },
  // A população que `/admin/qualidade` mede, e o destino de todas as ligações
  // que de lá vêm. `todos` traz escondidos, cancelados e arquivados, que são
  // decisões de uma pessoa sobre um evento e não lacunas de recolha — abrir a
  // lista por aí mostrava mais linhas do que a percentagem prometia.
  { value: 'catalogo', label: 'No catálogo (publicados e por publicar)' },
  { value: 'draft', label: 'Por publicar' },
  { value: 'published', label: 'Publicados' },
  { value: 'hidden', label: 'Escondidos' },
  { value: 'cancelled', label: 'Cancelados' },
  { value: 'archived', label: 'Arquivados' },
];

/**
 * As opções do selector «Falta».
 *
 * Vêm de `lacunas.ts`, que é a mesma lista que `/admin/qualidade` usa para as
 * colunas: ali dizem-se em percentagem, aqui abrem os que faltam, prontos a
 * corrigir. Eram duas listas escritas à mão, e divergiram — o painel media
 * «Preço» e «Mapa» e o selector não os conhecia, pelo que a percentagem não
 * tinha para onde clicar. Um teste recusa agora que voltem a divergir.
 */
const OPCOES_DE_FALTA = [
  { value: '', label: 'Tudo' },
  ...LACUNAS.map((l) => ({ value: l.chave, label: l.filtro })),
];

function Estado({ status }: { status: string }) {
  const cor =
    status === 'published'
      ? 'bg-accent/15 text-accent'
      : status === 'draft'
        ? 'bg-highlight/15 text-highlight'
        : 'bg-border/40 text-muted';
  const nome = ESTADOS.find((e) => e.value === status)?.label ?? status;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cor}`}>{nome}</span>;
}

function quando(linha: AdminEventRow): string {
  if (!linha.date_start) return 'sem data';
  if (!linha.date_end || linha.date_end === linha.date_start) return linha.date_start;
  return `${linha.date_start} → ${linha.date_end}`;
}

function onde(linha: AdminEventRow): string {
  return linha.venue_id ?? linha.location_name ?? '—';
}

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function Eventos({ searchParams }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Eventos" />;

  const params = await searchParams;
  const filtro = {
    q: (params.q ?? '').trim(),
    municipality: params.concelho ?? '',
    status: params.estado ?? 'draft',
    fonte: params.fonte ?? '',
    janela: params.janela ?? '',
    falta: params.falta ?? '',
    antes: params.antes ?? '',
  };

  const [linhas, contagens, concelhos, fontes] = await Promise.all([
    listEvents(filtro),
    countEventsByStatus(),
    listMunicipalitiesDeTodas(),
    listSourcesParaFiltro(),
  ]);

  // O cursor da página seguinte é a última linha desta. Ver `listEvents`: a
  // data sozinha não chega, e o id desempata.
  const ultima = linhas[linhas.length - 1];
  const proxima =
    linhas.length === EVENTS_PAGE_SIZE && ultima
      ? new URLSearchParams({
          ...Object.fromEntries(
            Object.entries(params).filter(([k, v]) => v && k !== 'antes' && k !== 'aviso'),
          ),
          antes: `${ultima.date_start ?? ''}|${ultima.id}`,
        }).toString()
      : null;

  const aquiEstou = `/admin/eventos?${new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([k, v]) => v && k !== 'aviso')) as Record<
      string,
      string
    >,
  ).toString()}`;

  return (
    <>
      <PageHeader title="Eventos">
        <p className="mt-1 text-sm text-muted">
          {(contagens.published ?? 0).toLocaleString('pt-PT')} publicados ·{' '}
          {(contagens.draft ?? 0).toLocaleString('pt-PT')} por publicar
          {contagens.hidden ? ` · ${contagens.hidden} escondidos` : ''}
        </p>
      </PageHeader>

      {params.aviso ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          {params.aviso}
        </p>
      ) : null}

      <form method="get" className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="q" className={ROTULO}>
            Título
          </label>
          <input id="q" name="q" defaultValue={filtro.q} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="estado" className={ROTULO}>
            Estado
          </label>
          <select id="estado" name="estado" defaultValue={filtro.status} className={CAMPO}>
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="concelho" className={ROTULO}>
            Concelho
          </label>
          <select
            id="concelho"
            name="concelho"
            defaultValue={filtro.municipality}
            className={CAMPO}
          >
            <option value="">Todos</option>
            {concelhos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fonte" className={ROTULO}>
            Fonte
          </label>
          <select id="fonte" name="fonte" defaultValue={filtro.fonte} className={CAMPO}>
            <option value="">Todas</option>
            {fontes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="falta" className={ROTULO}>
            Falta
          </label>
          <select id="falta" name="falta" defaultValue={filtro.falta} className={CAMPO}>
            {OPCOES_DE_FALTA.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        {/* O rótulo leva a altura toda: a caixa desenhada tem 20 px, mas o
            alvo do dedo é a linha inteira — como nos filtros da agenda. */}
        <label htmlFor="janela" className="flex min-h-11 items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            id="janela"
            name="janela"
            value="futuros"
            defaultChecked={filtro.janela === 'futuros'}
            className="size-5 accent-accent"
          />
          Só os que ainda não passaram
        </label>
        <button type="submit" className={BOTAO}>
          Filtrar
        </button>
      </form>

      {linhas.length === 0 ? (
        <p className="text-muted">Nenhum evento com estes filtros.</p>
      ) : (
        <form action={bulkSetEventStatus}>
          <input type="hidden" name="voltar" value={aquiEstou} />

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Com os escolhidos:</span>
            {[
              { estado: 'published', rotulo: 'Publicar' },
              { estado: 'draft', rotulo: 'Voltar a rascunho' },
              { estado: 'hidden', rotulo: 'Esconder' },
              { estado: 'archived', rotulo: 'Arquivar' },
            ].map((acao) => (
              <button
                key={acao.estado}
                type="submit"
                name="status"
                value={acao.estado}
                className="inline-flex min-h-11 items-center rounded border border-field px-3 text-sm font-medium"
              >
                {acao.rotulo}
              </button>
            ))}
            <span className="text-sm text-muted">no máximo {LOTE_MAX} de cada vez</span>
          </div>

          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Tabela, deslocável na horizontal"
          >
            <table className="w-full text-sm">
              <caption className="sr-only">Eventos do catálogo, com os filtros aplicados</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3">
                    <span className="sr-only">Escolher</span>
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Título
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Quando
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Onde
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Concelho
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.id} className="border-b border-border align-top">
                    <td className="pr-3">
                      {/* O rótulo sem texto é o alvo: 44 px à volta de uma
                          caixa de 20; o nome vem do `aria-label`. */}
                      <label className="flex min-h-11 items-center">
                        <input
                          type="checkbox"
                          name="ids"
                          value={linha.id}
                          aria-label={`Escolher ${linha.title}`}
                          className="size-5 accent-accent"
                        />
                      </label>
                    </td>
                    <th scope="row" className="py-2 pr-4 text-left font-normal">
                      <Link
                        href={`/evento/${linha.slug}`}
                        className="underline underline-offset-4"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${linha.title} (abre noutro separador)`}
                      >
                        {linha.title}
                      </Link>
                      {linha.source_id ? (
                        <span className="block text-xs text-muted">{linha.source_id}</span>
                      ) : null}
                    </th>
                    <td className="py-2 pr-4 tabular-nums">{quando(linha)}</td>
                    <td className="py-2 pr-4">{onde(linha)}</td>
                    <td className="py-2 pr-4">{linha.municipality_id}</td>
                    <td className="py-2 pr-4">
                      <Estado status={linha.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      )}

      {proxima ? (
        <p className="mt-6">
          <Link
            href={`/admin/eventos?${proxima}`}
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Página seguinte →
          </Link>
        </p>
      ) : null}
    </>
  );
}
