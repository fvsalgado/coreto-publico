import Link from 'next/link';
import { ascendentes, type Migalha } from '@/src/lib/migalhas';

/**
 * Onde se está, e por onde se sobe.
 *
 * Uma ficha aberta a partir de uma partilha mostrava o título e mais nada:
 * nem o concelho, nem caminho de volta. O cabeçalho do sítio leva à agenda e
 * ao mapa da região, que é longe de onde a pessoa está; daqui sobe-se um
 * degrau de cada vez.
 *
 * A trilha chega inteira — com a própria página no fim, porque é assim que os
 * dados estruturados a querem — e desenham-se só os ascendentes: logo por
 * baixo está o `<h1>` a dizer o nome da página, e escrevê-lo duas vezes
 * seguidas é ruído para quem lê e para quem ouve.
 *
 * `<ol>` e não uma fila de `<span>`: um leitor de ecrã anuncia «lista com dois
 * itens» e a ordem passa a ter significado. O `›` é decorativo e fica
 * escondido — quem ouve não precisa de ouvir «sinal de maior».
 *
 * O separador vai **entre** degraus e não a seguir a cada um. Com um `›` no
 * fim, a linha ficava a apontar para o vazio — e o que vem a seguir é o `<h1>`,
 * que não é um degrau desta lista.
 */
export function Migalhas({
  trilha,
  className,
}: {
  trilha: readonly Migalha[];
  className?: string;
}) {
  const caminho = ascendentes(trilha);
  if (caminho.length === 0) return null;

  return (
    <nav aria-label="Onde está" className={className ?? 'mb-2'}>
      <ol className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
        {caminho.map((migalha, indice) => (
          <li key={migalha.href} className="flex items-center gap-x-1.5">
            {indice > 0 ? <span aria-hidden="true">›</span> : null}
            <Link
              href={migalha.href}
              className="inline-flex min-h-11 items-center underline-offset-4 hover:text-ink hover:underline sm:min-h-0"
            >
              {migalha.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
