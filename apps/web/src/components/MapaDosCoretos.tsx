'use client';

import dynamic from 'next/dynamic';
import { DesenhoDoCoreto } from '@/src/components/DesenhoDoCoreto';
import {
  AtribuicaoDoMapa,
  EsperaDoMapa,
  PerguntaDoMapa,
  useMontarOMapa,
} from '@/src/components/MapaDeBase';
import type { ConcelhoNoMapa, CoretoNoMapa } from '@/src/lib/mapa';

/**
 * Mais baixo do que o mapa dos eventos: aqui a lista é o conteúdo e o mapa é a
 * maneira de a encontrar — no telemóvel, metade do ecrã, e a lista a começar
 * logo a seguir.
 */
const ALTURA = 'h-[50vh] max-h-[480px] min-h-[300px]';

/**
 * O MapLibre não renderiza no servidor e são trezentos quilobytes que só os
 * mapas pedem: carregado à parte, o resto do sítio não os paga. Sem
 * JavaScript, fica a lista — que tem os coretos todos, incluindo os que não
 * têm coordenadas e por isso nunca estiveram no mapa.
 */
const MapaDosCoretosVivo = dynamic(
  () => import('@/src/components/MapaDosCoretosVivo').then((m) => m.MapaDosCoretosVivo),
  { ssr: false, loading: () => <EsperaDoMapa altura={ALTURA} /> },
);

interface Props {
  /** Só os que têm coordenadas. */
  coretos: CoretoNoMapa[];
  concelhos: ConcelhoNoMapa[];
  /** Quantos ficam de fora do mapa por não terem coordenadas — estão na lista. */
  semCoordenadas: number;
  /** «no Médio Tejo» — a contração vem do servidor, que sabe a região. */
  noNomeDaRegiao: string;
  /** O `id` da lista, para quem quiser saltar o mapa. */
  lista: string;
}

export function MapaDosCoretos({
  coretos,
  concelhos,
  semCoordenadas,
  noNomeDaRegiao,
  lista,
}: Props) {
  // Numa ligação lenta pergunta-se antes de montar (C3-012); ver `useMontarOMapa`.
  const { montar, pedir } = useMontarOMapa();
  const haPorConfirmar = coretos.some((coreto) => !coreto.confirmado);

  return (
    <section aria-labelledby="mapa-dos-coretos" className="mt-6">
      <h2 id="mapa-dos-coretos" className="sr-only">
        Mapa dos coretos
      </h2>

      <p className="mb-2 text-sm text-muted">
        Toque num coreto para o ver na lista. Um número junta coretos que, a esta distância, ficam
        uns por cima dos outros: tocar-lhe aproxima o mapa.
      </p>

      {/* Cada coreto é uma paragem do tabulador — vinte e tal, antes de se
          chegar à lista. Quem navega por teclado salta-as daqui. */}
      <a
        href={`#${lista}`}
        className="sr-only rounded bg-accent px-4 text-sm font-medium text-on-accent focus:not-sr-only focus:mb-2 focus:inline-flex focus:min-h-11 focus:items-center"
      >
        Saltar o mapa
      </a>

      {montar === false ? (
        <PerguntaDoMapa
          alternativa="A lista a seguir tem os coretos todos, concelho a concelho."
          onPedir={pedir}
        />
      ) : montar ? (
        <MapaDosCoretosVivo coretos={coretos} concelhos={concelhos} altura={ALTURA} />
      ) : (
        <EsperaDoMapa altura={ALTURA} />
      )}

      <div className="mt-2 text-sm text-muted">
        <p>
          {coretos.length === 1
            ? `1 coreto com localização conhecida ${noNomeDaRegiao}`
            : `${coretos.length} coretos com localização conhecida ${noNomeDaRegiao}`}
          {semCoordenadas > 0
            ? semCoordenadas === 1
              ? '; o que não tem coordenadas está só na lista.'
              : `; os ${semCoordenadas} sem coordenadas estão só na lista.`
            : '.'}
        </p>
        <ul aria-label="Legenda do mapa" className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
          <li className="flex items-center gap-1.5">
            <DesenhoDoCoreto confirmado className="size-5 shrink-0" />
            Confirmado
          </li>
          {haPorConfirmar ? (
            <li className="flex items-center gap-1.5">
              <DesenhoDoCoreto confirmado={false} className="size-5 shrink-0" />
              Por confirmar
            </li>
          ) : null}
          {coretos.length > 1 ? (
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="ct-numeral grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[0.625rem] leading-none text-on-accent"
              >
                3
              </span>
              Vários juntos
            </li>
          ) : null}
        </ul>
        <AtribuicaoDoMapa />
      </div>
    </section>
  );
}
