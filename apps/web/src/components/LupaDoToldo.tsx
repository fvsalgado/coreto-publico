'use client';

// De `caminhos.ts` e nunca de `lib/agenda.ts`: este componente vai para o
// navegador em todas as páginas, e o módulo da agenda levava o zod atrás.
import { ANCORA_DA_PESQUISA, PATH } from '@/src/lib/caminhos';

/**
 * A lupa do toldo: a pesquisa a um toque, de qualquer página (C3-020).
 *
 * Leva à caixa da agenda pela âncora, e é a caixa que se foca ao chegar
 * (`ReporAoVoltar`). Na própria agenda não há chegada nenhuma — a âncora pode
 * até já ser a mesma —, e por isso a lupa foca a caixa ela própria em vez de
 * navegar. Sem JavaScript é uma ligação como as outras.
 */
export function LupaDoToldo({ className = '' }: { className?: string }) {
  return (
    <a
      href={`${PATH}#${ANCORA_DA_PESQUISA}`}
      aria-label="Pesquisar na agenda"
      title="Pesquisar na agenda"
      onClick={(evento) => {
        const caixa = document.querySelector<HTMLInputElement>(
          `#${ANCORA_DA_PESQUISA} input[type="search"]`,
        );
        if (!caixa) return;
        evento.preventDefault();
        caixa.focus();
      }}
      className={`grid size-11 shrink-0 place-items-center rounded-full border border-on-brand/60 hover:bg-on-brand/10 ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5" fill="none">
        <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
        <path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </a>
  );
}
