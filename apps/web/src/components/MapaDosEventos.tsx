'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { Capa } from '@/src/components/Capa';
import { direcoesPara } from '@/src/lib/direcoes';
import { formatEventDates } from '@/src/lib/format';
import type { ConcelhoNoMapa, EventoNoMapa, Lugar, Marca } from '@/src/lib/mapa';

/**
 * O MapLibre não renderiza no servidor — toca em `window` logo no arranque — e
 * são trezentos quilobytes que só esta página precisa. Carregado à parte, o
 * resto do sítio não os paga, e a tabela concelho a concelho continua a ser a
 * versão que funciona sem JavaScript nenhum.
 */
const MapaVivo = dynamic(() => import('@/src/components/MapaVivo').then((m) => m.MapaVivo), {
  ssr: false,
  loading: () => (
    <div
      className="ct-grain h-[60vh] max-h-[560px] min-h-[320px] w-full animate-pulse rounded-lg border border-border bg-paper"
      aria-hidden="true"
    />
  ),
});

interface Props {
  lugares: Lugar[];
  concelhos: ConcelhoNoMapa[];
  /** Quantos eventos há em cada concelho. Dá o tom do preenchimento. */
  eventosPorConcelho: Record<string, number>;
  /** Hoje em Lisboa, vindo do servidor: o cliente não decide que dia é. */
  hoje: string;
  /** O mapa está a mostrar um recorte da agenda, e não a região inteira. */
  filtrado?: boolean;
}

function contarEventos(quantos: number): string {
  return quantos === 1 ? '1 evento' : `${quantos} eventos`;
}

export function MapaDosEventos({
  lugares,
  concelhos,
  eventosPorConcelho,
  hoje,
  filtrado = false,
}: Props) {
  // A marca escolhida guarda-se inteira, e não pelo identificador: a
  // composição das marcas muda a cada zoom, e um identificador guardado
  // apontava para uma junção que já não existe assim que alguém se aproximasse.
  const [marca, setMarca] = useState<Marca | null>(null);

  // Sem lugares não há mapa que se desenhe — mas desaparecer em silêncio deixa
  // a página com um buraco e sem explicação. A tabela por baixo continua a
  // valer, e é para lá que se manda quem chegou aqui.
  if (lugares.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
        {filtrado
          ? 'Nenhum evento passa nestes filtros, e por isso não há mapa. Tire um filtro, ou volte à lista.'
          : 'Não há nada marcado de hoje em diante, e por isso não há mapa. A tabela por baixo mostra concelho a concelho o que se sabe — e, em cada um, de onde vem a programação.'}
      </p>
    );
  }

  const total = lugares.reduce((soma, atual) => soma + atual.eventos.length, 0);
  const comMorada = lugares.filter((candidato) => candidato.precisao === 'exacta');
  const eventosComMorada = comMorada.reduce((soma, atual) => soma + atual.eventos.length, 0);

  return (
    <section aria-labelledby="mapa-titulo">
      <h2 id="mapa-titulo" className="sr-only">
        Mapa dos eventos por acontecer
      </h2>

      <MapaVivo
        lugares={lugares}
        concelhos={concelhos}
        eventosPorConcelho={eventosPorConcelho}
        escolhida={marca?.id ?? null}
        onEscolher={setMarca}
      />

      <p className="mt-2 text-sm text-muted">
        {/*
         * A contagem é de eventos e não de marcas, e é de propósito.
         *
         * Dizia «119 eventos em 43 sítios», e a frase logo a seguir explicava
         * que dez daqueles quarenta e três não são sítios — são centros de
         * concelho, pontos onde não acontece nada. Contradizia-se a si mesma
         * em duas linhas. O que interessa a quem olha é outra coisa: de
         * quantos destes eventos é que se sabe a morada.
         */}
        {contarEventos(total)}, {eventosComMorada} deles com morada conhecida.{' '}
        {eventosComMorada === total
          ? 'Marca cheia: sabe-se onde é.'
          : eventosComMorada === 0
            ? 'Nenhum diz em que espaço é — as marcas estão nos centros dos concelhos.'
            : 'Marca cheia, sabe-se a morada; tracejada e clara, sabe-se o concelho e mais nada — o ponto é o centro do concelho; cheia com o contorno tracejado, a marca junta os dois casos, e o painel diz qual é qual.'}{' '}
        Mapa de{' '}
        <a
          href="https://openfreemap.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          OpenFreeMap
        </a>
        , com dados dos{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          contribuidores do OpenStreetMap
        </a>
        .
      </p>

      <div id="mapa-escolhido" className="mt-4">
        {marca ? (
          <article className="rounded-lg border border-border bg-surface px-4 py-4">
            {marca.lugares.map((lugar, indice) => (
              <div key={lugar.id} className={indice > 0 ? 'mt-6 border-t border-border pt-5' : ''}>
                <p className="ct-eyebrow">
                  {lugar.precisao === 'exacta' ? lugar.concelhoNome : 'Algures no concelho'}
                </p>
                <h3 className="font-display mt-1 text-xl leading-tight font-semibold">
                  {lugar.precisao === 'exacta' ? lugar.nome : lugar.concelhoNome}
                </h3>

                {lugar.precisao === 'concelho' ? (
                  <p className="mt-1 text-sm text-muted">
                    Estes eventos não dizem em que espaço são — a marca está no centro do concelho.
                  </p>
                ) : (
                  // Direções só para quem tem morada. Mandar alguém para o
                  // centro geométrico de um concelho, com ar de morada, é pior
                  // do que não mandar: chega lá e não está lá nada.
                  <p className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
                    <span className="text-muted">Como chegar:</span>
                    {direcoesPara(lugar.latitude, lugar.longitude, lugar.nome).map((direcao) => (
                      <a
                        key={direcao.nome}
                        href={direcao.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center rounded-full border border-border px-3 underline-offset-4 hover:underline"
                      >
                        {direcao.nome}
                      </a>
                    ))}
                  </p>
                )}

                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {lugar.eventos.map((evento) => (
                    <li key={evento.id}>
                      <EventoDoMapa evento={evento} lugar={lugar} hoje={hoje} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </article>
        ) : (
          <p className="max-w-2xl rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted">
            Carregue numa marca do mapa para ver o que ali acontece, com cartaz e como lá chegar. A
            lista completa, concelho a concelho, está a seguir.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Um evento no painel do mapa: cartaz, título, quando, e para onde ir a seguir.
 *
 * A capa entra porque uma agenda é feita de cartazes — carregar numa marca e
 * receber uma lista de títulos é receber menos do que a mesma agenda dá em
 * qualquer outra página. E a capa nunca falha: quando o cartaz da câmara
 * morre, fica a capa tipográfica que está por baixo.
 */
function EventoDoMapa({
  evento,
  lugar,
  hoje,
}: {
  evento: EventoNoMapa;
  lugar: Lugar;
  hoje: string;
}) {
  return (
    <div className="flex gap-3">
      <Link href={`/evento/${evento.slug}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <Capa event={evento} today={hoje} className="w-20" />
      </Link>

      <div className="min-w-0">
        <Link
          href={`/evento/${evento.slug}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {evento.title}
        </Link>
        <p className="text-sm text-muted">
          {formatEventDates(evento.date_start, evento.date_end, hoje)}
          {/* Numa marca de concelho os eventos são de sítios diferentes, e
              dizer só «Tomar» a sete eventos escondia a única pista que há. */}
          {lugar.precisao === 'concelho' && evento.location_name
            ? ` · ${evento.location_name}`
            : ''}
        </p>
        {evento.source_url ? (
          <a
            href={evento.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4"
          >
            Página oficial
          </a>
        ) : null}
      </div>
    </div>
  );
}
