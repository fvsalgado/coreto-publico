import { Migalhas } from '@/src/components/Migalhas';
import type { Migalha } from '@/src/lib/migalhas';

interface Props {
  title: string;
  /** Sobrancelha editorial por cima do título — «Agenda», «Espaço», «Concelho». */
  eyebrow?: string;
  lead?: string;
  /**
   * O caminho até aqui, vindo de `lib/migalhas.ts` — a mesma lista que os
   * dados estruturados publicam. Quem não tem página-mãe não passa nada, e o
   * cabeçalho fica como sempre foi.
   */
  migalhas?: readonly Migalha[];
  children?: React.ReactNode;
}

export function PageHeader({ title, eyebrow, lead, migalhas, children }: Props) {
  return (
    <header className="mb-8">
      {migalhas ? <Migalhas trilha={migalhas} /> : null}
      {eyebrow ? <p className="ct-eyebrow mb-2.5">{eyebrow}</p> : null}
      <h1 className="ct-display-sm">{title}</h1>
      {lead ? <p className="mt-3 max-w-2xl text-muted">{lead}</p> : null}
      {children}
    </header>
  );
}
