import type { Metadata } from 'next';
import { todayInLisbon } from '@coreto/core';
import { ListaDeFavoritos } from '@/src/components/ListaDeFavoritos';
import { PageHeader } from '@/src/components/PageHeader';
import { SITE_URL } from '@/src/lib/env';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { tituloDoSitio, urlDoSitio } from '@/src/lib/regiao';

/**
 * Os eventos guardados neste navegador.
 *
 * **Não se indexa, e a razão não é de arrumação.** Esta página é diferente
 * para cada pessoa e igual a vazio para toda a gente que não seja ela — um
 * motor de busca vê a lista vazia, porque a lista vive no `localStorage` de
 * quem a fez. Indexá-la era oferecer ao índice uma página que promete uma
 * coisa e entrega outra.
 *
 * O servidor entra com três coisas que o cliente não deve inventar: o
 * endereço público desta região (para as ligações do ficheiro de calendário),
 * o nome do sítio e o dia de hoje em Lisboa. O resto — o que está guardado —
 * nunca chega aqui.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ regiao: string }>;
}): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  await exigirRegiao(regiaoId);
  return {
    title: 'Guardados',
    description:
      'Os eventos que guardou neste navegador. Ficam só neste aparelho: não há conta, não há servidor, e nada disto chega ao Coreto.',
    alternates: { canonical: '/favoritos' },
    robots: { index: false, follow: true },
  };
}

export default async function FavoritosPage({ params }: { params: Promise<{ regiao: string }> }) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);

  return (
    <>
      <PageHeader
        title="Guardados"
        eyebrow="O que é seu"
        compacto
        lead="Os eventos que guardou ficam neste navegador e mais em lado nenhum: sem conta, sem servidor, e sem passarem pelo Coreto. Limpar os dados do navegador apaga-os, e outro aparelho não os vê."
      />
      <ListaDeFavoritos
        origem={urlDoSitio(regiao, SITE_URL)}
        nomeDoSitio={tituloDoSitio(regiao)}
        hoje={todayInLisbon()}
      />
    </>
  );
}
