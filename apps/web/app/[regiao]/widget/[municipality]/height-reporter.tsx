'use client';

import { useEffect } from 'react';

/**
 * Diz ao anfitrião de que tamanho é a lista.
 *
 * Um `iframe` não cresce com o conteúdo — fica com a altura que lhe deram e
 * corta ou sobra. Não há maneira de o filho medir o pai nem de o pai medir o
 * filho quando as origens são diferentes; a única ponte é o `postMessage`.
 *
 * O destino é `*` porque não sabemos, nem queremos saber, em que sítios é que o
 * widget vai estar embebido — e a mensagem é um número de pixéis, não há nada
 * ali para proteger. Quem recebe é que confirma a origem, e o `embed.js` faz
 * isso.
 */
export function WidgetHeightReporter() {
  useEffect(() => {
    if (window.parent === window) return;

    const send = () => {
      const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
      window.parent.postMessage({ type: 'coreto:height', height }, '*');
    };

    send();

    // As fontes chegam depois do primeiro desenho e mudam a altura por baixo
    // dos pés; sem o observador, o widget fica com a medida errada até alguém
    // rodar o telemóvel.
    const observer = new ResizeObserver(send);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  return null;
}
