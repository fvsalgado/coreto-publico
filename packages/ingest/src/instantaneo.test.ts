import { describe, expect, it } from 'vitest';
import { literal, recolherDeInstantaneos, type Plano } from './instantaneo.js';
import { RunLogger } from './run-logger.js';

const PAGINA = 'https://cm-torresnovas.pt/index.php/comunicacao/agenda';

/** Dois blocos `com_eventbooking`, com a mobília mínima que o adaptador lê. */
const HTML = `<html><body>
<div class="eb-category-8 eb-event-493 eb-event-wrapper eb-event-box clearfix">
  <a href="/index.php/comunicacao/agenda/musica/concerto-de-outono">
    <img src="/media/com_eventbooking/images/thumbs/outono.jpg" class="eb-thumb-left"></a>
  <h2 class="eb-event-title-container">Concerto de Outono</h2>
  <div class="eb-event-date-time clearfix">
    <i class="fa fa-calendar"></i> 12/09/2026 <span class="eb-time">21:30</span>
  </div>
  <div class="eb-event-location col-md-9"><span>Torres Novas</span></div>
</div>
<div class="eb-category-8 eb-event-700 eb-event-wrapper eb-event-box clearfix">
  <a href="/index.php/comunicacao/agenda/exposicoes/o-que-la-vai">
    <img src="/media/com_eventbooking/images/thumbs/vai.jpg" class="eb-thumb-left"></a>
  <h2 class="eb-event-title-container">O que lá vai</h2>
  <div class="eb-event-date-time clearfix">
    <i class="fa fa-calendar"></i> 01/10/2026 - 05/10/2026
  </div>
  <div class="eb-event-location col-md-9"><span>Torres Novas</span></div>
</div>
</body></html>`;

function plano(correccoes: Plano['correccoes'] = {}): Plano {
  return {
    fonte: {
      id: 'cm-torresnovas',
      name: 'Câmara Municipal de Torres Novas',
      kind: 'municipal_site',
      municipality_id: 'torres-novas',
      region_id: null,
      venue_id: null,
      url: PAGINA,
      adapter: 'joomla-eventbooking',
      config: {},
      is_enabled: false,
      baseline_item_count: null,
      min_expected_items: 1,
      consecutive_failures: 0,
      circuit_open_until: null,
      cartaz_alojavel: false,
    },
    lookups: {
      categoryAliases: { musica: 'musica', exposicoes: 'exposicoes' },
      venueAliases: { museumunicipalcarlosreis: 'museu-carlos-reis' },
      venueKinds: { 'museu-carlos-reis': 'museum' },
    },
    paginas: [{ url: PAGINA, ficheiro: 'agenda.html' }],
    actor: 'instantâneos de teste',
    agora: '2026-08-29T12:00:00.000Z',
    correccoes,
  };
}

const paginas = new Map([[PAGINA, HTML]]);
const log = (): RunLogger => new RunLogger({ sourceId: 'cm-torresnovas', output: () => undefined });

describe('recolherDeInstantaneos', () => {
  it('lê os eventos dos ficheiros pelo adaptador verdadeiro da fonte', async () => {
    const { eventos } = await recolherDeInstantaneos(plano(), paginas, log());

    expect(eventos).toHaveLength(2);
    const [primeiro, segundo] = eventos;

    // A chave é a que a fonte dá, e é o que faz a recolha do dia em que a
    // fonte abrir reconhecer estes eventos em vez de os duplicar.
    expect(primeiro!.event.source_key).toBe('eb-493');
    expect(primeiro!.event.title).toBe('Concerto de Outono');
    expect(primeiro!.event.date_start).toBe('2026-09-12');
    expect(primeiro!.event.category_slug).toBe('musica');
    // O endereço relativo resolve-se contra a página onde estava.
    expect(primeiro!.event.image_url).toBe(
      'https://cm-torresnovas.pt/media/com_eventbooking/images/thumbs/outono.jpg',
    );

    expect(segundo!.event.source_key).toBe('eb-700');
    expect(segundo!.event.date_start).toBe('2026-10-01');
    expect(segundo!.event.date_end).toBe('2026-10-05');
  });

  it('entra publicado, com o instante que o plano manda', async () => {
    const { eventos } = await recolherDeInstantaneos(plano(), paginas, log());
    expect(eventos[0]!.event.status).toBe('published');
    expect(eventos[0]!.event.published_at).toBe('2026-08-29T12:00:00.000Z');
  });

  it('aplica a correção antes do harmonizador, e marca o campo para bloquear', async () => {
    const { eventos } = await recolherDeInstantaneos(
      plano({
        'eb-493': {
          venueId: 'museu-carlos-reis',
          description: 'O que a listagem diz.',
          porque: 'a descrição da fonte diz onde é',
        },
      }),
      paginas,
      log(),
    );

    const evento = eventos.find((candidato) => candidato.event.source_key === 'eb-493');
    expect(evento!.event.venue_id).toBe('museu-carlos-reis');
    expect(evento!.event.description).toBe('O que a listagem diz.');
    expect(evento!.bloqueados).toEqual(['venue_id', 'description', 'description_short']);
    expect(evento!.porque).toBe('a descrição da fonte diz onde é');

    // O que não foi corrigido não fica bloqueado: a recolha tem de poder
    // acompanhar a fonte em tudo o resto.
    const outro = eventos.find((candidato) => candidato.event.source_key === 'eb-700');
    expect(outro!.bloqueados).toEqual([]);
  });

  it('denuncia uma correção que já não tem evento — um plano desatualizado', async () => {
    const { correccoesOrfas } = await recolherDeInstantaneos(
      plano({ 'eb-999': { locationName: 'Largo que já não há', porque: 'era assim' } }),
      paginas,
      log(),
    );
    expect(correccoesOrfas).toEqual(['eb-999']);
  });

  /**
   * Um instantâneo sem a página não é uma agenda vazia.
   *
   * Este teste dizia `expect(eventos).toEqual([])`, e estava a consagrar a
   * metade errada do que provava. O que ele tem de provar é que a importação
   * **não vai à rede** — isso continua a ser verdade, e o cliente de
   * instantâneos só lê do mapa. O que ele não devia afirmar é que não
   * conseguir ler uma página dá o mesmo resultado que ler uma página sem
   * eventos.
   *
   * A diferença custou caro: a 5 e a 9 de setembro de 2026, dezassete fontes
   * gravaram `status = 'success'`, com `last_success_at` atualizado e
   * `last_error` nulo, depois de terem levado HTTP 403 e lido zero bytes.
   * O painel ficou verde vindo da própria avaria. O caminho era exatamente
   * este: resposta não utilizável, salto, lista vazia, e uma lista vazia lida
   * como «não há programação».
   *
   * Agora o adaptador falha alto quando nenhuma listagem responde, e a
   * importação de um instantâneo que não traz a página falha com ele — que é a
   * resposta certa a «não consegui ler», e é diferente de «não há».
   */
  it('não vai à rede — e um instantâneo sem a página falha, em vez de dar agenda vazia', async () => {
    const semNada = new Map<string, string>();
    await expect(recolherDeInstantaneos(plano(), semNada, log())).rejects.toThrow(/não respondeu/);
  });
});

describe('literal', () => {
  it('escapa a plica sem deixar a cadeia aberta', () => {
    expect(literal("Serra d'Aire")).toBe("'Serra d''Aire'");
  });

  it('distingue o nada do texto «null»', () => {
    expect(literal(null)).toBe('null');
    expect(literal('null')).toBe("'null'");
  });

  it('escreve um array vazio com o tipo à frente', () => {
    expect(literal([])).toBe(`'{}'::text[]`);
    expect(literal(['musica'])).toBe(`array['musica']::text[]`);
  });
});
