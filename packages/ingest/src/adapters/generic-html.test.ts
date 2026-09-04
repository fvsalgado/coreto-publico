import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseAdapterConfig } from '../adapter';
import { RunLogger } from '../run-logger';
import { HttpClient } from '../http';
import type { SourceRow } from '../adapter';
import { extractBySelectors, genericHtmlAdapter } from './generic-html';

/** Um registo mudo: estes testes olham para o que sai, não para os avisos. */
const registo = () => new RunLogger({ sourceId: 'ccgv-sardoal', output: () => undefined });

/**
 * Captura viva de 29 de agosto de 2026, da programação do Centro Cultural Gil
 * Vicente. Seis dos nove blocos que a página servia.
 */
const CCGV = readFileSync(
  fileURLToPath(new URL('../__fixtures__/ccgv-sardoal.html', import.meta.url)),
  'utf8',
);

const CCGV_URL = 'https://ccgv.sardoal.pt/programacao/';

/**
 * A configuração da fonte `ccgv-sardoal`, tal como a migração 0058 a escreve.
 *
 * Está aqui em duplicado de propósito: o teste prova que estes seletores leem
 * esta página, e a asserção de esquema (`scripts/schema-checks.sql`) prova que
 * é isto que está na base. Se alguém mudar a configuração em SQL sem passar
 * por aqui, é a asserção que apanha.
 */
const CCGV_CONFIG_BRUTA: Record<string, unknown> = {
  listSelector: ['article.post-item'],
  titleSelector: ['h3.entry-title'],
  linkSelector: ['h3.entry-title a'],
  dateSelector: ['.post-excerpt'],
  timeSelector: ['.post-excerpt'],
  imageSelector: ['img.wp-post-image'],
  dateOnlyFromSelector: true,
  venueName: 'Centro Cultural Gil Vicente',
};

const CCGV_CONFIG = parseAdapterConfig(CCGV_CONFIG_BRUTA).config;

/**
 * O CCGV escreve «10/outubro» e nunca o ano.
 *
 * O ano é inferido do dia em que a recolha corre — é a leitura certa para uma
 * listagem do que está para vir, mas faz o resultado depender do relógio. Sem
 * fixar o dia, este teste passava hoje e falhava em novembro por razão nenhuma
 * a ver com o adaptador.
 */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-29T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Centro Cultural Gil Vicente', () => {
  const eventos = () =>
    extractBySelectors({
      html: CCGV,
      pageUrl: CCGV_URL,
      config: CCGV_CONFIG,
      log: registo(),
    });

  it('lê os seis espetáculos, com a data que a fonte diz', () => {
    expect(
      eventos().map((evento) => [evento.title, evento.dates[0]?.date, evento.dates[0]?.startTime]),
    ).toEqual([
      ['Celebratorium', '2026-10-10', '21:30'],
      ['Acordeão em Festa!', '2026-10-18', '16:00'],
      ['Palavra Puxa Palavra', '2026-10-24', '21:30'],
      ['O Primogénito', '2026-10-30', '21:30'],
      ['ARTE', '2026-11-14', '21:30'],
      ['Coro dos Comuns', '2026-11-29', '16:00'],
    ]);
  });

  it('não confunde a data do espetáculo com a de publicação do post', () => {
    // Cada cartão mostra as duas: `.date_label` diz «27 de Julho, 2026», que é
    // quando o post foi escrito, e `.post-excerpt` diz «10/outubro | 21h30»,
    // que é quando o espetáculo é. Julho de 2026 já passou.
    expect(CCGV).toContain('27 de Julho, 2026');
    for (const evento of eventos()) {
      for (const sessao of evento.dates) {
        expect(sessao.date >= '2026-08-29').toBe(true);
      }
    }
  });

  it('leva a ligação e o cartaz de cada espetáculo', () => {
    const [primeiro] = eventos();
    expect(primeiro?.sourceUrl).toBe(
      'https://ccgv.sardoal.pt/celebratorium-luis-de-freitas-branco/',
    );
    expect(primeiro?.imageUrl).toBe(
      'https://ccgv.sardoal.pt/wp-content/uploads/2026/07/32458_1600x1000-960x750.jpg',
    );
  });

  it('assina o espaço, que o catálogo conhece pelo nome', () => {
    // O evento não diz onde é: a página inteira é de uma casa só. O nome vem da
    // configuração e casa com `centro-cultural-gil-vicente` no catálogo, que
    // sabe que é no Sardoal.
    expect(eventos().map((evento) => evento.venueName)).toEqual(
      Array(6).fill('Centro Cultural Gil Vicente'),
    );
  });
});

describe('dateOnlyFromSelector', () => {
  /**
   * Um cartão como o nono da listagem do CCGV: sem `.post-excerpt`, porque não
   * é um espetáculo com dia mas o programa de cinema do mês. O que sobra no
   * cartão é a data de publicação — uma data válida, e a errada.
   */
  const SEM_EXCERPT = `<article class="post post-item">
      <div class="date_label">30 de Julho, 2026</div>
      <div class="post-title"><h3 class="entry-title"><a href="/cinema-agosto/">Cinema agosto/ 2026</a></h3></div>
    </article>`;

  const ler = (dateOnlyFromSelector: boolean) =>
    extractBySelectors({
      html: SEM_EXCERPT,
      pageUrl: CCGV_URL,
      config: parseAdapterConfig({
        listSelector: ['article.post-item'],
        titleSelector: ['h3.entry-title'],
        dateSelector: ['.post-excerpt'],
        dateOnlyFromSelector,
      }).config,
      log: registo(),
    });

  it('fica sem data em vez de ler a de publicação', () => {
    const [evento] = ler(true);
    expect(evento?.title).toBe('Cinema agosto/ 2026');
    expect(evento?.dates).toEqual([]);
    // Sem data, o pipeline manda-o à fila com «sem data legível na fonte» —
    // uma pessoa abre a página e decide. Ver `motivoDaRevisao`.
  });

  it('sem a opção, continua a ler a data do cartão inteiro', () => {
    // O comportamento por omissão não muda: na maioria das listagens é ele que
    // salva o evento cujo seletor de data falhou.
    expect(ler(false)[0]?.dates[0]?.date).toBe('2026-07-30');
  });
});

/**
 * Um intervalo é um intervalo, e não uma lista com buracos.
 *
 * O HTML destes casos é escrito aqui e não capturado de um site porque o que
 * está em prova não é a marcação — é a leitura do texto da data. Os cartões
 * têm a forma exacta dos do CCGV (`article.post-item` com a data em
 * `.post-excerpt`), que é a que a fixture verdadeira traz e a que a
 * configuração da fonte `ccgv-sardoal` espera; o que muda é a frase da data,
 * e é essa a variável.
 */
describe('intervalos', () => {
  const cartao = (titulo: string, data: string) => `<article class="post post-item">
      <div class="post-title"><h3 class="entry-title"><a href="/${slugDoTitulo(titulo)}/">${titulo}</a></h3></div>
      <div class="post-excerpt">${data}</div>
    </article>`;

  const ler = (data: string) =>
    extractBySelectors({
      html: cartao('Evento', data),
      pageUrl: CCGV_URL,
      config: CCGV_CONFIG,
      log: registo(),
    })[0];

  /*
   * O caso que a ficha contradizia.
   *
   * «10 a 12 de junho» dava duas sessões — 10 e 12 — e mais nada. A ficha
   * escrevia «2 sessões» e listava os dois dias, o que é dizer a quem lê que
   * no dia 11 não há nada; e o cartão ao lado dizia «10–12 jun», porque
   * `date_start` e `date_end` saem dos mesmos extremos e ficavam certos. A
   * mesma página a afirmar duas coisas incompatíveis.
   */
  it('«10 a 12 de junho» são dois extremos de uma coisa contínua', () => {
    const evento = ler('10 a 12 de junho de 2027');

    expect(evento?.dates.map((sessao) => sessao.date)).toEqual(['2027-06-10', '2027-06-12']);
    // E o dia 11 não fica por afirmar: o evento sai marcado como em cartaz, e
    // a ficha escreve o intervalo inteiro em vez de uma lista de dois dias.
    expect(evento?.isOngoing).toBe(true);
  });

  it('uma exposição de três meses não fabrica noventa sessões', () => {
    const evento = ler('Exposição patente de 1 de junho a 30 de agosto de 2027');

    expect(evento?.dates.map((sessao) => sessao.date)).toEqual(['2027-06-01', '2027-08-30']);
    expect(evento?.isOngoing).toBe(true);
  });

  it('uma lista continua a ser uma lista de compromissos', () => {
    // «10, 11 e 12» são três sessões que a fonte afirmou uma a uma. Nada aqui
    // é um intervalo, e marcá-lo como em cartaz apagava três compromissos.
    const evento = ler('10, 11 e 12 de junho de 2027');

    expect(evento?.dates.map((sessao) => sessao.date)).toEqual([
      '2027-06-10',
      '2027-06-11',
      '2027-06-12',
    ]);
    expect(evento?.isOngoing).toBe(false);
  });

  it('uma data isolada não está «em curso» coisa nenhuma', () => {
    const evento = ler('10 de junho de 2027 | 21h30');

    expect(evento?.dates).toEqual([{ date: '2027-06-10', startTime: '21:30' }]);
    expect(evento?.isOngoing).toBe(false);
  });

  /*
   * O caso ambíguo, deixado como estava de propósito.
   *
   * «10 a 12 de junho e 20 de junho» traz um intervalo **e** uma data solta. As
   * três datas ficam como sessões, e o evento não é marcado como em cartaz: os
   * dias 13 a 19 não foram anunciados por ninguém, e um período de 10 a 20
   * prometia-os. Na dúvida não se acrescenta afirmação nenhuma — é a mesma
   * disciplina de `parsePortugueseDate`, que devolve `null` quando a leitura
   * não é inequívoca.
   */
  it('não estica um período por cima de uma data solta', () => {
    const evento = ler('Exposição de 10 a 12 de junho de 2027. Visita guiada a 20 de junho.');

    expect(evento?.dates.map((sessao) => sessao.date)).toEqual([
      '2027-06-10',
      '2027-06-12',
      '2027-06-20',
    ]);
    expect(evento?.isOngoing).toBe(false);
  });
});

/** O endereço do cartão, para o adaptador ter uma chave estável por título. */
function slugDoTitulo(titulo: string): string {
  return titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * A passagem pela página do evento.
 *
 * A listagem do Centro Cultural Gil Vicente dá título, data e cartaz, e mais
 * nada. A sinopse — mil caracteres a dizer o que o espetáculo é — está só na
 * página de cada um, e sem ela a ficha do Coreto ficava com um título e um
 * mapa. Oito dos espetáculos publicados a 30 de agosto de 2026 estavam assim.
 *
 * As páginas são as verdadeiras, capturadas nesse dia.
 */
describe('genericHtmlAdapter com followLinks', () => {
  const EVENTO = readFileSync(
    fileURLToPath(new URL('../__fixtures__/ccgv-sardoal-evento.html', import.meta.url)),
    'utf8',
  );

  const fonte = (config: Record<string, unknown>): SourceRow => ({
    id: 'ccgv-sardoal',
    name: 'Centro Cultural Gil Vicente',
    kind: 'venue_site',
    municipality_id: 'sardoal',
    region_id: null,
    venue_id: null,
    url: CCGV_URL,
    adapter: 'generic-html',
    config,
    is_enabled: true,
    baseline_item_count: null,
    min_expected_items: 0,
    consecutive_failures: 0,
    circuit_open_until: null,
  });

  const colher = (config: Record<string, unknown>) =>
    genericHtmlAdapter.fetchEvents({
      source: fonte(config),
      http: new HttpClient({
        minHostIntervalMs: 0,
        sleep: () => Promise.resolve(),
        fetchImpl: (input) =>
          Promise.resolve(
            new Response(String(input) === CCGV_URL ? CCGV : EVENTO, { status: 200 }),
          ),
      }),
      log: registo(),
    });

  const CONFIG_COM_DETALHE = {
    ...CCGV_CONFIG_BRUTA,
    followLinks: true,
    detailDescriptionSelector: ['.column_attr'],
  };

  it('traz a sinopse que a listagem não dá', async () => {
    const eventos = await colher(CONFIG_COM_DETALHE);
    expect(eventos.length).toBeGreaterThan(0);
    for (const evento of eventos) {
      expect(evento.description).toBeTruthy();
      expect((evento.description ?? '').length).toBeGreaterThan(200);
    }
  });

  /*
   * A armadilha, e a razão de os seletores do detalhe serem obrigatórios.
   *
   * O CCGV serve `og:description` a dizer «10/outubro | 21h30» — a data. Um
   * palpite genérico, como o que o `municipal-cms` pode dar-se ao luxo de
   * fazer porque as suas fontes publicam JSON-LD, guardaria isso como se
   * fosse a descrição do espetáculo. Um campo com ar de preenchido nunca mais
   * é revisto por ninguém.
   */
  it('não confunde o og:description com a descrição', async () => {
    const [evento] = await colher(CONFIG_COM_DETALHE);
    expect(evento?.description).not.toContain('21h30');
    expect(evento?.description).toContain('Luís de Freitas Branco');
  });

  it('sem followLinks não gasta um pedido sequer', async () => {
    const eventos = await colher(CCGV_CONFIG_BRUTA);
    expect(eventos.every((evento) => evento.description === null)).toBe(true);
  });

  it('um tecto de zero páginas desliga a passagem', async () => {
    const eventos = await colher({ ...CONFIG_COM_DETALHE, maxDetailPages: 0 });
    expect(eventos.every((evento) => evento.description === null)).toBe(true);
  });
});
