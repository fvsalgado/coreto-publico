import Link from 'next/link';
import type { Municipality } from '@/src/lib/queries/types';
import type { MunicipalityEventCounts } from '@/src/lib/queries/events';

interface Props {
  municipalities: Municipality[];
  counts: MunicipalityEventCounts;
}

/**
 * Os onze concelhos, todos, sempre.
 *
 * Um concelho sem programação continua na grelha com um convite a enviá-la.
 * Esconder os vazios daria uma montra mais bonita e enganosa: quem não aparece
 * não recebe programação, e quem não recebe programação nunca aparece. A
 * aldeia entra na mesma linha que a cidade-sede, com a mesma caixa.
 */
export function MunicipalityGrid({ municipalities, counts }: Props) {
  if (municipalities.length === 0) return null;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {municipalities.map((municipality) => {
        const count = counts[municipality.id] ?? 0;

        return (
          <li
            key={municipality.id}
            className="ct-lift relative flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3.5"
          >
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold">
                <Link
                  href={`/concelho/${municipality.id}`}
                  className="underline-offset-4 hover:underline after:absolute after:inset-0 after:content-['']"
                >
                  {municipality.name}
                </Link>
              </p>
              {count > 0 ? (
                <p className="mt-0.5 text-sm text-muted">
                  {count === 1 ? '1 evento marcado' : `${count} eventos marcados`}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-muted">Ainda sem programação — enviem a vossa.</p>
              )}
            </div>

            <span
              aria-hidden="true"
              className={`ct-octagon ct-numeral grid size-11 shrink-0 place-items-center text-lg ${
                count > 0 ? 'bg-accent-soft text-accent' : 'bg-paper text-muted'
              }`}
            >
              {count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
