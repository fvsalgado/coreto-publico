'use client';

// A biblioteca, os mosaicos e o tema vêm de `MapaDeBase`, que os partilha com o
// mapa dos coretos — e é lá que está escrito porque é que o MapLibre se carrega
// por `import()` e o processador é servido por nós.
//
// `Map` e `Marker` vêm renomeados porque `Map` é o da linguagem; aqui são só
// tipos, que não sobrevivem à compilação e não pesam nada.
import type { Map as MapaLibre, Marker as MarcaLibre } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import {
  ALTURA_DO_MAPA,
  ESTILOS_DO_MAPA,
  carregarMapLibre,
  corDoTema,
  useTemaEscuro,
} from '@/src/components/MapaDeBase';
import {
  LOCALE_DO_MAPA,
  comAtribuicaoEmPortugues,
  agruparNoEcra,
  camadaAEsconder,
  contornosDosConcelhos,
  folgaDoEnquadramento,
  limitesDaRegiao,
  nomeDaMarca,
  rotuloDaMarca,
  type ConcelhoNoMapa,
  type Lugar,
  type Marca,
} from '@/src/lib/mapa';

import 'maplibre-gl/dist/maplibre-gl.css';

interface Props {
  lugares: Lugar[];
  concelhos: ConcelhoNoMapa[];
  eventosPorConcelho: Record<string, number>;
  escolhida: string | null;
  /** Estável (é um `setState`): entra nas dependências do efeito das marcas. */
  onEscolher: (marca: Marca) => void;
}

/** Onde a vista estava, para uma reconstrução não atirar quem lá está de volta ao princípio. */
interface Vista {
  centro: [number, number];
  zoom: number;
}

/**
 * O mapa de ruas do OpenFreeMap, com os onze concelhos por cima.
 *
 * O mapa anterior era honesto e ninguém o reconhecia: onze polígonos num
 * retângulo, sem uma rua, sem um rio, sem o nome de uma vila. Quem chega a uma
 * agenda quer ver o mapa que já tem na cabeça — e só depois ver onde é que a
 * programação cai nele.
 *
 * **Os mosaicos vêm do OpenFreeMap** (`tiles.openfreemap.org`), que serve
 * dados do OpenStreetMap sem chave, sem conta e sem limite de utilização. É a
 * primeira coisa nesta casa que faz o navegador de quem visita pedir algo a um
 * terceiro, e está dito por extenso na página de informações — uma mudança
 * destas contada só no código é uma mudança escondida.
 *
 * **Os contornos continuam a ser nossos.** Vêm da base, na coluna
 * `municipalities.boundary` (chegam aqui dentro de `concelhos`), e
 * desenham-se por cima do mapa de base: sem eles, quem chega vê ruas de
 * Portugal e não sabe onde acaba a região que esta agenda cobre.
 *
 * **Cada referência é mexida por um único efeito**, e é uma regra e não um
 * acaso: o compilador do React recusa-se a deixar um efeito alterar o que
 * outro já usou, e tem razão — duas mãos no mesmo estado imperativo é como se
 * perdem marcas e camadas sem ninguém dar por isso.
 */
export function MapaVivo({ lugares, concelhos, eventosPorConcelho, escolhida, onEscolher }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<MapaLibre | null>(null);
  const escuro = useTemaEscuro();

  // O mapa, um por tema.
  //
  // Trocar de tema reconstrói o mapa em vez de lhe trocar o estilo. Um
  // `setStyle` é mais barato, mas deita fora a fonte e as camadas dos
  // concelhos e obriga a repô-las num evento que pode não voltar — foi assim
  // que os contornos desapareceram do mapa desenhado, sem um erro que o
  // dissesse. Reconstruir é uma linha, acontece só quando alguém carrega no
  // botão do tema, e a vista de quem lá está é guardada e reposta.
  const vista = useRef<Vista | null>(null);
  // O construtor das marcas, para o efeito de baixo: vem do mesmo carregamento,
  // e guardá-lo evita um segundo `await` num efeito que corre a cada zoom. Fica
  // preenchido antes de `setMapa`, e o efeito das marcas só corre com o mapa.
  const marcador = useRef<typeof MarcaLibre | null>(null);
  useEffect(() => {
    const alvo = caixa.current;
    if (!alvo || escuro === null) return;

    // O efeito é síncrono e o carregamento da biblioteca não é. A limpeza tem
    // de saber desfazer os dois estados possíveis: «ainda não chegou» — e
    // então não se cria mapa nenhum quando chegar — e «já cá está», que é o
    // caso de sempre. Sem esta bandeira, trocar de tema duas vezes depressa
    // deixava para trás um mapa que ninguém mais destruía.
    let vivo = true;
    let instancia: MapaLibre | null = null;

    void carregarMapLibre().then((maplibre) => {
      if (!vivo) return;
      marcador.current = maplibre.Marker;

      const limites = limitesDaRegiao(concelhos);
      const guardada = vista.current;
      // A folga cresce com a caixa: 24 px fixos deixavam os agregados colados
      // às bordas num telemóvel. Ver `folgaDoEnquadramento`.
      const folga = folgaDoEnquadramento(alvo.clientWidth, alvo.clientHeight);
      const mapa = new maplibre.Map({
        container: alvo,
        ...(guardada
          ? { center: guardada.centro, zoom: guardada.zoom }
          : limites
            ? { bounds: limites, fitBoundsOptions: { padding: folga } }
            : { center: [-8.4, 39.5] as [number, number], zoom: 8.5 }),
        // A atribuição é obrigação e não enfeite: os dados são do OpenStreetMap,
        // sob ODbL, e quem os usa diz de onde vieram.
        attributionControl: { compact: true },
        // Sem rotação: um mapa regional torto não ajuda ninguém a orientar-se, e
        // rodá-lo por engano com dois dedos é a maneira mais rápida de o deixar
        // ilegível num telemóvel.
        dragRotate: false,
        pitchWithRotate: false,
        // Os controlos em português — ver `LOCALE_DO_MAPA`. O título é o nome
        // da região que o leitor de ecrã anuncia: era «Map».
        locale: { ...LOCALE_DO_MAPA, 'Map.Title': 'Mapa dos eventos' },
      });
      instancia = mapa;
      // O estilo entra por `setStyle` e não pelo construtor, porque é o
      // `setStyle` que aceita `transformStyle`: a atribuição dos mosaicos
      // passa a português sem perder o crédito — ver `comAtribuicaoEmPortugues`.
      mapa.setStyle(escuro ? ESTILOS_DO_MAPA.escuro : ESTILOS_DO_MAPA.claro, {
        transformStyle: (_anterior, seguinte) => comAtribuicaoEmPortugues(seguinte),
      });

      mapa.touchZoomRotate.disableRotation();
      mapa.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      // Sem `GeolocateControl`: o cabeçalho `Permissions-Policy` desta casa nega
      // a geolocalização ao sítio inteiro, e o botão ficava a pedir uma coisa que
      // o navegador já decidiu recusar.

      // O MapLibre não deixa um erro chegar à consola por si: emite-o como evento
      // e cala-se. Um mapa que não carrega os mosaicos ficava um retângulo vazio
      // sem uma linha que dissesse porquê.
      mapa.on('error', (evento) => {
        console.warn('mapa:', evento.error?.message ?? evento);
      });

      const desenhar = () => {
        if (!mapa.isStyleLoaded()) return;
        if (mapa.getSource('concelhos')) return;

        // Fora as etiquetas de país e de distrito: num mapa da região, a
        // palavra maior era «Portugal», em negrito, no meio do território
        // (C1-019). Ver `camadaAEsconder`.
        for (const camada of mapa.getStyle().layers ?? []) {
          if (camadaAEsconder(camada)) mapa.setLayoutProperty(camada.id, 'visibility', 'none');
        }

        const acesa = corDoTema(alvo, '--color-accent', '#14676b');
        const apagada = corDoTema(alvo, '--color-muted', '#4b545c');

        mapa.addSource('concelhos', {
          type: 'geojson',
          data: contornosDosConcelhos(concelhos, eventosPorConcelho),
        });
        mapa.addLayer({
          id: 'concelhos-fundo',
          type: 'fill',
          source: 'concelhos',
          paint: {
            // Um concelho com programação acende; um sem nada marcado desenha-se
            // na mesma, ao de leve. Ver `contornosDosConcelhos`.
            'fill-color': ['case', ['>', ['get', 'eventos'], 0], acesa, apagada],
            'fill-opacity': ['case', ['>', ['get', 'eventos'], 0], 0.14, 0.06],
          },
        });
        mapa.addLayer({
          id: 'concelhos-linha',
          type: 'line',
          source: 'concelhos',
          paint: {
            'line-color': ['case', ['>', ['get', 'eventos'], 0], acesa, apagada],
            'line-width': 2,
            'line-opacity': 0.9,
          },
        });
      };

      // `styledata` chega várias vezes e a última chega com o estilo ainda por
      // acabar; `idle` é o sinal de que o mapa assentou mesmo. Os dois, porque
      // nenhum deles sozinho chegou.
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
  }, [escuro, concelhos, eventosPorConcelho]);

  // As marcas e a que está aberta — um efeito só, porque mexem no mesmo sítio.
  //
  // A junção é em pixéis do ecrã e não em graus: dois espaços a duzentos metros
  // um do outro coincidem num mapa da região e separam-se quando se aproxima.
  // Refazer a conta a cada zoom é o que faz as marcas abrirem-se sozinhas em
  // vez de ficarem uma por cima da outra para sempre.
  //
  // O deslocamento não entra: uma translação não muda a distância entre dois
  // pontos no ecrã, e refazer as marcas a meio de um arrasto trocava o botão
  // debaixo do cursor entre o `pointerdown` e o `mouseup` — o clique
  // desaparecia.
  const marcas = useRef<globalThis.Map<string, MarcaLibre>>(new globalThis.Map());
  const composicao = useRef<string>('');
  useEffect(() => {
    const Marca = marcador.current;
    if (!mapa || !Marca) {
      marcas.current.clear();
      composicao.current = '';
      return;
    }

    const desenharMarcas = () => {
      const agrupadas = agruparNoEcra(lugares, (lugar) => {
        const ponto = mapa.project([lugar.longitude, lugar.latitude]);
        return { x: ponto.x, y: ponto.y };
      });

      const assinatura = agrupadas.map((marca) => `${marca.id}:${marca.lugares.length}`).join('|');
      if (assinatura !== composicao.current) {
        composicao.current = assinatura;
        for (const antiga of marcas.current.values()) antiga.remove();
        marcas.current.clear();

        for (const agrupada of agrupadas) {
          // O que o MapLibre posiciona é um suporte, e não o botão: o botão é
          // o círculo com o número, e a etiqueta do concelho fica-lhe ao lado,
          // dentro do suporte. Estava dentro do botão, e o texto visível dele
          // passava a ser «7Tomar» — o número e a etiqueta colados —, que nenhum
          // nome acessível contém: a auditoria (WCAG 2.5.3) reprovava todas as
          // marcas do `/mapa`. A etiqueta é do mapa, como o nome da sede que ela
          // repõe, e já não recebia toques (`pointer-events-none`).
          const suporte = document.createElement('div');
          suporte.className = CLASSE_DO_SUPORTE;
          const elemento = document.createElement('button');
          elemento.type = 'button';
          elemento.className = CLASSE_DA_MARCA;
          elemento.dataset['precisao'] = agrupada.precisao;
          elemento.dataset['marca'] = agrupada.id;
          elemento.textContent = String(agrupada.eventos);
          // O concelho por baixo do número (C1-019): as marcas assentam onde o
          // mapa de base escreve o nome da sede, e tapavam-no. Escondida de
          // quem ouve: o nome acessível do botão já diz o sítio e o concelho, e
          // dizê-lo duas vezes é ruído. O desenho está em `CLASSE_DO_ROTULO`.
          const rotulo = document.createElement('span');
          rotulo.className = CLASSE_DO_ROTULO;
          rotulo.textContent = rotuloDaMarca(agrupada);
          rotulo.setAttribute('aria-hidden', 'true');
          suporte.append(elemento, rotulo);
          // O nome acessível diz o sítio e quantos eventos são: a marca desenha
          // só o número, e um botão que anuncia «7» não diz nada a quem ouve.
          // E contém o que se vê — o número e o concelho da etiqueta —, para o
          // comando de voz a encontrar (`nomeDaMarca`).
          elemento.setAttribute('aria-label', nomeDaMarca(agrupada));
          // O painel de baixo é o que este botão abre, e dizê-lo é o que
          // permite a quem usa leitor de ecrã saltar da marca para o que ela
          // mostra.
          elemento.setAttribute('aria-controls', 'mapa-escolhido');
          elemento.addEventListener('click', (evento) => {
            evento.stopPropagation();
            onEscolher(agrupada);
          });

          marcas.current.set(
            agrupada.id,
            new Marca({ element: suporte })
              .setLngLat([agrupada.longitude, agrupada.latitude])
              .addTo(mapa),
          );
        }
      }

      // A pintura da escolhida, sempre — as marcas podem ter acabado de nascer.
      // O botão é o primeiro filho do suporte.
      for (const [id, marca] of marcas.current) {
        const elemento = marca.getElement().firstElementChild;
        if (!(elemento instanceof HTMLElement)) continue;
        elemento.setAttribute('aria-pressed', String(id === escolhida));
        elemento.dataset['escolhida'] = String(id === escolhida);
      }
    };

    desenharMarcas();
    mapa.on('zoomend', desenharMarcas);
    return () => {
      mapa.off('zoomend', desenharMarcas);
    };
  }, [mapa, lugares, escolhida, onEscolher]);

  return (
    <div
      ref={caixa}
      className={`${ALTURA_DO_MAPA} w-full overflow-hidden rounded-lg border border-border bg-paper`}
    />
  );
}

/**
 * A marca, escrita em classes porque o MapLibre pede um elemento do DOM e não
 * um componente de React.
 *
 * O alvo tem 44 px — o mínimo que esta casa aceita para o polegar — e o desenho
 * distingue os três graus de certeza: cheia quando se sabe a morada, tracejada
 * e clara quando só se sabe o concelho, cheia com contorno tracejado quando a
 * marca junta os dois casos. É a mesma distinção do mapa anterior, e existe
 * pela mesma razão: um ponto no mapa é uma promessa de morada.
 */
const CLASSE_DA_MARCA = [
  'ct-numeral grid size-11 cursor-pointer place-items-center rounded-full text-xs leading-none',
  // O realce do rato é uma sombra, e não um `scale`.
  //
  // Isto foi medido: com `hover:scale-110`, passar o rato por cima da marca
  // punha a tela do mapa por baixo do cursor — `elementFromPoint` devolvia o
  // `canvas` — e o `pointerdown` deixava de chegar ao botão. A marca ficava
  // impossível de carregar com o rato, e só com o rato: ao dedo e ao teclado
  // funcionava. Foi a auditoria de acessibilidade que o apanhou. O `z-10` que
  // traz à frente a marca em uso está no suporte (`CLASSE_DO_SUPORTE`).
  'border-2 shadow-sm transition-shadow hover:shadow-lg',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  'data-[precisao=exacta]:border-accent data-[precisao=exacta]:bg-accent data-[precisao=exacta]:text-on-accent',
  'data-[precisao=concelho]:border-dashed data-[precisao=concelho]:border-accent data-[precisao=concelho]:bg-surface data-[precisao=concelho]:text-accent',
  // A marca mista junta sítios com morada e sítios sem ela, e tem de dizer as
  // duas coisas: cheia como a exacta, tracejada como a do concelho. Sem esta
  // linha ficava sem desenho nenhum — um círculo branco que não é nada —, e num
  // telemóvel, onde quase tudo se junta, era o mapa inteiro.
  'data-[precisao=mista]:border-dashed data-[precisao=mista]:border-on-accent data-[precisao=mista]:bg-accent data-[precisao=mista]:text-on-accent',
  'data-[escolhida=true]:ring-2 data-[escolhida=true]:ring-highlight data-[escolhida=true]:ring-offset-2',
].join(' ');

/**
 * O suporte que o MapLibre posiciona: o botão e a etiqueta lá dentro.
 *
 * Do tamanho do círculo, porque o MapLibre centra no ponto a caixa do elemento
 * que recebe — a etiqueta, `absolute`, não lhe mexe no tamanho. O `z-10` no
 * rato e no foco vive aqui e não no botão: cada marca do MapLibre é um
 * contexto de empilhamento, e o botão lá dentro não passava à frente das
 * vizinhas. A marca que está a ser usada vem à frente, com a etiqueta.
 */
const CLASSE_DO_SUPORTE = 'size-11 hover:z-10 focus-within:z-10';

/**
 * A etiqueta do concelho, por baixo da marca: letra pequena e escura com um
 * halo do papel à volta (`.ct-rotulo-da-marca`, no `globals.css`), para se ler
 * por cima das ruas sem precisar de caixa.
 *
 * `absolute` a partir do suporte, que o MapLibre já posiciona — fica fora da
 * caixa de 44 px, e o círculo continua centrado no ponto. E sem eventos de
 * ponteiro: uma etiqueta é mais larga do que a marca, e por cima de uma
 * vizinha roubava-lhe o toque.
 */
const CLASSE_DO_ROTULO = [
  'ct-rotulo-da-marca pointer-events-none absolute top-full left-1/2 mt-0.5 -translate-x-1/2',
  'font-sans text-xs leading-tight font-semibold whitespace-nowrap text-ink',
].join(' ');
