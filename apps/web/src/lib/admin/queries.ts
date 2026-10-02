import { addDays, todayInLisbon } from '@coreto/core/dates';
import 'server-only';
import { ehPaginaAlemDoFim, exigirLeitura } from '../queries/falhas';
import { reportarErro } from '../registo';
import { requireAdminClient } from '../supabase/server';
import { PREFIXO_DE_LEITURA, recorteDaFila, registarLeitura } from './leituras';

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
 *
 * **«Não há» e «não consegui saber» são duas respostas diferentes, e aqui
 * eram a mesma.** Quinze destas leituras destruturavam só o `data` — o
 * `error` do Supabase nem chegava a ser lido — ou registavam-no e devolviam
 * `[]`. Com a base em baixo, o painel de entrada dizia «nenhuma fonte
 * avariada», a fila dizia «nada por moderar», a qualidade mostrava zeros e as
 * estatísticas mostravam uma região sem eventos. Cada uma dessas frases é
 * falsa da forma mais cara possível: são frases tranquilizadoras, ditas
 * exatamente no momento em que alguém foi ao painel porque desconfiava de
 * alguma coisa.
 *
 * A doutrina é a mesma de `queries/falhas.ts`, e usa-se o mesmo `exigirLeitura`
 * — o que muda é o desfecho, e muda para melhor: estas leituras **não** estão
 * dentro de `unstable_cache`, por isso não há vazio nenhum para ficar
 * guardado uma hora, e o erro sobe até `app/admin/error.tsx`, que já existe,
 * mostra a mensagem (quem está aqui tem sessão) e oferece «tentar de novo».
 * Um painel que diz «não consegui ler» é um painel em que se pode confiar
 * quando ele diz «não há nada».
 *
 * Há uma exceção, uma só, e está marcada onde vive: `signedAttachmentUrl`,
 * que não lê a base — assina um endereço no armazenamento — e cujo `null` não
 * afirma nada, porque a página desenha o anexo na mesma, sem
 * pré-visualização.
 */

/**
 * O recorte por região que uma página pede a uma leitura (C4-015).
 *
 * `null` nas duas é «sem recorte» — o dono, a ver todas. Uma lista recorta, e
 * uma lista vazia recorta tudo: uma pessoa sem papel em região nenhuma não vê
 * nada, e não «tudo, porque não havia filtro». É `ambitoDoPainel()` que o
 * calcula a partir da sessão; as leituras só o aplicam.
 */
export interface Recorte {
  regioes: readonly string[] | null;
  concelhos: readonly string[] | null;
}

/**
 * Nenhum identificador desta base é isto — são slugs, sem sublinhados: é o
 * «nada» de um `in` vazio, que o PostgREST não aceita escrito como `()`.
 */
const NENHUM = '__nenhum__';

function lista(valores: readonly string[]): string[] {
  return valores.length > 0 ? [...valores] : [NENHUM];
}

/** Os valores de um `in` dentro de um `or` do PostgREST, já entre parênteses. */
function emLista(valores: readonly string[]): string {
  return `(${lista(valores)
    .map((valor) => `"${valor.replace(/"/g, '')}"`)
    .join(',')})`;
}

/**
 * O que os três recortes pedem a uma consulta do supabase-js: um `in` e um
 * `or`, que devolvem a mesma consulta.
 *
 * Os recortes recebem a consulta sem restrição de tipo e devolvem-na com o
 * tipo com que entrou. Com a restrição escrita como genérico (`Q extends
 * { in(...): Q }`), o TypeScript tentava provar a estrutura inteira do
 * construtor de consultas do supabase-js e desistia com «type instantiation is
 * excessively deep» nas consultas de colunas longas. Em tempo de execução é o
 * mesmo objeto: o `in` e o `or` do construtor devolvem-no a ele.
 */
interface Filtravel {
  in(coluna: string, valores: readonly string[]): Filtravel;
  or(filtro: string): Filtravel;
}

/** Recorta pelo concelho — eventos, espaços, cartazes. */
function porConcelho<Q>(query: Q, recorte: Recorte | undefined, coluna = 'municipality_id'): Q {
  if (!recorte || recorte.concelhos === null) return query;
  return (query as unknown as Filtravel).in(coluna, lista(recorte.concelhos)) as unknown as Q;
}

/** Recorta pela região — as vistas que já a trazem. */
function porRegiao<Q>(query: Q, recorte: Recorte | undefined): Q {
  if (!recorte || recorte.regioes === null) return query;
  return (query as unknown as Filtravel).in('region_id', lista(recorte.regioes)) as unknown as Q;
}

/**
 * Recorta pela região declarada **ou** pelo concelho — as submissões e as
 * fontes, que podem ter uma, a outra, ou as duas. Uma sem nenhuma das duas
 * fica de fora de qualquer recorte: não é de região nenhuma, e só o dono a vê.
 */
function porRegiaoOuConcelho<Q>(query: Q, recorte: Recorte | undefined): Q {
  if (!recorte || recorte.regioes === null || recorte.concelhos === null) return query;
  return (query as unknown as Filtravel).or(
    `region_id.in.${emLista(recorte.regioes)},municipality_id.in.${emLista(recorte.concelhos)}`,
  ) as unknown as Q;
}

export interface SubmissionSummary {
  id: string;
  channel: 'scraper' | 'email' | 'form';
  status: string;
  sender_email: string | null;
  sender_organisation: string | null;
  municipality_id: string | null;
  region_id: string | null;
  confidence: number | null;
  extraction_status: string;
  created_at: string;
  /** Quando foi decidida — numa «à espera de resposta», quando se perguntou. */
  reviewed_at: string | null;
  /** Porque é que está na fila, ou o que se pediu. */
  review_notes: string | null;
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
  'id, channel, status, sender_email, sender_organisation, municipality_id, region_id, confidence, extraction_status, created_at, reviewed_at, review_notes, payload, raw_subject';

const DETAIL_FIELDS = `${SUMMARY_FIELDS}, raw_text, sender_name, venue_id, source_id, fingerprint, extraction_error, extraction_model, extraction_attempts, resulting_event_id, duplicate_of_event_id`;

/**
 * A fila de moderação, e o registo de quem a foi ver.
 *
 * As duas leituras que trazem dados pessoais — esta e a `getSubmission` — são
 * as únicas dois deste ficheiro que deixam rasto, e o rasto escreve-se
 * **antes** da leitura. A razão está em `leituras.ts`; a versão curta é que
 * um registo de acessos guarda o pedido, não o resultado, e por isso continua
 * a haver linha mesmo quando a leitura falha a seguir.
 *
 * Está aqui dentro, e não na página, de propósito: a página é um caminho, e a
 * consulta é **o** caminho. Uma segunda página que um dia leia a fila passa
 * por aqui e fica registada sem ninguém se lembrar disso.
 */
export async function listSubmissions(options: {
  status?: string;
  channel?: string;
  limit?: number;
  recorte?: Recorte;
}): Promise<SubmissionSummary[]> {
  await registarLeitura(
    'fila',
    'submission_queue',
    recorteDaFila(options.status, options.channel, options.recorte?.regioes ?? null),
  );
  const supabase = requireAdminClient();
  let query = porRegiaoOuConcelho(
    supabase.from('submissions').select(SUMMARY_FIELDS),
    options.recorte,
  );
  if (options.status) query = query.eq('status', options.status);
  if (options.channel) query = query.eq('channel', options.channel);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 100);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SubmissionSummary[];
}

export async function getSubmission(id: string): Promise<SubmissionDetail | null> {
  // O endereço de quem submeteu, o texto em bruto do email e o hash do IP
  // estão todos nesta linha: abri-la é o acesso a dados pessoais que a
  // auditoria tem de conseguir mostrar depois. Ver `leituras.ts`.
  await registarLeitura('submissao', 'submission', id);
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from('submissions')
    .select(DETAIL_FIELDS)
    .eq('id', id)
    .maybeSingle();
  // `null` aqui é «esta submissão não existe», e a página responde 404 com
  // isso. Uma leitura falhada devolvia o mesmo `null` — e a fila mandava
  // quem moderava para um 404 de uma submissão que existe.
  exigirLeitura('getSubmission', error);
  return (data as unknown as SubmissionDetail) ?? null;
}

/**
 * A proposta por rever que vem a seguir a esta, no recorte de quem modera
 * (C4-013, «Aprovar e abrir a seguinte»).
 *
 * Pela ordem da fila — a mais recente primeiro —, a primeira mais antiga do
 * que esta; e, se esta era a última, a primeira da fila. Só o identificador:
 * sem remetente nem texto, e por isso sem rasto de leitura (`leituras.ts`) —
 * quem a abrir a seguir deixa o seu.
 */
export async function proximaSubmissao(recorte: Recorte, atual: string): Promise<string | null> {
  const supabase = requireAdminClient();
  const { data: esta, error: erroDesta } = await supabase
    .from('submissions')
    .select('created_at')
    .eq('id', atual)
    .maybeSingle();
  exigirLeitura('proximaSubmissao', erroDesta);

  const porRever = () =>
    porRegiaoOuConcelho(supabase.from('submissions').select('id'), recorte)
      .eq('status', 'pending')
      .neq('id', atual);

  const criada = (esta as { created_at: string } | null)?.created_at;
  if (criada) {
    const { data, error } = await porRever()
      .lt('created_at', criada)
      .order('created_at', { ascending: false })
      .limit(1);
    exigirLeitura('proximaSubmissao', error);
    const seguinte = (data as Array<{ id: string }> | null)?.[0];
    if (seguinte) return seguinte.id;
  }
  const { data, error } = await porRever().order('created_at', { ascending: false }).limit(1);
  exigirLeitura('proximaSubmissao', error);
  return (data as Array<{ id: string }> | null)?.[0]?.id ?? null;
}

/**
 * Só a proposta de uma submissão — o que a aprovação precisa e mais nada.
 *
 * Sem o remetente, o texto do email e o hash do IP, e por isso **sem rasto de
 * leitura**: a regra de `leituras.ts` é registar quem viu dados pessoais, e
 * estas três colunas não os têm. Quem chega aqui está a aprovar, e a
 * aprovação deixa a sua própria linha na auditoria.
 */
export async function getPropostaDaSubmissao(id: string): Promise<{
  payload: Record<string, unknown>;
  municipality_id: string | null;
  venue_id: string | null;
} | null> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from('submissions')
    .select('payload, municipality_id, venue_id')
    .eq('id', id)
    .maybeSingle();
  exigirLeitura('getPropostaDaSubmissao', error);
  if (!data) return null;
  const linha = data as {
    payload: unknown;
    municipality_id: string | null;
    venue_id: string | null;
  };
  const payload =
    typeof linha.payload === 'object' && linha.payload !== null && !Array.isArray(linha.payload)
      ? (linha.payload as Record<string, unknown>)
      : {};
  return { payload, municipality_id: linha.municipality_id, venue_id: linha.venue_id };
}

export async function listAttachments(submissionId: string): Promise<AttachmentRow[]> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from('submission_attachments')
    .select('id, kind, storage_path, filename, mime_type, size_bytes, ocr_text, ocr_status')
    .eq('submission_id', submissionId)
    .order('created_at');
  // O cartaz de um email é metade do que se está a decidir: sem ele, aprova-se
  // às cegas uma submissão que parece não ter anexo nenhum.
  exigirLeitura('listAttachments', error);
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
  // **Exceção, e é a primeira das três.** Isto não lê a base: assina um
  // endereço no armazenamento. O `null` não afirma nada — a página desenha o
  // anexo sem pré-visualização, com o nome e o tipo à vista —, e deitar a
  // ficha inteira abaixo porque uma imagem de dez não assinou seria trocar um
  // problema pequeno por um grande.
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
  // **Esta lança, e é a que mais importa que lance.** É a busca de parecidos
  // que se mostra ao lado do botão de aprovar, e a lista vazia diz «não
  // encontrei nada parecido» — a frase que autoriza a publicação. Registar o
  // erro e devolver `[]` fazia da avaria uma licença para publicar o
  // duplicado que ela não conseguiu procurar.
  exigirLeitura('find_duplicate_candidates', error);
  return (data ?? []) as DuplicateCandidate[];
}

/** Porque é que um evento pode ser o mesmo que uma proposta (0172). */
export type MotivoDeDuplicado =
  'mesmo-espaco-dia-e-hora' | 'mesmo-espaco-e-dia' | 'mesmo-dia-e-hora' | 'titulo-parecido';

export interface CandidatoADuplicado {
  event_id: string;
  title: string;
  slug: string | null;
  status: string | null;
  date_start: string | null;
  start_time: string | null;
  venue_id: string | null;
  venue_name: string | null;
  location_name: string | null;
  similarity: number;
  motivo: MotivoDeDuplicado;
}

/**
 * Os eventos que podem ser o mesmo que uma proposta, com o porquê (0172).
 *
 * Procura pelo espaço, pelo dia e pela hora, e não só pelo título: o
 * duplicado que mais acontece é o mesmo espetáculo anunciado com outro nome
 * (C4-014). Numa base sem a 0172 — só o dono entra antes da 0170, que vai à
 * frente — cai na procura antiga, só pelo título.
 *
 * **Lança, como a antiga**: a lista vazia diz «não encontrei nada parecido», e
 * é a frase que autoriza a publicação.
 */
export async function candidatosADuplicado(procura: {
  title: string;
  date: string | null;
  municipalityId: string;
  venueId?: string | null;
  startTime?: string | null;
  excluir?: string | null;
}): Promise<CandidatoADuplicado[]> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase.rpc('candidatos_a_duplicado', {
    p_title: procura.title,
    p_date: procura.date,
    p_municipality_id: procura.municipalityId,
    p_venue_id: procura.venueId || null,
    p_start_time: procura.startTime || null,
    p_excluir: procura.excluir || null,
  });
  if (error && (error.code === 'PGRST202' || error.code === '42883')) {
    const antigos = await findDuplicateCandidates(
      procura.title,
      procura.date,
      procura.municipalityId,
    );
    return antigos.map((candidato) => ({
      event_id: candidato.event_id,
      title: candidato.title,
      slug: null,
      status: null,
      date_start: candidato.date_start,
      start_time: null,
      venue_id: null,
      venue_name: null,
      location_name: null,
      similarity: candidato.similarity,
      motivo: 'titulo-parecido' as const,
    }));
  }
  exigirLeitura('candidatos_a_duplicado', error);
  return (data ?? []) as CandidatoADuplicado[];
}

/** Um evento resumido, para dizer de qual se está a falar. */
export interface EventoResumido {
  id: string;
  slug: string;
  title: string;
  status: string;
  municipality_id: string;
  date_start: string | null;
  venue_id: string | null;
  location_name: string | null;
}

const COLUNAS_DO_RESUMO =
  'id, slug, title, status, municipality_id, date_start, venue_id, location_name';

/** Um evento pelo identificador, ou `null`. */
export async function lerEventoResumido(id: string): Promise<EventoResumido | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data, error } = await requireAdminClient()
    .from('events')
    .select(COLUNAS_DO_RESUMO)
    .eq('id', id)
    .maybeSingle();
  exigirLeitura('lerEventoResumido', error);
  return (data as EventoResumido | null) ?? null;
}

/** Um evento como a ficha de correção o pergunta (C4-017). */
export interface EventoParaCorrigir {
  id: string;
  slug: string;
  status: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  municipality_id: string;
  venue_id: string | null;
  location_name: string | null;
  parish: string | null;
  how_to_arrive: string | null;
  category_slug: string | null;
  series_id: string | null;
  is_free: boolean;
  price_display: string | null;
  ticketing_url: string | null;
  image_url: string | null;
  accessibility_notes: string | null;
  is_ongoing: boolean;
  date_start: string | null;
  date_end: string | null;
  origin: string;
  source_id: string | null;
  source_url: string | null;
  submission_id: string | null;
  updated_at: string;
}

const COLUNAS_PARA_CORRIGIR =
  'id, slug, status, title, subtitle, description, municipality_id, venue_id, location_name, parish, how_to_arrive, category_slug, series_id, is_free, price_display, ticketing_url, image_url, accessibility_notes, is_ongoing, date_start, date_end, origin, source_id, source_url, submission_id, updated_at';

export async function lerEventoParaCorrigir(id: string): Promise<EventoParaCorrigir | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data, error } = await requireAdminClient()
    .from('events')
    .select(COLUNAS_PARA_CORRIGIR)
    .eq('id', id)
    .maybeSingle();
  exigirLeitura('lerEventoParaCorrigir', error);
  return (data as EventoParaCorrigir | null) ?? null;
}

/** O nome de uma fonte, para dizer de onde veio um evento. */
export async function nomeDaFonte(id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data, error } = await requireAdminClient()
    .from('sources')
    .select('name')
    .eq('id', id)
    .maybeSingle();
  exigirLeitura('nomeDaFonte', error);
  return (data as { name: string } | null)?.name ?? null;
}

/** Um campo trancado contra a recolha: quem, quando e porquê (0015). */
export interface CampoTrancado {
  field: string;
  actor: string;
  note: string | null;
  created_at: string;
}

export async function camposTrancados(id: string): Promise<CampoTrancado[]> {
  const { data, error } = await requireAdminClient()
    .from('manual_overrides')
    .select('field, actor, note, created_at')
    .eq('event_id', id)
    .order('created_at', { ascending: false });
  exigirLeitura('camposTrancados', error);
  return (data ?? []) as CampoTrancado[];
}

/**
 * O evento de que fala um endereço público — `https://<região>/evento/<slug>`
 * — ou o próprio slug escrito à mão. É o que se pede a quem modera em vez de
 * um identificador (C4-029): a ficha pública é o que ele tem aberto no outro
 * separador.
 */
export async function eventoPeloEndereco(texto: string): Promise<EventoResumido | null> {
  const limpo = texto.trim();
  const slug = (
    /\/evento\/([a-z0-9-]+)/.exec(limpo)?.[1] ?? (/^[a-z0-9-]+$/.test(limpo) ? limpo : '')
  ).slice(0, 200);
  if (!slug) return null;
  const { data, error } = await requireAdminClient()
    .from('events')
    .select(COLUNAS_DO_RESUMO)
    .eq('slug', slug)
    .maybeSingle();
  exigirLeitura('eventoPeloEndereco', error);
  return (data as EventoResumido | null) ?? null;
}

/** Uma sessão de um evento, só com o que a distingue das outras. */
export interface SessaoResumida {
  session_date: string;
  start_time: string | null;
  end_time: string | null;
}

/** As sessões de um evento, pela ordem do calendário. */
export async function sessoesDoEvento(id: string): Promise<SessaoResumida[]> {
  const { data, error } = await requireAdminClient()
    .from('event_sessions')
    .select('session_date, start_time, end_time')
    .eq('event_id', id)
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true });
  exigirLeitura('sessoesDoEvento', error);
  return (data ?? []) as SessaoResumida[];
}

/** Há quanto tempo uma fonte pode estar calada antes de ser preocupante. */
export const STALE_SOURCE_HOURS = 48;

export interface SourceHealth {
  id: string;
  name: string;
  municipality_id: string | null;
  region_id: string | null;
  is_enabled: boolean;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  circuit_open_until: string | null;
  baseline_item_count: number | null;
  /** A pausa declarada por uma pessoa (0159), e a razão. */
  pausada_ate: string | null;
  pausa_motivo: string | null;
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
  /** Calada por decisão até uma data que ainda não passou (0159). */
  em_pausa: boolean;
}

type SourceHealthRow = Omit<
  SourceHealth,
  'breaker_open' | 'hours_since_success' | 'is_stale' | 'em_pausa'
>;

export async function listSourceHealth(recorte?: Recorte): Promise<SourceHealth[]> {
  const supabase = requireAdminClient();
  const { data, error } = await porRegiaoOuConcelho(
    supabase
      .from('sources')
      .select(
        'id, name, municipality_id, region_id, is_enabled, last_run_at, last_success_at, last_error, consecutive_failures, circuit_open_until, baseline_item_count, pausada_ate, pausa_motivo',
      ),
    recorte,
  ).order('name');
  // O painel de entrada conta as fontes avariadas a partir daqui. A lista
  // vazia de um erro escrevia «nenhuma fonte avariada» — a frase mais
  // tranquilizadora do painel, dita quando não se consegue ler a base.
  exigirLeitura('listSourceHealth', error);

  const now = Date.now();
  return ((data ?? []) as unknown as SourceHealthRow[]).map((source) => comEstado(source, now));
}

/** O estado derivado de uma fonte, ao instante dado — lido uma vez por pedido. */
function comEstado<T extends SourceHealthRow>(source: T, now: number): T & SourceHealth {
  const hours =
    source.last_success_at === null
      ? null
      : Math.round((now - Date.parse(source.last_success_at)) / 3_600_000);
  return {
    ...source,
    breaker_open: source.circuit_open_until !== null && Date.parse(source.circuit_open_until) > now,
    hours_since_success: hours,
    is_stale: source.is_enabled && (hours === null || hours > STALE_SOURCE_HOURS),
    em_pausa: source.pausada_ate !== null && Date.parse(source.pausada_ate) > now,
  };
}

/** Uma fonte com o que a ficha dela mostra (C4-032). */
export interface FonteDoPainel extends SourceHealth {
  url: string | null;
  kind: string;
  adapter: string;
  config: unknown;
  /** As notas de quem opera — o porquê de uma fonte estar como está. */
  notes: string | null;
}

export async function lerFonte(id: string): Promise<FonteDoPainel | null> {
  const { data, error } = await requireAdminClient()
    .from('sources')
    .select(
      'id, name, municipality_id, region_id, is_enabled, last_run_at, last_success_at, last_error, consecutive_failures, circuit_open_until, baseline_item_count, pausada_ate, pausa_motivo, url, kind, adapter, config, notes',
    )
    .eq('id', id)
    .maybeSingle();
  exigirLeitura('lerFonte', error);
  if (!data) return null;
  return comEstado(
    data as unknown as SourceHealthRow & Omit<FonteDoPainel, keyof SourceHealth>,
    Date.now(),
  );
}

/** Id e nome de cada fonte, para o selector da lista de eventos. */
export interface FonteParaFiltro {
  id: string;
  name: string;
}

/**
 * As fontes, só com o que um selector precisa.
 *
 * `listSourceHealth` traz dez colunas e calcula estado derivado para cada
 * uma; um `<select>` precisa de duas. Consulta própria, e não uma leitura
 * grande reaproveitada, porque a página dos eventos já faz três.
 */
export async function listSourcesParaFiltro(recorte?: Recorte): Promise<FonteParaFiltro[]> {
  const supabase = requireAdminClient();
  const { data, error } = await porRegiaoOuConcelho(
    supabase.from('sources').select('id, name'),
    recorte,
  ).order('name');
  // Vazio por erro deixava o selector sem opções e a página a parecer dizer
  // que o catálogo não tem fontes nenhumas — quando o que não se conseguiu
  // foi lê-las.
  exigirLeitura('listSourcesParaFiltro', error);
  return (data ?? []) as unknown as FonteParaFiltro[];
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

export async function listRecentRuns(limit = 40, fontes?: readonly string[]): Promise<RunRow[]> {
  const supabase = requireAdminClient();
  let query = supabase
    .from('source_runs')
    .select(
      'id, source_id, status, started_at, finished_at, items_found, items_new, items_updated, items_rejected, http_failures, layout_drift, error',
    );
  // As execuções das fontes que a página mostra, e só dessas: as de outra
  // região são da outra região.
  if (fontes) query = query.in('source_id', lista(fontes));
  const { data, error } = await query.order('started_at', { ascending: false }).limit(limit);
  // Sem execuções na lista, a página das fontes lê-se como «a recolha não
  // corre há dias» — que é precisamente o alarme que se vai lá procurar.
  exigirLeitura('listRecentRuns', error);
  return (data ?? []) as unknown as RunRow[];
}

export interface AdminAction {
  id: number;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  /**
   * O que lá estava antes, e o que ficou depois.
   *
   * A promessa que o plano queria cumprir com uma tabela de revisões nova —
   * «o rasto: quem fez, e o que lá estava antes» — já está escrita nestas duas
   * colunas desde a 0006. O que faltava era ler-se: a auditoria pedia seis
   * colunas e estas duas não estavam lá, por isso a página mostrava quem e o
   * quê, e nunca o antes.
   *
   * Medido a 13 de setembro de 2026: das 185 ações registadas, **91 têm o
   * `before`** e todas as 185 têm o `after`. Não cobre tudo — as que não têm
   * são as que criam do nada, onde não havia antes nenhum —, e é de graça.
   */
  before: unknown;
  after: unknown;
}

/**
 * Os recortes da auditoria.
 *
 * Cinquenta linhas por página e quinze mil ações por ano fazem da auditoria um
 * sítio onde só se encontra o que aconteceu esta manhã. Quem a abre tem sempre
 * uma pergunta concreta — «o que é que o João mexeu em agosto?», «quem aprovou
 * submissões?» — e essa pergunta responde-se com quatro recortes.
 *
 * `mes` é `AAAA-MM`; qualquer outra coisa é ignorada em vez de rebentar, porque
 * o que entra aqui vem da barra de endereços.
 */
export interface RecorteDaAuditoria {
  actor?: string;
  action?: string;
  entityType?: string;
  mes?: string;
  /**
   * Decisões, acessos, ou os dois juntos. Por omissão, decisões.
   *
   * Desde que as leituras da fila deixam rasto (`leituras.ts`), esta tabela
   * guarda duas coisas diferentes: o que alguém **decidiu** e o que alguém
   * **viu**. Misturá-las numa lista só afogava a primeira — uma fila aberta
   * vinte vezes por dia são vinte linhas por cada aprovação —, e a auditoria
   * existe sobretudo para responder a «quem aprovou isto?». Por isso a lista
   * abre nas decisões, e os acessos estão a um clique.
   */
  mostrar?: 'accoes' | 'leituras' | 'tudo';
}

/** As opções que os recortes oferecem, lidas do que existe mesmo na base. */
export interface OpcoesDaAuditoria {
  actors: string[];
  actions: string[];
  entityTypes: string[];
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** O primeiro dia do mês seguinte, para o intervalo ser meio-aberto. */
function mesSeguinte(mes: string): string {
  const [ano, numero] = mes.split('-').map(Number);
  return numero === 12
    ? `${(ano ?? 0) + 1}-01-01`
    : `${ano}-${String((numero ?? 0) + 1).padStart(2, '0')}-01`;
}

/**
 * O nome de cada coisa de que fala uma página da auditoria — o título do
 * evento, o da proposta, o nome da pessoa —, para a linha dizer «evento
 * «Concerto de Outono»» em vez de um identificador inteiro (C4-011).
 *
 * Das propostas lê-se só o título (`payload->>title`, ou o de `event` na
 * forma da recolha): o remetente e o texto em bruto não vêm, e por isso não há
 * leitura de dados pessoais a registar. A chave do mapa é `tipo:id`.
 */
export async function nomesDasEntidades(
  linhas: ReadonlyArray<{ entity_type: string | null; entity_id: string | null }>,
): Promise<Map<string, string>> {
  const supabase = requireAdminClient();
  const ids = (tipo: string) => [
    ...new Set(
      linhas
        .filter(
          (linha) => linha.entity_type === tipo && /^[0-9a-f-]{36}$/.test(linha.entity_id ?? ''),
        )
        .map((linha) => linha.entity_id as string),
    ),
  ];
  const nomes = new Map<string, string>();
  const eventos = ids('event');
  const propostas = ids('submission');
  const pessoas = ids('pessoa');

  const [deEventos, dePropostas, dePessoas] = await Promise.all([
    eventos.length > 0
      ? supabase.from('events').select('id, title').in('id', eventos)
      : Promise.resolve({ data: [], error: null }),
    propostas.length > 0
      ? supabase
          .from('submissions')
          .select('id, titulo:payload->>title, daRecolha:payload->event->>title')
          .in('id', propostas)
      : Promise.resolve({ data: [], error: null }),
    pessoas.length > 0
      ? supabase.from('admin_pessoas').select('id, nome').in('id', pessoas)
      : Promise.resolve({ data: [], error: null }),
  ]);
  exigirLeitura('nomesDasEntidades:eventos', deEventos.error);
  exigirLeitura('nomesDasEntidades:propostas', dePropostas.error);
  // Sem a 0170, não há pessoas: a linha fica com o identificador, e a página abre.
  if (dePessoas.error && !faltaNoEsquemaDasPessoas(dePessoas.error)) {
    exigirLeitura('nomesDasEntidades:pessoas', dePessoas.error);
  }
  for (const linha of (deEventos.data ?? []) as Array<{ id: string; title: string }>) {
    nomes.set(`event:${linha.id}`, linha.title);
  }
  for (const linha of (dePropostas.data ?? []) as Array<{
    id: string;
    titulo: string | null;
    daRecolha: string | null;
  }>) {
    const titulo = linha.titulo ?? linha.daRecolha;
    if (titulo) nomes.set(`submission:${linha.id}`, titulo);
  }
  for (const linha of (dePessoas.data ?? []) as Array<{ id: string; nome: string }>) {
    nomes.set(`pessoa:${linha.id}`, linha.nome);
  }
  return nomes;
}

/** As tabelas das pessoas ainda não existem (antes da 0170). */
function faltaNoEsquemaDasPessoas(erro: { code?: string }): boolean {
  return ['42P01', 'PGRST205', 'PGRST200'].includes(erro.code ?? '');
}

export async function listAdminActions(
  page: number,
  perPage = 50,
  recorte: RecorteDaAuditoria = {},
): Promise<AdminAction[]> {
  const supabase = requireAdminClient();
  const from = (page - 1) * perPage;
  let query = supabase
    .from('admin_actions')
    .select('id, actor, action, entity_type, entity_id, created_at, before, after');

  if (recorte.actor) query = query.eq('actor', recorte.actor);
  if (recorte.action) query = query.eq('action', recorte.action);
  if (recorte.entityType) query = query.eq('entity_type', recorte.entityType);
  /*
   * Uma ação escolhida à mão ganha ao recorte de cima: quem escolhe
   * `leitura.fila` na caixa «o quê» está a pedir as leituras, e devolver uma
   * lista vazia porque o outro recorte diz «decisões» seria a página a
   * contrariar o que a pessoa acabou de escolher.
   */
  if (!recorte.action) {
    const padrao = `${PREFIXO_DE_LEITURA}%`;
    if (recorte.mostrar === 'leituras') query = query.like('action', padrao);
    else if (recorte.mostrar !== 'tudo') query = query.not('action', 'like', padrao);
  }
  if (recorte.mes && MES.test(recorte.mes)) {
    query = query.gte('created_at', `${recorte.mes}-01`).lt('created_at', mesSeguinte(recorte.mes));
  }

  const { data, error } = await query
    .order('id', { ascending: false })
    .range(from, from + perPage - 1);

  /*
   * A auditoria é o registo de quem fez o quê, e é o que se abre quando há
   * uma dúvida sobre uma decisão. Uma página vazia por erro de leitura diz
   * «ninguém fez nada», que é a resposta errada à única pergunta que esta
   * página responde.
   *
   * A página além do fim é a exceção, e é a mesma da agenda pública: o
   * PostgREST recusa o intervalo com `PGRST103` e isso quer dizer «não há mais
   * nada», não «não consegui ler». Aqui não é preciso ir buscar o total —
   * esta paginação avança enquanto vierem linhas —, e a lista vazia é a
   * resposta certa e completa.
   */
  if (error && ehPaginaAlemDoFim(error)) return [];
  exigirLeitura('listAdminActions', error);
  return (data ?? []) as unknown as AdminAction[];
}

/**
 * As opções dos recortes, lidas do que a base tem mesmo.
 *
 * Escritas à mão ficavam desatualizadas no dia em que uma função nova
 * registasse uma ação com outro nome — e um filtro que não oferece o que
 * existe é pior do que filtro nenhum, porque parece completo.
 *
 * Lê um tecto de linhas em vez da tabela inteira: o que interessa é oferecer o
 * que se usa, e o que se usa aparece nas mais recentes.
 */
export async function opcoesDaAuditoria(limite = 2000): Promise<OpcoesDaAuditoria> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from('admin_actions')
    .select('actor, action, entity_type')
    .order('id', { ascending: false })
    .limit(limite);

  if (error) {
    // Sem as opções, os recortes ficam vazios e a lista continua a servir —
    // que é o comportamento certo: a auditoria responde a «quem fez o quê»
    // mesmo sem filtros, e não responde a nada se a página rebentar.
    reportarErro('opcoesDaAuditoria', error);
    return { actors: [], actions: [], entityTypes: [] };
  }

  const linhas = (data ?? []) as unknown as Array<{
    actor: string;
    action: string;
    entity_type: string;
  }>;
  const unicos = (valores: string[]) =>
    [...new Set(valores)].sort((a, b) => a.localeCompare(b, 'pt'));

  return {
    actors: unicos(linhas.map((l) => l.actor)),
    actions: unicos(linhas.map((l) => l.action)),
    entityTypes: unicos(linhas.map((l) => l.entity_type)),
  };
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
  /** Id da fonte, para entrar na lista pela célula de `/admin/qualidade`. */
  fonte?: string;
  status?: string;
  janela?: string;
  falta?: string;
  /** Cursor composto `data|id` — ver `listEvents`. */
  antes?: string;
}

/**
 * Os estados que o painel conta como «no catálogo».
 *
 * São os mesmos que `event_quality_by_municipality` agrega, e tem de ser: a
 * percentagem do painel de qualidade abre a lista por aqui, e `estado=todos`
 * trazia também escondidos, cancelados e arquivados — decisões de uma pessoa
 * sobre um evento, não lacunas de recolha. A lista mostrava mais linhas do
 * que o número prometia.
 */
export const ESTADOS_DO_CATALOGO = ['published', 'draft'] as const;

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
export async function listEvents(filter: EventFilter, recorte?: Recorte): Promise<AdminEventRow[]> {
  const supabase = requireAdminClient();
  const futuros = filter.janela === 'futuros';

  let query = supabase.from('events').select(EVENT_COLUMNS).eq('is_canonical', true);
  // À mão e não pelo `porConcelho`: com a lista de colunas desta consulta, a
  // inferência de tipos do supabase-js não chega ao fim de um genérico.
  if (recorte?.concelhos) query = query.in('municipality_id', lista(recorte.concelhos));

  if (filter.q) query = query.ilike('title', `%${filter.q}%`);
  if (filter.municipality) query = query.eq('municipality_id', filter.municipality);
  if (filter.fonte) query = query.eq('source_id', filter.fonte);
  if (filter.status === 'catalogo') query = query.in('status', [...ESTADOS_DO_CATALOGO]);
  else if (filter.status && filter.status !== 'todos') query = query.eq('status', filter.status);

  // Filtros de lacuna: é por aqui que se entra a corrigir um campo em falta
  // em vez de percorrer o catálogo à procura dele.
  if (filter.falta === 'hora') {
    // A hora não é uma coluna de `events` — vive nas sessões — e o filtro
    // antigo (`date_start is null`) listava os sem data, que são outra coisa.
    // Ver `idsSemHora`.
    const ids = await idsSemHora(filter, recorte);
    if (ids.length === 0) return [];
    query = query.in('id', ids);
    // Não há ramo para «sem sítio nenhum», e é de propósito: a restrição
    // `events_has_location` da 0004 exige espaço **ou** texto solto, pelo que
    // a condição nunca é verdadeira. Ver `lacunas.ts`.
  } else if (filter.falta === 'espaco') query = query.is('venue_id', null);
  else if (filter.falta === 'imagem') query = query.is('image_url', null);
  else if (filter.falta === 'descricao') query = query.or('description.is.null,description.eq.');
  // `is_free` é `not null default false` desde a 0004, e por isso o
  // complemento de `is_free or price_min is not null` não precisa de terceira
  // hipótese: ou diz que é grátis, ou diz quanto custa, ou não diz nada.
  else if (filter.falta === 'preco') query = query.eq('is_free', false).is('price_min', null);
  else if (filter.falta === 'mapa') query = query.is('latitude', null);

  if (futuros) query = query.gte('date_end', todayInLisbon());

  const [curData = '', curId = ''] = (filter.antes ?? '').split('|');
  if (curId && curData) {
    query = query.or(
      futuros
        ? `date_start.gt.${curData},and(date_start.eq.${curData},id.gt.${curId})`
        : `date_start.lt.${curData},and(date_start.eq.${curData},id.lt.${curId})`,
    );
  }

  const { data, error } = await query
    .order('date_start', { ascending: futuros, nullsFirst: false })
    .order('id', { ascending: futuros })
    .limit(EVENTS_PAGE_SIZE);

  // É o catálogo inteiro visto por quem o edita. Vazio por erro, a página diz
  // «não há eventos com estes filtros» e quem modera muda os filtros à procura
  // de um evento que está lá.
  exigirLeitura('listEvents (painel)', error);
  return (data ?? []) as unknown as AdminEventRow[];
}

/** Uma linha da montra da entrada, no painel. */
export interface DestaqueDoPainel {
  event_id: string;
  posicao: number;
  fixado_por: string;
  fixado_em: string;
  title: string;
  slug: string;
  date_start: string | null;
  date_end: string | null;
  image_url: string | null;
  municipality_id: string;
  /** Já acabou: continua fixado e a entrada não o mostra. */
  passou: boolean;
}

/**
 * Os destaques fixados de uma região, com o que o painel precisa de mostrar.
 *
 * Traz também os que já passaram — ao contrário da entrada, que os esconde.
 * É a diferença entre as duas vistas e é deliberada: quem administra tem de
 * os ver para os largar, e uma montra que esconde do painel o que esconde do
 * público deixa lixo fixado que ninguém sabe que lá está.
 */
export async function listDestaquesDoPainel(regiao: string): Promise<DestaqueDoPainel[]> {
  const supabase = requireAdminClient();
  const hoje = todayInLisbon();

  const { data, error } = await supabase
    .from('region_highlights')
    .select(
      'event_id, posicao, fixado_por, fixado_em, ' +
        'events!inner(title, slug, date_start, date_end, image_url, municipality_id)',
    )
    .eq('region_id', regiao)
    .order('posicao', { ascending: true });

  exigirLeitura('listDestaquesDoPainel', error);

  type Linha = {
    event_id: string;
    posicao: number;
    fixado_por: string;
    fixado_em: string;
    events: {
      title: string;
      slug: string;
      date_start: string | null;
      date_end: string | null;
      image_url: string | null;
      municipality_id: string;
    };
  };

  return ((data ?? []) as unknown as Linha[]).map((linha) => ({
    event_id: linha.event_id,
    posicao: linha.posicao,
    fixado_por: linha.fixado_por,
    fixado_em: linha.fixado_em,
    ...linha.events,
    passou: (linha.events.date_end ?? linha.events.date_start ?? '') < hoje,
  }));
}

/** Um evento que se pode fixar na montra. */
export interface CandidatoADestaque {
  id: string;
  title: string;
  date_start: string | null;
  date_end: string | null;
  image_url: string | null;
  municipality_id: string;
}

/**
 * Os eventos que se podem fixar: publicados, por acontecer, desta região.
 *
 * Por ordem de quando acontecem, e não por título: quem está a montar a
 * montra está a olhar para a semana que vem. O `q` serve a caixa de pesquisa
 * do painel, porque uma região com cento e dezasseis eventos futuros não se
 * percorre numa lista.
 */
export async function listCandidatosADestaque(
  regiao: string,
  q?: string,
  limite = 40,
): Promise<CandidatoADestaque[]> {
  const supabase = requireAdminClient();
  const hoje = todayInLisbon();

  let query = supabase
    .from('events')
    .select('id, title, date_start, date_end, image_url, municipality_id, municipalities!inner()')
    .eq('municipalities.region_id', regiao)
    .eq('status', 'published')
    .eq('is_canonical', true)
    .or(`date_end.gte.${hoje},date_start.gte.${hoje}`);

  if (q?.trim()) query = query.ilike('title', `%${q.trim()}%`);

  const { data, error } = await query
    .order('agenda_date', { ascending: true, nullsFirst: false })
    .limit(limite);

  exigirLeitura('listCandidatosADestaque', error);
  return (data ?? []) as unknown as CandidatoADestaque[];
}

/** Os estados de um evento, pela ordem em que o painel os conta. */
const ESTADOS_DO_EVENTO = [
  'published',
  'draft',
  'hidden',
  'cancelled',
  'postponed',
  'archived',
] as const;

/**
 * Quantos há em cada estado, para os atalhos no topo da página.
 *
 * Uma contagem por estado, feita pela base: trazia as linhas todas e contava
 * aqui, e o PostgREST corta às mil — o cabeçalho passava a mentir sem aviso no
 * dia em que o catálogo passasse disso (`docs/plano/07-painel.md` §1).
 */
export async function countEventsByStatus(recorte?: Recorte): Promise<Record<string, number>> {
  const supabase = requireAdminClient();
  const respostas = await Promise.all(
    ESTADOS_DO_EVENTO.map((estado) =>
      porConcelho(
        supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('is_canonical', true)
          .eq('status', estado),
        recorte,
      ),
    ),
  );
  const counts: Record<string, number> = {};
  for (const [indice, resposta] of respostas.entries()) {
    exigirLeitura('countEventsByStatus', resposta.error);
    const estado = ESTADOS_DO_EVENTO[indice];
    if (estado && resposta.count) counts[estado] = resposta.count;
  }
  return counts;
}

export interface UnknownTag {
  tag: string;
  /**
   * Avistamentos: a recolha soma um de cada vez que vê a etiqueta, todas as
   * noites, no mesmo evento. **Não é o número que decide** — serve para
   * separar uma etiqueta que apareceu uma vez e nunca mais de uma que a fonte
   * escreve todas as noites num evento só.
   */
  hits: number;
  /** Eventos do catálogo que trazem esta etiqueta. É o número que decide. */
  eventos: number;
  /** E, desses, os que continuam sem prateleira nenhuma. */
  eventos_sem_prateleira: number;
  last_seen: string;
  example_url: string | null;
}

export async function listUnknownTags(): Promise<UnknownTag[]> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    // A vista tira as que já ganharam alias e as que não nomeiam género nenhum
    // — «Ar Livre», «Cultura», «Multidisciplinar». Sem ela a fila só crescia:
    // uma etiqueta mapeada deixa de ser desconhecida, mas a linha ficava lá.
    .from('unknown_tags_pendentes')
    .select('tag, hits, eventos, eventos_sem_prateleira, last_seen, example_url')
    /*
     * Por eventos, e não por avistamentos (0140).
     *
     * A 0084 escreveu o critério para abrir prateleira nova: meia dúzia **de
     * eventos**. Ordenada por `hits`, esta fila punha no topo «Infantis, 12
     * vezes» — que é um evento, visto doze noites seguidas. Quem abrisse o
     * painel lia um padrão onde havia um caso.
     */
    .order('eventos', { ascending: false })
    .order('hits', { ascending: false })
    .limit(200);
  exigirLeitura('listUnknownTags', error);
  return (data ?? []) as unknown as UnknownTag[];
}

/**
 * As etiquetas por mapear da região escolhida, contadas nos eventos dela
 * (0171). Sem recorte — o dono em «todas» —, a fila do produto inteiro.
 *
 * `recortada: false` é o caso de uma base sem a 0171 com o dono numa região:
 * mostra-se a fila toda, e a página di-lo, em vez de fingir um recorte que não
 * fez. Uma pessoa com papel numa região só existe depois da 0170, que vai à
 * frente da 0171 — a ela nunca chega este caso.
 */
export async function etiquetasPorMapear(
  recorte: Recorte | undefined,
): Promise<{ linhas: UnknownTag[]; recortada: boolean }> {
  if (!recorte || recorte.regioes === null)
    return { linhas: await listUnknownTags(), recortada: true };
  const supabase = requireAdminClient();
  const { data, error } = await supabase.rpc('etiquetas_por_mapear_nas_regioes', {
    p_regioes: [...recorte.regioes],
  });
  if (error && (error.code === 'PGRST202' || error.code === '42883')) {
    return { linhas: await listUnknownTags(), recortada: false };
  }
  exigirLeitura('etiquetasPorMapear', error);
  return { linhas: (data ?? []) as unknown as UnknownTag[], recortada: true };
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
export async function listUnresolvedVenues(recorte?: Recorte): Promise<UnresolvedVenue[]> {
  const supabase = requireAdminClient();
  // Pelo concelho do nome. Um nome sem concelho não é de região nenhuma, e um
  // recorte deixa-o de fora: é o dono que o resolve.
  const { data, error } = await porConcelho(
    supabase
      .from('unresolved_venues_pendentes')
      .select(
        'normalized, name, municipality_id, hits, last_seen, example_url, eventos_por_acontecer',
      ),
    recorte,
  )
    // Primeiro o que tem eventos publicados à espera — um nome visto três
    // vezes no sábado que vem vale mais do que um visto cem vezes em eventos
    // que já passaram —, e só depois o que aparece mais.
    .order('eventos_por_acontecer', { ascending: false })
    .order('hits', { ascending: false })
    .limit(200);
  // A fila vazia é «está tudo resolvido», e é uma das duas frases que fazem
  // alguém fechar o painel descansado.
  exigirLeitura('listUnresolvedVenues', error);
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
export async function listVenuesForLinking(recorte?: Recorte): Promise<LinkableVenue[]> {
  const supabase = requireAdminClient();
  const { data, error } = await porConcelho(
    supabase.from('venues').select('id, name, municipality_id').neq('status', 'closed'),
    recorte,
  )
    .order('municipality_id')
    .order('name');
  // A lista de destinos do botão «ligar a este espaço». Vazia, o botão fica
  // sem para onde ligar e a página parece dizer que o catálogo não tem
  // espaços nenhuns.
  exigirLeitura('listVenuesForLinking', error);
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
export async function qualityByMunicipality(recorte?: Recorte): Promise<QualityRow[]> {
  const supabase = requireAdminClient();
  const { data, error } = await porRegiao(
    supabase
      .from('event_quality_by_municipality')
      .select(
        'municipality_id, municipality_name, published, pending, in_catalogue, with_time, with_venue, with_image, with_description, with_price, with_coordinates',
      ),
    recorte,
  ).order('municipality_name');
  // Zeros por erro de leitura são a pior forma de mentir num painel de
  // qualidade: não parecem uma falha, parecem um mês mau.
  exigirLeitura('qualityByMunicipality', error);

  const rows = (data ?? []) as unknown as Array<
    Omit<QualityRow, 'id' | 'name'> & { municipality_id: string; municipality_name: string }
  >;
  return rows.map(({ municipality_id, municipality_name, ...rest }) => ({
    id: municipality_id,
    name: municipality_name,
    ...rest,
  }));
}

export async function qualityBySource(fontes?: readonly string[]): Promise<QualityRow[]> {
  const supabase = requireAdminClient();
  // A vista não traz a região; recorta-se pelas fontes que a página já leu
  // com recorte.
  let query = supabase
    .from('event_quality_by_source')
    .select(
      'source_id, source_name, published, pending, in_catalogue, with_time, with_venue, with_image, with_description, with_price, with_coordinates',
    );
  if (fontes) query = query.in('source_id', lista(fontes));
  const { data, error } = await query.order('source_name');
  exigirLeitura('qualityBySource', error);

  const rows = (data ?? []) as unknown as Array<
    Omit<QualityRow, 'id' | 'name'> & { source_id: string; source_name: string }
  >;
  return rows.map(({ source_id, source_name, ...rest }) => ({
    id: source_id,
    name: source_name,
    ...rest,
  }));
}

/** Uma fotografia da qualidade, tal como a 0144 a guarda. */
export interface QualitySnapshotRow extends QualityRow {
  /** O dia em que foi tirada. */
  taken_on: string;
}

/**
 * A última fotografia da qualidade tirada até uma data, uma linha por concelho.
 *
 * A 0144 tira uma por noite. Esta leitura procura a mais recente **até** ao
 * dia pedido — não a do dia pedido — porque uma noite falhada não pode apagar
 * a memória do mês: com a fotografia de 31 em falta, a de 30 responde à mesma
 * pergunta com um dia de erro, e o dia vem no `taken_on` para quem quiser
 * saber.
 *
 * Devolve `[]` quando não há fotografia nenhuma até lá — o caso dos meses
 * anteriores à 0144, que ficam sem memória para sempre. «Não há» e «não
 * consegui saber» continuam a ser duas respostas diferentes: o erro atira.
 */
export async function qualitySnapshotAte(
  ate: string,
  recorte?: Recorte,
): Promise<QualitySnapshotRow[]> {
  const supabase = requireAdminClient();
  const { data: dia, error: erroDia } = await supabase
    .from('event_quality_snapshots')
    .select('taken_on')
    .lte('taken_on', ate)
    .order('taken_on', { ascending: false })
    .limit(1)
    .maybeSingle();
  exigirLeitura('qualitySnapshotAte (dia)', erroDia);
  const taken_on = (dia as { taken_on: string } | null)?.taken_on;
  if (!taken_on) return [];

  const { data, error } = await porConcelho(
    supabase
      .from('event_quality_snapshots')
      .select(
        'municipality_id, taken_on, published, pending, in_catalogue, with_time, with_venue, with_image, with_description, with_price, with_coordinates',
      )
      .eq('taken_on', taken_on),
    recorte,
  );
  // Uma memória vazia por erro de leitura lê-se como «não houve mudança
  // nenhuma» — a frase mais tranquilizadora que um painel de qualidade pode
  // dizer, e dita no instante em que não se consegue ler a base.
  exigirLeitura('qualitySnapshotAte', error);

  const rows = (data ?? []) as unknown as Array<
    Omit<QualitySnapshotRow, 'id' | 'name'> & { municipality_id: string }
  >;
  return rows.map(({ municipality_id, ...rest }) => ({
    id: municipality_id,
    // A fotografia não guarda o nome do concelho, e bem: o nome vive em
    // `municipalities` e um nome guardado seria um segundo nome a envelhecer.
    // Quem a lê já tem a lista dos concelhos à mão.
    name: municipality_id,
    ...rest,
  }));
}

/**
 * A região que um segredo de balanço abre, ou `null`.
 *
 * `null` para um segredo que não existe, para um revogado e para um fora de
 * prazo — os três são a mesma resposta de propósito. Distingui-los dizia a
 * quem tenta se acertou no segredo de alguém, que é metade do caminho.
 *
 * **Recebe a impressão, e nunca o segredo.** Quem o tem em claro é o pedido; o
 * que atravessa esta camada e chega à base é o sha256, e é por isso que o
 * segredo não pode aparecer num plano de consulta nem num registo.
 *
 * Esta é a única leitura do painel que **não** atira com erro. Uma porta que
 * deixa entrar porque não conseguiu ler a base é pior do que uma porta
 * fechada: o `null` faz o chamador responder 401, que é a resposta certa
 * quando não se consegue confirmar que alguém pode entrar.
 */
export async function regiaoDoSegredoDeBalanco(impressao: string): Promise<string | null> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase.rpc('regiao_do_token_de_balanco', {
    p_sha256: impressao,
  });
  if (error) {
    reportarErro('regiaoDoTokenDeBalanco', error);
    return null;
  }
  return (data as string | null) ?? null;
}

/** Um segredo de balanço tal como o painel o mostra — sem o segredo, claro. */
export interface SegredoDeBalanco {
  id: string;
  region_id: string;
  created_at: string;
  created_by: string;
  expires_on: string;
  last_used_on: string | null;
}

/**
 * Os segredos vivos, um por região no máximo.
 *
 * Nunca traz `token_sha256`: o painel não tem nada que fazer com ele, e uma
 * coluna que não é pedida é uma coluna que não pode aparecer num ecrã por
 * cima do ombro de alguém.
 */
export async function listSegredosDeBalanco(): Promise<SegredoDeBalanco[]> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from('region_report_tokens')
    .select('id, region_id, created_at, created_by, expires_on, last_used_on')
    .is('revoked_at', null)
    .order('region_id');
  // Vazio por erro dizia «nenhuma região tem porta aberta» — e quem lesse isso
  // dava um segredo novo a alguém que já tinha um, revogando o dele sem saber.
  exigirLeitura('listSegredosDeBalanco', error);
  return (data ?? []) as unknown as SegredoDeBalanco[];
}

/**
 * O que a entrada do painel diz, de uma vez: o que há para fazer na região de
 * quem entra (C4-018, a proposta `mock-painel-*` do C4).
 *
 * Abria com os interruptores das secções e com SQL; o que alguém procura de
 * manhã é outra coisa — quantas propostas estão por rever, quais acontecem
 * já, que fontes pararam, e o que a agenda tem para a semana.
 */
export interface ResumoDaEntrada {
  porRever: number;
  /** Das por rever, as que têm uma data nos próximos sete dias. */
  proximos7: number;
  aEsperaDeResposta: number;
  /** Por rever noutras regiões — só para o dono, a ver uma região só. */
  noutrasRegioes: number | null;
  fontes: SourceHealth[];
  fontesParadas: SourceHealth[];
  publicadosPorConcelho: Record<string, number>;
  /** Eventos publicados que acontecem nos próximos sete dias, por concelho. */
  semanaPorConcelho: Record<string, number>;
}

/** As datas propostas de uma submissão, venham elas de que canal vierem. */
function datasDaProposta(linha: { sessoes: unknown; datas: unknown }): string[] {
  const daLista = (lista: unknown, chave: string): string[] =>
    Array.isArray(lista)
      ? lista
          .map((item) =>
            item && typeof item === 'object' ? (item as Record<string, unknown>)[chave] : null,
          )
          .filter((data): data is string => typeof data === 'string')
      : [];
  return [...daLista(linha.sessoes, 'session_date'), ...daLista(linha.datas, 'date')];
}

export async function resumoDaEntrada(
  recorte: Recorte | undefined,
  opcoes: { contarOutrasRegioes?: boolean; concelhos?: readonly string[] } = {},
): Promise<ResumoDaEntrada> {
  const supabase = requireAdminClient();
  const hoje = todayInLisbon();
  const daquiAUmaSemana = addDays(hoje, 7);

  const [abertas, fontes, todasPorRever, semana] = await Promise.all([
    porRegiaoOuConcelho(
      supabase
        .from('submissions')
        .select('status, sessoes:payload->sessions, datas:payload->dates')
        .in('status', ['pending', 'needs_info']),
      recorte,
    ).limit(2000),
    listSourceHealth(recorte),
    opcoes.contarOutrasRegioes
      ? supabase
          .from('submissions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
      : Promise.resolve(null),
    porConcelho(
      supabase
        .from('events')
        .select('municipality_id')
        .eq('status', 'published')
        .eq('is_canonical', true)
        .lte('date_start', daquiAUmaSemana)
        .or(`date_end.gte.${hoje},and(date_end.is.null,date_start.gte.${hoje})`),
      recorte,
    ).limit(5000),
  ]);
  // Esta é a página de entrada do painel: as contagens que aqui estão são a
  // primeira coisa que alguém lê de manhã, e um zero por erro dizia «a fila
  // está limpa».
  exigirLeitura('resumoDaEntrada (fila)', abertas.error);
  exigirLeitura('resumoDaEntrada (semana)', semana.error);
  if (todasPorRever) exigirLeitura('resumoDaEntrada (outras regiões)', todasPorRever.error);

  const linhas = (abertas.data ?? []) as unknown as Array<{
    status: string;
    sessoes: unknown;
    datas: unknown;
  }>;
  const porRever = linhas.filter((linha) => linha.status === 'pending');
  const proximos7 = porRever.filter((linha) =>
    datasDaProposta(linha).some((dia) => dia >= hoje && dia <= daquiAUmaSemana),
  ).length;

  const semanaPorConcelho: Record<string, number> = {};
  for (const { municipality_id: id } of (semana.data ?? []) as Array<{ municipality_id: string }>) {
    semanaPorConcelho[id] = (semanaPorConcelho[id] ?? 0) + 1;
  }

  // Uma contagem exata por concelho, do lado da base, e só dos concelhos do
  // recorte: trazer as linhas e contar aqui cortava às mil.
  let concelhos: readonly string[];
  if (opcoes.concelhos) concelhos = opcoes.concelhos;
  else if (recorte?.concelhos) concelhos = recorte.concelhos;
  else {
    const { data, error } = await supabase.from('municipalities').select('id');
    exigirLeitura('resumoDaEntrada (concelhos)', error);
    concelhos = ((data ?? []) as Array<{ id: string }>).map((linha) => linha.id);
  }
  const publicadosPorConcelho: Record<string, number> = {};
  await Promise.all(
    concelhos.map(async (id) => {
      const { count, error } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('municipality_id', id)
        .eq('status', 'published');
      exigirLeitura(`resumoDaEntrada (${id})`, error);
      publicadosPorConcelho[id] = count ?? 0;
    }),
  );

  const fontesParadas = fontes.filter(
    (fonte) =>
      fonte.is_enabled &&
      !fonte.em_pausa &&
      (fonte.consecutive_failures > 0 || fonte.breaker_open || fonte.is_stale),
  );

  return {
    porRever: porRever.length,
    proximos7,
    aEsperaDeResposta: linhas.length - porRever.length,
    noutrasRegioes: todasPorRever
      ? Math.max(0, (todasPorRever.count ?? 0) - porRever.length)
      : null,
    fontes,
    fontesParadas,
    publicadosPorConcelho,
    semanaPorConcelho,
  };
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
  /** 0158 — o resto do que o RGPD pede sobre quem responde. */
  data_controller_nif: string | null;
  data_controller_address: string | null;
  data_controller_email: string | null;
  data_controller_dpo: string | null;
  data_controller_dpo_contact: string | null;
  /**
   * 0164 — o planeador de transportes públicos da região. Opcional no tipo
   * porque a linha vem por `select('*')`, e antes de a migração chegar a uma
   * base a coluna simplesmente não vem.
   */
  transit_planner_url?: string | null;
  /** 0167 — a cor da marca. Opcional pela mesma razão do planeador. */
  brand_color?: string;
  /** 0169 — o artigo do promotor. Opcional pela mesma razão. */
  cim_article?: string;
  expected_municipality_count: number;
  bbox_lat_min: number;
  bbox_lat_max: number;
  bbox_lon_min: number;
  bbox_lon_max: number;
  is_enabled: boolean;
  /** Se a região está atrás da barreira de senha (0157). A senha não vem aqui. */
  gate_enabled: boolean;
  /** Quantos cartazes a montra da entrada mostra (0161). Zero desliga-a. */
  destaques_alvo: number | null;
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
  // Sem regiões, o painel oferece «criar a primeira região» a quem já tem
  // três — e o seletor de região no topo fica vazio.
  exigirLeitura('listRegionsAdmin', error);
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
  // O painel de entrada procura aqui os prazos a acabar. Vazio, não há
  // prazo nenhum a acabar — e é assim que se perde uma renovação.
  exigirLeitura('listRegionLicenses', error);
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
  // Um interruptor sem estado desenha-se como desligado, e o painel passaria
  // a dizer que uma CIM desligou secções que estão ligadas.
  exigirLeitura('listSiteSections', error);
  return (data ?? []) as unknown as SiteSectionRow[];
}

/**
 * Os interruptores de todas as regiões de uma vez, para o painel de entrada
 * das regiões poder dizer «quatro de quatro» sem uma ida à base por região.
 *
 * A ficha de cada região continua a usar `listSiteSections`, que recorta: ali
 * o que se quer é o estado de uma, e um recorte na base é mais barato do que
 * trazer tudo para filtrar aqui.
 */
export async function listSiteSectionsTodas(): Promise<SiteSectionComRegiao[]> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from('site_sections')
    .select('id, region_id, is_enabled, updated_at, updated_by');
  exigirLeitura('listSiteSectionsTodas', error);
  return (data ?? []) as unknown as SiteSectionComRegiao[];
}

export interface SiteSectionComRegiao extends SiteSectionRow {
  region_id: string;
}

/**
 * Que regiões têm senha de barreira definida — e desde quando.
 *
 * **Nunca traz `password_sha256`**, pela mesma razão que a leitura dos
 * segredos do balanço nunca traz a impressão deles: o painel não tem nada que
 * fazer com o hash, e uma coluna que não é pedida é uma coluna que não pode
 * aparecer num ecrã por cima do ombro de alguém. O que o painel precisa de
 * saber é se **há** senha, para não oferecer «ligar a barreira» a quem ainda
 * não a definiu — e a base recusaria na mesma (0157).
 */
export interface RegionGateRow {
  region_id: string;
  updated_at: string;
  updated_by: string | null;
}

export async function listRegionGates(): Promise<RegionGateRow[]> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from('region_gates')
    .select('region_id, updated_at, updated_by')
    .order('region_id');
  // Vazio por erro dizia «nenhuma região tem senha», e o painel oferecia
  // definir uma a quem já tem — por cima da que está a ser usada hoje.
  exigirLeitura('listRegionGates', error);
  return (data ?? []) as unknown as RegionGateRow[];
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
export async function listEventsWithoutTime(recorte?: Recorte): Promise<EventWithoutTimeRow[]> {
  const supabase = requireAdminClient();
  const { data, error } = await porRegiao(
    supabase.from('events_without_time').select(SEM_HORA_COLUMNS),
    recorte,
  )
    .order('date_start', { ascending: true, nullsFirst: false })
    .order('id')
    .limit(SEM_HORA_MAX);
  // A lista de trabalho por fazer. Vazia por erro, diz «não falta hora a
  // nenhum evento» — e o trabalho fica por fazer sem ninguém saber que existe.
  exigirLeitura('listEventsWithoutTime', error);
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
async function idsSemHora(
  filter: Pick<EventFilter, 'municipality' | 'fonte' | 'status'>,
  recorte?: Recorte,
): Promise<string[]> {
  const supabase = requireAdminClient();
  let query = porRegiao(supabase.from('events_without_time').select('id'), recorte)
    .order('date_start', { ascending: true, nullsFirst: false })
    .order('id')
    .limit(IDS_SEM_HORA_MAX);
  if (filter.municipality) query = query.eq('municipality_id', filter.municipality);
  if (filter.fonte) query = query.eq('source_id', filter.fonte);
  // A vista já só tem `published` e `draft` — a 0118 deixou os outros de fora
  // pela razão da 0026 —, e por isso `catalogo` aqui não precisa de recorte:
  // recortá-lo seria pedir ao Postgres que confirmasse o que a vista garante.
  if (filter.status && filter.status !== 'todos' && filter.status !== 'catalogo') {
    query = query.eq('status', filter.status);
  }

  const { data, error } = await query;
  // Alimenta o filtro «falta a hora» do catálogo. A lista vazia faz o filtro
  // devolver zero eventos — indistinguível de não haver nenhum por corrigir.
  exigirLeitura('idsSemHora', error);
  return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
}

/**
 * Um cartaz na secretária de quem responde pelos pedidos.
 *
 * O que a linha precisa de dizer é o que alguém precisa de saber para decidir
 * em dez segundos: que evento é, de que fonte veio, se a cópia é nossa ou não,
 * e — quando já foi retirado — quando e por quem.
 */
export interface CartazDoPainel {
  id: string;
  slug: string;
  title: string;
  date_start: string | null;
  date_end: string | null;
  municipality_id: string;
  source_id: string | null;
  image_url: string | null;
  image_miniatura: string | null;
  image_origem: string | null;
  image_credit: string | null;
  image_guardado_em: string | null;
  image_retirado_em: string | null;
  image_retirado_por: string | null;
}

export const CARTAZES_PAGE_SIZE = 40;

const COLUNAS_DO_CARTAZ =
  'id, slug, title, date_start, date_end, municipality_id, source_id, image_url, image_miniatura, image_origem, image_credit, image_guardado_em, image_retirado_em, image_retirado_por';

export interface FiltroDeCartazes {
  /** `nossos` (há cópia), `origem` (aponta), `retirados`, ou todos. */
  estado?: string;
  q?: string;
  concelho?: string;
}

/**
 * Os cartazes do catálogo, para a secretária dos pedidos.
 *
 * **Os retirados estão sempre na lista, e não é um detalhe de arrumação.** A
 * página pública esconde-os — não há imagem nenhuma para mostrar —, e se o
 * painel os escondesse também, um cartaz retirado por engano ficava
 * irrecuperável a não ser por SQL. Quem retira tem de poder ver o que retirou.
 *
 * Por ordem de quando a cópia se fez, com os mais recentes à cabeça: quem vem
 * a esta página vem quase sempre atrás de um pedido sobre alguma coisa que
 * está no ar agora.
 */
export async function listCartazes(
  filtro: FiltroDeCartazes = {},
  limite = CARTAZES_PAGE_SIZE,
  recorte?: Recorte,
): Promise<CartazDoPainel[]> {
  const supabase = requireAdminClient();
  let query = porConcelho(
    supabase.from('events').select(COLUNAS_DO_CARTAZ).eq('is_canonical', true),
    recorte,
  );

  if (filtro.estado === 'retirados') {
    query = query.not('image_retirado_em', 'is', null);
  } else if (filtro.estado === 'nossos') {
    query = query.not('image_miniatura', 'is', null);
  } else if (filtro.estado === 'origem') {
    query = query.is('image_miniatura', null).not('image_url', 'is', null);
  } else {
    // «Todos» quer dizer todos os que têm cartaz ou tiveram um: um evento sem
    // imagem nenhuma e sem pedido nenhum não tem nada que fazer nesta página.
    query = query.or('image_url.not.is.null,image_retirado_em.not.is.null');
  }

  if (filtro.q?.trim()) query = query.ilike('title', `%${filtro.q.trim()}%`);
  if (filtro.concelho) query = query.eq('municipality_id', filtro.concelho);

  const { data, error } = await query
    .order('image_guardado_em', { ascending: false, nullsFirst: false })
    .order('date_start', { ascending: false, nullsFirst: false })
    .limit(limite);

  exigirLeitura('listCartazes', error);
  return (data ?? []) as unknown as CartazDoPainel[];
}

/** Quantos há de cada, para os atalhos no topo e para a conta do espaço. */
export async function contarCartazes(recorte?: Recorte): Promise<{
  nossos: number;
  daOrigem: number;
  retirados: number;
}> {
  const supabase = requireAdminClient();
  const contar = () =>
    porConcelho(
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_canonical', true),
      recorte,
    );
  const [nossos, daOrigem, retirados] = await Promise.all([
    contar().not('image_miniatura', 'is', null),
    contar().is('image_miniatura', null).not('image_url', 'is', null),
    contar().not('image_retirado_em', 'is', null),
  ]);

  exigirLeitura('contarCartazes', nossos.error ?? daOrigem.error ?? retirados.error);
  return {
    nossos: nossos.count ?? 0,
    daOrigem: daOrigem.count ?? 0,
    retirados: retirados.count ?? 0,
  };
}

/** As fontes e a declaração de quem pode ser copiado. Ver a migração 0162. */
export interface FonteAlojavel {
  id: string;
  name: string;
  kind: string;
  url: string;
  is_enabled: boolean;
  cartaz_alojavel: boolean;
}

export async function listFontesParaAlojamento(): Promise<FonteAlojavel[]> {
  const supabase = requireAdminClient();
  const { data, error } = await supabase
    .from('sources')
    .select('id, name, kind, url, is_enabled, cartaz_alojavel')
    .order('cartaz_alojavel', { ascending: false })
    .order('name');
  exigirLeitura('listFontesParaAlojamento', error);
  return (data ?? []) as unknown as FonteAlojavel[];
}
