/**
 * O relatório mensal de uma região: o tipo, e o que se faz com ele sem tocar
 * na base.
 *
 * O JSON é o que `monthly_report` (migração 0120) devolve, tal e qual — o
 * tipo daqui é a promessa do lado de cá, e a migração documenta a mesma
 * forma do lado de lá. As funções são puras de propósito: escolher o mês e a
 * região, validar o que vem no endereço e escrever o CSV são coisas que se
 * provam sem servidor, e é aqui que a página e as duas rotas de exportação as
 * vão buscar — para os três dizerem o mesmo.
 */

export interface RelatorioMensal {
  region: { id: string; name: string };
  /** `AAAA-MM`. */
  month: string;
  /** Quando a base o produziu, em ISO 8601 com fuso. */
  generated_at: string;
  events: {
    /** O que foi ao ar no mês, por concelho e categoria — só o que existe. */
    published_in_month: Array<{
      municipality_id: string;
      municipality_name: string;
      category_slug: string | null;
      category_name: string | null;
      count: number;
    }>;
    /** O que está publicado e acontece no mês, com todos os concelhos. */
    happening_in_month: Array<{
      municipality_id: string;
      municipality_name: string;
      count: number;
    }>;
    totals: {
      published_in_month: number;
      happening_in_month: number;
      /** O que está publicado hoje — não tem histórico, e a página di-lo. */
      published_now: number;
    };
  };
  sources: Array<{
    id: string;
    name: string;
    municipality_id: string | null;
    is_enabled: boolean;
    runs: number;
    failures: number;
    last_success_at: string | null;
    items_new_in_month: number;
  }>;
  /**
   * Quanto do território está ligado — o numerador e o denominador de «26 das
   * 84 juntas já publicam na agenda regional» (0137).
   *
   * `parishes` é `null` quando um concelho da região ainda não tem as
   * freguesias contadas. Somar só os que têm dava um denominador menor sem
   * ninguém escrever nada de falso, que é a mentira mais barata que há numa
   * fração: quem lê não pode distinguir «26 em 84» de «26 em 72».
   */
  territory: {
    municipalities: number;
    parishes: number | null;
    municipal_sources_enabled: number;
    parish_sources_enabled: number;
  };
  submissions: {
    received_by_channel: { scraper: number; email: number; form: number };
    received: number;
    reviewed: { approved: number; rejected: number; other: number };
  };
  /**
   * A qualidade do catálogo, uma linha por concelho.
   *
   * Desde a 0145 é a **última fotografia tirada dentro do mês** quando há
   * uma — o estado com que o mês fechou. Sem fotografia no mês é o catálogo
   * tal como está hoje, como sempre foi, e `quality_as_of` diz qual dos dois
   * é. Ler isto sem ler essa data é ler um número sem saber de que dia é.
   */
  quality: Array<{
    municipality_id: string;
    municipality_name: string;
    published: number;
    pending: number;
    in_catalogue: number;
    with_time: number;
    with_venue: number;
    with_image: number;
    with_description: number;
    with_price: number;
    with_coordinates: number;
  }>;
  /**
   * O dia da fotografia que `quality` traz, ou `null` quando não houve
   * nenhuma nesse mês e a qualidade é a de hoje.
   *
   * A mesma forma que `visits.clicks_since`: o relatório prefere escrever «a
   * partir de» a mostrar um número que não mediu.
   */
  quality_as_of: string | null;
  visits: {
    /** Falso quando não há duas fotografias com que contar o mês. */
    available: boolean;
    /** O dia da fotografia de partida, ou `null` se não existiu. */
    from: string | null;
    /** O dia da fotografia de chegada, ou `null` se não existiu. */
    to: string | null;
    /**
     * O dia da primeira fotografia que traz os contadores da 0141 — o clique na
     * página oficial e o «como chegar». `null` enquanto não houver nenhuma.
     *
     * É o que deixa a página escrever «a partir de 14 de setembro» em vez de
     * deixar dois nulos por explicar.
     */
    clicks_since: string | null;
    by_municipality: Array<{
      municipality_id: string;
      municipality_name: string;
      views: number;
      ticket_clicks: number;
      ical_downloads: number;
      shares: number;
      clicks: number;
      /**
       * `null` quando uma das duas fotografias do mês não tinha o contador.
       * Zero diria que ninguém carregou; ninguém carregou porque não havia
       * botão que contasse.
       */
      source_clicks: number | null;
      directions_clicks: number | null;
    }>;
  };
}

/** Os canais de entrada, com o nome por que o painel os trata. */
export const CANAIS = { scraper: 'Recolha', email: 'Email', form: 'Formulário' } as const;

/** Os desfechos de uma revisão, tal como o relatório os agrupa. */
export const DESFECHOS = {
  approved: 'Aprovadas',
  rejected: 'Rejeitadas',
  other: 'Outras',
} as const;

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/**
 * Um mês é `AAAA-MM`, e deste século: é o que o `<input type="month">`
 * escreve e o que a função da base recebe (com o dia 1 colado). Qualquer
 * outra coisa não é para ir à base.
 */
const FORMA_DO_MES = /^20\d\d-(0[1-9]|1[0-2])$/;

/** O mês vindo do endereço, ou `null` quando não é um mês. */
export function lerMes(param: string | null | undefined): string | null {
  if (!param) return null;
  return FORMA_DO_MES.test(param) ? param : null;
}

/**
 * O mês anterior ao dia dado (`AAAA-MM-DD`), em `AAAA-MM`.
 *
 * É o mês por omissão do relatório: quem abre a página no dia 2 quer o mês
 * que acabou, não o que começou anteontem. Trabalha sobre o texto da data,
 * de propósito — o `Date` do JavaScript e o fuso do servidor já enganaram
 * este projeto vezes que cheguem.
 */
export function mesAnterior(hoje: string): string {
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error(`mesAnterior: «${hoje}» não é uma data AAAA-MM-DD`);
  }
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, '0')}`;
}

/** «agosto de 2026», para o título de um relatório que se entrega em papel. */
export function nomeDoMes(mes: string): string {
  const nome = MESES[Number(mes.slice(5, 7)) - 1];
  return nome ? `${nome} de ${mes.slice(0, 4)}` : mes;
}

/**
 * A região do relatório: a pedida, se existe; senão a primeira que não é a
 * montra — o Vale do Coreto é uma demonstração, e ninguém presta contas por
 * ela. Pedir uma que não existe dá `null`, e não a primeira: um endereço
 * errado tem de se ver, não de se corrigir em silêncio.
 */
export function escolherRegiao(
  regioes: ReadonlyArray<{ id: string; kind: string }>,
  pedida: string | null | undefined,
): string | null {
  if (pedida) return regioes.some((regiao) => regiao.id === pedida) ? pedida : null;
  return (regioes.find((regiao) => regiao.kind !== 'montra') ?? regioes[0])?.id ?? null;
}

/**
 * Porque é que um mês não tem visitas, dito com as datas que há.
 *
 * A base devolve `available: false` e as duas datas que encontrou; a frase é
 * daqui, para a página e o CSV não terem de a inventar cada um à sua
 * maneira. Os três casos são os únicos possíveis: a fotografia de chegada
 * existe sempre que a de partida existe, porque procura-se mais tarde.
 */
export function porqueSemHistorico(visitas: RelatorioMensal['visits']): string {
  if (!visitas.from && !visitas.to) {
    return 'Ainda não há nenhuma fotografia dos contadores: a primeira tira-se na próxima recolha noturna.';
  }
  if (!visitas.from) {
    return `A primeira fotografia dos contadores é de ${visitas.to}, já depois de o mês ter começado. Só se contam meses inteiros, entre duas fotografias.`;
  }
  return `Até ao fim deste mês só há uma fotografia dos contadores, a de ${visitas.from}. Sem uma segunda não há intervalo para contar.`;
}

/** `coreto-medio-tejo-2026-08.csv` — o nome com que o ficheiro se descarrega. */
export function nomeDoFicheiro(regiao: string, mes: string, extensao: 'csv' | 'json'): string {
  return `coreto-${regiao}-${mes}.${extensao}`;
}

type Celula = string | number | boolean | null | undefined;

/**
 * Ponto e vírgula, e não vírgula, de propósito: é o separador que o Excel em
 * português espera, e um CSV com vírgulas abre-se lá numa coluna só. O BOM à
 * cabeça é pela mesma razão — sem ele o Excel lê «Ourém» como «OurÃ©m».
 */
const SEPARADOR = ';';
const BOM = '﻿';

function celula(valor: Celula): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'sim' : 'não';
  const texto = String(valor);
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function linha(campos: readonly Celula[]): string {
  return campos.map(celula).join(SEPARADOR);
}

/**
 * Um bloco do CSV: o cabeçalho, e uma linha por registo com o nome da secção
 * na primeira coluna. É por essa coluna que se filtra no Excel, e é o
 * cabeçalho de cada bloco que diz o que as outras colunas são — as secções
 * não têm as mesmas colunas, e fingir que têm era um CSV que ninguém lia.
 */
function bloco(
  seccao: string,
  cabecalho: readonly string[],
  linhas: readonly Celula[][],
): string[] {
  return [linha(['seccao', ...cabecalho]), ...linhas.map((campos) => linha([seccao, ...campos]))];
}

/**
 * O relatório inteiro num CSV só, por blocos separados por uma linha vazia.
 *
 * Um ficheiro por secção era mais puro e menos útil: quem descarrega quer
 * uma coisa para anexar, não uma pasta. Os números vão como contagens, nunca
 * como percentagens — a percentagem é uma leitura, e quem recebe o ficheiro
 * faz a sua.
 */
export function paraCsv(relatorio: RelatorioMensal): string {
  const { events, sources, submissions, quality, visits, territory } = relatorio;

  const blocos: string[][] = [
    bloco(
      'relatorio',
      ['chave', 'valor'],
      [
        ['regiao_id', relatorio.region.id],
        ['regiao', relatorio.region.name],
        ['mes', relatorio.month],
        ['gerado_em', relatorio.generated_at],
        // Vazia quando o mês não teve fotografia e a qualidade é a de hoje.
        // Uma coluna vazia diz «não medi» melhor do que uma data emprestada.
        ['qualidade_de', relatorio.quality_as_of ?? ''],
      ],
    ),
    bloco(
      'eventos_publicados_no_mes',
      ['concelho_id', 'concelho', 'categoria_id', 'categoria', 'eventos'],
      events.published_in_month.map((l) => [
        l.municipality_id,
        l.municipality_name,
        l.category_slug,
        l.category_name,
        l.count,
      ]),
    ),
    bloco(
      'eventos_a_decorrer_no_mes',
      ['concelho_id', 'concelho', 'eventos'],
      events.happening_in_month.map((l) => [l.municipality_id, l.municipality_name, l.count]),
    ),
    bloco(
      'totais',
      ['chave', 'valor'],
      [
        ['publicados_no_mes', events.totals.published_in_month],
        ['a_decorrer_no_mes', events.totals.happening_in_month],
        ['publicados_hoje', events.totals.published_now],
      ],
    ),
    bloco(
      'fontes',
      [
        'fonte_id',
        'fonte',
        'concelho_id',
        'ligada',
        'execucoes',
        'falhas',
        'ultimo_sucesso',
        'itens_novos_no_mes',
      ],
      sources.map((f) => [
        f.id,
        f.name,
        f.municipality_id,
        f.is_enabled,
        f.runs,
        f.failures,
        f.last_success_at,
        f.items_new_in_month,
      ]),
    ),
    bloco(
      'territorio',
      ['chave', 'valor'],
      [
        ['concelhos', territory.municipalities],
        // Vazio e não zero quando falta contar um concelho: «não consegui
        // saber» e «não há» são duas respostas diferentes, e numa folha de
        // cálculo um zero num denominador é uma divisão por zero à espera.
        ['freguesias', territory.parishes],
        ['camaras_ligadas', territory.municipal_sources_enabled],
        ['juntas_ligadas', territory.parish_sources_enabled],
      ],
    ),
    bloco(
      'submissoes_recebidas',
      ['canal', 'recebidas'],
      (Object.keys(CANAIS) as Array<keyof typeof CANAIS>).map((canal) => [
        CANAIS[canal],
        submissions.received_by_channel[canal],
      ]),
    ),
    bloco(
      'submissoes_revistas',
      ['desfecho', 'revistas'],
      (Object.keys(DESFECHOS) as Array<keyof typeof DESFECHOS>).map((desfecho) => [
        DESFECHOS[desfecho],
        submissions.reviewed[desfecho],
      ]),
    ),
    bloco(
      'qualidade',
      [
        'concelho_id',
        'concelho',
        'publicados',
        'por_publicar',
        'no_catalogo',
        'com_hora',
        'com_espaco',
        'com_imagem',
        'com_descricao',
        'com_preco',
        'com_coordenadas',
      ],
      quality.map((q) => [
        q.municipality_id,
        q.municipality_name,
        q.published,
        q.pending,
        q.in_catalogue,
        q.with_time,
        q.with_venue,
        q.with_image,
        q.with_description,
        q.with_price,
        q.with_coordinates,
      ]),
    ),
    bloco(
      'visitas',
      ['chave', 'valor'],
      [
        ['disponivel', visits.available],
        ['fotografia_de', visits.from],
        ['fotografia_ate', visits.to],
        ['cliques_desde', visits.clicks_since],
      ],
    ),
    bloco(
      'visitas_por_concelho',
      [
        'concelho_id',
        'concelho',
        'aberturas',
        'bilhetica',
        'calendario',
        'partilhas',
        'cliques',
        'pagina_oficial',
        'como_chegar',
      ],
      visits.by_municipality.map((v) => [
        v.municipality_id,
        v.municipality_name,
        v.views,
        v.ticket_clicks,
        v.ical_downloads,
        v.shares,
        v.clicks,
        // Vazio, e não zero, quando uma das fotografias do mês ainda não tinha
        // o contador: numa folha de cálculo um zero soma-se e um vazio não.
        v.source_clicks,
        v.directions_clicks,
      ]),
    ),
  ];

  return `${BOM}${blocos.map((linhas) => linhas.join('\r\n')).join('\r\n\r\n')}\r\n`;
}
