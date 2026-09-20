/**
 * O Cine-Teatro Paraíso, em Tomar, tem sítio próprio e feito à medida.
 *
 * Não é Joomla, não é `com_eventbooking`, e não se parece com nenhum dos
 * outros doze — por isso tem adaptador só para ele. O que compensa o trabalho
 * é o que a página traz: identificador estável, categoria, imagem, e um resumo
 * com **todas as sessões** de cada espetáculo, com hora.
 *
 * Tudo o que este ficheiro assume foi lido de
 * `../__fixtures__/cine-teatro-paraiso.html`, capturado a 28 de agosto de 2026.
 *
 * A página `/agenda` não serve: monta-se no browser e devolve zero blocos a
 * quem a lê do servidor. É a entrada do sítio que traz a programação servida.
 */

import { parsePortugueseDates, type RawEvent, type RawSession } from '@coreto/core';
import { absoluteUrl, selectAll, selectFirst, stripTags } from '../html.js';
import { parseAdapterConfig, type Adapter, type AdapterContext } from '../adapter.js';

/** O bloco de um evento na entrada do sítio. */
const BLOCK_SELECTOR = '.postWidget';

/**
 * O identificador vive na âncora interna: `id="postWidgetLocation469"`.
 *
 * O sítio usa-a para devolver quem volta à listagem ao sítio onde estava. Para
 * nós é a única chave numérica e estável que a página dá — o slug do endereço
 * muda quando alguém corrige o título.
 */
const EVENT_ID = /postWidgetLocation(\d+)/;

/** `21h30`, `11h00`, e também `21h` sem minutos. */
const TIME = /\b(\d{1,2})\s*h\s*(\d{2})?\b/;

/** A imagem vem em CSS, não em `src`: `background-image: url(…)`. */
const BACKGROUND_URL = /background-image\s*:\s*url\(\s*['"]?([^'")]+)/i;

const MAX_BLOCKS = 60;

/**
 * Um segmento do resumo, já classificado.
 *
 * O resumo é uma linha só, com as partes separadas por `|`. O separador não
 * quer dizer sempre a mesma coisa — ver `lerSessoes`.
 */
interface Segmento {
  data: string | null;
  hora: string | null;
  texto: string;
}

function lerHora(texto: string): string | null {
  const encontrado = TIME.exec(texto);
  if (!encontrado) return null;
  return `${encontrado[1]!.padStart(2, '0')}:${encontrado[2] ?? '00'}`;
}

function classificar(texto: string, referencia: string | undefined): Segmento {
  const limpo = texto.trim();
  const datas = parsePortugueseDates(limpo, referencia ? { reference: referencia } : {});
  return { data: datas[0] ?? null, hora: lerHora(limpo), texto: limpo };
}

export interface ResumoLido {
  sessions: RawSession[];
  /** O sítio, quando o resumo nomeia um que não é a sala da casa. */
  venueName: string | null;
}

/**
 * Lê o resumo, onde o `|` significa três coisas diferentes.
 *
 * As formas que a página serve, todas verdadeiras e todas no mesmo campo:
 *
 *     26 de setembro . sábado . 21h30 | Cine-Teatro Paraíso
 *     30 de agosto . domingo . 16h00 | 31 de agosto . segunda . 21h00
 *     5 de setembro . sábado | 21h30 | Cine-Teatro Paraíso
 *     19 de setembro . sábado . 11h00 | Deck do Complexo Cultural da Levada
 *     Todos os dias de espetáculo e sessões de cinema
 *
 * Na primeira o `|` separa a sessão do local; na segunda separa duas sessões;
 * na terceira separa a data da hora **da mesma** sessão. Não há como distinguir
 * pelo separador, e por isso não se tenta: classifica-se cada segmento pelo que
 * ele contém.
 *
 * Um segmento com data abre sessão. Um segmento só com hora completa a sessão
 * aberta — e não abre nenhuma, que é o que evita inventar um espetáculo às
 * 21h30 de dia nenhum. Um segmento sem data e sem hora é o sítio.
 *
 * A última linha do exemplo não tem data nenhuma: é uma rubrica permanente da
 * casa, não uma sessão, e sai daqui sem sessões — que é o que faz o adaptador
 * deixá-la cair.
 */
export function lerResumo(resumo: string, referencia?: string): ResumoLido {
  const sessions: RawSession[] = [];
  let venueName: string | null = null;

  for (const parte of resumo.split('|')) {
    const segmento = classificar(parte, referencia);
    if (!segmento.texto) continue;

    if (segmento.data) {
      sessions.push({ date: segmento.data, startTime: segmento.hora });
      continue;
    }

    if (segmento.hora) {
      const aberta = sessions[sessions.length - 1];
      if (aberta && !aberta.startTime) aberta.startTime = segmento.hora;
      continue;
    }

    if (!venueName) venueName = segmento.texto;
  }

  return { sessions, venueName };
}

function lerImagem(bloco: string, base: string): string | null {
  const estilo = selectFirst(bloco, '.imagemProduto')?.attributes.style ?? '';
  const encontrado = BACKGROUND_URL.exec(estilo);
  return absoluteUrl(base, encontrado?.[1] ?? null);
}

/** Tecto de páginas de detalhe quando a fonte não o configura. */
const DETALHE_POR_OMISSAO = 20;

/**
 * A sinopse vive em `.stdText` na página de cada espetáculo.
 *
 * A listagem da entrada não a traz, e foi por isso que os eventos do Paraíso
 * andaram meses no catálogo sem uma linha de texto. Os fins de parágrafo
 * viram quebras de linha antes de tirar as etiquetas, para a ficha do evento
 * voltar a separá-los.
 */
export function lerSinopse(body: string): string | null {
  const bloco = selectFirst(body, '.stdText');
  if (!bloco) return null;
  const comQuebras = bloco.inner.replace(/<\s*(?:br\s*\/?|\/p|\/div|\/li|\/h[1-6])\s*>/gi, '\n');
  return (
    stripTags(comQuebras)
      .split('\n')
      .map((linha) => linha.replace(/\s+/g, ' ').trim())
      .filter((linha) => linha.length > 0)
      .join('\n') || null
  );
}

/**
 * O preço, que mora na caixa lateral e não na sinopse.
 *
 * A página de cada espetáculo tem, à direita, uma caixa com a ficha técnica
 * curta: a classificação etária, a duração e — o que aqui interessa — quanto
 * custa. São as formas que a casa serve, as duas medidas a 20/09/2026:
 *
 *     <div class='boxDestaque …'><p>M/16</p><p>Duração: 1h15</p>
 *       <p>12,50€ (à venda na Ticketline)</p></div>
 *
 *     …<p>Bilhete: 4.80 euros</p><p>Bilheteira: 1h antes do filme</p></div>
 *
 * **Isto estava a ser deitado fora, e são oito espetáculos.** O adaptador lia
 * a sinopse (`.stdText`) e mais nada, e a caixa do preço vive noutra coluna do
 * documento: os oito eventos do Cine-Teatro Paraíso entravam no catálogo sem
 * preço nenhum, numa agenda onde dezanove dos cento e dezasseis o têm. Não é
 * um campo a mais numa ficha — é a pergunta que se faz a seguir a «quando» e
 * «onde».
 *
 * Devolve-se o **texto tal como está** e não um número: quem sabe ler preços é
 * o `parsePrice` do `@coreto/core`, que já trata do «12,50€» e do «4.80
 * euros» com a mesma regra e que decide sozinho o que é entrada livre. Um
 * segundo leitor de preços nesta casa era garantir que um dia discordavam.
 *
 * A linha da bilheteira fica de fora por não ter valor nenhum — «Bilheteira:
 * 1h antes do filme» é um horário, não um bilhete —, e é a ausência de `€` ou
 * de «euros» que a exclui, não o seu rótulo.
 */
export function lerPrecoDaFicha(body: string): string | null {
  const caixa = selectFirst(body, '.boxDestaque');
  if (!caixa) return null;

  const linhas = caixa.inner
    .replace(/<\s*(?:br\s*\/?|\/p|\/div|\/li)\s*>/gi, '\n')
    .split('\n')
    .map((linha) => stripTags(linha).replace(/\s+/g, ' ').trim())
    .filter((linha) => linha.length > 0);

  return linhas.find((linha) => /(?:€|\beuros?\b)/i.test(linha)) ?? null;
}

function primeiroTexto(bloco: string, seletor: string): string | null {
  const texto = stripTags(selectFirst(bloco, seletor)?.inner ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return texto || null;
}

export const paraisoAdapter: Adapter = {
  id: 'paraiso',

  async fetchEvents(context: AdapterContext): Promise<RawEvent[]> {
    const { config } = parseAdapterConfig(context.source.config);
    const urls = config.listUrls?.length ? config.listUrls : [context.source.url];
    const limite = config.maxItems ?? MAX_BLOCKS;

    const events: RawEvent[] = [];
    const vistos = new Set<string>();
    let semData = 0;

    let responderam = 0;
    for (const url of urls) {
      const response = await context.http.get(url);
      if (!response.ok) {
        // Uma recusa não é uma agenda vazia — ver a nota do `portal-freguesia`.
        context.log.warn(`entrada sem resposta utilizável: ${url}`, response.error ?? undefined);
        continue;
      }
      responderam += 1;

      const blocos = selectAll(response.body, BLOCK_SELECTOR, limite);
      if (blocos.length === 0) {
        context.log.warn(`nenhum bloco «${BLOCK_SELECTOR}» em ${url}`);
        continue;
      }

      for (const bloco of blocos) {
        const id = EVENT_ID.exec(bloco.inner)?.[1];
        const title = primeiroTexto(bloco.inner, '.titulo3');
        const resumo = primeiroTexto(bloco.inner, '.resumo') ?? '';
        const { sessions, venueName } = lerResumo(resumo);

        // A entrada do sítio mistura espetáculos com rubricas permanentes da
        // casa — «Artemrede», «Subscrever Newsletter», «Participação na Rede
        // de Teatros». Não têm data porque não são eventos, e é a ausência de
        // data que as separa. Inventar-lhes uma punha a newsletter na agenda.
        if (!id || !title || sessions.length === 0) {
          if (id && title) semData += 1;
          continue;
        }

        const sourceKey = `pw-${id}`;
        if (vistos.has(sourceKey)) continue;
        vistos.add(sourceKey);

        const categoria = primeiroTexto(bloco.inner, '.selectCat');

        events.push({
          sourceKey,
          sourceUrl: absoluteUrl(
            response.url,
            selectFirst(bloco.inner, '.linkWidget')?.attributes.href ?? null,
          ),
          title,
          dates: sessions,
          // O resumo nomeia às vezes um sítio que não é a sala — «Deck do
          // Complexo Cultural da Levada». Quando nomeia, é esse que vale; o
          // espaço da fonte só entra quando o resumo se cala, senão um evento
          // no Deck ficava com a morada do cine-teatro.
          venueName,
          venueId: venueName ? null : context.source.venue_id,
          categoriesRaw: categoria ? [categoria] : [],
          imageUrl: lerImagem(bloco.inner, response.url),
          payload: { extractedBy: 'paraiso', resumo },
        });

        if (events.length >= limite) break;
      }

      if (events.length >= limite) break;
    }

    if (semData > 0) {
      context.log.info(`${semData} blocos sem data — rubricas permanentes, não eventos`);
    }

    // A página de cada espetáculo é o único sítio onde a sinopse existe.
    const tectoDetalhe = config.maxDetailPages ?? DETALHE_POR_OMISSAO;
    let detalhesLidos = 0;
    for (const event of events) {
      if (!event.sourceUrl || detalhesLidos >= tectoDetalhe) continue;
      detalhesLidos += 1;

      const detalhe = await context.http.get(event.sourceUrl);
      if (!detalhe.ok) {
        context.log.warn(`página do espetáculo sem resposta: ${event.sourceUrl}`);
        continue;
      }
      event.description = lerSinopse(detalhe.body);
      // A caixa lateral do preço vive na mesma página da sinopse: lê-se de uma
      // vez só, sem um segundo pedido. O `priceRaw` é texto; quem o interpreta
      // é o `parsePrice` do core, na harmonização.
      event.priceRaw = lerPrecoDaFicha(detalhe.body) ?? event.priceRaw ?? null;
    }

    if (events.length === 0) context.log.warn('nenhum evento com data na entrada do sítio');

    if (responderam === 0) {
      throw new Error(
        `a listagem não respondeu (${urls.length} ${urls.length === 1 ? 'endereço tentado' : 'endereços tentados'}) — não se leu nada, e zero eventos aqui não quer dizer agenda vazia`,
      );
    }

    return events;
  },
};
