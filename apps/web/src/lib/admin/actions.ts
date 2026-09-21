'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { reportarErro } from '../registo';
import { BALDE_DOS_CARTAZES, normalizeForHash, pastaDoCartaz } from '@coreto/core';
import { z } from 'zod';
import { requireAdmin } from './auth';
import {
  CAMPOS_DA_REGIAO,
  changedFields,
  comAviso,
  destinoDoPainel,
  LOTE_MAX,
  readEvent,
  readSessions,
} from './fields';
import { requireAdminClient } from '../supabase/server';
import { SECCOES_OPCIONAIS } from '../navegacao';
import { REGIAO_PRINCIPAL } from '../regiao-host';
import { CACHE_TAGS } from '../queries/events';
import { gerarSegredo, impressaoDoSegredo } from '../balanco/token';
import { sha256Hex } from '../token-assinado';

/**
 * As ações de moderação.
 *
 * Nenhuma escreve em `events` diretamente: todas passam pelas funções SQL
 * (`approve_submission`, `reject_submission`, `merge_events`), que são o único
 * caminho de escrita e as que registam a auditoria. Uma escrita a partir daqui
 * seria uma ação sem rasto, e o registo de quem fez o quê é metade do que
 * torna esta fila confiável.
 */

function invalidate(municipalityId: unknown): void {
  const tags: string[] = [CACHE_TAGS.events, CACHE_TAGS.venues, CACHE_TAGS.taxonomy];
  if (typeof municipalityId === 'string' && municipalityId) {
    tags.push(CACHE_TAGS.municipality(municipalityId));
  }
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}

export async function approveSubmission(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();

  const submissionId = String(formData.get('submission_id') ?? '');
  if (!submissionId) throw new Error('submissão em falta');

  const event = readEvent(formData);
  const sessions = readSessions(formData);
  const first = sessions[0];
  if (first) event.date_start = first.session_date;

  const { data: eventId, error } = await supabase.rpc('approve_submission', {
    p_submission_id: submissionId,
    p_actor: actor,
    p_event: event,
    p_sessions: sessions,
  });
  if (error) throw new Error(error.message);

  // Bloqueia o que o editor mudou face ao que a fonte propunha.
  const proposed = JSON.parse(String(formData.get('proposed') ?? '{}')) as Record<string, unknown>;
  const locked = changedFields(proposed, event);
  if (locked.length > 0 && typeof eventId === 'string') {
    const { error: lockError } = await supabase.rpc('lock_event_fields', {
      p_event_id: eventId,
      p_fields: locked,
      p_actor: actor,
      p_note: 'corrigido na moderação',
    });
    // Um bloqueio que falha não desfaz a publicação — regista-se e segue.
    if (lockError) reportarErro('lock_event_fields', lockError);
  }

  invalidate(event.municipality_id);
  redirect('/admin/fila');
}

const ESTADOS_PERMITIDOS = new Set(['published', 'draft', 'hidden', 'cancelled', 'archived']);

/**
 * Publicar, despublicar e arrumar, em lote, a partir de `/admin/eventos`.
 *
 * A escrita é uma chamada só, mas quem escreve é `set_event_status` — a
 * aplicação continua a não tocar em `events` — e é ela que põe **uma linha de
 * auditoria por evento**, com o antes e o depois de cada um. Um lote registado
 * como um acontecimento só pouparia linhas e tornaria irreversível o que assim
 * se desfaz um a um.
 */
export async function bulkSetEventStatus(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();

  const ids = formData.getAll('ids').map(String).filter(Boolean);
  const status = String(formData.get('status') ?? '');
  const voltarPara = destinoDoPainel(String(formData.get('voltar') ?? '/admin/eventos'));

  if (ids.length === 0) redirect(comAviso(voltarPara, 'Não escolheste nenhum evento.'));
  if (!ESTADOS_PERMITIDOS.has(status)) redirect(comAviso(voltarPara, 'Estado desconhecido.'));
  if (ids.length > LOTE_MAX) {
    redirect(comAviso(voltarPara, `No máximo ${LOTE_MAX} eventos de cada vez.`));
  }

  const { data, error } = await supabase.rpc('set_event_status', {
    p_ids: ids,
    p_status: status,
    p_actor: actor,
  });
  if (error) redirect(comAviso(voltarPara, error.message));

  // Sem saber de que concelhos eram, invalida-se o que é comum a todos. É o
  // preço de não ir buscar as linhas outra vez só para afinar a etiqueta.
  invalidate(null);

  const n = typeof data === 'number' ? data : 0;
  redirect(
    comAviso(
      voltarPara,
      n === 0
        ? 'Nada mudou — já estavam todos nesse estado.'
        : `${n} ${n === 1 ? 'evento' : 'eventos'} em «${status}».`,
    ),
  );
}

export async function rejectSubmission(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();

  const status = String(formData.get('status') ?? 'rejected');
  const duplicateOf = String(formData.get('duplicate_of') ?? '');

  const { error } = await supabase.rpc('reject_submission', {
    p_submission_id: String(formData.get('submission_id') ?? ''),
    p_actor: actor,
    p_status: status,
    p_notes: String(formData.get('notes') ?? '') || null,
    p_duplicate_of: duplicateOf || null,
  });
  if (error) throw new Error(error.message);

  redirect('/admin/fila');
}

export async function mergeEvents(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();

  const { error } = await supabase.rpc('merge_events', {
    p_canonical_id: String(formData.get('canonical_id') ?? ''),
    p_duplicate_id: String(formData.get('duplicate_id') ?? ''),
    p_actor: actor,
  });
  if (error) throw new Error(error.message);

  invalidate(formData.get('municipality_id'));
  redirect('/admin/fila');
}

/**
 * Ligar e desligar uma secção do sítio.
 *
 * Como todas as outras, escreve por uma função da base — `set_site_section` —,
 * que é quem deixa a linha de auditoria. Um interruptor que muda a cara do
 * sítio sem dizer quem foi seria o único do painel a fazê-lo.
 *
 * O identificador é validado aqui contra a mesma lista que a navegação usa,
 * antes de chegar à base. A restrição da tabela também o recusaria; recusá-lo
 * antes dá um aviso em português em vez de um erro de Postgres.
 */
/**
 * Descartar a cache e servir já o que a base tem.
 *
 * As consultas públicas guardam-se por uma hora, e quem escreve na base por
 * fora do sítio — uma migração de dados, uma correção feita à mão no Supabase —
 * fica a olhar para a página velha sem perceber porquê. Aconteceu no dia em que
 * o levantamento dos coretos passou de dez para vinte e sete espaços: a base
 * tinha os vinte e sete, a página mostrava dez, e nada estava avariado.
 *
 * Havia dois caminhos e nenhum servia: esperar pela hora, ou o `curl` ao
 * `/api/revalidate` com o segredo à mão. O segredo existe para o disparador
 * externo — a recolha noturna chama esse endereço quando acaba — e pedir a uma
 * pessoa que o vá buscar para ver o próprio sítio actualizado é fazê-la pagar
 * por uma decisão de arquitetura que não é dela.
 *
 * Invalida tudo o que é público de uma vez, incluindo as secções: quem carrega
 * aqui quer o sítio inteiro a dizer a verdade, e a diferença entre invalidar
 * quatro etiquetas ou seis é uma reconstrução que ninguém nota. Não é destrutivo
 * — não apaga nada, só obriga a próxima visita a ir buscar à base o que a base
 * já diz.
 */
export async function actualizarSitio(): Promise<void> {
  await requireAdmin();

  for (const tag of [
    CACHE_TAGS.events,
    CACHE_TAGS.venues,
    CACHE_TAGS.coretos,
    CACHE_TAGS.taxonomy,
    CACHE_TAGS.sources,
    CACHE_TAGS.sections,
    CACHE_TAGS.regions,
    CACHE_TAGS.destaques,
  ]) {
    revalidateTag(tag, { expire: 0 });
  }

  redirect(comAviso('/admin', 'O sítio passou a servir o que a base tem agora.'));
}

export async function alternarSeccao(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();

  const seccao = String(formData.get('seccao') ?? '');
  const ligar = String(formData.get('ligar') ?? '') === '1';
  // O interruptor vive em dois sítios: no painel de entrada (a região
  // principal) e na página de cada região. O caminho de volta acompanha, e é
  // derivado — nunca lido do formulário, que um caminho vindo de fora é um
  // redirect aberto à espera de acontecer.
  const regiao = String(formData.get('regiao') ?? REGIAO_PRINCIPAL);
  const voltarPara =
    regiao === REGIAO_PRINCIPAL ? '/admin' : `/admin/regioes/${encodeURIComponent(regiao)}`;

  if (!(SECCOES_OPCIONAIS as readonly string[]).includes(seccao)) {
    redirect(comAviso(voltarPara, 'Secção desconhecida.'));
  }

  const { data, error } = await supabase.rpc('set_site_section', {
    p_id: seccao,
    p_enabled: ligar,
    p_actor: actor,
    p_region: regiao,
  });
  if (error) redirect(comAviso(voltarPara, error.message));

  /*
   * Esta etiqueta é lida pelo layout de raiz, e o layout de raiz entra em
   * todas as páginas: invalidá-la refaz o sítio inteiro. É o preço certo para
   * uma ação rara e deliberada — o contrário era o cabeçalho continuar a
   * mostrar durante uma hora uma secção que já responde 404.
   */
  revalidateTag(CACHE_TAGS.sections, { expire: 0 });

  redirect(
    comAviso(
      voltarPara,
      data === true
        ? `A secção passou a estar ${ligar ? 'ligada' : 'desligada'}.`
        : 'Nada mudou — já estava assim.',
    ),
  );
}

/**
 * A montra da entrada: fixar, largar, mover, e dizer quantos cabem.
 *
 * As quatro ações escrevem em `region_highlights` e em `regions`, e nenhuma
 * passa por uma função SQL — ao contrário da moderação, que tem de deixar
 * rasto em `admin_actions` porque decide o que o público vê. Um destaque é
 * ordem de montra: muda-se, desfaz-se, e quem o fixou fica escrito na própria
 * linha (`fixado_por`), que é o rasto que esta decisão pede.
 *
 * Todas invalidam `destaques`, e só essa: a montra é a única coisa que muda.
 */
const CAMINHO_DOS_DESTAQUES = (regiao: string) =>
  `/admin/regioes/${encodeURIComponent(regiao)}/destaques`;

/** Quantos destaques uma região aceita ter fixados de uma vez. */
const DESTAQUES_MAX = 24;

function regiaoDoFormulario(formData: FormData): string {
  const regiao = String(formData.get('regiao') ?? '').trim();
  return regiao || REGIAO_PRINCIPAL;
}

export async function fixarDestaque(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();
  const regiao = regiaoDoFormulario(formData);
  const voltarPara = CAMINHO_DOS_DESTAQUES(regiao);
  const evento = String(formData.get('evento') ?? '').trim();
  if (!evento) redirect(comAviso(voltarPara, 'Falta dizer qual é o evento.'));

  /*
   * A posição nova é a seguir à última, e lê-se antes de escrever.
   *
   * Duas pessoas a fixar ao mesmo tempo podiam pedir a mesma posição; a
   * restrição `region_highlights_posicao_unica` recusa a segunda, e o aviso
   * diz para repetir. É a resposta certa para uma colisão que acontece uma
   * vez em muitos anos num painel com um utilizador — uma sequência por
   * região seria mais máquina do que o problema merece.
   */
  const { data: ultima, error: erroDaLeitura } = await supabase
    .from('region_highlights')
    .select('posicao')
    .eq('region_id', regiao)
    .order('posicao', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (erroDaLeitura) redirect(comAviso(voltarPara, erroDaLeitura.message));

  const seguinte = (ultima?.posicao ?? 0) + 1;
  if (seguinte > DESTAQUES_MAX) {
    redirect(comAviso(voltarPara, `A montra não leva mais de ${DESTAQUES_MAX} fixados.`));
  }

  const { error } = await supabase
    .from('region_highlights')
    .insert({ region_id: regiao, event_id: evento, posicao: seguinte, fixado_por: actor });
  if (error) {
    redirect(
      comAviso(voltarPara, error.code === '23505' ? 'Esse evento já está fixado.' : error.message),
    );
  }

  revalidateTag(CACHE_TAGS.destaques, { expire: 0 });
  redirect(comAviso(voltarPara, 'Fixado na montra.'));
}

export async function largarDestaque(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = requireAdminClient();
  const regiao = regiaoDoFormulario(formData);
  const voltarPara = CAMINHO_DOS_DESTAQUES(regiao);
  const evento = String(formData.get('evento') ?? '').trim();
  if (!evento) redirect(comAviso(voltarPara, 'Falta dizer qual é o evento.'));

  const { error } = await supabase
    .from('region_highlights')
    .delete()
    .eq('region_id', regiao)
    .eq('event_id', evento);
  if (error) redirect(comAviso(voltarPara, error.message));

  /*
   * Não se renumera o que ficou, de propósito. As posições são uma ordem e
   * não uma contagem: com 1, 2 e 4 a montra lê-se na mesma ordem, e uma
   * renumeração é três escritas a mais para arrumar um número que ninguém vê.
   */
  revalidateTag(CACHE_TAGS.destaques, { expire: 0 });
  redirect(comAviso(voltarPara, 'Largado da montra.'));
}

export async function moverDestaque(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = requireAdminClient();
  const regiao = regiaoDoFormulario(formData);
  const voltarPara = CAMINHO_DOS_DESTAQUES(regiao);
  const evento = String(formData.get('evento') ?? '').trim();
  const sentido = String(formData.get('sentido') ?? '');
  if (!evento || (sentido !== 'cima' && sentido !== 'baixo')) {
    redirect(comAviso(voltarPara, 'Movimento desconhecido.'));
  }

  const { data: linhas, error: erroDaLeitura } = await supabase
    .from('region_highlights')
    .select('event_id, posicao')
    .eq('region_id', regiao)
    .order('posicao', { ascending: true });
  if (erroDaLeitura) redirect(comAviso(voltarPara, erroDaLeitura.message));

  const lista = (linhas ?? []) as Array<{ event_id: string; posicao: number }>;
  const onde = lista.findIndex((linha) => linha.event_id === evento);
  const vizinho = sentido === 'cima' ? onde - 1 : onde + 1;
  if (onde < 0 || vizinho < 0 || vizinho >= lista.length) {
    redirect(comAviso(voltarPara, 'Já está no fim dessa ponta.'));
  }

  /*
   * Trocar duas posições são duas escritas, e a restrição de unicidade
   * recusaria a primeira a meio do caminho. O terceiro valor livre é o
   * estacionamento: sai um, entra o outro, volta o primeiro. Três escritas em
   * vez de duas, e nenhuma delas inválida em nenhum instante — que é o que se
   * pede a uma tabela com uma restrição a sério.
   */
  const daqui = lista[onde] as { event_id: string; posicao: number };
  const dali = lista[vizinho] as { event_id: string; posicao: number };
  const estacionamento = Math.max(...lista.map((linha) => linha.posicao)) + 1;

  const mover = async (eventoId: string, posicao: number) =>
    supabase
      .from('region_highlights')
      .update({ posicao })
      .eq('region_id', regiao)
      .eq('event_id', eventoId);

  for (const passo of [
    () => mover(daqui.event_id, estacionamento),
    () => mover(dali.event_id, daqui.posicao),
    () => mover(daqui.event_id, dali.posicao),
  ]) {
    const { error } = await passo();
    if (error) redirect(comAviso(voltarPara, error.message));
  }

  revalidateTag(CACHE_TAGS.destaques, { expire: 0 });
  redirect(comAviso(voltarPara, 'Ordem mudada.'));
}

export async function definirAlvoDeDestaques(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = requireAdminClient();
  const regiao = regiaoDoFormulario(formData);
  const voltarPara = CAMINHO_DOS_DESTAQUES(regiao);

  const alvo = z.coerce.number().int().min(0).max(DESTAQUES_MAX).safeParse(formData.get('alvo'));
  if (!alvo.success) {
    redirect(comAviso(voltarPara, `O número tem de estar entre 0 e ${DESTAQUES_MAX}.`));
  }

  const { error } = await supabase
    .from('regions')
    .update({ destaques_alvo: alvo.data })
    .eq('id', regiao);
  if (error) redirect(comAviso(voltarPara, error.message));

  // A entrada lê o alvo da linha da região, que entra pela etiqueta das
  // regiões; a montra lê-se pela dos destaques. Mudam as duas.
  revalidateTag(CACHE_TAGS.regions, { expire: 0 });
  revalidateTag(CACHE_TAGS.destaques, { expire: 0 });
  redirect(
    comAviso(
      voltarPara,
      alvo.data === 0 ? 'A montra da entrada fica desligada.' : `A montra passa a ${alvo.data}.`,
    ),
  );
}

export async function atualizarRegiao(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();

  const id = String(formData.get('id') ?? '');
  const voltarPara = `/admin/regioes/${encodeURIComponent(id)}`;
  if (!id) redirect(comAviso('/admin/regioes', 'Região em falta.'));

  /*
   * O patch leva TODOS os campos do formulário, não só os mudados: é a função
   * SQL que compara com a linha e só regista o que mudou de facto — comparar
   * aqui era ter duas verdades. Os tipos convertem-se antes de seguir, porque
   * um formulário só sabe falar em texto.
   */
  const patch: Record<string, unknown> = {};
  for (const [campo, tipo] of Object.entries(CAMPOS_DA_REGIAO)) {
    const bruto = formData.get(campo);
    if (bruto === null) continue;
    const texto = String(bruto).trim();
    if (tipo === 'numero' || tipo === 'inteiro') {
      if (texto === '') {
        patch[campo] = null;
      } else {
        const numero = Number.parseInt(texto, 10);
        if (!Number.isFinite(numero) || String(numero) !== texto) {
          redirect(comAviso(voltarPara, `O campo ${campo} tem de ser um número inteiro.`));
        }
        patch[campo] = numero;
      }
    } else if (tipo === 'anulavel') {
      patch[campo] = texto === '' ? null : texto;
    } else {
      patch[campo] = texto;
    }
  }
  // `sort_order` é obrigatório na base; em branco não segue como nulo.
  if (patch.sort_order === null) {
    redirect(comAviso(voltarPara, 'A ordem tem de ser um número inteiro.'));
  }
  // A caixa «região ligada» só viaja quando desmarcada não viaja nada — é o
  // feitio dos checkboxes; o campo escondido `is_enabled_presente` diz que o
  // formulário a trazia.
  if (formData.get('is_enabled_presente') !== null) {
    patch.is_enabled = formData.get('is_enabled') !== null;
  }
  /*
   * A região principal do deployment não se desliga. É dela a identidade que o
   * deployment veste — os canónicos, os feeds, o sitemap, o painel — e é ela
   * que um build sem base de dados pré-gera; com a linha escondida pela RLS o
   * sítio inteiro caía no esqueleto neutro de recurso, sem nome, sem logótipos
   * e sem aviso nenhum. Quando a escotilha dos anfitriões desconhecidos está
   * aberta (`REGIAO_DE_OMISSAO` no ambiente), é também a região que eles veem,
   * o que só agrava a queda. A base não pode guardar esta regra, porque quem é
   * a região principal é configuração do deployment; guarda-a quem a conhece.
   * O dia em que uma região destas tiver de sair do ar começa por passar o
   * papel a outra região, não por este interruptor.
   */
  if (id === REGIAO_PRINCIPAL && patch.is_enabled === false) {
    redirect(
      comAviso(
        voltarPara,
        'A região principal do deployment não se desliga — é dela a identidade que o ' +
          'sítio veste quando não há domínio que diga outra coisa. Para a tirar do ar, ' +
          'o deployment tem primeiro de passar o papel a outra região.',
      ),
    );
  }

  const { data, error } = await supabase.rpc('update_region', {
    p_id: id,
    p_patch: patch,
    p_actor: actor,
  });
  if (error) redirect(comAviso(voltarPara, error.message));

  // A identidade da região entra em todas as páginas do domínio dela — a
  // etiqueta refaz tudo, que é o preço certo de uma edição rara.
  revalidateTag(CACHE_TAGS.regions, { expire: 0 });

  redirect(
    comAviso(
      voltarPara,
      data === true ? 'Região atualizada.' : 'Nada mudou — o formulário trazia o que lá estava.',
    ),
  );
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Registar uma licença de região — insert-only, como a função da base.
 *
 * Corrigir é acrescentar uma linha nova com nota; por isso não há aqui nem
 * editar nem apagar. Expirar não desliga nada: o painel avisa e o corte é o
 * interruptor da região, um gesto humano à parte.
 */
export async function registarLicenca(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();

  const regiao = String(formData.get('regiao') ?? '');
  const voltarPara = `/admin/regioes/${encodeURIComponent(regiao)}`;
  if (!regiao) redirect(comAviso('/admin/regioes', 'Região em falta.'));

  const inicio = String(formData.get('starts_on') ?? '').trim();
  const fim = String(formData.get('ends_on') ?? '').trim();
  const tipo = String(formData.get('kind') ?? '').trim();

  if (!DATA_ISO.test(inicio)) redirect(comAviso(voltarPara, 'A data de início não é uma data.'));
  if (fim !== '' && !DATA_ISO.test(fim)) {
    redirect(comAviso(voltarPara, 'A data de fim não é uma data.'));
  }
  if (!tipo) {
    redirect(
      comAviso(voltarPara, 'A licença precisa de um tipo — «contrato», «piloto», o que for.'),
    );
  }

  const { error } = await supabase.rpc('add_region_license', {
    p_region_id: regiao,
    p_starts_on: inicio,
    p_ends_on: fim === '' ? null : fim,
    p_kind: tipo,
    p_notes: String(formData.get('notes') ?? '').trim() || null,
    p_actor: actor,
  });
  if (error) redirect(comAviso(voltarPara, error.message));

  // Nada de público muda: as licenças são só do painel, sem cache a invalidar.
  redirect(comAviso(voltarPara, 'Licença registada.'));
}

/**
 * Cria ou roda o segredo de leitura de uma região, e di-lo **uma vez**.
 *
 * O segredo em claro existe aqui e mais em lado nenhum: vai para a base o
 * sha256, e volta para o painel o segredo, pela barra de endereços, dentro
 * do aviso. É o único sítio em que ele aparece — recarregar a página perde-o,
 * e é por isso que o aviso o diz.
 *
 * **Pela barra de endereços e não numa sessão.** É o mecanismo que este painel
 * já usa para todos os avisos (`comAviso`), e a alternativa — guardá-lo do
 * lado do servidor até alguém o ler — era criar um segundo sítio onde o
 * segredo vive.
 *
 * Criar quando já há um **revoga o anterior**: a 0151 fá-lo na mesma
 * instrução, e o anterior deixa de abrir no pedido seguinte.
 */
export async function criarSegredoDeBalanco(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();
  const regiao = String(formData.get('region_id') ?? '').trim();
  const voltarPara = regiao ? `/admin/regioes/${regiao}` : '/admin/regioes';
  if (!regiao) redirect(comAviso('/admin/regioes', 'Região em falta.'));

  const dias = Number(String(formData.get('dias') ?? '180').trim());
  if (!Number.isInteger(dias) || dias < 1 || dias > 1095) {
    // Três anos de tecto. Um segredo com prazo maior do que o contrato que o
    // justifica é um segredo que ninguém roda.
    redirect(comAviso(voltarPara, 'O prazo tem de ser entre 1 e 1095 dias.'));
  }

  const segredo = gerarSegredo();
  const impressao = impressaoDoSegredo(segredo);
  if (!impressao) redirect(comAviso(voltarPara, 'Não consegui gerar um segredo.'));

  const { error } = await supabase.rpc('criar_token_de_balanco', {
    p_region: regiao,
    p_actor: actor,
    p_sha256: impressao,
    p_dias: dias,
  });
  if (error) redirect(comAviso(voltarPara, error.message));

  redirect(`${voltarPara}?segredo=${encodeURIComponent(segredo)}`);
}

/** Fecha a porta de uma região. O que lá estava deixa de abrir no pedido seguinte. */
export async function revogarSegredosDeBalanco(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();
  const regiao = String(formData.get('region_id') ?? '').trim();
  const voltarPara = regiao ? `/admin/regioes/${regiao}` : '/admin/regioes';
  if (!regiao) redirect(comAviso('/admin/regioes', 'Região em falta.'));

  const { data, error } = await supabase.rpc('revogar_tokens_de_balanco', {
    p_region: regiao,
    p_actor: actor,
  });
  if (error) redirect(comAviso(voltarPara, error.message));

  const n = Number(data ?? 0);
  redirect(
    comAviso(
      voltarPara,
      n > 0 ? 'A porta do balanço ficou fechada.' : 'Não havia porta aberta para fechar.',
    ),
  );
}

/**
 * O comprimento de uma senha de barreira.
 *
 * Oito à mínima, e não é arbitrário: com dez tentativas por quarto de hora e
 * por endereço, o que trava um guião é o espaço de procura e o balde, não a
 * força de cada tentativa — e uma senha que se diz ao telefone tem de caber
 * numa frase. Duzentos ao máximo só para o formulário não aceitar um livro.
 */
const SENHA_MINIMA = 8;
const SENHA_MAXIMA = 200;

/**
 * Liga, desliga ou troca a senha da barreira de uma região (0157).
 *
 * **A senha em claro morre aqui.** O que segue para a base é o sha256, feito
 * neste processo, e a função `definir_barreira_da_regiao` nem sequer tem um
 * parâmetro onde uma senha caiba. A auditoria fica com o que aconteceu e com
 * nenhum dos dois.
 *
 * A senha em branco não é «apagar a senha»: é «não mexer na que lá está».
 * Quem quer só desligar a barreira desmarca a caixa e grava, e a senha fica —
 * a região volta a fechar-se com a mesma no dia seguinte, sem ter de a
 * combinar outra vez com quem já a tem.
 */
export async function definirBarreira(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();

  const regiao = String(formData.get('region_id') ?? '').trim();
  const voltarPara = regiao ? `/admin/regioes/${encodeURIComponent(regiao)}` : '/admin/regioes';
  if (!regiao) redirect(comAviso('/admin/regioes', 'Região em falta.'));

  const ligada = formData.get('ligada') !== null;
  /*
   * Apara-se aqui e apara-se na entrada, e é de propósito que são os dois: uma
   * senha copiada de um email vem quase sempre com um espaço atrás, e os dois
   * lados a aparar fazem com que isso simplesmente não seja um problema. O que
   * se perde é poder ter uma senha que começa por espaço, que ninguém quer
   * dizer ao telefone.
   */
  const senha = String(formData.get('senha') ?? '').trim();
  if (senha !== '' && (senha.length < SENHA_MINIMA || senha.length > SENHA_MAXIMA)) {
    redirect(
      comAviso(
        voltarPara,
        `A senha tem de ter entre ${SENHA_MINIMA} e ${SENHA_MAXIMA} caracteres.`,
      ),
    );
  }

  const { data, error } = await supabase.rpc('definir_barreira_da_regiao', {
    p_region: regiao,
    p_actor: actor,
    p_ligada: ligada,
    // Sem senha nova, `null` — e a função sabe que isso quer dizer «fica a que
    // lá está». Recusa ligar quando não está lá nenhuma, e a recusa volta como
    // aviso, com as palavras da base.
    p_sha256: senha === '' ? null : await sha256Hex(senha),
  });
  if (error) redirect(comAviso(voltarPara, error.message));

  /*
   * A etiqueta refaz o `/api/regioes`, que é de onde o middleware lê o mapa —
   * mas o middleware guarda-o cinco minutos por instância
   * (`VALIDADE_DO_MAPA_MS`), e nenhuma etiqueta chega lá. É a mesma espera de
   * uma região nova a entrar em produção, e o painel di-la a quem grava, em
   * vez de a deixar descobrir a recarregar.
   */
  revalidateTag(CACHE_TAGS.regions, { expire: 0 });

  const mudou = data === true;
  redirect(
    comAviso(
      voltarPara,
      mudou
        ? (ligada
            ? 'A barreira ficou ligada. '
            : 'A barreira ficou desligada — a senha fica guardada para a próxima. ') +
            'Pode demorar até cinco minutos a valer em todos os servidores.'
        : 'Nada mudou — já estava assim.',
    ),
  );
}

const ESPACOS = '/admin/espacos';
/** Uma chave da fila: o nome já passado por `normalize_for_hash`. */
const CHAVE = /^[a-z0-9]{1,200}$/;
/** Um identificador do catálogo — concelho ou espaço —, que é um slug. */
const IDENTIFICADOR = /^[a-z0-9][a-z0-9-]{0,119}$/;

const LIGAR_SITIO = z.object({
  normalized: z.string().regex(CHAVE),
  name: z.string().trim().min(1).max(200),
  municipality: z.union([z.literal(''), z.string().regex(IDENTIFICADOR)]),
  venue: z.string().regex(IDENTIFICADOR),
});

const POR_DE_LADO = z.object({
  normalized: z.string().regex(CHAVE),
});

/**
 * Ligar um nome que uma fonte escreve a um espaço que já está no catálogo.
 *
 * É a primeira fila do painel que se fecha sem migração, e a razão está na
 * 0117 e em `/admin/espacos`: um alias para um espaço que já existe é trabalho
 * editorial, como aprovar uma submissão — faz-se aqui, fica em
 * `admin_actions`, e o registo é a auditoria e a cópia de segurança da base.
 * Criar o espaço continua a ser uma migração, e o painel diz como.
 *
 * Quem escreve é `set_venue_alias`: grava o alias, liga os eventos que estavam
 * à espera do nome — no concelho do espaço, e nunca por cima de um `venue_id`
 * trancado à mão — e deixa a linha de auditoria. Recusa um nome de um concelho
 * a apontar a um espaço de outro, e a recusa volta como aviso.
 *
 * O concelho vem do formulário porque vem da fila: é o que a recolha viu para
 * o evento. Com concelho, o alias fica preso a ele — a escolha segura, e a que
 * ganha na resolução (0066). Sem concelho, é regional.
 */
export async function ligarSitio(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();

  const lido = LIGAR_SITIO.safeParse({
    normalized: formData.get('normalized'),
    name: formData.get('name'),
    municipality: formData.get('municipality') ?? '',
    venue: formData.get('venue'),
  });
  if (!lido.success) {
    const semEspaco = lido.error.issues.some((issue) => issue.path[0] === 'venue');
    redirect(
      comAviso(
        ESPACOS,
        semEspaco
          ? 'Escolhe primeiro o espaço a que o nome pertence.'
          : 'O formulário veio incompleto — recarrega a página e tenta outra vez.',
      ),
    );
  }
  const { normalized, name, municipality, venue } = lido.data;

  // A chave da fila e o nome viajam os dois, e têm de ser o mesmo nome: o
  // alias que a base grava é `normalize_for_hash(nome)`, e é essa chave que a
  // pessoa viu na fila. Um formulário velho, ou mexido, não escreve um alias
  // que não é o que se estava a ver.
  if (normalizeForHash(name) !== normalized) {
    redirect(comAviso(ESPACOS, 'O nome e a chave não batem certo — recarrega a página.'));
  }

  const { data, error } = await supabase.rpc('set_venue_alias', {
    p_name: name,
    p_venue_id: venue,
    p_municipality_id: municipality || null,
    p_actor: actor,
  });
  if (error) redirect(comAviso(ESPACOS, error.message));

  // Os eventos ligados mudam de ficha e de mapa, e o concelho, quando se sabe,
  // afina a etiqueta. A fila é dinâmica, mas o router do cliente guarda a
  // última resposta: invalidar o caminho é o que garante que a fila que se vê
  // a seguir é a que a base tem.
  invalidate(municipality || null);
  revalidatePath(ESPACOS);

  const n = typeof data === 'number' ? data : 0;
  redirect(
    comAviso(
      ESPACOS,
      n === 0
        ? `«${name}» passou a ser «${venue}». Nenhum evento estava à espera; a próxima recolha já o conhece.`
        : `«${name}» passou a ser «${venue}»: ${n} ${n === 1 ? 'evento ligado' : 'eventos ligados'}.`,
    ),
  );
}

/**
 * «Não é um sítio»: tirar da fila um nome que nunca vai ser um espaço.
 *
 * Nada de público muda — a fila é só do painel —, por isso não há etiqueta de
 * cache a invalidar. O histórico fica na tabela; o que muda é que o nome deixa
 * de voltar todas as noites a pedir uma decisão que já foi tomada.
 */
export async function porSitioDeLado(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();

  const lido = POR_DE_LADO.safeParse({ normalized: formData.get('normalized') });
  if (!lido.success) redirect(comAviso(ESPACOS, 'Falta a chave do nome a pôr de lado.'));

  const { error } = await supabase.rpc('dismiss_unresolved_venue', {
    p_normalized: lido.data.normalized,
    p_actor: actor,
  });
  if (error) redirect(comAviso(ESPACOS, error.message));

  revalidatePath(ESPACOS);
  redirect(comAviso(ESPACOS, 'Posto de lado. Não volta à fila; o histórico fica.'));
}

const NOVA_REGIAO_CAMINHO = '/admin/regioes/nova';
/** Um nome de anfitrião: etiquetas de letras, algarismos e hífenes, com pelo menos um ponto. */
const ANFITRIAO = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
/** Um número decimal escrito à mão, com ou sem sinal. */
const DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * O formulário de uma região nova. As mensagens são por campo e em português,
 * porque um `safeParse` que falha diz «invalid_string» a quem escreveu o
 * domínio com `https://` à frente — e o aviso tem de dizer o que corrigir.
 */
const NOVA_REGIAO = z.object({
  id: z.string().trim().regex(IDENTIFICADOR),
  name: z.string().trim().min(1).max(120),
  article: z.enum(['o', 'a', 'os', 'as']),
  cim_name: z.string().trim().min(1).max(200),
  cim_url: z
    .string()
    .trim()
    .url()
    .regex(/^https?:\/\//),
  domain: z.string().trim().toLowerCase().regex(ANFITRIAO),
  contact_email: z.string().trim().email(),
  // Em branco fica igual ao domínio — é assim que uma região nasce, e é o
  // que o guia manda (0101). Um valor próprio tem a forma de um domínio.
  ical_uid_domain: z
    .string()
    .trim()
    .toLowerCase()
    .refine((valor) => valor === '' || ANFITRIAO.test(valor)),
  district: z.string().trim().max(80),
  // Com um erro, a lista volta ao formulário pela query de um
  // redirecionamento: oito mil caracteres são uma centena de concelhos — a
  // maior CIM do país tem dezanove — e cabem num `Location` em qualquer
  // proxy; cinquenta mil não cabiam.
  municipalities: z.string().max(8_000),
});

const AVISOS_DA_NOVA_REGIAO: Record<keyof z.infer<typeof NOVA_REGIAO>, string> = {
  id: 'O identificador da região tem de ser um slug: minúsculas, algarismos e hífenes, a começar por letra ou algarismo.',
  name: 'A região precisa de nome.',
  article: 'O artigo do nome tem de ser «o», «a», «os» ou «as».',
  cim_name: 'O promotor precisa de nome.',
  cim_url: 'O endereço do promotor tem de ser um URL completo, com https://.',
  domain:
    'O domínio tem de ser um nome de anfitrião, como coreto.cimlt.pt — sem https:// nem barras.',
  contact_email: 'O email da região tem de ser um endereço de email.',
  ical_uid_domain:
    'O domínio dos UID iCal tem de ser um nome de anfitrião, como o domínio — ou ficar em branco, para ser igual a ele.',
  district: 'O distrito não pode ter mais de 80 caracteres.',
  municipalities: 'A lista de concelhos é grande de mais para um formulário.',
};

interface ConcelhoNovo {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  website: string | null;
}

type ConcelhosLidos = { ok: true; concelhos: ConcelhoNovo[] } | { ok: false; erro: string };

function recusaNaLinha(numero: number, razao: string): ConcelhosLidos {
  return { ok: false, erro: `Linha ${numero} dos concelhos: ${razao}` };
}

/**
 * A lista de concelhos, lida linha a linha: `slug | Nome | latitude |
 * longitude | sítio`, com o sítio opcional e, em sexto, o distrito de um
 * concelho que não é do distrito da região — a Azambuja é de Lisboa, mas a
 * Lezíria é de Santarém, e o distrito é público («Concelho do distrito de…»).
 *
 * Tudo o que se recusa aqui recusa-se também na função da base, que é quem
 * manda; a diferença é a frase, que nomeia a linha. Uma pessoa que escreveu
 * trinta concelhos quer saber qual é o que tem a vírgula no sítio do ponto,
 * não que «as coordenadas do concelho x não são números».
 *
 * As coordenadas plausíveis são as de Portugal inteiro, do Corvo a Bragança:
 * não é uma validação da morada, é a rede que apanha a latitude e a
 * longitude trocadas e o sinal da longitude esquecido — que são os enganos
 * que acontecem, e que poriam um concelho no mar.
 */
function lerConcelhos(texto: string, distritoDaRegiao: string): ConcelhosLidos {
  const concelhos: ConcelhoNovo[] = [];
  const linhaDe = new Map<string, number>();

  for (const [indice, bruta] of texto.split(/\r?\n/).entries()) {
    const numero = indice + 1;
    const linha = bruta.trim();
    if (linha === '') continue;

    const campos = linha.split('|').map((campo) => campo.trim());
    if (campos.length < 4 || campos.length > 6) {
      return recusaNaLinha(
        numero,
        `esperavam-se «slug | Nome | latitude | longitude | sítio», e ${
          campos.length === 1 ? 'veio 1 campo' : `vieram ${campos.length} campos`
        }.`,
      );
    }
    const [id = '', name = '', lat = '', lon = '', website = '', distrito = ''] = campos;

    if (!IDENTIFICADOR.test(id)) {
      return recusaNaLinha(numero, `«${id}» não é um slug — minúsculas, algarismos e hífenes.`);
    }
    const repetida = linhaDe.get(id);
    if (repetida !== undefined) {
      return recusaNaLinha(numero, `o concelho «${id}» já apareceu na linha ${repetida}.`);
    }
    if (name === '') return recusaNaLinha(numero, 'falta o nome do concelho.');
    if (!DECIMAL.test(lat) || !DECIMAL.test(lon)) {
      return recusaNaLinha(
        numero,
        `as coordenadas têm de ser dois números decimais, como 39.2362 e -8.6850 (vieram «${lat}» e «${lon}»).`,
      );
    }
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (latitude < 32 || latitude > 43 || longitude < -32 || longitude > -6) {
      return recusaNaLinha(
        numero,
        `as coordenadas (${lat}, ${lon}) não caem em Portugal — latitude e longitude trocadas, ou um sinal a menos?`,
      );
    }
    if (website !== '' && !/^https?:\/\/\S+$/.test(website)) {
      return recusaNaLinha(
        numero,
        `o sítio «${website}» tem de ser um URL completo, com https://.`,
      );
    }
    const district = distrito || distritoDaRegiao;
    if (district === '') {
      return recusaNaLinha(
        numero,
        'falta o distrito — preenche o distrito da região, ou acrescenta-o à linha como sexto campo.',
      );
    }

    linhaDe.set(id, numero);
    concelhos.push({ id, name, district, latitude, longitude, website: website || null });
  }

  if (concelhos.length === 0) {
    return { ok: false, erro: 'A região precisa de pelo menos um concelho — a lista veio vazia.' };
  }
  return { ok: true, concelhos };
}

/**
 * De volta ao formulário, com o aviso e com o que a pessoa já tinha escrito.
 *
 * As outras ações voltam só com o aviso, e chega-lhes: são um campo ou dois.
 * Aqui há trinta linhas de concelhos, e um erro na décima sétima não pode
 * custar as outras vinte e nove. Os valores viajam na query e a página
 * volta a pô-los nos campos — nada disto é pessoal nem secreto, é a
 * configuração de uma região.
 */
function voltarAoFormulario(formData: FormData, aviso: string): never {
  const params = new URLSearchParams();
  for (const campo of Object.keys(NOVA_REGIAO.shape)) {
    const valor = formData.get(campo);
    if (typeof valor === 'string' && valor !== '') params.set(campo, valor);
  }
  redirect(comAviso(`${NOVA_REGIAO_CAMINHO}?${params.toString()}`, aviso));
}

/**
 * Fazer nascer uma região a partir do painel.
 *
 * É a promessa do produto — «uma CIM nova entra sem um único commit» — sem o
 * SQL editor que até aqui a cumpria. Quem escreve é `create_region`
 * (migração 0121), e é ela que faz tudo de uma vez ou nada: a linha da
 * região com a contagem e a caixa geográfica calculadas dos concelhos, os
 * concelhos pela ordem da lista, e por concelho o espaço provisório e a fonte
 * desligada que as schema-checks exigem — com a linha de auditoria. O que a
 * função recusa volta como aviso, com o formulário preenchido.
 *
 * A validação daqui é a mesma da base, dita por linha: a base é quem manda,
 * e o formulário é quem sabe em que linha a pessoa se enganou.
 *
 * Nasce ligada, como as regiões semeadas à mão, e vai direta à ficha: o que
 * falta — prosa, logótipos, licença, e o domínio no Vercel e no DNS — está lá
 * e no guia. Enquanto o DNS não resolve, ninguém chega à região sem lhe pôr o
 * cabeçalho Host; ligada só quer dizer que o mapa dos domínios já a conhece.
 */
export async function criarRegiao(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();

  const lido = NOVA_REGIAO.safeParse(
    Object.fromEntries(
      Object.keys(NOVA_REGIAO.shape).map((campo) => {
        const valor = formData.get(campo);
        return [campo, typeof valor === 'string' ? valor : ''];
      }),
    ),
  );
  if (!lido.success) {
    const campo = String(lido.error.issues[0]?.path[0] ?? '');
    voltarAoFormulario(
      formData,
      campo in AVISOS_DA_NOVA_REGIAO
        ? AVISOS_DA_NOVA_REGIAO[campo as keyof typeof AVISOS_DA_NOVA_REGIAO]
        : 'O formulário veio incompleto — recarrega a página e tenta outra vez.',
    );
  }
  const dados = lido.data;

  const lista = lerConcelhos(dados.municipalities, dados.district);
  if (!lista.ok) voltarAoFormulario(formData, lista.erro);
  const concelhos = lista.concelhos;

  const { error } = await supabase.rpc('create_region', {
    p_id: dados.id,
    p_name: dados.name,
    p_article: dados.article,
    p_cim_name: dados.cim_name,
    p_cim_url: dados.cim_url,
    p_domain: dados.domain,
    p_contact_email: dados.contact_email,
    p_ical_uid_domain: dados.ical_uid_domain || dados.domain,
    p_municipalities: concelhos,
    p_actor: actor,
  });
  if (error) voltarAoFormulario(formData, error.message);

  /*
   * As regiões, porque o mapa dos domínios (`/api/regioes`) e o layout de
   * cada região leem essa etiqueta — é por ela que o middleware passa a
   * conhecer o domínio novo em cinco minutos, sem deploy. E o catálogo que
   * nasceu com ela: os concelhos vivem na taxonomia, e o espaço e a fonte de
   * cada um nas suas etiquetas. Tudo a fundo, que uma região nova é rara.
   */
  for (const tag of [
    CACHE_TAGS.regions,
    CACHE_TAGS.taxonomy,
    CACHE_TAGS.venues,
    CACHE_TAGS.sources,
  ]) {
    revalidateTag(tag, { expire: 0 });
  }

  const n = concelhos.length;
  redirect(
    comAviso(
      `/admin/regioes/${encodeURIComponent(dados.id)}`,
      `Região «${dados.name}» criada, com ${n} ${n === 1 ? 'concelho' : 'concelhos'} — cada um com um ` +
        'espaço provisório e uma fonte desligada. O domínio no Vercel e no DNS é o passo seguinte ' +
        'do guia docs/NOVA-CIM.md.',
    ),
  );
}

/* -------------------------------------------------------------------------
 * Os cartazes: retirar a pedido, repor, e declarar que fontes se podem copiar.
 *
 * As três cautelas da migração 0162 têm cada uma o seu sítio, e duas delas
 * são aqui: **quem se pode copiar** (a declaração por fonte) e **como se
 * retira** (o botão). A terceira — o crédito — escreve-se na recolha, no
 * momento em que a cópia se faz.
 * ------------------------------------------------------------------------- */

const CAMINHO_DOS_CARTAZES = '/admin/cartazes';

/**
 * Apaga do balde as cópias de um evento.
 *
 * **Apagar a linha sem apagar os ficheiros era o pior dos dois mundos.** O
 * endereço do balde é público e adivinha-se a partir da página se alguém tiver
 * guardado o HTML; um pedido de retirada cumprido só na base deixava a imagem
 * a responder na mesma, a quem soubesse o caminho, para sempre. É a mesma
 * armadilha que o expurgo das submissões acautela no balde privado.
 *
 * Não lança: os ficheiros que ficarem por apagar ficam registados e a marca na
 * base — que é o que esconde a imagem de toda a gente — já está posta.
 */
async function apagarCopiasDoCartaz(eventId: string): Promise<void> {
  const supabase = requireAdminClient();
  const pasta = pastaDoCartaz(eventId);
  const balde = supabase.storage.from(BALDE_DOS_CARTAZES);

  const { data, error } = await balde.list(pasta);
  if (error) {
    reportarErro('apagarCopiasDoCartaz.list', error);
    return;
  }
  const caminhos = (data ?? []).map((ficheiro) => `${pasta}/${ficheiro.name}`);
  if (caminhos.length === 0) return;

  const { error: erroAoApagar } = await balde.remove(caminhos);
  if (erroAoApagar) reportarErro('apagarCopiasDoCartaz.remove', erroAoApagar);
}

/**
 * Retira o cartaz de um evento, a pedido de quem é seu autor.
 *
 * Duas escritas e uma ordem que importa: **primeiro a base, depois o balde.**
 * A marca na base é o que esconde a imagem de toda a gente e o que impede a
 * recolha de a ir buscar outra vez; os ficheiros são o que resta de visível a
 * quem já tiver o endereço. Falhar a segunda deixa um ficheiro órfão que
 * ninguém alcança pelo sítio. Falhar a primeira, com a segunda feita, deixava
 * a página a apontar para um endereço morto e a recolha a repor tudo à noite.
 */
export async function retirarCartaz(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();
  const evento = String(formData.get('evento') ?? '').trim();
  const voltarPara = String(formData.get('voltar') ?? CAMINHO_DOS_CARTAZES);
  if (!evento) redirect(comAviso(voltarPara, 'Falta dizer qual é o evento.'));

  const { error } = await supabase.rpc('retirar_cartaz', {
    p_event_id: evento,
    p_actor: actor,
  });
  if (error) redirect(comAviso(voltarPara, error.message));

  await apagarCopiasDoCartaz(evento);

  invalidate(formData.get('concelho'));
  redirect(comAviso(voltarPara, 'Cartaz retirado. Não volta com a recolha.'));
}

/**
 * Levanta a marca, e é o desfazer de um botão que se carrega sem querer.
 *
 * A imagem não volta já: volta na recolha seguinte, que a vai buscar à fonte
 * como sempre foi. Dizê-lo no aviso é o que evita que alguém carregue nisto
 * três vezes à espera de ver o cartaz aparecer.
 */
export async function reporCartaz(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  const supabase = requireAdminClient();
  const evento = String(formData.get('evento') ?? '').trim();
  const voltarPara = String(formData.get('voltar') ?? CAMINHO_DOS_CARTAZES);
  if (!evento) redirect(comAviso(voltarPara, 'Falta dizer qual é o evento.'));

  const { error } = await supabase.rpc('repor_cartaz', {
    p_event_id: evento,
    p_actor: actor,
  });
  if (error) redirect(comAviso(voltarPara, error.message));

  invalidate(formData.get('concelho'));
  redirect(comAviso(voltarPara, 'Marca levantada. O cartaz volta na próxima recolha.'));
}

/**
 * Declara se os cartazes de uma fonte podem ser copiados.
 *
 * É a primeira das três cautelas, e é uma decisão de quem responde pelo sítio
 * — não uma inferência do tipo da fonte. Uma câmara e uma junta são organismos
 * públicos e a migração ligou-as; uma sala, um santuário ou um blogue não são,
 * e ficam desligados até alguém olhar para eles.
 *
 * **Desligar não é só deixar de copiar.** As cópias que a fonte já tinha são
 * apagadas na recolha seguinte, que volta a apontar para a origem — ver o
 * `havia` em `decidirCartaz`. O que se decidiu não guardar não fica guardado.
 */
export async function declararAlojamentoDaFonte(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = requireAdminClient();
  const fonte = String(formData.get('fonte') ?? '').trim();
  const voltarPara = `${CAMINHO_DOS_CARTAZES}?vista=fontes`;
  if (!fonte) redirect(comAviso(voltarPara, 'Falta dizer qual é a fonte.'));

  const alojavel = String(formData.get('alojavel') ?? '') === 'sim';
  const { error } = await supabase
    .from('sources')
    .update({ cartaz_alojavel: alojavel })
    .eq('id', fonte);
  if (error) redirect(comAviso(voltarPara, error.message));

  redirect(
    comAviso(
      voltarPara,
      alojavel
        ? 'Os cartazes desta fonte passam a ser copiados na próxima recolha.'
        : 'As cópias desta fonte são apagadas na próxima recolha.',
    ),
  );
}
