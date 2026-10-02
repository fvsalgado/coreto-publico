import { addDays, emLisboa, todayInLisbon } from '@coreto/core/dates';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { ligarFonte, pausarFonte, reabrirFonte, retomarFonte } from '@/src/lib/admin/actions';
import { ambitoDoPainel } from '@/src/lib/admin/ambito';
import {
  erroEmPortugues,
  estadoDaFonte,
  MOTIVO_MAXIMO,
  PAUSA_MAXIMA_DIAS,
} from '@/src/lib/admin/fontes';
import { pode } from '@/src/lib/admin/papeis';
import { lerFonte, listRecentRuns } from '@/src/lib/admin/queries';
import { ESTADO_DA_RECOLHA, rotulo } from '@/src/lib/admin/rotulos';
import { hasServiceRole } from '@/src/lib/env';
import { formatLongDate, formatTime } from '@/src/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Fonte' };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}

const CAMPO =
  'mt-1 min-h-11 w-full max-w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';
const BOTAO =
  'inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium';
const BOTAO_CHEIO =
  'inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent';

/** «2 de outubro de 2026, 06h15», na hora de Lisboa. */
function quando(instante: string | null): string {
  if (!instante) return '—';
  const { date, time } = emLisboa(Date.parse(instante));
  return `${formatLongDate(date)}, ${formatTime(time) ?? time}`;
}

/**
 * A ficha de uma fonte (C4-032).
 *
 * O que o painel não tinha: o erro por extenso — e dito em português —, o
 * endereço que se lê, as últimas leituras, e os gestos que eram SQL no manual
 * de operação. Pausar com prazo e motivo, retomar, reabrir a pausa automática,
 * ligar e desligar: cada um pela sua função da base (0174), com rasto, e só
 * para quem gere a região da fonte. Quem modera vê a ficha inteira, sem os
 * botões; quem opera o Coreto vê também a configuração do adaptador.
 */
export default async function FichaDaFonte({ params, searchParams }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Fonte" />;

  const { id } = await params;
  const { aviso } = await searchParams;
  const ambito = await ambitoDoPainel();
  const fonte = await lerFonte(id);
  if (!fonte) notFound();

  // Uma fonte de uma região onde esta sessão não modera responde como uma que
  // não existe (C4-015).
  const regiao =
    fonte.region_id ??
    (fonte.municipality_id ? ambito.regiaoDoConcelho.get(fonte.municipality_id) : null) ??
    null;
  if (!pode(ambito.sessao, regiao, 'editor')) notFound();
  const gere = pode(ambito.sessao, regiao, 'gestor');
  const dono = ambito.sessao.tipo === 'dono';

  const leituras = await listRecentRuns(15, [fonte.id]);
  const estado = estadoDaFonte(fonte);
  const erro = erroEmPortugues(fonte.last_error);
  const hoje = todayInLisbon();
  const nomeDaRegiao = ambito.disponiveis.find((linha) => linha.id === regiao)?.name;

  return (
    <>
      <PageHeader
        title={fonte.name}
        eyebrow="Fonte"
        migalhas={[
          { href: '/admin', label: 'Painel' },
          { href: '/admin/fontes', label: 'Fontes' },
          // A última é esta página: as migalhas mostram as que vêm antes.
          { href: `/admin/fontes/${encodeURIComponent(fonte.id)}`, label: fonte.name },
        ]}
      >
        <p className={`mt-1 text-sm ${estado.alerta ? 'text-highlight' : 'text-muted'}`}>
          {estado.rotulo}
          {fonte.municipality_id
            ? ` · ${ambito.nomeDoConcelho.get(fonte.municipality_id) ?? fonte.municipality_id}`
            : nomeDaRegiao
              ? ` · ${nomeDaRegiao}`
              : ''}
          {fonte.url ? (
            <>
              {' · '}
              <a
                href={fonte.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                a página que se lê<span className="sr-only"> (abre noutro separador)</span>
              </a>
            </>
          ) : null}
        </p>
      </PageHeader>

      {aviso ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          {aviso}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-8">
          <section aria-labelledby="passa">
            <h2 id="passa" className="text-lg font-semibold">
              O que se passa
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted">Último sucesso</dt>
                <dd>
                  {fonte.last_success_at
                    ? `${quando(fonte.last_success_at)} (há ${fonte.hours_since_success} h)`
                    : 'nunca'}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Falhas seguidas</dt>
                <dd>{fonte.consecutive_failures}</dd>
              </div>
              {fonte.breaker_open ? (
                <div>
                  <dt className="text-muted">Pausa automática</dt>
                  <dd>
                    Até {quando(fonte.circuit_open_until)}. A recolha deixou de a tentar depois de
                    várias falhas seguidas, para não gastar a noite num sítio em baixo; nesse dia
                    tenta outra vez sozinha.
                  </dd>
                </div>
              ) : null}
              {fonte.em_pausa ? (
                <div>
                  <dt className="text-muted">Em pausa, por decisão</dt>
                  <dd>
                    Até {quando(fonte.pausada_ate)}: {fonte.pausa_motivo}
                  </dd>
                </div>
              ) : null}
              {fonte.last_error ? (
                <div>
                  <dt className="text-muted">O último erro</dt>
                  <dd>
                    {erro ?? 'A recolha escreveu-o assim:'}
                    <details className="mt-1">
                      <summary className="min-h-11 cursor-pointer py-2.5 text-muted">
                        O erro como a recolha o escreveu
                      </summary>
                      <pre
                        tabIndex={0}
                        className="mt-1 max-h-64 overflow-auto rounded border border-border bg-surface p-2 text-xs whitespace-pre-wrap"
                      >
                        {fonte.last_error}
                      </pre>
                    </details>
                  </dd>
                </div>
              ) : null}
              {fonte.notes ? (
                <div>
                  <dt className="text-muted">Notas de quem opera</dt>
                  <dd className="whitespace-pre-wrap">{fonte.notes}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section aria-labelledby="leituras">
            <h2 id="leituras" className="text-lg font-semibold">
              As últimas leituras
            </h2>
            {leituras.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Ainda não foi lida nenhuma vez.</p>
            ) : (
              <ul className="mt-2 border-t border-border text-sm">
                {leituras.map((leitura) => (
                  <li key={leitura.id} className="border-b border-border py-2">
                    <p>
                      {quando(leitura.started_at)} ·{' '}
                      <strong>{rotulo(ESTADO_DA_RECOLHA, leitura.status)}</strong> ·{' '}
                      {leitura.items_found}{' '}
                      {leitura.items_found === 1 ? 'evento encontrado' : 'eventos encontrados'},{' '}
                      {leitura.items_new} {leitura.items_new === 1 ? 'novo' : 'novos'},{' '}
                      {leitura.items_updated} {leitura.items_updated === 1 ? 'mudou' : 'mudaram'}
                      {leitura.items_rejected > 0 ? `, ${leitura.items_rejected} recusados` : ''}
                    </p>
                    {leitura.layout_drift ? (
                      <p className="text-highlight">A página parece ter mudado de forma.</p>
                    ) : null}
                    {leitura.error ? (
                      <p className="text-muted">
                        {erroEmPortugues(leitura.error) ?? leitura.error}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {dono ? (
            <section aria-labelledby="configuracao">
              <h2 id="configuracao" className="text-lg font-semibold">
                Como se lê
              </h2>
              <p className="mt-1 text-sm text-muted">
                O adaptador «{fonte.adapter}», para uma fonte do tipo «{fonte.kind}». Muda-se por
                migração, com proveniência — não aqui.
              </p>
              <pre
                tabIndex={0}
                className="mt-2 max-h-80 overflow-auto rounded border border-border bg-surface p-3 text-xs"
              >
                {JSON.stringify(fonte.config ?? {}, null, 2)}
              </pre>
            </section>
          ) : null}
        </div>

        <aside aria-labelledby="gestos" className="space-y-6">
          <h2 id="gestos" className="text-lg font-semibold">
            O que se pode fazer
          </h2>
          {!gere ? (
            <p className="text-sm text-muted">
              Pausar, reabrir, ligar e desligar uma fonte é de quem gere a região. Se esta precisa
              de alguma destas coisas, diz-lho.
            </p>
          ) : (
            <>
              {fonte.breaker_open || fonte.consecutive_failures > 0 ? (
                <section className="rounded border border-border p-4">
                  <h3 className="font-semibold">Voltar a tentar</h3>
                  <p className="mt-1 text-sm text-muted">
                    Para quando o sítio da fonte já voltou: a pausa automática acaba, as falhas
                    seguidas voltam a zero, e a fonte é lida na próxima recolha.
                  </p>
                  <form action={reabrirFonte} className="mt-3">
                    <input type="hidden" name="fonte" value={fonte.id} />
                    <button type="submit" className={BOTAO_CHEIO}>
                      Voltar a tentar na próxima recolha
                    </button>
                  </form>
                </section>
              ) : null}

              {fonte.em_pausa ? (
                <section className="rounded border border-border p-4">
                  <h3 className="font-semibold">Acabar a pausa já</h3>
                  <p className="mt-1 text-sm text-muted">
                    A fonte volta a contar para o alarme do painel e da página /estado.
                  </p>
                  <form action={retomarFonte} className="mt-3">
                    <input type="hidden" name="fonte" value={fonte.id} />
                    <button type="submit" className={BOTAO}>
                      Acabar a pausa
                    </button>
                  </form>
                </section>
              ) : null}

              {fonte.is_enabled ? (
                <section className="rounded border border-border p-4">
                  <h3 className="font-semibold">
                    {fonte.em_pausa ? 'Mudar a pausa' : 'Pôr em pausa, até um dia'}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    Para uma fonte parada por uma razão conhecida — uma carta à espera de resposta,
                    um sítio em obras. A recolha continua a tentar; o alarme cala-se até esse dia, e
                    volta sozinho nele. No máximo {PAUSA_MAXIMA_DIAS} dias.
                  </p>
                  <form action={pausarFonte} className="mt-3 space-y-3">
                    <input type="hidden" name="fonte" value={fonte.id} />
                    <div>
                      <label htmlFor="ate" className="block text-sm font-medium">
                        Em pausa até
                      </label>
                      <input
                        id="ate"
                        name="ate"
                        type="date"
                        required
                        min={addDays(hoje, 1)}
                        max={addDays(hoje, PAUSA_MAXIMA_DIAS)}
                        defaultValue={addDays(hoje, 7)}
                        className={CAMPO}
                      />
                    </div>
                    <div>
                      <label htmlFor="motivo" className="block text-sm font-medium">
                        Porquê
                      </label>
                      <textarea
                        id="motivo"
                        name="motivo"
                        required
                        rows={2}
                        maxLength={MOTIVO_MAXIMO}
                        aria-describedby="motivo-ajuda"
                        className={CAMPO}
                      />
                      <p id="motivo-ajuda" className="mt-1 text-sm text-muted">
                        Aparece na página pública /estado da região: escreve-o para quem a visita —
                        «à espera de resposta da câmara».
                      </p>
                    </div>
                    <button type="submit" className={BOTAO}>
                      Pôr em pausa
                    </button>
                  </form>
                </section>
              ) : null}

              <section className="rounded border border-border p-4">
                <h3 className="font-semibold">
                  {fonte.is_enabled ? 'Desligar a fonte' : 'Ligar a fonte'}
                </h3>
                {fonte.is_enabled ? (
                  <>
                    <p className="mt-1 text-sm text-muted">
                      Para quando a fonte não deve voltar — o município pediu, a agenda mudou de
                      sítio. Ao contrário da pausa, não tem data: deixa de ser lida até alguém a
                      voltar a ligar. Os eventos que ela já trouxe ficam como estão.
                    </p>
                    <form action={ligarFonte} className="mt-3 space-y-3">
                      <input type="hidden" name="fonte" value={fonte.id} />
                      <input type="hidden" name="ligar" value="0" />
                      <div>
                        <label htmlFor="motivo-desligar" className="block text-sm font-medium">
                          Porquê
                        </label>
                        <input
                          id="motivo-desligar"
                          name="motivo"
                          required
                          maxLength={MOTIVO_MAXIMO}
                          className={CAMPO}
                        />
                      </div>
                      <label className="flex min-h-11 items-center gap-2.5 text-sm">
                        <input
                          type="checkbox"
                          name="confirmo"
                          required
                          className="size-5 accent-accent"
                        />
                        Confirmo que a fonte deixa de ser lida
                      </label>
                      <button type="submit" className={BOTAO}>
                        Desligar
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-muted">Volta a ser lida na próxima recolha.</p>
                    <form action={ligarFonte} className="mt-3">
                      <input type="hidden" name="fonte" value={fonte.id} />
                      <input type="hidden" name="ligar" value="1" />
                      <button type="submit" className={BOTAO_CHEIO}>
                        Ligar
                      </button>
                    </form>
                  </>
                )}
              </section>

              <p className="text-sm text-muted">
                Cada um destes gestos fica na auditoria, com o teu nome.{' '}
                <Link href="/admin/fontes" className="underline underline-offset-4">
                  Voltar às fontes
                </Link>
              </p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
