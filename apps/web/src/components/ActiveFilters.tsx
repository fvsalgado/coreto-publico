import Link from 'next/link';

export interface ActiveFilter {
  /** O que está a filtrar, por extenso — «Concelho: Tomar». */
  label: string;
  /** O mesmo endereço, sem este filtro. */
  href: string;
}

interface Props {
  filters: ActiveFilter[];
  /** Endereço da listagem sem filtro nenhum. */
  clearHref: string;
}

/**
 * Os filtros que estão a valer, e a maneira de tirar cada um.
 *
 * Uma agenda filtrada é uma ligação que se partilha — é essa a promessa da
 * página. Só que quem a recebe cai numa lista curta sem saber porquê: os
 * campos do formulário guardam o estado, mas a pessoa tinha de ler três
 * caixas e duas listas pendentes para perceber o que está a cortar. Aqui
 * está escrito, e cada um sai com um clique.
 *
 * São ligações e não botões: funcionam sem JavaScript, abrem em separador
 * novo se alguém quiser, e o botão de retroceder desfaz o que se tirou.
 */
export function ActiveFilters({ filters, clearHref }: Props) {
  if (filters.length === 0) return null;

  return (
    <div className="mt-4">
      <h2 className="sr-only">Filtros a aplicar</h2>
      <ul className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <li key={filter.label}>
            <Link
              href={filter.href}
              className="group inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft py-1 pr-2 pl-3 text-sm text-accent underline-offset-4 hover:underline"
            >
              {filter.label}
              <span
                aria-hidden="true"
                className="grid size-4 place-items-center rounded-full bg-accent/15 text-[0.7rem] leading-none group-hover:bg-accent/30"
              >
                ×
              </span>
              <span className="sr-only">— tirar este filtro</span>
            </Link>
          </li>
        ))}
        {filters.length > 1 ? (
          <li>
            <Link href={clearHref} className="px-1 text-sm underline underline-offset-4">
              Limpar tudo
            </Link>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
