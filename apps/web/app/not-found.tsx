import Link from 'next/link';

/**
 * O 404 de raiz — o que sobra quando nem a região se conhece.
 *
 * Quase nenhum pedido acaba aqui: o que falha dentro de uma região cai no
 * `[regiao]/not-found.tsx`, com o toldo e o rodapé de pé. Este aparece quando
 * o próprio segmento não resolve — um identificador de região que a base não
 * conhece, escrito à mão no caminho — e em tudo o que não seja a raiz num
 * anfitrião sem região, que tem uma página só (a do produto) e mais nenhuma.
 * Rende no esqueleto do produto, sem navegação nenhuma, porque não há região
 * de quem vestir a página — e por isso é deliberadamente pequeno: um título,
 * uma frase e a porta de entrada.
 *
 * A porta diz «início» e não «agenda» por causa desse segundo caso: num
 * anfitrião sem região não há agenda nenhuma para onde mandar seja quem for, e
 * um botão que promete uma é um botão que mente.
 */
export default function NotFound() {
  return (
    <main className="ct-goteira mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-16">
      <p className="ct-eyebrow">Coreto</p>
      <h1 className="ct-display-sm mt-2">Esta página não existe</h1>
      <p className="mt-3 max-w-2xl text-muted">
        O endereço não corresponde a nada que a agenda conheça. Pode ter sido um engano ao copiar —
        nenhuma culpa de quem chegou aqui.
      </p>
      <p className="mt-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded border border-border bg-surface px-4 text-sm underline-offset-4 hover:underline"
        >
          Ir para o início
        </Link>
      </p>
    </main>
  );
}
