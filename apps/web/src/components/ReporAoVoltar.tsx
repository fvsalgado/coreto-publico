'use client';

import { useEffect, useRef } from 'react';

/**
 * Repõe o formulário onde está quando se chega à página pelo «voltar».
 *
 * Os filtros vivem no endereço, e o «voltar» do navegador repõe a lista — mas
 * não a caixa (C2-036). Pesquisava-se «Teatro Virgínia», depois «exposições»,
 * voltava-se atrás: a lista era a do Teatro Virgínia e a caixa dizia
 * «exposições». O navegador guarda a página como ela estava quando se saiu
 * dela, com o que se tinha escrito por cima, e devolve-a assim.
 *
 * `form.reset()` põe cada campo no valor que o servidor escreveu para este
 * endereço — é o que o atributo `value` de um campo não controlado guarda —, e
 * por isso a caixa volta a dizer o que a lista mostra. Só ao voltar ou
 * avançar: numa entrada normal, repor podia apagar o que alguém começou a
 * escrever antes de a página acabar de carregar.
 *
 * E, quando o endereço traz a âncora do campo (`#pesquisa`, a lupa do toldo),
 * põe-lhe o foco: quem carregou na lupa quer escrever, e saltar para a caixa
 * sem a focar obrigava a mais um toque.
 */
export function ReporAoVoltar({ ancora }: { ancora?: string }) {
  const marca = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const formulario = marca.current?.closest('form');
    if (!formulario) return;

    const navegacao = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    if (navegacao?.type === 'back_forward') formulario.reset();

    const aoMostrar = (evento: PageTransitionEvent) => {
      if (evento.persisted) formulario.reset();
    };
    window.addEventListener('pageshow', aoMostrar);

    const focarSePedido = () => {
      if (ancora && window.location.hash === `#${ancora}`) {
        formulario.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      }
    };
    focarSePedido();
    // A lupa carregada na própria agenda só muda a âncora.
    window.addEventListener('hashchange', focarSePedido);

    return () => {
      window.removeEventListener('pageshow', aoMostrar);
      window.removeEventListener('hashchange', focarSePedido);
    };
  }, [ancora]);

  return <span ref={marca} hidden />;
}
