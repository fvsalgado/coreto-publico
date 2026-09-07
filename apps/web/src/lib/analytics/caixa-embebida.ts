/**
 * Que caminhos são a caixa embebida, dito num módulo sem dependências.
 *
 * Vive sozinho, e não ao lado do resto da medição, por uma razão que se mede
 * no que viaja para o navegador: **um componente de cliente paga tudo o que
 * importa**, e o `posthog.ts` traz a chave e a biblioteca atrás dele. O
 * `AnalyticsProvider` está no layout da região, e o widget serve-se por baixo
 * desse layout — por isso o pacote com a chave era descarregado dentro do
 * `iframe` de cada câmara, para depois a guarda o mandar embora sem correr.
 * Não era uma fuga de privacidade (verificou-se: não saía um único pedido do
 * `iframe`), era peso morto na casa de um cliente.
 *
 * Com a pergunta neste ficheiro, o provider responde-a antes de importar seja
 * o que for, e a chave só viaja para as páginas que a usam. É o mesmo
 * princípio que já custou duas vezes ao Zod, e está escrito nos invariantes:
 * um ficheiro partilhado pelos dois lados não pode importar o que é pesado.
 */

/**
 * A caixa embebida não se conta.
 *
 * Quem embebe a agenda no sítio da câmara não está a visitar o Coreto: contar
 * essas vistas era somar o trânsito do sítio de outra pessoa ao nosso, e o
 * número que se entrega a quem financia deixava de dizer o que diz.
 */
export function ehCaixaEmbebida(path: string): boolean {
  return path.startsWith('/widget/');
}
