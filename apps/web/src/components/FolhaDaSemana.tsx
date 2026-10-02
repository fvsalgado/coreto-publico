import Link from 'next/link';
import { BandstandMark } from '@/src/components/BandstandMark';
import type { CartazDaSemana, LinhaDoCartaz } from '@/src/lib/cartaz-semanal';
import {
  formatEventDates,
  formatIntervaloPorExtenso,
  formatLongDate,
  formatTime,
  formatWeekdayDate,
  joinPt,
} from '@/src/lib/format';
import { caminhoDoQR, codigoQR } from '@/src/lib/qr';
import { comInicialMaiuscula, deNome, emNome, type Regiao } from '@/src/lib/regiao';

/**
 * A folha A4 da semana de um concelho, para afixar (C2-032, C4-022).
 *
 * O desenho é o do plano (05, medida 14): A4 ao alto, sem toldo nem
 * navegação, os eventos da semana por dia com hora, sítio e preço, o
 * lambrequim como remate e um QR para a agenda do concelho. E **a preto e
 * branco**: é a impressora da junta que a vai tirar, e a cor do toldo, que no
 * ecrã é a marca, em papel é tinteiro gasto e cinzento. As cores aqui são as
 * do papel — preto sobre branco, escritas por extenso e não pelos tokens, que
 * mudam com o tema: a folha é a mesma de dia e de noite, como o papel.
 *
 * No ecrã é a pré-visualização da folha; na impressão é a folha (as regras
 * `@page cartaz` e `.ct-folha` de `globals.css`).
 */

/** O que fica bem afixado: uma coluna até aqui, duas a partir daqui. */
const LINHAS_NUMA_COLUNA = 10;

function Horas({ horas }: { horas: readonly string[] }) {
  if (horas.length === 0) return null;
  const escritas = horas.map((hora) => formatTime(hora)).filter((h): h is string => Boolean(h));
  return <>{joinPt(escritas)}</>;
}

function Linha({
  linha,
  quando,
}: {
  linha: LinhaDoCartaz;
  /** O que vai na coluna da esquerda: as horas, ou as datas de um período. */
  quando: React.ReactNode;
}) {
  const detalhe = [linha.onde, linha.preco].filter((parte): parte is string => Boolean(parte));
  return (
    <li className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-3 py-1.5 break-inside-avoid">
      <span className="font-semibold tabular-nums">{quando}</span>
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <Link
          href={`/evento/${linha.slug}`}
          prefetch={false}
          className="font-semibold underline-offset-4 hover:underline"
        >
          {linha.titulo}
        </Link>
        {detalhe.length > 0 ? (
          <span className="block text-[0.9375rem] leading-snug">{detalhe.join(' · ')}</span>
        ) : null}
      </span>
    </li>
  );
}

/**
 * A saia do telhado, a negro. É a máscara do `.ct-lambrequim` da casa com a
 * cor posta a sair na impressão (`.ct-lambrequim-folha`): um fundo não se
 * imprime por omissão. Esteve desenhada em SVG, e um SVG em bloco a meio da
 * folha fazia o Chromium começar a lista numa folha nova.
 */
function Remate() {
  return <div aria-hidden="true" className="ct-lambrequim ct-lambrequim-folha" />;
}

export function FolhaDaSemana({
  regiao,
  concelho,
  cartaz,
  endereco,
  hoje,
}: {
  regiao: Regiao;
  concelho: { id: string; name: string; article: string | null };
  cartaz: CartazDaSemana;
  /** O endereço da agenda do concelho, por inteiro — é o que o QR leva. */
  endereco: string;
  hoje: string;
}) {
  const qr = codigoQR(endereco);
  const desenho = qr ? caminhoDoQR(qr) : null;
  const enderecoAVista = endereco.replace(/^https?:\/\//, '');
  const duasColunas = cartaz.linhas > LINHAS_NUMA_COLUNA;
  const promotor = regiao.promotor;

  return (
    <article
      aria-labelledby="titulo-da-folha"
      // Quantas linhas a folha leva: o `check-a11y` lê-o para saber se a
      // semana tem de caber numa folha só.
      data-linhas={cartaz.linhas}
      className="ct-folha mx-auto w-full max-w-[210mm] bg-white px-5 py-6 text-black shadow-lg ring-1 ring-black/10 sm:px-[12mm] sm:py-[12mm] print:max-w-none print:p-0 print:shadow-none print:ring-0"
    >
      <header className="border-b-[3px] border-black pb-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="flex items-center gap-2 text-[0.9375rem] font-semibold">
            <BandstandMark className="size-6" />
            <span>
              Coreto · <span className="font-normal">a agenda cultural {regiao.doNome}</span>
            </span>
          </p>
          {promotor ? (
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span>Promovido por</span>
              {promotor.logotipo ? (
                /*
                 * O logótipo a negro, seja qual for a versão: as duas que a
                 * região entrega são a mesma máscara numa tinta só (ver
                 * `LogotipoDoPromotor`), e `brightness(0)` põe-na a preto
                 * sem tocar na transparência. Em papel branco, a versão para
                 * o grafite — a branco — não se via.
                 */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={promotor.logotipo.sobreGrafite}
                  width={promotor.logotipo.largura}
                  height={promotor.logotipo.altura}
                  alt={promotor.nome}
                  decoding="async"
                  className="h-7 w-auto max-w-full min-w-0 object-contain object-left brightness-0"
                />
              ) : (
                <span className="font-semibold">{promotor.nome}</span>
              )}
            </p>
          ) : null}
        </div>
        <h2
          id="titulo-da-folha"
          className="font-display mt-5 text-[2.5rem] leading-[1.05] font-semibold [overflow-wrap:anywhere] sm:text-[3.25rem]"
        >
          {/* Uma expressão só: o SSR separa texto e expressões com um
              comentário, e a frase tem de se ler inteira no HTML. */}
          {`Esta semana ${emNome(concelho.name, concelho.article)}`}
        </h2>
        <p className="mt-2 text-lg">
          {comInicialMaiuscula(formatIntervaloPorExtenso(cartaz.de, cartaz.ate))}
          {cartaz.eventos > 0
            ? ` · ${cartaz.eventos === 1 ? '1 evento' : `${cartaz.eventos} eventos`}`
            : ''}
        </p>
      </header>
      <Remate />

      <div className={`mt-5 ${duasColunas ? 'gap-x-8 sm:columns-2 print:columns-2' : ''}`}>
        {cartaz.linhas === 0 ? (
          <p className="text-lg">
            Esta semana não há nada marcado na agenda {deNome(concelho.name, concelho.article)}. O
            que for entrando aparece no endereço aqui em baixo.
          </p>
        ) : null}

        {cartaz.dias.map((dia) => (
          <section key={dia.dia} aria-labelledby={`folha-${dia.dia}`} className="mb-4">
            <h3
              id={`folha-${dia.dia}`}
              className="font-display border-b border-black pb-0.5 text-xl font-semibold break-after-avoid"
            >
              <time dateTime={dia.dia}>{comInicialMaiuscula(formatWeekdayDate(dia.dia))}</time>
            </h3>
            <ul>
              {dia.linhas.map((linha) => (
                <Linha key={linha.slug} linha={linha} quando={<Horas horas={linha.horas} />} />
              ))}
            </ul>
          </section>
        ))}

        {cartaz.periodos.length > 0 ? (
          <section aria-labelledby="folha-durante" className="mb-4">
            <h3
              id="folha-durante"
              className="font-display border-b border-black pb-0.5 text-xl font-semibold break-after-avoid"
            >
              Durante a semana
            </h3>
            <ul>
              {cartaz.periodos.map((periodo) => (
                <Linha
                  key={periodo.slug}
                  linha={periodo}
                  quando={formatEventDates(periodo.de, periodo.ate, cartaz.de)}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <footer className="mt-6 flex items-center gap-5 border-t-[3px] border-black pt-4 break-inside-avoid">
        {desenho ? (
          <svg
            role="img"
            aria-label={`Código QR para ${enderecoAVista}`}
            viewBox={desenho.viewBox}
            shapeRendering="crispEdges"
            className="size-[30mm] shrink-0"
          >
            <rect width="100%" height="100%" fill="#ffffff" />
            <path d={desenho.d} fill="#000000" />
          </svg>
        ) : null}
        <div className="min-w-0">
          <p className="font-semibold">
            Toda a programação {deNome(concelho.name, concelho.article)}, sempre atualizada:
          </p>
          <p className="font-display mt-0.5 text-xl font-semibold [overflow-wrap:anywhere]">
            {enderecoAVista}
          </p>
          <p className="mt-2 text-sm">
            Os horários podem mudar: confirme na página de cada evento. Dados de{' '}
            {formatLongDate(hoje)}.
          </p>
        </div>
      </footer>
    </article>
  );
}
