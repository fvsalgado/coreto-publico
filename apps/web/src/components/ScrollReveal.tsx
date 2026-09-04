'use client';

/**
 * Revelação das secções ao entrarem no ecrã.
 *
 * Desenhado para falhar para VISÍVEL. O CSS não esconde nada por si: quem
 * esconde é o atributo `data-ct-reveal="armed"` que este componente escreve,
 * e só nas secções que já estão abaixo da dobra quando ele corre. Sem JS,
 * com JS avariado, sem `IntersectionObserver` ou com `prefers-reduced-motion`,
 * nada é armado e a página lê-se inteira.
 *
 * A alternativa nativa (`animation-timeline: view()`) dispensava este
 * ficheiro, mas o seu estado de partida é opacidade 0: um motor que anuncie
 * suporte sem fazer a timeline avançar deixaria a secção invisível para
 * sempre. Com uma transição, o pior caso é não haver animação.
 */

import { useEffect } from 'react';

/** Quanto da secção tem de entrar antes de revelar. */
const ROOT_MARGIN = '0px 0px -12% 0px';
/** Rede de segurança: se o observer nunca disparar, mostra tudo. */
const SAFETY_MS = 5000;

export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    // Só o que ainda não é visível: armar o que já está no ecrã faria a
    // página piscar depois da hidratação.
    const armed = [...document.querySelectorAll<HTMLElement>('.ct-reveal')].filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight * 0.9,
    );
    if (armed.length === 0) return;

    for (const el of armed) el.dataset.ctReveal = 'armed';

    const reveal = (el: HTMLElement) => {
      el.dataset.ctReveal = 'in';
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target as HTMLElement);
          io.unobserve(entry.target);
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
    for (const el of armed) io.observe(el);

    const safety = window.setTimeout(() => armed.forEach(reveal), SAFETY_MS);

    return () => {
      window.clearTimeout(safety);
      io.disconnect();
      // Desmontar sem limpar deixaria secções congeladas a opacidade 0.
      for (const el of armed) delete el.dataset.ctReveal;
    };
  }, []);

  return null;
}
