'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** O título deste ecrã. O `scripts/check-a11y-admin.mjs` procura-o para saber que uma página caiu. */
const TITULO = 'Esta página não abriu';

/**
 * A rede por baixo do painel.
 *
 * As leituras falhadas aterram aqui: desde que `admin/queries.ts` deixou de
 * devolver `[]` por causa de um erro, uma consulta que não corre chega a este
 * ecrã em vez de se disfarçar de «nada por moderar». Um painel que diz «não
 * consegui ler» é um painel em que se pode acreditar quando diz «não há nada».
 *
 * **As ações não deviam chegar aqui**, e as da moderação já não chegam: cada
 * uma volta ao formulário com um aviso em português (`avisoDoErroDaBase`). O
 * que ainda cai aqui é avaria, e o ecrã diz isso e só isso.
 *
 * **Não mostra a mensagem do erro** (C4-029). Em produção o React substitui-a
 * por «Minified React error #441; visit https://react.dev/…» — inglês técnico
 * que não diz a quem modera o que fez nem se a decisão ficou registada — e,
 * em desenvolvimento, o texto em bruto do Postgres. A mensagem fica no registo
 * do servidor; o ecrã mostra o código que a encontra lá, o `digest`.
 *
 * E o título deixou de dizer «Não foi possível falar com a base de dados»:
 * quase sempre falou, e a base recusou. Uma explicação falsa é pior do que
 * nenhuma.
 */
export default function ErroDoPainel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Na consola de quem está a ver, para quem opera poder pedir o pormenor;
    // no ecrã, nunca.
    console.error('erro no painel', error);
  }, [error]);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{TITULO}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Uma leitura ou uma gravação falhou, e a página parou em vez de mostrar uma lista vazia —
          uma lista vazia diria «não há nada», e isso não se sabe. Se estavas a gravar alguma coisa,
          ou ficou gravada por inteiro ou não ficou: o painel não deixa nada a meio. Antes de
          repetir, confirma na fila ou na lista se a mudança lá está.
        </p>
      </header>

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
        <p className="mt-8 max-w-2xl text-sm text-muted">
          Se isto se repetir, diz a quem opera o Coreto o que estavas a fazer e este código, que
          encontra o erro no registo:{' '}
          <code className="rounded border border-border px-1.5 py-0.5">{error.digest}</code>
        </p>
      ) : null}
    </>
  );
}
