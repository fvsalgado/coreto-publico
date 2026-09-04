import Link from 'next/link';
import { Capa } from '@/src/components/Capa';
import { Sinais, Sinal } from '@/src/components/Sinais';
import { formatCategory, formatEventDates } from '@/src/lib/format';
import type { EventCard as EventCardData } from '@/src/lib/queries/types';
import { sinaisDeAcessibilidade, sinalDePreco } from '@/src/lib/sinais';

interface Props {
  event: EventCardData;
  /** O dia de hoje em Lisboa, para saber o que já está a decorrer. */
  today: string;
  municipalityName?: string;
  venueName?: string;
  /** O cartão traz o concelho quando a lista atravessa concelhos. */
  showMunicipality?: boolean;
}

/**
 * Cartão de evento.
 *
 * Um `article` com um único link, o do título, esticado sobre o cartão
 * inteiro: quem navega com leitor de ecrã ouve a lista de títulos, não
 * «link, link, link» — e quem usa rato clica em qualquer ponto.
 */
export function EventCard({
  event,
  today,
  municipalityName,
  venueName,
  showMunicipality = true,
}: Props) {
  const where = venueName ?? event.location_name;
  const category = formatCategory(event.category_slug);
  // «Mação · Mação» não diz mais do que «Mação»: o concelho só entra quando
  // acrescenta alguma coisa ao sítio.
  const showMunicipalityLine =
    showMunicipality && Boolean(municipalityName) && municipalityName !== where;

  // Numa lista, o preço e a acessibilidade são o que decide se se abre o
  // evento — e «Acesso a cadeiras de rodas» ocupava metade da largura do cartão
  // para dizer o que um símbolo diz. Só o positivo: a marca de «sem acesso»
  // pertence à página do evento, onde se decide, e não a quarenta cartões que
  // se percorrem com os olhos.
  const preco = sinalDePreco(event);
  const sinais = [
    ...(preco ? [preco] : []),
    ...sinaisDeAcessibilidade({ wheelchair_accessible: event.wheelchair_accessible }).filter(
      (sinal) => sinal.tom !== 'apagado',
    ),
  ];

  return (
    <article className="ct-lift relative flex gap-4 rounded-lg border border-border bg-surface p-3 sm:p-4">
      <Capa event={event} today={today} className="w-21 shrink-0 self-start sm:w-27" />

      <div className="min-w-0 flex-1 py-0.5">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
          <time dateTime={event.date_start ?? undefined} className="font-medium text-highlight">
            {formatEventDates(event.date_start, event.date_end, today)}
          </time>
          {category ? (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`ct-octagon size-2 ${category.dot}`} />
              {category.label}
            </span>
          ) : null}
        </p>

        <h3 className="font-display mt-1 text-lg leading-snug font-semibold sm:text-xl">
          <Link
            href={`/evento/${event.slug}`}
            className="underline-offset-4 hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {event.title}
          </Link>
        </h3>

        {where || showMunicipalityLine ? (
          <p className="mt-1 text-sm text-muted">
            {[where, showMunicipalityLine ? municipalityName : null]
              .filter((part): part is string => Boolean(part))
              .join(' · ')}
          </p>
        ) : null}

        {sinais.length > 0 ? (
          <div className="mt-2.5">
            <Sinais>
              {sinais.map((sinal) => (
                <Sinal key={sinal.rotulo} icone={sinal.icone} rotulo={sinal.rotulo} tom={sinal.tom}>
                  {sinal.curto}
                </Sinal>
              ))}
            </Sinais>
          </div>
        ) : null}
      </div>
    </article>
  );
}
