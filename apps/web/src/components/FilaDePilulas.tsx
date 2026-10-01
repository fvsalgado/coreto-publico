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
  /**
   * O que ficou sem nada neste recorte, no fim da fila e apagado — com a
   * ligação para a página própria, e não para uma lista vazia. Ver
   * `concelhosSemEventos`.
   */
  semEventos?: readonly { chave: string; rotulo: string; href: string }[];
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
const SEM_NADA =
  'relative inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-border px-4 text-sm whitespace-nowrap text-muted hover:border-accent/40';

export function FilaDePilulas({ nome, pilulas, semEventos = [], className = '' }: Props) {
  if (pilulas.length === 0 && semEventos.length === 0) return null;

  const ligacoes = pilulas.map((pilula) => {
    const quantos = pilula.quantos ?? null;
    return (
      <li key={pilula.chave} className="flex-none snap-start">
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
  });

  if (semEventos.length === 0) {
    return (
      <nav aria-label={nome} className={className}>
        <ul className="ct-fila-fichas">{ligacoes}</ul>
      </nav>
    );
  }

  /*
   * Com concelhos a zero, a fila tem duas partes, e só a primeira é navegação.
   *
   * As pílulas filtram a agenda; as dos zeros não filtram nada — levam à
   * página do concelho, que diz porque é que ali não há nada (C2-007). Numa
   * navegação só, eram todos os concelhos num nível — onze, no Médio Tejo —,
   * e o Selo pede no máximo nove
   * (requisito 3.1 da lista «Conteúdo», que o `check:selo` mede contando as
   * ligações de cada `<nav>`). Separadas, com o rótulo «Sem eventos:» entre
   * as duas, são dois grupos — que é como se veem.
   *
   * Continuam na mesma fila que desliza no telemóvel: uma linha a mais por
   * baixo empurrava o primeiro cartão para fora do primeiro ecrã, que é outra
   * verificação do CI. Pela mesma razão, a partir do tablet o grupo dos zeros
   * fica na linha das pílulas e embrulha no espaço que sobra (`.ct-fila-resto`,
   * no `globals.css`).
   */
  return (
    <div className={`ct-fila-fichas ${className}`}>
      {pilulas.length > 0 ? (
        <nav aria-label={nome} className="sm:max-w-full">
          <ul className="flex gap-2 sm:flex-wrap">{ligacoes}</ul>
        </nav>
      ) : null}
      <div className="ct-fila-resto flex items-start gap-2">
        <p className="flex min-h-11 flex-none snap-start items-center text-sm whitespace-nowrap text-muted">
          Sem eventos:
        </p>
        <ul aria-label={`${nome} sem eventos`} className="flex min-w-0 gap-2 sm:flex-wrap">
          {semEventos.map((item) => (
            <li key={item.chave} className="flex-none snap-start">
              <Link href={item.href} className={SEM_NADA}>
                {item.rotulo}
                <span aria-hidden="true" className="ct-numeral text-xs">
                  0
                </span>
                <span className="sr-only">, sem eventos aqui — ver a página</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
