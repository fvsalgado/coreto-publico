import Link from 'next/link';

export interface PilulaDaFila {
  chave: string;
  rotulo: string;
  href: string;
  activa: boolean;
  /** Quantos eventos há por trás desta pílula; sem número não se escreve nada. */
  quantos?: number | null;
}

interface Props {
  /** O nome da fila, para quem navega por marcos — «Datas», «Concelhos». */
  nome: string;
  pilulas: readonly PilulaDaFila[];
  className?: string;
}

/*
 * `relative` não é enfeite. O texto só para leitores de ecrã («, 4 eventos») é
 * `sr-only`, que é `position: absolute`; sem um ascendente posicionado dentro
 * da fila que desliza, o seu bloco contentor era o documento, e a fila
 * inteira — mil e novecentos pixéis de pílulas — passava a contar para a
 * largura da página. No telemóvel isso fazia o navegador afastar a página
 * até tudo caber, e a agenda abria com letra de formiga.
 */
const ACESA =
  'relative inline-flex min-h-11 items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-4 text-sm font-semibold whitespace-nowrap text-accent';
const APAGADA =
  'relative inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-medium whitespace-nowrap hover:border-accent/40';

/**
 * Uma fila de pílulas que são ligações.
 *
 * As datas, os concelhos e as categorias da agenda saem daqui, e são ligações
 * e não botões de propósito: o estado vive no endereço, a página filtrada
 * funciona sem JavaScript e partilha-se tal como está. No telemóvel a fila
 * desliza; a partir do tablet embrulha (`ct-fila-fichas`).
 *
 * O número entre a pílula e o fim é a contagem, quando se contou. Vai
 * `aria-hidden` porque quem ouve a página recebe a frase inteira — «Tomar,
 * 4 eventos» — e não «Tomar 4».
 */
export function FilaDePilulas({ nome, pilulas, className = '' }: Props) {
  if (pilulas.length === 0) return null;

  return (
    <nav aria-label={nome} className={className}>
      <ul className="ct-fila-fichas">
        {pilulas.map((pilula) => {
          const quantos = pilula.quantos ?? null;
          return (
            <li key={pilula.chave}>
              <Link
                href={pilula.href}
                aria-current={pilula.activa ? 'page' : undefined}
                className={pilula.activa ? ACESA : APAGADA}
              >
                {pilula.rotulo}
                {quantos !== null ? (
                  <>
                    <span aria-hidden="true" className="ct-numeral text-xs opacity-70">
                      {quantos}
                    </span>
                    <span className="sr-only">
                      {quantos === 1 ? ', 1 evento' : `, ${quantos} eventos`}
                    </span>
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
