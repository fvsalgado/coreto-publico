import { MARCA_GRELHA, MARCA_TRACOS } from '@/src/lib/marca';

interface Props {
  className?: string;
}

/**
 * A marca do sítio: um coreto de traço simples — telhado, remate, colunas,
 * guarda e estrado. Desenhada inline para herdar a cor do texto e não custar
 * um pedido; decorativa, porque anda sempre ao lado da palavra «Coreto».
 *
 * Os traços vêm de `src/lib/marca.ts`, que é de onde o gerador de ícones os lê
 * também: o que está no cabeçalho e o que está no ecrã do telemóvel são o
 * mesmo desenho, e não duas cópias a envelhecer cada uma para seu lado.
 */
export function BandstandMark({ className }: Props) {
  return (
    <svg
      viewBox={`0 0 ${MARCA_GRELHA} ${MARCA_GRELHA}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {MARCA_TRACOS.map((traco) => (
        <path key={traco} d={traco} />
      ))}
    </svg>
  );
}
