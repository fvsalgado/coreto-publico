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
import { Capa } from '@/src/components/Capa';
import { CartazDaFicha } from '@/src/components/CartazDaFicha';
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
import { formatAudience, formatDateRange, formatDuration, formatLongDate } from '@/src/lib/format';
import {
  eventosComAcessoDoEspaco,
  getEvent,
  getVenue,
  listCategories,
  listMunicipalities,
  listSeries,
} from '@/src/lib/queries/events';
import { type Descritor } from '@/src/lib/sinais';
import {
  diaPorExtenso,
  diaUnicoPorVir,
  estadoDaFicha,
  localSoATerra,
  novaDataDoAdiado,
  partilhaDoEvento,
  pedidoDeCorrecao,
  precoDaFicha,
  quandoCurto,
  quandoDaFicha,
} from '@/src/lib/ficha';
import { migalhasDoEvento } from '@/src/lib/migalhas';
import { exigirRegiao, planeadorDaRegiao } from '@/src/lib/queries/regioes';
import { seccaoLigada } from '@/src/lib/queries/seccoes';
import type { EventDetail } from '@/src/lib/queries/types';
import { emNome, urlDoSitio } from '@/src/lib/regiao';

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
  // `form` é o envio por programa (`POST /api/submissions`) e, antes dele, o
  // formulário público que saiu. «Pelo formulário público» descrevia uma porta
  // que já não existe; isto é verdade para as duas.
  form: 'Enviado diretamente para a agenda',
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

  const [municipalities, venue] = await Promise.all([
    listMunicipalities(regiao.id),
    event.venue_id ? getVenue(regiao.id, event.venue_id) : Promise.resolve(null),
  ]);
  const municipality = municipalities.find((item) => item.id === event.municipality_id);
  const where = event.location_name ?? municipality?.name ?? regiao.nome;

  const description =
    event.description_short ??
    truncate(event.description, 160) ??
    `${event.title}, em ${where}. ${formatDateRange(event.date_start, event.date_end)}.`;

  const path = `/evento/${event.slug}`;

  /*
   * A partilha diz quando e onde (C3-014). Um evento com cartaz ia para o
   * WhatsApp com o título e a sinopse, e num grupo da terra é «domingo, 21h,
   * Cine-Teatro Paraíso» que decide o clique. A imagem continua a ser o
   * cartaz; o texto ao lado é que passa a responder. O estado vai no título
   * quando o muda — uma ligação partilhada de um concerto cancelado tem de o
   * dizer antes de alguém a abrir.
   */
  const hoje = todayInLisbon();
  const estado = estadoDaFicha(event, hoje);
  const nomeDoSitio = venue?.name ?? event.location_name ?? null;
  const partilha = partilhaDoEvento({
    titulo: event.title,
    quando:
      estado === 'cancelado'
        ? 'cancelado'
        : estado === 'adiado'
          ? 'adiado'
          : quandoCurto(event, hoje),
    onde: [
      nomeDoSitio,
      municipality && municipality.name !== nomeDoSitio ? municipality.name : null,
    ]
      .filter((parte): parte is string => Boolean(parte))
      .join(', '),
    preco: event.is_free ? 'Entrada livre' : priceLabel(event),
    resumo: description,
  });

  return {
    title: event.title,
    description,
    alternates: {
      canonical: path,
      // O que já não se apanha não anuncia calendário: a rota do `.ics` recusa
      // o que já aconteceu, o cancelado e o adiado (`estadoDaFicha`), e
      // anunciar aqui um endereço que responde 404 era mandar um leitor de
      // metadados a uma porta fechada.
      ...(estado === 'por-acontecer'
        ? { types: { 'text/calendar': eventCalendarPath(event.slug) } }
        : {}),
    },
    openGraph: {
      type: 'article',
      title: partilha.titulo,
      description: partilha.descricao,
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
  const [municipalities, categories, series, venue, acessoDoEspaco, planeador] = await Promise.all([
    listMunicipalities(regiao.id),
    listCategories(),
    listSeries(regiao.id),
    event.venue_id ? getVenue(regiao.id, event.venue_id) : Promise.resolve(null),
    // Se o acesso a cadeiras de rodas que a ficha mostra é o do espaço (C2-011).
    eventosComAcessoDoEspaco([event]),
    // O planeador de transportes que a região declarou, ou nada (0164).
    planeadorDaRegiao(regiao.id),
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

  // Duração e público em sinais. O preço saiu daqui para o bloco do primeiro
  // ecrã, onde a pergunta «quanto custa» se faz — e onde a falta dele também
  // se diz (C2-014).
  const detalhes: Descritor[] = [];
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
  // Na demonstração, a origem é a verdade dela (C4-007): «introduzido à mão
  // pela equipa» lia-se como um evento a sério que alguém escreveu.
  const originLabel =
    regiao.tipo === 'montra'
      ? 'Inventado para a demonstração: nem o evento nem o sítio existem'
      : (ORIGIN_LABELS[event.origin] ?? 'Origem por identificar');
  const calendarHref = eventCalendarPath(event.slug);
  /*
   * Do **estado primeiro, e da data quando o estado não decidiu**.
   *
   * Esta linha dizia «do estado, e não da data»: a base aceita um arquivado
   * com data futura — há um, o trail de Fátima de outubro —, e derivar da data
   * fazia a ficha mentir nos dois sentidos. Continua a não derivar quando há
   * estado: o arquivado é registo, o cancelado e o adiado são o que uma pessoa
   * decidiu (0163). O que mudou é o publicado cujo último dia já passou, que a
   * recolha ainda não arquivou: abria com a data em destaque e «Adicionar ao
   * calendário» doze dias depois (C2-005, C1-014). As regras estão em
   * `estadoDaFicha`, com testes.
   */
  const estado = estadoDaFicha(event, today);
  const jaAconteceu = estado !== 'por-acontecer';
  const novaData = novaDataDoAdiado(event);
  const origem = urlDoSitio(regiao, SITE_URL);

  // As três respostas do primeiro ecrã, com os dados que a página já tinha.
  const quando = quandoDaFicha(event, today);
  const precoDaLinha = precoDaFicha({
    is_free: event.is_free,
    preco: price,
    temPaginaOficial: Boolean(event.source_url),
  });
  const soATerra =
    !venue && localSoATerra(event.location_name, [municipality?.name ?? null, event.parish]);
  const ondeTexto = venue?.name ?? event.location_name ?? null;
  // A ligação de quem quer o que vem a seguir — num evento que já não se pode
  // apanhar, é a ação que sobra, e a ficha deixa de ser um beco.
  const maisPerto = municipality
    ? {
        href: `/agenda?municipality=${municipality.id}`,
        rotulo: `Ver o que vem aí ${emNome(municipality.name, municipality.article)}`,
      }
    : { href: '/agenda', rotulo: 'Ver o que vem aí' };
  // «Corrigir» leva o evento consigo (C2-031): sem email da região, cai para a
  // página de quem programa, que também explica como escrever.
  const corrigirHref = regiao.email
    ? pedidoDeCorrecao({
        email: regiao.email,
        titulo: event.title,
        quando: quandoCurto(event, today),
        endereco: `${origem}/evento/${event.slug}`,
      })
    : '/submeter';
  /*
   * Uma ação principal, e só uma (C1-012, C1-011). Num grupo de iguais o que é
   * diferente lê-se como o principal, e era o «Partilhar» que o parecia — por
   * ter outra moldura. A principal é a que leva ao passo seguinte: os bilhetes,
   * quando há bilheteira; a página oficial, quando não há; e, num evento que já
   * não se apanha, o que vem aí no mesmo concelho.
   */
  const ACAO =
    'inline-flex min-h-11 items-center rounded border border-field bg-surface px-4 text-sm font-medium underline-offset-4 hover:underline';
  const PRINCIPAL =
    'inline-flex min-h-11 items-center rounded border border-accent bg-accent px-5 text-sm font-medium text-on-accent underline-offset-4 hover:underline';
  const comBilhetes = estado === 'por-acontecer' && Boolean(event.ticketing_url);

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

      {/*
        O primeiro ecrã responde às perguntas que decidem se se vai — quando,
        onde, quanto custa, e se ainda se vai a tempo — antes do cartaz e da
        sinopse. A hora estava a dois ecrãs do título e o preço a três, depois
        da descrição inteira (C1-011, C2-003, C3-016); quem lia o cartaz
        sabia, quem não lia rolava.

        Na secretária, duas colunas: o cartaz à esquerda e a informação à
        direita, presa ao ecrã enquanto o cartaz passa — era um cartaz à
        largura toda com os botões abaixo da dobra. No telemóvel, a informação
        primeiro e o cartaz a seguir: é a mesma ordem para quem ouve a página,
        que é a do código.

        As migalhas são as mesmas que os dados estruturados publicam.
      */}
      <div className="mb-10 flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-6">
          <header>
            <Migalhas trilha={migalhasDoEvento(event, municipality)} />
            {/*
              A categoria, e a dúvida sobre ela ao lado e apagada (C1-015).
              «Provavelmente exposições» no sítio do rótulo lia-se como erro;
              a categoria é a que se publica, e o «por confirmar» diz que é um
              palpite — a explicação inteira está em «Detalhes».
            */}
            {category ? (
              <p className="ct-eyebrow mb-2.5">
                {category.name}
                {ressalva ? (
                  <span className="ct-eyebrow-nota"> · categoria por confirmar</span>
                ) : null}
              </p>
            ) : null}
            <h1 className="ct-display-sm max-w-3xl">{event.title}</h1>
            {event.subtitle ? <p className="mt-2 text-lg text-muted">{event.subtitle}</p> : null}

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

          {/*
            O estado diz-se logo por baixo do título, porque é isso que muda o
            sentido do que vem a seguir — pô-lo no fim era deixar alguém ler a
            data e fechar a página a pensar que ainda vai a tempo. Um cancelado
            e um adiado respondiam «Esta página não existe» (C2-006); um
            evento de há doze dias parecia por acontecer (C2-005).
          */}
          {estado === 'cancelado' ? (
            <p className="mt-4 rounded-lg border-2 border-ink bg-surface px-4 py-3">
              <strong className="font-semibold">Cancelado.</strong> Este evento foi cancelado; a
              data em baixo era a que estava marcada.
            </p>
          ) : estado === 'adiado' ? (
            <p className="mt-4 rounded-lg border-2 border-ink bg-surface px-4 py-3">
              <strong className="font-semibold">
                {novaData
                  ? `Adiado para ${diaPorExtenso(novaData, today).toLowerCase()}.`
                  : 'Adiado.'}
              </strong>{' '}
              {novaData
                ? 'A data que estava marcada foi cancelada; a nova é a que está em baixo.'
                : event.source_url
                  ? 'Ainda não temos a nova data — a data em baixo era a que estava marcada. Confirme na página oficial.'
                  : 'Ainda não temos a nova data — a data em baixo era a que estava marcada.'}
            </p>
          ) : estado === 'ja-aconteceu' ? (
            <p className="mt-4 rounded-lg border border-field bg-surface px-4 py-3">
              <strong className="font-semibold">Já aconteceu.</strong> Esta página fica como registo
              do que houve, e não como convite.
            </p>
          ) : null}

          {/* As três respostas em duas colunas — o nome à esquerda, a
              resposta à direita —, e numa só quando a letra cresce (C3-011):
              com a letra a 200 %, os 4,5 rem do nome eram 144 px e sobravam
              130 para a resposta, e «Espetáculos» saía da janela. A pergunta é
              feita em `rem`, como nos cartões: abaixo de 15 rem de caixa, o
              nome sobe para cima da resposta. À letra de sempre isso são
              240 px, que nenhum telemóvel deixa de ter. */}
          <dl className="@container mt-5 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:p-5">
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-3 @max-[15rem]:grid-cols-1 @max-[15rem]:gap-0.5">
              <dt className="text-sm text-muted">Quando</dt>
              <dd className={jaAconteceu && !novaData ? 'text-muted' : 'font-semibold'}>
                {estado === 'cancelado' || (estado === 'adiado' && !novaData)
                  ? 'Estava marcado para '
                  : null}
                <time dateTime={quando.dateTime ?? undefined}>
                  {estado === 'cancelado' || (estado === 'adiado' && !novaData)
                    ? `${quando.texto.charAt(0).toLowerCase()}${quando.texto.slice(1)}`
                    : quando.texto}
                </time>
                {quando.horaPorConfirmar && !jaAconteceu ? (
                  <span className="font-normal text-muted"> · hora por confirmar</span>
                ) : null}
                {quando.outras && !jaAconteceu ? (
                  <a
                    href="#quando"
                    className="mt-0.5 flex min-h-11 items-center text-sm font-normal underline underline-offset-4"
                  >
                    {quando.outras}
                  </a>
                ) : null}
              </dd>
            </div>
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-3 @max-[15rem]:grid-cols-1 @max-[15rem]:gap-0.5">
              <dt className="text-sm text-muted">Onde</dt>
              <dd>
                {venue ? (
                  /*
                   * Sem pré-carregamento, e é por privacidade. No primeiro
                   * ecrã a ligação está à vista logo ao abrir, e o Next
                   * pré-carregava a página do espaço — cujo pedido traz a
                   * indicação de pré-carregar a fotografia do espaço, que vem
                   * do Wikimedia Commons. A ficha passava a pedir uma imagem a
                   * terceiros que não mostra, e a receber cookies deles
                   * (medido pelo `check:desempenho` com dados). Ao tocar, a
                   * página do espaço abre como sempre.
                   */
                  <Link
                    href={`/espaco/${venue.id}`}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                  >
                    {venue.name}
                  </Link>
                ) : (
                  <span className="font-semibold">{ondeTexto ?? 'Local por confirmar'}</span>
                )}
                {/*
                  Uma terra dada como sítio diz-se o que é (C2-015): «Onde:
                  Constância» numa aula «nas instalações da Junta» mandava
                  alguém para a vila inteira.
                */}
                {soATerra ? (
                  <span className="block text-sm text-muted">
                    Local exato não indicado pela fonte
                  </span>
                ) : municipality && municipality.name !== ondeTexto ? (
                  <span className="block text-sm text-muted">{municipality.name}</span>
                ) : null}
              </dd>
            </div>
            {estado === 'cancelado' || estado === 'ja-aconteceu' ? null : (
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-3 @max-[15rem]:grid-cols-1 @max-[15rem]:gap-0.5">
                <dt className="text-sm text-muted">Preço</dt>
                <dd
                  className={
                    precoDaLinha.tom === 'nao-indicado'
                      ? 'text-muted'
                      : precoDaLinha.tom === 'livre'
                        ? 'font-semibold text-accent'
                        : 'font-semibold'
                  }
                >
                  {precoDaLinha.texto}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {comBilhetes ? (
              <a
                href={event.ticketing_url as string}
                rel="noopener nofollow"
                data-stat-kind="ticket_click"
                className={PRINCIPAL}
              >
                Bilhetes e reservas
              </a>
            ) : null}
            {jaAconteceu && estado !== 'adiado' ? (
              <Link href={maisPerto.href} className={PRINCIPAL}>
                {maisPerto.rotulo}
              </Link>
            ) : null}
            {event.source_url ? (
              // O caminho para a fonte à vista, não só na letra pequena do
              // rodapé: um agregador ganha confiança quando facilita a
              // contraprova. Contado desde a 0141 — é o que dá a quem
              // organiza a prova de que a agenda lhe manda gente.
              <a
                href={event.source_url}
                rel="noopener nofollow"
                data-stat-kind="source_click"
                className={comBilhetes || (jaAconteceu && estado !== 'adiado') ? ACAO : PRINCIPAL}
              >
                Página oficial ↗
              </a>
            ) : null}
            {jaAconteceu ? null : (
              <a href={calendarHref} data-stat-kind="ical_download" className={ACAO}>
                Adicionar ao calendário
              </a>
            )}
            {estado === 'cancelado' || estado === 'ja-aconteceu' ? null : (
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
            )}
            <AnalyticsShareButton
              eventId={event.id}
              title={event.title}
              url={`${origem}/evento/${event.slug}`}
            />
          </div>
        </div>

        {event.image_url ? (
          <CartazDaFicha
            src={event.image_url}
            alt={event.image_alt ?? `Imagem de divulgação de ${event.title}`}
            medidas={medidasDoCartaz}
            // Só o que a capa desenha — e sem o cartaz, que é o que falhou: o
            // resto do evento viajava para o navegador sem nada que o lesse.
            capa={{
              title: event.title,
              image_url: null,
              image_miniatura: null,
              image_alt: null,
              category_slug: event.category_slug,
              date_start: event.date_start,
              date_end: event.date_end,
            }}
            today={today}
            credito={
              <>
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
              </>
            }
          />
        ) : (
          /*
           * Sem cartaz, a capa tipográfica — a mesma das listas (C1-013).
           *
           * A ficha era só texto: a capa que dá ritmo à agenda ficava na lista e
           * não chegava à página onde a pessoa decide. Doze dos oitenta e cinco
           * eventos da região não têm cartaz, e na demonstração são todos. É
           * decorativa como lá — o título está escrito ao lado — e a escala
           * grande sai sozinha, porque é a caixa que a decide (`@container`).
           */
          <div className="lg:order-first">
            <Capa event={event} today={today} className="mx-auto w-full max-w-80" />
          </div>
        )}
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
          /*
           * Sem a frase de contagem que aqui estava — «Uma sessão.», «2
           * sessões.» (C2-039). A recolha lê as sessões que a fonte escreveu,
           * e a fonte pode ter escrito uma quando o cartaz, por cima, anuncia
           * duas: contá-las era afirmar um número que esta casa não sabe. A
           * lista diz o que se leu, e é tudo o que se pode dizer.
           */
          <EventDetailSessions
            sessions={event.sessions}
            today={today}
            isOngoing={event.is_ongoing}
          />
        ) : (
          <p className="mt-2 text-muted">Sem horário publicado.</p>
        )}
      </section>

      {/* «Onde» era uma secção à parte, com o nome do espaço e a freguesia: o
          nome subiu para o bloco do primeiro ecrã, e a morada e o caminho são
          desta. */}
      <section aria-labelledby="como-chegar" className="mt-10">
        <h2 id="como-chegar" className="ct-heading">
          Onde e como chegar
        </h2>
        <HowToArriveSection
          text={event.how_to_arrive ?? venue?.how_to_arrive ?? null}
          placeName={venue?.name ?? event.location_name}
          address={event.location_address ?? venue?.address ?? null}
          parish={event.parish ?? venue?.parish ?? null}
          municipalityName={municipality?.name ?? null}
          latitude={event.latitude ?? venue?.latitude ?? null}
          longitude={event.longitude ?? venue?.longitude ?? null}
          planeador={planeador}
          soATerra={soATerra}
          dia={diaUnicoPorVir(event, today)}
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
            acessoDoEspaco={acessoDoEspaco.has(event.id)}
          />
        </section>
      ) : null}

      {/*
        «Detalhes» era uma lista de definições com cinco pares — e dois deles,
        a categoria e o concelho, já estavam nas migalhas e na linha por baixo
        do título. Fica o que é mesmo do evento, em sinais: preço, duração,
        para quem, e as etiquetas.
      */}
      {/*
        «Detalhes» só se desenha quando tem o que dizer (C2-014). Sem preço —
        que subiu para o primeiro ecrã —, sem duração, sem público e sem
        categoria ficava um título seguido de nada, e um título sem conteúdo
        parece uma página partida.
      */}
      {detalhes.length > 0 || category || event.tags.length > 0 ? (
        <section aria-labelledby="detalhes" className="mt-10">
          <h2 id="detalhes" className="ct-heading">
            Detalhes
          </h2>
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
      ) : null}

      <footer className="mt-12 border-t border-border pt-4 text-sm text-muted">
        <h2 className="font-semibold text-ink">De onde vem esta informação</h2>
        {/*
          Numa linha. A proveniência é uma garantia e continua toda cá — de
          onde veio, quando foi vista, o caminho para a fonte e a porta para
          quem quiser corrigir. Três parágrafos a dizê-lo não diziam mais.
        */}
        <p className="mt-1">
          {originLabel}
          {updatedAt ? (
            <>
              {' · '}
              <time dateTime={updatedAt}>{formatLongDate(updatedAt)}</time>
            </>
          ) : null}
          .
        </p>
        {/*
          As duas ligações saíram da frase e ganharam o tamanho de um dedo
          (C3-007): «Corrigir» tinha 46×21 píxeis e é a porta da promessa
          «nunca inventar» — por onde quem viu um erro o diz. E leva o evento
          consigo (C2-031), em vez de abrir a página de enviar eventos novos.
        */}
        <p className="mt-1 flex flex-wrap gap-x-4">
          {event.source_url ? (
            <a
              href={event.source_url}
              rel="noopener nofollow"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Ver na fonte
            </a>
          ) : null}
          <a
            href={corrigirHref}
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Corrigir esta informação
          </a>
        </p>
      </footer>
    </article>
  );
}
