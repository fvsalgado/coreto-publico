import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { daysBetween, isoWeekday } from '@coreto/core/dates';
import { CartazIlustrado } from '@/src/lib/cartaz-ilustrado';
import { formatCategory, formatDateRange, formatTime, formatWeekdayDate } from '@/src/lib/format';
import { getEvent, getVenue } from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';

/**
 * O cartaz ilustrado de um evento da demonstração — ver `lib/cartaz-ilustrado`.
 *
 * **Só na demonstração, e é a regra mais importante deste ficheiro.** Numa
 * agenda a sério o cartaz é de quem organiza; desenhar um por cima de um
 * evento real era pôr a casa a falar por ele, com uma imagem que ninguém lhe
 * pediu. Numa região que não seja de demonstração este endereço não existe.
 *
 * A demonstração aponta para aqui (`image_url`, migração 0168), e o resto da
 * casa trata-o como trata qualquer cartaz: fundo dos cartões, ficha, partilha
 * e API. Uma hora de cache, como a agenda — a data escrita no cartaz anda
 * com a renovação noturna da demonstração, e não pode ficar um dia para trás.
 */

export const revalidate = 3600;

/** «Aos sábados», pelo dia ISO (1 é segunda-feira). */
const DIAS_NO_PLURAL: Record<number, string> = {
  1: 'Às segundas',
  2: 'Às terças',
  3: 'Às quartas',
  4: 'Às quintas',
  5: 'Às sextas',
  6: 'Aos sábados',
  7: 'Aos domingos',
};

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string; slug: string }> },
): Promise<Response> {
  const { regiao: regiaoId, slug } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);
  if (regiao.tipo !== 'montra') notFound();
  const evento = await getEvent(regiao.id, slug);
  if (!evento) notFound();
  const espaco = evento.venue_id ? await getVenue(regiao.id, evento.venue_id) : null;

  // O dia e a hora quando é um só; «aos sábados» quando é toda a semana à
  // mesma hora — a visita à torre, a hora do conto —; o intervalo quando é
  // uma exposição ou um curso com datas soltas.
  const sessoes = evento.sessions.filter((sessao) => !sessao.is_cancelled);
  const primeira = sessoes[0];
  const unica = sessoes.length === 1 && !evento.is_ongoing ? primeira : undefined;
  const semanal =
    !evento.is_ongoing &&
    primeira !== undefined &&
    sessoes.length >= 3 &&
    sessoes.every(
      (sessao, i) =>
        i === 0 ||
        (daysBetween(sessoes[i - 1]?.session_date ?? sessao.session_date, sessao.session_date) ===
          7 &&
          sessao.start_time === primeira.start_time),
    );
  const hora = (sessao: { start_time: string | null }) =>
    sessao.start_time ? formatTime(sessao.start_time) : null;
  const quando = unica
    ? [formatWeekdayDate(unica.session_date), hora(unica)].filter(Boolean).join(' · ')
    : semanal && primeira
      ? [DIAS_NO_PLURAL[isoWeekday(primeira.session_date)], hora(primeira)]
          .filter(Boolean)
          .join(' · ')
      : formatDateRange(evento.date_start, evento.date_end);

  return new ImageResponse(
    <CartazIlustrado
      titulo={evento.title}
      categoria={evento.category_slug}
      rotuloDaCategoria={formatCategory(evento.category_slug)?.label ?? null}
      quando={quando || null}
      onde={espaco?.name ?? evento.location_name}
      chave={evento.id}
    />,
    {
      width: 900,
      height: 1200,
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
