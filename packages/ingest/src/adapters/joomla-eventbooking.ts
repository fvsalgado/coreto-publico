/**
 * Nove dos onze concelhos do Médio Tejo correm o mesmo Joomla com a extensão
 * `com_eventbooking`. Um adaptador serve-os a todos.
 *
 * São nove fontes, uma por concelho — Alcanena, Constância, Entroncamento,
 * Ferreira do Zêzere, Mação, Sardoal, Tomar, Torres Novas e Vila Nova da
 * Barquinha —, das quais oito ligadas: a de Torres Novas está desligada, e é
 * por isso que os eventos daquele concelho entraram por instantâneos.
 *
 * **Este é o único sítio onde este número deve estar escrito.** Andava
 * repetido em quatro ficheiros — aqui, em `rss.ts`, no teste do feed e mais
 * abaixo — e envelheceu nos quatro ao mesmo tempo, dizendo «oito» num sítio e
 * «dez» noutro. Quem precisar dele remete para aqui.
 *
 * Tudo o que este ficheiro assume foi lido das páginas verdadeiras que estão
 * em `../__fixtures__/`, capturadas a 28 de agosto de 2026: sete listagens em
 * HTML e seis dos mesmos endereços em RSS. Não há aqui um seletor escolhido
 * por analogia — foi essa a origem do defeito que este adaptador vem
 * substituir.
 */

import { parsePortugueseTimeRange, parsePrice, type RawEvent, type RawSession } from '@coreto/core';
import { absoluteUrl, selectAll, selectFirst, stripTags } from '../html.js';
import { feedUrl, readRssItems, type RssItem } from '../rss.js';
import {
  parseAdapterConfig,
  type Adapter,
  type AdapterContext,
  type SourceDates,
} from '../adapter.js';

/** O bloco de um evento na listagem. */
const BLOCK_SELECTOR = '.eb-event-wrapper';

/**
 * O identificador vive na própria classe: `eb-event-1167`.
 *
 * É numérico e estável — não depende do slug, que muda assim que alguém
 * corrige uma gralha no título. É a melhor chave que estas fontes dão.
 */
const EVENT_ID = /\beb-event-(\d+)\b/;

/** `dd/mm/aaaa`, sozinha ou como extremo de um intervalo. */
const DATE = /(\d{2})\/(\d{2})\/(\d{4})/g;

/**
 * `18:00`, `18h00` — e, em Alcanena, `6:00 pm`. O relógio de doze horas
 * lia-se como se fosse de vinte e quatro, e a cerimónia das seis da tarde
 * ficava marcada para as seis da manhã.
 */
const TIME = /\b(\d{1,2})[:h](\d{2})\b(?:\s*([ap])\.?m\b)?/i;

const MAX_BLOCKS = 200;

/**
 * Quantas páginas de evento se visitam por execução, quando a fonte não diz.
 *
 * Uma agenda municipal a meio do mês tem uma dezena de eventos, por isso
 * quarenta é folga e não tecto. Existe para o dia em que uma delas publique o
 * ano inteiro de uma vez: a recolha traz o que der, com a descrição e o cartaz
 * dos primeiros quarenta, em vez de passar a noite a pedir páginas. `0` na
 * configuração desliga a visita por completo.
 */
const MAX_DETAIL_PAGES = 40;

function isoFrom(day: string, month: string, year: string): string {
  return `${year}-${month}-${day}`;
}

/**
 * Lê `.eb-event-date-time`.
 *
 * Uma data sozinha é uma data; duas são os extremos de um intervalo, e é assim
 * que ficam — dois pontos, e não a série de dias entre eles. Uma exposição
 * aberta durante três meses não são noventa eventos, e inventá-los seria o
 * sítio a prometer noventa vezes o que ninguém prometeu.
 *
 * Faltava a segunda metade dessa frase, e faltou muito tempo: os dois pontos
 * ficavam gravados sem se dizer que eram os extremos de uma coisa contínua. A
 * ficha lia duas sessões e escrevia «2 sessões», o dia de abrir e o dia de
 * fechar — a afirmar, a quem lesse, que nos três meses do meio não havia nada.
 * Não fabricar dias resolve metade do problema; a outra metade é dizer que
 * aqueles dois dias delimitam um período, e é o que `isOngoing` faz.
 *
 * As horas vêm de `readTimes`: num dia só, a segunda é a hora a que acaba;
 * num intervalo, é a hora do dia de fechar. E quando o campo se cala,
 * `completarComAProsa` vai ver se a prosa do bloco a diz.
 */
function readDates(block: string): SourceDates {
  const container = selectFirst(block, '.eb-event-date-time');
  if (!container) return { sessions: [], isOngoing: false };

  const text = stripTags(container.inner);
  const found = [...text.matchAll(DATE)];
  if (found.length === 0) return { sessions: [], isOngoing: false };

  const [startTime = null, secondTime = null] = readTimes(container.inner);

  const first = found[0]!;
  const start = isoFrom(first[1]!, first[2]!, first[3]!);
  const last = found[found.length - 1]!;
  const end = isoFrom(last[1]!, last[2]!, last[3]!);

  if (end === start) {
    // «16:30 - 16:30», em Constância, é o campo preenchido por preencher.
    const endTime = secondTime !== startTime ? secondTime : null;
    return {
      sessions: completarComAProsa(block, [sessao(start, startTime, endTime)]),
      isOngoing: false,
    };
  }

  return {
    sessions: completarComAProsa(block, [
      sessao(start, startTime, null),
      sessao(end, secondTime, null),
    ]),
    isOngoing: true,
  };
}

/** Uma sessão só com o que a fonte deu — sem chaves a `null`. */
function sessao(date: string, startTime: string | null, endTime: string | null): RawSession {
  return {
    date,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  };
}

/**
 * As horas do bloco, por ordem: todas as `.eb-time` de `.eb-event-date-time`.
 *
 * Lia-se só a primeira, e a segunda perdia-se em silêncio — e a segunda está
 * em todas as agendas capturadas: «11/09/2026 18:00 - 13/09/2026 23:00» em
 * Tomar, «05/09/2026 16:00 - 23:30» no Sardoal, «12/09/2026 10:00 - 12:00»
 * em Ferreira do Zêzere. Era metade das horas que a fonte dava, deitada fora.
 */
function readTimes(container: string): string[] {
  return selectAll(container, '.eb-time', 4).flatMap((element) => {
    const time = TIME.exec(stripTags(element.inner));
    if (!time) return [];

    let hour = Number(time[1]);
    const meridiem = time[3]?.toLowerCase();
    if (meridiem === 'p' && hour < 12) hour += 12;
    if (meridiem === 'a' && hour === 12) hour = 0;
    // Uma hora que não é uma hora não entra — o mesmo critério das datas.
    if (hour > 23 || Number(time[2]) > 59) return [];

    return [`${String(hour).padStart(2, '0')}:${time[2]}`];
  });
}

/**
 * A hora que a prosa do bloco afirma, quando o campo da hora se calou.
 *
 * Nas sete listagens capturadas há blocos sem `.eb-time` nenhum e com a hora
 * escrita em `.eb-event-short-description`: «15 de julho | 18h30 | Galeria
 * Carlos Saramago» em Mação, «das 14H00 às 18H00» em Constância. É a mesma
 * câmara a dizer a mesma coisa noutro campo, e lê-la é extrair, não inventar.
 *
 * Com a condição de `parsePortugueseTimeRange`: uma hora só. As aulas de yoga
 * do Entroncamento — «sábados às 19h30 e domingos às 10h00» — têm duas, e
 * nenhuma delas é «a hora» do evento. Ficam sem hora, que é o que está certo.
 *
 * Quando o campo já deu a hora de início, a prosa só pode acrescentar a de
 * fim — e só se falar do mesmo início. «12/09/2026 10:00» com «entre as 10h00
 * e as 13h00» ao lado acaba às 13:00; um campo a dizer 17:00 e uma prosa a
 * dizer «inauguração às 18h30» falam de coisas diferentes, e a prosa não
 * manda em nenhuma delas.
 *
 * Só a primeira sessão recebe o que a prosa diz. Num intervalo, a segunda é
 * o dia de fechar, e a prosa nunca fala dele.
 */
function completarComAProsa(block: string, sessions: RawSession[]): RawSession[] {
  const primeira = sessions[0];
  if (!primeira) return sessions;

  const lida = parsePortugueseTimeRange(
    stripTags(selectFirst(block, '.eb-event-short-description')?.inner ?? ''),
  );
  if (!lida) return sessions;

  if (!primeira.startTime) {
    return [sessao(primeira.date, lida.start, primeira.endTime ?? lida.end), ...sessions.slice(1)];
  }
  if (!primeira.endTime && lida.end && lida.start === primeira.startTime) {
    return [sessao(primeira.date, primeira.startTime, lida.end), ...sessions.slice(1)];
  }
  return sessions;
}

/**
 * O título está num de dois sítios, e a diferença é entre concelhos.
 *
 * Em Tomar é uma ligação dentro do contentor; no Sardoal é texto solto, sem
 * ligação nenhuma. Ler só `.eb-event-title` traria Tomar e deixaria o Sardoal
 * vazio — uma recolha a menos, em silêncio, num concelho só.
 */
function readTitle(block: string): string | null {
  const link = selectFirst(block, '.eb-event-title');
  const fromLink = stripTags(link?.inner ?? '').trim();
  if (fromLink) return fromLink;

  const container = selectFirst(block, '.eb-event-title-container');
  const fromContainer = stripTags(container?.inner ?? '').trim();
  return fromContainer || null;
}

/**
 * O endereço do evento, e a categoria que ele traz de borla.
 *
 * O caminho é `/…/agenda/<categoria>/<evento>`, e o penúltimo segmento é um
 * rótulo verdadeiro — `exposicoes`, `cinema`, `musica`, `festas-e-feiras`.
 * A taxonomia já sabe resolver estes por alias.
 */
function readLink(block: string, base: string): { url: string | null; category: string | null } {
  const titled = selectFirst(block, '.eb-event-title')?.attributes.href;
  const anyLink = selectAll(block, 'a', 4).find(
    (element) =>
      element.attributes.href &&
      !element.attributes.href.includes('view-map') &&
      !element.attributes.class?.includes('eb-colorbox-map'),
  )?.attributes.href;

  const url = absoluteUrl(base, titled ?? anyLink ?? null);
  if (!url) return { url: null, category: null };

  const segments = new URL(url).pathname.split('/').filter(Boolean);
  const penultimate = segments.length >= 2 ? segments[segments.length - 2] : undefined;
  const category = penultimate && penultimate !== 'agenda' ? penultimate : null;

  return { url, category };
}

/**
 * `.eb-individual-price` não é um campo de preço: é o campo que sobrou.
 *
 * Nas sete listagens capturadas há dezassete valores com texto: onze são uma
 * forma de dizer que a entrada é livre — «Entrada Livre», «Entrada Gratuita»,
 * «INSCRIÇÕES GRATUITAS» — e seis são o nome do espaço, como «Complexo
 * Cultural da Levada de Tomar» ou «Mercado Municipal António Teixeira
 * Antunes». Alguém usou o campo que tinha à mão, e cada câmara usou-o à sua
 * maneira.
 *
 * Quem o lesse como preço punha nomes de espaços na coluna da bilheteira de
 * todos os eventos de dez concelhos. O `parsePrice` já sabe distinguir: devolve
 * vazio para o que não é preço, e é essa a resposta que decide para onde vai.
 */
function readPriceOrVenue(block: string): { priceRaw: string | null; venueName: string | null } {
  const text = stripTags(selectFirst(block, '.eb-individual-price')?.inner ?? '').trim();
  if (!text) return { priceRaw: null, venueName: null };

  const parsed = parsePrice(text);
  const looksLikePrice =
    parsed.isFree !== undefined || parsed.priceMin !== undefined || parsed.priceMax !== undefined;

  return looksLikePrice ? { priceRaw: text, venueName: null } : { priceRaw: null, venueName: text };
}

/**
 * A segunda leitura da mesma agenda.
 *
 * Estes sites servem a agenda em HTML e em RSS no mesmo endereço. O feed traz
 * três coisas que o HTML não dá com fiabilidade — a prosa da descrição, o
 * rótulo canónico da categoria («Formação / Atelier / Oficinas», onde o HTML
 * só dá o slug `formacao-atelier-oficinas`), e uma contagem independente.
 *
 * Junta-se pelo endereço canónico, que é igual dos dois lados.
 */
async function lerFeed(
  context: AdapterContext,
  listUrl: string,
): Promise<Map<string, RssItem> | null> {
  const endereco = feedUrl(listUrl);
  if (!endereco) return null;

  const response = await context.http.get(endereco);
  // O feed é um extra. Um feed em baixo não pode derrubar a recolha de uma
  // agenda que o HTML já deu.
  if (!response.ok) return null;

  const porEndereco = new Map<string, RssItem>();
  for (const item of readRssItems(response.body)) {
    if (item.link) porEndereco.set(item.link.replace(/\/+$/, ''), item);
  }
  return porEndereco;
}

function completarComFeed(evento: RawEvent, feed: Map<string, RssItem> | null): RawEvent {
  if (!feed || !evento.sourceUrl) return evento;
  const item = feed.get(evento.sourceUrl.replace(/\/+$/, ''));
  if (!item) return evento;

  return {
    ...evento,
    description: evento.description ?? item.description,
    // O rótulo do feed é o que a fonte escreve para pessoas; o slug do
    // endereço é o que ela escreve para máquinas. A taxonomia resolve os dois,
    // e ter ambos dá-lhe duas hipóteses de acertar em vez de uma.
    categoriesRaw: item.category
      ? [...new Set([item.category, ...(evento.categoriesRaw ?? [])])]
      : evento.categoriesRaw,
  };
}

/**
 * `.eb-event-location` traz o concelho, não o espaço — e é preciso à mesma.
 *
 * Nas listagens capturadas os valores são os nomes dos concelhos e mais nada.
 * Como **espaço** criaria um espaço fantasma com nome de concelho por cada um,
 * e por isso continua a não ser usado para isso. Como **local livre** é outra
 * coisa: é o sítio dito com a precisão que a fonte tem, que é pouca mas é
 * verdadeira.
 *
 * Sem isto os eventos não entram. A base exige que todo o evento diga onde é
 * — `venue_id` ou `location_name`, a restrição `events_has_location` — e a
 * primeira recolha a sério provou-o da pior maneira: trinta e um eventos
 * lidos das páginas certas, nenhum gravado, todos com a mesma mensagem.
 *
 * Só entra quando não há nada melhor. Quando o campo do preço traz um nome de
 * espaço a sério — «Complexo Cultural da Levada de Tomar» —, é esse que vale,
 * e substituí-lo pelo nome do concelho seria trocar precisão por ruído.
 */
function readConcelho(block: string): string | null {
  const texto = stripTags(selectFirst(block, '.eb-event-location')?.inner ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return texto || null;
}

/**
 * O que a página do evento tem e a listagem não dá.
 *
 * Duas coisas, e as duas custavam caro na qualidade do catálogo.
 *
 * **O cartaz a sério.** A listagem serve `.eb-thumb-left`, que aponta para
 * `media/com_eventbooking/images/thumbs/<ficheiro>` — uma miniatura. Medida
 * num caso real de Mação: 426×600 na listagem, 2483×3496 na página do evento.
 * Trinta e quatro vezes os pixels, para a mesma imagem.
 *
 * E não se adivinha o endereço da grande a partir do da miniatura. Tirar
 * `thumbs/` do caminho dá 404. Mação guarda o original em `/images/<ficheiro>`,
 * o Entroncamento em `/images/com_eventbooking/Agenda_Cultural/2026/
 * 3_trimestre/<ficheiro>`, Alcanena em `/images/com_eventbooking/<ficheiro>`.
 * Cada sítio arruma como quer; só a página do evento diz onde está.
 *
 * **A descrição.** Vive em `.eb-description` e não aparece em lado nenhum da
 * listagem. É o campo mais em falta do catálogo inteiro.
 *
 * O custo é um pedido por evento. O cliente HTTP já espaça os pedidos ao mesmo
 * servidor, por isso o que isto acrescenta é tempo de recolha, não carga sobre
 * a câmara — e uma recolha noturna tem a noite toda.
 */
interface Detalhe {
  description: string | null;
  imageUrl: string | null;
}

/**
 * A imagem grande, escolhida sem inventar nenhuma.
 *
 * Dentro de `.eb-description` está o cartaz em tamanho real. O que o
 * identifica é o **nome do ficheiro**: é o mesmo da miniatura que a listagem
 * deu, noutra pasta.
 *
 * **A miniatura é a condição, e não só a pista.** Sem ela não se escolhe nada,
 * e isso é uma regra e não uma desistência: a listagem só dá miniatura aos
 * eventos que têm cartaz, e uma descrição sem miniatura ao lado é prosa onde
 * alguém pode ter colado o que lhe apeteceu. Aconteceu — a exposição de Teresa
 * Sousa, em Tomar, não tem miniatura na listagem e traz no corpo um
 * `banner_turismo_1920x1080.jpg` da raiz do sítio. Uma versão anterior disto
 * apanhou-o e pôs um banner de turismo como cartaz de uma exposição de gravura.
 *
 * Sem imagem é melhor do que com a imagem errada, que é a regra que este
 * projeto aplica à data, ao sítio e ao preço.
 *
 * Havendo miniatura, procura-se a que casa pelo nome; não casando nenhuma,
 * serve a primeira do bloco — aí a miniatura já provou que o evento tem cartaz,
 * e o que está na descrição é a versão grande dele.
 */
export function escolherCartaz(
  blocoDescricao: string,
  thumbUrl: string | null,
  base: string,
): string | null {
  if (!thumbUrl) return null;

  const imagens = [...blocoDescricao.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1] ?? '');
  if (imagens.length === 0) return null;

  const nome = (endereco: string): string => endereco.split('?')[0]!.split('/').pop() ?? '';
  const alvo = nome(thumbUrl);

  const igual = imagens.find((endereco) => nome(endereco) === alvo);
  return absoluteUrl(base, igual ?? imagens[0] ?? null);
}

async function lerDetalhe(
  context: AdapterContext,
  endereco: string,
  thumbUrl: string | null,
): Promise<Detalhe> {
  const vazio: Detalhe = { description: null, imageUrl: null };

  const response = await context.http.get(endereco);
  if (!response.ok) {
    context.log.warn(`página do evento sem resposta: ${endereco}`);
    return vazio;
  }

  const bloco = selectFirst(response.body, '.eb-description');
  if (!bloco) return vazio;

  // Os fins de parágrafo viram quebras de linha ANTES de tirar as etiquetas:
  // achatar tudo num parágrafo único fazia da sinopse um bloco ilegível, e a
  // página do evento volta a separar por `\n`.
  const comQuebras = bloco.inner.replace(/<\s*(?:br\s*\/?|\/p|\/div|\/li|\/h[1-6])\s*>/gi, '\n');
  const description =
    stripTags(comQuebras)
      .split('\n')
      .map((linha) => linha.replace(/\s+/g, ' ').trim())
      .filter((linha) => linha.length > 0)
      .join('\n') || null;
  return {
    description,
    imageUrl: escolherCartaz(bloco.inner, thumbUrl, response.url),
  };
}

export const joomlaEventBookingAdapter: Adapter = {
  id: 'joomla-eventbooking',

  async fetchEvents(context: AdapterContext): Promise<RawEvent[]> {
    const { config } = parseAdapterConfig(context.source.config);
    const urls = config.listUrls?.length ? config.listUrls : [context.source.url];
    const limit = config.maxItems ?? MAX_BLOCKS;

    const tectoDetalhe = config.maxDetailPages ?? MAX_DETAIL_PAGES;
    const events: RawEvent[] = [];
    const seen = new Set<string>();
    let detalhesLidos = 0;

    let responderam = 0;
    for (const url of urls) {
      const response = await context.http.get(url);
      if (!response.ok) {
        // Uma recusa não é uma agenda vazia. A 5 e a 9 de setembro de 2026,
        // vinte e sete fontes levaram 403 na mesma manhã e dezassete gravaram
        // sucesso sem terem lido um byte. O contador abaixo é o que separa
        // «não há» de «não consegui ler».
        context.log.warn(`listagem sem resposta utilizável: ${url}`, response.error ?? undefined);
        continue;
      }
      responderam += 1;

      const feed = config.skipFeed ? null : await lerFeed(context, url);
      const blocks = selectAll(response.body, BLOCK_SELECTOR, limit);

      if (blocks.length === 0) {
        // Aqui é onde a segunda leitura paga o que custou.
        //
        // Zero blocos no HTML tem duas explicações que se parecem: a agenda
        // esvaziou, ou o seletor deixou de casar. Sem o feed, a recolha teria
        // de escolher a interpretação prudente e ficar calada. Com o feed, a
        // dúvida acaba — se ele traz eventos, a agenda **não** está vazia e o
        // que está partido é isto. Falhar alto é a resposta certa: uma fonte
        // partida tem de contar como falha, não como noite sem programação.
        if (feed && feed.size > 0) {
          throw new Error(
            `o HTML não deu blocos «${BLOCK_SELECTOR}» mas o feed da mesma agenda traz ${feed.size} eventos — o seletor deixou de casar`,
          );
        }
        context.log.warn(`nenhum bloco «${BLOCK_SELECTOR}» em ${url}`);
        continue;
      }

      for (const block of blocks) {
        const id = EVENT_ID.exec(block.attributes.class ?? '')?.[1];
        const title = readTitle(block.inner);
        const datas = readDates(block.inner);

        // Sem chave, sem título ou sem data não há evento que se publique — e
        // inventar qualquer um dos três é pior do que deixar passar.
        if (!id || !title || datas.sessions.length === 0) continue;

        const sourceKey = `eb-${id}`;
        if (seen.has(sourceKey)) continue;
        seen.add(sourceKey);

        const { url: sourceUrl, category } = readLink(block.inner, response.url);
        const { priceRaw, venueName } = readPriceOrVenue(block.inner);
        const thumb = absoluteUrl(
          response.url,
          selectFirst(block.inner, '.eb-thumb-left')?.attributes.src ?? null,
        );

        // A página do evento, quando há endereço para ela e ainda há orçamento
        // de pedidos: é de lá que vem a descrição e o cartaz em tamanho real.
        const detalhe =
          sourceUrl && detalhesLidos < tectoDetalhe
            ? ((detalhesLidos += 1), await lerDetalhe(context, sourceUrl, thumb))
            : { description: null, imageUrl: null };

        events.push(
          completarComFeed(
            {
              sourceKey,
              sourceUrl,
              title,
              dates: datas.sessions,
              isOngoing: datas.isOngoing,
              venueName,
              // O concelho só entra como local quando não há nome de espaço
              // nenhum — ver `readConcelho`.
              locationName: venueName ? null : readConcelho(block.inner),
              priceRaw,
              description: detalhe.description,
              categoriesRaw: category ? [category] : [],
              // A miniatura só fica quando a página do evento não deu melhor.
              imageUrl: detalhe.imageUrl ?? thumb,
              venueId: context.source.venue_id,
            },
            feed,
          ),
        );

        if (events.length >= limit) break;
      }

      // Uma discordância mais suave também é notícia, mas não é prova: os dois
      // lados mostram recortes diferentes da mesma agenda, e nunca coincidem
      // ao evento. Metade é o ponto em que deixa de parecer recorte.
      if (feed && feed.size > 0 && blocks.length * 2 < feed.size) {
        context.log.warn(
          `o HTML deu ${blocks.length} blocos e o feed ${feed.size} eventos — vale a pena ver o que mudou`,
          url,
        );
      }

      if (events.length >= limit) break;
    }

    if (responderam === 0) {
      // A verificação cruzada com o feed, que é o que torna este adaptador
      // fiável, vive depois da porta do `ok` — num 403 nunca chega a correr.
      // Sem esta guarda, oito câmaras devolviam zero eventos com ar de agenda
      // vazia, e o painel ficava verde vindo da própria avaria.
      throw new Error(
        `a listagem não respondeu (${urls.length} ${urls.length === 1 ? 'endereço tentado' : 'endereços tentados'}) — não se leu nada, e zero eventos aqui não quer dizer agenda vazia`,
      );
    }

    return events;
  },
};
