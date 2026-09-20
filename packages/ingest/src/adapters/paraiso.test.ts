import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SourceRow } from '../adapter.js';
import { HttpClient } from '../http.js';
import { RunLogger } from '../run-logger.js';
import { lerPrecoDaFicha, lerResumo, lerSinopse, paraisoAdapter } from './paraiso.js';

import { comRobots } from '../robots-de-teste.js';
/**
 * Corre contra a entrada verdadeira do sítio, capturada a 28 de agosto de 2026.
 *
 * A data de referência é fixada em todos os testes de sessões: o sítio escreve
 * «26 de setembro» sem ano, e sem referência fixa este teste passava a falhar
 * sozinho em janeiro.
 */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__');
const CAPTURA = '2026-08-28';
const URL_SITIO = 'https://cineteatro.cm-tomar.pt/';

function source(): SourceRow {
  return {
    id: 'cine-teatro-paraiso',
    name: 'Cine-Teatro Paraíso',
    kind: 'venue_site',
    municipality_id: 'tomar',
    region_id: null,
    venue_id: 'cine-teatro-paraiso',
    url: URL_SITIO,
    adapter: 'paraiso',
    config: {},
    is_enabled: true,
    baseline_item_count: null,
    min_expected_items: 1,
    consecutive_failures: 0,
    circuit_open_until: null,
  };
}

function stubHttp(corpo: string): HttpClient {
  return new HttpClient({
    minHostIntervalMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: comRobots(() => Promise.resolve(new Response(corpo, { status: 200 }))),
  });
}

async function colher() {
  return paraisoAdapter.fetchEvents({
    source: source(),
    http: stubHttp(readFileSync(join(FIXTURES, 'cine-teatro-paraiso.html'), 'utf8')),
    log: new RunLogger({ sourceId: 'cine-teatro-paraiso', output: () => undefined }),
  });
}

describe('paraiso contra a entrada verdadeira do sítio', () => {
  it('traz os espetáculos e deixa cair as rubricas sem data', async () => {
    const eventos = await colher();
    expect(eventos.length).toBeGreaterThan(0);
    for (const evento of eventos) {
      expect(evento.dates.length).toBeGreaterThan(0);
      expect(evento.title).toBeTruthy();
    }
  });

  it('usa a âncora numérica como chave, e não o slug do endereço', async () => {
    const eventos = await colher();
    for (const evento of eventos) {
      expect(evento.sourceKey).toMatch(/^pw-\d+$/);
    }
    expect(new Set(eventos.map((evento) => evento.sourceKey)).size).toBe(eventos.length);
  });

  it('lê a imagem do CSS, onde o sítio a põe', async () => {
    const eventos = await colher();
    const comImagem = eventos.filter((evento) => evento.imageUrl);
    expect(comImagem.length).toBeGreaterThan(0);
    expect(comImagem[0]?.imageUrl).toMatch(/^https:\/\/cineteatro\.cm-tomar\.pt\/images\//);
  });

  it('traz a categoria que o sítio declara', async () => {
    const eventos = await colher();
    const categorias = eventos.flatMap((evento) => evento.categoriesRaw ?? []);
    expect(categorias).toContain('Teatro');
  });
});

/**
 * O resumo é um campo só, com `|` a significar três coisas diferentes. Cada
 * caso aqui é uma linha que o sítio serve mesmo.
 */
describe('o resumo, onde o mesmo separador significa três coisas', () => {
  it('sessão e local: o segundo segmento é o sítio', () => {
    const lido = lerResumo('26 de setembro . sábado . 21h30 | Cine-Teatro Paraíso', CAPTURA);
    expect(lido.sessions).toEqual([{ date: '2026-09-26', startTime: '21:30' }]);
    expect(lido.venueName).toBe('Cine-Teatro Paraíso');
  });

  it('duas sessões: cada segmento com data abre a sua, com a sua hora', () => {
    const lido = lerResumo(
      '30 de agosto . domingo . 16h00 | 31 de agosto . segunda . 21h00',
      CAPTURA,
    );
    expect(lido.sessions).toEqual([
      { date: '2026-08-30', startTime: '16:00' },
      { date: '2026-08-31', startTime: '21:00' },
    ]);
    expect(lido.venueName).toBeNull();
  });

  it('três sessões, todas guardadas', () => {
    const lido = lerResumo(
      '23 de agosto . domingo . 16h00 | 24 de agosto . segunda . 21h00 | 30 de agosto . domingo . 21h00',
      CAPTURA,
    );
    expect(lido.sessions).toHaveLength(3);
    expect(lido.sessions.map((sessao) => sessao.startTime)).toEqual(['16:00', '21:00', '21:00']);
  });

  it('data e hora separadas pelo mesmo `|` continuam a ser uma sessão só', () => {
    const lido = lerResumo('5 de setembro . sábado | 21h30 | Cine-Teatro Paraíso', CAPTURA);
    expect(lido.sessions).toEqual([{ date: '2026-09-05', startTime: '21:30' }]);
    expect(lido.venueName).toBe('Cine-Teatro Paraíso');
  });

  it('reconhece um sítio que não é a sala da casa', () => {
    const lido = lerResumo(
      '19 de setembro . sábado .  11h00 | Deck do Complexo Cultural da Levada',
      CAPTURA,
    );
    expect(lido.venueName).toBe('Deck do Complexo Cultural da Levada');
  });

  it('uma rubrica permanente não tem sessões', () => {
    expect(lerResumo('Todos os dias de espetáculo e sessões de cinema', CAPTURA).sessions).toEqual(
      [],
    );
    expect(lerResumo('', CAPTURA).sessions).toEqual([]);
  });

  it('uma hora sem data nenhuma não inventa uma sessão', () => {
    expect(lerResumo('21h30 | Cine-Teatro Paraíso', CAPTURA).sessions).toEqual([]);
  });
});

describe('o espaço, quando o resumo nomeia outro', () => {
  it('não pendura no cine-teatro um evento que é no Deck', async () => {
    const eventos = await colher();
    const noDeck = eventos.find((evento) => evento.venueName?.includes('Deck'));
    expect(noDeck).toBeDefined();
    expect(noDeck?.venueId).toBeNull();
  });

  it('assume a sala da casa quando o resumo se cala', async () => {
    const eventos = await colher();
    const semSitio = eventos.filter((evento) => !evento.venueName);
    for (const evento of semSitio) {
      expect(evento.venueId).toBe('cine-teatro-paraiso');
    }
  });
});

describe('lerSinopse', () => {
  it('lê a sinopse da página real do espetáculo, com os parágrafos', () => {
    const body = readFileSync(join(FIXTURES, 'cine-teatro-paraiso-detalhe.html'), 'utf8');
    const sinopse = lerSinopse(body);
    expect(sinopse).toBeTruthy();
    expect(sinopse).toContain('A Alessandra e o Valerio');
    expect(sinopse?.split('\n').length).toBeGreaterThan(1);
  });

  it('devolve null quando não há bloco de texto', () => {
    expect(lerSinopse('<div class="outro">nada</div>')).toBeNull();
  });
});

describe('lerPrecoDaFicha', () => {
  /*
   * A cicatriz: oito espetáculos do Cine-Teatro entravam sem preço porque o
   * adaptador só lia a sinopse, e o preço vive na coluna do lado. O que se
   * devolve é o texto; quem o lê é o `parsePrice` do core.
   */
  it('lê o preço da caixa lateral da página real', () => {
    const body = readFileSync(join(FIXTURES, 'cine-teatro-paraiso-detalhe.html'), 'utf8');
    expect(lerPrecoDaFicha(body)).toBe('Bilhete: 4.80 euros');
  });

  it('lê a outra forma que a casa serve, com o vendedor ao lado', () => {
    const caixa =
      "<div class='boxDestaque titulo3 light'><p>M/16</p><p>Duração: 1h15</p>" +
      '<p>12,50€ (à venda na Ticketline)</p></div>';
    expect(lerPrecoDaFicha(caixa)).toBe('12,50€ (à venda na Ticketline)');
  });

  // «Bilheteira: 1h antes do filme» é um horário e não um bilhete: o que o
  // exclui é não ter valor nenhum, e não o rótulo com que aparece.
  it('não confunde o horário da bilheteira com um preço', () => {
    const caixa = "<div class='boxDestaque'><p>M/12</p><p>Bilheteira: 1h antes do filme</p></div>";
    expect(lerPrecoDaFicha(caixa)).toBeNull();
  });

  it('devolve null quando a página não tem caixa nenhuma', () => {
    expect(lerPrecoDaFicha('<div class="stdText"><p>só sinopse</p></div>')).toBeNull();
  });
});
