/**
 * O desenho de um coreto no mapa: a planta octogonal.
 *
 * O confirmado é cheio, com um halo do papel para se ler por cima das ruas; o
 * por confirmar é tracejado — a mesma distinção da lista, onde os duvidosos vêm
 * em cartões tracejados, e pela mesma razão: a dúvida mostra-se em vez de se
 * esconder.
 *
 * Vive à parte do mapa porque é desenhado em dois sítios: nas marcas, que o
 * MapLibre pede como elemento do DOM e não como componente, e na legenda, que
 * é React e está no pacote da página. Importá-lo do mapa punha o MapLibre no
 * pacote de toda a gente — e a legenda tem de desenhar exatamente o que a
 * marca desenha, ou deixa de ser legenda.
 */

/** Os oito vértices de um octógono de lado plano em cima, centrado numa caixa de 24. */
function pontosDoOctogono(raio: number): string {
  const pontos: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const angulo = (Math.PI / 4) * i + Math.PI / 8;
    pontos.push(
      `${(12 + raio * Math.cos(angulo)).toFixed(2)},${(12 + raio * Math.sin(angulo)).toFixed(2)}`,
    );
  }
  return pontos.join(' ');
}

const EXTERIOR = pontosDoOctogono(10);
const INTERIOR = pontosDoOctogono(3.5);
const TRACEJADO = pontosDoOctogono(9);

/** Para a legenda, e para o que mais for React. */
export function DesenhoDoCoreto({
  confirmado,
  className = 'size-6',
}: {
  confirmado: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {confirmado ? (
        <>
          <polygon points={EXTERIOR} className="fill-accent stroke-surface" strokeWidth={2.5} />
          <polygon points={INTERIOR} className="fill-surface" />
        </>
      ) : (
        <polygon
          points={TRACEJADO}
          className="fill-surface stroke-accent"
          strokeWidth={2.2}
          strokeDasharray="3 2.5"
        />
      )}
    </svg>
  );
}

/**
 * Para as marcas do MapLibre, que querem um elemento do DOM. Sem dados de
 * ninguém lá dentro — só números e classes desta casa —, e por isso pode ir por
 * `innerHTML` sem escapar nada.
 */
export function desenhoDoCoretoEmTexto(confirmado: boolean): string {
  return confirmado
    ? `<svg viewBox="0 0 24 24" aria-hidden="true" class="size-6"><polygon points="${EXTERIOR}" class="fill-accent stroke-surface" stroke-width="2.5"/><polygon points="${INTERIOR}" class="fill-surface"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true" class="size-6"><polygon points="${TRACEJADO}" class="fill-surface stroke-accent" stroke-width="2.2" stroke-dasharray="3 2.5"/></svg>`;
}
