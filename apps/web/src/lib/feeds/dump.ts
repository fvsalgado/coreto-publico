import { FEED_COPYRIGHT } from '@/src/lib/produto';
import type { EventCard } from '@/src/lib/queries/types';
import { eventUrl, type FeedContext } from './build';

/**
 * O catálogo de uma região num ficheiro só.
 *
 * **Porquê.** Cada resposta da API já declara a licença, e não havia um único
 * ficheiro para descarregar: quem quer o catálogo inteiro pagina de cem em cem.
 * Um ficheiro datado é a prova mais barata da promessa de devolver os dados a
 * quem os faz, e dá à CIM uma peça de dados abertos que não obriga ninguém a
 * explicar o que é uma API.
 *
 * **O que é, à letra — e o nome não é «o catálogo inteiro».** É o que a API
 * serve para esta região, de uma vez. Os eventos publicados cuja data é hoje ou
 * depois; não leva rascunhos, não leva escondidos, não leva o arquivo. Chamar-
 * lhe «tudo» seria a espécie de exagero que este projeto não faz — e por isso o
 * próprio ficheiro traz o campo `inclui` a dizê-lo, em português, a quem o
 * abrir.
 *
 * **As colunas são as do cartão, e mais nada.** O mesmo `CARD_EVENT_FIELDS` das
 * listagens, acrescido dos nomes que resolvem os identificadores — sem um
 * `select` amplo pelo meio. O `dump.test.ts` prende as duas metades: as colunas
 * que saem, e a lista do que **nunca** pode sair.
 */
export interface DumpDaRegiao {
  /** Quando a resposta foi construída, em ISO 8601 com fuso. */
  gerado_em: string;
  regiao: { id: string; nome: string };
  /** O recorte, escrito em português para quem abre o ficheiro. */
  inclui: string;
  /** Quantos eventos vão no ficheiro. */
  total: number;
  licenca: { nome: string; url: string; atribuicao: string };
  eventos: EventoDoDump[];
}

export interface EventoDoDump extends EventCard {
  url: string;
  municipality_name: string | null;
  category_name: string | null;
  venue_name: string | null;
  updated_at: string | null;
}

export const LICENCA_DO_DUMP = {
  nome: 'CC BY 4.0',
  url: 'https://creativecommons.org/licenses/by/4.0/',
  atribuicao: FEED_COPYRIGHT,
} as const;

export const INCLUI =
  'Os eventos publicados desta região cuja data é hoje ou depois. Não inclui rascunhos, eventos escondidos nem o arquivo do que já aconteceu.';

/**
 * As colunas do CSV, por esta ordem.
 *
 * Escrita à mão e presa por teste: um CSV cuja primeira linha muda sozinha
 * parte o leitor de quem o automatizou, e este ficheiro existe precisamente
 * para ser automatizado.
 */
export const COLUNAS_DO_DUMP = [
  'id',
  'slug',
  'url',
  'titulo',
  'resumo',
  'concelho_id',
  'concelho',
  'espaco_id',
  'espaco',
  'local',
  'categoria_id',
  'categoria',
  'confianca_da_categoria',
  'origem_da_categoria',
  'data_inicio',
  'data_fim',
  'em_cartaz',
  'entrada_livre',
  'preco',
  'imagem',
  'imagem_alt',
  'acesso_cadeira_de_rodas',
  'publico',
  'atualizado_em',
] as const;

export function construirDump(
  regiao: { id: string; nome: string },
  eventos: readonly EventCard[],
  context: FeedContext,
  agora: Date,
): DumpDaRegiao {
  return {
    gerado_em: agora.toISOString(),
    regiao,
    inclui: INCLUI,
    total: eventos.length,
    licenca: { ...LICENCA_DO_DUMP },
    eventos: eventos.map((evento) => ({
      ...evento,
      url: eventUrl(context.siteUrl, evento.slug),
      municipality_name: context.municipalityNames[evento.municipality_id] ?? null,
      category_name: evento.category_slug
        ? (context.categoryNames[evento.category_slug] ?? null)
        : null,
      venue_name: evento.venue_id ? (context.venueNames[evento.venue_id] ?? null) : null,
      updated_at: context.timestamps[evento.id] ?? null,
    })),
  };
}

/** Uma célula de CSV, com as aspas e o ponto e vírgula do Excel português. */
function celula(valor: string | number | boolean | null): string {
  if (valor === null) return '';
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não';
  const texto = String(valor);
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * O mesmo ficheiro em CSV, com os metadados à cabeça em linhas de comentário.
 *
 * O `#` no início da linha é a convenção que o Excel, o LibreOffice e o `pandas`
 * sabem saltar, e é a única forma de a data de geração e a licença viajarem
 * **dentro** do ficheiro sem estragar o cabeçalho das colunas. Sem isso, um CSV
 * descarregado hoje e aberto daqui a um ano não diz de quando é.
 */
export function dumpParaCsv(dump: DumpDaRegiao): string {
  const cabecalho = [
    `# Coreto — ${dump.regiao.nome}`,
    `# gerado em: ${dump.gerado_em}`,
    `# inclui: ${dump.inclui}`,
    `# total: ${dump.total}`,
    `# licença: ${dump.licenca.nome} (${dump.licenca.url})`,
    `# atribuição: ${dump.licenca.atribuicao}`,
  ];

  const linhas = dump.eventos.map((e) =>
    [
      e.id,
      e.slug,
      e.url,
      e.title,
      e.description_short,
      e.municipality_id,
      e.municipality_name,
      e.venue_id,
      e.venue_name,
      e.location_name,
      e.category_slug,
      e.category_name,
      e.category_confidence,
      e.category_source,
      e.date_start,
      e.date_end,
      e.is_ongoing,
      e.is_free,
      e.price_display,
      e.image_url,
      e.image_alt,
      e.wheelchair_accessible,
      e.audience,
      e.updated_at,
    ]
      .map(celula)
      .join(';'),
  );

  // BOM, ponto e vírgula e CRLF: as mesmas três decisões do relatório mensal,
  // e pela mesma razão — é no Excel em português que isto é aberto.
  return `﻿${[...cabecalho, COLUNAS_DO_DUMP.join(';'), ...linhas].join('\r\n')}\r\n`;
}
