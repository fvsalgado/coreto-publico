import Link from 'next/link';

interface Props {
  vista: 'lista' | 'mapa';
  hrefLista: string;
  hrefMapa: string;
}

const SEGMENTO = 'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium';

/**
 * Lista ou mapa — a mesma agenda, com os mesmos filtros, de duas maneiras.
 *
 * O mapa era uma página à parte que não sabia dos filtros: quem filtrava a
 * agenda por «Tomar, este fim de semana» e ia ao mapa via a região inteira.
 * Os dois endereços saem do mesmo `buildHref`, e é isso que garante que ir e
 * voltar não perde um parâmetro. É a alternância que a GuiaBCN e a OpenAgenda
 * têm, e que o benchmark de 20/09/2026 apontou como o que faltava aqui.
 */
export function VistaDaAgenda({ vista, hrefLista, hrefMapa }: Props) {
  const classe = (esta: Props['vista']) =>
    vista === esta
      ? `${SEGMENTO} bg-accent text-on-accent`
      : `${SEGMENTO} underline-offset-4 hover:underline`;

  return (
    <nav
      aria-label="Vista da agenda"
      className="inline-flex rounded-full border border-border bg-surface p-0.5"
    >
      <Link
        href={hrefLista}
        aria-current={vista === 'lista' ? 'page' : undefined}
        className={classe('lista')}
      >
        Lista
      </Link>
      <Link
        href={hrefMapa}
        aria-current={vista === 'mapa' ? 'page' : undefined}
        className={classe('mapa')}
      >
        Mapa
      </Link>
    </nav>
  );
}
