import { toCalendarEntries } from '@/src/lib/feeds/build';
import { calendarResponse, feedNotFound } from '@/src/lib/feeds/http';
import { buildCalendar } from '@/src/lib/feeds/ical';
import { loadEventContext } from '@/src/lib/feeds/load';
import { getEvent } from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';

/**
 * «Adicionar ao calendário», para um evento — `/evento/<slug>/agenda.ics`.
 *
 * O endereço tem esta forma e não `/evento/<slug>.ics` porque o App Router não
 * reconhece sufixos num segmento dinâmico: `[slug].ics` seria uma pasta com
 * esse nome literal. O que interessa ao sistema operativo de quem descarrega é
 * a extensão no fim do caminho e o `Content-Type`, e ambos estão certos.
 */

export const revalidate = 3600;

/**
 * Os parâmetros são declarados aqui e não com o `RouteContext` que o Next
 * gera.
 *
 * Esse tipo só existe depois de um `next build` ter escrito `.next/types`, e
 * por isso um `tsc --noEmit` sobre uma cópia acabada de clonar falhava — que
 * é exatamente o que o CI faz, e o que qualquer pessoa faz ao abrir o
 * repositório pela primeira vez. Uma verificação de tipos que depende de um
 * artefacto de compilação não é uma verificação de tipos.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ regiao: string; slug: string }> },
): Promise<Response> {
  const { regiao: regiaoId, slug } = await context.params;
  const regiao = await exigirRegiao(regiaoId);
  const event = await getEvent(regiao.id, slug);
  if (!event) return feedNotFound('Evento não encontrado.');

  const feedContext = await loadEventContext(regiao, event);
  const calendar = buildCalendar(toCalendarEntries([event], feedContext), {
    name: event.title,
    url: `${feedContext.siteUrl}/evento/${event.slug}`,
  });

  return calendarResponse(calendar, `${event.slug}.ics`);
}
