import { buildCalendar, type CalendarEntry } from '@/src/lib/feeds/ical';
import type { Favorito } from '@/src/lib/favoritos';

/**
 * A lista de guardados como um ficheiro de calendário.
 *
 * Mora à parte do `favoritos.ts` por uma razão de peso: o construtor de
 * iCalendar são trezentas linhas que só quem carrega em «Guardar tudo no
 * calendário» precisa de ter, e o coração de cada cartão não as devia
 * arrastar. Assim o `import()` desta página é o único sítio que as pede.
 *
 * **O `UID` não é o mesmo do feed da região, e é de propósito.** O `.ics` da
 * agenda é uma subscrição: o cliente volta a pedi-lo e as entradas mudam com
 * a programação. Este ficheiro é uma fotografia, tirada uma vez e nunca mais
 * atualizada. Dar-lhes a mesma identidade deixava um cliente sobrepor uma
 * entrada viva por uma cópia congelada — uma sessão adiada voltaria à hora
 * antiga sem ninguém perceber porquê. Namespace próprio, e cada um manda no
 * que é seu.
 */
export function entradasDeCalendario(
  guardados: readonly Favorito[],
  origem: string,
): CalendarEntry[] {
  const anfitriao = anfitriaoDe(origem);
  return guardados
    .filter((favorito) => favorito.date_start !== null)
    .map((favorito) => ({
      uid: `${favorito.slug}@favoritos.${anfitriao}`,
      date: favorito.date_start as string,
      endDate: favorito.date_end,
      startTime: favorito.start_time,
      summary: favorito.title,
      location: favorito.location,
      url: `${origem}/evento/${favorito.slug}`,
      lastModified: favorito.guardadoEm,
    }));
}

/**
 * O anfitrião do endereço, sem rebentar num endereço mal formado.
 *
 * O `origem` vem de `window.location`, por isso é bom — mas esta função é
 * pura e testável, e uma função pura que só funciona com boa entrada é uma
 * função que um dia recebe outra.
 */
function anfitriaoDe(origem: string): string {
  try {
    return new URL(origem).host || 'coreto.org';
  } catch {
    return 'coreto.org';
  }
}

export function calendarioDosFavoritos(
  guardados: readonly Favorito[],
  origem: string,
  nomeDoSitio: string,
): string {
  return buildCalendar(entradasDeCalendario(guardados, origem), {
    name: `Guardados — ${nomeDoSitio}`,
    description:
      'Os eventos guardados neste navegador, tal como estavam quando foram guardados. Não se atualiza sozinho.',
    url: origem,
  });
}
