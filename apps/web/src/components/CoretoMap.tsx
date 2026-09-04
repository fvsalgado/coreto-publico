import type { Coreto } from '@/src/lib/queries/types';

interface Props {
  coretos: Coreto[];
  municipalityNames: Record<string, string>;
  /** «no Médio Tejo» — a contração vem do servidor, que sabe a região. */
  noNomeDaRegiao: string;
}

const WIDTH = 640;
const HEIGHT = 420;
const PADDING = 32;

/** Abaixo de dois pontos não há mapa nenhum para desenhar — há uma lista. */
const MIN_POINTS = 2;

/** Cerca de dois quilómetros: evita dividir por zero se dois coretos coincidirem. */
const MIN_SPAN_DEGREES = 0.02;

interface Point {
  id: string;
  label: string;
  x: number;
  y: number;
}

/** Um octógono — a planta de um coreto — centrado no ponto. */
function octagon(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI / 4) * i + Math.PI / 8;
    points.push(
      `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`,
    );
  }
  return points.join(' ');
}

/**
 * Projeção linear das coordenadas na caixa envolvente dos coretos.
 *
 * Sem biblioteca de mapas: são pontos numa região de cinquenta quilómetros,
 * não é cartografia. A correção do cosseno da latitude não é preciosismo — a
 * 39,5° N um grau de longitude mede cerca de 77% de um grau de latitude, e
 * sem ela o Médio Tejo sairia esticado no sentido nascente-poente e os
 * coretos deixariam de bater certo com o mapa que as pessoas têm na cabeça.
 */
function project(coretos: Coreto[]): Point[] {
  const located = coretos.filter(
    (coreto): coreto is Coreto & { latitude: number; longitude: number } =>
      coreto.latitude !== null && coreto.longitude !== null,
  );
  if (located.length < MIN_POINTS) return [];

  const latitudes = located.map((coreto) => coreto.latitude);
  const longitudes = located.map((coreto) => coreto.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  const midLatitude = (minLatitude + maxLatitude) / 2;
  const midLongitude = (minLongitude + maxLongitude) / 2;
  const longitudeScale = Math.cos((midLatitude * Math.PI) / 180);

  const spanX = Math.max((maxLongitude - minLongitude) * longitudeScale, MIN_SPAN_DEGREES);
  const spanY = Math.max(maxLatitude - minLatitude, MIN_SPAN_DEGREES);
  const scale = Math.min((WIDTH - 2 * PADDING) / spanX, (HEIGHT - 2 * PADDING) / spanY);

  return located.map((coreto) => ({
    id: coreto.id,
    label: coreto.name,
    x: WIDTH / 2 + (coreto.longitude - midLongitude) * longitudeScale * scale,
    // O norte fica em cima: no ecrã o `y` cresce para baixo, a latitude para cima.
    y: HEIGHT / 2 - (coreto.latitude - midLatitude) * scale,
  }));
}

/**
 * O mapa é o extra; a lista é o conteúdo.
 *
 * Quem não vê o mapa — por usar leitor de ecrã, por o SVG não carregar, por
 * estar num ecrã de telemóvel ao sol — não perde um único coreto: a lista
 * completa está logo a seguir, e é ela que manda.
 */
export function CoretoMap({ coretos, municipalityNames, noNomeDaRegiao }: Props) {
  const points = project(coretos);
  if (points.length === 0) return null;

  const byId = new Map(coretos.map((coreto) => [coreto.id, coreto]));

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby="mapa-titulo mapa-descricao"
        className="h-auto w-full rounded border border-border bg-surface"
      >
        {/* Um só filho de texto, e não `Mapa dos {n} coretos…`: o React 19 trata
            o `title` à parte e um título partido em três nós faz a hidratação
            desta página falhar — a árvore inteira era descartada e voltada a
            desenhar no cliente. */}
        <title id="mapa-titulo">
          {`Mapa dos ${points.length} coretos com localização conhecida ${noNomeDaRegiao}.`}
        </title>
        <desc id="mapa-descricao">
          Cada octógono é um coreto, posicionado pelas suas coordenadas — cheio quando está
          confirmado, tracejado quando está por confirmar. A lista completa, com concelho, freguesia
          e ano de construção, está a seguir ao mapa.
        </desc>

        {points.map((point) => {
          const coreto = byId.get(point.id);
          const municipality = coreto ? municipalityNames[coreto.municipality_id] : undefined;
          const confirmed = coreto?.is_confirmed ?? true;

          return (
            <g key={point.id}>
              <title>
                {[point.label, municipality, confirmed ? null : 'por confirmar']
                  .filter(Boolean)
                  .join(' — ')}
              </title>
              {confirmed ? (
                <>
                  <polygon points={octagon(point.x, point.y, 9)} className="fill-accent-soft" />
                  <polygon points={octagon(point.x, point.y, 5.5)} className="fill-accent" />
                </>
              ) : (
                // Os por confirmar entram a tracejado: no mapa como na lista,
                // a dúvida mostra-se em vez de se esconder.
                <polygon
                  points={octagon(point.x, point.y, 6.5)}
                  className="fill-none stroke-accent"
                  strokeWidth={1.8}
                  strokeDasharray="3 2.5"
                />
              )}
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-2 text-sm text-muted">
        Posições aproximadas, projetadas a partir das coordenadas de cada coreto — os octógonos a
        tracejado estão por confirmar. Não é um mapa de estradas: serve para ver como se distribuem
        pela região.
      </figcaption>
    </figure>
  );
}
