import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SourceRow } from '../adapter.js';
import { HttpClient } from '../http.js';
import { RunLogger } from '../run-logger.js';
import { comRobots } from '../robots-de-teste.js';
import {
  lerAno,
  lerPagina,
  lerSessao,
  linhasDoParagrafo,
  primeiroArtigo,
  teatroVirginiaAdapter,
} from './teatro-virginia.js';

/**
 * Corre contra o recorte verdadeiro da página do cinema, capturado a 28 de
 * agosto de 2026. O que estes testes protegem, acima de tudo, é o ano: é o
 * único campo que a linha da sessão não traz, e inventá-lo seria pôr na agenda
 * sessões em datas que ninguém marcou.
 */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__');
const URL_PAGINA = 'https://www.teatrovirginia.pt/index.php/cinema/cinema/206';

function source(): SourceRow {
  return {
    id: 'teatro-virginia',
    name: 'Teatro Virgínia — Cinema',
    kind: 'venue_site',
    municipality_id: 'torres-novas',
    region_id: null,
    venue_id: 'teatro-virginia',
    url: URL_PAGINA,
    adapter: 'teatro-virginia',
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

function pagina(): string {
  return readFileSync(join(FIXTURES, 'teatro-virginia-cinema.html'), 'utf8');
}

async function colher() {
  return teatroVirginiaAdapter.fetchEvents({
    source: source(),
    http: stubHttp(pagina()),
    log: new RunLogger({ sourceId: 'teatro-virginia', output: () => undefined }),
  });
}

describe('teatro-virginia contra a página verdadeira do cinema', () => {
  it('traz as sessões da época, todas com data e hora', async () => {
    const eventos = await colher();
    expect(eventos.length).toBeGreaterThan(0);
    for (const evento of eventos) {
      expect(evento.dates).toHaveLength(1);
      expect(evento.dates[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(evento.dates[0]?.startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(evento.title).toBeTruthy();
    }
  });

  it('lê o ano do cabeçalho da época, e não do ano do filme', async () => {
    const eventos = await colher();
    // O recorte é a época «2026 abril . junho»; os filmes são de 2024/2025 e
    // esse ano não pode escapar para a data da sessão.
    for (const evento of eventos) {
      expect(evento.dates[0]?.date.startsWith('2026-')).toBe(true);
    }
  });

  it('separa o filme do realizador e guarda a sinopse', async () => {
    const eventos = await colher();
    const primeiro = eventos[0]!;
    expect(primeiro.title).toBe('O homem mais sortudo da América');
    expect(primeiro.subtitle).toBe('Realizado por Samir Oliveros');
    expect(primeiro.description).toContain('Michael Larson');
    // O «Realizado por» não pode ficar preso à sinopse.
    expect(primeiro.description).not.toContain('Realizado por');
  });

  it('lê a duração e a classificação etária da linha dos géneros', async () => {
    const eventos = await colher();
    const primeiro = eventos[0]!;
    expect(primeiro.durationMinutes).toBe(90);
    expect(primeiro.minAge).toBe(12);
    expect(primeiro.categoriesRaw).toContain('cinema');
    expect(primeiro.categoriesRaw).toContain('Drama');
  });

  it('dá a cada sessão uma chave estável e única, e o espaço da fonte', async () => {
    const eventos = await colher();
    for (const evento of eventos) {
      expect(evento.sourceKey).toMatch(/^tv-\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
      expect(evento.venueId).toBe('teatro-virginia');
    }
    expect(new Set(eventos.map((evento) => evento.sourceKey)).size).toBe(eventos.length);
  });
});

describe('as regras de leitura, isoladas', () => {
  it('sem ano declarado não lê sessão nenhuma — nunca adivinha', () => {
    const linhas = ['07 | abril | TERÇA -FEIRA | 21h30', 'Um filme qualquer'];
    expect(lerSessao(linhas, null)).toBeNull();
    expect(lerSessao(linhas, 2026)?.date).toBe('2026-04-07');
  });

  it('reconhece o cabeçalho do ano nas duas formas que a página usa', () => {
    expect(lerAno('2026 abril . junho')).toBe(2026);
    expect(lerAno('2025')).toBe(2025);
    expect(lerAno('Sessões de CINEMA 2026 | Cineclube de Torres Novas')).toBeNull();
    // Uma sinopse comprida que comece por um ano não é um cabeçalho.
    expect(lerAno(`2026 ${'foi um ano de muitas estreias '.repeat(3)}`)).toBeNull();
  });

  it('trata os `br` como quebras de linha, que é o que separa os campos', () => {
    const linhas = linhasDoParagrafo('<strong>um</strong><br /><strong>dois</strong><br />três');
    expect(linhas).toEqual(['um', 'dois', 'três']);
  });

  it('deixa cair um parágrafo que não seja sessão', () => {
    expect(lerSessao(['preçário 3€', 'horário de bilheteira'], 2026)).toBeNull();
  });

  it('lê a época inteira do recorte pela ordem em que está na página', () => {
    const sessoes = lerPagina(pagina());
    expect(sessoes.length).toBeGreaterThanOrEqual(5);
    const datas = sessoes.map((sessao) => sessao.date);
    expect([...datas].sort()).toEqual(datas);
  });
});

/**
 * A listagem da categoria não traz sessões — só as ligações dos artigos por
 * ano. Foi essa a confusão que pôs a fonte a devolver zero na primeira
 * recolha: a página que parecia servir a época servia só o índice dela.
 */
describe('quando a página não tem sessões', () => {
  const categoria = () => readFileSync(join(FIXTURES, 'teatro-virginia-categoria.html'), 'utf8');

  it('a listagem da categoria não dá sessões nenhumas', () => {
    expect(lerPagina(categoria())).toHaveLength(0);
  });

  it('segue o primeiro artigo da listagem, que é o do ano corrente', () => {
    const artigo = primeiroArtigo(categoria(), 'https://www.teatrovirginia.pt/index.php/cinema');
    expect(artigo).toBe('https://www.teatrovirginia.pt/index.php/cinema/cinema/206');
  });

  it('o adaptador segue essa ligação e traz as sessões', async () => {
    // Primeiro pedido devolve a listagem; o segundo, o artigo da época.
    const respostas = [categoria(), pagina()];
    const http = new HttpClient({
      minHostIntervalMs: 0,
      sleep: () => Promise.resolve(),
      fetchImpl: comRobots(() =>
        Promise.resolve(new Response(respostas.shift() ?? '', { status: 200 })),
      ),
    });

    const eventos = await teatroVirginiaAdapter.fetchEvents({
      source: { ...source(), url: 'https://www.teatrovirginia.pt/index.php/cinema' },
      http,
      log: new RunLogger({ sourceId: 'teatro-virginia', output: () => undefined }),
    });

    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos[0]?.title).toBe('O homem mais sortudo da América');
  });

  it('não segue nada quando não há artigo nenhum na página', () => {
    expect(
      primeiroArtigo('<html><body><p>nada</p></body></html>', 'https://exemplo.pt'),
    ).toBeNull();
  });
});

describe('o tempo limite da fonte', () => {
  it('é passado a cada pedido quando a fonte o declara', async () => {
    const pedidos: number[] = [];
    const http = new HttpClient({
      minHostIntervalMs: 0,
      sleep: () => Promise.resolve(),
      fetchImpl: comRobots((_url, init) => {
        // O `AbortSignal.timeout` não expõe o prazo; o que se verifica é que
        // chega um sinal por pedido, e o valor vai no `get` acima.
        pedidos.push(init?.signal ? 1 : 0);
        return Promise.resolve(new Response(pagina(), { status: 200 }));
      }),
    });

    const eventos = await teatroVirginiaAdapter.fetchEvents({
      source: { ...source(), config: { timeoutMs: 45_000 } },
      http,
      log: new RunLogger({ sourceId: 'teatro-virginia', output: () => undefined }),
    });

    expect(eventos.length).toBeGreaterThan(0);
    expect(pedidos).toEqual([1]);
  });
});
