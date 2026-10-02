import Link from 'next/link';
import { primeiroNivel } from '@/src/lib/pilulas';

export interface PilulaDaFila {
  chave: string;
  rotulo: string;
  href: string;
  activa: boolean;
  /** Quantos eventos há por trás desta pílula; sem número não se escreve nada. */
  quantos?: number | null;
  /**
   * A classe da cor da família, nas pílulas de categoria: o ponto ao lado do
   * nome é a legenda das cores que os cartões usam (C1-007).
   */
  ponto?: string;
}

interface Props {
  /** O nome da fila, para quem navega por marcos — «Datas», «Concelhos». */
  nome: string;
  /**
   * O nome à vista — «Quando», «Onde», «O quê» (C1-027). As filas eram vinte e
   * cinco pílulas iguais sem nada que dissesse onde acabava o tempo e começava
   * o lugar. Fica à esquerda da fila, e não por cima: uma linha a mais por
   * fila empurrava o primeiro cartão para fora do primeiro ecrã, que é outra
   * verificação do CI. É `aria-hidden` porque quem ouve já tem o nome do
   * marco, que é mais completo.
   */
  rotulo?: string;
  /**
   * As pílulas desta fila em destaque — as de tempo, que respondem à pergunta
   * mais comum e tinham o peso de «Formação e oficinas 2».
   */
  destaque?: boolean;
  pilulas: readonly PilulaDaFila[];
  /**
   * O que ficou sem nada neste recorte, no fim da fila e apagado — com a
   * ligação para a página própria, e não para uma lista vazia. Ver
   * `concelhosSemEventos`.
   */
  semEventos?: readonly { chave: string; rotulo: string; href: string }[];
  /**
   * Quantas pílulas no primeiro nível; as outras ficam atrás de um «Mais».
   * Oito, mais o «Mais», são as nove do Selo — ver `primeiroNivel`.
   */
  maximo?: number;
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
const EM_DESTAQUE =
  'relative inline-flex min-h-11 items-center gap-1.5 rounded-full border border-transparent bg-accent-soft px-4 text-sm font-semibold whitespace-nowrap hover:border-accent/40';

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

export function FilaDePilulas({
  nome,
  rotulo,
  destaque = false,
  pilulas,
  semEventos = [],
  maximo,
  className = '',
}: Props) {
  if (pilulas.length === 0 && semEventos.length === 0) return null;

  const { aVista, resto } = maximo
    ? primeiroNivel(pilulas, maximo)
    : { aVista: pilulas, resto: [] };

  const desenhar = (pilula: PilulaDaFila) => {
    const quantos = pilula.quantos ?? null;
    return (
      <li key={pilula.chave} className="flex-none snap-start">
        {/* Sem pré-carregamento: uma fila são dezenas de ligações, e cada uma
            era um pedido ao entrar no ecrã (C3-013, ver `EventCard`). */}
        <Link
          href={pilula.href}
          prefetch={false}
          aria-current={pilula.activa ? 'page' : undefined}
          className={pilula.activa ? ACESA : destaque ? EM_DESTAQUE : APAGADA}
        >
          {pilula.ponto ? (
            <span aria-hidden="true" className={`ct-octagon size-2.5 shrink-0 ${pilula.ponto}`} />
          ) : null}
          {pilula.rotulo}
          {quantos !== null ? (
            <>
              {/* Na letra do texto e em algarismos de largura igual: estavam
                  na letra dos títulos ao lado de rótulos em sans, e nas
                  pílulas dos espaços em sans — duas letras para o mesmo
                  número (C1-027). Apagado só quando a pílula não está acesa:
                  acesa, a 70 % ficava a 3,1:1 (C3-008). */}
              <span
                aria-hidden="true"
                className={`text-xs tabular-nums ${pilula.activa ? '' : 'opacity-70'}`}
              >
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
  };

  /*
   * O segundo nível, atrás de um «Mais» no fim da fila (Selo 3.1).
   *
   * Um `<details>`, como a gaveta da barra de baixo: abre sem JavaScript e o
   * teclado já o sabe usar. A lista que ele abre é `absolute` em relação ao
   * `<nav>`, e é isso que a deixa escapar à fila: no telemóvel a fila desliza,
   * e um `overflow` corta o que lhe sai de dentro — mas não o que tem por bloco
   * contentor um ascendente dele. Abre por baixo da fila, à largura dela.
   *
   * A chave muda com o que está aceso: escolher uma pílula lá de dentro leva-a
   * para o primeiro nível, e a lista fecha-se em vez de ficar aberta por cima
   * da página nova.
   */
  const acesas = pilulas.filter((pilula) => pilula.activa).map((pilula) => pilula.chave);
  const ligacoes = [
    ...aVista.map(desenhar),
    ...(resto.length > 0
      ? [
          <li key={`mais:${acesas.join(',')}`} className="flex-none snap-start">
            <details>
              <summary className={`ct-sem-marca cursor-pointer ${APAGADA}`}>
                {`Mais ${resto.length}`}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <ul className="absolute inset-x-0 top-full z-30 mt-2 flex flex-wrap gap-2 rounded-lg border border-border bg-surface p-3 shadow-lg">
                {resto.map(desenhar)}
              </ul>
            </details>
          </li>,
        ]
      : []),
  ];

  const nomeAVista = rotulo ? (
    <p
      aria-hidden="true"
      className="flex min-h-11 w-16 flex-none items-center text-sm font-semibold text-muted lg:w-18"
    >
      {rotulo}
    </p>
  ) : null;

  if (semEventos.length === 0) {
    return (
      <nav
        aria-label={nome}
        className={`ct-sem-impressao relative ${rotulo ? 'ct-fila-com-nome flex items-start gap-2' : ''} ${className}`}
      >
        {nomeAVista}
        <ul className="ct-fila-fichas min-w-0 flex-1">{ligacoes}</ul>
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
    // `relative` aqui, e não na navegação: ela vive dentro da fila que desliza,
    // e a lista do «Mais» tem de ter por bloco contentor alguém de fora dela.
    <div
      className={`ct-sem-impressao relative ${rotulo ? 'ct-fila-com-nome flex items-start gap-2' : ''} ${className}`}
    >
      {nomeAVista}
      <div className="ct-fila-fichas min-w-0 flex-1">
        {pilulas.length > 0 ? (
          <nav aria-label={nome} className="sm:max-w-full">
            <ul className="flex gap-2 sm:flex-wrap lg:gap-y-1.5">{ligacoes}</ul>
          </nav>
        ) : null}
        <div className="ct-fila-resto flex items-start gap-2">
          <p className="flex min-h-11 flex-none snap-start items-center text-sm whitespace-nowrap text-muted">
            Sem eventos:
          </p>
          <ul
            aria-label={`${nome} sem eventos`}
            className="flex min-w-0 gap-2 sm:flex-wrap lg:gap-y-1.5"
          >
            {semEventos.map((item) => (
              <li key={item.chave} className="flex-none snap-start">
                <Link prefetch={false} href={item.href} className={SEM_NADA}>
                  {item.rotulo}
                  <span aria-hidden="true" className="text-xs tabular-nums">
                    0
                  </span>
                  <span className="sr-only">, sem eventos aqui — ver a página</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
