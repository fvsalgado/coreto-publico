import type { EventCard } from './queries/types';

/**
 * O que a vitrine dos destaques precisa de saber de um evento, e mais nada.
 *
 * Os destaques são um componente de cliente — o visor de ecrã inteiro corre no
 * navegador —, e tudo o que se lhe passa vai serializado no HTML, ao lado do
 * próprio HTML, para a hidratação. Passava-se-lhe o cartão inteiro: a
 * descrição curta, a origem e a confiança da categoria, os cinco eixos da
 * acessibilidade, o público — dezassete campos de que a vitrine lê onze. Era a
 * maior peça da carga de dados da entrada (C3-013: 486 KB de HTML em produção,
 * metade dos quais essa carga). Fica o que a vitrine, a capa e a data do
 * cartão leem; o resto está na ficha, que é para onde a vitrine leva.
 */
export const CAMPOS_DO_VISOR = [
  'id',
  'slug',
  'title',
  'municipality_id',
  'venue_id',
  'location_name',
  'category_slug',
  'date_start',
  'date_end',
  'is_ongoing',
  'is_free',
  'price_display',
  'image_url',
  'image_alt',
  'image_miniatura',
  'image_width',
  'image_height',
] as const satisfies readonly (keyof EventCard)[];

/** Um destaque já com a hora e os dias das sessões (`withCardTimes`). */
export type EventoDoVisor = Pick<EventCard, (typeof CAMPOS_DO_VISOR)[number]> & {
  start_time?: string | null;
  dias?: readonly string[];
};

/** O cartão reduzido ao que a vitrine lê — ver `CAMPOS_DO_VISOR`. */
export function paraOVisor(
  evento: EventCard & { start_time?: string | null; dias?: readonly string[] },
): EventoDoVisor {
  return {
    id: evento.id,
    slug: evento.slug,
    title: evento.title,
    municipality_id: evento.municipality_id,
    venue_id: evento.venue_id,
    location_name: evento.location_name,
    category_slug: evento.category_slug,
    date_start: evento.date_start,
    date_end: evento.date_end,
    is_ongoing: evento.is_ongoing,
    is_free: evento.is_free,
    price_display: evento.price_display,
    image_url: evento.image_url,
    image_alt: evento.image_alt,
    image_miniatura: evento.image_miniatura,
    image_width: evento.image_width,
    image_height: evento.image_height,
    ...(evento.start_time !== undefined ? { start_time: evento.start_time } : {}),
    ...(evento.dias !== undefined ? { dias: evento.dias } : {}),
  };
}
