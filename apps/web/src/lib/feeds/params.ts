import { eventFilterSchema, type EventFilter } from '@coreto/core';

/**
 * Leitura dos parâmetros de um feed público.
 *
 * Uma nota que custou uma tarde a perceber: `eventFilterSchema` usa
 * `z.coerce.boolean()`, e a coerção do JavaScript diz que a cadeia «false» é
 * verdadeira — tal como «0» e «não». Vindo de um formulário isso nunca se
 * nota, porque a agenda limpa os campos vazios antes de validar. Numa API
 * pública nota-se logo: alguém escreve `free=false` à espera de ver tudo e
 * recebe só o que é grátis. Aqui a normalização é explícita, e um valor que
 * não é nem verdadeiro nem falso é um erro, não um palpite.
 */

const TRUTHY = new Set(['1', 'true', 'sim', 'yes', 'on']);
const FALSY = new Set(['0', 'false', 'nao', 'não', 'no', 'off', '']);

const BOOLEAN_KEYS = ['free', 'accessible'] as const;

const SCALAR_KEYS = [
  'municipality',
  'category',
  'from',
  'to',
  'venue',
  'series',
  'q',
  'page',
  'limit',
] as const;

export type FilterErrors = Record<string, string[] | undefined>;

export type FilterOutcome = { ok: true; filter: EventFilter } | { ok: false; errors: FilterErrors };

export function readEventFilter(searchParams: URLSearchParams): FilterOutcome {
  const raw: Record<string, string> = {};

  for (const key of SCALAR_KEYS) {
    const value = searchParams.get(key)?.trim();
    if (value) raw[key] = value;
  }

  for (const key of BOOLEAN_KEYS) {
    const value = searchParams.get(key);
    if (value === null) continue;

    const normalized = value.trim().toLowerCase();
    if (TRUTHY.has(normalized)) {
      raw[key] = 'true';
      continue;
    }
    // Falso é «sem filtro» e não «só os pagos»: a consulta pública não sabe
    // filtrar ao contrário, e inventar essa semântica aqui era mentir.
    if (!FALSY.has(normalized)) {
      return { ok: false, errors: { [key]: ['Usa 1 ou 0 (também aceita true/false).'] } };
    }
  }

  const parsed = eventFilterSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  return { ok: true, filter: parsed.data };
}

export interface ApiParameter {
  name: string;
  values: string;
  description: string;
}

/**
 * A documentação dos parâmetros vive ao lado do código que os lê, e é a mesma
 * que sai na resposta de erro e na página `/fontes`. Documentação que se
 * escreve duas vezes fica desatualizada numa delas.
 */
export const API_PARAMETERS: readonly ApiParameter[] = [
  {
    name: 'municipality',
    values: 'tomar, abrantes, ourem, …',
    description: 'Identificador do concelho. Um só de cada vez.',
  },
  {
    name: 'category',
    values: 'musica, teatro, exposicoes, …',
    description: 'Categoria do evento, pelo identificador do catálogo.',
  },
  {
    name: 'from',
    values: 'AAAA-MM-DD',
    description: 'Só eventos a partir desta data. Por omissão, hoje.',
  },
  { name: 'to', values: 'AAAA-MM-DD', description: 'Só eventos que comecem até esta data.' },
  { name: 'free', values: '1 ou 0', description: 'A 1, devolve apenas eventos de entrada livre.' },
  {
    name: 'accessible',
    values: '1 ou 0',
    description: 'A 1, devolve apenas eventos com acesso declarado a cadeiras de rodas.',
  },
  { name: 'venue', values: 'identificador do espaço', description: 'Eventos de um espaço.' },
  {
    name: 'series',
    values: 'identificador do ciclo, como caminhos',
    description:
      'Eventos de um ciclo ou festival. O identificador de cada evento vem no campo `series_id` da própria resposta.',
  },
  {
    name: 'q',
    values: 'texto',
    description:
      'Pesquisa no título, no subtítulo, no sítio e no resumo — sem acentos e pelo radical das palavras: «fado» encontra «fados», «virginia» encontra «Virgínia».',
  },
  { name: 'page', values: '1 a 200', description: 'Página de resultados. Por omissão, 1.' },
  { name: 'limit', values: '1 a 100', description: 'Resultados por página. Por omissão, 24.' },
];
