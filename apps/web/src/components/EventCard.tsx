import Link from 'next/link';
import { Capa } from '@/src/components/Capa';
import { Sinais, Sinal } from '@/src/components/Sinais';
import { formatCategory, formatEventDates, formatTime } from '@/src/lib/format';
import type { EventCard as EventCardData } from '@/src/lib/queries/types';
import { sinaisDeAcessibilidade, sinalDePreco } from '@/src/lib/sinais';

interface Props {
  /**
   * A hora entra pelo próprio evento, no `start_time` que `withCardTimes`
   * resolve — a da primeira sessão não cancelada do dia que o cartão anuncia.
   * É opcional porque não é coluna do cartão: quem não a resolveu passa o
   * evento tal como saiu de `listEvents` e o cartão fica como estava.
   */
  event: EventCardData & { start_time?: string | null };
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

  /*
   * A hora ao lado do dia, e não numa linha nova.
   *
   * O cartão já diz a data em três sítios — o numeral da capa, este `time` e
   * o cabeçalho do dia por cima da lista —, e uma quarta linha só para a hora
   * seria a data uma quarta vez. Vai colada ao dia com o mesmo « · » que a
   * secção «Quando» da ficha usa entre a data e a hora de cada sessão, para
   * as duas páginas dizerem a mesma coisa da mesma maneira.
   *
   * E o `dateTime` passa a ser o instante quando há hora: um `<time>` que
   * escreve «7 set · 17h30» e declara à máquina só o dia estava a dizer duas
   * coisas diferentes ao mesmo tempo. É o mesmo formato local que a ficha
   * escreve, sem fuso — o valor é a hora de Lisboa, que é onde isto acontece.
   */
  const startTime = event.start_time ?? null;
  const hora = formatTime(startTime);
  const quando =
    hora && startTime && event.date_start
      ? `${event.date_start}T${startTime.slice(0, 5)}`
      : (event.date_start ?? undefined);

  // Numa lista, o preço e a acessibilidade são o que decide se se abre o
  // evento — e «Acesso a cadeiras de rodas» ocupava metade da largura do cartão
  // para dizer o que um símbolo diz. Só o positivo: a marca de «sem acesso»
  // pertence à página do evento, onde se decide, e não a quarenta cartões que
  // se percorrem com os olhos.
  const preco = sinalDePreco(event);
  const sinais = [
    ...(preco ? [preco] : []),
    // `wheelchair_accessible` passou a vir da coluna resolvida da 0129 (ver
    // `queries/fields.ts`): a mesma resposta que a ficha mostra e que o
    // filtro procura. Até aí o cartão lia a declaração do evento — quase
    // sempre nula — e ficava calado sobre vinte e sete eventos cuja ficha
    // dizia «Acessível».
    ...sinaisDeAcessibilidade({ wheelchair_accessible: event.wheelchair_accessible }).filter(
      (sinal) => sinal.tom !== 'apagado',
    ),
  ];

  return (
    <article className="ct-lift relative flex gap-4 rounded-lg border border-border bg-surface p-3 sm:p-4">
      <Capa event={event} today={today} className="w-21 shrink-0 self-start sm:w-27" />

      <div className="min-w-0 flex-1 py-0.5">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
          <time dateTime={quando} className="font-medium text-highlight">
            {formatEventDates(event.date_start, event.date_end, today)}
            {hora ? ` · ${hora}` : ''}
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
