/**
 * O texto formal, atrás de um clique: está todo cá, mas não à frente.
 *
 * Um `<details>`, e não um resumo que corta nem uma segunda página: o resumo
 * vai à frente e o formulário atrás, na mesma página. O texto inteiro está no
 * HTML servido — um leitor de ecrã, um motor de busca ou um `curl` leem-no
 * sem carregar em nada. Simplificar não é cortar.
 */
export function PorExtenso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details className="mt-5 rounded-lg border border-border bg-surface">
      <summary className="ct-sem-marca flex min-h-11 cursor-pointer items-center gap-2 px-4 py-3 font-medium">
        <span aria-hidden="true" className="ct-octagon size-2 shrink-0 bg-highlight" />
        {titulo}
      </summary>
      {/*
       * Sem `text-sm`: isto é o corpo de um documento, não uma nota.
       *
       * Aqui vivem a política de privacidade e a declaração de acessibilidade
       * por extenso — os dois textos que uma câmara lê com atenção e que a lei
       * manda publicar. Estiveram a 14px com 1,43x de entrelinha, e o
       * requisito 2.1 da lista «Conteúdo» do Selo pede que o corpo do
       * documento tenha, no mínimo, 12 pontos — que são 16px. Herdando,
       * ficam nos 16px e na entrelinha de 1,6 do `body`.
       */}
      <div className="space-y-3 border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}
