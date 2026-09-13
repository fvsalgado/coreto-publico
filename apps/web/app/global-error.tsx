'use client';

import { useEffect } from 'react';

/**
 * O último recurso: quando o erro é no próprio layout de raiz.
 *
 * Esta fronteira substitui o documento inteiro — o Next não lhe dá o `<html>`
 * nem o CSS global, porque foi precisamente o que carrega o layout que pode
 * ter falhado. Por isso traz o seu próprio `<html>`, o seu `<body>` e o estilo
 * embutido: tem de se aguentar sozinha, sem depender de uma folha de estilos
 * que talvez não chegue. É rara — quase tudo é apanhado antes, pela fronteira
 * da região ou do painel —, mas quando acontece, mais vale uma página inteira
 * em português do que o ecrã cru do Next.
 *
 * As cores vêm por `prefers-color-scheme` embutido, que não depende de token
 * nenhum: o toldo que faz o tema também é do layout que falhou.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('erro de raiz', error);
  }, [error]);

  return (
    <html lang="pt">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          lineHeight: 1.6,
          background: '#f5f3ee',
          color: '#1b1e24',
        }}
      >
        <style>{`
          @media (prefers-color-scheme: dark) {
            body { background: #16181c !important; color: #e9e7e1 !important; }
            .ct-ge-btn { border-color: #383d45 !important; color: #e9e7e1 !important; }
          }
        `}</style>
        <main style={{ maxWidth: '32rem', width: '100%' }}>
          <h1 style={{ fontSize: '1.7rem', margin: '0 0 0.6rem', fontWeight: 600 }}>
            O Coreto teve um problema
          </h1>
          <p style={{ margin: '0 0 1.4rem', opacity: 0.85 }}>
            Foi uma falha nossa, não do seu lado. Recarregar a página costuma resolver — e se não
            resolver, tente daqui a pouco.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={reset}
              className="ct-ge-btn"
              style={{
                minHeight: '44px',
                padding: '0 1.1rem',
                borderRadius: '7px',
                border: '1px solid #cbc7bd',
                background: 'transparent',
                color: '#1b1e24',
                font: 'inherit',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Recarregar
            </button>
            {/* Um <a> de recarga total, não o <Link> do router: esta fronteira
                existe porque o layout de raiz falhou, e o router de cliente
                pode ter ido com ele — uma ida ao servidor é o que se quer. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="ct-ge-btn"
              style={{
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 1.1rem',
                borderRadius: '7px',
                border: '1px solid #cbc7bd',
                color: '#1b1e24',
                textDecoration: 'none',
              }}
            >
              Voltar à entrada
            </a>
          </div>
          {error.digest ? (
            <p style={{ marginTop: '2rem', fontSize: '0.85rem', opacity: 0.7 }}>
              Código do erro: <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
