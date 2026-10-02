'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Capa } from '@/src/components/Capa';

interface Props {
  src: string;
  alt: string;
  /** A largura e a altura declaradas do cartaz, ou nada — nunca uma sozinha. */
  medidas: { width: number; height: number } | null;
  /** O que a capa tipográfica precisa, para o dia em que o cartaz não chega. */
  capa: Parameters<typeof Capa>[0]['event'];
  today: string;
  /** O crédito, desenhado no servidor: só se mostra com o cartaz à vista. */
  credito: ReactNode;
}

/**
 * O cartaz da ficha — e a capa tipográfica quando ele não chega.
 *
 * Os cartazes vêm, na maioria, do servidor de quem organiza, e num gestor de
 * conteúdos municipal esses endereços morrem, recusam ligações ou respondem
 * 503 em HTML (que o Chromium bloqueia). Nas listas isso nunca se via: a capa é
 * fundo em CSS, e um fundo que falha não desenha nada por cima da capa
 * tipográfica (`Capa.tsx`). Na ficha o cartaz é um `<img>` — tem de ser, é o
 * LCP da página e leva texto alternativo —, e um `<img>` que falha desenha o
 * ícone de imagem partida com o texto alternativo, numa moldura de trezentos
 * píxeis, e o crédito por baixo a creditar uma imagem que não está lá (C2-005).
 *
 * Por isso a falha troca a moldura pela capa. Duas vias, e as duas fazem
 * falta: o `onError`, para o que falha depois de a página ganhar vida; e a
 * verificação ao montar, para o que já tinha falhado antes — um erro de imagem
 * não espera pela hidratação, e o React não o volta a disparar.
 *
 * Sem JavaScript fica o `<img>`, como sempre ficou: a degradação é a de antes,
 * e não pior.
 */
export function CartazDaFicha({ src, alt, medidas, capa, today, credito }: Props) {
  const imagem = useRef<HTMLImageElement>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    const elemento = imagem.current;
    // `complete` com largura zero é a imagem que já falhou antes de haver
    // ouvinte; uma que ainda está a chegar tem `complete` a falso.
    if (elemento && elemento.complete && elemento.naturalWidth === 0) setFalhou(true);
  }, []);

  if (falhou) {
    return (
      <div className="lg:order-first">
        <Capa event={capa} today={today} className="mx-auto w-full max-w-80" />
      </div>
    );
  }

  return (
    <figure className="lg:order-first">
      {/* O cartaz como numa vitrine: inteiro, sem corte, e o fundo é o
          próprio cartaz desfocado — qualquer rácio fica com ar de intenção.

          **Este comentário dizia «não se declara a altura da imagem porque
          ninguém a sabe». Já se sabe.** A recolha lê o cabeçalho de cada
          cartaz e guarda as medidas (migração 0126); declaradas no `<img>`,
          o navegador calcula a caixa exacta antes de a imagem existir e o
          salto desaparece em vez de encolher.

          O `min-h` fica **só para quem não as tem** — um cartaz que chegou
          por submissão, um formato que não se lê, uma noite em que o
          servidor da câmara respondeu 503. Aí volta a ser o que sempre foi:
          reserva-se a vitrine, e o que sobra de salto é a diferença entre o
          reservado e o cartaz, não o cartaz inteiro. Mantê-lo quando as
          medidas existem era reservar duas vezes — a moldura ficava com a
          altura mínima mesmo para um cartaz baixo, com uma tira de fundo
          desfocado por baixo dele.

          **E a promessa dos dois parágrafos de cima — «o salto
          desaparece» — foi falsa desde o dia em que foi escrita**
          (947dd9e, 3 de setembro de 2026). As medidas iam declaradas e não
          reservavam nada: o `<img>` era `w-auto` dentro desta grelha
          `place-items-center`, a largura era `fit-content`, e um `<img>`
          sem imagem ainda não ocupa largura nenhuma. Medido em produção
          com o cartaz retido, a 1280 px: caixa reservada **0×0** e a
          moldura com 992×50 — só o `p-6`. Uma proporção não tem a que se
          aplicar quando a largura é zero, e o que saltava era a altura
          inteira do cartaz. Como o `min-h` tinha sido tirado por haver
          medidas, as fichas **com** medidas passaram a saltar mais do que
          as sem: o commit que quis corrigir a métrica piorou-a. Quatro
          fichas de produção, 0,15 a 0,20 na secretária e 0,15 a 0,37 no
          telemóvel. Tirar a reserva de baixo só se podia fazer depois de a
          de cima funcionar mesmo — e não funcionava. A correção está no
          `w-full` e no `maxWidth` do cartaz, aqui em baixo. */}
      <div
        className={`relative isolate grid place-items-center overflow-hidden rounded-lg border border-border bg-accent-soft p-4 sm:p-6 ${
          medidas ? '' : 'min-h-72 sm:min-h-[26rem]'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl saturate-[1.1] dark:opacity-25 dark:saturate-100"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imagem}
          onError={() => setFalhou(true)}
          src={src}
          alt={alt}
          /*
           * Este cartaz é o elemento maior acima da dobra — é ele que o
           * navegador mede como LCP, e o LCP é fator de ordenação. Sem
           * prioridade declarada entra na fila com o resto e o browser só
           * o descobre depois de resolver o CSS. `high` diz-lhe que
           * comece já.
           *
           * O irmão desfocado por trás não leva nada: é a mesma origem, o
           * navegador desduplica o pedido, e declarar prioridade nos dois
           * era pedir a mesma coisa duas vezes com pressa a dobrar.
           */
          fetchPriority="high"
          decoding="async"
          /*
           * As medidas, quando se sabem.
           *
           * Não são o tamanho a que o cartaz é desenhado — o CSS aqui ao
           * lado manda nisso. São a **proporção**: é dela que o navegador
           * tira a altura da caixa a partir da largura disponível, antes
           * de ter um único byte da imagem. Declarar uma e não a outra não
           * serve de nada; ou vão as duas ou não vai nenhuma.
           */
          {...(medidas ?? {})}
          /*
           * O tecto de largura, que é o que faz a proporção valer alguma
           * coisa.
           *
           * Com `w-full` a largura deixa de ser zero e passa a ser a da
           * moldura, que o navegador já sabe antes de pedir a imagem: com
           * a proporção declarada, reserva a altura certa à primeira. A
           * mesma medição de cima, com o cartaz retido, passa de 0×0 a
           * 701×544 — a caixa exacta que o cartaz vai ocupar. Nas quatro
           * fichas, 0,0000 de salto nas duas larguras.
           *
           * O tecto tem dois termos e os dois fazem falta. A largura em
           * píxeis não amplia um cartaz pequeno para além do seu tamanho,
           * que é o que `w-auto` fazia de graça. O termo em `rem` é o
           * mesmo `max-h-[34rem]` da classe, traduzido para largura pela
           * proporção: sem ele, um cartaz largo era esticado — a altura
           * batia no `max-h`, a largura ficava na da moldura, e um
           * 1000×776 saía desenhado a 942×544. Medido, não deduzido: é a
           * diferença entre a correção como estava escrita no plano e a
           * que aqui está.
           *
           * Se algum dia o `max-h` da classe mudar, este 34 muda com ele.
           * Não se lê de lá porque o Tailwind precisa da classe escrita
           * por extenso para a gerar.
           */
          style={
            medidas
              ? {
                  maxWidth: `min(${medidas.width}px, ${(
                    (34 * medidas.width) /
                    medidas.height
                  ).toFixed(2)}rem)`,
                }
              : undefined
          }
          className={`relative z-10 max-h-[34rem] rounded shadow-lg ${
            medidas ? 'w-full' : 'w-auto max-w-full'
          }`}
        />
      </div>
      {credito}
    </figure>
  );
}
