import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { CORES_DO_TOLDO } from '@/src/lib/marca';
import { MARCA_GRELHA, MARCA_TRACOS } from '@/src/lib/marca';
import { formatDateRange } from '@/src/lib/format';
import { getEvent, listMunicipalities } from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';

/**
 * O cartão de partilha de um evento que não tem cartaz.
 *
 * O sítio tinha uma imagem de partilha e uma só: `public/og/medio-tejo.png`, a
 * da região. Um evento sem `image_url` — e são muitos, porque nem toda a fonte
 * publica cartaz — chegava ao WhatsApp e ao Facebook com a imagem da região
 * inteira, igual à de todos os outros, ou com nada. A partilha é como metade
 * das pessoas descobre um evento nesta agenda; era o sítio a desistir dela.
 *
 * O que se desenha é a **capa tipográfica que a ficha já mostra** quando não
 * há cartaz (ver `components/Capa.tsx`): o título grande, a data, o sítio, e a
 * marca em filigrana. Não é um cartaz inventado — é o que a página diz, na
 * proporção que as redes recortam.
 *
 * **Porque é uma rota e não `opengraph-image.tsx`.** A convenção do Next cunha
 * o endereço a partir do caminho do segmento, e o caminho aqui é o *interno*,
 * com o `[regiao]` lá dentro: saía um `og:image` a apontar para
 * `…/medio-tejo/evento/x/opengraph-image`, endereço que não existe do lado de
 * fora — o mesmo defeito que o comentário do `og:url` no layout da região
 * descreve. Assim o endereço público é `/cartaz/<slug>`, o middleware
 * encaminha-o como encaminha tudo o resto, e a ficha declara-o por extenso.
 */

export const revalidate = 86400;

/** O que as redes recortam: 1200×630, a proporção que toda a gente usa. */
const LARGURA = 1200;
const ALTURA = 630;

/** Quanto do título cabe antes de a imagem passar a ser um bloco de texto. */
const LIMITE_DO_TITULO = 90;

function encurtar(texto: string, limite: number): string {
  if (texto.length <= limite) return texto;
  const corte = texto.slice(0, limite);
  const espaco = corte.lastIndexOf(' ');
  return `${(espaco > limite * 0.6 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}

/**
 * O corpo do título encolhe com o comprimento.
 *
 * Três degraus e não um cálculo contínuo: o objetivo é que um título curto
 * encha o cartão e um título longo continue a caber, e a diferença entre 64 e
 * 66 pixéis não é visível a ninguém.
 */
function corpoDoTitulo(titulo: string): number {
  if (titulo.length <= 28) return 92;
  if (titulo.length <= 55) return 72;
  return 56;
}

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string; slug: string }> },
): Promise<Response> {
  const { regiao: regiaoId, slug } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);
  const evento = await getEvent(regiao.id, slug);
  if (!evento) notFound();

  const concelhos = await listMunicipalities(regiao.id);
  const concelho = concelhos.find((item) => item.id === evento.municipality_id);

  const titulo = encurtar(evento.title, LIMITE_DO_TITULO);
  /*
   * O cartaz de um evento que já aconteceu tem de dizer que já aconteceu — e
   * tem de dizer o ano.
   *
   * Isto não é um pormenor de canto: das 33 fichas que a 0132 abriu, **23 não
   * têm cartaz do organizador**, e para essas é este desenho que serve de
   * `og:image` da ficha. Sem a marca, partilhar o registo de um espetáculo de
   * abril produzia um cartão indistinguível de um convite.
   *
   * O ano entra à mão porque o `formatDateRange` nunca o escreve quando as
   * duas datas caem no mesmo ano, e não recebe a data de hoje para o decidir —
   * a ficha resolve isso com o `comAnoQuandoPreciso`, que aqui não existe.
   * «18 abr – 24 mai» num cartão partilhado em setembro não diz nada a ninguém.
   */
  const jaAconteceu = evento.status !== 'published';
  const ano = (evento.date_start ?? '').slice(0, 4);
  const quando = jaAconteceu
    ? `${formatDateRange(evento.date_start, evento.date_end)} ${ano}`.trim()
    : formatDateRange(evento.date_start, evento.date_end);
  const onde = evento.location_name ?? concelho?.name ?? regiao.nome;
  const toldo = CORES_DO_TOLDO[regiao.tipo];

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#16181c',
        color: '#f5f3ee',
        padding: '64px 72px',
        position: 'relative',
      }}
    >
      {/*
          O coreto em filigrana, com o mesmo traço da marca do sítio
          (`lib/marca.ts`), para o cartão não ser um retângulo com letras. Fica
          atrás de tudo e muito apagado: é textura, não é assunto.
        */}
      <svg
        width={620}
        height={620}
        viewBox={`0 0 ${MARCA_GRELHA} ${MARCA_GRELHA}`}
        fill="none"
        stroke={toldo}
        strokeWidth={0.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ position: 'absolute', right: -110, bottom: -140, opacity: 0.16 }}
      >
        {MARCA_TRACOS.map((traco) => (
          <path key={traco} d={traco} />
        ))}
      </svg>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 6, backgroundColor: toldo, display: 'flex' }} />
        <div
          style={{
            fontSize: 24,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#b8b3a8',
            display: 'flex',
          }}
        >
          Coreto · {regiao.nome}
          {jaAconteceu ? ' · Já aconteceu' : ''}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 900 }}>
        <div
          style={{
            fontSize: corpoDoTitulo(titulo),
            lineHeight: 1.08,
            fontWeight: 700,
            letterSpacing: -1,
            display: 'flex',
          }}
        >
          {titulo}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {quando ? (
            <div style={{ fontSize: 34, color: toldo, display: 'flex' }}>{quando}</div>
          ) : null}
          <div style={{ fontSize: 30, color: '#b8b3a8', display: 'flex' }}>{onde}</div>
        </div>
      </div>
    </div>,
    {
      width: LARGURA,
      height: ALTURA,
      headers: {
        // Um cartão de partilha muda quando o evento muda, e isso é raro. O
        // dia de cache é o que impede o Facebook e o WhatsApp de o voltarem a
        // desenhar a cada partilha.
        'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
