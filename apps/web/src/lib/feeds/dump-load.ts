import { eventFilterSchema } from '@coreto/core';
import type { Regiao } from '@/src/lib/regiao';
import { construirDump, type DumpDaRegiao } from './dump';
import { loadFeed } from './load';

/**
 * Quantos eventos cabem num ficheiro destes.
 *
 * O `eventFilterSchema` trava o `limit` em 100 porque é o que uma **listagem**
 * pode pedir: quem pagina de cem em cem não deve conseguir pedir dez mil de uma
 * vez pela barra de endereços. Este ficheiro não é uma listagem — é o catálogo,
 * e paginá-lo era exatamente o problema que ele vem resolver.
 *
 * Cinco mil é folga larga sobre o que existe: o Médio Tejo tem 194 eventos
 * publicados hoje. Não é ilimitado de propósito — um tecto escrito é o que
 * separa «serve o catálogo» de «faz o que lhe pedirem».
 */
export const MAXIMO_DO_DUMP = 5000;

export async function carregarDump(regiao: Regiao): Promise<DumpDaRegiao> {
  const { events, context } = await loadFeed(regiao, {
    ...eventFilterSchema.parse({}),
    limit: MAXIMO_DO_DUMP,
  });

  return construirDump({ id: regiao.id, nome: regiao.nome }, events, context, new Date());
}
