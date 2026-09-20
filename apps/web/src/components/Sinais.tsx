import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Sinais: um símbolo, uma palavra, e o significado inteiro por baixo.
 *
 * O sítio dizia por extenso o que um símbolo diz de relance — «Acesso a
 * cadeiras de rodas», «Entrada livre», «Não há informação sobre audiodescrição,
 * legendagem e sessão relaxada» — e quem passa os olhos por uma agenda não lê
 * frases, vê marcas. Cada sinal é um ícone mais uma palavra curta; o rótulo
 * inteiro vai em `sr-only` e no `title`, para que um leitor de ecrã ouça
 * «Acesso a cadeiras de rodas» onde o olho vê «♿ Acessível».
 *
 * A regra que governa tudo o que está aqui: **só se assinala o que existe**.
 * A ausência de informação não é um sinal, é a falta dele — e ocupava metade
 * de uma página a explicar-se. A única ausência que continua a valer marca é a
 * que foi verificada (não tem acesso a cadeiras de rodas), porque essa poupa
 * uma viagem.
 *
 * Os desenhos são os do Lucide (ISC), redesenhados aqui à mão para não trazer
 * uma dependência inteira por dez ícones — e para não carregar no cliente um
 * pacote que só serve para desenhar linhas.
 */

export type NomeDeIcone =
  | 'acessivel'
  | 'lgp'
  | 'audiodescricao'
  | 'legendagem'
  | 'relaxada'
  | 'bilhete'
  | 'relogio'
  | 'publico'
  | 'local'
  | 'direcoes'
  | 'telefone'
  | 'email'
  | 'sitio'
  | 'rss'
  | 'calendario'
  | 'codigo'
  | 'etiqueta'
  | 'partilhar'
  | 'externo';

/**
 * Os traços de cada ícone, em `viewBox` de 24.
 *
 * Guardados como fragmentos e não como componentes para o conjunto caber numa
 * tabela que se lê de uma vez — e para acrescentar um ícone ser acrescentar
 * uma linha.
 */
const TRACOS: Record<NomeDeIcone, ReactNode> = {
  acessivel: (
    <>
      <circle cx="16" cy="4" r="1" />
      <path d="m18 19 1-7-6 1" />
      <path d="m5 8 3-3 5.5 3-2.36 3.5" />
      <path d="M4.24 14.5a5 5 0 0 0 6.88 6" />
      <path d="M13.76 17.5a5 5 0 0 0-6.88-6" />
    </>
  ),
  lgp: (
    <>
      <path d="M18 11V6a2 2 0 0 0-4 0" />
      <path d="M14 10V4a2 2 0 0 0-4 0v2" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15" />
    </>
  ),
  audiodescricao: (
    <>
      <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" />
      <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" />
    </>
  ),
  legendagem: (
    <>
      <rect width="18" height="14" x="3" y="5" rx="2" />
      <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
    </>
  ),
  relaxada: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
    </>
  ),
  bilhete: (
    <>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
      <path d="M13 5v2M13 11v2M13 17v2" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  publico: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  local: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  direcoes: <path d="m3 11 19-9-9 19-2-8z" />,
  telefone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  ),
  email: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-9 5.7a2 2 0 0 1-2 0L2 7" />
    </>
  ),
  sitio: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 3.6 9A14 14 0 0 1 12 21a14 14 0 0 1-3.6-9A14 14 0 0 1 12 3z" />
    </>
  ),
  rss: (
    <>
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </>
  ),
  calendario: (
    <>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </>
  ),
  codigo: (
    <>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </>
  ),
  etiqueta: (
    <>
      <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" />
      <circle cx="7.5" cy="7.5" r=".5" />
    </>
  ),
  // Três nós e duas arestas: o desenho de partilhar que todos os telemóveis
  // já ensinaram.
  partilhar: (
    <>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" />
    </>
  ),
  externo: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
};

interface IconeProps {
  nome: NomeDeIcone;
  /** Em `em`, para o ícone crescer com o texto ao lado. */
  className?: string;
}

/**
 * Um ícone é sempre decorativo.
 *
 * `aria-hidden` em todos, sem exceção: o significado vive no texto que os
 * acompanha, nunca no desenho. Um ícone que precise de `aria-label` para se
 * explicar é um ícone que devia ter uma palavra ao lado.
 */
export function Icone({ nome, className = 'size-3.5' }: IconeProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} shrink-0`}
      aria-hidden="true"
    >
      {TRACOS[nome]}
    </svg>
  );
}

/** Sóbrio por omissão; `destaque` para o que muda a decisão de sair de casa. */
type Tom = 'normal' | 'destaque' | 'apagado';

const TONS: Record<Tom, string> = {
  normal: 'border-border bg-surface text-ink',
  destaque: 'border-transparent bg-accent-soft font-medium text-accent',
  apagado: 'border-border border-dashed bg-transparent text-muted',
};

const BASE =
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs leading-none';

interface SinalProps {
  icone?: NomeDeIcone;
  /** O significado inteiro, para quem ouve a página e para o rato parado em cima. */
  rotulo: string;
  /** A palavra curta que se vê. Sem ela mostra-se o rótulo inteiro. */
  children?: ReactNode;
  tom?: Tom;
}

/**
 * Um sinal.
 *
 * `rotulo` é o que se diz; `children` é o que se vê. Quando são diferentes, o
 * visível fica `aria-hidden` e o completo em `sr-only` — o leitor de ecrã não
 * ouve «AD», ouve «com audiodescrição».
 */
export function Sinal({ icone, rotulo, children, tom = 'normal' }: SinalProps) {
  const curto = children ?? rotulo;
  const igual = curto === rotulo;

  return (
    <span className={`${BASE} ${TONS[tom]}`} title={igual ? undefined : rotulo}>
      {icone ? <Icone nome={icone} /> : null}
      {igual ? (
        <span>{curto}</span>
      ) : (
        <>
          <span className="sr-only">{rotulo}</span>
          <span aria-hidden="true">{curto}</span>
        </>
      )}
    </span>
  );
}

interface SinalLinkProps {
  href: string;
  icone?: NomeDeIcone;
  children: ReactNode;
  /** Ligação para fora: leva `nofollow` e a seta que avisa que se sai daqui. */
  externo?: boolean;
  /**
   * Rota que devolve um ficheiro — RSS, iCal, um `.ics` de evento.
   *
   * Âncora simples e não `next/link`: o encaminhador do lado do cliente tenta
   * tratar o endereço como uma página e o descarregamento não acontece.
   */
  ficheiro?: boolean;
  tom?: Tom;
  /** Para a contagem de cliques, quando o sinal é uma ação medida. */
  statKind?: string;
}

/** O mesmo sinal, quando é para clicar. */
export function SinalLink({
  href,
  icone,
  children,
  externo = false,
  ficheiro = false,
  tom = 'normal',
  statKind,
}: SinalLinkProps) {
  const className = `${BASE} ${TONS[tom]} underline-offset-4 hover:underline`;
  const conteudo = (
    <>
      {icone ? <Icone nome={icone} /> : null}
      <span>{children}</span>
      {externo ? <Icone nome="externo" className="size-3 opacity-60" /> : null}
    </>
  );

  if (externo || ficheiro) {
    return (
      <a
        href={href}
        rel={externo ? 'noopener nofollow' : undefined}
        className={className}
        data-stat-kind={statKind}
      >
        {conteudo}
      </a>
    );
  }

  return (
    <Link href={href} className={className} data-stat-kind={statKind}>
      {conteudo}
    </Link>
  );
}

/** Uma fila de sinais. Não se desenha quando não há nenhum. */
export function Sinais({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
