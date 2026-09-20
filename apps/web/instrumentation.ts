import type { Instrumentation } from 'next';

/**
 * O que rebenta no servidor chega a algum lado.
 *
 * Até 19 de setembro de 2026 um erro na renderização de uma página, numa
 * rota ou numa Server Action só existia na consola da Vercel, que ninguém lê
 * e que se apaga: as fronteiras de erro (`error.tsx`) correm no navegador do
 * visitante e não têm como avisar o servidor, e o `reportarErro` só era
 * chamado onde alguém se lembrou de o chamar. Uma ficha que rebentasse para
 * todos os visitantes durante um dia inteiro não deixava um registo nosso.
 *
 * O Next chama isto para cada erro não apanhado num pedido do servidor. Vai
 * pelo mesmo caminho de tudo o resto — `reportarErro`, que escreve uma linha
 * de JSON e, com `ERROS_WEBHOOK_URL` configurada, a entrega — com o que
 * identifica o pedido e nada do que identifica a pessoa: o caminho sem a
 * consulta, o método, o tipo de rota e a fase. Sem cabeçalhos, sem endereço,
 * sem corpo.
 */
export const onRequestError: Instrumentation.onRequestError = async (erro, pedido, contexto) => {
  const { reportarErro } = await import('@/src/lib/registo');
  reportarErro('pedido do servidor', erro, {
    caminho: pedido.path.split('?')[0] ?? pedido.path,
    metodo: pedido.method,
    tipoDeRota: contexto.routeType,
    fase: contexto.renderSource ?? null,
    rota: contexto.routePath,
  });
};
