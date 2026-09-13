'use client';

import { useSyncExternalStore } from 'react';

type Tema = 'system' | 'light' | 'dark';

/** A mesma chave que o script de arranque no layout lê antes da pintura. */
const CHAVE = 'coreto-theme';

/** O ciclo do botão: sistema → claro → escuro → sistema. */
const SEGUINTE: Record<Tema, Tema> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

const ROTULO: Record<Tema, string> = {
  system: 'o do sistema',
  light: 'claro',
  dark: 'escuro',
};

/**
 * A fonte de verdade é o próprio `data-theme` da raiz — o que o CSS lê é o
 * que o botão mostra, por construção. `useSyncExternalStore` é a forma
 * certa de o React ler um valor de fora que muda sozinho (aqui, escrito
 * pelo script de arranque antes da hidratação): no servidor responde-se
 * «sistema» e a primeira leitura no cliente corrige sem aviso de hidratação
 * nem renderização a mais de permeio.
 */
function lerTema(): Tema {
  const atual = document.documentElement.dataset.theme;
  return atual === 'light' || atual === 'dark' ? atual : 'system';
}

function subscreverTema(avisar: () => void): () => void {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observador.disconnect();
}

/**
 * O botão claro/escuro do masthead.
 *
 * A moldura é `on-brand` e não branca: o masthead é o toldo turquesa, e a
 * moldura a branco que aqui estava, a 40%, dava 1,4:1 sobre ele — deixava de
 * se ver que ali há um botão, que é o que o critério 1.4.11 não deixa
 * acontecer. A tinta escura a 60% dá 3,4:1.
 *
 * Três estados e não dois: quem nunca lhe toca fica com o tema do sistema,
 * que muda sozinho ao anoitecer — um interruptor claro/escuro simples
 * roubava isso à primeira utilização. A escolha explícita vai para o
 * `data-theme` da raiz (que os tokens e a variante `dark:` já seguem) e
 * fica no `localStorage`; nas visitas seguintes é o script do layout que a
 * repõe antes da primeira pintura, para nunca haver um piscar de tema.
 *
 * Sem JavaScript o botão não faz nada — e não faz falta: sem atributo na
 * raiz vale a preferência do sistema, como sempre.
 */
export function ThemeToggle() {
  const tema = useSyncExternalStore(subscreverTema, lerTema, (): Tema => 'system');

  const mudar = () => {
    const novo = SEGUINTE[tema];
    const raiz = document.documentElement;
    if (novo === 'system') delete raiz.dataset.theme;
    else raiz.dataset.theme = novo;
    try {
      if (novo === 'system') localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, novo);
    } catch {
      // Sem armazenamento (navegação privada, por exemplo) a escolha vale
      // só até fechar a página — melhor isso do que um botão avariado.
    }
  };

  return (
    <button
      type="button"
      onClick={mudar}
      aria-label={`Mudar o tema (agora: ${ROTULO[tema]})`}
      title={`Tema: ${ROTULO[tema]}`}
      className="grid size-11 place-items-center rounded-full border border-on-brand/60 hover:bg-on-brand/10"
    >
      {tema === 'light' ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-4.5"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : tema === 'dark' ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          className="size-4.5"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        // Meio a meio: o círculo com metade cheia é o «automático».
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4.5">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" />
        </svg>
      )}
      <span className="sr-only" aria-live="polite">
        Tema: {ROTULO[tema]}
      </span>
    </button>
  );
}
