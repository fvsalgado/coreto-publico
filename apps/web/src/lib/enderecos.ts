import type { Metadata } from 'next';

/**
 * O endereço canónico de uma página, sem lhe apagar os feeds.
 *
 * Duas coisas que parecem separadas e vivem no mesmo campo. O `canonical` diz
 * a um motor de busca qual é o endereço bom quando há vários a mostrar o mesmo
 * — e faltava em quase todas as páginas, incluindo as onze dos concelhos. Os
 * `types` são os `<link rel="alternate">` que dizem a um leitor de feeds e a
 * um calendário onde subscrever.
 *
 * O laço entre as duas é a regra de fusão do Next: os campos de `metadata` são
 * fundidos à superfície, e uma página que declare `alternates` **substitui** o
 * `alternates` do layout inteiro. Declarar um canónico apagava, sem aviso, os
 * feeds globais dessa página. Por isso passam a sair os dois daqui.
 *
 * O caminho vai sempre por extenso, e é o caminho **público** — `/agenda`,
 * `/concelho/tomar` — nunca um relativo. Já cá viveu um `'./'`, e morreu no
 * dia em que as páginas passaram a viver no segmento `[regiao]`: um relativo
 * resolve contra o caminho da rota, e numa página pré-gerada esse caminho é o
 * interno, com a região dentro — o canónico saía `…/medio-tejo/concelho/tomar`,
 * que não é endereço nenhum.
 *
 * A `origem` é a da região da página (`urlDoSitio`): cada domínio anuncia os
 * seus feeds, não os do vizinho.
 */
export function enderecos(
  origem: string,
  caminho: string,
  tipos: Readonly<Record<string, string>> = {},
): Metadata['alternates'] {
  return {
    canonical: caminho,
    types: {
      'application/rss+xml': `${origem}/feed.xml`,
      'text/calendar': `${origem}/agenda.ics`,
      ...tipos,
    },
  };
}
