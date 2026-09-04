/**
 * Os pontos: os cartões de quatro linhas com que `/informacoes`,
 * `/privacidade` e `/acessibilidade` resumem o que a seguir dizem por
 * extenso.
 *
 * Viviam dentro de `informacoes/page.tsx`, quando a página era uma só. Saíram
 * de lá no dia em que a política de privacidade e a declaração de
 * acessibilidade ganharam endereço próprio: três páginas a desenhar o mesmo
 * cartão com três cópias do mesmo componente era uma divergência à espera de
 * acontecer. Os desenhos ficam aqui ao lado porque só existem para entrar num
 * destes cartões.
 */

const traco = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export type Icone = (props: { className: string }) => React.ReactElement;

export const IcRegiao: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <path d="M9 4 3 6.4v13.4L9 17.4l6 2.4 6-2.4V4l-6 2.4z" />
    <path d="M9 4v13.4M15 6.4v13.4" />
  </svg>
);

export const IcIgual: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <path d="M4 9.5h16M4 14.5h16" />
  </svg>
);

export const IcFonte: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <path d="M5 20a1 1 0 0 1 0-16h9.5a1 1 0 0 1 0 6H9a1 1 0 0 0 0 6h10" />
    <path d="m16 17 3 2-3 2" />
  </svg>
);

export const IcAberto: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <rect x="4" y="10.5" width="16" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 7.5-2" />
  </svg>
);

export const IcSemRasto: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A9 9 0 0 1 21 12a17 17 0 0 1-3.1 3.9M6.3 6.4A17 17 0 0 0 3 12a9 9 0 0 0 12.4 4.7" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

export const IcTema: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M18.4 5.6l-1.3 1.3M6.9 17.1l-1.3 1.3" />
  </svg>
);

export const IcContagem: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <path d="M4 20V13M9.3 20V8M14.7 20v-7M20 20V5" />
  </svg>
);

export const IcCarta: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.8 6.5 7.1 5.3a2 2 0 0 0 2.2 0l7.1-5.3" />
  </svg>
);

export const IcTeclado: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M6 13h.01M18 9.5h.01M8.5 15h7" />
  </svg>
);

export const IcOlho: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <path d="M21 12s-3.6 6-9 6-9-6-9-6 3.6-6 9-6 9 6 9 6z" />
    <circle cx="12" cy="12" r="2.7" />
  </svg>
);

export const IcRobo: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <rect x="4" y="8" width="16" height="11" rx="2.5" />
    <path d="M12 4.5V8M9 13h.01M15 13h.01M9.5 16h5" />
  </svg>
);

export const IcPorFazer: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export interface Ponto {
  Icone: Icone;
  titulo: string;
  texto: string;
}

/**
 * Quatro pontos em vez de quatro secções.
 *
 * Isto eram quatro capítulos com título, três parágrafos cada, e diziam o
 * que aqui cabe em quatro linhas. O argumento longo tem lugar — mas não à
 * frente de quem só quer perceber o que é isto.
 */
export function Pontos({ pontos }: { pontos: readonly Ponto[] }) {
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {pontos.map(({ Icone, titulo, texto }) => (
        <li
          key={titulo}
          className="flex gap-3 rounded-lg border border-border bg-surface px-4 py-3.5"
        >
          <span className="ct-octagon mt-0.5 grid size-9 shrink-0 place-items-center bg-accent-soft text-accent">
            <Icone className="size-5" />
          </span>
          <span>
            <strong className="block font-medium">{titulo}</strong>
            <span className="mt-0.5 block text-sm text-muted">{texto}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
