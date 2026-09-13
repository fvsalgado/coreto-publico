'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * A rede por baixo das páginas de uma região.
 *
 * O Next chama esta fronteira quando uma página do segmento atira um erro que
 * ninguém apanhou — uma leitura que rebentou em vez de degradar, um estado que
 * não se previu. Sem ela, o visitante via o ecrã cru do Next, em inglês, sem
 * toldo nem rodapé nem uma palavra que reconhecesse; com ela, o cabeçalho e o
 * rodapé da região ficam de pé (esta fronteira rende dentro do layout) e a
 * mensagem é a mesma linguagem do resto do sítio: não culpa quem chegou, e dá
 * saídas que não dependem do que possa ter falhado.
 *
 * É um Componente de Cliente por exigência do Next — é ele que liga o botão de
 * repetir. Não vai à base buscar nada, pela mesma razão que a página de «não
 * existe»: uma página de erro que depende do que pode ter falhado não é uma
 * página de erro. Os atalhos são relativos, que valem em qualquer domínio.
 */
export default function ErroDaRegiao({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // O rasto fica no servidor, para quem cuida do sítio; ao visitante não se
    // mostra a mecânica.
    console.error('erro na região', error);
  }, [error]);

  return (
    <>
      <header className="mb-8">
        <h1 className="ct-display-sm">Alguma coisa correu mal deste lado</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Não foi nada que fizesse — foi uma falha nossa a carregar esta página. Muitas vezes passa
          se tentar outra vez; se insistir, os caminhos abaixo levam-no a sítio seguro.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded border border-border bg-surface px-4 text-sm font-medium underline-offset-4 hover:border-accent hover:underline"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded border border-border bg-surface px-4 text-sm underline-offset-4 hover:underline"
        >
          Voltar à entrada
        </Link>
        <Link
          href="/agenda"
          className="inline-flex min-h-11 items-center rounded border border-border bg-surface px-4 text-sm underline-offset-4 hover:underline"
        >
          A agenda completa
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-10 text-sm text-muted">
          Se nos escrever a contar o que aconteceu, este código ajuda-nos a encontrar a falha:{' '}
          <code className="rounded border border-border bg-surface px-1.5 py-0.5">
            {error.digest}
          </code>
        </p>
      ) : null}
    </>
  );
}
