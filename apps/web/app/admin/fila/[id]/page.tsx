import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { approveSubmission, mergeEvents, rejectSubmission } from '@/src/lib/admin/actions';
import {
  findDuplicateCandidates,
  getSubmission,
  listAttachments,
  signedAttachmentUrl,
} from '@/src/lib/admin/queries';
import { proposedFromPayload, proposedSessions } from '@/src/lib/admin/fields';
import {
  listCategories,
  listMunicipalitiesDeTodas,
  listVenuesDeTodas,
} from '@/src/lib/queries/events';
import { hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Submissão' };

interface Props {
  params: Promise<{ id: string }>;
}

const FIELD =
  'mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';
const LABEL = 'block text-sm font-medium';

/** Quantas linhas de sessão o formulário oferece por omissão. */
const SESSION_ROWS = 6;

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export default async function RevisaoSubmissao({ params }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Submissão" />;

  const { id } = await params;
  const submission = await getSubmission(id);
  if (!submission) notFound();

  const payload = (submission.payload ?? {}) as Record<string, unknown>;

  // O que a fonte propôs, venha ela da extração de email ou da recolha — são
  // duas formas de payload na mesma coluna, e ler só uma delas era o que
  // servia o formulário em branco a quem vinha resolver um candidato da noite.
  const proposed = proposedFromPayload(payload, {
    municipality_id: submission.municipality_id,
    venue_id: submission.venue_id,
  });
  const proposedDates = proposedSessions(payload);

  const municipalityId = proposed.municipality_id;
  const title = proposed.title;

  /** A submissão veio da recolha, e não de uma pessoa a escrever. */
  const daRecolha = submission.channel === 'scraper';
  const raw = (payload.raw ?? {}) as Record<string, unknown>;

  const [attachments, municipalities, categories, venues, duplicates] = await Promise.all([
    listAttachments(id),
    listMunicipalitiesDeTodas(),
    listCategories(),
    listVenuesDeTodas(),
    title && municipalityId
      ? findDuplicateCandidates(title, str(proposedDates[0]?.date) || null, municipalityId)
      : Promise.resolve([]),
  ]);

  const attachmentLinks = await Promise.all(
    attachments.map(async (attachment) => ({
      ...attachment,
      url: await signedAttachmentUrl(attachment.storage_path),
    })),
  );

  const isResolved = submission.status !== 'pending' && submission.status !== 'needs_info';

  return (
    <>
      <PageHeader title={title || submission.raw_subject || 'Submissão sem título'}>
        <p className="mt-1 text-sm text-muted">
          {submission.channel} · {submission.status}
          {submission.sender_email ? ` · ${submission.sender_email}` : ''}
          {submission.confidence !== null ? ` · confiança ${submission.confidence}` : ''}
        </p>
      </PageHeader>

      {/* Porque é que isto está na fila. Estava guardado em `review_notes`
          desde o início e nunca aparecia — quem abria a página via o estado e
          a confiança, e tinha de adivinhar o que faltava. */}
      {!isResolved && submission.review_notes ? (
        <p className="mb-6 rounded border border-highlight px-3 py-2 text-sm text-highlight">
          <strong>Está na fila porque:</strong> {submission.review_notes}
        </p>
      ) : null}

      {isResolved ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          Esta submissão já foi resolvida como <strong>{submission.status}</strong>
          {submission.resulting_event_id ? (
            <>
              {' '}
              —{' '}
              <Link href={`/admin/fila`} className="underline">
                evento criado
              </Link>
            </>
          ) : null}
          .
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* O material em bruto fica sempre visível ao lado do que se edita:
            é a única maneira de confirmar que a extração não inventou nada. */}
        <section aria-labelledby="bruto">
          <h2 id="bruto" className="text-lg font-semibold">
            O que chegou
          </h2>

          {submission.raw_subject ? (
            <p className="mt-2 text-sm">
              <span className="text-muted">Assunto:</span> {submission.raw_subject}
            </p>
          ) : null}

          {/* A extração é o passo que lê prosa de um email e propõe campos.
              Quem vem da recolha nunca passa por lá — o adaptador já leu a
              página estruturada — e dizer-lhe «skipped, preenche à mão» era
              mandar reescrever à mão o que já estava lido. */}
          {!daRecolha && submission.extraction_status !== 'ok' ? (
            <p className="mt-2 rounded border border-highlight px-3 py-2 text-sm text-highlight">
              Extração: {submission.extraction_status}
              {submission.extraction_error ? ` — ${submission.extraction_error}` : ''}
              {submission.extraction_status === 'skipped'
                ? '. O texto está aqui em baixo; preenche à mão.'
                : ''}
            </p>
          ) : null}

          {submission.raw_text ? (
            <pre
              tabIndex={0}
              className="mt-3 max-h-96 overflow-auto rounded border border-border bg-surface p-3 text-sm whitespace-pre-wrap"
            >
              {submission.raw_text}
            </pre>
          ) : daRecolha ? (
            // Não há prosa nenhuma para mostrar, e não é falta: é o que o
            // adaptador leu, ao lado do formulário já preenchido com isso, e
            // com a ligação à página de origem para se confirmar sem sair
            // daqui. É o mesmo fim que o texto em bruto serve num email.
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted">Fonte</dt>
                <dd>
                  {submission.source_id}
                  {str(raw.sourceUrl) ? (
                    <>
                      {' · '}
                      <a
                        href={str(raw.sourceUrl)}
                        rel="noopener noreferrer"
                        target="_blank"
                        aria-label="Página do evento na fonte (abre noutro separador)"
                        className="underline underline-offset-4"
                      >
                        página do evento
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
              {str(raw.title) ? (
                <div>
                  <dt className="text-muted">Título lido</dt>
                  <dd>{str(raw.title)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted">Sítio lido</dt>
                <dd>{str(raw.venueName) || <span className="text-muted">nenhum</span>}</dd>
              </div>
              {proposedDates.length > 0 ? (
                <div>
                  <dt className="text-muted">Datas lidas</dt>
                  <dd>
                    {proposedDates
                      .map((s) => (s.start ? `${s.date} às ${s.start}` : s.date))
                      .join(' · ')}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted">Sem texto.</p>
          )}

          {attachmentLinks.length > 0 ? (
            <>
              <h3 className="mt-4 font-medium">Anexos</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {attachmentLinks.map((attachment) => (
                  <li key={attachment.id}>
                    {attachment.url ? (
                      <a
                        href={attachment.url}
                        rel="noopener noreferrer"
                        target="_blank"
                        aria-label={`${attachment.filename ?? attachment.storage_path} (abre noutro separador)`}
                        className="underline underline-offset-4"
                      >
                        {attachment.filename ?? attachment.storage_path}
                      </a>
                    ) : (
                      (attachment.filename ?? attachment.storage_path)
                    )}{' '}
                    <span className="text-muted">
                      ({attachment.mime_type}, {Math.round(attachment.size_bytes / 1024)} kB)
                    </span>
                    {attachment.ocr_text ? (
                      <details className="mt-1">
                        <summary className="min-h-11 cursor-pointer py-2.5 text-muted">
                          Texto extraído
                        </summary>
                        <pre className="mt-1 whitespace-pre-wrap text-xs">
                          {attachment.ocr_text}
                        </pre>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {duplicates.length > 0 ? (
            <section aria-labelledby="duplicados" className="mt-6">
              <h3 id="duplicados" className="font-medium text-highlight">
                Pode já cá estar
              </h3>
              <p className="text-sm text-muted">Nada é fundido sozinho — decide-se aqui.</p>
              <ul className="mt-2 space-y-1 text-sm">
                {duplicates.map((candidate) => (
                  <li key={candidate.event_id}>
                    {candidate.title}
                    {candidate.date_start ? ` · ${candidate.date_start}` : ''} ·{' '}
                    {Math.round(candidate.similarity * 100)}% semelhante
                    {candidate.exact_fingerprint ? ' · impressão digital igual' : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>

        <section aria-labelledby="editar">
          <h2 id="editar" className="text-lg font-semibold">
            Publicar
          </h2>

          <form action={approveSubmission} className="mt-3 space-y-4">
            <input type="hidden" name="submission_id" value={submission.id} />
            <input type="hidden" name="proposed" value={JSON.stringify(proposed)} />

            <div>
              <label htmlFor="title" className={LABEL}>
                Título <span className="font-normal text-muted">(obrigatório)</span>
              </label>
              <input
                id="title"
                name="title"
                required
                defaultValue={proposed.title}
                className={FIELD}
              />
            </div>

            <div>
              <label htmlFor="description" className={LABEL}>
                Descrição
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                defaultValue={proposed.description}
                className={FIELD}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="municipality_id" className={LABEL}>
                  Concelho <span className="font-normal text-muted">(obrigatório)</span>
                </label>
                <select
                  id="municipality_id"
                  name="municipality_id"
                  required
                  defaultValue={proposed.municipality_id}
                  className={FIELD}
                >
                  <option value="">—</option>
                  {municipalities.map((municipality) => (
                    <option key={municipality.id} value={municipality.id}>
                      {municipality.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="category_slug" className={LABEL}>
                  Categoria
                </label>
                <select
                  id="category_slug"
                  name="category_slug"
                  defaultValue={proposed.category_slug}
                  className={FIELD}
                >
                  <option value="">—</option>
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="venue_id" className={LABEL}>
                  Espaço
                </label>
                <select
                  id="venue_id"
                  name="venue_id"
                  defaultValue={proposed.venue_id}
                  className={FIELD}
                >
                  <option value="">— (local livre)</option>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="location_name" className={LABEL}>
                  Local livre
                </label>
                <input
                  id="location_name"
                  name="location_name"
                  defaultValue={proposed.location_name}
                  className={FIELD}
                />
              </div>
            </div>

            <fieldset aria-describedby="sessoes-ajuda">
              <legend className={LABEL}>Sessões</legend>
              <p id="sessoes-ajuda" className="text-sm text-muted">
                Uma linha por ocorrência. Linhas sem data são ignoradas.
              </p>
              <div className="mt-2 space-y-2">
                {Array.from({ length: SESSION_ROWS }, (_, index) => {
                  const proposedSession = proposedDates[index];
                  return (
                    <div key={index} className="flex flex-wrap gap-2">
                      <span className="sr-only">Sessão {index + 1}</span>
                      <input
                        type="date"
                        name="session_date"
                        aria-label={`Data da sessão ${index + 1}`}
                        defaultValue={proposedSession?.date ?? ''}
                        className="min-h-11 rounded border border-field bg-surface px-3 py-2 text-base text-ink"
                      />
                      <input
                        type="time"
                        name="session_start"
                        aria-label={`Hora de início da sessão ${index + 1}`}
                        defaultValue={proposedSession?.start ?? ''}
                        className="min-h-11 rounded border border-field bg-surface px-3 py-2 text-base text-ink"
                      />
                      <input
                        type="time"
                        name="session_end"
                        aria-label={`Hora de fim da sessão ${index + 1}`}
                        defaultValue={proposedSession?.end ?? ''}
                        className="min-h-11 rounded border border-field bg-surface px-3 py-2 text-base text-ink"
                      />
                    </div>
                  );
                })}
              </div>
              {/* Um período, não sessões. O formulário público guarda «de X a
                  Y» como os dois extremos mais `is_ongoing` (build-row.ts): as
                  duas linhas propostas são o dia de abrir e o de fechar, e a
                  ficha escreve «em cartaz de X a Y». Sem a caixa, a aprovação
                  deixava cair o `is_ongoing` e publicava dois espetáculos. */}
              <label
                htmlFor="is_ongoing"
                className="mt-3 flex min-h-11 items-center gap-2.5 text-sm font-medium"
              >
                <input
                  type="checkbox"
                  id="is_ongoing"
                  name="is_ongoing"
                  defaultChecked={payload.is_ongoing === true}
                  aria-describedby="is-ongoing-ajuda"
                  className="size-5 accent-accent"
                />
                Em cartaz: um período, não sessões soltas
              </label>
              <p id="is-ongoing-ajuda" className="text-sm text-muted">
                Uma exposição «de X a Y», um festival de três dias: a primeira e a última linha são
                o dia de abrir e o de fechar, e a ficha diz «em cartaz». Desligado, cada linha é uma
                sessão.
              </p>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* O rótulo leva a altura toda: a caixa tem 20 px, o alvo é a
                  linha inteira — como nos filtros da agenda pública. */}
              <label
                htmlFor="is_free"
                className="flex min-h-11 items-center gap-2.5 text-sm font-medium"
              >
                <input
                  type="checkbox"
                  id="is_free"
                  name="is_free"
                  defaultChecked={proposed.is_free}
                  className="size-5 accent-accent"
                />
                Entrada livre
              </label>

              <div>
                <label htmlFor="price_display" className={LABEL}>
                  Preço
                </label>
                <input
                  id="price_display"
                  name="price_display"
                  defaultValue={proposed.price_display}
                  className={FIELD}
                />
              </div>

              <div>
                <label htmlFor="ticketing_url" className={LABEL}>
                  Bilhética
                </label>
                <input
                  id="ticketing_url"
                  name="ticketing_url"
                  type="url"
                  defaultValue={proposed.ticketing_url}
                  className={FIELD}
                />
              </div>

              <div>
                <label htmlFor="image_url" className={LABEL}>
                  Imagem
                </label>
                <input
                  id="image_url"
                  name="image_url"
                  type="url"
                  defaultValue={proposed.image_url}
                  className={FIELD}
                />
              </div>
            </div>

            <div>
              <label htmlFor="how_to_arrive" className={LABEL}>
                Como chegar
              </label>
              <textarea
                id="how_to_arrive"
                name="how_to_arrive"
                rows={2}
                defaultValue={proposed.how_to_arrive}
                className={FIELD}
              />
            </div>

            <div>
              <label htmlFor="accessibility_notes" className={LABEL}>
                Notas de acessibilidade
              </label>
              <textarea
                id="accessibility_notes"
                name="accessibility_notes"
                rows={2}
                defaultValue={proposed.accessibility_notes}
                className={FIELD}
              />
            </div>

            <button
              type="submit"
              disabled={isResolved}
              aria-describedby="aprovar-ajuda"
              className="inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
            >
              Aprovar e publicar
            </button>
            <p id="aprovar-ajuda" className="text-sm text-muted">
              Os campos que corrigires ficam bloqueados: a recolha da noite seguinte não os volta a
              escrever por cima.
            </p>
          </form>

          <form action={rejectSubmission} className="mt-8 space-y-3 border-t border-border pt-6">
            <input type="hidden" name="submission_id" value={submission.id} />
            <div>
              <label htmlFor="status" className={LABEL}>
                Não publicar porque
              </label>
              <select id="status" name="status" className={FIELD} defaultValue="rejected">
                <option value="rejected">Não serve para a agenda</option>
                <option value="duplicate">Já cá está</option>
                <option value="needs_info">Falta informação — vou perguntar</option>
              </select>
            </div>
            <div>
              <label htmlFor="duplicate_of" className={LABEL}>
                Id do evento duplicado (opcional)
              </label>
              <input id="duplicate_of" name="duplicate_of" className={FIELD} />
            </div>
            <div>
              <label htmlFor="notes" className={LABEL}>
                Notas
              </label>
              <textarea id="notes" name="notes" rows={2} className={FIELD} />
            </div>
            <button
              type="submit"
              disabled={isResolved}
              className="inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium disabled:opacity-50"
            >
              Registar decisão
            </button>
          </form>

          <form action={mergeEvents} className="mt-8 space-y-3 border-t border-border pt-6">
            <input type="hidden" name="municipality_id" value={proposed.municipality_id} />
            <h3 className="font-medium">Fundir dois eventos</h3>
            <p className="text-sm text-muted">
              As sessões do duplicado passam para o canónico; o duplicado fica arquivado.
            </p>
            <div>
              <label htmlFor="canonical_id" className={LABEL}>
                Fica (id)
              </label>
              <input id="canonical_id" name="canonical_id" className={FIELD} />
            </div>
            <div>
              <label htmlFor="duplicate_id" className={LABEL}>
                Sai (id)
              </label>
              <input id="duplicate_id" name="duplicate_id" className={FIELD} />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium"
            >
              Fundir
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
