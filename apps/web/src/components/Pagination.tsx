import Link from 'next/link';

interface Props {
  page: number;
  totalPages: number;
  /** `null` quando não há para onde ir — a ligação passa a texto inerte. */
  previousHref: string | null;
  nextHref: string | null;
}

const LINK_CLASS =
  'inline-flex min-h-11 items-center rounded border border-border px-4 text-sm underline-offset-4 hover:underline';
/*
 * Sem `opacity`. O `text-muted` está calibrado para passar os 4,5:1 contra o
 * papel; multiplicá-lo por 0,6 punha-o em 2,8:1, e a auditoria apanhou-o
 * assim que o catálogo cresceu para três páginas e o «Página anterior» inerte
 * passou a aparecer. Que o texto está inerte já se vê por não ter sublinhado
 * nem ser ligação — não precisa de ser ilegível para o dizer.
 */
const INERT_CLASS =
  'inline-flex min-h-11 items-center rounded border border-border px-4 text-sm text-muted';

/**
 * Paginação em ligações, não em botões.
 *
 * Cada página é um endereço próprio: dá para partilhar, para abrir noutro
 * separador e para o motor de busca seguir. `rel` diz ao navegador e ao
 * rastreador qual é a ordem.
 */
export function Pagination({ page, totalPages, previousHref, nextHref }: Props) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Paginação"
      className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
    >
      {previousHref ? (
        <Link href={previousHref} rel="prev" className={LINK_CLASS}>
          Página anterior
        </Link>
      ) : (
        <span className={INERT_CLASS}>Página anterior</span>
      )}

      <p className="text-sm text-muted">
        Página {page} de {totalPages}
      </p>

      {nextHref ? (
        <Link href={nextHref} rel="next" className={LINK_CLASS}>
          Página seguinte
        </Link>
      ) : (
        <span className={INERT_CLASS}>Página seguinte</span>
      )}
    </nav>
  );
}
