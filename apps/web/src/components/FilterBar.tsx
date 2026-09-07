import Link from 'next/link';
import type { EventFilter } from '@coreto/core';
import type { Category, Municipality } from '@/src/lib/queries/types';

interface Props {
  filter: EventFilter;
  municipalities: Municipality[];
  categories: Category[];
  /** Endereço da própria listagem — é para lá que o formulário submete. */
  action: string;
  /** Quantos filtros estão a valer, para o resumo dizer o que esconde. */
  activeCount?: number;
}

// `border-field` e não `border-border`: a moldura de um campo identifica um
// controlo e tem de ter 3:1 contra o fundo (WCAG 1.4.11). `text-base` evita
// que o Safari do iPhone dê zoom ao focar o campo.
const FIELD_CLASS =
  'mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';
const LABEL_CLASS = 'block text-sm font-medium';

/**
 * Filtros em formulário GET.
 *
 * O estado vive nos parâmetros do endereço, não no cliente: a página filtrada
 * funciona sem JavaScript, é partilhável tal como está e o botão de retroceder
 * do navegador faz o que se espera. Sem `page` no formulário de propósito —
 * mudar um filtro tem de voltar à primeira página, senão cai-se num «sem
 * resultados» que é só a página 7 de uma lista que agora tem duas.
 */
export function FilterBar({ filter, municipalities, categories, action, activeCount = 0 }: Props) {
  return (
    <details className="ct-recolhivel rounded border border-border bg-surface">
      {/* Só se vê no telemóvel — a partir do tablet o CSS esconde o resumo e
          deixa o formulário aberto, sem `open` nem JavaScript. */}
      <summary aria-label="Mostrar ou esconder os filtros da agenda">
        <span>Filtrar e pesquisar</span>
        {activeCount > 0 ? (
          <span className="ct-octagon grid size-6 shrink-0 place-items-center bg-accent text-xs font-semibold text-on-accent">
            {activeCount}
          </span>
        ) : null}
      </summary>

      <form
        method="get"
        action={action}
        role="search"
        aria-label="Filtrar a agenda"
        className="px-4 pt-1 pb-4 sm:pt-4"
      >
        {/* O espaço e o ciclo não têm campo próprio, mas quem chega por uma
          ligação com eles não os pode perder ao carregar em «Filtrar». */}
        {filter.venue ? <input type="hidden" name="venue" value={filter.venue} /> : null}
        {filter.series ? <input type="hidden" name="series" value={filter.series} /> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <label htmlFor="filtro-q" className={LABEL_CLASS}>
              Pesquisar
            </label>
            <input
              type="search"
              id="filtro-q"
              name="q"
              defaultValue={filter.q ?? ''}
              placeholder="Título, sítio, palavra…"
              maxLength={120}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="filtro-de" className={LABEL_CLASS}>
              De
            </label>
            <input
              type="date"
              id="filtro-de"
              name="from"
              defaultValue={filter.from ?? ''}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="filtro-ate" className={LABEL_CLASS}>
              Até
            </label>
            <input
              type="date"
              id="filtro-ate"
              name="to"
              defaultValue={filter.to ?? ''}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="filtro-concelho" className={LABEL_CLASS}>
              Concelho
            </label>
            <select
              id="filtro-concelho"
              name="municipality"
              defaultValue={filter.municipality ?? ''}
              className={FIELD_CLASS}
            >
              <option value="">Todos os concelhos</option>
              {municipalities.map((municipality) => (
                <option key={municipality.id} value={municipality.id}>
                  {municipality.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filtro-categoria" className={LABEL_CLASS}>
              Categoria
            </label>
            <select
              id="filtro-categoria"
              name="category"
              defaultValue={filter.category ?? ''}
              className={FIELD_CLASS}
            >
              <option value="">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="sm:col-span-2 lg:col-span-2">
            <legend className={LABEL_CLASS}>Mostrar apenas</legend>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
              {/* O rótulo leva a altura toda: a caixa desenhada tem 20 px, mas
                o alvo do dedo é a linha inteira. */}
              <label
                htmlFor="filtro-gratuito"
                className="flex min-h-11 items-center gap-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  id="filtro-gratuito"
                  name="free"
                  value="1"
                  defaultChecked={filter.free === true}
                  className="size-5 accent-accent"
                />
                Entrada livre
              </label>

              <label
                htmlFor="filtro-acessivel"
                className="flex min-h-11 items-center gap-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  id="filtro-acessivel"
                  name="accessible"
                  value="1"
                  defaultChecked={filter.accessible === true}
                  aria-describedby="filtro-acessivel-nota"
                  className="size-5 accent-accent"
                />
                Acesso a cadeiras de rodas
              </label>
            </div>
            {/* A caixa dizia o que filtra e não o que isso deixa de fora, e a
                diferença não é académica: o acesso é uma declaração do evento,
                e a 7 de setembro de 2026 nenhum dos 128 eventos do Médio Tejo
                a trazia — a caixa mostrava uma agenda vazia sem dizer porquê.
                A nota não afirma quantos são, que é contagem que muda de
                região para região; diz o que o filtro faz, que é igual em
                todas. Por `aria-describedby` para quem ouve a caixa ouvir
                também a ressalva. */}
            <p id="filtro-acessivel-nota" className="mt-2 text-sm text-muted">
              «Acesso a cadeiras de rodas» mostra só os eventos que o declaram: sem declaração, o
              evento fica de fora mesmo que o espaço seja acessível. O que se sabe do espaço está na
              ficha de cada evento.
            </p>
          </fieldset>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="min-h-11 rounded bg-accent px-5 text-sm font-medium text-on-accent"
          >
            Filtrar
          </button>
          <Link
            href={action}
            className="inline-flex min-h-11 items-center rounded px-3 text-sm underline underline-offset-4"
          >
            Limpar filtros
          </Link>
        </div>
      </form>
    </details>
  );
}
