'use client';

import { useSyncExternalStore } from 'react';

const nada = () => () => {};

/**
 * «Imprimir», para a folha da semana (C2-032, C4-022).
 *
 * Só aparece com JavaScript, porque só com ele faz alguma coisa: sem ele, um
 * botão que não imprime era um botão a mentir. A página diz por baixo como se
 * imprime pelo navegador, que funciona sempre. O `useSyncExternalStore` é a
 * forma de saber «já estou no navegador» sem um estado mudado num efeito —
 * no servidor responde `false`, e o botão não vai no HTML.
 */
export function BotaoDeImprimir({ children }: { children: React.ReactNode }) {
  const noNavegador = useSyncExternalStore(
    nada,
    () => true,
    () => false,
  );
  if (!noNavegador) return null;
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center rounded-full border border-accent bg-accent px-5 text-sm font-medium text-on-accent underline-offset-4 hover:underline"
    >
      {children}
    </button>
  );
}
