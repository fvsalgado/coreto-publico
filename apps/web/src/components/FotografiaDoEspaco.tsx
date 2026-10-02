'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  src: string;
  srcSet?: string;
  /** A largura com que a fotografia é desenhada, para o navegador escolher no `srcSet`. */
  sizes: string;
  alt: string;
  /** «Fabiomgc, CC BY-SA 4.0, via Wikimedia Commons» — só se mostra com a fotografia à vista. */
  credito: string | null;
  /** O que fica por baixo: a capa do espaço, desenhada no servidor. */
  children: React.ReactNode;
}

/**
 * A fotografia da ficha de um espaço, com a capa por baixo e o crédito por
 * baixo dela.
 *
 * **Um `<img>`, e não um fundo**, ao contrário dos cartões: é a imagem
 * principal da página, tem descrição, e é a única maneira de o navegador
 * escolher a medida pelo `srcset` e pelo `sizes` (C3-005). O que o `<img>`
 * traz de mau — o ícone de imagem partida quando falha — é o que este
 * componente trata: ao falhar sai do documento, e fica a capa.
 *
 * **E o crédito sai com ela.** A ficha dizia «Imagem: Fabiomgc, CC BY-SA 4.0»
 * por baixo de uma caixa com o ícone partido — a creditar uma fotografia que
 * não estava lá (C1-016).
 *
 * Uma imagem pode falhar antes de o React acordar, e aí o `onError` já não
 * vem: o efeito de montagem pergunta-lhe se acabou sem píxeis. Sem
 * JavaScript, a fotografia que falha mostra o que o navegador mostra — é o
 * caso que sobra, e é o de menos gente.
 *
 * `fetchPriority="low"` porque o que se vem ler a esta página é o que lá há
 * marcado, e não a fachada; e é também o que impede o React de mandar o
 * navegador pré-carregar a fotografia a partir de outra página.
 */
export function FotografiaDoEspaco({ src, srcSet, sizes, alt, credito, children }: Props) {
  const imagem = useRef<HTMLImageElement>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    const atual = imagem.current;
    if (atual && atual.complete && atual.naturalWidth === 0) setFalhou(true);
  }, []);

  return (
    <figure className="mt-6">
      <div className="relative aspect-[16/10] max-h-96 w-full overflow-hidden rounded-lg border border-border">
        {children}
        {falhou ? null : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imagem}
            src={src}
            srcSet={srcSet}
            sizes={srcSet ? sizes : undefined}
            alt={alt}
            decoding="async"
            fetchPriority="low"
            onError={() => setFalhou(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>
      {credito && !falhou ? (
        <figcaption className="mt-2 text-sm text-muted">Imagem: {credito}</figcaption>
      ) : null}
    </figure>
  );
}
