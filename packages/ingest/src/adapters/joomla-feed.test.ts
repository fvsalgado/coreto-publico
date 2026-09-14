import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SourceRow } from '../adapter.js';
import { HttpClient } from '../http.js';
import { RunLogger } from '../run-logger.js';
import { joomlaEventBookingAdapter } from './joomla-eventbooking.js';

import { comRobots } from '../robots-de-teste.js';
/**
 * A segunda leitura da mesma agenda.
 *
 * Os sites em `com_eventbooking` servem a agenda em HTML e em RSS no mesmo
 * endereço (quantos são está no cabeçalho do adaptador). Estes testes correm
 * contra os dois ficheiros verdadeiros de cada concelho, capturados no mesmo
 * momento — que é a única maneira de o cruzamento significar alguma coisa.
 */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__');
const LISTAGEM = 'https://www.cm-tomar.pt/comunicacao/agenda';
const FEED = `${LISTAGEM}?format=feed&type=rss`;

function fixture(nome: string): string {
  return readFileSync(join(FIXTURES, `${nome}.html`), 'utf8');
}

function source(config: Record<string, unknown> = {}): SourceRow {
  return {
    id: 'cm-tomar',
    name: 'Câmara Municipal de Tomar',
    kind: 'municipal_site',
    municipality_id: 'tomar',
    region_id: null,
    venue_id: null,
    url: LISTAGEM,
    adapter: 'joomla-eventbooking',
    config,
    is_enabled: true,
    baseline_item_count: null,
    min_expected_items: 1,
    consecutive_failures: 0,
    circuit_open_until: null,
  };
}

function stubHttp(paginas: Record<string, string>): HttpClient {
  return new HttpClient({
    minHostIntervalMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: comRobots((input) => {
      const corpo = paginas[String(input)];
      if (corpo === undefined) return Promise.resolve(new Response('', { status: 404 }));
      return Promise.resolve(new Response(corpo, { status: 200 }));
    }),
  });
}

async function colher(paginas: Record<string, string>, config: Record<string, unknown> = {}) {
  return joomlaEventBookingAdapter.fetchEvents({
    source: source(config),
    http: stubHttp(paginas),
    log: new RunLogger({ sourceId: 'cm-tomar', output: () => undefined }),
  });
}

const HTML_E_FEED = { [LISTAGEM]: fixture('tomar'), [FEED]: fixture('tomar-rss') };

describe('o que o feed acrescenta ao que o HTML deu', () => {
  it('traz a prosa da descrição, que a listagem não tem', async () => {
    const semFeed = await colher({ [LISTAGEM]: fixture('tomar') });
    const comFeed = await colher(HTML_E_FEED);

    const descricaoAntes = semFeed.filter((evento) => evento.description).length;
    const descricaoDepois = comFeed.filter((evento) => evento.description).length;

    expect(descricaoDepois).toBeGreaterThan(descricaoAntes);
  });

  it('traz o rótulo canónico da categoria, e não só o slug do endereço', async () => {
    const eventos = await colher(HTML_E_FEED);
    const etiquetas = eventos.flatMap((evento) => evento.categoriesRaw ?? []);

    // O feed escreve para pessoas; o endereço escreve para máquinas. A
    // taxonomia fica com os dois e tem duas hipóteses de acertar.
    expect(etiquetas).toContain('Exposições');
    expect(etiquetas).toContain('exposicoes');
  });

  it('não deixa o feed apagar o que o HTML já tinha', async () => {
    const semFeed = await colher({ [LISTAGEM]: fixture('tomar') });
    const comFeed = await colher(HTML_E_FEED);

    expect(comFeed).toHaveLength(semFeed.length);
    for (const [indice, evento] of comFeed.entries()) {
      expect(evento.title).toBe(semFeed[indice]?.title);
      expect(evento.dates).toEqual(semFeed[indice]?.dates);
      expect(evento.sourceKey).toBe(semFeed[indice]?.sourceKey);
    }
  });
});

/**
 * O caso que justifica o custo: distinguir «a agenda esvaziou» de «o seletor
 * partiu-se». Sem o feed as duas coisas são indistinguíveis, e a prudente —
 * ficar calado — é a que deixa um concelho desaparecer em silêncio.
 */
describe('quando o HTML não dá nada', () => {
  const temaMudado = '<html><body><div class="cartaz-novo">Agenda</div></body></html>';

  it('falha alto se o feed provar que a agenda não está vazia', async () => {
    await expect(colher({ [LISTAGEM]: temaMudado, [FEED]: fixture('tomar-rss') })).rejects.toThrow(
      /o seletor deixou de casar/,
    );
  });

  it('fica calado se o feed também não trouxer nada', async () => {
    const eventos = await colher({ [LISTAGEM]: temaMudado, [FEED]: '<rss><channel/></rss>' });
    expect(eventos).toEqual([]);
  });

  it('fica calado se o feed não responder — um extra em baixo não decide nada', async () => {
    const eventos = await colher({ [LISTAGEM]: temaMudado });
    expect(eventos).toEqual([]);
  });
});

describe('a válvula', () => {
  it('`skipFeed` desliga a segunda leitura', async () => {
    const eventos = await colher(
      { [LISTAGEM]: '<html><body></body></html>', [FEED]: fixture('tomar-rss') },
      { skipFeed: true },
    );
    expect(eventos).toEqual([]);
  });
});

/**
 * O sítio, quando a fonte o diz — e quando não diz.
 *
 * A base exige que todo o evento diga onde é (`events_has_location`). O
 * adaptador não pode inventá-lo: reporta o que a página tem, e é o pipeline
 * que decide o que fazer com um evento sem sítio.
 */
describe('o sítio que a página dá', () => {
  it('o concelho entra como local livre quando não há nome de espaço', async () => {
    const url = 'https://exemplo.pt/sardoal/agenda';
    const eventos = await joomlaEventBookingAdapter.fetchEvents({
      source: { ...source(), id: 'cm-sardoal', url },
      http: stubHttp({ [url]: fixture('sardoal') }),
      log: new RunLogger({ sourceId: 'sardoal', output: () => undefined }),
    });

    expect(eventos.length).toBeGreaterThan(0);
    for (const evento of eventos) {
      expect(evento.locationName).toBe('Sardoal');
      // E continua a não ser espaço: nove espaços fantasma com nome de
      // concelho é o que isto existe para evitar.
      expect(evento.venueName).toBeNull();
    }
  });

  it('o nome do espaço ganha ao nome do concelho', async () => {
    const url = 'https://exemplo.pt/tomar/agenda';
    const eventos = await joomlaEventBookingAdapter.fetchEvents({
      source: { ...source(), id: 'cm-tomar', url },
      http: stubHttp({ [url]: fixture('tomar') }),
      log: new RunLogger({ sourceId: 'tomar', output: () => undefined }),
    });

    const comEspaco = eventos.find((evento) => evento.venueName);
    expect(comEspaco?.venueName).toContain('Complexo Cultural da Levada');
    // Trocá-lo por «Tomar» seria trocar precisão por ruído.
    expect(comEspaco?.locationName).toBeNull();
  });

  /**
   * Mação serve seis eventos e deixa **dois** com o contentor do local
   * inteiramente vazio — a fonte não diz onde é. Os outros quatro dizem
   * «Mação», que é o concelho.
   *
   * O adaptador não inventa o que falta; quem decide é o pipeline, que os
   * manda para a fila de moderação em vez de os deixar rebentar contra a
   * restrição da base. Foi assim que isto se descobriu — na primeira recolha a
   * sério, com trinta e um eventos lidos e nenhum gravado.
   */
  it('deixa sem sítio o evento que a fonte não situa', async () => {
    const url = 'https://exemplo.pt/macao/agenda';
    const eventos = await joomlaEventBookingAdapter.fetchEvents({
      source: { ...source(), id: 'cm-macao', url },
      http: stubHttp({ [url]: fixture('macao') }),
      log: new RunLogger({ sourceId: 'macao', output: () => undefined }),
    });

    const semSitio = eventos.filter(
      (evento) => !evento.venueId && !evento.venueName && !evento.locationName,
    );
    expect(semSitio.map((evento) => evento.sourceKey).sort()).toEqual(['eb-112', 'eb-132']);
    expect(eventos).toHaveLength(6);
  });
});
