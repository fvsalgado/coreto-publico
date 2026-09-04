import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LISBON_TIME_ZONE, formatPrice, todayInLisbon, truncate } from '@coreto/core';
import { listSitemapEvents } from '@/src/lib/feeds/data';
import { AnalyticsEventTracker } from '@/src/components/AnalyticsEventTracker';
import { AnalyticsShareButton } from '@/src/components/AnalyticsShareButton';
import {
  EventDetailAccessibility,
  temAcessibilidade,
} from '@/src/components/EventDetailAccessibility';
import { EventDetailSessions } from '@/src/components/EventDetailSessions';
import { HowToArriveSection } from '@/src/components/HowToArriveSection';
import { Migalhas } from '@/src/components/Migalhas';
import { Sinais, Sinal, SinalLink } from '@/src/components/Sinais';
import { EventStructuredData } from '@/src/components/StructuredData';
import { SITE_URL } from '@/src/lib/env';
import { eventCalendarPath } from '@/src/lib/feeds/build';
import {
  formatAudience,
  formatDateRange,
  formatDuration,
  formatEventDates,
  formatLongDate,
} from '@/src/lib/format';
import {
  getEvent,
  getVenue,
  listCategories,
  listMunicipalities,
  listSeries,
} from '@/src/lib/queries/events';
import { sinalDePreco, type Descritor } from '@/src/lib/sinais';
import { migalhasDoEvento } from '@/src/lib/migalhas';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { seccaoLigada } from '@/src/lib/queries/seccoes';
import type { EventDetail } from '@/src/lib/queries/types';
import { urlDoSitio } from '@/src/lib/regiao';

export const revalidate = 3600;

interface Props {
  params: Promise<{ regiao: string; slug: string }>;
}

/**
 * As fichas que já se sabe que existem, produzidas na compilação.
 *
 * O `revalidate` acima estava a dizer «guarda esta página durante uma hora» a
 * um sítio que não guardava nenhuma: sem esta função, cada ficha era
 * renderizada de novo a cada visita, e a cache que o número promete não
 * chegava a existir. As outras rotas de ficha — espaço, concelho, ciclo — já o
 * faziam; esta ficou para trás.
 *
 * A lista é a mesma do mapa do sítio: o que ainda não aconteceu. Um evento que
 * entre entre compilações, ou um que já passou e a que alguém volte por uma
 * ligação velha, continua a abrir — o `dynamicParams` fica ligado, que é como
 * vem de origem. E se a base não responder na compilação, a lista vem vazia e
 * o sítio compila na mesma, a produzir tudo em tempo de execução como fazia
 * ontem.
 */
export async function generateStaticParams({
  params,
}: {
  params: { regiao: string };
}): Promise<Array<{ slug: string }>> {
  const events = await listSitemapEvents(params.regiao, 1000, todayInLisbon());
  return events.map((event) => ({ slug: event.slug }));
}

/**
 * De onde veio a informação.
 *
 * Um agregador só é confiável se disser sempre de onde tirou o que mostra.
 * Quem duvida da hora do concerto tem aqui o caminho para a fonte, e quem
 * organiza vê que o crédito não se perdeu por passar por aqui.
 */
const ORIGIN_LABELS: Record<string, string> = {
  scraper: 'Recolhido do sítio da entidade organizadora',
  email: 'Enviado por email para a agenda',
  form: 'Enviado pelo formulário público',
  manual: 'Introduzido à mão pela equipa',
};

/**
 * A data em Lisboa de um instante guardado em UTC.
 *
 * `en-CA` formata em AAAA-MM-DD, que é a forma que o resto do código já sabe
 * ler. Cortar os dez primeiros carateres do timestamp seria mais curto e
 * daria o dia errado a quem atualizasse a agenda depois da meia-noite no
 * verão.
 */
function lisbonDate(timestamp: string): string | null {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: LISBON_TIME_ZONE }).format(parsed);
}

function priceLabel(event: EventDetail): string | null {
  if (event.is_free) return 'Entrada livre';
  return (
    event.price_display ??
    formatPrice(
      {
        priceMin: event.price_min ?? undefined,
        priceMax: event.price_max ?? undefined,
      },
      event.price_raw,
    )
  );
}

function paragraphsOf(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId, slug } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const event = await getEvent(regiao.id, slug);
  if (!event) return { title: 'Evento não encontrado', robots: { index: false, follow: true } };

  const municipalities = await listMunicipalities(regiao.id);
  const municipality = municipalities.find((item) => item.id === event.municipality_id);
  const where = event.location_name ?? municipality?.name ?? regiao.nome;

  const description =
    event.description_short ??
    truncate(event.description, 160) ??
    `${event.title}, em ${where}. ${formatDateRange(event.date_start, event.date_end)}.`;

  const path = `/evento/${event.slug}`;

  return {
    title: event.title,
    description,
    alternates: {
      canonical: path,
      types: { 'text/calendar': eventCalendarPath(event.slug) },
    },
    openGraph: {
      type: 'article',
      title: event.title,
      description,
      url: path,
      locale: 'pt_PT',
      /*
       * O cartaz de quem organiza quando existe; a capa tipográfica quando
       * não.
       *
       * O ramo de baixo é novo, e fecha um buraco que se via em toda a
       * partilha: um evento sem `image_url` — e são muitos — ia para o
       * WhatsApp com a imagem da região inteira ou com nada. `/cartaz/<slug>`
       * desenha o que a ficha já mostra nesse caso (ver
       * `app/[regiao]/cartaz/`), e o caminho é absoluto de propósito: resolve
       * contra o `metadataBase` desta região, que é o que faz cada domínio
       * apontar para o seu próprio cartão.
       *
       * As medidas vão declaradas porque o Facebook e o LinkedIn decidem o
       * recorte antes de descarregar a imagem; sem elas, mostram-na cortada na
       * primeira partilha e só acertam depois de a lerem.
       */
      images: event.image_url
        ? [{ url: event.image_url, alt: event.image_alt ?? event.title }]
        : [
            {
              url: `/cartaz/${event.slug}`,
              width: 1200,
              height: 630,
              alt: `${event.title} — ${where}`,
            },
          ],
    },
  };
}

export default async function EventPage({ params }: Props) {
  const { regiao: regiaoId, slug } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const event = await getEvent(regiao.id, slug);
  if (!event) notFound();

  const today = todayInLisbon();
  const [municipalities, categories, series, venue] = await Promise.all([
    listMunicipalities(regiao.id),
    listCategories(),
    listSeries(regiao.id),
    event.venue_id ? getVenue(regiao.id, event.venue_id) : Promise.resolve(null),
  ]);

  const municipality = municipalities.find((item) => item.id === event.municipality_id) ?? null;
  const category = categories.find((item) => item.slug === event.category_slug) ?? null;
  /*
   * Com a secção dos ciclos desligada, o nome do ciclo fica — é um facto sobre
   * este evento — e o que sai é a ligação. O que também sai é o `superEvent`
   * dos dados estruturados: é uma promessa a uma máquina de que há uma página
   * de série naquele endereço, e nessa altura não há.
   */
  const haCiclos = await seccaoLigada(regiao.id, 'ciclos');
  const cycle = series.find((item) => item.id === event.series_id) ?? null;

  const audience = formatAudience(event.audience);
  const duration = formatDuration(event.duration_minutes);
  const price = priceLabel(event);

  /*
   * As medidas do cartaz, ou nada — e nunca uma delas sozinha.
   *
   * `width` sem `height` não dá proporção nenhuma ao navegador, e uma
   * proporção pela metade não reserva caixa nenhuma: é o mesmo que não
   * declarar. A base deixa as duas colunas nulas independentemente uma da
   * outra, e é aqui que essa possibilidade se fecha, uma vez, em vez de ficar
   * a ser verificada no meio do JSX.
   */
  const medidasDoCartaz =
    event.image_width !== null && event.image_height !== null
      ? { width: event.image_width, height: event.image_height }
      : null;

  // Preço, duração e público em sinais. `priceLabel` já resolve a entrada
  // livre e as várias formas de preço da fonte; `sinalDePreco` só decide se
  // isso é um destaque ou uma marca a par das outras.
  const detalhes: Descritor[] = [];
  const preco = sinalDePreco({ is_free: event.is_free, price_display: price });
  if (preco) detalhes.push(preco);
  if (duration) {
    detalhes.push({ icone: 'relogio', rotulo: `Duração: ${duration}`, curto: duration });
  }
  if (audience) detalhes.push({ icone: 'publico', rotulo: audience, curto: audience });
  if (event.min_age !== null) {
    detalhes.push({
      icone: 'publico',
      rotulo: `A partir dos ${event.min_age} anos`,
      curto: `M/${event.min_age}`,
    });
  }
  const description = paragraphsOf(event.description);
  const updatedAt = lisbonDate(event.updated_at);
  const originLabel = ORIGIN_LABELS[event.origin] ?? 'Origem por identificar';
  const calendarHref = eventCalendarPath(event.slug);
  const origem = urlDoSitio(regiao, SITE_URL);

  return (
    <article>
      <AnalyticsEventTracker eventId={event.id} />
      <EventStructuredData
        event={event}
        url={`${origem}/evento/${event.slug}`}
        origem={origem}
        municipality={municipality}
        venue={venue}
        cycle={haCiclos ? cycle : null}
        regiao={regiao}
      />

      {/* Esta página não usa o `PageHeader` — tem cabeçalho próprio, com as
          datas e o concelho —, mas as migalhas são as mesmas, e saem da mesma
          lista que os dados estruturados publicam. */}
      <header className="mb-6">
        <Migalhas trilha={migalhasDoEvento(event, municipality)} />
        {category ? <p className="ct-eyebrow mb-2.5">{category.name}</p> : null}
        <h1 className="ct-display-sm max-w-3xl">{event.title}</h1>
        {event.subtitle ? <p className="mt-2 text-lg text-muted">{event.subtitle}</p> : null}

        <p className="mt-3 text-muted">
          <time dateTime={event.date_start ?? undefined} className="font-medium text-highlight">
            {/* «até 27 set» e não «3 jun – 27 set»: numa exposição que já
                abriu, o que resta decidir é se ainda dá tempo de ir. O
                intervalo inteiro continua escrito mais abaixo, em «Em cartaz». */}
            {formatEventDates(event.date_start, event.date_end, today)}
          </time>
          {municipality ? (
            <>
              {' · '}
              <Link href={`/concelho/${municipality.id}`} className="underline underline-offset-4">
                {municipality.name}
              </Link>
            </>
          ) : null}
        </p>

        {cycle ? (
          <p className="mt-2 text-sm text-muted">
            Faz parte de{' '}
            {haCiclos ? (
              <Link
                href={`/ciclo/${cycle.id}`}
                className="font-medium text-ink underline underline-offset-4"
              >
                {cycle.name}
              </Link>
            ) : (
              <span className="font-medium text-ink">{cycle.name}</span>
            )}
            {cycle.is_regional ? `, programação em rede ${regiao.doNome}` : ''}.
          </p>
        ) : null}
      </header>

      {event.image_url ? (
        <figure className="mb-8">
          {/* O cartaz como numa vitrine: inteiro, sem corte, e o fundo é o
              próprio cartaz desfocado — qualquer rácio fica com ar de intenção.

              **Este comentário dizia «não se declara a altura da imagem porque
              ninguém a sabe». Já se sabe.** A recolha lê o cabeçalho de cada
              cartaz e guarda as medidas (migração 0126); declaradas no `<img>`,
              o navegador calcula a caixa exacta antes de a imagem existir e o
              salto desaparece em vez de encolher.

              O `min-h` fica **só para quem não as tem** — um cartaz que chegou
              por submissão, um formato que não se lê, uma noite em que o
              servidor da câmara respondeu 503. Aí volta a ser o que sempre foi:
              reserva-se a vitrine, e o que sobra de salto é a diferença entre o
              reservado e o cartaz, não o cartaz inteiro. Mantê-lo quando as
              medidas existem era reservar duas vezes — a moldura ficava com a
              altura mínima mesmo para um cartaz baixo, com uma tira de fundo
              desfocado por baixo dele. */}
          <div
            className={`relative isolate grid place-items-center overflow-hidden rounded-lg border border-border bg-accent-soft p-4 sm:p-6 ${
              medidasDoCartaz ? '' : 'min-h-72 sm:min-h-[26rem]'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.image_url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl saturate-150 dark:opacity-25 dark:saturate-100"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.image_url}
              alt={event.image_alt ?? `Imagem de divulgação de ${event.title}`}
              /*
               * Este cartaz é o elemento maior acima da dobra — é ele que o
               * navegador mede como LCP, e o LCP é fator de ordenação. Sem
               * prioridade declarada entra na fila com o resto e o browser só
               * o descobre depois de resolver o CSS. `high` diz-lhe que
               * comece já.
               *
               * O irmão desfocado por trás não leva nada: é a mesma origem, o
               * navegador desduplica o pedido, e declarar prioridade nos dois
               * era pedir a mesma coisa duas vezes com pressa a dobrar.
               */
              fetchPriority="high"
              decoding="async"
              /*
               * As medidas, quando se sabem.
               *
               * Não são o tamanho a que o cartaz é desenhado — o CSS aqui ao
               * lado manda nisso, com `max-h` e `w-auto`. São a **proporção**:
               * é dela que o navegador tira a altura da caixa a partir da
               * largura disponível, antes de ter um único byte da imagem.
               * Declarar uma e não a outra não serve de nada; ou vão as duas
               * ou não vai nenhuma.
               */
              {...(medidasDoCartaz ?? {})}
              className="relative z-10 max-h-[34rem] w-auto max-w-full rounded shadow-lg"
            />
          </div>
          {event.image_credit ? (
            <figcaption className="mt-2 text-sm text-muted">
              Imagem: {event.image_credit}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {event.ticketing_url ? (
          <a
            href={event.ticketing_url}
            rel="noopener nofollow"
            data-stat-kind="ticket_click"
            className="inline-flex min-h-11 items-center rounded bg-accent px-5 text-sm font-medium text-on-accent"
          >
            Bilhetes e reservas
          </a>
        ) : null}
        {event.source_url ? (
          // O caminho para a fonte à vista, não só na letra pequena do rodapé:
          // um agregador ganha confiança quando facilita a contraprova.
          <a
            href={event.source_url}
            rel="noopener nofollow"
            className="inline-flex min-h-11 items-center rounded border border-border bg-surface px-4 text-sm font-medium underline-offset-4 hover:underline"
          >
            Página oficial ↗
          </a>
        ) : null}
        <a
          href={calendarHref}
          data-stat-kind="ical_download"
          className="inline-flex min-h-11 items-center rounded border border-border bg-surface px-4 text-sm font-medium underline-offset-4 hover:underline"
        >
          Adicionar ao calendário
        </a>
        <AnalyticsShareButton
          eventId={event.id}
          title={event.title}
          url={`${origem}/evento/${event.slug}`}
        />
      </div>

      {description.length > 0 ? (
        <section aria-labelledby="descricao" className="mt-10">
          <h2 id="descricao" className="ct-heading">
            O que é
          </h2>
          <div className="mt-3 max-w-2xl space-y-3">
            {description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="quando" className="mt-10">
        <h2 id="quando" className="ct-heading">
          Quando
        </h2>

        {/* Um período não é uma lista de sessões, e escrevê-lo como tal é
            mentir por omissão.

            Uma exposição patente de 3 de junho a 27 de setembro chega aqui com
            duas sessões — o dia em que abre e o dia em que fecha, que são os
            dois únicos factos que a fonte afirmou. Listá-las dava «2 sessões»,
            o 3 de junho e o 27 de setembro, e mais nada: quem lesse ficava a
            saber que nos quatro meses do meio não havia nada para ver. E o
            cartão ao lado, esse, dizia «3 jun – 27 set», porque `date_start` e
            `date_end` saem dos mesmos extremos e ficam certos — a mesma página
            a contradizer-se em duas linhas.

            Por isso o `is_ongoing` decide primeiro: quando a fonte diz que
            aquilo está patente de X a Y, é isso que se escreve, com o
            intervalo inteiro. A lista de sessões fica para o que é mesmo uma
            lista de compromissos. */}
        {event.is_ongoing && event.date_start ? (
          <p className="mt-2 text-muted">
            Em cartaz: {formatDateRange(event.date_start, event.date_end)}.
          </p>
        ) : event.sessions.length > 0 ? (
          <>
            <p className="mt-2 text-sm text-muted">
              {event.sessions.length === 1 ? 'Uma sessão.' : `${event.sessions.length} sessões.`}
            </p>
            <EventDetailSessions
              sessions={event.sessions}
              today={today}
              isOngoing={event.is_ongoing}
            />
          </>
        ) : (
          <p className="mt-2 text-muted">Sem horário publicado.</p>
        )}
      </section>

      <section aria-labelledby="onde" className="mt-10">
        <h2 id="onde" className="ct-heading">
          Onde
        </h2>
        <p className="mt-3">
          {venue ? (
            <Link href={`/espaco/${venue.id}`} className="font-medium underline underline-offset-4">
              {venue.name}
            </Link>
          ) : (
            <span className="font-medium">{event.location_name ?? 'Local por confirmar'}</span>
          )}
        </p>
        {event.parish ? <p className="text-muted">{event.parish}</p> : null}
      </section>

      <section aria-labelledby="como-chegar" className="mt-10">
        <h2 id="como-chegar" className="ct-heading">
          Como chegar
        </h2>
        <HowToArriveSection
          text={event.how_to_arrive ?? venue?.how_to_arrive ?? null}
          placeName={venue?.name ?? event.location_name}
          address={event.location_address ?? venue?.address ?? null}
          parish={event.parish ?? venue?.parish ?? null}
          municipalityName={municipality?.name ?? null}
          latitude={event.latitude ?? venue?.latitude ?? null}
          longitude={event.longitude ?? venue?.longitude ?? null}
        />
      </section>

      {temAcessibilidade(
        event,
        venue?.wheelchair_accessible ?? null,
        venue?.accessibility_notes ?? null,
      ) ? (
        <section aria-labelledby="acessibilidade" className="mt-10">
          <h2 id="acessibilidade" className="ct-heading">
            Acessibilidade
          </h2>
          <EventDetailAccessibility
            event={event}
            venueWheelchairAccessible={venue?.wheelchair_accessible ?? null}
            venueAccessibilityNotes={venue?.accessibility_notes ?? null}
          />
        </section>
      ) : null}

      {/*
        «Detalhes» era uma lista de definições com cinco pares — e dois deles,
        a categoria e o concelho, já estavam nas migalhas e na linha por baixo
        do título. Fica o que é mesmo do evento, em sinais: preço, duração,
        para quem, e as etiquetas.
      */}
      <section aria-labelledby="detalhes" className="mt-10">
        <h2 id="detalhes" className="ct-heading">
          Detalhes
        </h2>
        {detalhes.length > 0 ? (
          <div className="mt-3">
            <Sinais>
              {detalhes.map((sinal) => (
                <Sinal key={sinal.rotulo} icone={sinal.icone} rotulo={sinal.rotulo} tom={sinal.tom}>
                  {sinal.curto}
                </Sinal>
              ))}
              {category ? (
                <SinalLink href={`/agenda?category=${category.slug}`} icone="etiqueta">
                  {category.name}
                </SinalLink>
              ) : null}
            </Sinais>
          </div>
        ) : null}

        {event.tags.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2 text-xs">
            {event.tags.map((tag) => (
              <li key={tag} className="rounded border border-border px-2 py-0.5 text-muted">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <footer className="mt-12 border-t border-border pt-4 text-sm text-muted">
        <h2 className="font-semibold text-ink">De onde vem esta informação</h2>
        {/*
          Numa linha. A proveniência é uma garantia e continua toda cá — de
          onde veio, quando foi vista, o caminho para a fonte e a porta para
          quem quiser corrigir. Três parágrafos a dizê-lo não diziam mais.
        */}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{originLabel}</span>
          {updatedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={updatedAt}>{formatLongDate(updatedAt)}</time>
            </>
          ) : null}
          {event.source_url ? (
            <>
              <span aria-hidden="true">·</span>
              <a
                href={event.source_url}
                rel="noopener nofollow"
                className="underline underline-offset-4"
              >
                Ver na fonte
              </a>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <Link href="/submeter" className="underline underline-offset-4">
            Corrigir
          </Link>
        </p>
      </footer>
    </article>
  );
}
