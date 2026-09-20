'use client';

import { useSyncExternalStore } from 'react';
import { alternar, estaGuardado, subscrever, type ParaGuardar } from '@/src/lib/favoritos';

interface Props {
  evento: ParaGuardar;
  /** No cartão é uma pílula a par das outras; na ficha é um botão do tamanho dos vizinhos. */
  variante?: 'cartao' | 'ficha';
}

const NO_CARTAO =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium leading-none';
const NA_FICHA = 'inline-flex min-h-11 items-center gap-2 rounded border px-4 text-sm font-medium';

/**
 * O coração.
 *
 * `aria-pressed` e não dois rótulos diferentes: é um interruptor, e é assim
 * que um leitor de ecrã o anuncia — «Guardar, botão de alternância, ativado».
 * O nome leva o título do evento porque numa lista de quarenta cartões
 * «Guardar, Guardar, Guardar» não diz de qual se trata.
 *
 * `useSyncExternalStore` é o que liga isto ao armazenamento sem um efeito a
 * correr depois da pintura: no servidor responde «não guardado» — que é o que
 * o HTML tem de dizer, porque o servidor não sabe nem pode saber — e a
 * primeira leitura no cliente corrige antes de haver pintura. A subscrição
 * ouve as outras abas, para dois separadores abertos não discordarem.
 *
 * Sem JavaScript não aparece: um coração que não guarda é pior do que coração
 * nenhum. Quem navega sem JavaScript continua com a ficha, o `.ics` e os
 * feeds, que são as vias que esta casa promete funcionarem sem ele.
 */
export function BotaoFavorito({ evento, variante = 'cartao' }: Props) {
  const guardado = useSyncExternalStore(
    subscrever,
    () => estaGuardado(evento.slug),
    () => false,
  );

  const base = variante === 'cartao' ? NO_CARTAO : NA_FICHA;
  const cor = guardado
    ? 'border-accent bg-accent-soft text-accent'
    : 'border-border bg-surface hover:border-accent/40';

  return (
    <button
      type="button"
      aria-pressed={guardado}
      aria-label={`Guardar «${evento.title}»`}
      onClick={() => alternar(evento)}
      className={`${base} ${cor}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill={guardado ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={variante === 'cartao' ? 'size-3.5' : 'size-4'}
      >
        <path d="M12 20.3 4.3 12.6a4.6 4.6 0 0 1 6.5-6.5l1.2 1.2 1.2-1.2a4.6 4.6 0 0 1 6.5 6.5z" />
      </svg>
      {guardado ? 'Guardado' : 'Guardar'}
    </button>
  );
}
