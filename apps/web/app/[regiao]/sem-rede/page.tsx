import type { Metadata } from 'next';
import { ListaDeFavoritos } from '@/src/components/ListaDeFavoritos';
import { PageHeader } from '@/src/components/PageHeader';
import { SITE_URL } from '@/src/lib/env';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { tituloDoSitio, urlDoSitio } from '@/src/lib/regiao';

/**
 * A página que responde quando não há rede (C3-015).
 *
 * É a única que o service worker guarda (`sw.js/route.ts`), e é a que ele
 * serve a qualquer navegação que falhe — a ficha de um evento, a agenda, os
 * guardados. Por isso diz, antes de mais nada, que está sem rede: uma página
 * da agenda servida de uma cópia passaria por atual, e esta não passa.
 *
 * O que mostra é o que está neste aparelho e em mais lado nenhum: os eventos
 * guardados, com o dia em que se guardaram. É para isso que os guardados
 * existem — o «mais tarde» é muitas vezes à porta do evento, e a porta do
 * evento é muitas vezes sem rede.
 *
 * Sem data de hoje vinda do servidor, de propósito: esta página fica guardada
 * dias, e o «hoje» de quando foi guardada marcava como por acontecer o que já
 * passou. A lista calcula o dia no próprio aparelho.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ regiao: string }>;
}): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  await exigirRegiao(regiaoId);
  return {
    title: 'Sem rede',
    description:
      'Esta página abre quando não há ligação à internet: mostra os eventos guardados neste aparelho, tal como estavam quando os guardou.',
    robots: { index: false, follow: false },
  };
}

export default async function SemRedePage({ params }: { params: Promise<{ regiao: string }> }) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);

  return (
    <>
      <PageHeader
        title="Está sem rede"
        eyebrow="Sem ligação"
        lead="A agenda precisa de rede para estar em dia, e por isso não se mostra daqui. O que guardou neste aparelho continua aqui, tal como estava no dia em que o guardou. Quando a rede voltar, as fichas abrem como sempre."
      />
      <ListaDeFavoritos
        origem={urlDoSitio(regiao, SITE_URL)}
        nomeDoSitio={tituloDoSitio(regiao)}
        semRede
      />
    </>
  );
}
