import Link from 'next/link';
import { BandstandMark } from './BandstandMark';

interface Props {
  title: string;
  /** Só quando há mesmo alguma coisa a acrescentar ao título. */
  description?: string;
  action?: { href: string; label: string };
}

/**
 * O vazio explica-se.
 *
 * «Não há nada» é precisamente a ideia que este projeto existe para desfazer:
 * uma lista vazia diz o que se pode fazer a seguir, não fica a olhar. O
 * coreto vazio é o convite — está ali à espera de quem suba.
 */
export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-10 text-center">
      <BandstandMark className="mx-auto size-10 text-accent opacity-80" />
      <p className="font-display mt-3 text-lg font-semibold">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>
      ) : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-sm font-medium text-on-accent"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
