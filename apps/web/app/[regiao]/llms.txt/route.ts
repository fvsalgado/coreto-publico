import { API_PARAMETERS } from '@/src/lib/feeds/params';
import { SITE_URL } from '@/src/lib/env';
import { AUTOR, FEED_COPYRIGHT, PRODUTO } from '@/src/lib/produto';
import {
  countEventsBySeries,
  listCategories,
  listMunicipalities,
  listSeries,
} from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { seccaoLigada } from '@/src/lib/queries/seccoes';
import { urlDoSitio } from '@/src/lib/regiao';

/**
 * O que um motor de resposta precisa de saber antes de responder por nós.
 *
 * Um `llms.txt` é uma convenção nova e sem garantias — nenhum modelo é
 * obrigado a lê-lo. Vale na mesma, e por uma razão que não depende da moda: é
 * o único sítio onde o **âmbito** desta agenda está escrito de uma vez, em
 * texto corrido, para ser lido de uma penada. Um modelo que responda «não há
 * nada em Sardoal» porque só viu a página de entrada está a mentir sobre a
 * região; um que leia isto sabe que há onze concelhos, sabe que a agenda só
 * mostra o que ainda não aconteceu, e sabe pedir o resto à API em vez de o
 * adivinhar.
 *
 * É gerado e não escrito à mão, com a mesma regra que já valeu à página
 * `/levar`: números escritos à mão envelhecem em silêncio. Os concelhos, as
 * categorias e os ciclos saem da base; os parâmetros da API saem da mesma
 * lista que a rota de erro publica.
 */

export const revalidate = 3600;

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ regiao: string }> },
): Promise<Response> {
  const { regiao: regiaoId } = await routeContext.params;
  const regiao = await exigirRegiao(regiaoId);
  const origem = urlDoSitio(regiao, SITE_URL);
  const [concelhos, categorias, ciclos, contagens, haCiclos, haFontes] = await Promise.all([
    listMunicipalities(regiao.id),
    listCategories(),
    listSeries(regiao.id),
    countEventsBySeries(regiao.id),
    // Duas frases deste texto prometem páginas que se desligam no painel.
    // Uma promessa a um modelo é como uma promessa a uma pessoa: se a
    // página não existe, mais vale não a fazer.
    seccaoLigada(regiao.id, 'ciclos'),
    seccaoLigada(regiao.id, 'fontes'),
  ]);

  const ciclosComPrograma = ciclos.filter((ciclo) => (contagens[ciclo.id]?.total ?? 0) > 0);

  // «dos 11 concelhos da Comunidade…» — em algarismos, como sempre foi aqui:
  // a contagem sai da lista viva, não de uma constante.
  const quemServe = regiao.promotor ? `da ${regiao.promotor.nome}` : regiao.doNome;

  const texto = `# Coreto

> A agenda cultural dos ${concelhos.length} concelhos ${quemServe}, em Portugal. Reúne num sítio só a programação que está espalhada por dezenas de agendas municipais, de espaços e de coletividades, e publica-a em formatos abertos.

Endereço canónico: ${origem}
${regiao.promotor ? `Promovido pela ${regiao.promotor.nome} (${regiao.promotor.url}).\n` : ''}Software: ${PRODUTO.nome}, desenvolvido por ${AUTOR.nome} (${AUTOR.url}).
Língua: português de Portugal. Fuso: Europe/Lisbon.

## O que a agenda cobre

${concelhos.map((concelho) => `- ${concelho.name} (\`${concelho.id}\`) — ${origem}/concelho/${concelho.id}`).join('\n')}

## O que a agenda não cobre, e convém não inventar

- **As páginas mostram só o que está por acontecer.** Um evento sai da agenda,
  dos feeds e do mapa no dia seguinte ao fim; o que já começou e ainda não
  acabou continua em todos eles.
- **A API é a exceção, e convém não a confundir com um arquivo.** Com \`from\`
  numa data passada devolve o que ainda está na base — na prática, o que
  acabou há menos de 90 dias, porque é a essa idade que a recolha de cada
  noite o arquiva. A partir daí deixa de sair em qualquer endereço, e não há
  exportação do histórico.${
    haCiclos ? ' O que sobrevive são as edições passadas\n  dos ciclos, em `/ciclo/<id>`.' : ''
  }
- **Nem toda a região está lida.** Há espaços e coletividades sem sítio próprio
  ou sem forma de leitura automática, e por isso sub-representados.${
    haFontes ? `\n  O levantamento do que é lido e do que falta está em ${origem}/fontes.` : ''
  }
- **Os dados são os que as fontes publicam.** Um campo que a fonte não diz fica
  vazio, de propósito: preços, horas de fim e acessibilidade faltam muitas
  vezes. Ausência não é «não tem».

## Endereços de máquina

- \`${origem}/api/events\` — JSON, sem chave, CORS aberto, cache de uma hora.
  Parâmetros:
${API_PARAMETERS.map((parametro) => `  - \`${parametro.name}\` (${parametro.values}) — ${parametro.description}`).join('\n')}
  Para o programa de um dia: \`?from=<AAAA-MM-DD>&to=<AAAA-MM-DD>\`, que traz
  também o que já estava a decorrer nesse dia.
- \`${origem}/feed.xml\` — RSS de toda a região. Por concelho:
  \`${origem}/feed/<concelho>.xml\`.
- \`${origem}/agenda.ics\` — calendário iCalendar de toda a região. Por
  concelho: \`${origem}/agenda/<concelho>.ics\`. De um evento:
  \`${origem}/evento/<endereço>/agenda.ics\`.
- \`${origem}/sitemap.xml\` — as páginas todas, com datas de alteração.
- Cada ficha de evento e de espaço traz \`application/ld+json\` schema.org.

## O vocabulário fechado

Categorias: ${categorias.map((categoria) => `\`${categoria.slug}\``).join(', ')}.

Ciclos com programa publicado: ${
    ciclosComPrograma.length > 0
      ? ciclosComPrograma.map((ciclo) => `${ciclo.name} (\`${ciclo.id}\`)`).join(', ')
      : 'nenhum de momento'
  }.

## Licença e atribuição

${FEED_COPYRIGHT}

A distinção importa: uma data e um local são factos e não têm autor, e a
compilação vai sob CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). O
texto de apresentação e a fotografia do cartaz têm autor, e continuam de quem
os fez — citá-los é citar a fonte original, que cada ficha nomeia.

Ao citar, dizer «Coreto, a agenda cultural ${regiao.doNome}» e ligar à ficha do
evento em causa: é lá que está a informação mais recente, e é lá que quem
organiza a corrige.
`;

  return new Response(texto, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
