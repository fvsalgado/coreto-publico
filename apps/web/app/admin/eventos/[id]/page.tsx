import { emLisboa } from '@coreto/core/dates';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CamposDoEvento } from '@/src/components/CamposDoEvento';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import {
  atualizarEvento,
  bulkSetEventStatus,
  destrancarCampo,
  mergeEvents,
} from '@/src/lib/admin/actions';
import { ambitoDoPainel } from '@/src/lib/admin/ambito';
import { fraseDoMotivo, resumoDoCandidato } from '@/src/lib/admin/duplicados';
import { valoresDoEvento } from '@/src/lib/admin/fields';
import { ligacoesPublicas } from '@/src/lib/admin/ligacoes';
import { pareceInformacaoMunicipal, REGRA_DO_QUE_E_PROGRAMACAO } from '@/src/lib/admin/moderacao';
import { pode } from '@/src/lib/admin/papeis';
import {
  camposTrancados,
  candidatosADuplicado,
  lerEventoParaCorrigir,
  nomeDaFonte,
  sessoesDoEvento,
} from '@/src/lib/admin/queries';
import { CAMPO_DO_EVENTO, ESTADO_DO_EVENTO, rotulo } from '@/src/lib/admin/rotulos';
import { hasServiceRole } from '@/src/lib/env';
import { formatLongDate } from '@/src/lib/format';
import {
  listCategories,
  listMunicipalitiesDeTodas,
  listSeriesDeTodas,
  listVenuesDeTodas,
} from '@/src/lib/queries/events';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Corrigir um evento' };

interface Props {
  params: Promise<{ id: string }>;
  /** `fundir` é o segundo passo de «Fundir neste» — a confirmação. */
  searchParams: Promise<{ aviso?: string; fundir?: string }>;
}

const BOTAO =
  'inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium';
const BOTAO_PRINCIPAL =
  'inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent';

/** «2 de outubro de 2026», no dia de Lisboa. */
function diaDe(instante: string): string {
  return formatLongDate(emLisboa(Date.parse(instante)).date);
}

/**
 * Corrigir um evento publicado (C4-017).
 *
 * Não havia onde: a lista de eventos só mudava estados em lote, e a hora
 * errada, o preço que faltou ou o espaço trocado corrigiam-se por SQL. Esta
 * ficha pergunta pelos mesmos campos da aprovação (`CamposDoEvento`) e grava
 * pela `update_event` (0173): só o que mudou, com rasto, e trancado contra a
 * recolha da noite seguinte — as datas incluídas.
 *
 * À volta do formulário, o que se decide sobre o evento inteiro: tirá-lo da
 * agenda ou voltar a publicá-lo, destrancar o que já não precisa de cadeado,
 * e juntar-lhe um repetido.
 */
export default async function CorrigirEvento({ params, searchParams }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Corrigir um evento" />;

  const { id } = await params;
  const query = await searchParams;
  const ambito = await ambitoDoPainel();
  const evento = await lerEventoParaCorrigir(id);
  if (!evento) notFound();

  // Um evento de uma região onde esta sessão não modera responde como um que
  // não existe — como a ficha da fila (C4-015).
  const regiao = ambito.regiaoDoConcelho.get(evento.municipality_id) ?? null;
  if (!pode(ambito.sessao, regiao, 'editor')) notFound();

  const regioesDaSessao = new Set(ambito.disponiveis.map((linha) => linha.id));
  const arquivado = evento.status === 'archived';
  const sessoes = await sessoesDoEvento(evento.id);
  const [trancados, todosOsConcelhos, categorias, todosOsEspacos, todosOsCiclos, fonte, parecidos] =
    await Promise.all([
      camposTrancados(evento.id),
      listMunicipalitiesDeTodas(),
      listCategories(),
      listVenuesDeTodas(),
      listSeriesDeTodas(),
      nomeDaFonte(evento.source_id),
      // Os repetidos deste evento, pelo espaço, dia e hora da primeira sessão
      // (0172) — o caso que o C4-014 encontrou em produção: o mesmo curso duas
      // vezes, no mesmo dia e espaço, às 14h30 e às 16h30.
      arquivado
        ? Promise.resolve([])
        : candidatosADuplicado({
            title: evento.title,
            date: evento.date_start,
            municipalityId: evento.municipality_id,
            venueId: evento.venue_id,
            startTime: sessoes[0]?.start_time ?? null,
            excluir: evento.id,
          }),
    ]);

  // As escolhas são só das regiões onde esta sessão modera — e a ação volta
  // a perguntá-lo, do lado dela.
  const concelhos = todosOsConcelhos.filter((concelho) => regioesDaSessao.has(concelho.region_id));
  const concelhosDaSessao = new Set(concelhos.map((concelho) => concelho.id));
  const espacos = todosOsEspacos.filter((espaco) => concelhosDaSessao.has(espaco.municipality_id));
  const ciclos = todosOsCiclos.filter((ciclo) => regioesDaSessao.has(ciclo.region_id));
  const nomeDaRegiao = new Map(ambito.disponiveis.map((linha) => [linha.id, linha.name]));

  const ligacoes = ligacoesPublicas(
    ambito.disponiveis,
    ambito.regiaoDoConcelho,
    (await headers()).get('host'),
  );
  const fichaPublica =
    evento.status === 'published' ? ligacoes.daRegiao(regiao, `/evento/${evento.slug}`) : null;
  const estaFicha = `/admin/eventos/${encodeURIComponent(evento.id)}`;
  const aFundir = query.fundir
    ? (parecidos.find((candidato) => candidato.event_id === query.fundir) ?? null)
    : null;

  return (
    <>
      <PageHeader title={evento.title} eyebrow="Corrigir um evento">
        <p className="mt-1 text-sm text-muted">
          {rotulo(ESTADO_DO_EVENTO, evento.status)} ·{' '}
          {ambito.nomeDoConcelho.get(evento.municipality_id) ?? evento.municipality_id} · última
          alteração a {diaDe(evento.updated_at)}
          {fichaPublica ? (
            <>
              {' · '}
              <a
                href={fichaPublica}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                ver no sítio<span className="sr-only"> (abre noutro separador)</span>
              </a>
            </>
          ) : null}
        </p>
      </PageHeader>

      {query.aviso ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          {query.aviso}
        </p>
      ) : null}

      {/* A regra do que é programação (C2-022): um aviso que já está na
          agenda não sai sozinho — despublicar é decisão de quem modera. */}
      {evento.status === 'published' && pareceInformacaoMunicipal(evento.title) ? (
        <p className="mb-6 rounded border border-highlight px-3 py-2 text-sm">
          <strong>A regra da agenda:</strong> {REGRA_DO_QUE_E_PROGRAMACAO} Se não é, tira-o da
          agenda — o botão está em «Na agenda».
        </p>
      ) : null}

      {arquivado ? (
        <p className="mb-6 rounded border border-highlight px-3 py-2 text-sm">
          Este evento está arquivado: saiu da agenda, ou foi fundido noutro. Já não aparece em lado
          nenhum, e corrigi-lo não mudava nada.
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <aside aria-label="O evento inteiro" className="space-y-6 lg:order-2">
          {!arquivado ? (
            <section aria-labelledby="estado" className="rounded border border-border p-4">
              <h2 id="estado" className="font-semibold">
                Na agenda
              </h2>
              <p className="mt-1 text-sm">
                {evento.status === 'published'
                  ? 'Está publicado: aparece nas listas, no mapa e na ficha pública.'
                  : `Está em «${rotulo(ESTADO_DO_EVENTO, evento.status)}»: não aparece a quem visita.`}
              </p>
              <form action={bulkSetEventStatus} className="mt-3">
                <input type="hidden" name="ids" value={evento.id} />
                <input
                  type="hidden"
                  name="status"
                  value={evento.status === 'published' ? 'draft' : 'published'}
                />
                <input type="hidden" name="voltar" value={estaFicha} />
                <button type="submit" className={BOTAO}>
                  {evento.status === 'published' ? 'Tirar da agenda' : 'Publicar'}
                </button>
              </form>
            </section>
          ) : null}

          <section aria-labelledby="origem" className="rounded border border-border p-4">
            <h2 id="origem" className="font-semibold">
              De onde veio
            </h2>
            {evento.source_id ? (
              <p className="mt-1 text-sm">
                Da recolha da fonte «{fonte ?? evento.source_id}».
                {evento.source_url ? (
                  <>
                    {' '}
                    <a
                      href={evento.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      A página lida na fonte
                      <span className="sr-only"> (abre noutro separador)</span>
                    </a>
                    .
                  </>
                ) : null}{' '}
                Todas as noites a recolha volta a lê-la — e escreve por cima de tudo o que não
                estiver trancado.
              </p>
            ) : evento.submission_id ? (
              <p className="mt-1 text-sm">
                Chegou pela fila de moderação.{' '}
                <Link
                  href={`/admin/fila/${encodeURIComponent(evento.submission_id)}`}
                  className="underline underline-offset-4"
                >
                  Ver a proposta
                </Link>
                .
              </p>
            ) : (
              <p className="mt-1 text-sm">Foi escrito à mão, sem fonte nem proposta.</p>
            )}
          </section>

          {trancados.length > 0 ? (
            <section aria-labelledby="trancados" className="rounded border border-border p-4">
              <h2 id="trancados" className="font-semibold">
                Trancados contra a recolha
              </h2>
              <p className="mt-1 text-sm text-muted">
                Foram corrigidos à mão, e a recolha não lhes volta a escrever por cima. Destranca
                quando a fonte já disser o mesmo.
              </p>
              <ul className="mt-3 space-y-3">
                {trancados.map((trancado) => (
                  <li key={trancado.field} className="text-sm">
                    <p>
                      <strong>{rotulo(CAMPO_DO_EVENTO, trancado.field)}</strong> — por{' '}
                      {trancado.actor}, a {diaDe(trancado.created_at)}
                      {trancado.note ? ` (${trancado.note})` : ''}
                    </p>
                    {!arquivado ? (
                      <form action={destrancarCampo} className="mt-1">
                        <input type="hidden" name="event_id" value={evento.id} />
                        <input type="hidden" name="campo" value={trancado.field} />
                        <button
                          type="submit"
                          className={BOTAO}
                          aria-label={`Destrancar ${rotulo(CAMPO_DO_EVENTO, trancado.field)}`}
                        >
                          Destrancar
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {parecidos.length > 0 ? (
            <section aria-labelledby="parecidos" className="rounded border-2 border-highlight p-4">
              <h2 id="parecidos" className="font-semibold text-highlight">
                Pode estar na agenda duas vezes
              </h2>
              <p className="mt-1 text-sm text-muted">
                «Fundir neste» junta as datas do outro a este evento e tira o outro da agenda. Nada
                se junta sozinho.
              </p>
              <ul className="mt-3 space-y-4">
                {parecidos.map((candidato) => (
                  <li key={candidato.event_id} className="text-sm">
                    <p className="font-medium">
                      <Link
                        href={`/admin/eventos/${encodeURIComponent(candidato.event_id)}`}
                        className="underline underline-offset-4"
                      >
                        {candidato.title}
                      </Link>
                    </p>
                    <p className="text-muted">
                      {resumoDoCandidato(candidato)} · {fraseDoMotivo(candidato)}
                    </p>
                    {aFundir?.event_id === candidato.event_id ? (
                      <div
                        id="fundir"
                        role="group"
                        aria-labelledby="fundir-titulo"
                        className="mt-2 rounded border border-border bg-surface p-3"
                      >
                        <p id="fundir-titulo" className="font-medium">
                          Fundir «{candidato.title}» neste evento?
                        </p>
                        <p className="mt-1">
                          As datas dele passam para este, e ele sai da agenda (fica arquivado). Os
                          campos deste evento ficam como estão.
                        </p>
                        <form action={mergeEvents} className="mt-3 flex flex-wrap gap-2">
                          <input type="hidden" name="canonical_id" value={evento.id} />
                          <input type="hidden" name="duplicate_id" value={candidato.event_id} />
                          <input
                            type="hidden"
                            name="municipality_id"
                            value={evento.municipality_id}
                          />
                          <input type="hidden" name="voltar" value={estaFicha} />
                          <button type="submit" className={BOTAO_PRINCIPAL}>
                            Confirmar: fundir
                          </button>
                          <Link href={`${estaFicha}#parecidos`} className={BOTAO}>
                            Voltar sem decidir
                          </Link>
                        </form>
                      </div>
                    ) : (
                      <Link
                        href={`${estaFicha}?fundir=${encodeURIComponent(candidato.event_id)}#fundir`}
                        className={`${BOTAO} mt-2`}
                      >
                        Fundir neste
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>

        {!arquivado ? (
          <section aria-labelledby="corrigir-titulo" className="lg:order-1">
            <h2 id="corrigir-titulo" className="text-lg font-semibold">
              Corrigir
            </h2>
            <form id="corrigir" action={atualizarEvento} className="mt-3 space-y-4">
              <input type="hidden" name="event_id" value={evento.id} />
              <CamposDoEvento
                valores={valoresDoEvento(evento)}
                sessoes={sessoes.map((sessao) => ({
                  date: sessao.session_date,
                  start: sessao.start_time?.slice(0, 5) ?? '',
                  end: sessao.end_time?.slice(0, 5) ?? '',
                }))}
                emCartaz={evento.is_ongoing}
                concelhos={concelhos}
                categorias={categorias}
                espacos={espacos}
                ciclos={ciclos}
                nomeDaRegiao={nomeDaRegiao}
                contexto="corrigir"
                notaDaDescricao={
                  evento.source_id ? (
                    // O que a moderadora vê quando a recolha arrumou o texto
                    // (C2-022): a recolha corta o título repetido, a tabela de
                    // datas e os rótulos soltos — e às vezes corta de mais.
                    <p className="mt-1 text-sm text-muted">
                      A recolha arruma o texto da fonte: tira o título repetido no início, a tabela
                      de datas no fim e rótulos soltos como «Organização». Se ficou cortado ou
                      estranho, compara com a página lida na fonte e corrige aqui.
                    </p>
                  ) : null
                }
              />
              <div>
                <button type="submit" aria-describedby="corrigir-ajuda" className={BOTAO_PRINCIPAL}>
                  Guardar as correções
                </button>
                <p id="corrigir-ajuda" className="mt-2 text-sm text-muted">
                  Só o que mudar se grava, e fica trancado contra a recolha — as datas também. O
                  endereço da ficha não muda: pode já ter sido partilhado.
                </p>
              </div>
            </form>
          </section>
        ) : null}
      </div>

      {!arquivado ? (
        <>
          {/* No telemóvel, o botão de guardar fica à vista (C4-019). */}
          <div aria-hidden="true" className="h-20 sm:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-paper px-4 py-3 sm:hidden">
            <button
              type="submit"
              form="corrigir"
              className="inline-flex min-h-11 w-full items-center justify-center rounded bg-accent px-4 text-sm font-medium text-on-accent"
            >
              Guardar as correções
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
