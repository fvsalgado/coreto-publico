import Link from 'next/link';

interface Props {
  items: ReadonlyArray<{ id: string; name: string }>;
}

/**
 * Os concelhos, parados, por cima do rodapé de todas as páginas.
 *
 * Era uma banda a passar devagar, como as bandeirinhas de uma festa, e caiu
 * pelas três razões que se mediram (C1-010, C3-009):
 *
 * - **o foco perdia-se.** A fila parava quando recebia o foco, mas parava onde
 *   estava, e o nome focado ficava quase sempre fora da faixa — onze paragens
 *   de Tab sem se ver onde se estava (2.4.7);
 * - **com movimento reduzido cortava oito de onze.** A faixa era
 *   `overflow: hidden`; parada em «Abrantes · Alcanena · Constância», o dedo
 *   não tinha como chegar aos outros;
 * - **o movimento puxava o olho para o sítio menos útil da página**, e o
 *   botão de pausa assentava por cima do nome que estava a passar.
 *
 * Parados e a embrulhar, os onze cabem em três linhas a 360 píxeis, todos à
 * vista, todos alcançáveis, e sem JavaScript nenhum. Não é um `<nav>` de
 * propósito: são onze ligações num nível, e o Selo pede no máximo nove por
 * nível de navegação. É a lista dos concelhos, com nome, e cada nome leva à
 * página do seu.
 */
export function ConcelhosDoRodape({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="border-y border-border bg-surface py-2">
      {/* Cada nome leva o seu octógono à frente, e não um separador entre
          dois: um separador ia parar ao princípio da linha seguinte quando a
          lista embrulha, e lia-se como um nome sem nome. */}
      <ul
        aria-label="Concelhos"
        className="ct-goteira mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-4"
      >
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/concelho/${item.id}`}
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 text-sm whitespace-nowrap underline-offset-4 hover:underline sm:text-base"
            >
              <span aria-hidden="true" className="ct-octagon size-1.5 shrink-0 bg-highlight" />
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
