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
  /**
   * O que fica à direita do título, na mesma linha — a alternância lista/mapa
   * da agenda. Na mesma linha e não por baixo, de propósito: um título curto
   * deixa metade da linha vazia, e uma linha a mais antes do primeiro evento
   * era o que o benchmark de 20/09/2026 apontou.
   */
  lado?: React.ReactNode;
  /** Menos ar por baixo: para as páginas em que o que vem a seguir é a programação. */
  compacto?: boolean;
  children?: React.ReactNode;
}

export function PageHeader({ title, eyebrow, lead, migalhas, lado, compacto, children }: Props) {
  return (
    <header className={compacto ? 'mb-5' : 'mb-8'}>
      {migalhas ? <Migalhas trilha={migalhas} /> : null}
      {eyebrow ? <p className="ct-eyebrow mb-2.5">{eyebrow}</p> : null}
      {lado ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="ct-display-sm">{title}</h1>
          {lado}
        </div>
      ) : (
        <h1 className="ct-display-sm">{title}</h1>
      )}
      {lead ? <p className="mt-3 max-w-2xl text-muted">{lead}</p> : null}
      {children}
    </header>
  );
}
