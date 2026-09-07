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
 *
 * **E agora é também onde as leituras falhadas aterram.** Desde que
 * `admin/queries.ts` deixou de devolver `[]` por causa de um erro, uma
 * consulta que não corre chega aqui em vez de se disfarçar de «nada por
 * moderar». É por isso que o texto fala de ações e de leituras: um painel que
 * diz «não consegui ler» é um painel em que se pode acreditar quando ele diz
 * «não há nada».
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
        <h1 className="text-2xl font-semibold">Não foi possível falar com a base de dados</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Esta página não está a mostrar nada porque não conseguiu ler, e não porque não haja nada
          para mostrar — a diferença é o motivo de ver este ecrã em vez de uma lista vazia. Se
          estava a fazer alguma coisa, nada ficou pelo meio: as escritas do painel são atómicas.
          Ainda assim, convém confirmar o estado antes de repetir.
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
