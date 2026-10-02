'use client';

import { useState } from 'react';

interface Props {
  /** O que vai para a área de transferência. */
  texto: string;
  /** O que o botão diz antes de copiar — «Copiar o endereço». */
  etiqueta: string;
  /** O que se anuncia a quem ouve, depois de copiar. */
  anuncio: string;
  className?: string;
}

/**
 * Um botão que copia uma linha de texto, e diz que copiou.
 *
 * O texto está sempre escrito ao lado, à vista e selecionável: sem
 * JavaScript, ou sem permissão para a área de transferência (um sítio servido
 * por http, um navegador que a recusa), copia-se à mão e não se perde nada.
 * Por isso a falha não se anuncia — não há nada que quem lê possa fazer com
 * ela.
 */
export function BotaoDeCopiar({ texto, etiqueta, anuncio, className = '' }: Props) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // Ver o comentário do componente: o texto está à vista.
        }
      }}
      className={`inline-flex min-h-11 items-center rounded border border-field bg-surface px-4 text-sm font-medium ${className}`}
    >
      {copiado ? 'Copiado' : etiqueta}
      <span aria-live="polite" className="sr-only">
        {copiado ? anuncio : ''}
      </span>
    </button>
  );
}
