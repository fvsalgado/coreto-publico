import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SourceRow } from '../adapter.js';
import { HttpClient } from '../http.js';
import { RunLogger } from '../run-logger.js';
import { escolherCartaz, joomlaEventBookingAdapter } from './joomla-eventbooking.js';

/**
 * Estes testes correm contra as páginas verdadeiras, capturadas dos sites das
 * câmaras. É de propósito: a alternativa — HTML escrito à mão dentro do teste —
 * foi o que produziu um adaptador com oito seletores de lista e nenhum deles a
 * casar com o que estes sites servem.
 *
 * Quando um destes testes falhar, a hipótese mais provável não é o adaptador
 * ter partido: é o site ter mudado. E é para isso que servem.
 */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__');

function fixture(nome: string): string {
  return readFileSync(join(FIXTURES, `${nome}.html`), 'utf8');
}

function source(id: string, url: string, municipio: string): SourceRow {
  return {
    id,
    name: id,
    kind: 'municipal_site',
    municipality_id: municipio,
    region_id: null,
    venue_id: null,
    url,
    adapter: 'joomla-eventbooking',
    config: {},
    is_enabled: true,
    baseline_item_count: null,
    min_expected_items: 0,
    consecutive_failures: 0,
    circuit_open_until: null,
  };
}

function stubHttp(pages: Record<string, string>): HttpClient {
  return new HttpClient({
    minHostIntervalMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: (input) => {
      const url = String(input);
      const body = pages[url];
      if (body === undefined) return Promise.resolve(new Response('', { status: 404 }));
      return Promise.resolve(new Response(body, { status: 200 }));
    },
  });
}

async function colher(nome: string, url: string, municipio: string) {
  const row = source(nome, url, municipio);
  return joomlaEventBookingAdapter.fetchEvents({
    source: row,
    http: stubHttp({ [url]: fixture(nome) }),
    log: new RunLogger({ sourceId: nome, output: () => undefined }),
  });
}

const TOMAR = 'https://www.cm-tomar.pt/comunicacao/agenda';
const SARDOAL = 'https://www.cm-sardoal.pt/comunicacao/agenda';

describe('joomla-eventbooking, contra páginas verdadeiras', () => {
  it('lê os eventos de Tomar com chave estável', async () => {
    const events = await colher('tomar', TOMAR, 'tomar');

    expect(events.length).toBeGreaterThan(0);
    // A chave vem do identificador numérico da classe, não do slug: um título
    // com gralha corrigida não pode criar um evento novo.
    for (const event of events) {
      expect(event.sourceKey).toMatch(/^eb-\d+$/);
    }
    expect(new Set(events.map((e) => e.sourceKey)).size).toBe(events.length);
  });

  // O caso que só as fixtures revelaram: em Tomar o título é uma ligação, no
  // Sardoal é texto solto. Ler só `.eb-event-title` traria um e não o outro.
  it('lê o título nas duas marcações, com ligação e sem ela', async () => {
    const tomar = await colher('tomar', TOMAR, 'tomar');
    const sardoal = await colher('sardoal', SARDOAL, 'sardoal');

    expect(tomar.every((e) => e.title.length > 0)).toBe(true);
    expect(sardoal.every((e) => e.title.length > 0)).toBe(true);
    expect(sardoal.some((e) => e.title.includes('Ser em Construção'))).toBe(true);
  });

  it('não fabrica dias entre os extremos de um intervalo', async () => {
    const events = await colher('tomar', TOMAR, 'tomar');
    // «02/06/2026 - 30/09/2026» são dois pontos, não cento e vinte dias.
    for (const event of events) {
      expect(event.dates.length).toBeLessThanOrEqual(2);
    }
    const comIntervalo = events.find((e) => e.dates.length === 2);
    expect(comIntervalo).toBeDefined();
    expect(comIntervalo!.dates[0]!.date < comIntervalo!.dates[1]!.date).toBe(true);
  });

  /**
   * Não fabricar dias resolvia metade; esta é a outra metade.
   *
   * A listagem verdadeira de Tomar traz «02/06/2026 - 30/09/2026»,
   * «03/06/2026 … - 27/09/2026», «13/06/2026 - 13/09/2026» — exposições e
   * programas de meses. Os dois extremos já ficavam gravados sem os dias do
   * meio, e isso estava certo; o que ninguém dizia é que eram *extremos*. A
   * ficha lia duas sessões, escrevia «2 sessões» e mostrava o dia de abrir e o
   * dia de fechar — a afirmar, a quem lesse, que nos quatro meses do meio não
   * havia nada para ver. Em produção eram 49 eventos assim, nenhum deles
   * marcado.
   */
  it('marca em cartaz o que a fonte declara com princípio e fim', async () => {
    const events = await colher('tomar', TOMAR, 'tomar');

    const comIntervalo = events.filter((e) => e.dates.length === 2);
    expect(comIntervalo.length).toBeGreaterThan(0);
    for (const event of comIntervalo) {
      expect(event.isOngoing, `«${event.title}» tem dois extremos e não diz que são extremos`).toBe(
        true,
      );
    }

    // E um dia só continua a ser um dia só: um espetáculo não está «em cartaz».
    for (const event of events.filter((e) => e.dates.length === 1)) {
      expect(event.isOngoing ?? false).toBe(false);
    }
  });

  it('lê as datas em ISO, a partir do formato português', async () => {
    const events = await colher('tomar', TOMAR, 'tomar');
    for (const event of events) {
      for (const session of event.dates) {
        expect(session.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  // A armadilha de dez concelhos: o campo do preço quase nunca tem um preço.
  it('não põe nomes de espaços na coluna do preço', async () => {
    const events = await colher('tomar', TOMAR, 'tomar');

    for (const event of events) {
      if (event.priceRaw) {
        // Só entra em `priceRaw` o que o leitor de preços reconhece.
        expect(event.priceRaw).toMatch(/gratuit|livre|grátis|€|\d/i);
      }
    }
    // E o nome do espaço, quando lá está, vai para onde deve.
    expect(events.some((e) => e.venueName?.includes('Complexo Cultural'))).toBe(true);
    expect(events.some((e) => e.priceRaw?.length)).toBe(false);
  });

  it('reconhece um preço verdadeiro quando o campo traz um', async () => {
    const lidos = await colher(
      'macao',
      'https://www.cm-macao.pt/index.php/comunicacao/eventos',
      'macao',
    );
    const gratuitos = lidos.filter((e) => e.priceRaw);
    if (gratuitos.length > 0) {
      expect(gratuitos.every((e) => /gratuit|livre/i.test(e.priceRaw!))).toBe(true);
      expect(gratuitos.every((e) => e.venueName === null)).toBe(true);
    }
  });

  it('traz a categoria do caminho do endereço', async () => {
    const events = await colher('tomar', TOMAR, 'tomar');
    const categorias = events.flatMap((e) => e.categoriesRaw ?? []);

    expect(categorias.length).toBeGreaterThan(0);
    // Rótulos verdadeiros, não identificadores numéricos.
    for (const categoria of categorias) {
      expect(categoria).toMatch(/^[a-z0-9-]+$/);
      expect(categoria).not.toBe('agenda');
    }
  });

  it('não confunde a ligação do mapa com a do evento', async () => {
    const events = await colher('tomar', TOMAR, 'tomar');
    for (const event of events) {
      expect(event.sourceUrl ?? '').not.toContain('view-map');
    }
  });

  it('avisa, em vez de devolver vazio em silêncio, quando não reconhece nada', async () => {
    const avisos: string[] = [];
    const url = 'https://exemplo.pt/agenda';
    const events = await joomlaEventBookingAdapter.fetchEvents({
      source: source('vazia', url, 'tomar'),
      http: stubHttp({ [url]: '<html><body><article>sem eventos</article></body></html>' }),
      log: new RunLogger({
        sourceId: 'vazia',
        output: (linha: string) => {
          avisos.push(linha);
        },
      }),
    });

    expect(events).toEqual([]);
    expect(avisos.some((linha) => linha.includes('eb-event-wrapper'))).toBe(true);
  });
});

describe('as dez fontes capturadas', () => {
  const fontes: Array<[string, string, string]> = [
    ['alcanena', 'https://cm-alcanena.pt/index.php/comunicacao/agenda', 'alcanena'],
    ['constancia', 'https://www.cm-constancia.pt/comunicacao/agenda', 'constancia'],
    ['entroncamento', 'https://www.cm-entroncamento.pt/index.php/agenda', 'entroncamento'],
    [
      'ferreira-do-zezere',
      'https://cm-ferreiradozezere.pt/comunicacao/agenda',
      'ferreira-do-zezere',
    ],
    ['macao', 'https://www.cm-macao.pt/index.php/comunicacao/eventos', 'macao'],
    ['sardoal', 'https://www.cm-sardoal.pt/comunicacao/agenda', 'sardoal'],
    ['tomar', 'https://www.cm-tomar.pt/comunicacao/agenda', 'tomar'],
  ];

  // O mesmo adaptador tem de servir todos. Um concelho que traga zero é uma
  // recolha vazia em silêncio — exatamente o que se está a tentar evitar.
  it.each(fontes)('traz eventos de %s', async (nome, url, municipio) => {
    const events = await colher(nome, url, municipio);

    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.title.trim()).not.toBe('');
      expect(event.dates.length).toBeGreaterThan(0);
      expect(event.sourceKey).toMatch(/^eb-\d+$/);
    }
  });
});

/**
 * A hora, lida de onde a câmara a escreveu.
 *
 * Em produção, 22 dos 108 eventos publicados por vir não tinham hora em sessão
 * nenhuma — e nas listagens capturadas ela estava lá: no segundo `.eb-time`,
 * que não se lia, e na prosa do bloco, que também não.
 */
describe('joomla-eventbooking e as horas', () => {
  const ENTRONCAMENTO = 'https://www.cm-entroncamento.pt/index.php/agenda';
  const MACAO = 'https://www.cm-macao.pt/index.php/comunicacao/eventos';

  it('lê os dois `.eb-time` de um intervalo — a hora de abrir e a de fechar', async () => {
    const events = await colher('tomar', TOMAR, 'tomar');
    // «11/09/2026 18:00 - 13/09/2026 23:00», tal e qual na listagem. Lia-se
    // só o 18:00.
    const artInRua = events.find((e) => e.title === 'Art In Rua 2026');
    expect(artInRua?.dates).toEqual([
      { date: '2026-09-11', startTime: '18:00' },
      { date: '2026-09-13', startTime: '23:00' },
    ]);
    expect(artInRua?.isOngoing).toBe(true);
  });

  it('num dia só, o segundo `.eb-time` é a hora a que acaba', async () => {
    const events = await colher('sardoal', SARDOAL, 'sardoal');
    // «05/09/2026 16:00 - 23:30»: uma data, duas horas.
    const cinema = events.find((e) => e.title.startsWith('Cinema “Homem-Aranha'));
    expect(cinema?.dates).toEqual([{ date: '2026-09-05', startTime: '16:00', endTime: '23:30' }]);
  });

  it('lê o relógio de doze horas de Alcanena como a fonte o escreve', async () => {
    const events = await colher(
      'alcanena',
      'https://cm-alcanena.pt/index.php/comunicacao/agenda',
      'alcanena',
    );
    // «18/09/2026 6:00 pm - 8:00 pm». Lia-se «6:00» e marcava-se a cerimónia
    // para as seis da manhã.
    const cerimonia = events.find((e) => e.title.startsWith('Cerimónia “Regenerar Alcanena”'));
    expect(cerimonia?.dates).toEqual([
      { date: '2026-09-18', startTime: '18:00', endTime: '20:00' },
    ]);
  });

  it('sem `.eb-time`, lê a hora que a prosa do bloco afirma', async () => {
    const events = await colher('macao', MACAO, 'macao');
    // «15/07/2026 - 31/08/2026» sem hora no campo; a prosa diz «Inauguração:
    // 15 de julho | 18h30 | Galeria Carlos Saramago». Só o dia de abrir a
    // recebe — o de fechar não é o da inauguração.
    const exposicao = events.find((e) =>
      e.title.startsWith('EXPOSIÇÃO - NA PAISAGEM DO MÉDIO TEJO'),
    );
    expect(exposicao?.dates).toEqual([
      { date: '2026-07-15', startTime: '18:30' },
      { date: '2026-08-31' },
    ]);
  });

  it('com o campo a dar o início, a prosa acrescenta o fim — se falar do mesmo início', async () => {
    const events = await colher('entroncamento', ENTRONCAMENTO, 'entroncamento');
    // «12/09/2026 10:00» no campo; «entre as 10h00 e as 13h00» na prosa.
    const feira = events.find((e) => e.title === '3º Edição Feira para todos');
    expect(feira?.dates).toEqual([{ date: '2026-09-12', startTime: '10:00', endTime: '13:00' }]);
  });

  it('duas horas na prosa não dão hora nenhuma', async () => {
    const events = await colher('entroncamento', ENTRONCAMENTO, 'entroncamento');
    // «todos os sábados … às 19h30h e domingos às 10h00m»: nenhuma das duas é
    // «a hora» do evento, e escolher uma era adivinhar.
    const yoga = events.find((e) => e.title === 'Verão Ativo 2026 - Yoga');
    expect(yoga?.dates).toEqual([{ date: '2026-06-20' }, { date: '2026-09-30' }]);
  });
});

describe('escolherCartaz — a imagem grande da página do evento', () => {
  const DESCRICAO = readFileSync(join(FIXTURES, 'macao-detalhe.html'), 'utf8');
  const BASE =
    'https://www.cm-macao.pt/index.php/comunicacao/eventos/desporto/vamos-somar-kms-em-2026';

  it('escolhe a imagem com o mesmo nome de ficheiro da miniatura', () => {
    const escolhida = escolherCartaz(
      DESCRICAO,
      'https://www.cm-macao.pt/media/com_eventbooking/images/thumbs/2026_somar_Kms_geral.jpg',
      BASE,
    );
    // A listagem dava 426×600; esta é a de 2483×3496, e não se adivinha do
    // endereço da miniatura — está noutra pasta.
    expect(escolhida).toBe('https://www.cm-macao.pt/images/2026_somar_Kms_geral.jpg');
  });

  it('não se deixa levar por logótipos e banners que estejam noutro sítio', () => {
    const comRuido =
      '<img src="/images/logotipo-municipio-branco.png">' +
      '<img src="/images/2026_somar_Kms_geral.jpg">' +
      '<img src="/images/banners/pocentro_feder.png">';
    expect(
      escolherCartaz(
        comRuido,
        'https://x.pt/media/thumbs/2026_somar_Kms_geral.jpg',
        'https://x.pt/e',
      ),
    ).toBe('https://x.pt/images/2026_somar_Kms_geral.jpg');
  });

  it('sem nome que case, fica a primeira do bloco da descrição', () => {
    expect(
      escolherCartaz(
        '<img src="/images/cartaz.jpg">',
        'https://x.pt/media/thumbs/outro.jpg',
        'https://x.pt/e',
      ),
    ).toBe('https://x.pt/images/cartaz.jpg');
  });

  it('sem imagem nenhuma devolve nulo, para a miniatura ficar', () => {
    expect(escolherCartaz('<p>só texto</p>', 'https://x.pt/t.jpg', 'https://x.pt/e')).toBe(null);
  });

  // O caso que passou para produção e não devia. A exposição de Teresa Sousa,
  // em Tomar, não tem miniatura na listagem — e traz no corpo da descrição um
  // banner de turismo que alguém lá colou. A versão anterior apanhou-o e pôs
  // um banner de turismo como cartaz de uma exposição de gravura.
  it('sem miniatura não escolhe nada, por mais imagens que a descrição tenha', () => {
    expect(
      escolherCartaz(
        '<img src="/./banner_turismo_1920x1080.jpg">',
        null,
        'https://www.cm-tomar.pt/comunicacao/agenda/exposicoes/teresa-sousa',
      ),
    ).toBe(null);
  });

  it('a miniatura é a prova de que o evento tem cartaz', () => {
    // Com miniatura, uma descrição com uma imagem só serve — a miniatura já
    // disse que há cartaz, e o que lá está é a versão grande dele.
    expect(
      escolherCartaz(
        '<img src="/images/com_eventbooking/cartaz-grande.jpg">',
        'https://x.pt/media/thumbs/outro-nome.jpg',
        'https://x.pt/e',
      ),
    ).toBe('https://x.pt/images/com_eventbooking/cartaz-grande.jpg');
  });
});
