import Link from 'next/link';
import { AcoesDoCartao } from '@/src/components/AcoesDoCartao';
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
 * Um `article` com o link do título esticado sobre o cartão inteiro: quem usa
 * rato clica em qualquer ponto, e quem navega por ligações ouve a lista de
 * títulos. As duas acções de baixo — guardar no calendário, partilhar — ficam
 * por cima dessa ligação e levam o título no nome acessível, para a lista de
 * ligações não virar «Calendário, Partilhar, Calendário, Partilhar».
 *
 * `data-cartao-de-evento` é o gancho do `check-a11y.mjs`: a auditoria mede a
 * que altura do primeiro ecrã começa o primeiro cartão da agenda, e um
 * atributo com nome não se confunde com classes de estilo.
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
    /*
     * Os cinco eixos, e não só a cadeira de rodas.
     *
     * O cartão passava um campo só e os outros quatro ficavam na ficha: um
     * espetáculo com audiodescrição lia-se como um espetáculo qualquer até
     * alguém o abrir, e numa lista de quarenta ninguém abre quarenta. O tom
     * «apagado» — o «sem acesso» verificado — continua a sair, que é decisão
     * antiga e continua certa: a ausência pertence à ficha, onde se decide.
     */
    ...sinaisDeAcessibilidade(event).filter((sinal) => sinal.tom !== 'apagado'),
  ];

  return (
    /*
     * Duas filas empilhadas, e não uma só.
     *
     * A capa e o texto vão lado a lado, como sempre; as acções passaram a
     * viver **por baixo das duas**, com a largura toda. Encostadas ao texto
     * ficavam com os duzentos e sessenta pixéis que sobram da capa num
     * telemóvel, e três pílulas não cabem em duzentos e sessenta: partiam-se
     * em duas linhas e faziam o cartão crescer quarenta pixéis — o suficiente
     * para o primeiro cartão deixar de caber no primeiro ecrã, que é a medida
     * que o `check-a11y.mjs` passou a segurar.
     */
    <article
      data-cartao-de-evento=""
      className="ct-lift relative flex flex-col rounded-lg border border-border bg-surface p-3 sm:p-4"
    >
      <div className="flex gap-4">
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
                  <Sinal
                    key={sinal.rotulo}
                    icone={sinal.icone}
                    rotulo={sinal.rotulo}
                    tom={sinal.tom}
                  >
                    {sinal.curto}
                  </Sinal>
                ))}
              </Sinais>
            </div>
          ) : null}
        </div>
      </div>

      <AcoesDoCartao
        eventId={event.id}
        slug={event.slug}
        title={event.title}
        paraGuardar={{
          date_start: event.date_start,
          date_end: event.date_end,
          start_time: startTime,
          // O que o cartão mostra, e não o identificador do espaço: é o que
          // faz a lista de guardados ler-se sem pedir nada ao servidor.
          location:
            [where, showMunicipalityLine ? municipalityName : null]
              .filter((parte): parte is string => Boolean(parte))
              .join(' · ') || null,
        }}
      />
    </article>
  );
}
