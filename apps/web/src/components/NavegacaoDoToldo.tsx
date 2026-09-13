'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { caminhoPublico, estaEm, type Destino } from '@/src/lib/navegacao';

/**
 * Os destinos do toldo, com o de agora aceso.
 *
 * A barra do telemóvel diz sempre onde se está — ícone cheio e
 * `aria-current="page"` — e o cabeçalho do ecrã largo não dizia nada: quatro
 * ligações iguais, e quem estivesse na Agenda via exactamente o mesmo que quem
 * estivesse no Mapa. Duas navegações do mesmo mapa a discordarem sobre a coisa
 * mais elementar que uma navegação faz.
 *
 * É de cliente por uma razão só: o caminho aberto. O layout de raiz é de
 * servidor e não o conhece; a regra de qual destino acende é a mesma função
 * que a barra de baixo usa, para as duas não poderem divergir.
 *
 * O sinal é um sublinhado e não peso de letra: mudar a espessura da letra muda
 * a largura da palavra, e a barra inteira dançava ao mudar de página.
 */
export function NavegacaoDoToldo({
  destinos,
  regiao,
}: {
  destinos: readonly Destino[];
  /** O identificador da região, para tirar o segmento interno do caminho. */
  regiao: string;
}) {
  const pathname = caminhoPublico(usePathname() ?? '/', regiao);

  return (
    <>
      {destinos.map((item) => {
        const activo = estaEm(pathname, item);
        return (
          <li key={item.href} className="hidden sm:block">
            <Link
              href={item.href}
              aria-current={activo ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded px-2.5 underline-offset-[6px] ${
                activo ? 'underline decoration-2' : 'hover:underline'
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </>
  );
}
