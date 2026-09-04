import { todayInLisbon } from '@coreto/core';
import { SITE_URL } from '@/src/lib/env';
import { listSitemapEvents } from '@/src/lib/feeds/data';
import type { SeccaoOpcional } from '@/src/lib/navegacao';
import { countEventsBySeries, listMunicipalities, listVenues } from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { seccoesDesligadas } from '@/src/lib/queries/seccoes';
import { urlDoSitio } from '@/src/lib/regiao';

/**
 * O mapa do sítio, por região.
 *
 * O que interessa a um motor de busca aqui são as fichas dos eventos: é por
 * elas que alguém chega ao Coreto a perguntar «o que há em Mação este fim de
 * semana». As páginas editoriais entram por completude e mudam de ano a ano.
 *
 * O tecto de mil eventos não é timidez: um sitemap tem um limite formal de
 * cinquenta mil endereços, mas um que mude de hora a hora e traga a agenda
 * inteira é ruído — o que vale é a janela do que ainda não aconteceu.
 *
 * Era o `app/sitemap.ts` de convenção; passou a route handler porque a
 * convenção vive na raiz e serve um sitemap único, e cada domínio precisa do
 * seu — só com os endereços da sua região, na sua origem. O middleware
 * reescreve `/sitemap.xml` para aqui, e o XML escreve-se à mão porque é meia
 * dúzia de elementos de um vocabulário que não muda desde 2005.
 *
 * **O `priority` e o `changefreq` saíram.** A Google diz desde 2023 que os
 * ignora, e o Bing pouco mais faz: o único campo que hoje conta é o `lastmod`,
 * e esse está bem — com a data verdadeira de cada concelho e de cada ficha.
 *
 * O que os segurava aqui era um acidente: o `priority` decidia também **quais**
 * as páginas que levavam `lastmod` (`page.priority >= 0.9`), e tirá-lo obrigava
 * a dizer isso de outra maneira. Diz-se com um booleano, que é o que aquilo
 * sempre foi — e o critério deixa de estar escondido dentro de um número cujo
 * significado nominal era outro. Um sitemap com mil eventos perde duas linhas
 * por endereço; o que fica é o que alguém lê.
 */

export const revalidate = 3600;

const EVENT_LIMIT = 1000;

interface StaticPage {
  path: string;
  /**
   * As páginas que mudam quando a agenda muda, e por isso levam `lastmod`.
   *
   * São as duas que listam eventos. As outras mudam quando alguém as
   * reescrever, e disso não há data na base — pôr-lhes a data do evento mais
   * recente era dizer que a política de privacidade se reescreve todas as
   * noites, que é a maneira mais rápida de ensinar um motor de busca a não
   * olhar para o campo.
   */
  segueAAgenda?: true;
  /** Quando existe, esta página só entra com a secção ligada no painel. */
  seccao?: SeccaoOpcional;
}

const STATIC_PAGES: readonly StaticPage[] = [
  { path: '/', segueAAgenda: true },
  { path: '/agenda', segueAAgenda: true },
  { path: '/mapa' },
  { path: '/espacos' },
  { path: '/coretos', seccao: 'coretos' },
  { path: '/ciclos', seccao: 'ciclos' },
  { path: '/submeter' },
  { path: '/levar' },
  { path: '/fontes', seccao: 'fontes' },
  { path: '/informacoes', seccao: 'informacoes' },
  // Sem `seccao`, de propósito: os dois textos legais não se desligam no
  // painel e têm de estar no mapa em qualquer estado dele.
  { path: '/privacidade' },
  { path: '/acessibilidade' },
];

interface Entrada {
  url: string;
  lastModified?: Date;
}

/** Os cinco carateres que o XML não deixa passar num texto. */
function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function serializar(entradas: readonly Entrada[]): string {
  const urls = entradas
    .map((entrada) => {
      const linhas = [`<loc>${escaparXml(entrada.url)}</loc>`];
      if (entrada.lastModified)
        linhas.push(`<lastmod>${entrada.lastModified.toISOString()}</lastmod>`);
      return `<url>\n${linhas.join('\n')}\n</url>`;
    })
    .join('\n');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urls}\n` +
    '</urlset>\n'
  );
}

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);
  const origem = urlDoSitio(regiao, SITE_URL);
  const today = todayInLisbon();

  const [events, municipalities, venues, seriesCounts, desligadas] = await Promise.all([
    listSitemapEvents(regiao.id, EVENT_LIMIT, today),
    listMunicipalities(regiao.id),
    listVenues(regiao.id),
    countEventsBySeries(regiao.id),
    seccoesDesligadas(regiao.id),
  ]);

  /*
   * Uma secção desligada responde 404, e um mapa do sítio que anuncia
   * endereços que devolvem 404 ensina um motor de busca a desconfiar do
   * ficheiro inteiro. Sai daqui ao mesmo tempo que sai da navegação.
   */
  const fora = new Set<SeccaoOpcional>(desligadas);

  // A alteração mais recente de qualquer evento serve de data às listagens:
  // é literalmente quando é que aquela página passou a mostrar outra coisa.
  const latest = events.reduce<string | null>(
    (newest, event) => (!newest || event.updated_at > newest ? event.updated_at : newest),
    null,
  );
  const listingDate = latest ? new Date(latest) : undefined;

  const pages: Entrada[] = STATIC_PAGES.filter(
    (page) => page.seccao === undefined || !fora.has(page.seccao),
  ).map((page) => ({
    url: `${origem}${page.path}`,
    ...(page.segueAAgenda ? { lastModified: listingDate } : {}),
  }));

  /*
   * Cada concelho com a data do evento mais recente **dele**.
   *
   * Levavam todos a data do evento mais recente da região, o que dizia a um
   * motor de busca que as onze páginas mudam ao mesmo tempo — e onze páginas
   * que mudam sempre à mesma hora são onze páginas em que a data deixa de
   * valer para alguma coisa. Um concelho sem nada marcado fica sem data, que é
   * a resposta honesta: não há por onde saber quando é que aquela página mudou
   * pela última vez.
   */
  const ultimaAlteracaoNoConcelho = new Map<string, string>();
  for (const event of events) {
    const anterior = ultimaAlteracaoNoConcelho.get(event.municipality_id);
    if (!anterior || event.updated_at > anterior) {
      ultimaAlteracaoNoConcelho.set(event.municipality_id, event.updated_at);
    }
  }

  const municipalityPages: Entrada[] = municipalities.map((municipality) => {
    const alterada = ultimaAlteracaoNoConcelho.get(municipality.id);
    return {
      url: `${origem}/concelho/${municipality.id}`,
      ...(alterada ? { lastModified: new Date(alterada) } : {}),
    };
  });

  const venuePages: Entrada[] = venues.map((venue) => ({
    url: `${origem}/espaco/${venue.id}`,
  }));

  // Só os ciclos com programação registada. Um ciclo que ainda não tem nada
  // para mostrar está nomeado em `/ciclos`, e é lá que ele deve ser encontrado
  // — não vale a pena mandar um motor de busca a uma página vazia.
  const seriesPages: Entrada[] = fora.has('ciclos')
    ? []
    : Object.keys(seriesCounts).map((id) => ({
        url: `${origem}/ciclo/${id}`,
      }));

  const eventPages: Entrada[] = events.map((event) => ({
    url: `${origem}/evento/${event.slug}`,
    lastModified: new Date(event.updated_at),
  }));

  const xml = serializar([
    ...pages,
    ...municipalityPages,
    ...venuePages,
    ...seriesPages,
    ...eventPages,
  ]);

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
