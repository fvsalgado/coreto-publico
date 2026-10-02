/**
 * O dicionário único dos rótulos do painel (C4-011).
 *
 * A base guarda os estados em inglês e em formato de máquina — `form`,
 * `pending`, `skipped`, `needs_info` —, e o painel mostrava-os tal e qual: «form
 * · pending · confiança 0.6». Quem modera numa CIM é um técnico de cultura ou de
 * comunicação, e um rótulo destes diz-lhe que a ferramenta foi feita para outra
 * pessoa.
 *
 * Um sítio só, para a mesma coisa não ter dois nomes em duas páginas. Um valor
 * que não esteja aqui sai tal e qual — melhor um rótulo cru do que nenhum, e o
 * teste deste ficheiro obriga a decidir cada valor que as enumerações da base
 * têm hoje.
 */

/** Por onde chegou uma proposta (`submission_channel`). */
export const CANAL: Readonly<Record<string, string>> = {
  email: 'Email',
  // O formulário público saiu do sítio; o que entra por `form` hoje é o envio
  // por programa (`POST /api/submissions`), e é isso que se diz.
  form: 'Envio por programa',
  scraper: 'Recolha',
};

/** Em que ponto está uma proposta (`submission_status`). */
export const ESTADO_DA_PROPOSTA: Readonly<Record<string, string>> = {
  pending: 'por rever',
  needs_info: 'à espera de resposta',
  approved: 'publicada',
  rejected: 'recusada',
  duplicate: 'duplicada',
  merged: 'fundida',
};

/** Em que ponto está um evento (`event_status`). */
export const ESTADO_DO_EVENTO: Readonly<Record<string, string>> = {
  published: 'publicado',
  draft: 'rascunho',
  hidden: 'escondido',
  cancelled: 'cancelado',
  postponed: 'adiado',
  archived: 'arquivado',
};

/** Como correu uma leitura de uma fonte (`run_status`). */
export const ESTADO_DA_RECOLHA: Readonly<Record<string, string>> = {
  running: 'a decorrer',
  success: 'lida',
  partial: 'lida em parte',
  failed: 'falhou',
};

/**
 * A leitura automática de um email (`extraction_status`). `ok` não se diz: é
 * o caso normal, e um rótulo para ele seria ruído em todas as linhas.
 */
export const LEITURA_AUTOMATICA: Readonly<Record<string, string | null>> = {
  ok: null,
  pending: 'à espera da leitura automática',
  skipped: 'sem leitura automática',
  failed: 'a leitura automática falhou',
  unverified: 'leitura automática por confirmar',
};

export function rotulo(dicionario: Readonly<Record<string, string | null>>, valor: string): string {
  return dicionario[valor] ?? valor;
}

/**
 * A confiança em palavras, e só onde ela distingue alguma coisa.
 *
 * O envio por programa grava sempre 0,6 — a proposta completa e a que só tem
 * título e data saíam com o mesmo número, que por isso não dizia nada. Na
 * recolha e no email o número vem de quem leu (o harmonizador, o modelo) e aí
 * separa o que se lê bem do que se lê mal.
 */
export function confiancaEmPalavras(canal: string, confianca: number | null): string | null {
  if (confianca === null || canal === 'form') return null;
  if (confianca >= 0.85) return 'leitura segura';
  if (confianca >= 0.6) return 'leitura razoável';
  return 'leitura duvidosa';
}

/**
 * Os campos de um evento, como se dizem numa frase — «Mudou o preço e as
 * datas.» São as colunas que o painel corrige (`update_event`, 0173) e o
 * cadeado das datas, que não é coluna.
 */
export const CAMPO_DO_EVENTO: Readonly<Record<string, string>> = {
  title: 'o título',
  subtitle: 'o subtítulo',
  description: 'a descrição',
  municipality_id: 'o concelho',
  venue_id: 'o espaço',
  location_name: 'o local livre',
  parish: 'a freguesia',
  how_to_arrive: 'o «como chegar»',
  category_slug: 'a categoria',
  series_id: 'o ciclo',
  is_free: 'a entrada livre',
  price_display: 'o preço',
  ticketing_url: 'a bilhética',
  image_url: 'a imagem',
  accessibility_notes: 'as notas de acessibilidade',
  is_ongoing: 'o «em cartaz»',
  sessions: 'as datas',
  // Os que o painel não corrige mas que uma migração ou a moderação antiga
  // trancaram — aparecem na lista dos trancados, e destrancam-se como os outros.
  description_short: 'o resumo',
  latitude: 'a latitude',
  longitude: 'a longitude',
  date_start: 'o dia de início',
  date_end: 'o dia de fim',
};

/** «o preço», «o preço e as datas», «o título, o preço e as datas». */
export function porExtenso(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/**
 * As ações da auditoria, ditas como se diz quem fez o quê — «Gil Gestor
 * trancou campos» em vez de «event.lock_fields» (C4-011). Uma ação nova que
 * não esteja aqui sai legível na mesma (`acaoDaAuditoria`), e o teste deste
 * ficheiro lê as migrações à procura das que faltam.
 */
export const ACAO_DA_AUDITORIA: Readonly<Record<string, string>> = {
  approve: 'aprovou e publicou',
  'submission.approve': 'aprovou e publicou',
  'submission.rejected': 'recusou',
  'submission.duplicate': 'marcou como duplicada',
  'submission.needs_info': 'pediu o que falta',
  'submission.merge': 'fundiu num evento',
  set_status: 'mudou o estado',
  'event.update': 'corrigiu',
  'event.lock_fields': 'trancou campos',
  'event.unlock_fields': 'destrancou campos',
  'event.merge': 'fundiu dois eventos',
  retirar_cartaz: 'retirou o cartaz',
  repor_cartaz: 'repôs o cartaz',
  'region.create': 'criou a região',
  'region.update': 'mudou a região',
  'region.license_add': 'registou uma licença',
  barreira_da_regiao: 'mudou a barreira',
  'section.enable': 'ligou a secção',
  'section.disable': 'desligou a secção',
  token_de_balanco_criado: 'criou o endereço do balanço',
  tokens_de_balanco_revogados: 'fechou os endereços do balanço',
  'venue.alias': 'ligou um nome a um espaço',
  'venue.dismiss': 'pôs de lado um nome de espaço',
  'pessoa.criar': 'criou a conta',
  'pessoa.convite': 'gerou uma ligação de ativação',
  'pessoa.ativar': 'ativou a conta',
  'pessoa.papel': 'mudou um papel',
  'pessoa.desativar': 'desativou a conta',
  'pessoa.reativar': 'reativou a conta',
  'pessoa.entrar': 'entrou no painel',
  'leitura.fila': 'abriu a fila',
  'leitura.submissao': 'abriu uma proposta',
  'fonte.pausar': 'pôs a fonte em pausa',
  'fonte.retomar': 'tirou a pausa da fonte',
  'fonte.reabrir': 'reabriu a pausa automática',
  'fonte.ligar': 'ligou a fonte',
  'fonte.desligar': 'desligou a fonte',
};

/** «event.lock_fields» → «trancou campos»; uma desconhecida, sem pontos nem traços. */
export function acaoDaAuditoria(acao: string): string {
  return ACAO_DA_AUDITORIA[acao] ?? acao.replace(/[._]+/g, ' ');
}

/** De que é cada linha da auditoria. */
export const ENTIDADE_DA_AUDITORIA: Readonly<Record<string, string>> = {
  submission: 'proposta',
  submission_queue: 'fila',
  event: 'evento',
  region: 'região',
  site_section: 'secção',
  source: 'fonte',
  venue: 'espaço',
  venue_alias: 'espaço',
  pessoa: 'pessoa',
  series: 'ciclo',
};
