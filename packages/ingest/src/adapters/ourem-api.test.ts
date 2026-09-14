import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SourceRow } from '../adapter.js';
import { HttpClient } from '../http.js';
import { RunLogger } from '../run-logger.js';
import { lerCoordenadas, lerDatas, lerImagem, lerLocal, ouremApiAdapter } from './ourem-api.js';

import { comRobots } from '../robots-de-teste.js';
/**
 * Corre contra a resposta verdadeira da API, capturada a 28 de agosto de 2026.
 *
 * Quando um destes testes falhar, a hipótese mais provável não é o adaptador
 * ter partido: é a API ter mudado. E é para isso que serve.
 */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../__fixtures__');
const URL_API = 'https://servicos.ourem.pt/api/index.php?service=list_eventos';

function fixture(): string {
  return readFileSync(join(FIXTURES, 'ourem-api.json'), 'utf8');
}

function source(): SourceRow {
  return {
    id: 'cm-ourem',
    name: 'Câmara Municipal de Ourém',
    kind: 'municipal_site',
    municipality_id: 'ourem',
    region_id: null,
    venue_id: null,
    url: URL_API,
    adapter: 'ourem-api',
    config: {},
    is_enabled: true,
    baseline_item_count: null,
    min_expected_items: 1,
    consecutive_failures: 0,
    circuit_open_until: null,
  };
}

function stubHttp(corpo: string, status = 200): HttpClient {
  return new HttpClient({
    minHostIntervalMs: 0,
    sleep: () => Promise.resolve(),
    fetchImpl: comRobots(() => Promise.resolve(new Response(corpo, { status }))),
  });
}

async function colher(corpo = fixture()) {
  return ouremApiAdapter.fetchEvents({
    source: source(),
    http: stubHttp(corpo),
    log: new RunLogger({ sourceId: 'cm-ourem', output: () => undefined }),
  });
}

describe('ourem-api contra a resposta verdadeira', () => {
  it('lê os doze eventos que a API devolve', async () => {
    const eventos = await colher();
    expect(eventos).toHaveLength(12);
  });

  /**
   * Os dois backends por trás de uma API só.
   *
   * O portal do associativismo numera por UUID, a câmara por inteiro. Um
   * esquema que exigisse cadeia rebentava a recolha do concelho a meio da
   * lista — e foi a fixture que o mostrou, não a leitura da documentação, que
   * não existe.
   */
  it('aceita as duas formas de identificador que a API mistura', async () => {
    const eventos = await colher();
    const chaves = eventos.map((evento) => evento.sourceKey);

    expect(chaves.some((chave) => /^[0-9a-f-]{36}$/.test(chave))).toBe(true);
    expect(chaves.some((chave) => /^\d+$/.test(chave))).toBe(true);
    expect(new Set(chaves).size).toBe(12);
  });

  it('traz hora de início, que nenhuma fonte de HTML dá', async () => {
    const eventos = await colher();
    const comHora = eventos.filter((evento) => evento.dates[0]?.startTime);
    expect(comHora).toHaveLength(12);
    expect(eventos[0]?.dates[0]?.startTime).toBe('09:00');
  });

  it('traz coordenadas, que nenhuma outra fonte enche', async () => {
    const eventos = await colher();
    const comCoordenadas = eventos.filter((evento) => evento.latitude !== null);
    expect(comCoordenadas.length).toBeGreaterThan(0);
    for (const evento of comCoordenadas) {
      expect(evento.latitude).toBeGreaterThan(39);
      expect(evento.latitude).toBeLessThan(40);
      expect(evento.longitude).toBeLessThan(-8);
    }
  });

  it('nunca abre um intervalo dia a dia', async () => {
    const eventos = await colher();
    for (const evento of eventos) {
      expect(evento.dates.length).toBeLessThanOrEqual(2);
    }
  });
});

/**
 * As duas armadilhas que a fixture revelou. Ambas são campos preenchidos com o
 * valor por omissão da plataforma, e ambas passariam por dados verdadeiros a
 * quem lesse o JSON sem olhar para o conjunto.
 */
/**
 * A sinopse vem em HTML, e ia inteira para a base.
 *
 * A API devolve a sinopse com etiquetas **verdadeiras** — `<p>DOMINGO / 06 E
 * 20 SET.</p>` é o que o JSON traz, sem escape nenhum. Este adaptador nunca
 * chamou `stripTags`, e o que se lia na ficha dos «Mercados Ecorurais» eram as
 * etiquetas em texto. **Seis eventos publicados**, todos desta fonte, a 7 de
 * setembro de 2026.
 *
 * O plano apontava a causa ao harmonizador — «correr unescapeHtml antes de
 * stripTags» —, e a ordem lá é irrelevante: neste caminho nunca corre
 * `stripTags` nenhum.
 */
describe('a sinopse chega em HTML e não pode sair assim', () => {
  it('nenhuma descrição leva etiquetas para a base', async () => {
    const eventos = await colher();
    const comEtiqueta = eventos.filter((evento) =>
      /<\/?(?:p|br|div|span|strong|em|ul|ol|li|a|h[1-6])(?:\s[^>]*)?\/?>/i.test(
        evento.description ?? '',
      ),
    );
    expect(comEtiqueta.map((evento) => evento.title)).toEqual([]);
  });

  it('e o texto sobrevive inteiro, com os parágrafos separados', async () => {
    const eventos = await colher();
    const mercados = eventos.find((evento) => /ecorurais/i.test(evento.title));
    expect(mercados).toBeDefined();
    // O que a ficha mostrava: «<p>DOMINGO / 06 E 20 SET.</p>».
    expect(mercados?.description).toContain('DOMINGO');
    expect(mercados?.description).toContain('PRAÇA DA REPÚBLICA');
    expect(mercados?.description).not.toContain('<');
    // `stripTags` trata `<p>` e `<br />` como blocos: a separação fica, e é
    // o que a ficha sabe desenhar em parágrafos.
    expect(mercados?.description).toMatch(/DOMINGO[^]*\n[^]*PRAÇA/);
  });
});

describe('os valores por omissão que não são dados', () => {
  it('não põe cinco alfinetes na porta da câmara', () => {
    const noPacos = {
      id: 'x',
      nome_atividade: 'Qualquer coisa',
      data_inicio: '2026-09-01',
      localizacao: 'Município de Ourém',
      latitude: '39.6343367',
      longitude: '-8.6768314',
    };
    expect(lerCoordenadas(noPacos)).toEqual({ latitude: null, longitude: null });
    expect(lerLocal(noPacos)).toBeNull();
  });

  it('mantém as coordenadas de um sítio que é mesmo um sítio', () => {
    const biblioteca = {
      localizacao: 'Biblioteca Municipal de Ourém',
      latitude: '39.657980297367594',
      longitude: '-8.577989202834608',
    };
    expect(lerCoordenadas(biblioteca).latitude).toBeCloseTo(39.65798, 4);
    expect(lerLocal(biblioteca)).toBe('Biblioteca Municipal de Ourém');
  });

  it('deixa cair o cartaz por omissão e guarda os outros', () => {
    const base = 'https://associativismo.cm-ourem.pt/frontend/web/uploads/eventos';
    expect(lerImagem({ fotografia: `${base}/default_cartaz.png` })).toBeNull();
    expect(lerImagem({ fotografia: `${base}/evento_1786978069.jpeg` })).toBe(
      `${base}/evento_1786978069.jpeg`,
    );
    expect(lerImagem({ fotografia: '' })).toBeNull();
  });

  it('recusa coordenadas que não são de Portugal continental', () => {
    expect(lerCoordenadas({ latitude: '0', longitude: '0' }).latitude).toBeNull();
    // O par trocado: a longitude no campo da latitude.
    expect(lerCoordenadas({ latitude: '-8.65', longitude: '39.61' }).latitude).toBeNull();
    expect(lerCoordenadas({ latitude: 'sem dados', longitude: 'sem dados' }).latitude).toBeNull();
  });

  it('não promete meia-noite a quem lê', () => {
    const meiaNoite = lerDatas({ data_inicio: '2026-09-01', horario: '00:00:00' });
    expect(meiaNoite.sessions[0]?.startTime).toBeNull();

    const comHora = lerDatas({ data_inicio: '2026-09-01', horario: '21:30:00' });
    expect(comHora.sessions[0]?.startTime).toBe('21:30');
  });

  it('trata um fim anterior ao início como engano, não como intervalo', () => {
    const invertido = lerDatas({ data_inicio: '2026-09-10', data_fim: '2026-09-01' });
    expect(invertido.sessions).toEqual([{ date: '2026-09-10', startTime: null }]);
    expect(invertido.isOngoing).toBe(false);
  });

  /**
   * Uma exposição de três meses: dois extremos, e a marca de que são extremos.
   *
   * Os dois pontos já cá estavam — o adaptador nunca fabricou os dias do meio.
   * O que faltava era dizer que aqueles dois dias delimitam uma coisa contínua,
   * e sem isso a ficha lia «2 sessões» e mostrava o dia de abrir e o dia de
   * fechar como se entre eles não houvesse nada.
   */
  it('marca em curso o que a fonte declara com princípio e fim', () => {
    const exposicao = lerDatas({ data_inicio: '2026-06-03', data_fim: '2026-09-27' });

    expect(exposicao.sessions).toEqual([
      { date: '2026-06-03', startTime: null },
      { date: '2026-09-27' },
    ]);
    expect(exposicao.isOngoing).toBe(true);
  });

  it('um dia só não está «em curso» coisa nenhuma', () => {
    expect(lerDatas({ data_inicio: '2026-09-01' }).isOngoing).toBe(false);
  });
});

describe('quando a API se porta mal', () => {
  it('falha alto se a resposta não for JSON', async () => {
    await expect(colher('<html>manutenção</html>')).rejects.toThrow('não é JSON');
  });

  it('falha alto se a forma mudar', async () => {
    await expect(colher('{"eventos": []}')).rejects.toThrow('mudou de forma');
  });

  it('sobrevive a um registo sem nome, sem derrubar os outros', async () => {
    const corpo = JSON.stringify([
      { id: 'a', nome_atividade: '', data_inicio: '2026-09-01' },
      { id: 'b', nome_atividade: 'Concerto', data_inicio: '2026-09-02', horario: '21:00:00' },
    ]);
    const eventos = await colher(corpo);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.title).toBe('Concerto');
  });

  it('guarda o organizador, que é muitas vezes uma coletividade', async () => {
    const eventos = await colher();
    const organizadores = eventos
      .map((evento) => (evento.payload as { organizacao?: string | null } | null)?.organizacao)
      .filter((nome): nome is string => Boolean(nome));
    expect(organizadores).toContain('Centro Recreativo e Cultural S.Gens');
  });
});
