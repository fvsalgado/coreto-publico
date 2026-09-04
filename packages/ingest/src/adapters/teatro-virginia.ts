/**
 * O cinema do Teatro Virgínia, em Torres Novas — o concelho que faltava.
 *
 * Torres Novas é o único dos onze sem agenda municipal recolhível: o sítio da
 * câmara responde `503` a este recoletor, por um aparelho de segurança que
 * bloqueia por endereço. Enquanto isso não se resolve pela via certa (a câmara
 * autorizar o endereço de quem recolhe), o concelho não tem de ficar a zero: o
 * sítio do Teatro Virgínia **não** está atrás desse bloqueio e publica a época
 * de cinema inteira, sessão a sessão, com data, hora, realizador, duração e
 * classificação etária.
 *
 * A página é Joomla com TZ Portfolio Plus, e a programação vive dentro de um
 * acordeão. Cada sessão é um `<p>` com quatro linhas separadas por `<br>`:
 *
 *     07 | abril | TERÇA -FEIRA | 21h30
 *     O homem mais sortudo da América
 *     Realizado por Samir Oliveros
 *     Drama, Thriller | Estados Unidos da América, Chile, Colômbia | 90 min | M/12 | 2025
 *     <sinopse>
 *
 * **O ano não está na linha da sessão** — está num cabeçalho que a precede
 * («2026 abril . junho», ou só «2025»). É a única parte perigosa desta leitura:
 * adivinhar o ano seria fabricar datas, que é o erro que esta casa não comete.
 * Por isso o ano lê-se do cabeçalho e, enquanto não aparecer nenhum, não se lê
 * sessão nenhuma. Uma página que mude de feitio deixa de dar eventos em vez de
 * dar eventos errados.
 *
 * O último número da linha dos géneros é o ano **do filme**, não o da sessão.
 * São coisas diferentes e nunca se trocam: «M/12 | 2025» numa sessão de abril
 * de 2026 é um filme de 2025 exibido em 2026.
 *
 * Tudo o que aqui se assume foi lido de
 * `../__fixtures__/teatro-virginia-cinema.html`, recortado da página real a
 * 28 de agosto de 2026.
 */

import { slugify, type RawEvent } from '@coreto/core';
import { absoluteUrl, selectAll, selectFirst, stripTags } from '../html.js';
import { parseAdapterConfig, type Adapter, type AdapterContext } from '../adapter.js';

/** Os meses como a página os escreve — com e sem maiúscula, com e sem cedilha. */
const MESES: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

/** `07 | abril | TERÇA -FEIRA | 21h30` — o dia da semana varia e não se lê. */
const LINHA_DE_SESSAO = /^(\d{1,2})\s*\|\s*([A-Za-zç]+)\s*\|[^|]*\|\s*(\d{1,2})\s*h\s*(\d{2})/iu;

/**
 * O cabeçalho que declara o ano: «2026 abril . junho», «2025».
 *
 * Tem de ser um parágrafo curto começado pelo ano — assim não se confunde com
 * uma sinopse que por acaso comece por um número.
 */
const CABECALHO_DE_ANO = /^(20\d{2})\b/;
const MAX_CABECALHO = 40;

/** `90 min` na linha dos géneros. */
const DURACAO = /\b(\d{1,3})\s*min\b/i;

/** `M/12`, `M/16`, `M/6`. O «M/» sozinho (maiores) não dá idade. */
const CLASSIFICACAO = /\bM\/(\d{1,2})\b/;

const MAX_SESSOES = 120;

/**
 * As linhas de um parágrafo, com os `<br>` a valerem como quebra.
 *
 * Achatar tudo numa linha só perdia a fronteira entre a data, o título e o
 * realizador — que é exatamente o que aqui distingue os campos.
 */
export function linhasDoParagrafo(html: string): string[] {
  return stripTags(html.replace(/<\s*br\s*\/?\s*>/gi, '\n'))
    .split('\n')
    .map((linha) => linha.replace(/\s+/g, ' ').trim())
    .filter((linha) => linha.length > 0);
}

export interface SessaoLida {
  date: string;
  startTime: string;
  title: string;
  director: string | null;
  description: string | null;
  durationMinutes: number | null;
  minAge: number | null;
  categoriesRaw: string[];
}

/**
 * Lê um parágrafo como sessão, ou devolve `null` se ele não o for.
 *
 * O ano vem de fora porque só o cabeçalho o sabe. Sem ano não há data, e sem
 * data não há sessão — o parágrafo cai, em silêncio, como cai a nota de rodapé
 * sobre o preçário que vive no meio dos outros.
 */
export function lerSessao(linhas: string[], ano: number | null): SessaoLida | null {
  if (ano === null || linhas.length < 2) return null;

  const encontrado = LINHA_DE_SESSAO.exec(linhas[0]!);
  if (!encontrado) return null;

  const mes = MESES[encontrado[2]!.toLowerCase()];
  if (!mes) return null;

  const dia = encontrado[1]!.padStart(2, '0');
  const date = `${ano}-${mes}-${dia}`;
  const startTime = `${encontrado[3]!.padStart(2, '0')}:${encontrado[4]}`;

  const title = linhas[1]!;
  if (!title) return null;

  // Da terceira linha em diante, cada uma diz o que é pelo que traz: o
  // realizador anuncia-se, a dos géneros tem as barras e os minutos, e o que
  // sobra é a sinopse.
  let director: string | null = null;
  let durationMinutes: number | null = null;
  let minAge: number | null = null;
  let categoriesRaw: string[] = [];
  const sinopse: string[] = [];

  for (const linha of linhas.slice(2)) {
    const realizador = /^Realizado por\s+(.+)$/i.exec(linha);
    if (realizador && !director) {
      director = realizador[1]!.trim();
      continue;
    }

    const temDuracao = DURACAO.exec(linha);
    if (temDuracao && linha.includes('|') && durationMinutes === null) {
      durationMinutes = Number(temDuracao[1]);
      const idade = CLASSIFICACAO.exec(linha);
      if (idade) minAge = Number(idade[1]);
      // O primeiro segmento são os géneros do filme («Drama, Thriller»).
      categoriesRaw = (linha.split('|')[0] ?? '')
        .split(',')
        .map((parte) => parte.trim())
        .filter((parte) => parte.length > 0);
      continue;
    }

    sinopse.push(linha);
  }

  return {
    date,
    startTime,
    title,
    director,
    description: sinopse.length > 0 ? sinopse.join('\n') : null,
    durationMinutes,
    minAge,
    categoriesRaw,
  };
}

/** Lê o ano de um parágrafo de cabeçalho; `null` se o parágrafo não o for. */
export function lerAno(texto: string): number | null {
  if (texto.length > MAX_CABECALHO) return null;
  const encontrado = CABECALHO_DE_ANO.exec(texto);
  return encontrado ? Number(encontrado[1]) : null;
}

/**
 * Percorre a página e devolve as sessões pela ordem em que lá estão.
 *
 * Exportada para o teste poder correr sobre a fixture sem rede.
 */
export function lerPagina(html: string): SessaoLida[] {
  // A programação vive dentro do acordeão; fora dele há a ficha do cinema, o
  // preçário e os horários de bilheteira, que não são sessões.
  const corpo = selectFirst(html, '.accordion-inner')?.inner ?? html;

  const sessoes: SessaoLida[] = [];
  let ano: number | null = null;

  for (const paragrafo of selectAll(corpo, 'p', MAX_SESSOES * 2)) {
    const linhas = linhasDoParagrafo(paragrafo.inner);
    if (linhas.length === 0) continue;

    const anoDoCabecalho = linhas.length === 1 ? lerAno(linhas[0]!) : null;
    if (anoDoCabecalho !== null) {
      ano = anoDoCabecalho;
      continue;
    }

    const sessao = lerSessao(linhas, ano);
    if (sessao) sessoes.push(sessao);
    if (sessoes.length >= MAX_SESSOES) break;
  }

  return sessoes;
}

/**
 * O endereço do artigo da época, a partir da listagem da categoria.
 *
 * A listagem serve os artigos por ano — «Cinema 2026», «Cinema 2025» — e o
 * primeiro é o mais recente. Isto existe para o dia em que o artigo do ano
 * mudar de endereço: em vez de a fonte secar em silêncio, segue-se o primeiro
 * da lista. Os apelidos do Joomla não são cronológicos («cinema», «cinema-5»,
 * «cinema-2»), por isso é a ordem da página que decide, não o nome.
 */
export function primeiroArtigo(html: string, base: string): string | null {
  for (const ligacao of selectAll(html, 'a', 200)) {
    const href = ligacao.attributes.href;
    if (!href || !ARTIGO_DA_EPOCA.test(href)) continue;
    const absoluto = absoluteUrl(base, href);
    if (absoluto && absoluto !== base) return absoluto;
  }
  return null;
}

/** `/index.php/cinema/cinema-5/504` — a categoria, o apelido e o número. */
const ARTIGO_DA_EPOCA = /\/cinema\/cinema[\w-]*\/\d+/;

export const teatroVirginiaAdapter: Adapter = {
  id: 'teatro-virginia',

  async fetchEvents(context: AdapterContext): Promise<RawEvent[]> {
    const { config } = parseAdapterConfig(context.source.config);
    const urls = config.listUrls?.length ? config.listUrls : [context.source.url];

    // A página da época pesa quase meio megabyte e o servidor é lento visto de
    // longe: a fonte declara o tempo que precisa, senão o pedido morre antes de
    // a página acabar de chegar.
    const pedido = {
      ...(config.timeoutMs ? { timeoutMs: config.timeoutMs } : {}),
      // Sem compressão, quando a fonte o pede: ver `semCompressao` na
      // configuração — é o que distingue esta página respondida em segundos de
      // a mesma página a esgotar o tempo.
      ...(config.semCompressao ? { headers: { 'accept-encoding': 'identity' } } : {}),
    };

    const events: RawEvent[] = [];
    const vistos = new Set<string>();

    for (const url of urls) {
      const response = await context.http.get(url, pedido);
      if (!response.ok) {
        context.log.warn(`página sem resposta utilizável: ${url}`, response.error ?? undefined);
        continue;
      }

      let sessoes = lerPagina(response.body);

      // Página sem sessões: ou é a listagem da categoria, ou o artigo do ano
      // mudou de endereço. Num caso e no outro, a resposta é a mesma — seguir
      // o artigo mais recente que a página aponta.
      if (sessoes.length === 0) {
        const artigo = primeiroArtigo(response.body, response.url);
        if (artigo) {
          context.log.info(`sem sessões em ${url} — a seguir o artigo da época`, artigo);
          const resposta = await context.http.get(artigo, pedido);
          if (resposta.ok) sessoes = lerPagina(resposta.body);
          else context.log.warn(`artigo da época sem resposta: ${artigo}`);
        }
      }

      if (sessoes.length === 0) {
        context.log.warn(`nenhuma sessão de cinema lida em ${url}`);
        continue;
      }

      for (const sessao of sessoes) {
        // A chave junta data e título: o mesmo filme pode voltar noutra época,
        // e duas sessões do mesmo dia são dois eventos com títulos diferentes.
        const sourceKey = `tv-${sessao.date}-${slugify(sessao.title).slice(0, 60)}`;
        if (vistos.has(sourceKey)) continue;
        vistos.add(sourceKey);

        events.push({
          sourceKey,
          sourceUrl: response.url,
          title: sessao.title,
          // O realizador é o subtítulo natural de uma sessão de cinema.
          subtitle: sessao.director ? `Realizado por ${sessao.director}` : null,
          description: sessao.description,
          dates: [{ date: sessao.date, startTime: sessao.startTime }],
          venueId: context.source.venue_id,
          // «cinema» é o que a sessão é; os géneros do filme entram a seguir e
          // ajudam a taxonomia sem nunca a desviarem do essencial.
          categoriesRaw: ['cinema', ...sessao.categoriesRaw],
          durationMinutes: sessao.durationMinutes,
          minAge: sessao.minAge,
          payload: {
            extractedBy: 'teatro-virginia',
            director: sessao.director,
            promotor: 'Cineclube de Torres Novas',
          },
        });
      }
    }

    if (events.length === 0) context.log.warn('nenhuma sessão de cinema em nenhuma das páginas');

    return events;
  },
};
