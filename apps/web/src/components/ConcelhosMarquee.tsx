'use client';

/**
 * A banda dos onze concelhos, a passar devagar como as bandeirinhas de uma
 * festa. Cada nome liga à página do concelho.
 *
 * A fila anda em CSS e é `aria-hidden` **na cópia**: o conteúdo é duplicado
 * para o recomeço cair sobre o ponto de partida, e a segunda metade não pode
 * existir para leitores de ecrã nem para o teclado. O botão de pausa é
 * obrigatório (SC 2.2.2): `:hover` não é mecanismo para quem anda de teclado
 * ou de dedo. Com `prefers-reduced-motion`, o guard global pára a animação e
 * fica uma fila estática que continua a ler-se e a clicar-se.
 */

import { useState } from 'react';
import Link from 'next/link';

interface Props {
  items: ReadonlyArray<{ id: string; name: string }>;
}

export function ConcelhosMarquee({ items }: Props) {
  const [paused, setPaused] = useState(false);

  if (items.length < 5) return null;

  const row = (hidden: boolean) => (
    <span aria-hidden={hidden || undefined} className="flex items-center">
      {items.map((item) => (
        <span key={item.id} className="flex items-center">
          {hidden ? (
            <span className="inline-flex min-h-11 items-center px-5 text-sm whitespace-nowrap sm:min-h-0 sm:text-base">
              {item.name}
            </span>
          ) : (
            <Link
              href={`/concelho/${item.id}`}
              className="inline-flex min-h-11 items-center px-5 text-sm whitespace-nowrap underline-offset-4 hover:underline sm:min-h-0 sm:text-base"
            >
              {item.name}
            </Link>
          )}
          <span aria-hidden="true" className="ct-octagon size-1.5 shrink-0 bg-highlight" />
        </span>
      ))}
    </span>
  );

  return (
    <div
      className="ct-marquee-host relative overflow-hidden border-y border-border bg-surface py-3 select-none"
      style={{ ['--ct-marquee-duration' as string]: `${items.length * 5}s` }}
    >
      <div className={`ct-marquee flex w-max items-center${paused ? ' ct-paused' : ''}`}>
        {row(false)}
        {row(true)}
      </div>

      <button
        type="button"
        onClick={() => setPaused((value) => !value)}
        aria-pressed={paused}
        aria-label={
          paused
            ? 'Retomar o movimento da fila de concelhos'
            : 'Parar o movimento da fila de concelhos'
        }
        className="absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-field bg-paper/90 backdrop-blur transition-colors hover:bg-paper sm:size-9"
      >
        {paused ? (
          <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden="true">
            <path d="M4.5 2.5v11l9-5.5z" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden="true">
            <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />
          </svg>
        )}
      </button>
    </div>
  );
}
