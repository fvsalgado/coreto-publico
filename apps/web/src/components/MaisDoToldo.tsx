'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MAIS_DO_TOLDO,
  caminhoPublico,
  comEmailDaRegiao,
  semAsDesligadas,
  type SeccaoOpcional,
} from '@/src/lib/navegacao';

/**
 * O «Mais» do cabeçalho largo (C2-038).
 *
 * No telemóvel o «+» da barra de baixo abre a gaveta com tudo o que não é
 * destino; na secretária não havia nada, e os Guardados, os ciclos, o «Levar a
 * agenda» e as informações só se alcançavam no rodapé. Quem guardava um evento
 * via o botão passar a «Guardado» e não tinha à vista para onde ele tinha ido.
 *
 * É a mesma gaveta, pelo mesmo desenho: um `<details>`, que abre e fecha sem
 * JavaScript e que o teclado e os leitores de ecrã já sabem usar, e as três
 * cortesias que o elemento não traz — fechar com Escape (com o foco de volta
 * ao botão), fechar ao tocar fora, e fechar ao mudar de página. A lista é
 * `MAIS_DO_TOLDO`: a gaveta, menos o que o cabeçalho já mostra.
 */
export function MaisDoToldo({
  desligadas,
  email,
  regiao,
}: {
  desligadas: readonly SeccaoOpcional[];
  email: string;
  /** O identificador da região, para tirar o segmento interno do caminho. */
  regiao: string;
}) {
  const pathname = caminhoPublico(usePathname() ?? '/', regiao);
  const entradas = comEmailDaRegiao(semAsDesligadas(MAIS_DO_TOLDO, desligadas), email);
  const [aberta, setAberta] = useState(false);
  const caixa = useRef<HTMLDetailsElement>(null);

  // Mudar de página fecha-o — ajustado durante a renderização, pela razão
  // escrita na gaveta da barra de baixo: num efeito, via-se a página nova com
  // a lista ainda aberta por um instante.
  const [caminhoAnterior, setCaminhoAnterior] = useState(pathname);
  if (caminhoAnterior !== pathname) {
    setCaminhoAnterior(pathname);
    setAberta(false);
  }

  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      setAberta(false);
      caixa.current?.querySelector('summary')?.focus();
    };
    const aoTocar = (evento: PointerEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) setAberta(false);
    };
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('pointerdown', aoTocar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoTocar);
    };
  }, [aberta]);

  if (entradas.length === 0) return null;

  const casa = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  const activa = (atalho: (typeof entradas)[number]) =>
    !atalho.externo && (casa(atalho.href) || (atalho.prefixos ?? []).some(casa));
  // Acende-se como os destinos — sublinhado — quando a página aberta está lá dentro.
  const aceso = entradas.some(activa);

  return (
    <li className="relative hidden sm:block">
      <details
        ref={caixa}
        open={aberta}
        onToggle={(evento) => setAberta(evento.currentTarget.open)}
      >
        <summary
          className={`ct-sem-marca inline-flex min-h-11 cursor-pointer items-center gap-1 rounded px-2.5 underline-offset-[6px] ${
            aceso ? 'underline decoration-2' : 'hover:underline'
          }`}
        >
          Mais
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`size-4 transition-transform ${aberta ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>

        {/* Por cima da página, encostado à direita do botão: a lista é mais
            larga do que ele, e a direita é o lado onde há espaço. O anel de
            foco volta a ser o da casa: o do toldo é a tinta escura, que no
            tema escuro desaparecia nesta superfície. */}
        <ul className="absolute top-full right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-surface p-1.5 text-ink shadow-2xl [&_:focus-visible]:outline-focus">
          {entradas.map((atalho) => {
            const agora = activa(atalho);
            return (
              <li key={atalho.href}>
                <Link
                  href={atalho.href}
                  aria-current={agora ? 'page' : undefined}
                  className={`flex min-h-12 flex-col justify-center rounded-lg px-3 py-2 hover:bg-accent-soft ${
                    agora ? 'bg-accent-soft' : ''
                  }`}
                >
                  <span className="font-medium">{atalho.label}</span>
                  <span className="text-xs text-muted">{atalho.nota}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </details>
    </li>
  );
}
