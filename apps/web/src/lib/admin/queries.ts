import 'server-only';
import { reportarErro } from '../registo';
import { requireAdminClient } from '../supabase/server';

/**
 * Leituras do backoffice.
 *
 * Tudo aqui usa a chave de serviço: a fila de moderação e a auditoria não têm
 * policy nenhuma, de propósito, e das fontes a chave pública só lê nove
 * colunas — a apresentação que a página /fontes mostra, nunca o `config` (que
 * guarda o cabeçalho combinado com Abrantes), o `notes` nem o `last_error`.
 * Este ecrã precisa de tudo isso, e por isso entra pela porta de serviço.
 *
 * E nada disto passa por cache — um painel de moderação em cache mostra
 * trabalho que já foi feito.
 */

export interface SubmissionSummary {
  id: string;
  channel: 'scraper' | 'email' | 'form';
  status: string;
  sender_email: string | null;
  sender_organisation: string | null;
  municipality_id: string | null;
  confidence: number | null;
  extraction_status: string;
  created_at: string;
  payload: Record<string, unknown>;
  raw_subject: string | null;
}

export interface SubmissionDetail extends SubmissionSummary {
  raw_text: string | null;
  sender_name: string | null;
  venue_id: string | null;
  source_id: string | null;
  fingerprint: string | null;
  extraction_error: string | null;
  extraction_model: string | null;
  extraction_attempts: number;
  review_notes: string | null;
  resulting_event_id: string | null;
  duplicate_of_event_id: string | null;
}

export interface AttachmentRow {
  id: string;
  kind: string;
  storage_path: string;
  filename: string | null;
  mime_type: string;
  size_bytes: number;
  ocr_text: string | null;
  ocr_status: string;
}

const SUMMARY_FIELDS =
  'id, channel, status, sender_email, sender_organisation, municipality_id, confidence, extraction_status, created_at, payload, raw_subject';

const DETAIL_FIELDS = `${SUMMARY_FIELDS}, raw_text, sender_name, venue_id, source_id, fingerprint, extraction_error, extraction_model, extraction_attempts, review_notes, resulting_event_id, duplicate_of_event_id`;

export async function listSubmissions(options: {
  status?: string;
  channel?: string;
  limit?: number;
}): Promise<SubmissionSummary[]> {
  const supabase = requireAdminClient();
  let query = supabase.from('submissions').select(SUMMARY_FIELDS);
  if (options.status) query = query.eq('status', options.status);
  if (options.channel) query = query.eq('channel', options.channel);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 100);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SubmissionSummary[];
}

export async function getSubmission(id: string): Promise<SubmissionDetail | null> {
  const supabase = requireAdminClient();
  const { data } = await supabase
    .from('submissions')
    .select(DETAIL_FIELDS)
    .eq('id', id)
    .maybeSingle();
  return (data as unknown as SubmissionDetail) ?? null;
}

export async function listAttachments(submissionId: string): Promise<AttachmentRow[]> {
  const supabase = requireAdminClient();
  const { data } = await supabase
    .from('submission_attachments')
    .select('id, kind, storage_path, filename, mime_type, size_bytes, ocr_text, ocr_status')
    .eq('submission_id', submissionId)
    .order('created_at');
  return (data ?? []) as unknown as AttachmentRow[];
}

/**
 * Endereço assinado, de curta duração, para ver um anexo.
 *
 * O balde `intake` é privado e continua privado: um cartaz enviado por email
 * não é conteúdo público até alguém o aprovar. Quinze minutos chegam para o
 * ver durante a revisão.
 */
export async function signedAttachmentUrl(path: string): Promise<string | null> {
  const supabase = requireAdminClient();
  const { data } = await supabase.storage.from('intake').createSignedUrl(path, 900);
  return data?.signedUrl ?? null;
}

export interface DuplicateCandidate {
  event_id: string;
  title: string;
  date_start: string | null;
  similarity: number;
  exact_fingerprint: boolean;
}

export async function findDuplicateCandidates(
  title: string,
  date: string | null,
  municipalityId: string,
): Promise<DuplicateCandidate[]> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase.rpc('find_duplicate_candidates', {
    p_title: title,
    p_date: date,
    p_municipality_id: municipalityId,
  });
  if (error) {
    reportarErro('find_duplicate_candidates', error);
    return [];
  }
  return (data ?? []) as DuplicateCandidate[];
}

/** Há quanto tempo uma fonte pode estar calada antes de ser preocupante. */
export const STALE_SOURCE_HOURS = 48;

export interface SourceHealth {
  id: string;
  name: string;
  municipality_id: string | null;
  is_enabled: boolean;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  circuit_open_until: string | null;
  baseline_item_count: number | null;
  /**
   * Estado derivado, calculado aqui e não na página.
   *
   * Uma página é uma função do que recebe: ler o relógio a meio de a desenhar
   * dá resultados que mudam sem que os dados tenham mudado. O instante é lido
   * uma vez, aqui, e o que chega acima já é uma resposta.
   */
  breaker_open: boolean;
  /** Horas desde o último sucesso; `null` se nunca houve nenhum. */
  hours_since_success: number | null;
  /** Ligada e sem sucesso dentro da janela aceitável. */
  is_stale: boolean;
}

type SourceHealthRow = Omit<SourceHealth, 'breaker_open' | 'hours_since_success' | 'is_stale'>;

export async function listSourceHealth(): Promise<SourceHealth[]> {
  const supabase = requireAdminClient();
  const { data } = await supabase
    .from('sources')
    .select(
      'id, name, municipality_id, is_enabled, last_run_at, last_success_at, last_error, consecutive_failures, circuit_open_until, baseline_item_count',
    )
    .order('name');

  const now = Date.now();
  return ((data ?? []) as unknown as SourceHealthRow[]).map((source) => {
    const hours =
      source.last_success_at === null
        ? null
        : Math.round((now - Date.parse(source.last_success_at)) / 3_600_000);
    return {
      ...source,
      breaker_open:
        source.circuit_open_until !== null && Date.parse(source.circuit_open_until) > now,
      hours_since_success: hours,
      is_stale: source.is_enabled && (hours === null || hours > STALE_SOURCE_HOURS),
    };
  });
}

export interface RunRow {
  id: string;
  source_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  items_found: number;
  items_new: number;
  items_updated: number;
  items_rejected: number;
  http_failures: number;
  layout_drift: boolean;
  error: string | null;
}

export async function listRecentRuns(limit = 40): Promise<RunRow[]> {
  const supabase = requireAdminClient();
  const { data } = await supabase
    .from('source_runs')
    .select(
      'id, source_id, status, started_at, finished_at, items_found, items_new, items_updated, items_rejected, http_failures, layout_drift, error',
    )
    .order('started_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as RunRow[];
}

export interface AdminAction {
  id: number;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export async function listAdminActions(page: number, perPage = 50): Promise<AdminAction[]> {
  const supabase = requireAdminClient();
  const from = (page - 1) * perPage;
  const { data } = await supabase
    .from('admin_actions')
    .select('id, actor, action, entity_type, entity_id, created_at')
    .order('id', { ascending: false })
    .range(from, from + perPage - 1);
  return (data ?? []) as unknown as AdminAction[];
}

export interface AdminEventRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  municipality_id: string;
  venue_id: string | null;
  location_name: string | null;
  date_start: string | null;
  date_end: string | null;
  image_url: string | null;
  description: string | null;
  source_id: string | null;
}

export interface EventFilter {
  q?: string;
  municipality?: string;
  status?: string;
  janela?: string;
  falta?: string;
  /** Cursor composto `data|id` — ver `listEvents`. */
  antes?: string;
}

/** Quantos por página. O lote de ações tem o mesmo tecto, de propósito. */
export const EVENTS_PAGE_SIZE = 50;

const EVENT_COLUMNS =
  'id, slug, title, status, municipality_id, venue_id, location_name, date_start, date_end, image_url, description, source_id';

/**
 * Os eventos do catálogo, para a página que os governa.
 *
 * **O cursor é composto, `data|id`, e tem de ser.** A data sozinha não serve de
 * fronteira: dezenas de eventos partilham o mesmo dia, e os que ficassem do
 * lado errado do corte nunca mais apareciam em página nenhuma. Com o id a
 * desempatar, a fronteira é total e não se perde nada pelo caminho.
 *
 * Os eventos sem data vão para o fim nos dois sentidos. São anomalias — a
 * recolha manda-os para a fila em vez de os gravar — e não merecem abrir a
 * lista de quem vem trabalhar.
 */
export async function listEvents(filter: EventFilter): Promise<AdminEventRow[]> {
  const supabase = requireAdminClient();
  const futuros = filter.janela === 'futuros';

  let query = supabase.from('events').select(EVENT_COLUMNS).eq('is_canonical', true);

  if (filter.q) query = query.ilike('title', `%${filter.q}%`);
  if (filter.municipality) query = query.eq('municipality_id', filter.municipality);
  if (filter.status && filter.status !== 'todos') query = query.eq('status', filter.status);

  // Filtros de lacuna: é por aqui que se entra a corrigir um campo em falta
  // em vez de percorrer o catálogo à procura dele.
  if (filter.falta === 'hora') {
    // A hora não é uma coluna de `events` — vive nas sessões — e o filtro
    // antigo (`date_start is null`) listava os sem data, que são outra coisa.
    // Ver `idsSemHora`.
    const ids = await idsSemHora(filter);
    if (ids.length === 0) return [];
    query = query.in('id', ids);
  } else if (filter.falta === 'sitio') query = query.is('venue_id', null).is('location_name', null);
  else if (filter.falta === 'espaco') query = query.is('venue_id', null);
  else if (filter.falta === 'imagem') query = query.is('image_url', null);
  else if (filter.falta === 'descricao') query = query.or('description.is.null,description.eq.');

  if (futuros) query = query.gte('date_end', new Date().toISOString().slice(0, 10));

  const [curData = '', curId = ''] = (filter.antes ?? '').split('|');
  if (curId && curData) {
    query = query.or(
      futuros
        ? `date_start.gt.${curData},and(date_start.eq.${curData},id.gt.${curId})`
        : `date_start.lt.${curData},and(date_start.eq.${curData},id.lt.${curId})`,
    );
  }

  const { data } = await query
    .order('date_start', { ascending: futuros, nullsFirst: false })
    .order('id', { ascending: futuros })
    .limit(EVENTS_PAGE_SIZE);

  return (data ?? []) as unknown as AdminEventRow[];
}

/** Quantos há em cada estado, para os atalhos no topo da página. */
export async function countEventsByStatus(): Promise<Record<string, number>> {
  const supabase = requireAdminClient();
  const { data } = await supabase.from('events').select('status').eq('is_canonical', true);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ status: string }>) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

export interface UnknownTag {
  tag: string;
  hits: number;
  last_seen: string;
  example_url: string | null;
}

export async function listUnknownTags(): Promise<UnknownTag[]> {
  const supabase = requireAdminClient();
  const { data } = await supabase
    // A vista tira as que já ganharam alias e as que não nomeiam género nenhum
    // — «Ar Livre», «Cultura», «Multidisciplinar». Sem ela a fila só crescia:
    // uma etiqueta mapeada deixa de ser desconhecida, mas a linha ficava lá.
    .from('unknown_tags_pendentes')
    .select('tag, hits, last_seen, example_url')
    .order('hits', { ascending: false })
    .limit(200);
  return (data ?? []) as unknown as UnknownTag[];
}

export interface UnresolvedVenue {
  normalized: string;
  name: string;
  municipality_id: string | null;
  hits: number;
  last_seen: string;
  example_url: string | null;
  /**
   * Eventos publicados, canónicos e ainda por acontecer que estão à espera
   * deste nome — no concelho da linha, quando o tem. É trabalho com prazo.
   */
  eventos_por_acontecer: number;
}

/**
 * Espaços que a recolha não conseguiu resolver para o catálogo.
 *
 * Cada um resolvido à mão uma vez vira alias e melhora todas as recolhas
 * seguintes — é a mesma economia das etiquetas por mapear, e não estava a ser
 * aproveitada porque ninguém guardava a resposta.
 *
 * Lê-se de `unresolved_venues_pendentes` e não da tabela: a tabela é o
 * histórico e nunca esquece, e uma linha que ganhou alias ficava lá a pedir
 * trabalho já feito. A vista aplica a mesma regra de resolução que a recolha
 * aplica, e a linha sai da fila no instante em que deixa de ser um problema.
 */
export async function listUnresolvedVenues(): Promise<UnresolvedVenue[]> {
  const supabase = requireAdminClient();
  const { data } = await supabase
    .from('unresolved_venues_pendentes')
    .select(
      'normalized, name, municipality_id, hits, last_seen, example_url, eventos_por_acontecer',
    )
    // Primeiro o que tem eventos publicados à espera — um nome visto três
    // vezes no sábado que vem vale mais do que um visto cem vezes em eventos
    // que já passaram —, e só depois o que aparece mais.
    .order('eventos_por_acontecer', { ascending: false })
    .order('hits', { ascending: false })
    .limit(200);
  return (data ?? []) as unknown as UnresolvedVenue[];
}

export interface LinkableVenue {
  id: string;
  name: string;
  municipality_id: string;
}

/**
 * Os espaços a que um nome da fila se pode ligar: todos os que não fecharam,
 * por concelho e nome.
 *
 * Não reaproveita `listVenuesDeTodas`, de propósito. Essa lê pela chave
 * pública e guarda-se por uma hora, e o caso típico desta lista é o inverso:
 * uma migração acabou de criar o espaço e a pessoa vem aqui, a seguir,
 * ligar-lhe o nome que a fonte escreve. Um espaço que só aparece daqui a uma
 * hora é um botão que não funciona sem dizer porquê. Como tudo o resto neste
 * ficheiro — chave de serviço, sem cache.
 */
export async function listVenuesForLinking(): Promise<LinkableVenue[]> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from('venues')
    .select('id, name, municipality_id')
    .neq('status', 'closed')
    .order('municipality_id')
    .order('name');
  if (error) {
    reportarErro('listVenuesForLinking', error);
    return [];
  }
  return (data ?? []) as unknown as LinkableVenue[];
}

export interface QualityRow {
  id: string;
  name: string;
  /** Já no sítio, à vista do público. */
  published: number;
  /** Recolhidos e à espera de que uma pessoa os aprove. */
  pending: number;
  /** Publicados mais por publicar. É sobre este que as percentagens contam. */
  in_catalogue: number;
  with_time: number;
  with_venue: number;
  with_image: number;
  with_description: number;
  with_price: number;
  with_coordinates: number;
}

/**
 * O que está preenchido no catálogo, por concelho e por fonte.
 *
 * Responde à pergunta que faltava: a agenda está a melhorar, ou só a crescer?
 * Um concelho com quarenta eventos sem hora é pior do que um com dez que
 * dizem a que horas — e sem esta medida os dois pareciam iguais.
 *
 * Conta o publicado **e** o que está à espera de aprovação, porque é isso que
 * a recolha produz: tudo o que ela escreve nasce em rascunho. Medir só o
 * publicado media as escolhas de quem modera — e, na primeira recolha a
 * sério, media treze zeros com sessenta e sete eventos gravados.
 */
export async function qualityByMunicipality(): Promise<QualityRow[]> {
  const supabase = requireAdminClient();
  const { data } = await supabase
    .from('event_quality_by_municipality')
    .select(
      'municipality_id, municipality_name, published, pending, in_catalogue, with_time, with_venue, with_image, with_description, with_price, with_coordinates',
    )
    .order('municipality_name');

  const rows = (data ?? []) as unknown as Array<
    Omit<QualityRow, 'id' | 'name'> & { municipality_id: string; municipality_name: string }
  >;
  return rows.map(({ municipality_id, municipality_name, ...rest }) => ({
    id: municipality_id,
    name: municipality_name,
    ...rest,
  }));
}

export async function qualityBySource(): Promise<QualityRow[]> {
  const supabase = requireAdminClient();
  const { data } = await supabase
    .from('event_quality_by_source')
    .select(
      'source_id, source_name, published, pending, in_catalogue, with_time, with_venue, with_image, with_description, with_price, with_coordinates',
    )
    .order('source_name');

  const rows = (data ?? []) as unknown as Array<
    Omit<QualityRow, 'id' | 'name'> & { source_id: string; source_name: string }
  >;
  return rows.map(({ source_id, source_name, ...rest }) => ({
    id: source_id,
    name: source_name,
    ...rest,
  }));
}

export interface DashboardCounts {
  pendingByChannel: Record<string, number>;
  publishedByMunicipality: Record<string, number>;
  brokenSources: SourceHealth[];
}

export async function dashboardCounts(): Promise<DashboardCounts> {
  const supabase = requireAdminClient();

  const [pending, sources] = await Promise.all([
    supabase.from('submissions').select('channel').eq('status', 'pending').limit(1000),
    listSourceHealth(),
  ]);

  const pendingByChannel: Record<string, number> = {};
  for (const row of (pending.data ?? []) as Array<{ channel: string }>) {
    pendingByChannel[row.channel] = (pendingByChannel[row.channel] ?? 0) + 1;
  }

  const { data: municipalities } = await supabase.from('municipalities').select('id');
  const publishedByMunicipality: Record<string, number> = {};
  await Promise.all(
    ((municipalities ?? []) as Array<{ id: string }>).map(async ({ id }) => {
      const { count } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('municipality_id', id)
        .eq('status', 'published');
      publishedByMunicipality[id] = count ?? 0;
    }),
  );

  const brokenSources = sources.filter(
    (source) =>
      source.is_enabled &&
      (source.consecutive_failures > 0 || source.breaker_open || source.is_stale),
  );

  return { pendingByChannel, publishedByMunicipality, brokenSources };
}

export interface SiteSectionRow {
  id: string;
  is_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

/** Uma linha de `regions` tal como o painel a lê — inteira e sem cache. */
export interface RegionAdminRow {
  id: string;
  name: string;
  article: string;
  kind: string;
  cim_name: string;
  cim_url: string;
  domain: string;
  contact_email: string;
  ical_uid_domain: string;
  tagline: string | null;
  about_intro: string | null;
  about_story: string | null;
  funding_statement: string | null;
  funding_logo_path: string | null;
  funding_logo_width: number | null;
  funding_logo_height: number | null;
  funding_logo_alt: string | null;
  logo_on_graphite_path: string | null;
  logo_on_brand_path: string | null;
  logo_width: number | null;
  logo_height: number | null;
  og_image_path: string | null;
  og_image_alt: string | null;
  data_controller_name: string | null;
  data_controller_url: string | null;
  expected_municipality_count: number;
  bbox_lat_min: number;
  bbox_lat_max: number;
  bbox_lon_min: number;
  bbox_lon_max: number;
  is_enabled: boolean;
  sort_order: number;
  updated_at: string;
}

/**
 * As regiões, para o painel — pela chave de serviço e sem cache, como tudo o
 * que aqui se edita: um formulário que mostra o estado de há uma hora é um
 * formulário que grava por cima do que alguém acabou de mudar.
 */
export async function listRegionsAdmin(): Promise<RegionAdminRow[]> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase.from('regions').select('*').order('sort_order');
  if (error) {
    reportarErro('listRegionsAdmin', error);
    return [];
  }
  return (data ?? []) as unknown as RegionAdminRow[];
}

/**
 * O estado dos interruptores das secções.
 *
 * Lê-se pela chave de serviço como tudo o resto do painel — o público lê a
 * mesma tabela pela chave anónima, com cache de uma hora, e aqui não pode
 * haver cache nenhuma: um interruptor que mostra o estado de há meia hora é um
 * interruptor em que ninguém confia.
 */
export interface RegionLicenseRow {
  id: string;
  region_id: string;
  starts_on: string;
  ends_on: string | null;
  kind: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

/**
 * As licenças, todas — histórico incluído. É pouca coisa por natureza (uma
 * linha por contrato, poucas regiões) e o painel quer as duas leituras: a
 * ficha mostra a história de uma região, o painel de entrada procura prazos
 * a acabar em todas.
 */
export async function listRegionLicenses(): Promise<RegionLicenseRow[]> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from('region_licenses')
    .select('id, region_id, starts_on, ends_on, kind, notes, created_by, created_at')
    .order('starts_on', { ascending: false });
  if (error) {
    reportarErro('listRegionLicenses', error);
    return [];
  }
  return (data ?? []) as unknown as RegionLicenseRow[];
}

export async function listSiteSections(regiao: string): Promise<SiteSectionRow[]> {
  const supabase = requireAdminClient();
  // Com mais de uma região na base, uma leitura sem recorte devolvia duas
  // linhas com o mesmo `id` e o painel mostrava o interruptor de uma região
  // com o estado da outra.
  const { data, error } = await supabase
    .from('site_sections')
    .select('id, is_enabled, updated_at, updated_by')
    .eq('region_id', regiao);
  if (error) {
    reportarErro('listSiteSections', error);
    return [];
  }
  return (data ?? []) as unknown as SiteSectionRow[];
}

type RelatorioMensal = import('./relatorio').RelatorioMensal;

/**
 * O relatório de um mês de uma região, tal como `monthly_report` (0120) o
 * devolve. Uma ida só à base: a fronteira do mês e a da região escrevem-se
 * uma vez, do lado de lá, e o que chega aqui já é o relatório inteiro.
 *
 * `mes` é `AAAA-MM`, já validado por `lerMes`; a função recebe o dia 1, que
 * é o que uma `date` sabe ser. Um erro rebenta em vez de devolver um
 * relatório vazio, ao contrário das outras leituras deste ficheiro: um
 * painel a zeros por a base ter falhado é um contratempo, um relatório a
 * zeros entregue a quem financia é um documento errado com assinatura.
 */
export async function monthlyReport(regiao: string, mes: string): Promise<RelatorioMensal> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase.rpc('monthly_report', {
    p_region: regiao,
    p_month: `${mes}-01`,
  });
  if (error) throw new Error(`monthly_report: ${error.message}`);
  return data as RelatorioMensal;
}

export interface EventWithoutTimeRow {
  id: string;
  slug: string;
  title: string;
  municipality_id: string;
  source_id: string | null;
  date_start: string | null;
  date_end: string | null;
  is_ongoing: boolean;
  status: string;
  /** Quantas sessões tem — zero é o caso mais vazio de todos. */
  sessions: number;
}

/**
 * Tecto da lista de eventos sem hora.
 *
 * Os eventos por vir são umas centenas no máximo, e a vista já só traz os que
 * ainda vão acontecer. O tecto existe para o dia em que uma recolha traga o
 * ano inteiro de uma fonte sem horas: o painel mostra os primeiros mil e
 * continua de pé, em vez de puxar a base toda para contar.
 */
const SEM_HORA_MAX = 1000;

const SEM_HORA_COLUMNS =
  'id, slug, title, municipality_id, source_id, date_start, date_end, is_ongoing, status, sessions';

/**
 * Os eventos por vir que não dizem a que horas são — a vista
 * `events_without_time` da 0118.
 *
 * É o passo que faltava entre a percentagem de `/admin/qualidade` e a lista
 * de trabalho: saber que um concelho tem 62% de eventos com hora não diz
 * quais são os outros 38%. Conta publicados e por publicar, canónicos, e só o
 * que ainda vai acontecer — corrigir a hora de um evento que já passou não
 * leva ninguém a lado nenhum.
 *
 * `regiao` recorta pelo concelho do evento, como a 0103 fez às vistas de
 * qualidade; sem ela vem a base toda, que é o que o painel mostra hoje.
 */
export async function listEventsWithoutTime(regiao?: string): Promise<EventWithoutTimeRow[]> {
  const supabase = requireAdminClient();
  let query = supabase
    .from('events_without_time')
    .select(SEM_HORA_COLUMNS)
    .order('date_start', { ascending: true, nullsFirst: false })
    .order('id')
    .limit(SEM_HORA_MAX);
  if (regiao) query = query.eq('region_id', regiao);

  const { data, error } = await query;
  if (error) {
    reportarErro('listEventsWithoutTime', error);
    return [];
  }
  return (data ?? []) as unknown as EventWithoutTimeRow[];
}

/**
 * Quantos ids cabem num filtro `in` sem rebentar o comprimento do pedido.
 *
 * O PostgREST recebe a lista no URL, e um uuid são trinta e seis caracteres:
 * duzentos dão uns sete mil, que passam em qualquer proxy. São quatro páginas
 * — mais do que a lista de trabalho tem hoje.
 */
const IDS_SEM_HORA_MAX = 200;

/**
 * Os ids que o filtro `falta=hora` de `listEvents` junta à consulta.
 *
 * A lacuna vive em `event_sessions.start_time`, não numa coluna de `events`,
 * e uma consulta à tabela dos eventos não a vê; a vista vê. Aplicam-se aqui
 * o concelho e o estado, para que o tecto de ids corte o menos possível.
 */
async function idsSemHora(filter: Pick<EventFilter, 'municipality' | 'status'>): Promise<string[]> {
  const supabase = requireAdminClient();
  let query = supabase
    .from('events_without_time')
    .select('id')
    .order('date_start', { ascending: true, nullsFirst: false })
    .order('id')
    .limit(IDS_SEM_HORA_MAX);
  if (filter.municipality) query = query.eq('municipality_id', filter.municipality);
  if (filter.status && filter.status !== 'todos') query = query.eq('status', filter.status);

  const { data, error } = await query;
  if (error) {
    reportarErro('idsSemHora', error);
    return [];
  }
  return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
}
