/**
 * O formulário de revisão, traduzido.
 *
 * Vive fora de `actions.ts` porque um módulo com `'use server'` só pode
 * exportar funções assíncronas — e estas são puras, síncronas e testáveis,
 * que é exatamente o que se quer da parte que decide o que fica bloqueado.
 */

/**
 * Colunas do evento que o editor pode preencher no formulário de revisão.
 *
 * Exportada para o teste que confronta esta lista com os `name=` da página:
 * os dois viviam em ficheiros diferentes sem nada a ligá-los, e foi assim que
 * o subtítulo, a freguesia e o ciclo ficaram sem caixa — e a ser apagados.
 */
export const EDITABLE_FIELDS = [
  'title',
  'subtitle',
  'description',
  'municipality_id',
  'venue_id',
  'location_name',
  'parish',
  'how_to_arrive',
  'category_slug',
  'series_id',
  'is_free',
  'price_display',
  'ticketing_url',
  'image_url',
  'accessibility_notes',
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

/** Todos são texto no formulário menos um, e o tipo di-lo em vez de o deixar
 *  a quem lê descobrir com um `typeof` em cada campo. */
export type Proposed = { [K in Exclude<EditableField, 'is_free'>]: string } & { is_free: boolean };

const BOOLEAN_FIELDS = new Set<EditableField>(['is_free']);

/**
 * Como a extração de email e formulário nomeia cada campo editável.
 *
 * Não é uma conversão mecânica de camelCase para snake_case: `priceRaw` entra
 * em `price_display`.
 *
 * O `series_id` não está aqui porque **nenhuma extração o propõe** — nem o
 * email nem o formulário público têm por onde o adivinhar. Isso não quer dizer
 * que ninguém o proponha: o ramo da recolha lê as chaves pelo nome da coluna,
 * e o adaptador do CAMINHOS manda `series_id` nos dez eventos que publicou.
 */
const CHAVES_DA_EXTRACAO: Partial<Record<EditableField, string>> = {
  title: 'title',
  subtitle: 'subtitle',
  description: 'description',
  municipality_id: 'municipalityId',
  venue_id: 'venueId',
  location_name: 'locationName',
  parish: 'parish',
  how_to_arrive: 'howToArrive',
  category_slug: 'categorySlug',
  is_free: 'isFree',
  price_display: 'priceRaw',
  ticketing_url: 'ticketingUrl',
  image_url: 'imageUrl',
  accessibility_notes: 'accessibilityNotes',
};

export interface ProposedSession {
  date: string;
  start: string;
  end: string;
}

function texto(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number') return String(valor);
  return '';
}

/**
 * Há duas formas de payload na mesma coluna, e é preciso saber ler as duas.
 *
 * Quem chega por email ou formulário traz o que a extração propôs, plano e em
 * camelCase. Quem chega pela recolha traz o que o adaptador já leu da página,
 * aninhado — `{ raw, event, sessions }` — com o evento em snake_case, que são
 * as mesmas chaves de `EDITABLE_FIELDS`.
 *
 * Ler só a primeira forma foi o que pôs um evento de Ourém na fila com o
 * formulário inteiro em branco: o pipeline sabia o título, a data, a descrição
 * e o cartaz, e a página pedia que se escrevesse tudo à mão. O que faltava
 * mesmo era o sítio — e era só isso que devia estar por preencher.
 */
export function proposedFromPayload(
  payload: Record<string, unknown>,
  fallback: { municipality_id?: string | null; venue_id?: string | null } = {},
): Proposed {
  const evento = payload.event;
  const daRecolha = typeof evento === 'object' && evento !== null;
  const origem = (daRecolha ? evento : payload) as Record<string, unknown>;

  const proposto: Record<string, string | boolean> = {};
  for (const campo of EDITABLE_FIELDS) {
    const chave = daRecolha ? campo : CHAVES_DA_EXTRACAO[campo];
    const valor = chave ? origem[chave] : undefined;
    proposto[campo] = BOOLEAN_FIELDS.has(campo) ? valor === true : texto(valor);
  }

  // As colunas da submissão valem quando o payload se cala — é delas que vem o
  // concelho de um candidato da recolha a que falta tudo o resto.
  if (!proposto.municipality_id) proposto.municipality_id = texto(fallback.municipality_id);
  if (!proposto.venue_id) proposto.venue_id = texto(fallback.venue_id);

  return proposto as unknown as Proposed;
}

/**
 * As sessões propostas, das duas formas.
 *
 * A recolha guarda-as já como linhas — `session_date`, `start_time`,
 * `end_time` — e a extração como `dates`, com `date` e `startTime` e sem fim.
 */
export function proposedSessions(payload: Record<string, unknown>): ProposedSession[] {
  const daRecolha = payload.sessions;
  if (Array.isArray(daRecolha)) {
    return daRecolha.map((linha) => {
      const s = linha as Record<string, unknown>;
      return {
        date: texto(s.session_date),
        start: texto(s.start_time),
        end: texto(s.end_time),
      };
    });
  }

  const daExtracao = payload.dates;
  if (Array.isArray(daExtracao)) {
    return daExtracao.map((linha) => {
      const s = linha as Record<string, unknown>;
      return { date: texto(s.date), start: texto(s.startTime), end: '' };
    });
  }

  return [];
}

/**
 * O que o editor escreveu — e só o que ele teve hipótese de escrever.
 *
 * **«Não perguntado» não é «apagado».** Esta função percorria os quinze campos
 * editáveis e fazia `formData.get` a todos, incluindo os que o formulário não
 * desenha: uma ausência de pergunta saía daqui como um `null`, que é uma
 * afirmação — «este evento não tem subtítulo». Depois o `changedFields`
 * comparava o que a fonte propunha com esse `null`, concluía que o editor
 * mudara o campo, e mandava-o trancar. O resultado, medido contra um Postgres
 * com as 129 migrações: o evento publicado saía com subtítulo, freguesia e
 * ciclo a nulo, **e** com três bloqueios manuais de valor nulo — a recolha
 * ficava proibida para sempre de voltar a preencher o que ela própria trouxe.
 *
 * Um formulário HTML submete todos os controlos com `name` que não estejam
 * desativados, incluindo os de texto vazios. Por isso `formData.has` é
 * verdadeiro para todos os campos que a página desenha, e falso só para os que
 * lhe faltam — que é exactamente a distinção que aqui faltava.
 *
 * Consequência para quem ler o que sai daqui: **o objeto pode não ter as
 * quinze chaves.** A `approve_submission` lê tudo com `->>`, que dá nulo para
 * chave ausente, por isso o `insert` não muda; mas quem escrever um leitor novo
 * não pode contar que venham sempre todas.
 */
export function readEvent(formData: FormData): Record<string, unknown> {
  const event: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    /*
     * A caixa fica de fora desta regra, e o teste de cima é que o mostrou: um
     * `<input type="checkbox">` por picar **não é submetido**, por isso a
     * ausência dele é a resposta — «não é grátis» — e não uma pergunta que
     * ninguém fez. Saltá-la aqui fazia o `is_free` sair indefinido em vez de
     * falso, que é o mesmo pecado ao contrário.
     *
     * Em HTML não há como distinguir «caixa desenhada e por picar» de «caixa
     * que não existe na página». Enquanto a página desenhar a caixa — e
     * desenha —, a ausência quer dizer por picar.
     */
    if (BOOLEAN_FIELDS.has(field)) {
      event[field] = formData.get(field) === 'on';
      continue;
    }
    if (!formData.has(field)) continue;
    const value = formData.get(field);
    event[field] = typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
  }
  // «Em cartaz» é uma caixa à parte: não é um campo que a extração proponha
  // nem que se bloqueie contra a recolha — é a forma do evento, um período ou
  // sessões soltas. Sem isto a aprovação deixava-o cair, e um intervalo que o
  // formulário público guardou como período (build-row.ts) publicava-se como
  // dois espetáculos, o de abrir e o de fechar.
  event.is_ongoing = formData.get('is_ongoing') === 'on';
  const eventId = formData.get('event_id');
  if (typeof eventId === 'string' && eventId) event.id = eventId;
  return event;
}

/**
 * As sessões chegam como três listas paralelas (data, hora de início, hora de
 * fim). Uma linha sem data é uma linha que o editor deixou em branco.
 */
/**
 * Se o candidato já vinha marcado como período.
 *
 * O payload chega em duas formas — aninhado (`{ event: {...} }`) quando vem da
 * recolha, liso quando vem da extração —, e o `proposedFromPayload` já sabe
 * disso há muito. A caixa «Em cartaz» lia só a forma lisa, e por isso vinha
 * desmarcada para as 49 submissões que este sistema recebeu, que são todas da
 * recolha. Quem aprovasse sem reparar transformava um período de três semanas
 * em dois espetáculos, o de abrir e o de fechar.
 *
 * **Não entra em `EDITABLE_FIELDS`**, e é de propósito: isso trancava o campo
 * contra a recolha, e a decisão de o deixar de fora está escrita no comentário
 * do `readEvent`. Isto é só ler o que já lá está.
 */
export function propostoEmCartaz(payload: Record<string, unknown>): boolean {
  const evento = payload.event;
  if (typeof evento === 'object' && evento !== null) {
    return (evento as Record<string, unknown>).is_ongoing === true;
  }
  return payload.is_ongoing === true;
}

export function readSessions(formData: FormData): Array<Record<string, string>> {
  const dates = formData.getAll('session_date').map(String);
  const starts = formData.getAll('session_start').map(String);
  const ends = formData.getAll('session_end').map(String);

  const sessions: Array<Record<string, string>> = [];
  for (const [index, date] of dates.entries()) {
    if (!date) continue;
    const session: Record<string, string> = { session_date: date };
    const start = starts[index];
    const end = ends[index];
    if (start) session.start_time = start;
    if (end) session.end_time = end;
    sessions.push(session);
  }
  return sessions;
}

/**
 * Que campos o editor mudou face ao que a extração propunha.
 *
 * São estes que ficam bloqueados: o que uma pessoa corrigiu não pode ser
 * desfeito pela recolha da noite seguinte. Bloquear tudo congelaria o evento;
 * bloquear nada faria o trabalho de moderação evaporar-se.
 */
export function changedFields(
  proposed: Record<string, unknown>,
  edited: Record<string, unknown>,
): string[] {
  const changed: string[] = [];
  for (const field of EDITABLE_FIELDS) {
    // Um campo que o formulário não trouxe não foi decidido por ninguém, e o
    // que ninguém decidiu não se tranca. Esta função é pura sobre duas imagens
    // e não tem como saber que uma delas é parcial — é o `readEvent` que agora
    // lho diz, deixando a chave de fora.
    if (!(field in edited)) continue;
    const before = proposed[field] ?? null;
    const after = edited[field] ?? null;
    if (String(before ?? '') !== String(after ?? '')) changed.push(field);
  }
  return changed.sort();
}

/**
 * Quantos eventos se mexem de uma vez.
 *
 * O mesmo número está na função SQL `set_event_status` e é ela quem manda —
 * este é o que a página mostra e valida antes de chegar lá. Não é uma
 * limitação técnica: é o que se consegue auditar de uma vez sem a ação
 * demorar, e o que uma pessoa consegue mesmo ter olhado antes de carregar.
 */
export const LOTE_MAX = 50;

/**
 * O endereço de volta, com o aviso pendurado e sem duplicar o que lá estava.
 *
 * Vive aqui e não em `actions.ts` pela razão que o cabeçalho deste ficheiro já
 * dava: um módulo com `'use server'` só pode exportar funções assíncronas, e
 * uma constante lá dentro derruba o módulo inteiro — «has no exports at all»,
 * diz o compilador, sobre um ficheiro cheio delas.
 */
/**
 * Um destino de regresso vindo de um formulário só vale se for do painel.
 *
 * `voltar` chega no corpo do pedido, e um corpo de pedido é do cliente. Só
 * quem tem sessão o envia — o CSRF das Server Actions fecha o resto —, mas
 * uma sessão não é razão para o painel redirecionar para onde lhe mandarem:
 * um caminho absoluto (`https://…`) ou de rede (`//…`) saía do sítio com a
 * mensagem de aviso na barra. Fica o painel, ou o sítio por omissão.
 */
export function destinoDoPainel(destino: string, omissao = '/admin/eventos'): string {
  return /^\/admin(?:\/|\?|$)/.test(destino) ? destino : omissao;
}

export function comAviso(destino: string, aviso: string): string {
  const [caminho = '/admin/eventos', query = ''] = destino.split('?');
  const params = new URLSearchParams(query);
  params.delete('aviso');
  params.set('aviso', aviso);
  return `${caminho}?${params.toString()}`;
}

export interface LicencaResumo {
  kind: string;
  starts_on: string;
  ends_on: string | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;

function dataPorExtenso(iso: string): string {
  return iso.split('-').reverse().join('/');
}

/**
 * O estado de licenciamento de uma região, numa frase — e se merece alarme.
 *
 * Recebe as licenças da região por ordem decrescente de início (a mais
 * recente manda) e o dia de hoje em ISO, para ser pura e testável: a mesma
 * frase aparece na ficha da região e no aviso do painel de entrada, e duas
 * redações da mesma regra divergiam. O alarme acende a 30 dias do fim —
 * tempo de renovar sem correr — e fica aceso depois dele; expirar nunca
 * desliga nada sozinho, o corte é o interruptor da região.
 */
export function estadoDaLicenca(
  licencas: readonly LicencaResumo[],
  hoje: string,
): { texto: string; alerta: boolean } {
  const atual = licencas[0];
  if (!atual) return { texto: 'Sem licença registada.', alerta: false };
  if (atual.ends_on === null) {
    return {
      texto: `Licença «${atual.kind}» sem prazo, desde ${dataPorExtenso(atual.starts_on)}.`,
      alerta: false,
    };
  }
  const dias = Math.round((Date.parse(atual.ends_on) - Date.parse(hoje)) / DIA_MS);
  if (dias < 0) {
    return {
      texto: `Licença «${atual.kind}» expirada desde ${dataPorExtenso(atual.ends_on)}.`,
      alerta: true,
    };
  }
  return {
    texto:
      `Licença «${atual.kind}» até ${dataPorExtenso(atual.ends_on)} — ` +
      (dias === 0 ? 'acaba hoje.' : dias === 1 ? 'falta um dia.' : `faltam ${dias} dias.`),
    alerta: dias <= 30,
  };
}

/**
 * Os campos da região que o formulário pode mudar, com o tipo de cada um.
 *
 * É o espelho da lista fechada da função `update_region` (migração 0109), e o
 * teste ao lado compara os dois contra o SQL, para não divergirem em silêncio.
 * Os anuláveis limpam-se com o campo em branco; os obrigatórios em branco
 * fazem a função recusar com a mensagem certa. `is_enabled` não está aqui
 * porque um checkbox não é um campo de texto — a ação lê-o à parte, com o
 * truque do campo-presença.
 */
export const CAMPOS_DA_REGIAO = {
  name: 'obrigatorio',
  article: 'obrigatorio',
  tagline: 'anulavel',
  about_intro: 'anulavel',
  about_story: 'anulavel',
  cim_name: 'obrigatorio',
  cim_url: 'obrigatorio',
  contact_email: 'obrigatorio',
  funding_statement: 'anulavel',
  funding_logo_path: 'anulavel',
  funding_logo_width: 'numero',
  funding_logo_height: 'numero',
  funding_logo_alt: 'anulavel',
  logo_on_graphite_path: 'anulavel',
  logo_on_brand_path: 'anulavel',
  logo_width: 'numero',
  logo_height: 'numero',
  og_image_path: 'anulavel',
  og_image_alt: 'anulavel',
  data_controller_name: 'anulavel',
  data_controller_url: 'anulavel',
  data_controller_nif: 'anulavel',
  data_controller_address: 'anulavel',
  data_controller_email: 'anulavel',
  data_controller_dpo: 'anulavel',
  data_controller_dpo_contact: 'anulavel',
  sort_order: 'inteiro',
} as const;
