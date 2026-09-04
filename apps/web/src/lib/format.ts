import { isoWeekday, weekdayName } from '@coreto/core';

/**
 * Datas e horas em português, para leitura humana.
 *
 * Tudo formatado no fuso de Lisboa e a partir de cadeias ISO — nunca com
 * `new Date(string)` sobre uma data sem hora, que em servidores fora de
 * Portugal escorrega um dia para trás.
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

/** «21h30», «21h» */
export function formatTime(time: string | null): string | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})/.exec(time);
  if (!match) return null;
  const [, hours, minutes] = match;
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
 * O catálogo fechado de categorias, com o nome como se escreve e o token de
 * cor do ponto que acompanha o nome nos cartões. O ponto é decorativo — o
 * nome está sempre escrito — por isso a cor não carrega significado sozinha.
 */
const CATEGORY_META: Record<string, { label: string; dot: string }> = {
  musica: { label: 'Música', dot: 'bg-cat-musica' },
  teatro: { label: 'Teatro', dot: 'bg-cat-teatro' },
  danca: { label: 'Dança', dot: 'bg-cat-danca' },
  cinema: { label: 'Cinema', dot: 'bg-cat-cinema' },
  exposicoes: { label: 'Exposições', dot: 'bg-cat-exposicoes' },
  literatura: { label: 'Literatura e ideias', dot: 'bg-cat-literatura' },
  patrimonio: { label: 'Património e visitas', dot: 'bg-cat-cinema' },
  'festas-populares': { label: 'Festas e romarias', dot: 'bg-cat-festas' },
  'feiras-mercados': { label: 'Feiras e mercados', dot: 'bg-cat-festas' },
  infantil: { label: 'Infantil e família', dot: 'bg-cat-exposicoes' },
  formacao: { label: 'Formação e oficinas', dot: 'bg-cat-literatura' },
  'desporto-natureza': { label: 'Desporto e natureza', dot: 'bg-cat-musica' },
  comunidade: { label: 'Comunidade', dot: 'bg-cat-teatro' },
  outros: { label: 'Outros', dot: 'bg-cat-outros' },
};

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
 * «Hoje», «Amanhã», «Sábado, 5 set» ou a data por extenso — o cabeçalho de um
 * grupo de dias na agenda.
 *
 * O dia da semana sozinho não chega. «Sábado» num cabeçalho a meio de uma
 * lista deixa quem chegou de um motor de busca sem saber de que sábado se
 * fala — e a data existia mesmo, mas só dentro do atributo `datetime`, que só
 * as máquinas lêem. Agora está nos dois sítios.
 */
export function formatRelativeDay(iso: string, today: string): string {
  if (iso === today) return 'Hoje';
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (iso === tomorrow) return 'Amanhã';

  const diff = Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (diff > 1 && diff < 7) {
    const name = weekdayName(iso);
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}, ${formatShortDate(iso)}`;
  }
  return formatWeekdayDate(iso);
}

/** Junta uma lista com «e» antes do último elemento. */
export function joinPt(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] as string;
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

export { isoWeekday };

/**
 * A mesma fotografia, em tamanho de cartão.
 *
 * As fotografias dos espaços vêm do Wikimedia Commons com `width=1600`, que
 * é o tamanho certo para a ficha. Num cartão de grelha isso são cinco vezes
 * os píxeis necessários — e a página tem oitenta cartões. O Commons redimensiona
 * pelo parâmetro, por isso basta pedir menos; qualquer outro URL fica como está.
 */
export function thumbUrl(imageUrl: string): string {
  if (imageUrl.includes('/Special:FilePath/') && imageUrl.includes('width=1600')) {
    return imageUrl.replace('width=1600', 'width=800');
  }
  return imageUrl;
}
