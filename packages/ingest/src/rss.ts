/**
 * Leitor de RSS, sem dependências.
 *
 * Existe por causa de uma coincidência feliz: os sites municipais em
 * `com_eventbooking` — quantos são está escrito no cabeçalho de
 * `adapters/joomla-eventbooking.ts`, e só lá — servem a **mesma agenda** em
 * HTML e em RSS, no mesmo endereço. São duas leituras independentes da mesma
 * verdade, de graça — e é o melhor detetor de avaria que este território
 * oferece.
 *
 * O feed não substitui o HTML: não traz hora, nem fim, nem local. Traz três
 * coisas que o HTML muitas vezes não tem — a descrição, o rótulo canónico da
 * categoria, e uma contagem para confrontar com a outra.
 */

import { stripTags } from './html.js';

export interface RssItem {
  title: string;
  /** Endereço canónico. É por aqui que se junta ao que o HTML deu. */
  link: string | null;
  description: string | null;
  /** O rótulo tal como a fonte o escreve: «Formação / Atelier / Oficinas». */
  category: string | null;
}

const ITEM = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;

/** Tecto de itens lidos. Um feed de agenda municipal não tem centenas. */
const MAX_ITEMS = 200;

function campo(item: string, nome: string): string | null {
  const encontrado = new RegExp(`<${nome}\\b[^>]*>([\\s\\S]*?)</${nome}>`, 'i').exec(item);
  if (!encontrado) return null;

  const bruto = (encontrado[1] ?? '').trim();
  const semCdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(bruto);
  const texto = (semCdata?.[1] ?? bruto).trim();
  return texto || null;
}

/**
 * A descrição do feed vem com o cartaz lá dentro.
 *
 * `<description>` traz um `<img>` seguido do texto. A imagem já veio do HTML,
 * com melhor resolução; o que interessa aqui é a prosa, e é ela que fica.
 */
function descricao(item: string): string | null {
  const bruto = campo(item, 'description');
  if (!bruto) return null;
  const texto = stripTags(bruto).replace(/\s+/g, ' ').trim();
  return texto || null;
}

export function readRssItems(xml: string): RssItem[] {
  const itens: RssItem[] = [];

  for (const encontrado of xml.matchAll(ITEM)) {
    if (itens.length >= MAX_ITEMS) break;
    const bloco = encontrado[1] ?? '';
    const title = campo(bloco, 'title');
    if (!title) continue;

    itens.push({
      title,
      link: campo(bloco, 'link') ?? campo(bloco, 'guid'),
      description: descricao(bloco),
      category: campo(bloco, 'category'),
    });
  }

  return itens;
}

/**
 * O endereço do feed da mesma listagem.
 *
 * O Joomla serve-o no próprio endereço da página, com dois parâmetros. Uma
 * listagem que já traga parâmetros — uma categoria, uma paginação — mantém-nos.
 */
export function feedUrl(listUrl: string): string | null {
  try {
    const url = new URL(listUrl);
    url.searchParams.set('format', 'feed');
    url.searchParams.set('type', 'rss');
    return url.toString();
  } catch {
    return null;
  }
}
