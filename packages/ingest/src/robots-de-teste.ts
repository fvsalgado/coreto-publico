/**
 * Um servidor de mentira que serve `robots.txt`, como os verdadeiros servem.
 *
 * Existe por causa de uma coisa que os testes desta casa estavam a esconder.
 * Quando a recolha passou a cumprir o `robots.txt`, quinze ficheiros de teste
 * partiram-se de uma vez — e partiram-se com razão. Os duplos de rede que eles
 * montam respondiam a **qualquer** endereço com a página que o teste queria
 * exercitar, incluindo ao `/robots.txt`. Um servidor que devolve o HTML da
 * agenda quando lhe pedem o `robots.txt` não existe em lado nenhum, e um duplo
 * que se comporta assim mede o código contra um mundo que não é este.
 *
 * A correção não é desligar a verificação nos testes — seria medir a recolha
 * sem a regra que ela passou a ter. É os duplos aprenderem a responder à
 * pergunta que todos os servidores recebem primeiro.
 *
 * Por omissão responde «pode tudo», que é o que trinta e duas das quarenta
 * fontes desta casa respondem de facto. Quem quiser testar uma proibição passa
 * o ficheiro que quer — ou uma função do endereço, para dar ficheiros
 * diferentes a hospedeiros diferentes, que é o que faz falta para exercitar um
 * redirecionamento de um sítio para outro.
 */

type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** O que a esmagadora maioria das fontes serve: um ficheiro que não proíbe. */
export const ROBOTS_PERMISSIVO = 'User-agent: *\nDisallow:\n';

/**
 * Embrulha um `fetchImpl` de teste para ele servir um `robots.txt`.
 *
 * O pedido do `robots.txt` **não** chega ao duplo embrulhado: não gasta uma
 * resposta guionada nem entra nas contagens de pedidos que os testes fazem, e
 * é por isso que se pode acrescentar a regra sem reescrever as asserções que
 * contam quantas vezes se bateu à porta.
 */
export function comRobots(
  fetchImpl: FetchImpl,
  ficheiro: string | ((url: string) => string) = ROBOTS_PERMISSIVO,
): FetchImpl {
  return (input, init) => {
    const url = typeof input === 'string' ? input : String(input);
    if (url.endsWith('/robots.txt')) {
      const corpo = typeof ficheiro === 'function' ? ficheiro(url) : ficheiro;
      return Promise.resolve(
        new Response(corpo, { status: 200, headers: { 'content-type': 'text/plain' } }),
      );
    }
    return fetchImpl(input, init);
  };
}
