import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  LISBON_TIME_ZONE,
  formatPrice,
  ressalvaDaCategoria,
  todayInLisbon,
  truncate,
} from '@coreto/core';
import { listSitemapEvents } from '@/src/lib/feeds/data';
import { AnalyticsEventTracker } from '@/src/components/AnalyticsEventTracker';
import { AnalyticsShareButton } from '@/src/components/AnalyticsShareButton';
import { BotaoFavorito } from '@/src/components/BotaoFavorito';
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
      // O arquivo não anuncia calendário: a rota do `.ics` recusa um evento que
      // já aconteceu (0132), e anunciar aqui um endereço que responde 404 era
      // mandar um leitor de metadados a uma porta fechada.
      ...(event.status === 'published'
        ? { types: { 'text/calendar': eventCalendarPath(event.slug) } }
        : {}),
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
   * A ressalva da categoria (0138), e `null` quando não há nenhuma.
   *
   * Uma categoria atribuída pelo tipo do espaço é um palpite — o CIRA é um
   * museu, logo aquilo seria uma exposição — e publicá-la calada é afirmar o
   * que não se sabe. Fica ao lado do que se sabe, que é a doutrina desta casa
   * aplicada a um campo. Quem decidiu foi uma pessoa nunca leva ressalva.
   */
  const ressalva = ressalvaDaCategoria(
    category?.name ?? null,
    event.category_confidence,
    event.category_source,
  );
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
   *
   * O `> 0` é novo e guarda o tecto de largura calculado mais abaixo: uma
   * altura zero — que a base aceita e nenhuma imagem tem — daria uma divisão
   * por zero, e um `max-width` inválido é um `max-width` que o navegador
   * deita fora, ficando o cartaz a ser ampliado até à moldura.
   */
  const medidasDoCartaz =
    event.image_width !== null &&
    event.image_height !== null &&
    event.image_width > 0 &&
    event.image_height > 0
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
  /*
   * Do **estado**, e não da data.
   *
   * A base aceita um arquivado com data futura — há um hoje, o trail de Fátima
   * de outubro — e derivar isto da data fazia a ficha mentir nos dois sentidos:
   * um arquivo a oferecer calendário, ou um evento por acontecer com uma faixa
   * a dizer que já foi. O que decide é o que a recolha escreveu.
   */
  const jaAconteceu = event.status === 'archived';
  const origem = urlDoSitio(regiao, SITE_URL);

  return (
    <article>
      <AnalyticsEventTracker eventId={event.id} />
      <EventStructuredData
        event={event}
        jaAconteceu={jaAconteceu}
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
        {category ? (
          <p className="ct-eyebrow mb-2.5">{ressalva ? ressalva.rotulo : category.name}</p>
        ) : null}
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

        {/*
          O registo diz que é um registo, e diz porquê a data acima não é um
          convite. Fica logo abaixo do título e da data porque é isso que muda
          o sentido das duas linhas de cima — pô-lo no fim da página era deixar
          alguém ler a data e fechar a página a pensar que ainda vai a tempo.
        */}
        {jaAconteceu ? (
          <p className="mt-3 rounded border border-border bg-surface px-3 py-2 text-sm">
            <strong className="font-medium">Já aconteceu.</strong> Esta página é o registo do que
            houve, e não um convite: a data acima é a que a fonte deu. O que está para vir está na{' '}
            <Link href="/agenda" className="underline underline-offset-4">
              agenda
            </Link>
            .
          </p>
        ) : null}

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
              desfocado por baixo dele.

              **E a promessa dos dois parágrafos de cima — «o salto
              desaparece» — foi falsa desde o dia em que foi escrita**
              (947dd9e, 3 de setembro de 2026). As medidas iam declaradas e não
              reservavam nada: o `<img>` era `w-auto` dentro desta grelha
              `place-items-center`, a largura era `fit-content`, e um `<img>`
              sem imagem ainda não ocupa largura nenhuma. Medido em produção
              com o cartaz retido, a 1280 px: caixa reservada **0×0** e a
              moldura com 992×50 — só o `p-6`. Uma proporção não tem a que se
              aplicar quando a largura é zero, e o que saltava era a altura
              inteira do cartaz. Como o `min-h` tinha sido tirado por haver
              medidas, as fichas **com** medidas passaram a saltar mais do que
              as sem: o commit que quis corrigir a métrica piorou-a. Quatro
              fichas de produção, 0,15 a 0,20 na secretária e 0,15 a 0,37 no
              telemóvel. Tirar a reserva de baixo só se podia fazer depois de a
              de cima funcionar mesmo — e não funcionava. A correção está no
              `w-full` e no `maxWidth` do cartaz, aqui em baixo. */}
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
               * lado manda nisso. São a **proporção**: é dela que o navegador
               * tira a altura da caixa a partir da largura disponível, antes
               * de ter um único byte da imagem. Declarar uma e não a outra não
               * serve de nada; ou vão as duas ou não vai nenhuma.
               */
              {...(medidasDoCartaz ?? {})}
              /*
               * O tecto de largura, que é o que faz a proporção valer alguma
               * coisa.
               *
               * Com `w-full` a largura deixa de ser zero e passa a ser a da
               * moldura, que o navegador já sabe antes de pedir a imagem: com
               * a proporção declarada, reserva a altura certa à primeira. A
               * mesma medição de cima, com o cartaz retido, passa de 0×0 a
               * 701×544 — a caixa exacta que o cartaz vai ocupar. Nas quatro
               * fichas, 0,0000 de salto nas duas larguras.
               *
               * O tecto tem dois termos e os dois fazem falta. A largura em
               * píxeis não amplia um cartaz pequeno para além do seu tamanho,
               * que é o que `w-auto` fazia de graça. O termo em `rem` é o
               * mesmo `max-h-[34rem]` da classe, traduzido para largura pela
               * proporção: sem ele, um cartaz largo era esticado — a altura
               * batia no `max-h`, a largura ficava na da moldura, e um
               * 1000×776 saía desenhado a 942×544. Medido, não deduzido: é a
               * diferença entre a correção como estava escrita no plano e a
               * que aqui está.
               *
               * Se algum dia o `max-h` da classe mudar, este 34 muda com ele.
               * Não se lê de lá porque o Tailwind precisa da classe escrita
               * por extenso para a gerar.
               */
              style={
                medidasDoCartaz
                  ? {
                      maxWidth: `min(${medidasDoCartaz.width}px, ${(
                        (34 * medidasDoCartaz.width) /
                        medidasDoCartaz.height
                      ).toFixed(2)}rem)`,
                    }
                  : undefined
              }
              className={`relative z-10 max-h-[34rem] rounded shadow-lg ${
                medidasDoCartaz ? 'w-full' : 'w-auto max-w-full'
              }`}
            />
          </div>
          {/*
              O crédito, e a ligação para a página de onde o cartaz veio.
 
              **Deixou de ser um enfeite no dia em que passámos a guardar uma
              cópia.** Apontar para uma imagem é ligar; guardar uma cópia é
              reproduzir, e uma reprodução de obra gráfica alheia sem dizer de
              quem é e sem caminho de volta à origem é a coisa que a decisão de
              alojar não pode produzir. É a segunda das três cautelas da
              migração 0162, e é a única sem uma coluna nem um botão a
              garanti-la — vive aqui e no momento em que a cópia se faz.
 
              A ligação é ao `image_origem`, que é o endereço do próprio
              ficheiro no servidor de quem o publicou, e não ao `source_url`,
              que é a página do evento: quem vem por aqui quer ver o cartaz
              como ele lá está.
 
              Sem cópia nossa não há crédito escrito e não se desenha nada — o
              cartaz é servido de casa de quem o publicou, e ligar para o sítio
              de onde o browser já o foi buscar não acrescenta nada a ninguém. */}
          {event.image_credit ? (
            <figcaption className="mt-2 text-sm text-muted">
              Cartaz:{' '}
              {event.image_origem ? (
                <a
                  href={event.image_origem}
                  rel="noopener nofollow"
                  className="underline underline-offset-4"
                >
                  {event.image_credit}
                </a>
              ) : (
                event.image_credit
              )}
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
            // Contado desde a 0141. Era o único botão desta fila sem marca, e é
            // o que dá a quem organiza a prova de que a agenda lhe manda gente.
            data-stat-kind="source_click"
            className="inline-flex min-h-11 items-center rounded border border-border bg-surface px-4 text-sm font-medium underline-offset-4 hover:underline"
          >
            Página oficial ↗
          </a>
        ) : null}
        {jaAconteceu ? null : (
          <a
            href={calendarHref}
            data-stat-kind="ical_download"
            className="inline-flex min-h-11 items-center rounded border border-border bg-surface px-4 text-sm font-medium underline-offset-4 hover:underline"
          >
            Adicionar ao calendário
          </a>
        )}
        <BotaoFavorito
          variante="ficha"
          evento={{
            slug: event.slug,
            title: event.title,
            date_start: event.date_start,
            date_end: event.date_end,
            start_time: null,
            location: event.location_name,
          }}
        />
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
                  {ressalva ? ressalva.rotulo : category.name}
                </SinalLink>
              ) : null}
            </Sinais>
          </div>
        ) : null}

        {ressalva ? <p className="mt-3 max-w-2xl text-sm text-muted">{ressalva.porque}</p> : null}

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
