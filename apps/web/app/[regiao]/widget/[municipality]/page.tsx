import type { Metadata } from 'next';
import { eventFilterSchema, todayInLisbon } from '@coreto/core';
import { BandstandMark } from '@/src/components/BandstandMark';
import { Capa } from '@/src/components/Capa';
import { SITE_URL, hasDatabase } from '@/src/lib/env';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { urlDoSitio } from '@/src/lib/regiao';
import { eventUrl } from '@/src/lib/feeds/build';
import { formatCategory, formatEventDates } from '@/src/lib/format';
import {
  listEvents,
  listMunicipalities,
  listSeries,
  listVenueNames,
} from '@/src/lib/queries/events';
import { seccaoLigada } from '@/src/lib/queries/seccoes';
import type { EventCard } from '@/src/lib/queries/types';
import { paletaDoWidget } from '@/src/lib/widget/cores';
import { lerTipoDeLetra } from '@/src/lib/widget/letra';
import { lerOpcoes, type WidgetOptions } from '@/src/lib/widget/opcoes';
import { WidgetHeightReporter } from './height-reporter';

/**
 * O widget, tal como o vê quem passa pelo sítio de uma câmara.
 *
 * Durante muito tempo isto foi uma lista de texto: data, nome, sítio, e mais
 * nada. Cumpria, e era o que se via — uma caixa cinzenta que não se parecia
 * com a agenda de onde vinha nem com o sítio onde estava. Um widget vive em
 * casa dos outros, e essa é razão para o desenhar melhor do que o resto, não
 * pior.
 *
 * Passa a ter três disposições, cartazes, a cor de quem embebe e a letra de
 * quem embebe. As três disposições não são gostos: são feitios de buraco. Uma
 * coluna lateral de duzentos pixéis não tem onde pôr um cartaz; uma faixa a
 * toda a largura de uma página de entrada fica pobre com uma lista encostada à
 * esquerda.
 *
 * O que não mudou, e manda em tudo o resto: **nenhum parâmetro que venha do
 * endereço pode partir a caixa**. Um erro de escrita numa câmara vale o valor
 * por omissão, nunca uma página de erro no meio do sítio dela. É por isso que
 * as opções passam todas por `lerOpcoes`, e a cor e a letra por saneadores
 * próprios que só deixam passar o que reconhecem.
 *
 * Não leva `revalidate`: as opções viajam na cadeia de consulta e cada câmara
 * embebe a sua combinação, por isso a página é sempre desenhada no momento. O
 * que aguenta o tráfego é a camada de baixo — `listEvents` está em cache por
 * uma hora e é a mesma cache que serve o resto do sítio.
 */

type SearchParams = Record<string, string | string[] | undefined>;

interface Props {
  params: Promise<{ regiao: string; municipality: string }>;
  searchParams: Promise<SearchParams>;
}

/**
 * Os mesmos valores que `globals.css` define, presos a um tema explícito.
 *
 * O sítio segue a preferência do sistema de quem visita. Dentro de um `iframe`
 * isso nem sempre serve: um sítio com fundo claro e um visitante de tema
 * escuro davam uma mancha preta no meio da página. Com `theme=light` ou
 * `theme=dark`, quem embebe decide.
 *
 * As cores de categoria entram aqui de propósito. São elas que dão ao widget
 * a leitura por cor que a agenda tem — sem elas, a caixa ficava monocromática
 * e o ponto ao lado do nome não dizia nada.
 */
const THEME_TOKENS = `
  .coreto-widget {
    background-color: var(--color-paper);
    color: var(--color-ink);
    font-family: var(--coreto-widget-font, var(--font-sans, ui-sans-serif, system-ui, sans-serif));
  }

  .coreto-widget[data-widget-theme='light'] {
    --color-paper: #fbfdfd;
    --color-surface: #ffffff;
    --color-ink: #181921;
    --color-muted: #4b545c;
    --color-accent: #14676b;
    --color-accent-soft: #dbf1f2;
    --color-accent-deep: #212129;
    --color-on-accent: #ffffff;
    --color-border: #dde4e7;
    --color-highlight: #14676b;
    --color-cat-musica: #14676b;
    --color-cat-teatro: #9c3a1a;
    --color-cat-danca: #8a2f62;
    --color-cat-cinema: #24485c;
    --color-cat-exposicoes: #a06c10;
    --color-cat-literatura: #4a4470;
    --color-cat-festas: #b04a12;
    --color-cat-outros: #5c6570;
  }

  .coreto-widget[data-widget-theme='dark'] {
    --color-paper: #131418;
    --color-surface: #1c1d24;
    --color-ink: #eef1f4;
    --color-muted: #a4acb3;
    --color-accent: #40c0c4;
    --color-accent-soft: #172d30;
    --color-accent-deep: #0d0e12;
    --color-on-accent: #101319;
    --color-border: #2b2d35;
    --color-highlight: #40c0c4;
    --color-cat-musica: #58cdd1;
    --color-cat-teatro: #e8906a;
    --color-cat-danca: #d989b8;
    --color-cat-cinema: #82b3cc;
    --color-cat-exposicoes: #d9b05e;
    --color-cat-literatura: #a9a2d8;
    --color-cat-festas: #e59a63;
    --color-cat-outros: #a4acb3;
  }

  /*
   * A cor de quem embebe entra por estas variáveis, e não por cima dos tokens
   * da casa: assim o turquesa do Coreto continua a ser o de fábrica e a cor
   * da instituição é uma camada por cima, que se tira sem deixar rasto.
   *
   * Repara em qual das duas versões da cor vai para onde. O «accent» — ícones,
   * ligações, tudo o que é traço fino — leva a versão **corrigida**, porque um
   * traço de um pixel na cor de marca crua pode ficar invisível: o amarelo de
   * uma autarquia sobre papel dá 1,2:1. A cor crua fica para a pastilha
   * cheia, que é onde uma cor de marca se lê como cor de marca — e aí a tinta
   * por cima é escolhida para contrastar com ela.
   */
  .coreto-widget[data-widget-cor] {
    --color-accent: var(--coreto-widget-texto);
    --color-accent-soft: var(--coreto-widget-fundo);
    --color-highlight: var(--coreto-widget-texto);
  }

  /*
   * A letra escolhida vale para a caixa toda, títulos incluídos. Deixar os
   * títulos na letra desta casa dava uma caixa meio convertida — metade com a
   * letra da câmara, metade com a nossa —, que é pior do que qualquer uma das
   * duas inteiras. Quem diz «o nosso sítio é em Open Sans» quer isto todo em
   * Open Sans.
   */
  .coreto-widget[data-widget-letra],
  .coreto-widget[data-widget-letra] .font-display {
    font-family: var(--coreto-widget-font);
  }
`;

/** O fundo sobre o qual a cor de quem embebe tem de se ler, por tema. */
const FUNDO_POR_TEMA = { light: '#fbfdfd', dark: '#131418' } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId, municipality } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const municipalities = await listMunicipalities(regiao.id);
  const found = municipalities.find((item) => item.id === municipality.toLowerCase());

  return {
    title: found ? `Agenda de ${found.name}` : 'Agenda',
    // A caixa embebida repete o que já está na página do concelho: indexá-la
    // era pedir a um motor de busca que escolhesse entre duas cópias do mesmo.
    robots: { index: false, follow: false },
  };
}

/** Aviso obrigatório: dentro de um `iframe`, toda a ligação sai para fora. */
function ForaDaCaixa() {
  return <span className="sr-only"> (abre no sítio Coreto, num novo separador)</span>;
}

interface ShellProps {
  opcoes: WidgetOptions;
  children: React.ReactNode;
}

function WidgetShell({ opcoes, children }: ShellProps) {
  // Com `auto` não se sabe qual dos dois fundos vai valer, e a cor tem de se
  // ler nos dois. Toma-se o claro como referência: é o fundo da esmagadora
  // maioria dos sítios institucionais, e uma cor legível sobre claro raramente
  // falha sobre escuro depois de o próprio tema a aclarar.
  const fundo = FUNDO_POR_TEMA[opcoes.theme === 'dark' ? 'dark' : 'light'];
  const paleta = paletaDoWidget(opcoes.color, fundo);
  const letra = lerTipoDeLetra(opcoes.font);

  const estilo: React.CSSProperties = {};
  if (paleta) {
    Object.assign(estilo, {
      '--coreto-widget-marca': paleta.marca,
      '--coreto-widget-texto': paleta.texto,
      '--coreto-widget-contra': paleta.contraMarca,
      '--coreto-widget-fundo': paleta.fundo,
    });
  }
  if (letra) Object.assign(estilo, { '--coreto-widget-font': letra });

  return (
    <div
      className={`coreto-widget px-3 py-3 text-sm leading-snug ${
        opcoes.frame ? 'rounded-lg border border-border' : ''
      }`}
      data-widget-theme={opcoes.theme}
      data-widget-cor={paleta ? '' : undefined}
      data-widget-letra={letra ? '' : undefined}
      style={estilo}
      lang="pt-PT"
    >
      <style href="coreto-widget-theme" precedence="high">
        {THEME_TOKENS}
      </style>
      <WidgetHeightReporter />
      {children}
    </div>
  );
}

/**
 * O cabeçalho: a marca do coreto, o nome e a ligação para a origem.
 *
 * O sinal do coreto é pequeno e é o que faz a caixa reconhecer-se como parte
 * de alguma coisa maior — quem já viu a agenda sabe de onde isto vem sem ter
 * de ler o rodapé.
 */
function Cabecalho({ titulo, href }: { titulo: string; href: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 border-b border-border pb-2">
      <BandstandMark className="size-4 shrink-0 text-accent" />
      <h1 className="min-w-0 flex-1 truncate font-display text-sm font-semibold tracking-tight">
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className="underline-offset-2 hover:underline"
        >
          {titulo}
          <ForaDaCaixa />
        </a>
      </h1>
    </div>
  );
}

/** A data, com o mesmo «até 27 set» que a agenda usa nas temporadas. */
function Quando({ evento, hoje }: { evento: EventCard; hoje: string }) {
  return (
    <time
      dateTime={evento.date_start ?? undefined}
      className="text-xs font-medium text-highlight"
      style={{ color: 'var(--coreto-widget-texto, var(--color-highlight))' }}
    >
      {formatEventDates(evento.date_start, evento.date_end, hoje)}
    </time>
  );
}

function Titulo({ evento, classe, base }: { evento: EventCard; classe: string; base: string }) {
  return (
    <h2 className={classe}>
      <a
        href={eventUrl(base, evento.slug)}
        target="_blank"
        rel="noopener"
        className="underline-offset-2 hover:underline"
      >
        {evento.title}
        <ForaDaCaixa />
      </a>
    </h2>
  );
}

/**
 * A pastilha da entrada livre — e o único sítio onde a cor de marca aparece
 * crua, cheia, do tamanho de se ver.
 *
 * A tinta por cima é escolhida contra ela, e não fixada: sobre o azul de uma
 * câmara é branca, sobre o amarelo de outra é preta.
 */
function Livre() {
  return (
    <span
      className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[0.6875rem] font-medium text-accent"
      style={{
        backgroundColor: 'var(--coreto-widget-marca, var(--color-accent-soft))',
        color: 'var(--coreto-widget-contra, var(--color-accent))',
      }}
    >
      Entrada livre
    </span>
  );
}

interface ItemProps {
  evento: EventCard;
  onde: string | null;
  hoje: string;
  /** A origem pública da região — os cartões ligam para fora da caixa. */
  base: string;
}

/**
 * A lista: sem imagem, para as colunas onde não cabe uma.
 *
 * O ponto da categoria substitui o cartaz — dá a mesma leitura por cor com dois
 * pixéis quadrados, e num sítio institucional de coluna estreita é o máximo de
 * imagem que há.
 */
function LinhaLista({ evento, onde, hoje, base }: ItemProps) {
  const categoria = formatCategory(evento.category_slug);
  return (
    <li className="border-t border-border py-2 first:border-t-0 first:pt-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Quando evento={evento} hoje={hoje} />
        {categoria ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <span aria-hidden="true" className={`ct-octagon size-1.5 ${categoria.dot}`} />
            {categoria.label}
          </span>
        ) : null}
      </p>
      <Titulo
        evento={evento}
        base={base}
        classe="mt-0.5 font-display text-[0.9375rem] font-semibold"
      />
      {onde ? <p className="mt-0.5 truncate text-xs text-muted">{onde}</p> : null}
      {evento.is_free ? <p className="mt-1">{<Livre />}</p> : null}
    </li>
  );
}

/** Cartazes: a disposição de fábrica. Miniatura à esquerda, texto à direita. */
function LinhaCartaz({ evento, onde, hoje, base }: ItemProps) {
  const categoria = formatCategory(evento.category_slug);
  return (
    <li className="flex gap-2.5 border-t border-border py-2.5 first:border-t-0 first:pt-0">
      <Capa event={evento} today={hoje} className="w-13 shrink-0 self-start" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Quando evento={evento} hoje={hoje} />
          {categoria ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <span aria-hidden="true" className={`ct-octagon size-1.5 ${categoria.dot}`} />
              {categoria.label}
            </span>
          ) : null}
        </p>
        <Titulo
          evento={evento}
          base={base}
          classe="mt-0.5 font-display text-[0.9375rem] leading-snug font-semibold"
        />
        {onde ? <p className="mt-0.5 line-clamp-2 text-xs text-muted">{onde}</p> : null}
        {evento.is_free ? <p className="mt-1">{<Livre />}</p> : null}
      </div>
    </li>
  );
}

/** Mural: o cartaz por cima, o texto por baixo, em grelha. Para faixas largas. */
function CartaoMural({ evento, onde, hoje, base }: ItemProps) {
  return (
    <li className="min-w-0">
      <Capa event={evento} today={hoje} className="w-full" />
      <p className="mt-1.5">
        <Quando evento={evento} hoje={hoje} />
      </p>
      <Titulo
        evento={evento}
        base={base}
        classe="mt-0.5 font-display text-[0.9375rem] leading-snug font-semibold line-clamp-3"
      />
      {onde ? <p className="mt-0.5 line-clamp-2 text-xs text-muted">{onde}</p> : null}
    </li>
  );
}

export default async function WidgetPage({ params, searchParams }: Props) {
  const [{ regiao: regiaoId, municipality: segmento }, consulta] = await Promise.all([
    params,
    searchParams,
  ]);
  const regiao = await exigirRegiao(regiaoId);
  const base = urlDoSitio(regiao, SITE_URL);
  const opcoes = lerOpcoes(consulta);
  const municipalities = await listMunicipalities(regiao.id);
  const municipality = municipalities.find((item) => item.id === segmento.toLowerCase());

  if (!municipality) {
    return (
      <WidgetShell opcoes={opcoes}>
        <p className="text-muted">
          {hasDatabase
            ? 'Concelho desconhecido. Confirmem o valor de data-concelho no código do widget.'
            : 'Agenda temporariamente indisponível.'}
        </p>
      </WidgetShell>
    );
  }

  const filtro = eventFilterSchema.parse({
    municipality: municipality.id,
    venue: opcoes.venue,
    series: opcoes.series,
    category: opcoes.category,
    q: opcoes.q,
    free: opcoes.free ? 'true' : undefined,
    limit: opcoes.limit,
  });

  const hoje = todayInLisbon();
  const [resultado, venueNames, ciclos] = await Promise.all([
    listEvents(regiao.id, filtro),
    listVenueNames(regiao.id, municipality.id),
    listSeries(regiao.id),
  ]);

  /*
   * Filtrada a um espaço ou a um ciclo, é esse o nome que manda no cabeçalho e
   * nas duas ligações: um museu que embebe a sua própria programação não quer
   * que a caixa se anuncie como a agenda do concelho inteiro, e quem organiza
   * um festival quer o nome do festival.
   *
   * O espaço vem primeiro por ser o recorte mais fechado: filtrada às duas
   * coisas ao mesmo tempo, o que se está a ver é o programa daquele ciclo
   * naquele espaço, e é o espaço que a pessoa reconhece à porta.
   */
  const espacoEscolhido = opcoes.venue ? venueNames[opcoes.venue] : undefined;
  const cicloEscolhido = opcoes.series
    ? ciclos.find((ciclo) => ciclo.id === opcoes.series)?.name
    : undefined;
  const titulo = espacoEscolhido ?? cicloEscolhido ?? `Agenda de ${municipality.name}`;
  /*
   * Um widget filtrado a um ciclo aponta para a página desse ciclo — a não ser
   * que a secção dos ciclos esteja desligada, e nessa altura essa página não
   * existe. Isto vive em casa dos outros: uma ligação partida no sítio de uma
   * câmara é um erro que aparece com o nome dela, não com o nosso. A agenda
   * filtrada ao mesmo ciclo mostra o mesmo, e existe sempre.
   */
  const haCiclos = await seccaoLigada(regiao.id, 'ciclos');
  const paginaDoCiclo = (id: string) =>
    haCiclos ? `${base}/ciclo/${id}` : `${base}/agenda?series=${id}`;

  const origem = espacoEscolhido
    ? `${base}/espaco/${opcoes.venue}`
    : cicloEscolhido && opcoes.series
      ? paginaDoCiclo(opcoes.series)
      : `${base}/concelho/${municipality.id}`;
  const verTudo = opcoes.venue
    ? `${base}/agenda?venue=${opcoes.venue}`
    : opcoes.series
      ? paginaDoCiclo(opcoes.series)
      : `${base}/agenda?municipality=${municipality.id}`;

  const itens = resultado.events.map((evento) => ({
    evento,
    onde: (evento.venue_id ? venueNames[evento.venue_id] : undefined) ?? evento.location_name,
    hoje,
    base,
  }));

  return (
    <WidgetShell opcoes={opcoes}>
      {opcoes.header ? <Cabecalho titulo={titulo} href={origem} /> : null}

      {itens.length === 0 ? (
        <p className="py-1 text-xs text-muted">
          Ainda não há eventos marcados. Voltem daqui a uns dias.
        </p>
      ) : opcoes.layout === 'mural' ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-4 min-[30rem]:grid-cols-3 min-[46rem]:grid-cols-4">
          {itens.map((item) => (
            <CartaoMural key={item.evento.id} {...item} />
          ))}
        </ul>
      ) : opcoes.layout === 'lista' ? (
        <ul>
          {itens.map((item) => (
            <LinhaLista key={item.evento.id} {...item} />
          ))}
        </ul>
      ) : (
        <ul>
          {itens.map((item) => (
            <LinhaCartaz key={item.evento.id} {...item} />
          ))}
        </ul>
      )}

      <p className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2 text-xs">
        <a
          href={verTudo}
          target="_blank"
          rel="noopener"
          className="font-medium underline underline-offset-2"
          style={{ color: 'var(--coreto-widget-texto, var(--color-highlight))' }}
        >
          Ver tudo
          <ForaDaCaixa />
        </a>
        {/* A assinatura é discreta de propósito: paga-se o widget com o nome,
            e não com uma barra por cima do sítio de quem nos acolhe. */}
        <a
          href={base}
          target="_blank"
          rel="noopener"
          className="shrink-0 text-muted underline-offset-2 hover:underline"
        >
          Coreto
          <ForaDaCaixa />
        </a>
      </p>
    </WidgetShell>
  );
}
