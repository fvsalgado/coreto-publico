/**
 * O que as duas barreiras de `/admin` têm de saber uma da outra.
 *
 * A área interna é guardada em dois sítios: o middleware, à porta, e o layout
 * de `app/admin`, já dentro do servidor. Não é redundância por gosto — é o que
 * o comentário do middleware promete há muito («uma verificação só à porta é
 * uma verificação que um dia alguém contorna»), e que faltava cumprir: até
 * aqui o layout desenhava o menu conforme a sessão mas servia `{children}` a
 * quem batesse à porta, e nenhuma das páginas de leitura pedia sessão do seu
 * lado. As escritas sempre pediram (`requireAdmin()` em cada ação); as
 * leituras — a fila com emails e texto em bruto, a auditoria, as licenças —
 * não pediam nada.
 *
 * Duas barreiras só valem se disserem o mesmo, e por isso o que elas partilham
 * vive aqui: o nome do cabeçalho por onde uma fala com a outra, e a conta de
 * para onde se manda quem não tem sessão. Este módulo não importa nada — corre
 * tal e qual no runtime de edge do middleware e no servidor das páginas.
 */

/**
 * O cabeçalho de **pedido** com que o middleware diz ao layout qual o caminho
 * de `/admin` que deixou passar.
 *
 * Tem de ser um cabeçalho de pedido — `NextResponse.next({ request: { headers } })`
 * — e não um de resposta: só os de pedido é que o `headers()` de um componente
 * de servidor consegue ler. O prefixo é o da casa, o mesmo do
 * `x-coreto-signature` do webhook de entrada.
 *
 * Que um visitante possa forjá-lo não muda nada: o middleware reescreve-o em
 * todos os pedidos a `/admin`, por isso o que vem de fora nunca chega ao
 * layout, e o único valor que desliga a guarda do layout (`/admin/entrar`) é
 * o que já a desligava por ausência.
 */
export const ADMIN_PATH_HEADER = 'x-coreto-caminho-admin';

/** O endereço da entrada. Um só, para as duas barreiras não divergirem. */
export const ADMIN_LOGIN_PATH = '/admin/entrar';

/**
 * Para onde mandar um pedido a `/admin` que não tem sessão.
 *
 * Guarda-se o caminho a que a pessoa ia, no `destino`, para não se perder o
 * gesto ao entrar — a página de entrada valida-o antes de o usar, e só aceita
 * caminhos internos. `/admin` não leva `destino` porque é para lá que a
 * entrada vai dar de qualquer maneira, e a própria entrada também não, que
 * seria mandar-se a si mesma às voltas.
 */
export function adminLoginPath(pathname: string): string {
  if (pathname === ADMIN_LOGIN_PATH || pathname === '/admin') return ADMIN_LOGIN_PATH;
  return `${ADMIN_LOGIN_PATH}?${new URLSearchParams({ destino: pathname })}`;
}

/**
 * Para onde o layout tem de mandar este pedido, ou `null` quando o serve.
 *
 * A regra tem três metades e a última é a que evita o pior erro possível
 * aqui. Barra-se quando não há sessão, **e** o middleware disse por onde é que
 * o pedido entrou, **e** esse caminho não é a entrada — porque o layout
 * também envolve a `/admin/entrar`, e uma guarda ingénua («sem sessão, vai
 * para a entrada») redirecionava a página de entrada para si própria, em
 * ciclo, deixando a área interna fechada também para quem tem a palavra-passe.
 *
 * Sem cabeçalho não se barra. É o caso patológico de o middleware não ter
 * corrido, e nele o layout não sabe onde está: preferir o ciclo à passagem
 * seria trocar uma área aberta por uma área partida, e nesse cenário quem
 * tinha de barrar era o middleware — esta é a segunda barreira, não a
 * substituta da primeira.
 */
export function barreiraDoLayout(temSessao: boolean, cabecalho: string | null): string | null {
  if (temSessao) return null;
  if (!cabecalho || cabecalho === ADMIN_LOGIN_PATH) return null;
  return adminLoginPath(cabecalho);
}
