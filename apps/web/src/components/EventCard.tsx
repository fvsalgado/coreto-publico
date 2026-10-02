import Link from 'next/link';
import { BotaoFavorito } from '@/src/components/BotaoFavorito';
import { Capa } from '@/src/components/Capa';
import { Sinais, Sinal } from '@/src/components/Sinais';
import { formatCategory, formatDatasDoCartao, formatTime } from '@/src/lib/format';
import type { EventCard as EventCardData } from '@/src/lib/queries/types';
import { sinaisDeAcessibilidade, sinalDePreco } from '@/src/lib/sinais';

interface Props {
  /**
   * A hora entra pelo próprio evento, no `start_time` que `withCardTimes`
   * resolve — a da primeira sessão não cancelada do dia que o cartão anuncia.
   * É opcional porque não é coluna do cartão: quem não a resolveu passa o
   * evento tal como saiu de `listEvents` e o cartão fica como estava.
   */
  event: EventCardData & { start_time?: string | null; dias?: readonly string[] };
  /** O dia de hoje em Lisboa, para saber o que já está a decorrer. */
  today: string;
  /** O primeiro dia da janela da lista — os dias de sessão antes dele já não contam. */
  inicio?: string;
  /**
   * O nível do título: um abaixo do cabeçalho do dia. Na entrada os dias são
   * `h3` e os eventos tinham de ser `h4`; eram `h3` também, e quem navega por
   * cabeçalhos ouvia uma lista plana de dias e eventos misturados (C3-019).
   */
  nivel?: 3 | 4;
  municipalityName?: string;
  venueName?: string;
  /** O cartão traz o concelho quando a lista atravessa concelhos. */
  showMunicipality?: boolean;
  /**
   * O acesso a cadeiras de rodas que o cartão mostra é o do espaço: o evento
   * não declara nada (`eventosComAcessoDoEspaco`). Ver `sinaisDeAcessibilidade`.
   */
  acessoDoEspaco?: boolean;
}

/**
 * Cartão de evento.
 *
 * Um `article` com o link do título esticado sobre o cartão inteiro: quem usa
 * rato clica em qualquer ponto, e quem navega por ligações ouve a lista de
 * títulos.
 *
 * **Um gesto só, no canto: guardar** (C1-002, C3-006). Cada cartão acabava numa
 * fila de três pílulas — «Guardar · Calendário · Partilhar» —, do peso do
 * título e com 36 píxeis de altura: na entrada eram 105 botões abaixo da regra
 * dos 44, e a lista lia-se como uma fila de botões repetida. O calendário e a
 * partilha ficam na ficha, onde já estavam, e o cartão fica com o coração —
 * 44×44, por cima da ligação esticada, com o título no nome acessível. Cada
 * cartão encolhe a altura de uma linha, e cabe mais um evento por ecrã.
 *
 * `data-cartao-de-evento` é o gancho do `check-a11y.mjs`: a auditoria mede a
 * que altura do primeiro ecrã começa o primeiro cartão da agenda, e um
 * atributo com nome não se confunde com classes de estilo.
 */
export function EventCard({
  event,
  today,
  inicio = today,
  nivel = 3,
  municipalityName,
  venueName,
  showMunicipality = true,
  acessoDoEspaco = false,
}: Props) {
  const Titulo = nivel === 4 ? 'h4' : 'h3';
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
  // A hora é a do dia em que o cartão cai — o da próxima sessão (ver
  // `withCardTimes`) —, e o instante declarado à máquina é desse dia.
  const dia =
    (!event.is_ongoing ? event.dias?.find((d) => d >= inicio) : undefined) ?? event.date_start;
  const quando = hora && startTime && dia ? `${dia}T${startTime.slice(0, 5)}` : (dia ?? undefined);

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
    ...sinaisDeAcessibilidade(event, { acessoDoEspaco }).filter((sinal) => sinal.tom !== 'apagado'),
  ];

  return (
    /*
     * Uma fila só: a capa e o texto lado a lado, e o coração no canto.
     *
     * As ações viveram por baixo das duas, com a largura toda, porque três
     * pílulas não cabiam nos duzentos e sessenta píxeis ao lado da capa. Com
     * uma ação só, ela vai para o canto de cima — e o texto deixa-lhe a
     * margem, para o título não passar por baixo dela. `h-full` porque, a
     * partir da secretária, os cartões vão aos pares e a linha alinha pelo
     * mais alto.
     */
    /*
     * E a fila empilha quando a letra cresce (C3-011).
     *
     * Com a letra do navegador a 200 % — o que faz quem sobe o tamanho do
     * texto nas definições do telemóvel, e é sobretudo quem tem mais de
     * sessenta e cinco anos —, a capa crescia com ela e deixava ao título cem
     * píxeis: cada cartão saía do ecrã e obrigava a andar para o lado para o
     * ler (medido a 1 de outubro: a agenda pedia 553 px numa janela de 390).
     *
     * O cartão é um contentor, e a pergunta é feita em `rem`, que acompanha o
     * tamanho da letra: abaixo de 17 rem de cartão, a capa sobe para cima do
     * texto. À letra de sempre isso são 272 px, e nenhum telemóvel chega lá;
     * a 200 % são 544, e todos chegam. O título parte palavras compridas em
     * vez de as deixar sair pela margem.
     */
    <article
      data-cartao-de-evento=""
      className="ct-lift relative @container flex h-full flex-col rounded-lg border border-border bg-surface p-3 sm:p-4"
    >
      <div className="flex gap-4 @max-[17rem]:flex-col @max-[17rem]:gap-3">
        <Capa
          event={event}
          today={today}
          className="ct-sem-impressao w-21 shrink-0 self-start sm:w-27"
        />

        <div className="min-w-0 flex-1 py-0.5 pr-9 print:pr-0">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
            <time dateTime={quando} className="font-medium text-highlight">
              {formatDatasDoCartao(event, today, inicio)}
            </time>
            {category ? (
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className={`ct-octagon size-2 ${category.dot}`} />
                {category.label}
              </span>
            ) : null}
          </p>

          <Titulo className="font-display mt-1 text-lg leading-snug font-semibold [overflow-wrap:anywhere] sm:text-xl">
            {/*
              Sem pré-carregamento (C3-013). O Next pede a página de cada
              ligação que entra no ecrã, e numa lista isso são dezenas de
              pedidos `?_rsc=` a competir com os cartazes numa rede lenta —
              vinte e quatro ao abrir a entrada, medido a 1 de outubro, e mais
              de cinquenta até ao fim dela —, para fichas que quase ninguém
              abre. O pré-carregamento fica nos cinco destinos da barra e na
              navegação do toldo, que são os que se tocam a seguir; o cartão,
              as pílulas e o rodapé pedem a página quando alguém lhes toca.
            */}
            <Link
              href={`/evento/${event.slug}`}
              prefetch={false}
              className="underline-offset-4 hover:underline after:absolute after:inset-0 after:content-['']"
            >
              {event.title}
            </Link>
          </Titulo>

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

      <div className="ct-sem-impressao absolute top-1 right-1 z-10 sm:top-2 sm:right-2">
        <BotaoFavorito
          variante="icone"
          evento={{
            slug: event.slug,
            title: event.title,
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
      </div>
    </article>
  );
}
