'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { capturePageView } from '@/src/lib/analytics/posthog';

/**
 * Arranque do PostHog e envio das vistas de página.
 *
 * Não desenha nada e não devolve `children`: é para pôr uma vez em cada
 * layout que saiba que sítio está a servir. Sem `NEXT_PUBLIC_POSTHOG_KEY` não
 * carrega o script nem faz um único pedido — o sítio comporta-se como se este
 * componente não existisse.
 *
 * **Porque não está no layout de raiz, que seria o sítio óbvio.** Esteve, e
 * daí vinham dois problemas. O de raiz é o único layout por onde tudo passa,
 * e por isso é também o único que não sabe o que está a servir: não tem
 * região nenhuma para declarar, e sem região os números de todos os clientes
 * caem num monte só, separáveis apenas pelo domínio — que é do cliente e
 * muda. E, por ser de todos, media também a área interna: o passeio de quem
 * modera ia para a mesma conta que as visitas de quem procura um concerto,
 * e as primeiras semanas de um cliente novo são precisamente aquelas em que
 * mais se lá anda.
 *
 * Agora quem o monta é quem sabe responder à pergunta: o layout da região
 * (`app/[regiao]/layout.tsx`) e a página do produto
 * (`app/pagina-do-produto/page.tsx`). A área interna não monta nenhum, e é
 * uma decisão e não um esquecimento.
 *
 * Depende do caminho e não de `useSearchParams` de propósito: ler os
 * parâmetros de pesquisa obrigaria a envolver isto num `Suspense` e tiraria
 * da renderização estática todas as páginas que estivessem por baixo. Uma
 * medição não vale o custo de tornar o sítio inteiro dinâmico; o que se perde
 * é a distinção entre dois filtros da mesma página, que não é o que faz
 * falta.
 */
export function AnalyticsProvider({ regiao }: { regiao: string }) {
  const pathname = usePathname();

  useEffect(() => {
    void capturePageView(pathname, regiao);
  }, [pathname, regiao]);

  return null;
}
