'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { capturePageView } from '@/src/lib/analytics/posthog';

/**
 * Arranque do PostHog e envio das vistas de página.
 *
 * Não desenha nada e não devolve `children`: é para pôr uma vez no `layout`,
 * ao lado do conteúdo. Sem `NEXT_PUBLIC_POSTHOG_KEY` não carrega o script nem
 * faz um único pedido — o sítio comporta-se como se este componente não
 * existisse.
 *
 * Depende do caminho e não de `useSearchParams` de propósito: ler os
 * parâmetros de pesquisa obrigaria a envolver isto num `Suspense` e tiraria
 * da renderização estática todas as páginas que estivessem por baixo. Uma
 * medição não vale o custo de tornar o sítio inteiro dinâmico; o que se perde
 * é a distinção entre dois filtros da mesma página, que não é o que faz falta.
 */
export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    void capturePageView(pathname);
  }, [pathname]);

  return null;
}
