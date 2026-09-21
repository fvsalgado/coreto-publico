import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MINIMO_DE_DESTAQUES } from '@coreto/core';
import { PageHeader } from '@/src/components/PageHeader';
import {
  definirAlvoDeDestaques,
  fixarDestaque,
  largarDestaque,
  moverDestaque,
} from '@/src/lib/admin/actions';
import {
  listCandidatosADestaque,
  listDestaquesDoPainel,
  listRegionsAdmin,
} from '@/src/lib/admin/queries';
import { formatEventDates } from '@/src/lib/format';
import { todayInLisbon } from '@coreto/core';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Montra da entrada' };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string; q?: string }>;
}

const BOTAO =
  'inline-flex min-h-11 items-center rounded border border-border bg-surface px-3 text-sm font-medium';
const BOTAO_CHEIO =
  'inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent';

/**
 * A montra da entrada, região a região.
 *
 * O que esta página existe para resolver: a fila de cartazes mostrava os
 * primeiros da semana por ordem de consulta, e isso não é uma escolha. Aqui
 * escolhe-se — e o que ficar por escolher preenche-se sozinho com a semana,
 * baralhada por dia, para a montra nunca ficar vazia por ninguém ter tido
 * tempo.
 *
 * As duas metades da página são as duas perguntas: **quantos cabem** e
 * **quais são**. O resto — a ordem por que aparecem, o que acontece quando um
 * fixado passa — está escrito ao lado de cada bloco, porque é a parte que não
 * se adivinha.
 */
export default async function DestaquesDaRegiaoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { aviso, q } = await searchParams;

  const regioes = await listRegionsAdmin();
  const regiao = regioes.find((linha) => linha.id === id);
  if (!regiao) notFound();

  const [fixados, candidatos] = await Promise.all([
    listDestaquesDoPainel(id),
    listCandidatosADestaque(id, q),
  ]);

  const hoje = todayInLisbon();
  const alvo = regiao.destaques_alvo ?? 12;
  const aMostrar = fixados.filter((linha) => !linha.passou);
  const porEncher = Math.max(0, alvo - aMostrar.length);
  const jaFixados = new Set(fixados.map((linha) => linha.event_id));

  return (
    <>
      <PageHeader
        title="Montra da entrada"
        eyebrow={regiao.name}
        lead="Os cartazes que abrem a página inicial. O que fixar aqui entra pela ordem que lhe der; o que faltar para chegar ao número é tirado à sorte da semana, e muda sozinho todos os dias."
        migalhas={[
          { href: '/admin', label: 'Painel' },
          { href: '/admin/regioes', label: 'Regiões' },
          { href: `/admin/regioes/${encodeURIComponent(id)}`, label: regiao.name },
        ]}
      />

      {aviso ? (
        <p role="status" className="mb-6 rounded border border-accent/40 bg-accent-soft px-4 py-3">
          {aviso}
        </p>
      ) : null}

      <section aria-labelledby="quantos" className="rounded-lg border border-border bg-surface p-4">
        <h2 id="quantos" className="font-display text-lg font-semibold">
          Quantos cabem
        </h2>
        <form action={definirAlvoDeDestaques} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="regiao" value={id} />
          <label htmlFor="alvo" className="text-sm">
            <span className="block font-medium">Cartazes na montra</span>
            <input
              type="number"
              id="alvo"
              name="alvo"
              min={0}
              max={24}
              defaultValue={alvo}
              className="mt-1 min-h-11 w-28 rounded border border-field bg-surface px-3 text-base"
            />
          </label>
          <button type="submit" className={BOTAO_CHEIO}>
            Guardar
          </button>
          <p className="max-w-prose text-sm text-muted">
            {alvo === 0
              ? 'A zero, a entrada não mostra montra nenhuma — fica só a lista por dias.'
              : `Abaixo de ${MINIMO_DE_DESTAQUES} a fila não se desenha: dois cartazes não são uma montra, e a lista por baixo mostra-os melhor.`}
          </p>
        </form>
      </section>

      <section aria-labelledby="fixados" className="mt-8">
        <h2 id="fixados" className="font-display text-lg font-semibold">
          Fixados por si
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          {aMostrar.length === 0
            ? `Nenhum. A montra está a ser preenchida inteiramente pela semana, à sorte — ${alvo} de cada vez.`
            : porEncher > 0
              ? `${aMostrar.length} ${aMostrar.length === 1 ? 'fixado' : 'fixados'}; ${porEncher} ${porEncher === 1 ? 'lugar é preenchido' : 'lugares são preenchidos'} pela semana.`
              : `${aMostrar.length} fixados, que é o que a montra leva. ${aMostrar.length > alvo ? `Os ${aMostrar.length - alvo} últimos não chegam a aparecer.` : 'Nada é tirado à sorte.'}`}
        </p>

        {fixados.length > 0 ? (
          <ol className="mt-4 grid gap-2">
            {fixados.map((linha, indice) => (
              <li
                key={linha.event_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-muted">
                    {formatEventDates(linha.date_start, linha.date_end, hoje)}
                    {linha.passou ? ' · já passou, não aparece' : ''}
                    {!linha.passou && indice >= alvo ? ' · fora do número, não aparece' : ''}
                    {linha.image_url === null ? ' · sem cartaz' : ''}
                  </p>
                  <p className="font-medium">{linha.title}</p>
                  <p className="text-xs text-muted">
                    Fixado por {linha.fixado_por} a {linha.fixado_em.slice(0, 10)}.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <form action={moverDestaque}>
                    <input type="hidden" name="regiao" value={id} />
                    <input type="hidden" name="evento" value={linha.event_id} />
                    <input type="hidden" name="sentido" value="cima" />
                    <button
                      type="submit"
                      className={BOTAO}
                      aria-label={`Subir «${linha.title}»`}
                      disabled={indice === 0}
                    >
                      ↑
                    </button>
                  </form>
                  <form action={moverDestaque}>
                    <input type="hidden" name="regiao" value={id} />
                    <input type="hidden" name="evento" value={linha.event_id} />
                    <input type="hidden" name="sentido" value="baixo" />
                    <button
                      type="submit"
                      className={BOTAO}
                      aria-label={`Descer «${linha.title}»`}
                      disabled={indice === fixados.length - 1}
                    >
                      ↓
                    </button>
                  </form>
                  <form action={largarDestaque}>
                    <input type="hidden" name="regiao" value={id} />
                    <input type="hidden" name="evento" value={linha.event_id} />
                    <button type="submit" className={BOTAO}>
                      Largar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section aria-labelledby="escolher" className="mt-10">
        <h2 id="escolher" className="font-display text-lg font-semibold">
          Escolher da programação
        </h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Eventos publicados desta região que ainda não aconteceram, pela ordem em que acontecem.
        </p>

        <form method="get" role="search" className="mt-3 flex flex-wrap items-end gap-3">
          <label htmlFor="q" className="text-sm">
            <span className="block font-medium">Procurar pelo título</span>
            <input
              type="search"
              id="q"
              name="q"
              defaultValue={q ?? ''}
              className="mt-1 min-h-11 w-64 rounded border border-field bg-surface px-3 text-base"
            />
          </label>
          <button type="submit" className={BOTAO}>
            Procurar
          </button>
          {q ? (
            <Link
              href={`/admin/regioes/${encodeURIComponent(id)}/destaques`}
              className="inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-4"
            >
              Limpar
            </Link>
          ) : null}
        </form>

        {candidatos.length === 0 ? (
          <p className="mt-4 rounded border border-dashed border-border px-4 py-6 text-center text-muted">
            Nada por acontecer com esse nome.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {candidatos.map((evento) => (
              <li
                key={evento.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-muted">
                    {formatEventDates(evento.date_start, evento.date_end, hoje)}
                    {evento.image_url === null ? ' · sem cartaz' : ''}
                  </p>
                  <p className="font-medium">{evento.title}</p>
                </div>
                {jaFixados.has(evento.id) ? (
                  <span className="shrink-0 text-sm text-muted">Já fixado</span>
                ) : (
                  <form action={fixarDestaque} className="shrink-0">
                    <input type="hidden" name="regiao" value={id} />
                    <input type="hidden" name="evento" value={evento.id} />
                    <button type="submit" className={BOTAO_CHEIO}>
                      Fixar
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
