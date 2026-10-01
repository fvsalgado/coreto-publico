import {
  extractAccessibility,
  parseAudience,
  parseDurationMinutes,
  parsePrice,
  truncate,
} from '@coreto/core';
import { formatAudience, formatDuration } from '../format';

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
 * Como a extração de email nomeia cada campo editável.
 *
 * Não é uma conversão mecânica de camelCase para snake_case: `priceRaw` entra
 * em `price_display`.
 *
 * O `series_id` não está aqui porque **a extração não o propõe** — um email
 * não tem por onde o adivinhar. Isso não quer dizer que ninguém o proponha: a
 * recolha e o envio por programa escrevem as chaves pelo nome da coluna, e o
 * adaptador do CAMINHOS manda `series_id` nos dez eventos que publicou.
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

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

/**
 * As três formas de payload que a mesma coluna guarda.
 *
 * - **`recolha`** — o que o adaptador já leu da página, aninhado:
 *   `{ raw, event, sessions }`, com o evento em snake_case.
 * - **`programa`** — o envio por programa, `POST /api/submissions`: o
 *   `EventCandidate` de `submissions/build-row.ts`, **liso e em snake_case**,
 *   com as sessões já em linhas. É a porta que a página do produto oferece a
 *   quem já tem os eventos noutro sistema.
 * - **`extracao`** — o que a extração leu de um email, liso e em camelCase
 *   (`ExtractedEvent`, em `@coreto/core`), com as datas em `dates`.
 *
 * **Eram duas, e a terceira lia-se como a segunda.** O canal por programa
 * guardava snake_case no topo e este ficheiro, sem `event`, ia procurar as
 * chaves da extração: `categorySlug`, `priceRaw`, `ticketingUrl`. Não as
 * encontrava, e o formulário de aprovação abria com a categoria, o preço, a
 * bilhética, a acessibilidade e o local em branco — medido a 1 de outubro de
 * 2026 com um concerto enviado completo, que saiu publicado sem nada disso. É
 * o único erro que esta casa não sabe desfazer, perder o que alguém escreveu,
 * cometido no gesto mais frequente do painel e sem aviso nenhum.
 *
 * A forma reconhece-se pelo que só ela tem: o `event` aninhado é da recolha,
 * as sessões em linhas no topo são do programa, e o resto é da extração —
 * incluindo o `{}` de um email que ainda não foi lido.
 */
export type FormaDoPayload = 'recolha' | 'programa' | 'extracao';

export function formaDoPayload(payload: Record<string, unknown>): FormaDoPayload {
  if (objeto(payload.event)) return 'recolha';
  if (Array.isArray(payload.sessions)) return 'programa';
  return 'extracao';
}

/** O evento proposto, onde quer que ele esteja dentro do payload. */
function eventoDoPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return objeto(payload.event) ?? payload;
}

/**
 * Há três formas de payload na mesma coluna, e é preciso saber ler as três —
 * ver `formaDoPayload`.
 *
 * Ler só a da extração foi o que pôs um evento de Ourém na fila com o
 * formulário inteiro em branco: o pipeline sabia o título, a data, a descrição
 * e o cartaz, e a página pedia que se escrevesse tudo à mão. O que faltava
 * mesmo era o sítio — e era só isso que devia estar por preencher. A mesma
 * lição chegou depois pelo canal por programa, que também escreve as colunas
 * pelo nome delas.
 */
export function proposedFromPayload(
  payload: Record<string, unknown>,
  fallback: { municipality_id?: string | null; venue_id?: string | null } = {},
): Proposed {
  const forma = formaDoPayload(payload);
  const origem = eventoDoPayload(payload);

  const proposto: Record<string, string | boolean> = {};
  for (const campo of EDITABLE_FIELDS) {
    const chave = forma === 'extracao' ? CHAVES_DA_EXTRACAO[campo] : campo;
    const valor = chave ? origem[chave] : undefined;
    proposto[campo] = BOOLEAN_FIELDS.has(campo) ? valor === true : texto(valor);
  }

  // As colunas da submissão valem quando o payload se cala — é delas que vem o
  // concelho de um candidato da recolha a que falta tudo o resto.
  if (!proposto.municipality_id) proposto.municipality_id = texto(fallback.municipality_id);
  if (!proposto.venue_id) proposto.venue_id = texto(fallback.venue_id);

  /*
   * O espaço que a extração leu e o catálogo não reconheceu passa a local.
   *
   * A extração escreve o nome do sítio em `venueName`, e a resolução contra o
   * catálogo põe o espaço na coluna da submissão — quando o encontra. Quando
   * não encontra, o nome ficava só no payload e o formulário abria com o
   * local em branco: um evento sem sítio, quando o email dizia qual era. É a
   * regra do harmonizador da recolha, `raw.venueName` a cair para
   * `location_name`, aplicada ao email.
   */
  if (forma === 'extracao' && !proposto.venue_id && !proposto.location_name) {
    proposto.location_name = texto(origem.venueName);
  }

  return proposto as unknown as Proposed;
}

/**
 * As colunas que a `approve_submission` escreve e que o formulário não mostra.
 *
 * São as que a máquina já tinha decidido — o público e a idade, a duração, os
 * números do preço, os cinco eixos da acessibilidade, as coordenadas, o
 * crédito do cartaz, o endereço de origem. A página de revisão não as desenha
 * (são deduções, não escolhas), e por isso não as submetia: a aprovação
 * publicava o evento com elas todas a nulo. Um concerto enviado com
 * «Plateia com acesso a cadeira de rodas» chegava à agenda sem o sinal de
 * acesso, e um espetáculo «a partir dos 6 anos» fora do filtro da família.
 *
 * Nenhuma entra em `EDITABLE_FIELDS`, e é de propósito: isso desenhava-lhes
 * uma caixa e trancava-as contra a recolha da noite seguinte.
 */
export const CAMPOS_HERDADOS = [
  'title_raw',
  'description_short',
  'location_address',
  'latitude',
  'longitude',
  'tags',
  'audience',
  'min_age',
  'recurrence',
  'duration_minutes',
  'price_min',
  'price_max',
  'price_raw',
  'wheelchair_accessible',
  'has_sign_language',
  'has_audio_description',
  'has_subtitles',
  'is_relaxed_performance',
  'image_credit',
  'image_alt',
  'source_url',
] as const;

/** O tamanho do resumo, o mesmo do harmonizador e do envio por programa. */
const RESUMO_MAX = 400;

function alguMudou(mudados: ReadonlySet<string>, campos: readonly EditableField[]): boolean {
  return campos.some((campo) => mudados.has(campo));
}

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

/**
 * O que acompanha o formulário até à aprovação, para nada se perder pelo
 * caminho.
 *
 * Três regras, e cada uma tem a sua razão:
 *
 * - **O que a proposta trazia vai tal e qual** quando ninguém mexeu naquilo de
 *   que depende. É a leitura da fonte, e a moderação aprova-a — não a refaz.
 * - **O que se deduz de um campo que o editor mudou volta a deduzir-se**, com
 *   as mesmas funções da recolha (`@coreto/core`), a partir do que ficou
 *   escrito. Quem acrescenta «sessão com Língua Gestual Portuguesa» às notas
 *   de acessibilidade espera ver o evento no filtro da LGP; quem troca o preço
 *   não pode ficar com os números do preço antigo por baixo — é o par
 *   «Entrada livre» com `price_min` 6 que o `decidirPreco` do harmonizador
 *   existe para não escrever. E quem muda o espaço tira ao evento as
 *   coordenadas e a morada do sítio onde ele já não é.
 * - **A extração de email não traz deduções nenhumas**, e por isso fazem-se
 *   aqui, da mesma maneira e com as mesmas funções que a recolha e o envio por
 *   programa as fazem. O público que o email declara (`audienceRaw`) e o preço
 *   que escreveu (`priceRaw`) deixam de cair no chão.
 *
 * O que fica de fora de propósito: a impressão digital (a função SQL calcula-a
 * do título, da data e do concelho que forem aprovados, e uma copiada da
 * proposta ficava errada no dia em que o editor corrigisse o título), a
 * confiança e a origem (são da submissão, e a função lê-as de lá).
 */
export function camposHerdados(
  payload: Record<string, unknown>,
  proposto: Record<string, unknown>,
  editado: Record<string, unknown>,
): Record<string, unknown> {
  const forma = formaDoPayload(payload);
  const origem = eventoDoPayload(payload);
  const bruto = objeto(payload.raw) ?? {};
  const mudados = new Set(changedFields(proposto, editado));
  const final = (campo: EditableField): string | null =>
    textoOuNulo(campo in editado ? editado[campo] : proposto[campo]);

  const herdados: Record<string, unknown> = {};
  if (forma !== 'extracao') {
    for (const campo of CAMPOS_HERDADOS) {
      const valor = origem[campo];
      if (valor !== undefined && valor !== null) herdados[campo] = valor;
    }
  } else {
    // Da extração, o que ela escreveu por extenso e tem coluna própria.
    const precoEscrito = textoOuNulo(origem.priceRaw);
    if (precoEscrito) herdados.price_raw = precoEscrito;
  }
  const deduzir = forma === 'extracao';

  const titulo = final('title');
  const subtitulo = final('subtitle');
  const descricao = final('description');
  const notas = final('accessibility_notes');

  if (deduzir || alguMudou(mudados, ['description'])) {
    herdados.description_short = truncate(descricao, RESUMO_MAX);
  }

  if (deduzir || alguMudou(mudados, ['title', 'subtitle', 'description', 'accessibility_notes'])) {
    const acesso = extractAccessibility(titulo, subtitulo, descricao, notas);
    herdados.wheelchair_accessible = acesso.wheelchair_accessible ?? null;
    herdados.has_sign_language = acesso.has_sign_language;
    herdados.has_audio_description = acesso.has_audio_description;
    herdados.has_subtitles = acesso.has_subtitles;
    herdados.is_relaxed_performance = acesso.is_relaxed_performance;
  }

  if (deduzir || alguMudou(mudados, ['title', 'description'])) {
    // O público declarado pela fonte pesa como na recolha: é o primeiro texto
    // que o `parseAudience` lê, e a idade que a fonte deu em número manda.
    const declarado = textoOuNulo(forma === 'extracao' ? origem.audienceRaw : bruto.audienceRaw);
    const publico = parseAudience(declarado, titulo, descricao);
    herdados.audience = publico.audience ?? null;
    const idadeDaFonte = typeof bruto.minAge === 'number' ? bruto.minAge : null;
    herdados.min_age = idadeDaFonte ?? publico.min_age ?? null;
  }

  if (deduzir || alguMudou(mudados, ['description', 'accessibility_notes'])) {
    const duracaoDaFonte = typeof bruto.durationMinutes === 'number' ? bruto.durationMinutes : null;
    herdados.duration_minutes = duracaoDaFonte ?? parseDurationMinutes(descricao, notas);
  }

  if (deduzir || alguMudou(mudados, ['price_display', 'is_free'])) {
    const gratis = (('is_free' in editado ? editado.is_free : proposto.is_free) ?? false) === true;
    const lido = parsePrice(final('price_display'));
    herdados.price_min = gratis ? 0 : (lido.priceMin ?? null);
    herdados.price_max = gratis ? null : (lido.priceMax ?? null);
  }

  if (alguMudou(mudados, ['venue_id', 'location_name'])) {
    delete herdados.latitude;
    delete herdados.longitude;
    delete herdados.location_address;
  }

  if (alguMudou(mudados, ['image_url'])) {
    // O crédito e a descrição eram do cartaz que saiu.
    delete herdados.image_credit;
    herdados.image_alt = final('image_url') ? titulo : null;
  }

  return herdados;
}

/** Os nomes por trás dos identificadores, para «O que chegou» não mostrar slugs. */
export interface NomesDaProposta {
  municipios: Readonly<Record<string, string>>;
  categorias: Readonly<Record<string, string>>;
  espacos: Readonly<Record<string, string>>;
}

const EIXOS_RECEBIDOS = [
  ['wheelchair_accessible', 'Acesso a cadeiras de rodas'],
  ['has_sign_language', 'Língua Gestual Portuguesa'],
  ['has_audio_description', 'Audiodescrição'],
  ['has_subtitles', 'Legendagem'],
  ['is_relaxed_performance', 'Sessão relaxada'],
] as const;

/**
 * O que chegou por programa, campo a campo, para quem modera o ver.
 *
 * Um envio por programa não tem texto em bruto — chega já em campos —, e a
 * coluna «O que chegou» dizia «Sem texto.» ao lado de um aviso de extração a
 * mandar preencher à mão. Quem moderava não tinha como saber o que a pessoa
 * enviara, e por isso também não via o que o formulário deixava cair. Agora
 * vê a lista, e é contra ela que confere o formulário.
 *
 * Só o que veio preenchido: um campo vazio não é uma coisa que chegou.
 */
export function camposRecebidos(
  payload: Record<string, unknown>,
  nomes: NomesDaProposta,
): Array<{ rotulo: string; valor: string }> {
  const campos: Array<{ rotulo: string; valor: string }> = [];
  const juntar = (rotulo: string, valor: string | null | undefined) => {
    if (valor && valor.trim() !== '') campos.push({ rotulo, valor: valor.trim() });
  };
  const de = (mapa: Readonly<Record<string, string>>, id: unknown): string | null => {
    const chave = textoOuNulo(id);
    return chave ? (mapa[chave] ?? chave) : null;
  };

  juntar('Título', textoOuNulo(payload.title));
  juntar('Concelho', de(nomes.municipios, payload.municipality_id));
  juntar('Espaço', de(nomes.espacos, payload.venue_id));
  juntar('Local', textoOuNulo(payload.location_name));
  juntar('Categoria', de(nomes.categorias, payload.category_slug));

  const sessoes = proposedSessions(payload)
    .filter((sessao) => sessao.date)
    .map((sessao) => (sessao.start ? `${sessao.date} às ${sessao.start}` : sessao.date));
  if (sessoes.length > 0) {
    juntar(
      payload.is_ongoing === true ? 'Em cartaz' : 'Datas',
      sessoes.join(payload.is_ongoing === true ? ' a ' : ' · '),
    );
  }

  if (payload.is_free === true) juntar('Entrada livre', 'sim');
  juntar('Preço', textoOuNulo(payload.price_display));
  const escrito = textoOuNulo(payload.price_raw);
  if (escrito && escrito !== textoOuNulo(payload.price_display))
    juntar('Preço, como foi escrito', escrito);
  juntar('Bilhetes', textoOuNulo(payload.ticketing_url));
  juntar('Página do evento', textoOuNulo(payload.source_url));
  juntar('Como chegar', textoOuNulo(payload.how_to_arrive));
  juntar('Acessibilidade', textoOuNulo(payload.accessibility_notes));
  for (const [coluna, rotulo] of EIXOS_RECEBIDOS) {
    if (payload[coluna] === true) juntar(rotulo, 'sim');
    else if (coluna === 'wheelchair_accessible' && payload[coluna] === false) juntar(rotulo, 'não');
  }
  juntar('Público', formatAudience(textoOuNulo(payload.audience)));
  if (typeof payload.min_age === 'number') juntar('Idade mínima', `${payload.min_age} anos`);
  juntar(
    'Duração',
    typeof payload.duration_minutes === 'number' ? formatDuration(payload.duration_minutes) : null,
  );
  const descricao = textoOuNulo(payload.description);
  juntar('Descrição', descricao ? (truncate(descricao, 280) ?? descricao) : null);
  return campos;
}

/**
 * O evento que vai à aprovação: o que o editor escreveu, por cima do que a
 * proposta trazia e o formulário não mostrava. Por cima, e não por baixo —
 * nenhum campo herdado pode desfazer uma escolha de quem modera.
 */
export function eventoParaAprovar(
  payload: Record<string, unknown>,
  proposto: Record<string, unknown>,
  editado: Record<string, unknown>,
): Record<string, unknown> {
  return { ...camposHerdados(payload, proposto, editado), ...editado };
}

/**
 * As sessões propostas, das três formas.
 *
 * A recolha e o envio por programa guardam-nas já como linhas —
 * `session_date`, `start_time`, `end_time` — e a extração como `dates`, com
 * `date` e `startTime` e sem fim.
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
 * O payload chega aninhado (`{ event: {...} }`) quando vem da recolha, e liso
 * quando vem da extração ou do envio por programa — ver `formaDoPayload`. A caixa «Em cartaz» lia só a forma lisa, e por isso vinha
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
