import { eventFilterSchema } from '@coreto/core';
import { SITE_URL } from '@/src/lib/env';
import { toCalendarEntries } from '@/src/lib/feeds/build';
import { calendarResponse, feedNotFound } from '@/src/lib/feeds/http';
import { buildCalendar } from '@/src/lib/feeds/ical';
import { loadFeed, resolveMunicipality } from '@/src/lib/feeds/load';
import { listMunicipalities } from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { urlDoSitio } from '@/src/lib/regiao';

/**
 * Subscrição da agenda de um concelho — `/agenda/tomar.ics`.
 *
 * É o endereço que uma câmara publica no seu sítio para as pessoas porem a
 * programação no telemóvel. Vale mais do que parece: uma subscrição atualiza-se
 * sozinha, e um cartaz não.
 */

export const revalidate = 3600;

const CALENDAR_LIMIT = 100;

export async function generateStaticParams({
  params,
}: {
  params: { regiao: string };
}): Promise<Array<{ municipality: string }>> {
  const municipalities = await listMunicipalities(params.regiao);
  return municipalities.map((municipality) => ({ municipality: `${municipality.id}.ics` }));
}

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
  context: { params: Promise<{ regiao: string; municipality: string }> },
): Promise<Response> {
  const { regiao: regiaoId, municipality: segment } = await context.params;
  const regiao = await exigirRegiao(regiaoId);
  const municipality = await resolveMunicipality(regiao.id, segment, '.ics');
  if (!municipality) return feedNotFound('Não há calendário para este concelho.');

  const { events, context: feedContext } = await loadFeed(
    regiao,
    eventFilterSchema.parse({ municipality: municipality.id, limit: CALENDAR_LIMIT }),
  );

  const calendar = buildCalendar(toCalendarEntries(events, feedContext), {
    name: `Coreto — ${municipality.name}`,
    description: `A agenda cultural de ${municipality.name}.`,
    url: `${urlDoSitio(regiao, SITE_URL)}/concelho/${municipality.id}`,
  });

  return calendarResponse(calendar, `coreto-${municipality.id}.ics`);
}
