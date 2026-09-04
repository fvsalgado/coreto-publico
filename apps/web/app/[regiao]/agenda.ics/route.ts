import { eventFilterSchema } from '@coreto/core';
import { SITE_URL } from '@/src/lib/env';
import { toCalendarEntries } from '@/src/lib/feeds/build';
import { calendarResponse } from '@/src/lib/feeds/http';
import { buildCalendar } from '@/src/lib/feeds/ical';
import { loadFeed } from '@/src/lib/feeds/load';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { urlDoSitio } from '@/src/lib/regiao';

/**
 * Subscrição da agenda inteira.
 *
 * Cem eventos e não cinquenta como no RSS: um calendário subscrito é uma coisa
 * que se põe e se esquece, e quem o subscreve quer ver o mês seguinte todo, não
 * a semana. O `Content-Disposition` é `inline` de propósito — quem abre isto no
 * navegador quer que o calendário o apanhe, não um ficheiro na pasta das
 * transferências.
 */

export const revalidate = 3600;

export const CALENDAR_LIMIT = 100;

export async function GET(
  _request: Request,
  context: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await context.params;
  const regiao = await exigirRegiao(regiaoId);
  const { events, context: feedContext } = await loadFeed(
    regiao,
    eventFilterSchema.parse({ limit: CALENDAR_LIMIT }),
  );

  const calendar = buildCalendar(toCalendarEntries(events, feedContext), {
    name: `Coreto — ${regiao.nome}`,
    description: `A agenda cultural dos ${regiao.concelhosPorExtenso} concelhos ${regiao.doNome}.`,
    url: `${urlDoSitio(regiao, SITE_URL)}/agenda`,
  });

  return calendarResponse(calendar, `coreto-${regiao.id}.ics`);
}
