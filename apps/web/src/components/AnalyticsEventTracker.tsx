'use client';

import { useEffect } from 'react';
import { recordStat } from '@/src/lib/analytics/beacon';
import { STAT_KIND_ATTRIBUTE, isStatKind } from '@/src/lib/analytics/kinds';

interface Props {
  eventId: string;
}

/**
 * Conta o que se faz numa ficha de evento: a abertura e os cliques.
 *
 * Não desenha nada. Fica ao lado do conteúdo, que continua a ser renderizado
 * no servidor — se este componente falhar, ou se o JavaScript nem chegar a
 * correr, a ficha funciona exatamente na mesma e apenas não é contada.
 *
 * Os cliques são apanhados por delegação, num só ouvinte, a partir do atributo
 * `data-stat-kind`. Na fase de captura porque o clique num `<a>` leva a página
 * embora a seguir: a contagem tem de partir antes disso (e `sendBeacon`
 * encarrega-se de a entregar mesmo com a página já a fechar).
 */
export function AnalyticsEventTracker({ eventId }: Props) {
  useEffect(() => {
    recordStat(eventId, 'view');

    const onClick = (nativeEvent: MouseEvent) => {
      const target = nativeEvent.target;
      if (!(target instanceof Element)) return;

      const trigger = target.closest(`[${STAT_KIND_ATTRIBUTE}]`);
      const kind = trigger?.getAttribute(STAT_KIND_ATTRIBUTE);
      if (!isStatKind(kind)) return;

      recordStat(eventId, kind);
    };

    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [eventId]);

  return null;
}
