'use client';

/**
 * Os destaques — os cartazes, em fila, para tocar e passar.
 *
 * A ideia é a das «stories»: a semana vista pelas imagens em vez de pela
 * lista. O que aqui muda em relação ao formato de onde veio são três coisas,
 * e as três são regras deste projeto e não gosto pessoal.
 *
 * **Funciona sem JavaScript.** A fila é feita de `<a>` verdadeiros para as
 * páginas dos eventos. Sem JavaScript fica uma fila de cartazes que se
 * percorre e onde se clica — que já é a melhor parte. Com JavaScript, o clique
 * é intercetado e abre-se o visor de ecrã inteiro. Nada do essencial depende
 * do segundo caso.
 *
 * **Sem dependência nova.** O visor é um `<dialog>` do próprio browser, que já
 * traz o fecho por Escape, o foco preso lá dentro e o fundo inerte. Um pacote
 * de diálogo para isto seriam trinta kilobytes para repetir o que a plataforma
 * faz melhor.
 *
 * **O avanço automático tem travão à vista.** Segurar o dedo para pausar não
 * serve a quem navega por teclado ou leitor de ecrã, e a WCAG 2.2.2 exige um
 * interruptor para qualquer movimento automático com mais de cinco segundos.
 * Quem tenha `prefers-reduced-motion` não chega a ter avanço automático
 * nenhum: fica só a passagem por vontade própria.
 *
 * Os dados não custam uma consulta: são os mesmos eventos da semana que a
 * página inicial já foi buscar.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Capa } from '@/src/components/Capa';
import { formatDatasDoCartao } from '@/src/lib/format';
import type { EventCard } from '@/src/lib/queries/types';

/** Um destaque já com a hora e os dias das sessões (`withCardTimes`). */
type Destaque = EventCard & { start_time?: string | null; dias?: readonly string[] };

interface Props {
  events: Destaque[];
  /**
   * O dia de hoje em Lisboa, `YYYY-MM-DD`, vindo do servidor.
   *
   * Este componente corre no cliente e não pode calcular a data sozinho: a
   * página é construída de hora a hora e serve-se do cache, por isso o
   * «hoje» do browser e o «hoje» do HTML divergem — e o React descarta a
   * árvore inteira quando isso acontece.
   */
  today: string;
  municipalityNames?: Record<string, string>;
  venueNames?: Record<string, string>;
}

/** Cada cartaz fica cinco segundos, que é o tempo de o ler sem pressa. */
const MS_POR_CARTAZ = 5000;

/**
 * Abaixo disto não vale a pena.
 *
 * Dois cartazes não são uma montra — são dois cartazes, e a lista por baixo
 * mostra-os melhor. A fila só aparece quando há semana que chegue para ela.
 */
const MINIMO = 3;

/** Quantos cartazes cabem na fila antes de ela deixar de ser uma escolha. */
const DESTAQUES = 12;

/**
 * Quantos se veem na secretária: um grande e seis pequenos (C1-030).
 *
 * Os outros continuam no visor, que se percorre com as setas: a vitrine é a
 * montra da semana e não o catálogo, e o catálogo está logo a seguir.
 */
const NA_VITRINE = 7;

const CONSULTA_MOVIMENTO = '(prefers-reduced-motion: reduce)';

function subscreverMovimento(avisar: () => void): () => void {
  const mq = window.matchMedia(CONSULTA_MOVIMENTO);
  mq.addEventListener('change', avisar);
  return () => mq.removeEventListener('change', avisar);
}

/**
 * A preferência do sistema por menos movimento.
 *
 * `useSyncExternalStore` e não um efeito que chama `setState`: o `matchMedia`
 * é exatamente o que esta API existe para ler — uma fonte de verdade fora do
 * React que muda sozinha. Com um efeito, a primeira pintura sai sempre com o
 * valor errado e corrige-se logo a seguir, o que é uma renderização a mais e
 * um aviso do linter com razão.
 *
 * No servidor não há `matchMedia` e a resposta é `false`. É a escolha certa:
 * o avanço automático só arranca depois de o visor abrir, e nessa altura já
 * se sabe a verdade.
 */
function useMovimentoReduzido(): boolean {
  return useSyncExternalStore(
    subscreverMovimento,
    () => window.matchMedia(CONSULTA_MOVIMENTO).matches,
    () => false,
  );
}

export function Destaques({ events, today, municipalityNames, venueNames }: Props) {
  // Doze e não a semana inteira: um destaque é uma escolha, e trinta cartazes
  // numa fila são uma fila, não uma montra. A lista completa está já por
  // baixo. O evento sem imagem entra na mesma, com a capa tipográfica.
  const comCartaz = events.slice(0, DESTAQUES);
  const [aberto, setAberto] = useState<number | null>(null);
  const [pausado, setPausado] = useState(false);
  const movimentoReduzido = useMovimentoReduzido();
  const dialogo = useRef<HTMLDialogElement>(null);

  const total = comCartaz.length;
  const seguinte = useCallback(() => {
    setAberto((i) => (i === null ? null : i + 1 >= total ? null : i + 1));
  }, [total]);
  const anterior = useCallback(() => {
    setAberto((i) => (i === null || i === 0 ? i : i - 1));
  }, []);

  // O `<dialog>` só fica modal por `showModal()` — é isso que prende o foco e
  // torna o resto da página inerte para um leitor de ecrã.
  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberto !== null && !elemento.open) elemento.showModal();
    if (aberto === null && elemento.open) elemento.close();
  }, [aberto]);

  useEffect(() => {
    if (aberto === null || pausado || movimentoReduzido) return;
    const t = setTimeout(seguinte, MS_POR_CARTAZ);
    return () => clearTimeout(t);
  }, [aberto, pausado, movimentoReduzido, seguinte]);

  if (total < MINIMO) return null;

  const atual = aberto === null ? null : comCartaz[aberto];
  const onde = (evento: EventCard) =>
    (evento.venue_id ? venueNames?.[evento.venue_id] : null) ?? evento.location_name;
  // «Mação · Mação» não diz mais do que «Mação»: o concelho só entra quando
  // acrescenta alguma coisa ao sítio — a mesma regra do cartão de evento.
  const ondeComConcelho = (evento: EventCard) => {
    const sitio = onde(evento);
    const concelho = municipalityNames?.[evento.municipality_id];
    return [sitio, concelho === sitio ? null : concelho]
      .filter((parte): parte is string => Boolean(parte))
      .join(' · ');
  };

  return (
    <section aria-labelledby="destaques" className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {/* Um nome só para a janela, «os próximos 7 dias» (C2-040): eram
            quatro — «Esta semana», «Em cartaz esta semana», «A semana dia a
            dia», «os próximos sete dias» —, e quatro nomes fazem pensar em
            quatro coisas. Esta não é a janela: é uma escolha, e diz-se assim.
            Tem fixados de quem administra, que podem ser de fora dos sete
            dias, e o resto tirado à sorte da semana (`comporDestaques`). */}
        <h2 id="destaques" className="ct-heading">
          Em destaque
        </h2>
        {/* Diz que é uma escolha da programação, e não outra programação. Quem
            vê percebe-o pelo desenho; quem ouve não tinha como saber — e ouvia
            os mesmos títulos duas vezes sem perceber porquê. */}
        <p className="text-sm text-muted">
          Uma escolha da programação, para ver de perto. A lista dos próximos 7 dias vem a seguir.
        </p>
      </div>

      {/* No telemóvel, uma prateleira e não um carrossel com botões: o gesto
          de arrastar já existe em todos os dispositivos, e no computador a
          roda do rato e o Tab fazem o mesmo. A barra de scroll fica escondida
          — o desvanecer na margem direita é que diz que há mais.

          Na secretária, uma vitrine (C1-030): a fila de miniaturas de 176
          píxeis punha os cartazes, que são o que a região tem de mais
          vistoso, do tamanho de selos. O primeiro ocupa duas linhas e leva o
          título grande; os seis seguintes ficam em grelha ao lado. */}
      <div className="ct-shelf-wrap ct-vitrine mt-4">
        <ul className="ct-rail gap-4 pb-2 lg:grid-cols-[minmax(0,22.5rem)_repeat(3,minmax(0,1fr))] lg:gap-x-6 lg:gap-y-5 lg:pb-0">
          {comCartaz.map((evento, indice) => {
            const grande = indice === 0;
            const tipografica = !evento.image_url;
            return (
              <li
                key={evento.id}
                className={`shrink-0 snap-start ${grande ? 'lg:row-span-2' : ''} ${
                  indice >= NA_VITRINE ? 'lg:hidden' : ''
                }`}
              >
                <Link
                  href={`/evento/${evento.slug}`}
                  onClick={(acontecimento) => {
                    // Só se interceta o clique simples e sem modificadores:
                    // abrir num separador novo tem de continuar a abrir a
                    // página real.
                    if (
                      acontecimento.metaKey ||
                      acontecimento.ctrlKey ||
                      acontecimento.shiftKey ||
                      acontecimento.button !== 0
                    ) {
                      return;
                    }
                    acontecimento.preventDefault();
                    setPausado(false);
                    setAberto(indice);
                  }}
                  className="group relative block w-36 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:w-44 lg:w-auto"
                >
                  {/* Com cartaz, a capa vai sem título: se o cartaz não
                      responder, a capa que fica por baixo não o escreve uma
                      segunda vez ao lado do que está aqui em baixo. */}
                  <Capa
                    event={evento}
                    today={today}
                    semTitulo={!tipografica}
                    className="shadow-sm transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-md"
                  />
                  {/*
                    O título uma vez só (C1-008). A capa tipográfica já o tem
                    escrito lá dentro, e repeti-lo por baixo gastava a linha
                    onde devia estar o sítio; um cartaz tem-no no desenho, mas
                    a cento e quarenta píxeis não se lê, e por isso fica
                    escrito. Quem ouve ouve-o sempre: a capa é decorativa, e é
                    o título que dá nome à ligação.
                  */}
                  {/* `relative` na ligação não é enfeite: o `sr-only` é
                      `position: absolute`, e sem um ascendente posicionado
                      dentro da prateleira o seu bloco contentor era o
                      documento — o título do último cartaz, mil e tal píxeis
                      à direita, alargava a página, e o telemóvel afastava-a
                      até tudo caber. */}
                  {tipografica ? (
                    <span className="sr-only">{evento.title}</span>
                  ) : (
                    <p
                      className={`mt-2 line-clamp-2 text-sm font-medium group-hover:underline ${
                        grande ? 'lg:font-display lg:mt-3 lg:text-2xl lg:leading-tight' : ''
                      }`}
                    >
                      {evento.title}
                    </p>
                  )}
                  <p
                    className={`text-sm font-medium text-accent ${tipografica ? 'mt-2' : 'mt-0.5'} ${
                      grande ? 'lg:mt-2 lg:text-base' : ''
                    }`}
                  >
                    {formatDatasDoCartao(evento, today)}
                  </p>
                  <p className={`line-clamp-2 text-sm text-muted ${grande ? 'lg:text-base' : ''}`}>
                    {ondeComConcelho(evento)}
                  </p>
                  {grande && (evento.is_free || evento.price_display) ? (
                    <p className="mt-1 hidden text-base text-muted lg:block">
                      {evento.is_free ? 'Entrada livre' : evento.price_display}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <dialog
        ref={dialogo}
        onClose={() => setAberto(null)}
        onCancel={() => setAberto(null)}
        aria-label="Em destaque"
        className="ct-bloco-escuro m-0 h-dvh max-h-none w-dvw max-w-none bg-accent-deep/97 p-0 backdrop:bg-accent-deep/80"
        onKeyDown={(acontecimento) => {
          if (acontecimento.key === 'ArrowRight') seguinte();
          if (acontecimento.key === 'ArrowLeft') anterior();
        }}
      >
        {atual ? (
          // Branco fixo e não `text-paper`: o visor é sempre escuro (o fundo é
          // o grafite profundo nos dois temas), por isso as cores cá dentro não
          // podem virar com o tema — no modo claro «paper» é escuro.
          <div className="flex h-full flex-col text-white">
            {/* A barra de progresso é também a posição na sequência: quem
                chega a meio percebe quantos faltam sem contar. */}
            <div className="flex gap-1 p-3" aria-hidden="true">
              {comCartaz.map((evento, indice) => (
                <span
                  key={evento.id}
                  className={`h-1 flex-1 rounded-full ${
                    indice <= (aberto ?? 0) ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between px-3 pb-2">
              <p className="text-sm" aria-live="polite">
                {(aberto ?? 0) + 1} de {total}
              </p>
              <div className="flex items-center gap-2">
                {/* WCAG 2.2.2: o movimento automático precisa de um botão, e
                    não de um gesto que só existe para quem usa o dedo. */}
                {!movimentoReduzido ? (
                  <button
                    type="button"
                    onClick={() => setPausado((p) => !p)}
                    className="rounded border border-white/40 px-3 py-1.5 text-sm"
                  >
                    {pausado ? 'Retomar' : 'Pausar'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setAberto(null)}
                  className="rounded border border-white/40 px-3 py-1.5 text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center px-3">
              {atual.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={atual.image_url}
                  alt={atual.image_alt ?? atual.title}
                  className="max-h-full max-w-full rounded-lg object-contain"
                />
              ) : (
                <Capa event={atual} today={today} className="w-[min(21rem,82vw,60dvh)]" />
              )}
            </div>

            <div className="p-4">
              <p className="text-sm text-white/80">
                {[
                  formatDatasDoCartao(atual, today),
                  ondeComConcelho(atual),
                  atual.is_free ? 'Entrada livre' : null,
                ]
                  .filter((parte): parte is string => Boolean(parte))
                  .join(' · ')}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{atual.title}</h3>
              <Link
                href={`/evento/${atual.slug}`}
                className="mt-3 inline-flex min-h-11 items-center rounded bg-white px-5 text-sm font-medium text-black"
              >
                Ver o evento
              </Link>
            </div>

            {/* As duas metades do ecrã avançam e recuam. Ficam depois do
                conteúdo e sem nome acessível de propósito: quem usa leitor de
                ecrã tem as setas e os botões, e não precisa de ouvir duas
                zonas sem texto. */}
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={anterior}
              className="absolute inset-y-0 left-0 w-1/3"
            />
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={seguinte}
              className="absolute inset-y-0 right-0 w-1/3"
            />
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
