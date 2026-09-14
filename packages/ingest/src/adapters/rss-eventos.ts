/**
 * Um feed RSS onde cada item é um evento.
 *
 * Existe porque a sondagem aos oitenta espaços encontrou isto: casas que não
 * têm agenda montada nem API, mas publicam um RSS em que o `pubDate` não é a
 * data em que a notícia saiu — é o dia em que a coisa acontece.
 *
 * **Minde entrava por aqui e já não entra.** O feed da junta escrevia a
 * ligação de cada item para a rota das notícias, que responde 404; não trazia
 * horas nem cartaz; e era arquivo e não agenda. Passou a entrar pela listagem
 * servida, com o adaptador `portal-freguesia`. Fica a lição, que vale para
 * qualquer feed: **um RSS que existe não é prova de que seja a melhor porta**
 * — vale a pena ver o que a página serve antes de assumir que o feed é o
 * caminho curto.
 *
 * É deliberadamente pequeno e conservador. Um RSS não diz horas, não diz
 * categoria e não diz preço; este adaptador não finge que diz. Devolve o que
 * o feed traz — título, ligação, uma linha de descrição e um dia — e deixa o
 * resto ao harmonizador, que é quem sabe resolver espaços e categorias.
 *
 * O que **não** faz, e de propósito: não segue a ligação de cada item para ir
 * buscar mais. Seguir quarenta ligações por noite a um servidor de junta de
 * freguesia é outra ordem de grandeza de pedidos, e o que se ganharia — talvez
 * uma hora, talvez um cartaz — não paga o que se pede a quem nos deixa ler.
 */

import { parseAdapterConfig, type Adapter, type AdapterContext } from '../adapter.js';
import { stripTags } from '../html.js';
import type { RawEvent } from '@coreto/core';

/** Quantos itens ler de um feed. Acima disto é arquivo, não é agenda. */
const MAX_ITEMS = 80;

/**
 * A configuração que este adaptador lê é a partilhada de `sources.config`:
 * `venueName`, quando o feed é de um espaço só, e `maxItems`. Um feed de junta
 * de freguesia cobre a freguesia inteira e não declara `venueName` — cada item
 * diz na descrição onde é, e é o harmonizador que decide se aquilo bate com um
 * espaço do catálogo.
 */

/** `<item> … </item>`, com o `s` a deixar o ponto atravessar linhas. */
const ITEM = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;

function tag(item: string, name: string): string | null {
  const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(item);
  if (!match) return null;
  const bruto = (match[1] ?? '').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
  const texto = stripTags(bruto).trim();
  return texto.length > 0 ? texto : null;
}

/**
 * `Sat, 19 Sep 2026 00:00:00 +0100` → `2026-09-19`.
 *
 * O dia sai da data tal como o feed a escreve, e não do instante convertido
 * para UTC. Um evento marcado para as 00:00 de Lisboa em julho é 23:00 do dia
 * anterior em UTC, e `toISOString()` devolveria a véspera — o mesmo erro de
 * fuso que esta casa já apanhou noutros sítios.
 */
const MESES: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

const RFC822 = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/;

export function readRssDate(value: string | null): string | null {
  if (!value) return null;
  const match = RFC822.exec(value);
  if (!match) return null;
  const mes = MESES[(match[2] as string).toLowerCase()];
  if (!mes) return null;
  return `${match[3]}-${mes}-${(match[1] as string).padStart(2, '0')}`;
}

export function parseRssEvents(
  xml: string,
  config: { venueName?: string; maxItems?: number } = {},
): RawEvent[] {
  const limite = Math.min(config.maxItems ?? MAX_ITEMS, MAX_ITEMS);
  const eventos: RawEvent[] = [];
  const vistos = new Set<string>();

  ITEM.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ITEM.exec(xml)) !== null && eventos.length < limite) {
    const item = match[1] ?? '';
    const title = tag(item, 'title');
    const date = readRssDate(tag(item, 'pubDate'));
    // Sem título ou sem dia não é um evento — é uma linha de feed. Não se
    // inventa nem uma coisa nem outra.
    if (!title || !date) continue;

    const link = tag(item, 'link');
    const guid = tag(item, 'guid');
    const sourceKey = guid ?? link ?? `${date}-${title}`;
    if (vistos.has(sourceKey)) continue;
    vistos.add(sourceKey);

    // A descrição destes feeds é uma linha só, e não se sabe do que fala.
    // Corrido contra o feed vivo, em três itens seguidos: «Pavilhão Ana
    // Sonça» (o lugar), «Torneio de tiro ao alvo com pressão de ar» (o que a
    // coisa é) e a repetição do título. Um em três é o lugar.
    //
    // Estava aqui escrito que uma descrição que não repete o título era
    // «quase sempre o sítio», e ia daqui como nome de espaço. O feed
    // desmentiu-o à primeira. Fica onde é sempre verdade — na descrição — e
    // não vai a lado nenhum onde tenha de ser um lugar para fazer sentido.
    const descricao = tag(item, 'description');
    const util = descricao && descricao !== title ? descricao : null;

    eventos.push({
      sourceKey,
      sourceUrl: link,
      title,
      description: util,
      dates: [{ date }],
      // O espaço só se afirma quando a fonte o declara — ou seja, quando o
      // feed é de uma casa só. De um feed de freguesia não se adivinha: o que
      // lá vem é uma linha de texto que tanto pode ser o pavilhão como a
      // modalidade do torneio.
      venueName: config.venueName ?? null,
      payload: { title, link, guid, description: descricao, date },
    });
  }

  return eventos;
}

export const rssEventosAdapter: Adapter = {
  id: 'rss-eventos',
  async fetchEvents({ source, http, log }: AdapterContext): Promise<RawEvent[]> {
    const { config } = parseAdapterConfig(source.config);
    const resposta = await http.get(source.url);
    if (!resposta.ok) {
      // Um feed que não responde não é um feed vazio. Ver a nota do
      // `caminhos.ts`: `return []` por um erro de rede é o caminho por onde
      // dezassete fontes gravaram sucesso sem lerem um byte, a 5 e a 9 de
      // setembro de 2026.
      throw new Error(
        `o feed não respondeu: ${resposta.error ?? resposta.status} — não se leu nada, e zero eventos aqui não quer dizer agenda vazia`,
      );
    }

    const eventos = parseRssEvents(resposta.body, {
      venueName: config.venueName,
      maxItems: config.maxItems,
    });
    if (eventos.length === 0) log.warn(`nenhum item com data no feed de ${source.name}`);
    else log.info(`${eventos.length} itens com data no feed de ${source.name}`);
    return eventos;
  },
};
