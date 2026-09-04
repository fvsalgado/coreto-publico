'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * A rede por baixo do painel.
 *
 * As ações de moderação que ainda atiram o erro em bruto do Postgres —
 * aprovar, rejeitar, fundir — caíam no ecrã cru do Next; agora caem aqui,
 * dentro do layout de administração, com a mensagem do erro à vista (aqui
 * pode mostrar-se: quem está no painel tem sessão) e um caminho de volta. Não
 * é desculpa para o erro em bruto — a correção certa é cada ação redirecionar
 * com o aviso, como as outras já fazem —, é a segunda linha para o que
 * escapar a essa.
 */
export default function ErroDoPainel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('erro no painel', error);
  }, [error]);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">A ação não foi concluída</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Alguma coisa falhou ao falar com a base de dados. Nada ficou pelo meio de propósito — as
          escritas do painel são atómicas —, mas convém confirmar o estado antes de repetir.
        </p>
      </header>

      {error.message ? (
        // A mensagem pode ser mais larga do que o ecrã e rola: sem foco, quem
        // anda de teclado não chega ao fim dela (2.1.1).
        <pre
          tabIndex={0}
          className="mb-6 max-w-2xl overflow-x-auto rounded border border-border bg-surface p-3 text-sm text-highlight"
        >
          {error.message}
        </pre>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm font-medium hover:bg-surface"
        >
          Tentar de novo
        </button>
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm underline-offset-4 hover:underline"
        >
          Voltar ao painel
        </Link>
        <Link
          href="/admin/fila"
          className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm underline-offset-4 hover:underline"
        >
          A fila de moderação
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 text-sm text-muted">
          Código do erro:{' '}
          <code className="rounded border border-border px-1.5 py-0.5">{error.digest}</code>
        </p>
      ) : null}
    </>
  );
}
