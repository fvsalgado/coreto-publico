// Do submódulo, e não do barril `@coreto/core` — como a linha de baixo, que
// já o fazia. O barril re-exporta `schemas.ts`, que importa o Zod; este
// ficheiro é usado por componentes do cliente (`EventCard`, `Capa`), e um
// import do barril aqui manda o Zod inteiro para o navegador de **todas** as
// páginas. Medido a 19 de setembro de 2026: a entrada passou de 144 kB de
// JavaScript para 357, contra um tecto de 170, e o `check:desempenho`
// apanhou-o.
import { addDays, horaDeInicioConhecida, isoWeekday, weekdayName } from '@coreto/core/dates';

/**
 * Datas e horas em português, para leitura humana.
 *
 * Tudo formatado no fuso de Lisboa e a partir de cadeias ISO — nunca com
 * `new Date(string)` sobre uma data sem hora, que em servidores fora de
 * Portugal escorrega um dia para trás.
 *
 * **O import é de `@coreto/core/dates` e não de `@coreto/core`, e a diferença
 * pesa duzentos e catorze quilobytes na entrada.** Este ficheiro é usado por
 * dois componentes de cliente — o `Destaques` da entrada e o `MapaDosEventos`
 * —, e o barril do `@coreto/core` reexporta os `schemas`, que importam o Zod.
 * Pelo barril, a biblioteca inteira viajava para o navegador na entrada e no
 * mapa, para o cliente usar duas funções de aritmética de datas que não
 * importam nada. A raiz media 358 kB e passou a 144; o mapa, 359 e 146.
 *
 * O `dates.ts` não tem uma única dependência, e é por isso que se pode
 * importar directamente. A regra é a mesma que está escrita no
 * `analytics/kinds.ts`, um andar acima: o que um componente de cliente importa
 * paga tudo o que esse ficheiro importa — e um barril importa tudo.
 */

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

function parts(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** «10 de maio de 2026» */
export function formatLongDate(iso: string): string {
  const p = parts(iso);
  if (!p) return iso;
  return `${p.day} de ${MONTHS[p.month - 1]} de ${p.year}`;
}

/** «10 mai» */
export function formatShortDate(iso: string): string {
  const p = parts(iso);
  if (!p) return iso;
  return `${p.day} ${MONTHS_SHORT[p.month - 1]}`;
}

/** «sábado, 10 de maio» */
export function formatWeekdayDate(iso: string): string {
  const p = parts(iso);
  if (!p) return iso;
  return `${weekdayName(iso)}, ${p.day} de ${MONTHS[p.month - 1]}`;
}

/**
 * Intervalo de datas, o mais curto que continue inequívoco.
 *
 * «10 mai», «10–12 mai», «28 abr – 3 mai», «10 mai 2026 – 3 jan 2027».
 */
export function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return 'Data por confirmar';
  const a = parts(start);
  if (!a) return start;
  if (!end || end === start) return formatShortDate(start);

  const b = parts(end);
  if (!b) return formatShortDate(start);

  if (a.year !== b.year) {
    return `${formatShortDate(start)} ${a.year} – ${formatShortDate(end)} ${b.year}`;
  }
  if (a.month === b.month) return `${a.day}–${b.day} ${MONTHS_SHORT[a.month - 1]}`;
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/** O dia e o mês soltos, para a capa desenhada: `{ day: '20', month: 'set' }`. */
export function formatDayMonth(iso: string | null): { day: string; month: string } | null {
  if (!iso) return null;
  const p = parts(iso);
  if (!p) return null;
  return { day: String(p.day), month: MONTHS_SHORT[p.month - 1] ?? '' };
}

/**
 * Já começou e ainda não acabou?
 *
 * Mais de um terço dos eventos publicados tem uma temporada, e perto de duas
 * dezenas duram mais de dois meses — exposições, época balnear, programas de
 * verão. Para esses, o dia da abertura deixa de ser notícia no dia seguinte, e
 * mostrá-lo como se fosse a data do evento manda quem lê para um dia que já
 * passou.
 */
function isRunning(start: string, end: string | null, today: string): boolean {
  return Boolean(end) && (end as string) > start && start <= today && (end as string) >= today;
}

/**
 * As datas de um evento, do ponto de vista de quem olha hoje.
 *
 * Uma exposição que abriu a 3 de junho e fecha a 27 de setembro anunciava-se
 * com «3 jun – 27 set» durante quatro meses. O 3 de junho é história: quem lê
 * a agenda em agosto quer saber quanto tempo lhe resta para ir. Enquanto não
 * começa, o dia que interessa é o da estreia; depois de começar, é o último.
 *
 * O ano só aparece quando o fim cai noutro ano — «até 3 jan 2027» —, porque é
 * aí que «3 jan» sozinho passa a poder ler-se como uma data já passada.
 */
/**
 * Acrescenta o ano quando a data não é deste ano.
 *
 * «2 jul» num ano em que julho já passou lê-se como uma data passada, e o
 * evento era de 2 de julho **do ano seguinte** — uma agenda que mostra um
 * concerto como se já tivesse acontecido é uma agenda que perde o concerto.
 *
 * O intervalo que atravessa dois anos já traz os dois escritos, e não leva
 * mais nada.
 */
function comAnoQuandoPreciso(start: string, end: string | null, today: string): string {
  const intervalo = formatDateRange(start, end);
  const inicio = parts(start);
  const fim = end ? parts(end) : null;
  const hoje = parts(today);
  if (!inicio || !hoje) return intervalo;
  if (fim && inicio.year !== fim.year) return intervalo;
  return inicio.year === hoje.year ? intervalo : `${intervalo} ${inicio.year}`;
}

export function formatEventDates(start: string | null, end: string | null, today: string): string {
  if (!start) return 'Data por confirmar';
  if (!isRunning(start, end, today)) return comAnoQuandoPreciso(start, end, today);

  const fim = parts(end as string);
  const hoje = parts(today);
  const ano = fim && hoje && fim.year !== hoje.year ? ` ${fim.year}` : '';
  return `até ${formatShortDate(end as string)}${ano}`;
}

/**
 * O dia que a capa desenhada mostra em numeral grande.
 *
 * O mesmo raciocínio do texto: enquanto o evento não começa, o numeral é o da
 * estreia; a partir do momento em que abre, é o do último dia — e a capa passa
 * a dizer «até» por cima do número, senão o leitor lê o dia errado com toda a
 * confiança do mundo.
 */
export function coverDay(
  start: string | null,
  end: string | null,
  today: string,
): { day: string; month: string; untilEnd: boolean } | null {
  if (!start) return null;
  const running = isRunning(start, end, today);
  const dia = formatDayMonth(running ? end : start);
  return dia ? { ...dia, untilEnd: running } : null;
}

/**
 * «21h30», «21h» — e «meia-noite», e não «0h».
 *
 * «0h» colado ao dia lia-se como erro, e quase sempre era: o zero com que um
 * gestor de conteúdos preenche a hora que não tem. Esse caso já não chega
 * aqui — quem mostra uma hora passa-a primeiro por `horaDeInicioConhecida`, que
 * o devolve como «sem hora». O que chega a 00:00 é a meia-noite a sério, com
 * hora de fim, e diz-se pelo nome.
 */
export function formatTime(time: string | null): string | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) return null;
  const [, hours, minutes] = match;
  if (hours === '00' && minutes === '00') return 'meia-noite';
  return minutes === '00' ? `${Number(hours)}h` : `${Number(hours)}h${minutes}`;
}

/** «1h30» ou «45 min» */
export function formatDuration(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

const AUDIENCE_LABELS: Record<string, string> = {
  all_ages: 'Todas as idades',
  family: 'Família',
  children: 'Infantil',
  youth: 'Jovens',
  adults: 'Adultos',
  seniors: 'Seniores',
  schools: 'Escolas',
  professionals: 'Profissionais',
};

export function formatAudience(audience: string | null): string | null {
  return audience ? (AUDIENCE_LABELS[audience] ?? null) : null;
}

/**
 * O catálogo fechado de categorias, com o nome como se escreve e a família de
 * cor a que pertence (C1-007). O ponto continua decorativo — o nome está
 * sempre escrito —, mas deixou de ser ao acaso: as categorias da mesma
 * família partilham a cor, e as pílulas de categoria da agenda levam o ponto
 * ao lado do nome, que é a legenda que faltava. As cores estão em
 * `globals.css`; o teste `cores.test.ts` confere que cada uma existe lá.
 */
const CATEGORY_META: Record<string, { label: string; dot: string }> = {
  musica: { label: 'Música', dot: 'bg-cat-musica' },
  teatro: { label: 'Teatro', dot: 'bg-cat-palco' },
  danca: { label: 'Dança', dot: 'bg-cat-palco' },
  cinema: { label: 'Cinema', dot: 'bg-cat-cinema' },
  exposicoes: { label: 'Exposições', dot: 'bg-cat-exposicoes' },
  patrimonio: { label: 'Património e visitas', dot: 'bg-cat-exposicoes' },
  literatura: { label: 'Literatura e ideias', dot: 'bg-cat-palavra' },
  formacao: { label: 'Formação e oficinas', dot: 'bg-cat-palavra' },
  'festas-populares': { label: 'Festas e romarias', dot: 'bg-cat-festa' },
  'feiras-mercados': { label: 'Feiras e mercados', dot: 'bg-cat-festa' },
  comunidade: { label: 'Comunidade', dot: 'bg-cat-festa' },
  'desporto-natureza': { label: 'Desporto e natureza', dot: 'bg-cat-arlivre' },
  infantil: { label: 'Infantil e família', dot: 'bg-cat-infantil' },
  outros: { label: 'Outros', dot: 'bg-cat-outros' },
};

/** As categorias do catálogo e a família de cor de cada uma — para os testes. */
export const CORES_DAS_CATEGORIAS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(CATEGORY_META).map(([slug, meta]) => [slug, meta.dot.replace(/^bg-/, '')]),
);

export function formatCategory(slug: string | null): { label: string; dot: string } | null {
  if (!slug) return null;
  return CATEGORY_META[slug] ?? null;
}

const VENUE_KIND_LABELS: Record<string, string> = {
  theatre: 'Teatro',
  cinema: 'Cinema',
  museum: 'Museu',
  library: 'Biblioteca',
  gallery: 'Galeria',
  cultural_centre: 'Centro cultural',
  auditorium: 'Auditório',
  bandstand: 'Coreto',
  heritage: 'Património',
  religious: 'Espaço religioso',
  association: 'Coletividade',
  market: 'Mercado',
  outdoor: 'Ao ar livre',
  education: 'Ensino',
  other: 'Outro',
};

export function formatVenueKind(kind: string): string {
  return VENUE_KIND_LABELS[kind] ?? 'Espaço';
}

const SERIES_KIND_LABELS: Record<string, string> = {
  festival: 'Festival',
  cycle: 'Ciclo',
  // O nome interno é o da tabela; o nome público é o que a CIMT usa quando
  // fala destes projetos, e é por aí que quem os conhece os reconhece.
  network_programme: 'Programação em rede',
};

export function formatSeriesKind(kind: string): string {
  return SERIES_KIND_LABELS[kind] ?? 'Ciclo';
}

/**
 * «Hoje», «Amanhã», ou «Sábado, 3 de outubro» — o cabeçalho de um grupo de
 * dias na agenda.
 *
 * O dia da semana sozinho não chega. «Sábado» num cabeçalho a meio de uma
 * lista deixa quem chegou de um motor de busca sem saber de que sábado se
 * fala — e a data existia mesmo, mas só dentro do atributo `datetime`, que só
 * as máquinas lêem. Agora está nos dois sítios.
 *
 * **E um formato só, a qualquer distância** (C2-041, C1-004). Até aos seis
 * dias saía «Sábado, 3 out», e a partir dos sete «sábado, 10 de outubro», com
 * minúscula: dois formatos na mesma coluna, que pareciam dois sistemas. O ano
 * escreve-se quando não é este.
 */
export function formatRelativeDay(iso: string, today: string): string {
  if (iso === today) return 'Hoje';
  const tomorrow = addDays(today, 1);
  if (iso === tomorrow) return 'Amanhã';

  const texto = formatWeekdayDate(iso);
  const comAno = iso.slice(0, 4) === today.slice(0, 4) ? texto : `${texto} de ${iso.slice(0, 4)}`;
  return `${comAno.charAt(0).toUpperCase()}${comAno.slice(1)}`;
}

/** «4 e 12 out», «4, 11 e 18 out», «28 set e 4 out» — dias soltos, sem intervalo. */
function diasSoltos(dias: readonly string[]): string {
  const p = dias.map((dia) => parts(dia));
  const mesmoMes = p.every((d) => d && d.month === p[0]?.month && d.year === p[0]?.year);
  if (mesmoMes && p[0]) {
    return `${joinPt(p.map((d) => String(d?.day)))} ${MONTHS_SHORT[p[0].month - 1]}`;
  }
  return joinPt(dias.map((dia) => formatShortDate(dia)));
}

/** Os dias seguem-se um ao outro, sem buraco nenhum? */
function seguidos(dias: readonly string[]): boolean {
  return dias.every((dia, i) => i === 0 || dia === addDays(dias[i - 1] as string, 1));
}

/**
 * A linha de datas do cartão — e a hora, quando se sabe.
 *
 * **Um intervalo é para o que é contínuo.** Um coro com duas sessões, a 4 e a
 * 12, saía «4–12 out · 16h», que se lê «todos os dias de 4 a 12, às 16h» — e
 * quem fosse na quarta encontrava a sala fechada (C2-013, C1-029). Com os dias
 * das sessões de pé (`withCardTimes`), escreve-se o que é:
 *
 * - um dia só: «12 out · 21h»;
 * - dias seguidos: o intervalo, como sempre — «4–6 out»;
 * - dias soltos com hora: a hora é do primeiro, e os outros dizem-se à parte —
 *   «4 out · 16h · também a 12 out»; com mais de dois, «e mais 3 datas»;
 * - dias soltos sem hora: «4 e 12 out»; com mais de três, «4 out e mais 3
 *   datas».
 *
 * Um período (`is_ongoing`), ou um evento de que não se leram as sessões,
 * continua a ser `formatEventDates` — «até 22 out» é o que interessa de uma
 * exposição aberta.
 */
export function formatDatasDoCartao(
  evento: {
    date_start: string | null;
    date_end: string | null;
    is_ongoing?: boolean;
    dias?: readonly string[];
    start_time?: string | null;
  },
  today: string,
  /** O primeiro dia da janela da lista; os dias antes dele já não contam. */
  inicio: string = today,
): string {
  const hora = formatTime(evento.start_time ?? null);
  const comHora = (texto: string) => (hora ? `${texto} · ${hora}` : texto);
  const dias = evento.dias ?? [];
  if (evento.is_ongoing || dias.length === 0) {
    return comHora(formatEventDates(evento.date_start, evento.date_end, today));
  }

  const proximos = dias.filter((dia) => dia >= inicio);
  const lista = proximos.length > 0 ? proximos : dias;
  const primeiro = lista[0] as string;
  const ano = primeiro.slice(0, 4) !== today.slice(0, 4) ? ` ${primeiro.slice(0, 4)}` : '';

  if (lista.length === 1) return comHora(`${formatShortDate(primeiro)}${ano}`);
  if (seguidos(lista)) {
    return comHora(`${formatDateRange(primeiro, lista.at(-1) as string)}${ano}`);
  }

  const outros = lista.slice(1);
  if (hora) {
    const resto =
      outros.length <= 2 ? `também a ${diasSoltos(outros)}` : `e mais ${outros.length} datas`;
    return `${formatShortDate(primeiro)}${ano} · ${hora} · ${resto}`;
  }
  return lista.length <= 3
    ? `${diasSoltos(lista)}${ano}`
    : `${formatShortDate(primeiro)}${ano} e mais ${outros.length} datas`;
}

/** Junta uma lista com «e» antes do último elemento. */
export function joinPt(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] as string;
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

export { horaDeInicioConhecida, isoWeekday };

/** A largura que um cartão de espaço chega a ter: três colunas num ecrã largo, a dobrar para os ecrãs densos. */
const LARGURA_DE_CARTAO = 800;

/**
 * A mesma fotografia, em tamanho de cartão.
 *
 * As fotografias dos espaços vêm do Wikimedia Commons em tamanho de ficha. Num
 * cartão de grelha isso são cinco vezes os píxeis necessários — e a página tem
 * oitenta cartões.
 *
 * A regra antiga trocava a cadeia `width=1600` por `width=800` e mais nada:
 * bastava a fotografia chegar com outra largura, ou sem largura nenhuma, para
 * ir inteira para uma miniatura de noventa e seis píxeis. O `Special:FilePath`
 * aceita qualquer valor em `width` — pedimos o nosso, esteja lá o que estiver.
 *
 * O que decide é o caminho e não o anfitrião: `Special:FilePath` é uma página
 * especial do MediaWiki, e onde ela responde o `width` é servido. Um endereço
 * de outra casa passa intacto de propósito — um parâmetro que o servidor
 * ignora não encolhe nada e só suja o endereço.
 */
export function thumbUrl(imageUrl: string): string {
  let endereco: URL;
  try {
    endereco = new URL(imageUrl);
  } catch {
    return imageUrl;
  }

  if (!endereco.pathname.includes('/Special:FilePath/')) return imageUrl;

  endereco.searchParams.set('width', String(LARGURA_DE_CARTAO));
  return endereco.toString();
}
