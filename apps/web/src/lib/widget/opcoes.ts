/**
 * As opções do widget, escritas uma vez só.
 *
 * Isto é lido por três sítios que têm de concordar: a página embebida, que as
 * parseia da cadeia de consulta; o script `embed.js`, que traduz atributos
 * `data-…` em cadeia de consulta; e o construtor de `/widget`, que gera o
 * código para copiar. Já esteve espalhado por esses três, e o resultado
 * previsível foi uma opção documentada que a página não lia.
 *
 * A regra que atravessa tudo: **um valor mau nunca parte a caixa**. Um erro de
 * escrita no sítio de uma câmara vale o valor por omissão, não um widget em
 * branco no meio da página dela.
 */

import { z } from 'zod';

const TRUTHY = new Set(['1', 'true', 'sim', 'on']);
const FALSY = new Set(['0', 'false', 'nao', 'não', 'off']);

/** `sim`/`nao` que aceita as duas grafias e o inglês, e cai no valor dado. */
function booleano(omissao: boolean) {
  return z
    .string()
    .optional()
    .transform((valor) => {
      const limpo = (valor ?? '').trim().toLowerCase();
      if (TRUTHY.has(limpo)) return true;
      if (FALSY.has(limpo)) return false;
      return omissao;
    });
}

const slug = z
  .string()
  .max(80)
  .regex(/^[a-z0-9-]+$/)
  .optional()
  .catch(undefined);

/**
 * As três disposições, e para que serve cada uma.
 *
 * Não são gostos diferentes da mesma coisa: são feitios de buraco diferentes.
 * Uma coluna lateral de duzentos pixéis não tem onde pôr um cartaz; uma faixa
 * a toda a largura de uma página de entrada fica ridícula com uma lista de
 * texto encostada à esquerda.
 */
export const DISPOSICOES = ['lista', 'cartazes', 'mural'] as const;
export type Disposicao = (typeof DISPOSICOES)[number];

export const TEMAS = ['auto', 'light', 'dark'] as const;

export const widgetOptionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5).catch(5),
  category: slug,
  venue: slug,
  series: slug,
  /** Texto livre; quem o transforma em consulta é `consultaDePesquisa`. */
  q: z.string().trim().max(120).optional().catch(undefined),
  free: booleano(false),
  theme: z.enum(TEMAS).default('auto').catch('auto'),
  layout: z.enum(DISPOSICOES).default('cartazes').catch('cartazes'),
  /** Hex sem validação de forma aqui: quem a valida é `lerCor`, que a normaliza. */
  color: z.string().max(9).optional().catch(undefined),
  /** Pilha de `font-family`; quem a saneia é `lerTipoDeLetra`. */
  font: z.string().max(200).optional().catch(undefined),
  header: booleano(true),
  frame: booleano(true),
});

export type WidgetOptions = z.infer<typeof widgetOptionsSchema>;

type SearchParams = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export function lerOpcoes(searchParams: SearchParams): WidgetOptions {
  const bruto = {
    limit: primeiro(searchParams.limit),
    category: primeiro(searchParams.category)?.trim().toLowerCase(),
    venue: primeiro(searchParams.venue)?.trim().toLowerCase(),
    series: primeiro(searchParams.series)?.trim().toLowerCase(),
    // Sem `toLowerCase`: a pesquisa não olha à caixa nem aos acentos (0116),
    // e o que aqui entra é escrito de volta no construtor tal como veio.
    q: primeiro(searchParams.q)?.trim(),
    free: primeiro(searchParams.free),
    theme: primeiro(searchParams.theme)?.trim().toLowerCase(),
    layout: primeiro(searchParams.layout)?.trim().toLowerCase(),
    color: primeiro(searchParams.color)?.trim(),
    // Sem `toLowerCase`: «Open Sans» é um nome próprio, e ainda que o CSS
    // case as famílias sem olhar à caixa, o que aqui entra também é escrito
    // de volta no construtor.
    font: primeiro(searchParams.font)?.trim(),
    header: primeiro(searchParams.header),
    frame: primeiro(searchParams.frame),
  };

  const parsed = widgetOptionsSchema.safeParse(bruto);
  // Um `safeParse` que falha inteiro devolve os valores por omissão. Acontece
  // quando um campo sem `.catch()` recebe lixo; nenhum tem, hoje, mas o dia em
  // que alguém acrescentar um sem ele não pode ser o dia em que o widget
  // rebenta no sítio de uma câmara.
  return parsed.success ? parsed.data : widgetOptionsSchema.parse({});
}

/** O que o construtor precisa de saber para desenhar um controlo. */
export interface DefinicaoOpcao {
  atributo: string;
  parametro: string;
  valores: string;
  omissao: string;
  descricao: string;
}

export const CATALOGO: readonly DefinicaoOpcao[] = [
  {
    atributo: 'data-concelho',
    parametro: '(no endereço)',
    valores: 'tomar, abrantes, ourem, …',
    omissao: 'obrigatório',
    descricao: 'O concelho cuja programação aparece na caixa.',
  },
  {
    atributo: 'data-espaco',
    parametro: 'venue',
    valores: 'teatro-virginia, miaa, …',
    omissao: 'o concelho todo',
    descricao:
      'Restringe a caixa a um espaço. É esta a opção para um museu ou uma coletividade que só quer mostrar a sua própria programação.',
  },
  {
    atributo: 'data-ciclo',
    parametro: 'series',
    valores: 'caminhos, volver, …',
    omissao: 'todos',
    descricao:
      'Restringe a caixa a um ciclo ou festival. Serve a quem organiza um: a caixa passa a mostrar só o programa dele, no concelho escolhido.',
  },
  {
    atributo: 'data-categoria',
    parametro: 'category',
    valores: 'musica, teatro, exposicoes, …',
    omissao: 'todas',
    descricao: 'Restringe a caixa a uma categoria.',
  },
  {
    atributo: 'data-limit',
    parametro: 'limit',
    valores: '1 a 20',
    omissao: '5',
    descricao: 'Quantos eventos mostrar.',
  },
  {
    atributo: 'data-gratis',
    parametro: 'free',
    valores: 'sim',
    omissao: 'desligado',
    descricao: 'Mostra apenas eventos de entrada livre.',
  },
  {
    atributo: 'data-disposicao',
    parametro: 'layout',
    valores: 'cartazes, lista, mural',
    omissao: 'cartazes',
    descricao:
      'Cartazes para uma coluna normal, lista para uma coluna estreita sem espaço para imagens, mural para uma faixa larga.',
  },
  {
    atributo: 'data-cor',
    parametro: 'color',
    valores: '#14676b, #b0122a, …',
    omissao: 'o turquesa do Coreto',
    descricao:
      'A cor da instituição. Onde é texto, é escurecida ou aclarada até se ler sobre o fundo — a caixa nunca fica ilegível por causa de uma cor de marca.',
  },
  {
    atributo: 'data-tema',
    parametro: 'theme',
    valores: 'auto, light, dark',
    omissao: 'auto',
    descricao:
      'Com auto, a caixa segue a preferência de quem visita. Fixem light ou dark se o vosso sítio tiver um fundo só.',
  },
  {
    atributo: 'data-letra',
    parametro: 'font',
    valores: 'Open Sans, Georgia, serif, …',
    omissao: 'a letra do Coreto',
    descricao:
      'O tipo de letra do vosso sítio, para a caixa deixar de se distinguir do resto da página. Escrevam a pilha como a têm no CSS. (Herdar não dá: um iframe tem documento próprio e o CSS não atravessa a fronteira.)',
  },
  {
    atributo: 'data-cabecalho',
    parametro: 'header',
    valores: 'sim, nao',
    omissao: 'sim',
    descricao: 'Desliguem se a vossa página já tiver um título por cima da caixa.',
  },
  {
    atributo: 'data-moldura',
    parametro: 'frame',
    valores: 'sim, nao',
    omissao: 'sim',
    descricao: 'A linha à volta da caixa. Desliguem para a fundir com o vosso fundo.',
  },
  {
    atributo: 'data-titulo',
    parametro: '(só no script)',
    valores: 'texto',
    omissao: 'Agenda cultural — Coreto',
    descricao: 'O nome que os leitores de ecrã anunciam ao encontrar a caixa.',
  },
  {
    atributo: 'data-pesquisa',
    parametro: 'q',
    valores: 'texto',
    omissao: 'sem pesquisa',
    descricao:
      'Só eventos com estas palavras no título, no subtítulo, no sítio ou no resumo — sem acentos e pelo radical: «fado» encontra «fados». É a opção para uma filarmónica ou um festival que quer mostrar só o que é seu.',
  },
];

/** O que o construtor tem em mãos, antes de virar endereço ou código. */
export interface Escolhas {
  concelho: string;
  espaco?: string;
  ciclo?: string;
  categoria?: string;
  limite: number;
  /** Palavras que os eventos têm de ter, ou nada. */
  pesquisa?: string;
  gratis: boolean;
  disposicao: Disposicao;
  cor?: string;
  tema: (typeof TEMAS)[number];
  /** Pilha de `font-family` tal como quem embebe a escreve, ou nada. */
  letra?: string;
  cabecalho: boolean;
  moldura: boolean;
}

/**
 * A cadeia de consulta, só com o que difere do valor por omissão.
 *
 * Um endereço que repete os valores de fábrica é mais comprido, mais difícil
 * de ler e mais fácil de estragar ao copiar. E dá pior cache: `?limit=5` e o
 * endereço sem nada são a mesma página com duas chaves diferentes.
 */
export function consultaDoWidget(escolhas: Escolhas): string {
  const partes: string[] = [];
  if (escolhas.espaco) partes.push(`venue=${escolhas.espaco}`);
  if (escolhas.ciclo) partes.push(`series=${escolhas.ciclo}`);
  if (escolhas.categoria) partes.push(`category=${escolhas.categoria}`);
  if (escolhas.limite !== 5) partes.push(`limit=${escolhas.limite}`);
  if (escolhas.pesquisa) partes.push(`q=${encodeURIComponent(escolhas.pesquisa)}`);
  if (escolhas.gratis) partes.push('free=1');
  if (escolhas.disposicao !== 'cartazes') partes.push(`layout=${escolhas.disposicao}`);
  if (escolhas.cor) partes.push(`color=${encodeURIComponent(escolhas.cor)}`);
  if (escolhas.tema !== 'auto') partes.push(`theme=${escolhas.tema}`);
  if (escolhas.letra) partes.push(`font=${encodeURIComponent(escolhas.letra)}`);
  if (!escolhas.cabecalho) partes.push('header=nao');
  if (!escolhas.moldura) partes.push('frame=nao');
  return partes.join('&');
}

export function enderecoDoWidget(base: string, escolhas: Escolhas): string {
  const consulta = consultaDoWidget(escolhas);
  return `${base}/widget/${escolhas.concelho}${consulta ? `?${consulta}` : ''}`;
}

/** O `<script>` para colar, com uma linha por opção que não é a de fábrica. */
export function codigoDoScript(base: string, escolhas: Escolhas): string {
  const linhas = [`  src="${base}/widget/embed.js"`, `  data-concelho="${escolhas.concelho}"`];
  if (escolhas.espaco) linhas.push(`  data-espaco="${escolhas.espaco}"`);
  if (escolhas.ciclo) linhas.push(`  data-ciclo="${escolhas.ciclo}"`);
  if (escolhas.categoria) linhas.push(`  data-categoria="${escolhas.categoria}"`);
  if (escolhas.limite !== 5) linhas.push(`  data-limit="${escolhas.limite}"`);
  // As aspas saem: um atributo HTML acaba na primeira que encontrar.
  if (escolhas.pesquisa) {
    linhas.push(`  data-pesquisa="${escolhas.pesquisa.replace(/"/g, ' ').trim()}"`);
  }
  if (escolhas.gratis) linhas.push('  data-gratis="sim"');
  if (escolhas.disposicao !== 'cartazes') linhas.push(`  data-disposicao="${escolhas.disposicao}"`);
  if (escolhas.cor) linhas.push(`  data-cor="${escolhas.cor}"`);
  if (escolhas.tema !== 'auto') linhas.push(`  data-tema="${escolhas.tema}"`);
  if (escolhas.letra) linhas.push(`  data-letra="${escolhas.letra}"`);
  if (!escolhas.cabecalho) linhas.push('  data-cabecalho="nao"');
  if (!escolhas.moldura) linhas.push('  data-moldura="nao"');
  return `<script\n${linhas.join('\n')}\n  async></script>`;
}

/** Altura de arranque do `iframe` sem script, por disposição e número. */
export function alturaEstimada(escolhas: Escolhas): number {
  const cabeca = escolhas.cabecalho ? 44 : 0;
  const rodape = 40;
  const porEvento =
    escolhas.disposicao === 'lista' ? 62 : escolhas.disposicao === 'mural' ? 118 : 96;
  const linhas = escolhas.disposicao === 'mural' ? Math.ceil(escolhas.limite / 2) : escolhas.limite;
  return cabeca + rodape + linhas * porEvento + 24;
}

export function codigoDoIframe(base: string, escolhas: Escolhas, titulo: string): string {
  return `<iframe\n  src="${enderecoDoWidget(base, escolhas)}"\n  title="${titulo}"\n  width="100%"\n  height="${alturaEstimada(escolhas)}"\n  loading="lazy"\n  style="border:0"></iframe>`;
}
