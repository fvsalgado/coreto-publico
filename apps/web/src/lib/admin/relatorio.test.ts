import { describe, expect, it } from 'vitest';
import {
  escolherRegiao,
  lerMes,
  mesAnterior,
  nomeDoFicheiro,
  nomeDoMes,
  paraCsv,
  porqueSemHistorico,
  variacao,
  type RelatorioMensal,
} from './relatorio';

/**
 * O que aqui se prende é o que a página e as duas rotas de exportação têm em
 * comum — o mês por omissão, a validação do endereço, a escolha da região e o
 * CSV. São as partes que se entregam a quem financia, e as que mais custam
 * quando erram em silêncio: um mês trocado é um relatório de outro mês com o
 * título certo.
 */

const RELATORIO: RelatorioMensal = {
  region: { id: 'medio-tejo', name: 'Médio Tejo' },
  month: '2026-08',
  generated_at: '2026-09-02T09:15:00+00:00',
  events: {
    published_in_month: [
      {
        municipality_id: 'tomar',
        municipality_name: 'Tomar',
        category_slug: 'musica',
        category_name: 'Música',
        count: 12,
      },
      {
        municipality_id: 'tomar',
        municipality_name: 'Tomar',
        category_slug: null,
        category_name: null,
        count: 1,
      },
    ],
    happening_in_month: [
      { municipality_id: 'tomar', municipality_name: 'Tomar', count: 30 },
      { municipality_id: 'ourem', municipality_name: 'Ourém', count: 0 },
    ],
    totals: { published_in_month: 13, happening_in_month: 30, published_now: 120 },
  },
  sources: [
    {
      id: 'cm-tomar',
      name: 'Câmara Municipal de Tomar; agenda "oficial"',
      municipality_id: 'tomar',
      is_enabled: true,
      runs: 31,
      failures: 2,
      last_success_at: '2026-09-01T03:21:00+00:00',
      items_new_in_month: 14,
    },
    {
      id: 'caminhos',
      name: 'CAMINHOS',
      municipality_id: null,
      is_enabled: false,
      runs: 0,
      failures: 0,
      last_success_at: null,
      items_new_in_month: 0,
    },
  ],
  territory: {
    municipalities: 2,
    parishes: 8,
    municipal_sources_enabled: 2,
    parish_sources_enabled: 1,
  },
  submissions: {
    received_by_channel: { scraper: 40, email: 3, form: 0 },
    received: 43,
    reviewed: { approved: 5, rejected: 2, other: 1 },
  },
  quality: [
    {
      municipality_id: 'tomar',
      municipality_name: 'Tomar',
      published: 40,
      pending: 3,
      in_catalogue: 43,
      with_time: 30,
      with_venue: 20,
      with_image: 35,
      with_description: 41,
      with_price: 22,
      with_coordinates: 20,
    },
  ],
  quality_as_of: '2026-08-31',
  comparison: {
    observed_since: '2026-06-01',
    current: {
      from: '2026-09-01',
      to: '2026-09-30',
      events_published: 12,
      events_happening: 30,
      sessions_happening: 41,
      submissions_received: 9,
      submissions_approved: 7,
    },
    previous_month: {
      from: '2026-08-01',
      to: '2026-08-31',
      events_published: 8,
      events_happening: 24,
      sessions_happening: 33,
      submissions_received: 6,
      submissions_approved: 5,
    },
    same_month_last_year: null,
    year_to_date: {
      from: '2026-06-01',
      to: '2026-09-30',
      events_published: 40,
      events_happening: 70,
      sessions_happening: 95,
      submissions_received: 20,
      submissions_approved: 16,
    },
  },
  visits: {
    available: true,
    from: '2026-08-01',
    to: '2026-09-01',
    clicks_since: '2026-08-20',
    by_municipality: [
      {
        municipality_id: 'tomar',
        municipality_name: 'Tomar',
        views: 412,
        ticket_clicks: 37,
        ical_downloads: 9,
        shares: 4,
        clicks: 50,
        source_clicks: 12,
        directions_clicks: null,
      },
    ],
  },
};

describe('mesAnterior', () => {
  it('dá o mês que acabou, e vira o ano em janeiro', () => {
    expect(mesAnterior('2026-09-02')).toBe('2026-08');
    expect(mesAnterior('2026-01-15')).toBe('2025-12');
    expect(mesAnterior('2026-03-31')).toBe('2026-02');
    expect(mesAnterior('2026-11-01')).toBe('2026-10');
  });

  it('não adivinha a partir do que não é uma data', () => {
    expect(() => mesAnterior('ontem')).toThrow(/não é uma data/);
    expect(() => mesAnterior('2026-13-01')).toThrow(/não é uma data/);
  });
});

describe('lerMes', () => {
  it('aceita AAAA-MM e mais nada', () => {
    expect(lerMes('2026-08')).toBe('2026-08');
    expect(lerMes('2026-12')).toBe('2026-12');
    expect(lerMes('2026-13')).toBeNull();
    expect(lerMes('2026-00')).toBeNull();
    expect(lerMes('2026-8')).toBeNull();
    expect(lerMes('08-2026')).toBeNull();
    expect(lerMes('2026-08-01')).toBeNull();
    expect(lerMes('1999-01')).toBeNull();
    expect(lerMes('')).toBeNull();
    expect(lerMes(undefined)).toBeNull();
    expect(lerMes(null)).toBeNull();
  });
});

describe('nomeDoMes', () => {
  it('escreve o mês por extenso, em minúsculas como manda o português', () => {
    expect(nomeDoMes('2026-08')).toBe('agosto de 2026');
    expect(nomeDoMes('2027-01')).toBe('janeiro de 2027');
  });

  it('devolve o que recebeu quando não sabe o nome', () => {
    expect(nomeDoMes('2026-99')).toBe('2026-99');
  });
});

describe('escolherRegiao', () => {
  const REGIOES = [
    { id: 'vale-do-coreto', kind: 'montra' },
    { id: 'medio-tejo', kind: 'cim' },
    { id: 'travessia', kind: 'cim' },
  ];

  it('sem pedido, é a primeira que não é a montra', () => {
    expect(escolherRegiao(REGIOES, undefined)).toBe('medio-tejo');
    expect(escolherRegiao(REGIOES, '')).toBe('medio-tejo');
  });

  it('só a montra, é a montra; sem regiões, não há relatório', () => {
    expect(escolherRegiao([{ id: 'vale-do-coreto', kind: 'montra' }], undefined)).toBe(
      'vale-do-coreto',
    );
    expect(escolherRegiao([], undefined)).toBeNull();
  });

  it('a pedida vale se existir — a montra inclusive — e um endereço errado não se corrige em silêncio', () => {
    expect(escolherRegiao(REGIOES, 'travessia')).toBe('travessia');
    expect(escolherRegiao(REGIOES, 'vale-do-coreto')).toBe('vale-do-coreto');
    expect(escolherRegiao(REGIOES, 'beira-baixa')).toBeNull();
  });
});

describe('porqueSemHistorico', () => {
  const vazio = { available: false, clicks_since: null, by_municipality: [] };

  it('diz o que faltou, com as datas que há', () => {
    expect(porqueSemHistorico({ ...vazio, from: null, to: null })).toMatch(/nenhuma fotografia/);
    expect(porqueSemHistorico({ ...vazio, from: null, to: '2026-08-12' })).toMatch(
      /primeira fotografia dos contadores é de 2026-08-12/,
    );
    expect(porqueSemHistorico({ ...vazio, from: '2026-08-01', to: '2026-08-01' })).toMatch(
      /só há uma fotografia dos contadores, a de 2026-08-01/,
    );
  });
});

describe('nomeDoFicheiro', () => {
  it('leva a região e o mês, para dois relatórios não se confundirem na pasta', () => {
    expect(nomeDoFicheiro('medio-tejo', '2026-08', 'csv')).toBe('coreto-medio-tejo-2026-08.csv');
    expect(nomeDoFicheiro('travessia', '2026-08', 'json')).toBe('coreto-travessia-2026-08.json');
  });
});

describe('paraCsv', () => {
  const csv = paraCsv(RELATORIO);
  const linhas = csv.split('\r\n');

  it('começa com o BOM e acaba com uma quebra de linha, para o Excel ler acentos', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).not.toMatch(/[^\r]\n/);
  });

  it('tem os blocos todos, por esta ordem, cada um com o seu cabeçalho', () => {
    const cabecalhos = linhas.filter((l) => l.startsWith('seccao;') || l.startsWith('﻿seccao;'));
    expect(cabecalhos).toEqual([
      '﻿seccao;chave;valor',
      'seccao;concelho_id;concelho;categoria_id;categoria;eventos',
      'seccao;concelho_id;concelho;eventos',
      'seccao;chave;valor',
      'seccao;fonte_id;fonte;concelho_id;ligada;execucoes;falhas;ultimo_sucesso;itens_novos_no_mes',
      'seccao;chave;valor',
      'seccao;canal;recebidas',
      'seccao;desfecho;revistas',
      'seccao;concelho_id;concelho;publicados;por_publicar;no_catalogo;com_hora;com_espaco;com_imagem;com_descricao;com_preco;com_coordenadas',
      'seccao;janela;de;ate;eventos_publicados;eventos_a_decorrer;sessoes;submissoes_recebidas;submissoes_aprovadas',
      'seccao;chave;valor',
      'seccao;concelho_id;concelho;aberturas;bilhetica;calendario;partilhas;cliques;pagina_oficial;como_chegar',
    ]);
    // Uma linha vazia entre blocos, e nunca duas.
    expect(csv).not.toContain('\r\n\r\n\r\n');
  });

  it('leva o numerador e o denominador do território, e não a percentagem', () => {
    expect(linhas).toContain('territorio;concelhos;2');
    expect(linhas).toContain('territorio;freguesias;8');
    expect(linhas).toContain('territorio;camaras_ligadas;2');
    expect(linhas).toContain('territorio;juntas_ligadas;1');
    // A fração é de quem lê. Se um dia aparecer aqui uma percentagem, é porque
    // alguém achou que a fazia melhor do que a técnica que recebe o ficheiro.
    expect(csv).not.toMatch(/territorio;[^;]+;[\d.,]+%/);
  });

  it('deixa as freguesias em branco quando falta contar um concelho', () => {
    // Nulo é «não consegui saber», e não zero: um zero num denominador é uma
    // divisão por zero à espera, na folha de cálculo de quem abrir isto.
    const semDenominador = paraCsv({
      ...RELATORIO,
      territory: { ...RELATORIO.territory, parishes: null },
    });
    expect(semDenominador.split('\r\n')).toContain('territorio;freguesias;');
  });

  it('escreve cada linha com o nome da secção à cabeça', () => {
    expect(linhas).toContain('relatorio;regiao;Médio Tejo');
    expect(linhas).toContain('relatorio;mes;2026-08');
    expect(linhas).toContain('eventos_publicados_no_mes;tomar;Tomar;musica;Música;12');
    expect(linhas).toContain('eventos_a_decorrer_no_mes;ourem;Ourém;0');
    expect(linhas).toContain('totais;publicados_no_mes;13');
    expect(linhas).toContain('submissoes_recebidas;Formulário;0');
    expect(linhas).toContain('submissoes_revistas;Aprovadas;5');
    expect(linhas).toContain('qualidade;tomar;Tomar;40;3;43;30;20;35;41;22;20');
    expect(linhas).toContain('visitas;fotografia_de;2026-08-01');
    // `source_clicks` vem preenchido e `directions_clicks` a nulo: é o caso
    // real de um mês em que só um dos dois contadores tinha as duas
    // fotografias, e o vazio no fim é o que distingue «não medi» de «zero».
    expect(linhas).toContain('visitas_por_concelho;tomar;Tomar;412;37;9;4;50;12;');
  });

  it('protege o separador e as aspas, e deixa o resto sem aspas', () => {
    expect(linhas).toContain(
      'fontes;cm-tomar;"Câmara Municipal de Tomar; agenda ""oficial""";tomar;sim;31;2;2026-09-01T03:21:00+00:00;14',
    );
  });

  it('escreve o que não há como célula vazia e os booleanos em português', () => {
    expect(linhas).toContain('eventos_publicados_no_mes;tomar;Tomar;;;1');
    expect(linhas).toContain('fontes;caminhos;CAMINHOS;;não;0;0;;0');
    expect(linhas).toContain('visitas;disponivel;sim');
  });

  it('uma quebra de linha dentro de um nome fica entre aspas, e não parte a tabela', () => {
    const comQuebra: RelatorioMensal = {
      ...RELATORIO,
      region: { id: 'medio-tejo', name: 'Médio\nTejo' },
    };
    expect(paraCsv(comQuebra)).toContain('relatorio;regiao;"Médio\nTejo"');
  });

  it('um mês sem fotografias diz que não tem visitas em vez de inventar zeros', () => {
    const semHistorico: RelatorioMensal = {
      ...RELATORIO,
      visits: {
        available: false,
        from: null,
        to: '2026-09-01',
        clicks_since: null,
        by_municipality: [],
      },
    };
    const semVisitas = paraCsv(semHistorico).split('\r\n');
    expect(semVisitas).toContain('visitas;disponivel;não');
    expect(semVisitas).toContain('visitas;fotografia_de;');
    expect(semVisitas).toContain('visitas;fotografia_ate;2026-09-01');
    expect(semVisitas.filter((l) => l.startsWith('visitas_por_concelho;'))).toEqual([]);
  });
});

/**
 * A variação, por palavras e por sinal.
 *
 * O plano pede «valor absoluto e percentagem, por palavras e por sinal — a
 * casa não tem cores de estado». A razão é que uma seta vermelha decide pelo
 * leitor o que é bom: um mês com menos submissões pode ser um mês em que a
 * recolha automática passou a trazer tudo, e o relatório não sabe qual dos
 * dois é.
 */
describe('a variação entre duas janelas', () => {
  it('diz quantos a mais e quanto por cento', () => {
    const v = variacao(8, 12);
    expect(v.absoluto).toBe(4);
    expect(v.percentagem).toBe(50);
    expect(v.palavras).toBe('4 mais, 50% acima');
  });

  it('a descer, diz «menos» e «abaixo» — e não um sinal negativo por palavras', () => {
    const v = variacao(20, 15);
    expect(v.absoluto).toBe(-5);
    expect(v.percentagem).toBe(-25);
    expect(v.palavras).toBe('5 menos, 25% abaixo');
  });

  /**
   * De zero para cinco não são «mais infinito por cento» nem «mais 500%». São
   * cinco onde não havia nenhum, e é isso que se escreve. Uma percentagem com
   * denominador zero é a forma mais fácil de um relatório publicar um número
   * que não quer dizer nada.
   */
  it('de zero não tira percentagem nenhuma', () => {
    const v = variacao(0, 5);
    expect(v.absoluto).toBe(5);
    expect(v.percentagem).toBeNull();
    expect(v.palavras).toBe('5 mais, de 0 para 5');
  });

  it('para zero é uma queda de cem por cento, que é verdade', () => {
    const v = variacao(5, 0);
    expect(v.absoluto).toBe(-5);
    expect(v.percentagem).toBe(-100);
    expect(v.palavras).toBe('5 menos, 100% abaixo');
  });

  it('igual escreve-se «igual», e não «0 mais, 0% acima»', () => {
    expect(variacao(7, 7).palavras).toBe('igual');
    expect(variacao(0, 0).palavras).toBe('igual');
    expect(variacao(0, 0).percentagem).toBeNull();
  });

  it('arredonda ao ponto percentual, como o resto da casa', () => {
    // 3 em 7 são 42,857…%
    expect(variacao(7, 10).percentagem).toBe(43);
  });
});

/**
 * O CSV das comparações deixa de fora as janelas que não se podem comparar.
 * Um zero num ficheiro entregue lê-se como uma medição, e ninguém mediu um
 * mês que começou antes de a região passar a ser observada.
 */
describe('o bloco «comparacao» do CSV', () => {
  it('leva uma linha por janela que existe, e nenhuma pelas que não', () => {
    const linhas = paraCsv(RELATORIO)
      .split('\n')
      .filter((l) => l.startsWith('comparacao;') || l.startsWith('comparacao,'));
    const janelas = linhas.map((l) => l.split(/[;,]/)[1]);
    expect(janelas).toContain('mes');
    expect(janelas).toContain('mes_anterior');
    expect(janelas).toContain('acumulado_do_ano');
    // O fixture não tem homólogo: a região não tinha um ano de registo.
    expect(janelas).not.toContain('homologo');
  });

  it('leva as sessões, que é a unidade do INE', () => {
    expect(paraCsv(RELATORIO)).toMatch(/sessoes/);
  });
});
