/**
 * O contrato de um adaptador.
 *
 * Um adaptador sabe ler um site e devolver `RawEvent[]`. Não sabe o que é a
 * base de dados, não resolve concelhos nem categorias e não decide o que é
 * publicável — isso é do harmonizador e do pipeline. Esta fronteira é o que
 * permite acrescentar uma fonte nova sem tocar em nada do resto.
 */

import { z } from 'zod';
import type { RawEvent, RawSession, SourceKind } from '@coreto/core';
import type { HttpClient } from './http.js';
import type { RunLogger } from './run-logger.js';

/** Uma linha de `public.sources`. */
export interface SourceRow {
  id: string;
  name: string;
  kind: SourceKind;
  municipality_id: string | null;
  /** A região de uma fonte sem concelho (migração 0106); nula com concelho. */
  region_id: string | null;
  venue_id: string | null;
  url: string;
  adapter: string;
  config: Record<string, unknown>;
  is_enabled: boolean;
  baseline_item_count: number | null;
  min_expected_items: number;
  consecutive_failures: number;
  circuit_open_until: string | null;
}

const sourceKindSchema: z.ZodType<SourceKind> = z.enum([
  'municipal_site',
  'venue_site',
  'pdf_agenda',
  'feed',
  'manual',
]);

export const sourceRowSchema: z.ZodType<SourceRow, unknown> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: sourceKindSchema,
  municipality_id: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  region_id: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  venue_id: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  url: z.string().min(1),
  adapter: z.string().min(1),
  config: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((value) => value ?? {}),
  is_enabled: z
    .boolean()
    .nullish()
    .transform((value) => value ?? true),
  baseline_item_count: z
    .number()
    .int()
    .nullish()
    .transform((value) => value ?? null),
  min_expected_items: z
    .number()
    .int()
    .nullish()
    .transform((value) => value ?? 0),
  consecutive_failures: z
    .number()
    .int()
    .nullish()
    .transform((value) => value ?? 0),
  circuit_open_until: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
});

/**
 * Um seletor ou uma lista de seletores.
 *
 * Aceitar a lista é o que permite ter valores por omissão que servem vários
 * CMS: tenta-se por ordem e fica-se pelo primeiro que casar, em vez de exigir
 * configuração para cada concelho.
 */
const selectorSchema = z
  .union([z.string().trim().min(1).max(200), z.array(z.string().trim().min(1).max(200)).max(10)])
  .transform((value) => (typeof value === 'string' ? [value] : value));

/**
 * Configuração de uma fonte, tal como vem da coluna `config`.
 *
 * É jsonb escrito à mão em SQL: um site que muda de tema resolve-se com um
 * `update`, sem deploy. Por isso passa por Zod como qualquer outro input
 * externo — uma configuração inválida tem de parar a fonte com uma mensagem
 * legível, não produzir uma recolha vazia que ninguém percebe.
 */
export const adapterConfigSchema = z.object({
  /** Páginas de listagem a percorrer. Sem isto, usa-se `sources.url`. */
  listUrls: z.array(z.string().url()).max(20).optional(),
  listSelector: selectorSchema.optional(),
  titleSelector: selectorSchema.optional(),
  dateSelector: selectorSchema.optional(),
  timeSelector: selectorSchema.optional(),
  linkSelector: selectorSchema.optional(),
  imageSelector: selectorSchema.optional(),
  descriptionSelector: selectorSchema.optional(),
  categorySelector: selectorSchema.optional(),
  venueSelector: selectorSchema.optional(),
  priceSelector: selectorSchema.optional(),
  /** Atributo de onde ler a data antes de a ler do texto (`datetime`, `content`). */
  dateAttribute: z.string().trim().min(1).max(40).optional(),
  /**
   * A data vem só do `dateSelector` — nunca do resto do cartão.
   *
   * Por omissão, um item cujo seletor de data não case ainda tem a data
   * procurada no texto todo do cartão: na maioria das listagens é o que salva o
   * evento. Há listagens onde é o contrário. O Centro Cultural Gil Vicente
   * mostra em cada cartão a data de publicação do post **e** a do espetáculo;
   * ler o cartão inteiro traria a de publicação, que é sempre uma data válida e
   * sempre a errada. Uma data errada leva alguém a uma porta fechada, e não se
   * dá por ela — foi assim que o feed de Minde publicou vinte e um eventos já
   * passados.
   *
   * Com isto ligado, o item fica sem data e o pipeline manda-o à moderação, com
   * o motivo escrito. Uma pessoa lê a página e decide. É mais lento e é certo.
   */
  dateOnlyFromSelector: z.boolean().optional(),
  /** Nome do espaço a assumir quando a fonte é de um equipamento só. */
  venueName: z.string().trim().min(1).max(200).optional(),
  /**
   * O local a assumir quando a fonte cobre um território e não uma casa.
   *
   * A agenda de uma junta de freguesia é a agenda **daquela** freguesia: isso
   * sabe-se por construção, não se adivinha do texto de cada evento. Sem isto,
   * um evento que a fonte publica sem dizer o sítio ficava sem lugar nenhum e
   * ia para a fila de moderação todas as noites — e a fila enche-se de coisas
   * que ninguém pode resolver, porque a informação não existe na origem.
   *
   * É o chão, não o tecto: um `venueName` que case com o catálogo ganha-lhe
   * sempre. Escreve-se por fonte, com a razão em `notes`.
   */
  locationName: z.string().trim().min(1).max(200).optional(),
  /** A freguesia da fonte, pela mesma razão e com o mesmo cuidado. */
  parish: z.string().trim().min(1).max(120).optional(),
  /**
   * Sufixo do slug que identifica o espaço dentro de uma bilheteira partilhada.
   *
   * Uma bilheteira municipal vende o teatro, o museu, o pavilhão e o trail pelo
   * mesmo domínio. Sem este filtro, importar a loja inteira pendurava uma
   * corrida de montanha na programação do cine-teatro. Quem não o declara leva
   * a loja toda — que é o correto numa loja de um equipamento só.
   */
  venueSlugSuffix: z.string().trim().min(1).max(120).optional(),
  /** Visitar a página de cada evento para enriquecer o que a listagem não dá. */
  followLinks: z.boolean().optional(),
  /**
   * Onde vive a descrição **na página do evento** — e não no cartão da lista.
   *
   * Só o `generic-html` a usa, e só com `followLinks`. É deliberadamente
   * obrigatória em vez de haver um palpite por omissão: o Centro Cultural Gil
   * Vicente publica uma sinopse de mil caracteres em `.column_attr` e serve
   * `og:description` a dizer «10/outubro | 21h30». Um palpite genérico
   * guardava a data como se fosse a descrição, e um campo com ar de
   * preenchido é pior do que um campo vazio — ninguém o vai rever.
   */
  detailDescriptionSelector: selectorSchema.optional(),
  /** O género/categoria na página do evento, pela mesma razão. */
  detailCategorySelector: selectorSchema.optional(),
  /**
   * Títulos que esta fonte publica na agenda e que não são eventos.
   *
   * Expressões simples («piscina municipal», «fábrica das artes»), comparadas
   * sem acentos nem caixa e por palavra inteira. É a decisão de uma pessoa,
   * tomada uma vez e escrita aqui — a recolha salta o item em vez de voltar a
   * perguntar todas as noites. O detetor genérico (`looksLikeMunicipalNotice`)
   * continua a valer para o que ninguém previu: esse manda à fila, não salta.
   */
  excludeTitles: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  /**
   * Valor do cabeçalho `Origin` que a fonte exige.
   *
   * Só para fontes cujo dono AUTORIZOU a recolha e cuja API verifica a origem
   * (Abrantes). A autorização fica anotada em `sources.notes`; sem ela, não se
   * configura — contornar um controlo de acesso sem autorização não é recolha,
   * é intrusão, e não é o que esta casa faz.
   */
  originHeader: z.string().url().optional(),
  /**
   * Não ler o RSS da mesma agenda como segunda opinião.
   *
   * A leitura cruzada é o que distingue «a agenda esvaziou» de «o seletor
   * partiu-se», e por isso está ligada por omissão. Fica a válvula para o dia
   * em que um site sirva um feed que não corresponda à listagem — melhor
   * desligá-la por SQL, com a razão em `notes`, do que ter um adaptador a
   * falhar alto por causa de um feed que mente.
   */
  skipFeed: z.boolean().optional(),
  maxItems: z.number().int().min(1).max(500).optional(),
  /** Tecto de páginas de detalhe visitadas numa execução. */
  maxDetailPages: z.number().int().min(0).max(200).optional(),
  /**
   * Quanto tempo esperar por esta fonte, quando os quinze segundos por omissão
   * não chegam.
   *
   * A primeira recolha do Teatro Virgínia mostrou porque isto é preciso: a
   * página da época pesa quase meio megabyte e responde em dois segundos a
   * partir daqui, mas esgotou o tempo três vezes seguidas a partir do executor
   * do GitHub. Um sítio lento visto de longe não é um sítio partido, e a
   * recolha não devia desistir dele como se fosse.
   *
   * Sobe-se por fonte e com a razão escrita em `notes` — nunca o valor por
   * omissão de todas, que é o que segura uma recolha inteira à espera de um
   * servidor que não responde.
   */
  timeoutMs: z.number().int().min(1_000).max(60_000).optional(),
  /**
   * Pedir a página sem compressão.
   *
   * Por omissão o cliente aceita gzip e brotli, que é o que poupa banda a
   * quem nos serve. Mas há servidores que comprimem a pedido, sem guardar o
   * resultado: numa página de meio megabyte isso é trabalho que eles fazem de
   * cada vez, e o Teatro Virgínia esgotava quarenta e cinco segundos a
   * responder ao executor enquanto servia a mesma página em seis a um pedido
   * que não pedia compressão.
   *
   * Liga-se por fonte, com a razão escrita: pedir tudo sem comprimir seria
   * gastar a banda de onze câmaras para resolver o caso de uma.
   */
  semCompressao: z.boolean().optional(),
});

export type AdapterConfig = z.infer<typeof adapterConfigSchema>;

export const ADAPTER_CONFIG_KEYS: readonly string[] = Object.keys(adapterConfigSchema.shape);

export interface ParsedAdapterConfig {
  config: AdapterConfig;
  /** Chaves que ninguém lê — quase sempre uma gralha no `update`. */
  unknownKeys: string[];
}

export function parseAdapterConfig(raw: Record<string, unknown>): ParsedAdapterConfig {
  const parsed = adapterConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
      .join('; ');
    throw new Error(`configuração da fonte inválida — ${issues}`);
  }
  return {
    config: parsed.data,
    unknownKeys: Object.keys(raw).filter((key) => !ADAPTER_CONFIG_KEYS.includes(key)),
  };
}

/**
 * O que sai de uma leitura de datas: as ocorrências, e se elas delimitam uma
 * coisa contínua.
 *
 * São duas respostas porque a pergunta «que datas tem este evento» tem mesmo
 * duas. «10, 11 e 12 de junho» são três compromissos e a lista está completa;
 * «10 a 12 de junho» são dois extremos de uma coisa que está patente pelo meio
 * — e a lista, sozinha, mente por omissão sobre o dia 11.
 *
 * Devolver só as sessões obrigava cada adaptador a adivinhar a diferença a
 * partir do número de linhas, que é precisamente o que não se consegue: duas
 * sessões tanto podem ser dois concertos como as pontas de uma exposição. Quem
 * lê a fonte é o único que sabe, e por isso é ele que o diz — em `isOngoing`,
 * que o harmonizador copia para `events.is_ongoing` e a ficha lê para escrever
 * «Em cartaz de X a Y» em vez de uma lista com um buraco.
 *
 * A regra por trás está escrita em `packages/core/src/dates.ts`: nunca
 * fabricar. Um intervalo dá dois extremos, nunca um dia por cada dia lá pelo
 * meio.
 */
export interface SourceDates {
  /** As ocorrências a gravar. Num intervalo, só os dois extremos. */
  sessions: RawSession[];
  /** Verdadeiro quando os extremos delimitam um período contínuo. */
  isOngoing: boolean;
}

export interface AdapterContext {
  source: SourceRow;
  http: HttpClient;
  log: RunLogger;
}

export interface Adapter {
  id: string;
  fetchEvents(context: AdapterContext): Promise<RawEvent[]>;
}
