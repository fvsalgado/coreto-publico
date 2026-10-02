'use client';

// O mapa dos coretos: o mesmo mapa de base do mapa dos eventos, os contornos
// dos concelhos, e o levantamento por cima (C1-018, C2-025).
//
// Era um SVG de octógonos projetados num retângulo branco — honesto, e sem
// terra à volta: sem um rio, sem um contorno, sem o nome de uma vila, ninguém
// conseguia dizer qual dos pontos era o da sua terra. A biblioteca, os
// mosaicos e o tema vêm de `MapaDeBase`, partilhados com o mapa dos eventos.
import type { Map as MapaLibre, Marker as MarcaLibre } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { desenhoDoCoretoEmTexto } from '@/src/components/DesenhoDoCoreto';
import {
  ESTILOS_DO_MAPA,
  carregarMapLibre,
  corDoTema,
  useTemaEscuro,
} from '@/src/components/MapaDeBase';
import {
  LOCALE_DO_MAPA,
  ancoraDoCoreto,
  camadaAEsconder,
  contornosDosConcelhos,
  folgaDoEnquadramento,
  juntarCoretosNoEcra,
  limitesDaRegiao,
  limitesDosCoretos,
  nomeDaMarcaDeCoretos,
  type ConcelhoNoMapa,
  type CoretoNoMapa,
} from '@/src/lib/mapa';

import 'maplibre-gl/dist/maplibre-gl.css';

interface Props {
  coretos: CoretoNoMapa[];
  concelhos: ConcelhoNoMapa[];
  /** A altura da caixa, a mesma da espera que ocupa o lugar dela enquanto carrega. */
  altura: string;
}

/** Onde a vista estava, para uma troca de tema não atirar quem lá está de volta ao princípio. */
interface Vista {
  centro: [number, number];
  zoom: number;
}

/**
 * O mapa, com os coretos que têm coordenadas.
 *
 * **Cada coreto é uma ligação para o seu cartão na lista.** O cartão tem o que
 * um balão repetiria — o nome, a freguesia, o ano, a fotografia, a
 * programação quando a há —, e uma ligação ouve-se, abre-se com o teclado e
 * volta-se dela com o botão de recuar. Os que caem perto demais uns dos outros
 * juntam-se num número, que é um botão: aproxima o mapa até eles se
 * separarem.
 *
 * **Cada referência é mexida por um único efeito**, como no mapa dos eventos:
 * duas mãos no mesmo estado imperativo é como se perdem marcas sem ninguém dar
 * por isso.
 */
export function MapaDosCoretosVivo({ coretos, concelhos, altura }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<MapaLibre | null>(null);
  const escuro = useTemaEscuro();

  // O mapa, um por tema — e trocar de tema reconstrói-o, guardando a vista. As
  // razões estão no mapa dos eventos: um `setStyle` deita fora as camadas dos
  // concelhos e obriga a repô-las num evento que pode não voltar.
  const vista = useRef<Vista | null>(null);
  const marcador = useRef<typeof MarcaLibre | null>(null);
  useEffect(() => {
    const alvo = caixa.current;
    if (!alvo || escuro === null) return;

    let vivo = true;
    let instancia: MapaLibre | null = null;

    void carregarMapLibre().then((maplibre) => {
      if (!vivo) return;
      marcador.current = maplibre.Marker;

      // A região pelos contornos dos concelhos; sem eles, pelos próprios
      // coretos. O `maxZoom` é para uma região com um coreto só: uma caixa sem
      // tamanho levava o enquadramento ao nível da rua.
      const limites = limitesDaRegiao(concelhos) ?? limitesDosCoretos(coretos);
      const guardada = vista.current;
      const folga = folgaDoEnquadramento(alvo.clientWidth, alvo.clientHeight);
      const mapa = new maplibre.Map({
        container: alvo,
        style: escuro ? ESTILOS_DO_MAPA.escuro : ESTILOS_DO_MAPA.claro,
        ...(guardada
          ? { center: guardada.centro, zoom: guardada.zoom }
          : limites
            ? { bounds: limites, fitBoundsOptions: { padding: folga, maxZoom: 13 } }
            : { center: [-8.4, 39.5] as [number, number], zoom: 8.5 }),
        // A atribuição é obrigação: os dados são do OpenStreetMap, sob ODbL.
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        locale: { ...LOCALE_DO_MAPA, 'Map.Title': 'Mapa dos coretos' },
      });
      instancia = mapa;

      mapa.touchZoomRotate.disableRotation();
      mapa.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      mapa.on('error', (evento) => {
        console.warn('mapa dos coretos:', evento.error?.message ?? evento);
      });

      const desenhar = () => {
        if (!mapa.isStyleLoaded()) return;
        if (mapa.getSource('concelhos')) return;

        // Fora «Portugal» e os distritos, como no mapa dos eventos (C1-019).
        for (const camada of mapa.getStyle().layers ?? []) {
          if (camadaAEsconder(camada)) mapa.setLayoutProperty(camada.id, 'visibility', 'none');
        }

        // Os concelhos todos com o mesmo traço: aqui não há programação a
        // acender uns e apagar outros — há a região, e onde ela acaba.
        const traco = corDoTema(alvo, '--color-accent', '#14676b');
        mapa.addSource('concelhos', { type: 'geojson', data: contornosDosConcelhos(concelhos) });
        mapa.addLayer({
          id: 'concelhos-fundo',
          type: 'fill',
          source: 'concelhos',
          paint: { 'fill-color': traco, 'fill-opacity': 0.06 },
        });
        mapa.addLayer({
          id: 'concelhos-linha',
          type: 'line',
          source: 'concelhos',
          paint: { 'line-color': traco, 'line-width': 1.5, 'line-opacity': 0.8 },
        });
      };
      mapa.on('styledata', desenhar);
      mapa.on('idle', desenhar);

      setMapa(mapa);
    });

    return () => {
      vivo = false;
      if (!instancia) return;
      vista.current = {
        centro: [instancia.getCenter().lng, instancia.getCenter().lat],
        zoom: instancia.getZoom(),
      };
      instancia.remove();
      setMapa(null);
    };
  }, [escuro, concelhos, coretos]);

  // As marcas, refeitas a cada zoom: é o que faz as junções abrirem-se
  // sozinhas quando se aproxima. O deslocamento não entra — uma translação não
  // muda a distância entre dois pontos no ecrã.
  const marcas = useRef<MarcaLibre[]>([]);
  const composicao = useRef<string>('');
  useEffect(() => {
    const Marca = marcador.current;
    if (!mapa || !Marca) {
      marcas.current = [];
      composicao.current = '';
      return;
    }

    const desenharMarcas = () => {
      const juntas = juntarCoretosNoEcra(coretos, (coreto) => {
        const ponto = mapa.project([coreto.longitude, coreto.latitude]);
        return { x: ponto.x, y: ponto.y };
      });

      const assinatura = juntas.map((marca) => `${marca.id}:${marca.coretos.length}`).join('|');
      if (assinatura === composicao.current) return;
      composicao.current = assinatura;
      for (const antiga of marcas.current) antiga.remove();

      marcas.current = juntas.map((marca) => {
        let elemento: HTMLElement;
        if (marca.coretos.length === 1) {
          const coreto = marca.coretos[0]!;
          const ligacao = document.createElement('a');
          ligacao.href = `#${ancoraDoCoreto(coreto.id)}`;
          ligacao.className = CLASSE_DO_CORETO;
          // O desenho é da casa e não traz texto de ninguém (ver `DesenhoDoCoreto`).
          ligacao.innerHTML = desenhoDoCoretoEmTexto(coreto.confirmado);
          elemento = ligacao;
        } else {
          const botao = document.createElement('button');
          botao.type = 'button';
          botao.className = CLASSE_DA_JUNCAO;
          botao.textContent = String(marca.coretos.length);
          // Aproxima até a junção se desfazer. O `maxZoom` é o travão de dois
          // coretos no mesmo ponto: sem ele o mapa ia ao nível do quarteirão e
          // continuava a não os conseguir separar.
          botao.addEventListener('click', (evento) => {
            evento.stopPropagation();
            const caixaDaJuncao = limitesDosCoretos(marca.coretos);
            if (!caixaDaJuncao) return;
            const alvo = mapa.getContainer();
            mapa.fitBounds(caixaDaJuncao, {
              padding: folgaDoEnquadramento(alvo.clientWidth, alvo.clientHeight) + 24,
              maxZoom: 15,
            });
          });
          elemento = botao;
        }
        // O nome diz o coreto e a dúvida, ou quantos são e onde; o desenho e o
        // número não dizem nada a quem ouve.
        elemento.setAttribute('aria-label', nomeDaMarcaDeCoretos(marca));
        return new Marca({ element: elemento })
          .setLngLat([marca.longitude, marca.latitude])
          .addTo(mapa);
      });
    };

    desenharMarcas();
    mapa.on('zoomend', desenharMarcas);
    return () => {
      mapa.off('zoomend', desenharMarcas);
    };
  }, [mapa, coretos]);

  return (
    <div
      ref={caixa}
      className={`${altura} w-full overflow-hidden rounded-lg border border-border bg-paper`}
    />
  );
}

/**
 * Um coreto: um alvo de 44 px — o mínimo desta casa para o polegar — com o
 * desenho de 24 ao meio. O alvo é transparente, para não tapar o mapa mais do
 * que o desenho tapa; o anel de foco é o da casa.
 */
const CLASSE_DO_CORETO = [
  'grid size-11 cursor-pointer place-items-center rounded-full',
  'hover:z-10 focus-visible:z-10',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
].join(' ');

/**
 * Vários coretos juntos: o número, cheio, com o halo do papel — o desenho das
 * junções do mapa dos eventos, para as duas páginas falarem a mesma língua.
 */
const CLASSE_DA_JUNCAO = [
  'ct-numeral grid size-11 cursor-pointer place-items-center rounded-full text-sm leading-none',
  'border-2 border-surface bg-accent text-on-accent shadow-sm transition-shadow',
  'hover:z-10 hover:shadow-lg focus-visible:z-10',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
].join(' ');
