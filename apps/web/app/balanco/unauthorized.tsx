/**
 * O que se vê quando falta a chave — com 401, e não com 200.
 *
 * O código faz parte da resposta. Uma porta fechada que responde 200 é uma
 * porta que os registos de quem opera contam como aberta, e é a diferença
 * entre saber que alguém tentou e nunca vir a saber.
 *
 * O texto não diz se a chave estava errada ou se não vinha nenhuma, porque a
 * página que lhe chama não o distingue: dizê-lo era confirmar a quem tenta
 * que acertou em metade.
 */
export default function SemChave() {
  return (
    <main className="mx-auto max-w-prose px-4 py-16">
      <h1 className="text-2xl font-semibold">Este endereço precisa de uma chave</h1>
      <p className="mt-4 text-muted">
        O balanço de uma região abre-se com um endereço próprio, que quem opera a agenda envia a
        quem a contrata. Se tem esse endereço, abra-o por inteiro — a chave faz parte dele.
      </p>
      <p className="mt-4 text-muted">
        Se o endereço deixou de funcionar, a chave pode ter caducado ou ter sido substituída por uma
        nova. Peça-a a quem lho enviou.
      </p>
    </main>
  );
}
