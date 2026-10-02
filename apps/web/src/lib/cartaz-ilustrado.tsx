import { MARCA_TRACOS } from './marca';

/**
 * Os cartazes da demonstração, desenhados por código (C1-025, C4-007).
 *
 * A demonstração não tinha uma única imagem: trinta eventos, trinta capas
 * tipográficas iguais, e quem a recebia para «mexer à vontade» via o caso-
 * limite do produto — uma agenda sem cartazes — em vez do caso normal. A
 * decisão do dono foi desenhá-los nós, e não ir buscar imagens a ninguém: a
 * demonstração existe para mostrar o produto sem usar nada de terceiros, e um
 * cartaz copiado de um sítio real seria exatamente isso.
 *
 * Cada cartaz é um desenho geométrico da categoria — o coreto e as notas na
 * música, a cortina no teatro, a fita no cinema, as bandeirinhas na festa —,
 * na cor da família da categoria (as mesmas do `globals.css`), com o título,
 * o dia e o sítio por baixo, como um cartaz de vila. A variação entre dois
 * cartazes da mesma categoria sai do identificador do evento, para o mesmo
 * evento ter sempre o mesmo cartaz e dois concertos não serem o mesmo
 * desenho.
 *
 * Desenha-se em JSX para o `ImageResponse` (Satori), que é o que a casa já
 * usa no cartão de partilha: só caixas flexíveis e SVG, sem imagem nenhuma.
 */

/** As famílias de cor das categorias — os mesmos valores de `globals.css`. */
const FAMILIAS: Record<string, string> = {
  musica: '#5b3a9e',
  teatro: '#a3324a',
  danca: '#a3324a',
  cinema: '#22506b',
  exposicoes: '#8a5a0b',
  patrimonio: '#8a5a0b',
  literatura: '#2f5f8f',
  formacao: '#2f5f8f',
  'festas-populares': '#b0430f',
  'feiras-mercados': '#b0430f',
  comunidade: '#b0430f',
  'desporto-natureza': '#3a6b2a',
  infantil: '#9c2f78',
  outros: '#5c6570',
};

const PAPEL = '#f5f3ee';
const TINTA = '#16181c';
const SOL = '#f2c14e';

/** Um número de 0 a 1 que só depende do texto — a variação de cada cartaz. */
export function semente(texto: string, sal = 0): number {
  let h = 2166136261 ^ sal;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

type Motivo = (s: number) => React.ReactNode;

/** Traços em papel, com a espessura e a opacidade de quem desenha a giz. */
const giz = (largura = 10, opacidade = 0.9) => ({
  fill: 'none',
  stroke: PAPEL,
  strokeWidth: largura,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  opacity: opacidade,
});

const MOTIVOS: Record<string, Motivo> = {
  // O coreto, grande, com as notas a sair dele.
  musica: (s) => (
    <g>
      <circle cx={680 - s * 120} cy={170} r={110} fill={SOL} opacity={0.85} />
      <g transform="translate(150 140) scale(19)">
        {MARCA_TRACOS.map((traco) => (
          <path key={traco} d={traco} {...giz(0.55)} />
        ))}
      </g>
      {[0, 1, 2].map((i) => (
        <g
          key={i}
          transform={`translate(${610 + i * 70} ${330 + ((i + Math.round(s * 3)) % 3) * 50})`}
        >
          <ellipse cx={0} cy={60} rx={24} ry={18} fill={PAPEL} />
          <path d="M22 60V-30" {...giz(8)} />
        </g>
      ))}
    </g>
  ),
  // O palco: a cortina aberta dos dois lados, o foco, e alguém lá em cima.
  teatro: (s) => (
    <g>
      <path d="M330 80L200 640H700L570 80Z" fill={PAPEL} opacity={0.16} />
      <ellipse cx={450} cy={610} rx={240} ry={48} fill={SOL} opacity={0.9} />
      <circle cx={450 + (s - 0.5) * 90} cy={380} r={42} fill={PAPEL} />
      <path
        d={`M${450 + (s - 0.5) * 90} 430L${380 + (s - 0.5) * 90} 600H${520 + (s - 0.5) * 90}Z`}
        fill={PAPEL}
      />
      <path d="M0 0H300C265 220 225 470 290 700H0Z" fill={TINTA} opacity={0.5} />
      <path d="M900 0H600C635 220 675 470 610 700H900Z" fill={TINTA} opacity={0.5} />
      {[70, 150, 225].map((x) => (
        <path key={x} d={`M${x} 90C${x - 25} 320 ${x + 25} 500 ${x - 10} 700`} {...giz(6, 0.3)} />
      ))}
      {[830, 750, 675].map((x) => (
        <path key={x} d={`M${x} 90C${x + 25} 320 ${x - 25} 500 ${x + 10} 700`} {...giz(6, 0.3)} />
      ))}
      <path
        d="M0 0H900V90C760 135 600 100 450 135C300 100 140 135 0 90Z"
        fill={TINTA}
        opacity={0.6}
      />
    </g>
  ),
  // Três corpos em roda, desenhados em arcos.
  danca: (s) => (
    <g>
      {[0, 1, 2].map((i) => {
        const x = 230 + i * 220;
        const y = 270 + Math.sin(s * 6 + i) * 40;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={40} fill={PAPEL} />
            <path
              d={`M${x} ${y + 50}C${x - 80} ${y + 180} ${x + 80} ${y + 260} ${x} ${y + 360}`}
              {...giz(16)}
            />
            <path
              d={`M${x - 90} ${y + 120}C${x - 30} ${y + 70} ${x + 30} ${y + 170} ${x + 90} ${y + 110}`}
              {...giz(12, 0.7)}
            />
          </g>
        );
      })}
      <path d="M80 640C300 560 600 720 820 620" {...giz(8, 0.6)} />
    </g>
  ),
  // A fita, de viés, e o feixe do projetor.
  cinema: (s) => (
    <g>
      <path d={`M0 120L900 ${60 + s * 80}L900 ${360 + s * 80}L0 520Z`} fill={SOL} opacity={0.25} />
      <g transform={`rotate(${-12 + s * 8} 450 350)`}>
        <rect x={-60} y={250} width={1020} height={210} fill={TINTA} opacity={0.85} />
        {Array.from({ length: 14 }, (_, i) => (
          <g key={i}>
            <rect x={-40 + i * 76} y={268} width={40} height={26} rx={6} fill={PAPEL} />
            <rect x={-40 + i * 76} y={416} width={40} height={26} rx={6} fill={PAPEL} />
          </g>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={40 + i * 230}
            y={310}
            width={190}
            height={90}
            fill={PAPEL}
            opacity={0.85}
          />
        ))}
      </g>
    </g>
  ),
  // Molduras numa parede, e o banco à frente.
  exposicoes: (s) => (
    <g>
      {[
        [110, 120, 260, 330],
        [420, 90 + s * 40, 200, 200],
        [420, 330 + s * 40, 200, 150],
        [670, 150, 140, 270],
      ].map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} fill="none" stroke={PAPEL} strokeWidth={14} />
          <rect
            x={(x ?? 0) + 30}
            y={(y ?? 0) + 30}
            width={(w ?? 0) - 60}
            height={(h ?? 0) - 60}
            fill={i === 1 ? SOL : PAPEL}
            opacity={i === 1 ? 0.8 : 0.35}
          />
        </g>
      ))}
      <path d="M200 620H700M260 620V680M640 620V680" {...giz(12)} />
    </g>
  ),
  // A torre do relógio, com as horas a dar.
  patrimonio: (s) => (
    <g>
      <path d="M330 700V250H570V700" fill={PAPEL} opacity={0.9} />
      <path d="M300 250L450 90L600 250Z" fill={PAPEL} />
      <circle cx={450} cy={360} r={80} fill={SOL} />
      <path
        d={`M450 360L450 ${300 + s * 20}M450 360L${500 - s * 30} 390`}
        stroke={TINTA}
        strokeWidth={10}
        strokeLinecap="round"
      />
      <path d="M410 700V560C410 520 490 520 490 560V700" fill={TINTA} opacity={0.6} />
      <path d="M90 700V520H250V700M650 700V560H810V700" fill={PAPEL} opacity={0.45} />
    </g>
  ),
  // O livro aberto, com as linhas por ler.
  literatura: (s) => (
    <g>
      <circle cx={700} cy={150} r={90} fill={SOL} opacity={0.6 + s * 0.3} />
      <path d="M450 220C350 170 220 170 110 210V600C220 560 350 560 450 610Z" fill={PAPEL} />
      <path
        d="M450 220C550 170 680 170 790 210V600C680 560 550 560 450 610Z"
        fill={PAPEL}
        opacity={0.85}
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <path
            d={`M170 ${290 + i * 55}C250 ${270 + i * 55} 340 ${275 + i * 55} 400 ${300 + i * 55}`}
            stroke={TINTA}
            strokeWidth={6}
            opacity={0.35}
            fill="none"
          />
          <path
            d={`M500 ${300 + i * 55}C560 ${275 + i * 55} 650 ${270 + i * 55} 730 ${290 + i * 55}`}
            stroke={TINTA}
            strokeWidth={6}
            opacity={0.35}
            fill="none"
          />
        </g>
      ))}
    </g>
  ),
  // A charamela: um tubo comprido, os furos e a campânula.
  formacao: (s) => (
    <g>
      <g transform={`rotate(${-35 + s * 10} 450 350)`}>
        <path d="M90 330H660L820 250V450L660 370H90Z" fill={PAPEL} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} cx={200 + i * 75} cy={350} r={13} fill={TINTA} opacity={0.7} />
        ))}
        <path d="M40 350H90" {...giz(18)} />
      </g>
      <circle cx={170} cy={590} r={60} fill={SOL} opacity={0.8} />
    </g>
  ),
  // As bandeirinhas de arraial, em duas cordas.
  'festas-populares': (s) => (
    <g>
      {[0, 1].map((corda) => {
        const y = 140 + corda * 230 + s * 30;
        return (
          <g key={corda}>
            <path d={`M-20 ${y}Q450 ${y + 160} 920 ${y}`} {...giz(5, 0.8)} />
            {Array.from({ length: 9 }, (_, i) => {
              const x = 30 + i * 100;
              const t = x / 900;
              const yy = y + 4 * 80 * t * (1 - t);
              return (
                <path
                  key={i}
                  d={`M${x - 34} ${yy}L${x + 34} ${yy}L${x} ${yy + 80}Z`}
                  fill={i % 2 === corda ? SOL : PAPEL}
                  opacity={0.95}
                />
              );
            })}
          </g>
        );
      })}
      <path d="M140 650L760 650" {...giz(8, 0.5)} />
    </g>
  ),
  // O toldo às riscas da banca, e as caixas por baixo.
  'feiras-mercados': (s) => (
    <g>
      <path d="M90 180H810V260H90Z" fill={PAPEL} />
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${90 + i * 80} 180h40v80h-40Z`} fill={SOL} opacity={0.9} />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} d={`M${90 + i * 80} 260a40 40 0 0 0 80 0`} fill={i % 2 ? SOL : PAPEL} />
      ))}
      <path d="M120 300V640M780 300V640" {...giz(12)} />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={190 + i * 180}
          y={500 - (i === 1 ? 60 * s : 0)}
          width={150}
          height={140}
          fill={PAPEL}
          opacity={0.5 + i * 0.15}
        />
      ))}
    </g>
  ),
  // A mesa comprida, com os pratos postos.
  comunidade: (s) => (
    <g>
      <path d="M60 420H840V470H60Z" fill={PAPEL} />
      <path d="M120 470V640M780 470V640" {...giz(14)} />
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i}>
          <ellipse cx={140 + i * 125} cy={405} rx={44} ry={14} fill={SOL} opacity={0.9} />
          <circle
            cx={140 + i * 125}
            cy={300 - ((i + Math.round(s * 5)) % 2) * 25}
            r={38}
            fill={PAPEL}
            opacity={0.8}
          />
        </g>
      ))}
      <path d="M440 330V260H470V330" {...giz(10)} />
    </g>
  ),
  // Os montes, o caminho entre eles e o sol.
  'desporto-natureza': (s) => (
    <g>
      <circle cx={620 + s * 120} cy={180} r={90} fill={SOL} />
      <path d="M-20 600L250 260L470 600Z" fill={PAPEL} opacity={0.6} />
      <path d="M300 640L600 230L920 640Z" fill={PAPEL} opacity={0.9} />
      <path
        d="M120 700C300 620 280 560 450 540S640 480 700 420"
        stroke={TINTA}
        strokeWidth={14}
        fill="none"
        strokeDasharray="30 26"
        opacity={0.6}
      />
    </g>
  ),
  // Os balões, e o tambor que não queria tocar.
  infantil: (s) => (
    <g>
      {[
        [220, 190, SOL],
        [360, 140, PAPEL],
        [500, 210, SOL],
      ].map(([x, y, cor], i) => (
        <g key={i}>
          <ellipse
            cx={x as number}
            cy={(y as number) + s * 30}
            rx={70}
            ry={86}
            fill={cor as string}
          />
          <path
            d={`M${x} ${(y as number) + 86 + s * 30}C${(x as number) - 30} ${(y as number) + 200} ${(x as number) + 30} ${(y as number) + 260} ${x} 430`}
            {...giz(4, 0.8)}
          />
        </g>
      ))}
      <ellipse cx={650} cy={470} rx={150} ry={46} fill={PAPEL} />
      <path d="M500 470V610C500 650 800 650 800 610V470" fill={PAPEL} opacity={0.8} />
      <path d="M520 500L780 600M780 500L520 600" stroke={TINTA} strokeWidth={6} opacity={0.4} />
    </g>
  ),
  // O octógono da casa, repetido — para o que não cabe em nenhuma.
  outros: (s) => (
    <g>
      {Array.from({ length: 12 }, (_, i) => {
        const x = 120 + (i % 4) * 220;
        const y = 120 + Math.floor(i / 4) * 210;
        const r = 70 + ((i + Math.round(s * 7)) % 3) * 10;
        const pontos = Array.from({ length: 8 }, (_, k) => {
          const a = (Math.PI / 4) * k + Math.PI / 8;
          return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
        }).join(' ');
        return <polygon key={i} points={pontos} fill={i % 3 === 0 ? SOL : PAPEL} opacity={0.75} />;
      })}
    </g>
  ),
};

export interface DadosDoCartaz {
  titulo: string;
  categoria: string | null;
  rotuloDaCategoria: string | null;
  quando: string | null;
  onde: string | null;
  /** O identificador do evento: a variação do desenho sai dele. */
  chave: string;
}

/** Quanto corpo tem o título: um curto enche o cartaz, um longo cabe. */
function corpo(titulo: string): number {
  if (titulo.length <= 22) return 74;
  if (titulo.length <= 44) return 60;
  return 48;
}

/** O cartaz inteiro, a 900 × 1200 — a proporção 3:4 das molduras da agenda. */
export function CartazIlustrado({
  titulo,
  categoria,
  rotuloDaCategoria,
  quando,
  onde,
  chave,
}: DadosDoCartaz) {
  const fundo = FAMILIAS[categoria ?? ''] ?? FAMILIAS.outros;
  const desenhar = MOTIVOS[categoria ?? ''] ?? MOTIVOS.outros;
  const s = semente(chave);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: fundo,
      }}
    >
      <div style={{ display: 'flex', width: 900, height: 700 }}>
        <svg width={900} height={700} viewBox="0 0 900 700">
          {desenhar?.(s)}
        </svg>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexGrow: 1,
          margin: '0 36px 36px',
          padding: '36px 44px',
          backgroundColor: PAPEL,
          color: TINTA,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {rotuloDaCategoria ? (
            <div
              style={{
                display: 'flex',
                fontSize: 26,
                letterSpacing: 2,
                color: fundo,
                fontWeight: 700,
              }}
            >
              {rotuloDaCategoria.toUpperCase()}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              fontSize: corpo(titulo),
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: -1,
            }}
          >
            {titulo}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quando ? (
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: fundo }}>
              {quando}
            </div>
          ) : null}
          {onde ? (
            <div style={{ display: 'flex', fontSize: 28, color: '#4b545c' }}>{onde}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
