/**
 * Uma ressalva que se lê sem gritar: «pode faltar programação».
 *
 * Estava no turquesa das datas e das ligações, sem caixa nem sinal, e lia-se
 * como coisa que se carrega — e chamava mais a atenção do que o primeiro
 * evento da lista que estava a ressalvar (C1-022). A regra de a dizer fica; o
 * tom passa a ser o de uma nota: apagado, numa caixa da superfície, com o
 * sinal de informação à frente.
 *
 * É um `<p>` com o sinal e o texto lá dentro, e não um `role="note"`: o leitor
 * de ecrã lê a frase no sítio onde ela está, que é antes da lista, e é isso
 * que interessa.
 */
export function NotaDiscreta({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`flex max-w-2xl items-start gap-2 rounded border border-border bg-surface px-3 py-2 text-sm text-muted ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5M12 7.6h.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}
