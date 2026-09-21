import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { SourceRow } from '../adapter';
import { HttpClient } from '../http';
import { RunLogger } from '../run-logger';
import { comRobots } from '../robots-de-teste.js';
import {
  pareceNomeDeEspaco,
  parseDetalhe,
  parseListagem,
  portalFreguesiaAdapter,
} from './portal-freguesia';

/**
 * Capturas vivas de 29 de agosto de 2026, do sítio da Junta de Freguesia de
 * Minde. A listagem tinha três eventos por acontecer; a página de detalhe é a
 * do primeiro deles.
 */
const AGENDA = readFileSync(
  fileURLToPath(new URL('../__fixtures__/jf-minde-agenda.html', import.meta.url)),
  'utf8',
);
const DETALHE = readFileSync(
  fileURLToPath(new URL('../__fixtures__/jf-minde-evento.html', import.meta.url)),
  'utf8',
);
const RSS = readFileSync(
  fileURLToPath(new URL('../__fixtures__/jf-minde-eventos.xml', import.meta.url)),
  'utf8',
);

const BASE = 'https://www.jf-minde.pt/freguesia/agenda';

describe('parseListagem', () => {
  const itens = parseListagem(AGENDA, BASE);

  it('lê os três eventos por acontecer', () => {
    expect(itens).toHaveLength(3);
    expect(itens.map((item) => item.id)).toEqual(['74', '76', '75']);
  });

  it('dá a ligação que existe mesmo', () => {
    // É esta a razão de este adaptador existir. O RSS da mesma casa aponta
    // para `/autarquia/noticias/<id>-<slug>`, que responde 404; a página do
    // evento vive em `/freguesia/agenda/<dd-mm-aaaa>/<id>-<slug>`.
    expect(itens[0]?.url).toBe(
      'https://www.jf-minde.pt/freguesia/agenda/29-08-2026/74-ii_prova_de_resistencia_terrantez_trail_team',
    );
    for (const item of itens) {
      expect(item.url).toContain('/freguesia/agenda/');
      expect(item.url).not.toContain('/autarquia/noticias/');
    }
  });

  it('lê a data do endereço e não do texto', () => {
    // O texto diz «29-AGO-2026», que depende da língua e do tema; o endereço
    // diz `29-08-2026`, que é canónico.
    expect(itens.map((item) => item.date)).toEqual(['2026-08-29', '2026-09-12', '2026-09-19']);
  });

  it('traz as horas, que o feed deita fora', () => {
    expect(itens[0]).toMatchObject({ startTime: '09:00', endTime: '10:00' });
    expect(itens[1]).toMatchObject({ startTime: '14:00', endTime: '15:00' });
    expect(itens[2]).toMatchObject({ startTime: '21:30', endTime: '22:30' });
  });

  it('traz o cartaz, que o feed também não tem', () => {
    expect(itens[0]?.imageUrl).toBe(
      'https://www.jf-minde.pt/images/freguesia/eventos/74/imagem_74.jpg',
    );
    for (const item of itens) expect(item.imageUrl).toMatch(/^https:\/\//);
  });

  it('lê o título com os acentos postos', () => {
    expect(itens[0]?.title).toBe('II Prova de Resistência Terrantêz Trail Team');
    expect(itens[2]?.title).toBe('Comemoração 30º Aniversário Charales Chorus - Caorg, Minde');
  });

  it('não deixa passar uma ligação que não seja de um evento da agenda', () => {
    // A mesma página tem botões para `/freguesia/agenda/a-decorrer`,
    // `/concluidos` e `/todos`. Nenhum deles é um evento.
    for (const item of itens) expect(item.id).toMatch(/^\d+$/);
  });

  it('respeita o tecto de itens', () => {
    expect(parseListagem(AGENDA, BASE, 2)).toHaveLength(2);
  });

  it('devolve vazio a uma página que não é uma listagem', () => {
    expect(parseListagem('<html><body><p>nada</p></body></html>', BASE)).toEqual([]);
    expect(parseListagem('', BASE)).toEqual([]);
  });
});

describe('parseDetalhe', () => {
  it('lê o corpo de texto do evento', () => {
    expect(parseDetalhe(DETALHE)).toBe('II Prova de Resistência Terrantêz Trail Team');
  });

  it('devolve nada quando não há corpo', () => {
    expect(parseDetalhe('<html><body></body></html>')).toBeNull();
  });
});

describe('pareceNomeDeEspaco', () => {
  it('aceita o que diz ser um sítio', () => {
    expect(pareceNomeDeEspaco('Pavilhão Ana Sonça')).toBe(true);
    expect(pareceNomeDeEspaco('Cine-Teatro Rogério Venâncio')).toBe(true);
    expect(pareceNomeDeEspaco('Casa da Cultura')).toBe(true);
    expect(pareceNomeDeEspaco('Largo do Chão da Eira')).toBe(true);
    expect(pareceNomeDeEspaco('Sociedade Musical Mindense')).toBe(true);
  });

  it('aceita uma sigla, que é como metade destas casas se anuncia', () => {
    expect(pareceNomeDeEspaco('CAORG, Minde')).toBe(true);
    expect(pareceNomeDeEspaco('MARG — Museu de Aguarela Roque Gameiro')).toBe(true);
    expect(pareceNomeDeEspaco('NAC.2 - Complexo Cultural da Levada')).toBe(true);
  });

  it('um ponto de abreviatura não é um ponto final', () => {
    // «Biblioteca Municipal Dr. António Baião» é um espaço deste catálogo, e
    // a regra antiga recusava-o por causa do ponto do «Dr.».
    expect(pareceNomeDeEspaco('Biblioteca Municipal Dr. António Baião')).toBe(true);
    expect(pareceNomeDeEspaco('Casa da Memória Prof. Abílio Madeira Martins')).toBe(true);
    // Mas um ponto a fechar, ou seguido de minúscula, continua a ser prosa.
    expect(pareceNomeDeEspaco('Casa da Cultura.')).toBe(false);
    expect(pareceNomeDeEspaco('Casa da Cultura. venha assistir')).toBe(false);
  });

  it('recusa o que é uma frase', () => {
    // O CMS tem um campo de texto livre só, e as juntas usam-no como querem.
    expect(pareceNomeDeEspaco('Venha assistir ao torneio. Entrada livre!')).toBe(false);
    expect(pareceNomeDeEspaco('Um parágrafo\ncom duas linhas')).toBe(false);
    expect(pareceNomeDeEspaco('a'.repeat(120))).toBe(false);
    expect(pareceNomeDeEspaco('')).toBe(false);
    expect(pareceNomeDeEspaco(null)).toBe(false);
  });

  it('recusa os títulos de evento que encheram a fila de espaços por resolver', () => {
    // Estes sete estavam mesmo lá, em 29 de agosto de 2026, à espera de que
    // uma pessoa lhes desse um alias que não existe. São curtos e não têm
    // ponto final: a forma, sozinha, deixava-os passar a todos.
    expect(pareceNomeDeEspaco('Yoga Sénior Turma 1')).toBe(false);
    expect(pareceNomeDeEspaco('Yoga Sénior Turma 2')).toBe(false);
    expect(pareceNomeDeEspaco('Torneio de tiro ao alvo com pressão de ar')).toBe(false);
    expect(pareceNomeDeEspaco('II Prova de Resistência Terrantêz Trail Team')).toBe(false);
    expect(pareceNomeDeEspaco('IX Downhill Urbano em Constância, no dia 12 de Setembro')).toBe(
      false,
    );
    expect(pareceNomeDeEspaco('Inicio na Praia Fluvial de Constância')).toBe(false);
    expect(pareceNomeDeEspaco('Este mês também vamos ter a atividade Domingo de Praça')).toBe(
      false,
    );
  });

  it('um número romano à cabeça não é uma sigla', () => {
    // «II», «IX», «XXV» são maiúsculas e curtas como uma sigla, e é assim que
    // começa meia agenda de freguesia.
    expect(pareceNomeDeEspaco('XXV Festival de Folclore')).toBe(false);
  });

  it('um título aos gritos não passa por sigla', () => {
    expect(pareceNomeDeEspaco('FESTA DAS VINDIMAS')).toBe(false);
  });
});

describe('a listagem contra o feed da mesma casa', () => {
  it('não perde nenhum dos eventos por acontecer que o feed traz', () => {
    // O feed é arquivo — vinte e quatro itens, quase todos passados. O que
    // este teste segura é o contrário do que parece: que a listagem, sendo
    // muito mais curta, não deixa cair nenhum evento futuro que o feed tenha.
    const idsDoFeed = new Set(
      [...RSS.matchAll(/<link>https:\/\/www\.jf-minde\.pt\/[^<]*?\/(\d+)-[^<]*<\/link>/g)].map(
        (match) => match[1],
      ),
    );
    for (const item of parseListagem(AGENDA, BASE)) {
      expect(idsDoFeed.has(item.id), `evento ${item.id}`).toBe(true);
    }
  });

  it('o feed traz muito mais do que a agenda, e é esse o problema', () => {
    const itensDoFeed = RSS.match(/<item\b/g)?.length ?? 0;
    expect(itensDoFeed).toBeGreaterThan(20);
    expect(parseListagem(AGENDA, BASE).length).toBeLessThan(itensDoFeed);
  });
});

// ---------------------------------------------------------------------------
// O adaptador inteiro, com a rede fingida
// ---------------------------------------------------------------------------

function fonte(config: Record<string, unknown> = {}): SourceRow {
  return {
    id: 'jf-minde',
    name: 'Junta de Freguesia de Minde',
    kind: 'venue_site',
    municipality_id: 'alcanena',
    region_id: null,
    venue_id: null,
    url: BASE,
    adapter: 'portal-freguesia',
    config,
    is_enabled: true,
    baseline_item_count: null,
    min_expected_items: 0,
    consecutive_failures: 0,
    circuit_open_until: null,
    cartaz_alojavel: false,
  };
}

/** Devolve a listagem à página da agenda e a ficha a qualquer outra. */
function rede(listagem: string, detalhe = DETALHE): HttpClient {
  return new HttpClient({
    minHostIntervalMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: comRobots((input) => {
      const url = typeof input === 'string' ? input : String(input);
      const corpo = url === BASE ? listagem : detalhe;
      return Promise.resolve(new Response(corpo, { status: 200 }));
    }),
  });
}

async function colher(config: Record<string, unknown> = {}, listagem = AGENDA) {
  return portalFreguesiaAdapter.fetchEvents({
    source: fonte(config),
    http: rede(listagem),
    log: new RunLogger({ sourceId: 'jf-minde', output: () => undefined }),
  });
}

describe('portalFreguesiaAdapter', () => {
  it('devolve os três eventos com tudo o que a listagem dá', async () => {
    const eventos = await colher({ locationName: 'Minde', parish: 'Minde' });
    expect(eventos).toHaveLength(3);

    const primeiro = eventos[0];
    expect(primeiro?.title).toBe('II Prova de Resistência Terrantêz Trail Team');
    expect(primeiro?.sourceUrl).toContain('/freguesia/agenda/29-08-2026/74');
    expect(primeiro?.dates).toEqual([{ date: '2026-08-29', startTime: '09:00', endTime: '10:00' }]);
    expect(primeiro?.imageUrl).toMatch(/imagem_74\.jpg$/);
  });

  it('usa o identificador do CMS como chave, e não o endereço', async () => {
    // O endereço leva a data lá dentro: um evento adiado passaria a ser um
    // evento novo, e o antigo ficava a apodrecer no catálogo.
    const eventos = await colher();
    expect(eventos.map((evento) => evento.sourceKey)).toEqual([
      'evento-74',
      'evento-76',
      'evento-75',
    ]);
  });

  it('põe a freguesia como chão do sítio, sem inventar o espaço', async () => {
    const eventos = await colher({ locationName: 'Minde', parish: 'Minde' });
    for (const evento of eventos) {
      expect(evento.locationName).toBe('Minde');
      expect(evento.parish).toBe('Minde');
    }
  });

  it('só oferece ao catálogo o que tem feitio de nome de sítio', async () => {
    // A ficha usada em todos os pedidos de detalhe traz o título repetido, que
    // é curto e passa o filtro de forma — o catálogo é que decide. O que este
    // teste segura é o contrário: que nada disto vai parar a `locationName`,
    // porque a configuração da fonte tem prioridade.
    const eventos = await colher({ locationName: 'Minde' });
    for (const evento of eventos) expect(evento.locationName).toBe('Minde');
  });

  it('não oferece ao catálogo o título de um evento', async () => {
    // O corpo da ficha usada em todos os pedidos de detalhe é «II Prova de
    // Resistência Terrantêz Trail Team»: curto, sem pontuação de fim de
    // frase, e um título. Nomes destes encheram um sétimo da fila de
    // espaços por resolver com trabalho que ninguém pode fazer.
    const eventos = await colher({ locationName: 'Minde' });
    for (const evento of eventos) expect(evento.venueName).toBeNull();
  });

  it('o nome declarado na configuração passa à frente do texto', async () => {
    // Aí a fonte é de uma casa só, e quem a configurou disse qual — isso não
    // é uma leitura de texto, é uma declaração.
    const eventos = await colher({ venueName: 'Cine-Teatro Rogério Venâncio' });
    for (const evento of eventos) {
      expect(evento.venueName).toBe('Cine-Teatro Rogério Venâncio');
    }
  });

  it('não segue as fichas quando lhe dizem para não seguir', async () => {
    const eventos = await colher({ followLinks: false });
    for (const evento of eventos) {
      expect(evento.description).toBeNull();
      expect(evento.venueName).toBeNull();
    }
  });

  it('grita quando a página responde mas já não é a agenda', async () => {
    // Uma agenda de freguesia está vazia semanas a fio, e um seletor partido
    // parece exatamente isso. A diferença mede-se pela mobília do CMS, não
    // pela contagem — numa freguesia com três eventos a contagem não distingue
    // nada.
    await expect(
      colher({}, '<html><body><h1>Página não encontrada</h1></body></html>'),
    ).rejects.toThrow(/não é a página da agenda/);
  });

  it('aceita uma agenda vazia que ainda é a agenda', async () => {
    const vazia = AGENDA.replace(/<article class="[^"]*agenda-item[^"]*">[\s\S]*?<\/article>/g, '');
    await expect(colher({}, vazia)).resolves.toEqual([]);
  });
});
