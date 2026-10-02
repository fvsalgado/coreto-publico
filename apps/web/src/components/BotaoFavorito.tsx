'use client';

import { useSyncExternalStore } from 'react';
import { alternar, estaGuardado, subscrever, type ParaGuardar } from '@/src/lib/favoritos';

interface Props {
  evento: ParaGuardar;
  /**
   * No cartão é só o coração, no canto — 44×44 e sem palavra à vista, porque o
   * nome acessível já a diz (C1-002, C3-006); na ficha é um botão do tamanho
   * dos vizinhos, com a palavra.
   */
  variante?: 'icone' | 'ficha';
}

const NO_CARTAO =
  'inline-flex size-11 items-center justify-center rounded-full border border-transparent';
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
export function BotaoFavorito({ evento, variante = 'icone' }: Props) {
  const guardado = useSyncExternalStore(
    subscrever,
    () => estaGuardado(evento.slug),
    () => false,
  );

  const base = variante === 'icone' ? NO_CARTAO : NA_FICHA;
  // Na ficha, a moldura é a dos botões ao lado — a de um controlo, que tem de
  // se ver a 3:1 (1.4.11). Era a decorativa, e num grupo de iguais o diferente
  // lê-se como o principal (C1-012). No cartão não há moldura: o coração é o
  // controlo, e o desenho dele é o que se vê — a 3:1, no tom apagado.
  const cor =
    variante === 'icone'
      ? guardado
        ? 'text-accent hover:bg-accent-soft'
        : 'text-muted hover:bg-accent-soft hover:text-ink'
      : guardado
        ? 'border-accent bg-accent-soft text-accent'
        : 'border-field bg-surface hover:border-accent';

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
        className={variante === 'icone' ? 'size-[1.375rem]' : 'size-4'}
      >
        <path d="M12 20.3 4.3 12.6a4.6 4.6 0 0 1 6.5-6.5l1.2 1.2 1.2-1.2a4.6 4.6 0 0 1 6.5 6.5z" />
      </svg>
      {variante === 'icone' ? null : guardado ? 'Guardado' : 'Guardar'}
    </button>
  );
}
