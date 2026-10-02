/**
 * As ligações do painel para as páginas públicas — sempre para o domínio da
 * região da coisa, e nunca relativas (C4-017).
 *
 * O painel serve-se em qualquer anfitrião (`middleware.ts`): no `coreto.org`,
 * no domínio de cada região, em `localhost`. Uma ligação relativa como
 * `/evento/<slug>` resolve-se no anfitrião do painel — e a ficha de um evento
 * do Médio Tejo aberta a partir de `coreto.org/admin` dava 404, porque o
 * `coreto.org` não é de região nenhuma.
 *
 * Puro de propósito: recebe o anfitrião do pedido em vez de o ler, para se
 * testar sem servidor.
 */

/**
 * O endereço público de um caminho de uma região. Os domínios `*.localhost`
 * são os das bases locais de ensaio: servem-se por http e na porta do painel.
 */
export function enderecoPublico(
  dominio: string,
  caminho: string,
  porta: string | null = null,
): string {
  const local = dominio === 'localhost' || dominio.endsWith('.localhost');
  return `${local ? 'http' : 'https'}://${dominio}${local && porta ? `:${porta}` : ''}${caminho}`;
}

/** A porta do anfitrião do pedido, se a tiver (`localhost:3000` → `3000`). */
export function portaDoAnfitriao(anfitriao: string | null | undefined): string | null {
  return /:(\d{1,5})$/.exec(anfitriao ?? '')?.[1] ?? null;
}

export interface Ligacoes {
  /** O endereço público de um caminho de uma região, ou `null` se ela não tem domínio. */
  daRegiao(regiao: string | null | undefined, caminho: string): string | null;
  /** O mesmo, pela região de um concelho. */
  doConcelho(concelho: string | null | undefined, caminho: string): string | null;
}

/**
 * As ligações deste pedido. Uma região sem domínio não tem para onde ligar —
 * o endereço do deployment é a página do produto —, e a página mostra o nome
 * sem ligação em vez de uma ligação que dá 404.
 */
export function ligacoesPublicas(
  regioes: ReadonlyArray<{ id: string; domain: string | null }>,
  regiaoDoConcelho: ReadonlyMap<string, string>,
  anfitriao: string | null | undefined,
): Ligacoes {
  const porta = portaDoAnfitriao(anfitriao);
  const dominios = new Map(regioes.map((regiao) => [regiao.id, regiao.domain?.trim() ?? '']));
  const daRegiao = (regiao: string | null | undefined, caminho: string): string | null => {
    const dominio = regiao ? dominios.get(regiao) : undefined;
    return dominio ? enderecoPublico(dominio, caminho, porta) : null;
  };
  return {
    daRegiao,
    doConcelho: (concelho, caminho) =>
      daRegiao(concelho ? regiaoDoConcelho.get(concelho) : null, caminho),
  };
}
