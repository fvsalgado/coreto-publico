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
      <div className="space-y-3 border-t border-border px-4 py-4 text-sm">{children}</div>
    </details>
  );
}
