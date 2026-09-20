import 'server-only';
import { reportarErro } from '../registo';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractEmailAddress, normalizeForHash } from '@coreto/core';
import { doNomeDaRegiao } from '../regiao';
import { listCategories, listMunicipalitiesDeTodas } from '../queries/events';
import { storagePath, type AcceptedAttachment } from './attachments';
import type { MunicipalityRef, VenueRef } from './resolve';

/**
 * O lado da base de dados do canal de email.
 *
 * Está separado do resto por uma razão só: tudo o que decide alguma coisa —
 * a assinatura, a quota, o que se lê de um PDF, que concelho é — vive em
 * módulos que se conseguem exercitar sem base de dados. Aqui fica o que
 * escreve, e o que escreve não decide.
 */

/** Balde privado. Nada daqui é servido ao público antes de ser aprovado. */
const INTAKE_BUCKET = 'intake';

export interface EmailSubmissionInput {
  senderEmail: string | null;
  senderName: string | null;
  subject: string;
  text: string;
  headers: Record<string, unknown>;
  ipHash: string | null;
  userAgent: string | null;
}

/**
 * Escreve a submissão **antes** de se tentar seja o que for.
 *
 * É o ponto central de todo o desenho: a partir daqui, uma extração que
 * rebente, um anexo que não se leia ou um serviço que esteja em baixo custam
 * um campo por preencher, e não um email perdido. Uma coletividade que manda
 * a programação do mês não a manda outra vez.
 */
/**
 * Já recebemos este email?
 *
 * O webhook assina o corpo, e um corpo assinado continua assinado para
 * sempre: quem o capturar pode voltar a entregá-lo, e cada entrega abria uma
 * submissão nova, gastava uma leitura automática e uma linha da quota do
 * remetente. O `messageId` do email é a identidade que o próprio remetente
 * lhe deu; um segundo pedido com o mesmo devolve a primeira submissão em vez
 * de fazer outra. A leitura falha para «não existe», e nunca para «existe»:
 * numa dúvida, aceita-se o email — perder um evento custa mais do que uma
 * repetição que a moderação vê.
 */
export async function findEmailSubmissionByMessageId(
  supabase: SupabaseClient,
  messageId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('id')
    .eq('channel', 'email')
    .eq('raw_headers->>messageId', messageId)
    .limit(1)
    .maybeSingle();
  if (error) {
    reportarErro('findEmailSubmissionByMessageId', error);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

export async function createEmailSubmission(
  supabase: SupabaseClient,
  input: EmailSubmissionInput,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      channel: 'email',
      status: 'pending',
      payload: {},
      raw_subject: input.subject,
      raw_text: input.text,
      raw_headers: input.headers,
      sender_email: input.senderEmail,
      sender_name: input.senderName,
      ip_hash: input.ipHash,
      user_agent: input.userAgent,
      extraction_status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    reportarErro('createEmailSubmission', error);
    return null;
  }
  return (data as { id: string }).id;
}

/** O que fica por atualizar depois de se tentar ler o email. */
export interface SubmissionPatch {
  payload?: Record<string, unknown>;
  raw_headers?: Record<string, unknown>;
  municipality_id?: string | null;
  /** A região a quem o email foi dirigido — a pista de triagem da 0101. */
  region_id?: string | null;
  venue_id?: string | null;
  fingerprint?: string | null;
  confidence?: number | null;
  /*
   * `unverified` é o quinto (0131): o modelo respondeu, a proposta está lá, e
   * há campos que o texto de origem não confirma. Nem `ok` nem `failed` — ver
   * `juiz.ts`.
   */
  extraction_status?: 'pending' | 'ok' | 'failed' | 'skipped' | 'unverified';
  extraction_error?: string | null;
  extraction_model?: string | null;
  extraction_cost_micros?: number;
  extraction_attempts?: number;
  next_attempt_at?: string | null;
}

export async function updateSubmission(
  supabase: SupabaseClient,
  id: string,
  patch: SubmissionPatch,
): Promise<void> {
  const { error } = await supabase.from('submissions').update(patch).eq('id', id);
  // A submissão já está guardada. Falhar a atualização deixa-a em `pending`
  // na fila, que é onde uma pessoa a vai encontrar de qualquer maneira.
  if (error) reportarErro('updateSubmission', error);
}

export interface StoredAttachment {
  id: string;
  filename: string;
  kind: AcceptedAttachment['kind'];
  bytes: Uint8Array;
}

export interface AttachmentStoreResult {
  stored: StoredAttachment[];
  /** Anexos que não se conseguiram guardar, para ficarem escritos na submissão. */
  failed: Array<{ filename: string; reason: string }>;
}

/**
 * Guarda os anexos no balde privado e regista-os.
 *
 * A linha só é escrita depois de o ficheiro estar no balde: uma linha a
 * apontar para um ficheiro que não existe faz a moderação abrir um endereço
 * assinado para o vazio, e ninguém percebe porquê.
 */
export async function saveAttachments(
  supabase: SupabaseClient,
  submissionId: string,
  accepted: ReadonlyArray<AcceptedAttachment>,
): Promise<AttachmentStoreResult> {
  const stored: StoredAttachment[] = [];
  const failed: Array<{ filename: string; reason: string }> = [];

  for (const [index, attachment] of accepted.entries()) {
    const path = storagePath(submissionId, index, attachment.filename);

    const upload = await supabase.storage
      .from(INTAKE_BUCKET)
      .upload(path, attachment.bytes, { contentType: attachment.mimeType, upsert: false });

    if (upload.error) {
      reportarErro('saveAttachments/upload', upload.error);
      failed.push({ filename: attachment.filename, reason: 'não foi possível guardar o ficheiro' });
      continue;
    }

    const { data, error } = await supabase
      .from('submission_attachments')
      .insert({
        submission_id: submissionId,
        kind: attachment.kind,
        storage_path: path,
        filename: attachment.filename,
        mime_type: attachment.mimeType,
        size_bytes: attachment.bytes.length,
        checksum: createHash('sha256').update(attachment.bytes).digest('hex'),
        ocr_status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      reportarErro('saveAttachments/insert', error);
      failed.push({ filename: attachment.filename, reason: 'não foi possível registar o anexo' });
      continue;
    }

    stored.push({
      id: (data as { id: string }).id,
      filename: attachment.filename,
      kind: attachment.kind,
      bytes: attachment.bytes,
    });
  }

  return { stored, failed };
}

export async function setAttachmentOcr(
  supabase: SupabaseClient,
  attachmentId: string,
  outcome: { status: 'ok'; text: string } | { status: 'skipped'; reason: string },
): Promise<void> {
  const { error } = await supabase
    .from('submission_attachments')
    .update(
      outcome.status === 'ok'
        ? { ocr_status: 'ok', ocr_text: outcome.text }
        : // O motivo fica no próprio campo de texto: é o que a moderação lê ao
          // abrir o anexo, e a alternativa era um `skipped` mudo.
          { ocr_status: 'skipped', ocr_text: outcome.reason },
    )
    .eq('id', attachmentId);

  if (error) reportarErro('setAttachmentOcr', error);
}

export interface IntakeLookups {
  /** Todos os concelhos, cada um com a sua região — o recorte é de quem usa. */
  municipalities: Array<MunicipalityRef & { region_id: string }>;
  categories: Array<{ slug: string; name: string }>;
  /** Alias normalizado → espaço. Os que valem em toda a região. */
  venueAliases: Map<string, VenueRef>;
  /** Concelho → (alias normalizado → espaço). Os presos a um concelho só. */
  venueAliasesByMunicipality: Map<string, Map<string, VenueRef>>;
}

/**
 * As listas fechadas com que a extração e a resolução trabalham.
 *
 * Os aliases juntam duas origens: a tabela `venue_aliases`, que guarda as
 * grafias com que as fontes escrevem cada espaço, e o nome canónico de cada
 * espaço — que não está lá, e é a grafia que uma pessoa escreve num email.
 */
export async function loadLookups(supabase: SupabaseClient): Promise<IntakeLookups> {
  const [municipalities, categories, venues, aliases] = await Promise.all([
    listMunicipalitiesDeTodas(),
    listCategories(),
    supabase.from('venues').select('id, name, municipality_id').neq('status', 'closed'),
    // `venue_aliases` não tem policy de leitura pública, de propósito: só a
    // chave de serviço lá chega.
    supabase.from('venue_aliases').select('alias, venue_id, municipality_id'),
  ]);

  const venueRows = (venues.data ?? []) as Array<{
    id: string;
    name: string;
    municipality_id: string;
  }>;
  const byId = new Map<string, VenueRef>(
    venueRows.map((venue) => [venue.id, { id: venue.id, municipalityId: venue.municipality_id }]),
  );

  const venueAliases = new Map<string, VenueRef>();
  for (const venue of venueRows) {
    const ref = byId.get(venue.id);
    if (ref) venueAliases.set(normalizeForHash(venue.name), ref);
  }

  // Os presos a um concelho ficam de fora do mapa regional, e num mapa por
  // concelho. Metê-los no regional fazia um alias de Alcanena valer em
  // Abrantes — que é o erro que a coluna de concelho existe para não deixar
  // acontecer.
  const venueAliasesByMunicipality = new Map<string, Map<string, VenueRef>>();
  const aliasRows = (aliases.data ?? []) as Array<{
    alias: string;
    venue_id: string;
    municipality_id: string | null;
  }>;
  for (const row of aliasRows) {
    const ref = byId.get(row.venue_id);
    if (!ref) continue;
    if (!row.municipality_id) {
      venueAliases.set(row.alias, ref);
      continue;
    }
    let doConcelho = venueAliasesByMunicipality.get(row.municipality_id);
    if (!doConcelho) {
      doConcelho = new Map<string, VenueRef>();
      venueAliasesByMunicipality.set(row.municipality_id, doConcelho);
    }
    doConcelho.set(row.alias, ref);
  }

  return {
    municipalities: municipalities.map((municipality) => ({
      id: municipality.id,
      name: municipality.name,
      region_id: municipality.region_id,
    })),
    categories: categories.map((category) => ({ slug: category.slug, name: category.name })),
    venueAliases,
    venueAliasesByMunicipality,
  };
}

/** O que o intake precisa de saber de uma região: o id e a frase. */
export interface RegiaoDoIntake {
  id: string;
  /** «do Médio Tejo» — para o prompt da extração falar da região certa. */
  doNome: string;
}

/**
 * A região a quem um email foi dirigido, pelo endereço de destino.
 *
 * Cada região tem o seu email (`regions.contact_email`), e o reencaminhamento
 * entrega-nos o `to` original — é a única pista de região que um email traz
 * antes de alguém escolher um concelho. Um destino que não bata com nenhuma
 * região devolve nulo, e o resto do funil segue como sempre: a região
 * definitiva é a do concelho aprovado na moderação.
 */
export async function regiaoDoDestinatario(
  supabase: SupabaseClient,
  to: string | undefined,
): Promise<RegiaoDoIntake | null> {
  if (!to) return null;
  const endereco = extractEmailAddress(to)?.toLowerCase();
  if (!endereco) return null;

  const { data, error } = await supabase.from('regions').select('id, name, article, contact_email');
  if (error) {
    reportarErro('regiaoDoDestinatario', error);
    return null;
  }

  const linha = (
    (data ?? []) as Array<{
      id: string;
      name: string;
      article: string;
      contact_email: string;
    }>
  ).find((regiao) => regiao.contact_email.toLowerCase() === endereco);

  return linha ? { id: linha.id, doNome: doNomeDaRegiao(linha.article, linha.name) } : null;
}
