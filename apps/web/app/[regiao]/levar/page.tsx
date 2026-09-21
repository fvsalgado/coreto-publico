import type { Metadata } from 'next';
import Link from 'next/link';
import { CALENDAR_LIMIT } from '@/app/[regiao]/agenda.ics/route';
import { FEED_LIMIT } from '@/app/[regiao]/feed.xml/route';
import { ConstrutorDeWidget } from '@/src/components/ConstrutorDeWidget';
import { PageHeader } from '@/src/components/PageHeader';
import { SITE_URL } from '@/src/lib/env';
import { API_PARAMETERS } from '@/src/lib/feeds/params';
import {
  countEventsBySeries,
  listCategories,
  listMunicipalities,
  listSeries,
  listVenues,
} from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { urlDoSitio } from '@/src/lib/regiao';
import { CATALOGO } from '@/src/lib/widget/opcoes';

export const revalidate = 3600;

interface Props {
  params: Promise<{ regiao: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  return {
    title: 'Levar a agenda',
    description: `A agenda ${regiao.doNome} dentro do vosso sítio: uma caixa para colar, feeds RSS e iCalendar, e uma API aberta em JSON. Sem conta, sem chave, sem custo.`,
    alternates: { canonical: '/levar' },
  };
}

/**
 * Uma página, e não duas.
 *
 * O construtor do widget vivia em `/widget` e os feeds e a API na segunda
 * metade de `/fontes`, e as duas apontavam uma à outra — que é o sintoma de
 * serem a mesma coisa. Quem cola a caixa e quem puxa o feed é a mesma pessoa a
 * fazer a mesma pergunta: **como ponho a agenda do Coreto dentro do meu
 * sítio?** A resposta estava partida em duas moradas, e a `/fontes` tinha
 * seiscentas e sessenta e nove linhas por estar a servir duas casas — quem
 * quer confiar na proveniência e quem quer reutilizar os dados.
 *
 * `/fontes` fica com a primeira pergunta e nada mais. Esta página fica com a
 * segunda, do mais fácil para o mais técnico: a caixa pronta, depois os
 * endereços, depois a API.
 */

interface FeedRow {
  path: string;
  description: string;
}

/**
 * Os endereços globais, com os números lidos de onde eles valem.
 *
 * É uma função e não uma constante de módulo por duas razões, e as duas são a
 * mesma: **um número escrito à mão numa página é um número que envelhece em
 * silêncio.** Os limites dos feeds estavam aqui escritos — «os próximos 50»,
 * «os próximos 100» — enquanto o valor a valer vivia em `FEED_LIMIT` e em
 * `CALENDAR_LIMIT`; e a contagem dos concelhos estava escrita por extenso a
 * três dedos de uma tabela que os conta da base de dados. Agora os primeiros
 * vêm das rotas que os aplicam e a segunda entra por argumento, do mesmo
 * `listMunicipalities()` que desenha a tabela.
 */
function feedsGlobais(concelhos: number): readonly FeedRow[] {
  return [
    {
      path: '/feed.xml',
      description: `RSS 2.0 com os próximos ${FEED_LIMIT} eventos dos ${concelhos} concelhos.`,
    },
    {
      path: '/agenda.ics',
      description: `Calendário iCalendar com os próximos ${CALENDAR_LIMIT} eventos. Para subscrever, não para descarregar uma vez.`,
    },
    {
      path: '/api/events',
      description: 'A agenda em JSON, com filtros. É a base do widget e de qualquer integração.',
    },
    {
      path: '/dados.json',
      description:
        'O catálogo de uma vez, sem paginar, com a data de geração, a contagem e a licença dentro do próprio ficheiro. É o que se anexa a um processo em vez de explicar o que é uma API.',
    },
    {
      path: '/dados.csv',
      description:
        'O mesmo, para quem abre folhas de cálculo. Com BOM, ponto e vírgula e os metadados em linhas «#» à cabeça, que o Excel e o LibreOffice saltam.',
    },
    {
      path: '/sitemap.xml',
      description: `Mapa do sítio: as páginas fixas, os ${concelhos} concelhos, os espaços, os ciclos com programação e os eventos por acontecer. O que já passou não entra — um mapa do sítio é para o que se pode visitar.`,
    },
  ];
}

const exemploDePedido = (origem: string) =>
  `${origem}/api/events?municipality=tomar&category=musica&free=1&limit=10`;

const exemploDeResposta = (origem: string) => `{
  "events": [
    {
      "id": "…",
      "slug": "concerto-de-ano-novo-tomar",
      "title": "Concerto de Ano Novo",
      "description_short": "A Banda dos Bombeiros abre o ano no Cine-Teatro.",
      "municipality_id": "tomar",
      "venue_id": "cine-teatro-paraiso",
      "location_name": null,
      "category_slug": "musica",
      "category_confidence": 0.95,
      "category_source": "alias",
      "date_start": "2027-01-01",
      "date_end": "2027-01-01",
      "is_ongoing": false,
      "is_free": true,
      "price_display": null,
      "image_url": "…",
      "image_alt": "…",
      "image_miniatura": "…",
      "wheelchair_accessible": true,
      "has_sign_language": false,
      "has_audio_description": false,
      "has_subtitles": false,
      "is_relaxed_performance": false,
      "audience": "all_ages",
      "url": "${origem}/evento/concerto-de-ano-novo-tomar",
      "municipality_name": "Tomar",
      "category_name": "Música",
      "venue_name": "Cine-Teatro Paraíso",
      "updated_at": "2026-12-20T03:12:44.000Z",
      "sessions": [{ "date": "2027-01-01", "start_time": "21:30", "end_time": null }]
    }
  ],
  "total": 37,
  "page": 1,
  "limit": 10
}`;

function Endereco({ origem, path }: { origem: string; path: string }) {
  return (
    <a
      href={path}
      className="inline-flex min-h-11 items-center font-mono text-sm break-all underline underline-offset-4 sm:min-h-0"
    >
      {origem}
      {path}
    </a>
  );
}

export default async function LevarPage({ params }: Props) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const origem = urlDoSitio(regiao, SITE_URL);
  const [municipalities, espacos, categorias, series, contagens] = await Promise.all([
    listMunicipalities(regiao.id),
    listVenues(regiao.id),
    listCategories(),
    listSeries(regiao.id),
    countEventsBySeries(regiao.id),
  ]);

  // Só os ciclos com programa por acontecer: oferecer uma caixa de agenda de um
  // ciclo que não tem nada marcado é oferecer uma caixa vazia.
  const ciclos = series.filter((ciclo) => (contagens[ciclo.id]?.porAcontecer ?? 0) > 0);

  return (
    <>
      <PageHeader
        title="Levar a agenda"
        eyebrow="Para o vosso sítio"
        lead={`A programação ${regiao.doNome} dentro da vossa página: uma caixa pronta a colar, os feeds para calendários e leitores de notícias, e a API para quem quiser montar o seu próprio desenho.`}
      />

      <p className="max-w-2xl rounded border border-border bg-accent-soft p-4 text-sm">
        <strong>Não é preciso conta, nem chave, nem pedir autorização.</strong> Escolham em baixo,
        copiem o código e está feito. Não há nada para instalar do vosso lado e não vos vamos cobrar
        nada — a agenda é pública e é para ser usada.
      </p>

      <section aria-labelledby="construtor" className="mt-10">
        <h2 id="construtor" className="ct-heading">
          Montem a vossa
        </h2>
        <ConstrutorDeWidget
          base={origem}
          concelhos={municipalities.map(({ id, name }) => ({ id, name }))}
          espacos={espacos.map(({ id, name, municipality_id }) => ({ id, name, municipality_id }))}
          ciclos={ciclos.map(({ id, name }) => ({ id, name }))}
          categorias={categorias.map(({ slug, name }) => ({ slug, name }))}
        />
      </section>

      <section aria-labelledby="opcoes" className="mt-14">
        <h2 id="opcoes" className="ct-heading">
          Todas as opções
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          O construtor cobre o que quase toda a gente precisa. Esta é a lista completa, para quem
          quiser escrever o código à mão ou montá-lo a partir do vosso gestor de conteúdos.
        </p>
        <div
          className="mt-4 overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Tabela, deslocável na horizontal"
        >
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Atributos aceites pelo widget, valores possíveis e comportamento por omissão
            </caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Atributo
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Valores
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Por omissão
                </th>
                <th scope="col" className="py-2 font-semibold">
                  O que faz
                </th>
              </tr>
            </thead>
            <tbody>
              {CATALOGO.map((opcao) => (
                <tr key={opcao.atributo} className="border-b border-border align-top">
                  <th scope="row" className="py-2 pr-4 text-left font-normal">
                    <code>{opcao.atributo}</code>
                  </th>
                  <td className="py-2 pr-4 text-muted">{opcao.valores}</td>
                  <td className="py-2 pr-4 text-muted">{opcao.omissao}</td>
                  <td className="py-2">{opcao.descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Um valor que não seja reconhecido é ignorado e vale o valor por omissão. Um erro de
          escrita do vosso lado nunca deixa a caixa em branco.
        </p>
      </section>

      <section aria-labelledby="letra-pequena" className="mt-12">
        <h2 id="letra-pequena" className="ct-heading">
          A letra pequena
        </h2>
        <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 text-muted">
          <li>
            A caixa não põe cookies e não segue quem visita o vosso sítio. Carrega a lista e mais
            nada.
          </li>
          <li>
            As ligações abrem num separador novo, para ninguém sair do vosso sítio sem querer.
          </li>
          <li>
            A programação vem da mesma base que alimenta o Coreto: o que corrigirem numa, corrige-se
            na outra.
          </li>
          <li>
            Se preferirem montar a lista com o vosso próprio desenho, os{' '}
            <a href="#dados" className="underline underline-offset-4">
              feeds e a API aberta
            </a>{' '}
            estão aqui em baixo.
          </li>
          <li>
            Falta um evento vosso na caixa?{' '}
            <Link href="/submeter" className="underline underline-offset-4">
              Enviem-no
            </Link>{' '}
            — aparece assim que passar pela moderação.
          </li>
        </ul>
      </section>

      <section aria-labelledby="dados" className="mt-14 border-t border-border pt-8">
        <h2 id="dados" className="ct-heading scroll-mt-6">
          Os dados em bruto
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          A agenda sai em formatos que outras máquinas leem: RSS para leitores de notícias,
          iCalendar para calendários, JSON para quem quer montar a sua própria página. É a agenda —
          o que está para vir. O arquivo das edições passadas dos ciclos vive nas páginas deles e
          não sai por aqui; quem o quiser, escreva.
        </p>

        <p className="mt-4 max-w-2xl rounded border border-border bg-accent-soft p-4 text-sm">
          <strong>Não é preciso chave nem registo.</strong> Os endereços abaixo respondem a qualquer
          pedido, de qualquer origem — e são para quem quer montar a lista com o seu próprio
          desenho. Quem só procura uma caixa pronta para colar não precisa de escrever código
          nenhum: está{' '}
          <a href="#construtor" className="underline underline-offset-4">
            aqui em cima
          </a>
          .
        </p>

        <h3 className="mt-8 text-base font-semibold">Endereços globais</h3>
        <dl className="mt-3 space-y-4">
          {feedsGlobais(municipalities.length).map((feed) => (
            <div key={feed.path} className="border-b border-border pb-4 last:border-b-0">
              <dt>
                <Endereco origem={origem} path={feed.path} />
              </dt>
              <dd className="mt-1 max-w-2xl text-sm text-muted">{feed.description}</dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-8 text-base font-semibold">Por concelho</h3>
        <p className="mt-2 max-w-2xl text-muted">
          Cada concelho tem os seus dois endereços. O padrão é{' '}
          <code className="rounded bg-accent-soft px-1">/feed/&lt;concelho&gt;.xml</code> e{' '}
          <code className="rounded bg-accent-soft px-1">/agenda/&lt;concelho&gt;.ics</code>.
        </p>

        {municipalities.length > 0 ? (
          <div
            className="mt-4 overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Tabela, deslocável na horizontal"
          >
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Endereços de RSS e de calendário para cada um dos {municipalities.length} concelhos
              </caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Concelho
                  </th>
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    RSS
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Calendário
                  </th>
                </tr>
              </thead>
              <tbody>
                {municipalities.map((municipality) => (
                  <tr key={municipality.id} className="border-b border-border">
                    <th scope="row" className="py-3 pr-4 text-left font-normal">
                      {municipality.name}
                    </th>
                    <td className="pr-4">
                      <a
                        href={`/feed/${municipality.id}.xml`}
                        className="flex min-h-11 items-center font-mono text-xs underline underline-offset-4"
                      >
                        /feed/{municipality.id}.xml
                      </a>
                    </td>
                    <td>
                      <a
                        href={`/agenda/${municipality.id}.ics`}
                        className="flex min-h-11 items-center font-mono text-xs underline underline-offset-4"
                      >
                        /agenda/{municipality.id}.ics
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="mt-4 max-w-2xl text-sm text-muted">
          Cada evento tem também o seu próprio calendário, em{' '}
          <code className="rounded bg-accent-soft px-1">/evento/&lt;endereço&gt;/agenda.ics</code> —
          é o botão «adicionar ao calendário» da ficha.
        </p>

        <h3 className="mt-8 text-base font-semibold">A API em JSON</h3>
        <p className="mt-2 max-w-2xl text-muted">
          <code className="rounded bg-accent-soft px-1">GET /api/events</code> devolve{' '}
          <code className="rounded bg-accent-soft px-1">
            {'{ events, total, page, limit, license, attribution, documentation }'}
          </code>
          . Aceita pedidos de qualquer origem (CORS aberto) e responde sempre em UTF-8. Um parâmetro
          inválido devolve 400 com a lista dos parâmetros aceites dentro da própria resposta.
        </p>
        <p className="mt-2 max-w-2xl text-muted">
          Cada evento traz as colunas do cartão e, ao lado dos identificadores, o que eles querem
          dizer: <code className="rounded bg-accent-soft px-1">municipality_name</code>,{' '}
          <code className="rounded bg-accent-soft px-1">category_name</code>,{' '}
          <code className="rounded bg-accent-soft px-1">venue_name</code>, o{' '}
          <code className="rounded bg-accent-soft px-1">updated_at</code> e as{' '}
          <code className="rounded bg-accent-soft px-1">sessions</code> com data, hora de início e
          hora de fim. Sem isso, quem integra ficava com{' '}
          <code className="rounded bg-accent-soft px-1">venue_id</code> e sem forma de saber de que
          espaço se trata.
        </p>

        <div
          className="mt-4 overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Tabela, deslocável na horizontal"
        >
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Parâmetros aceites pelo endereço /api/events</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Parâmetro
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Valores
                </th>
                <th scope="col" className="py-2 font-semibold">
                  O que faz
                </th>
              </tr>
            </thead>
            <tbody>
              {API_PARAMETERS.map((parameter) => (
                <tr key={parameter.name} className="border-b border-border align-top">
                  <th scope="row" className="py-2 pr-4 text-left font-normal">
                    <code>{parameter.name}</code>
                  </th>
                  <td className="py-2 pr-4 text-muted">{parameter.values}</td>
                  <td className="py-2">{parameter.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <pre
          className="mt-4 overflow-x-auto rounded border border-border bg-surface p-3 text-xs"
          tabIndex={0}
        >
          <code>{exemploDePedido(origem)}</code>
        </pre>

        <details className="mt-3 rounded-lg border border-border bg-surface">
          <summary className="ct-sem-marca flex min-h-11 cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
            <span aria-hidden="true" className="ct-octagon size-2 shrink-0 bg-highlight" />
            Ver a resposta
          </summary>
          <pre
            className="overflow-x-auto border-t border-border p-3 text-xs leading-relaxed"
            tabIndex={0}
          >
            <code>{exemploDeResposta(origem)}</code>
          </pre>
        </details>

        <h3 className="mt-8 text-base font-semibold">Sem nos deitar abaixo</h3>
        <ul className="mt-3 max-w-2xl list-disc space-y-2 pl-5 text-muted">
          <li>
            Os feeds são recalculados de hora a hora. Ir buscá-los mais vezes do que isso não traz
            nada de novo.
          </li>
          <li>
            Não há limite publicado nem chaves a distribuir. Há bom senso: um pedido por minuto por
            feed é muito mais do que suficiente.
          </li>
          <li>
            Identifiquem-se no <code>User-Agent</code> com um nome e um contacto. É assim que vos
            conseguimos avisar em vez de vos bloquear.
          </li>
          <li>
            Precisam da exportação completa e não de uma janela dos próximos eventos? Escrevam — é
            mais barato para os dois lados do que percorrer a paginação toda.
          </li>
        </ul>

        <h3 className="mt-8 text-base font-semibold">Licença</h3>
        <div className="mt-2 max-w-2xl space-y-3 text-muted">
          <p>
            Uma data, uma hora, um local e um preço são factos: não têm autor. A compilação — o
            trabalho de reunir, normalizar e ligar tudo isto — é disponibilizada sob{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/deed.pt"
              className="underline underline-offset-4"
              rel="noopener"
            >
              CC BY 4.0
            </a>
            : podem usá-la para o que quiserem, incluindo comercialmente, desde que digam de onde
            veio e liguem para o Coreto.
          </p>
          <p>
            Os textos de apresentação, os cartazes e as fotografias <strong>não</strong> são nossos
            e não vão nesta licença: continuam de quem os fez. Os feeds trazem por isso resumos e
            ligações, e não o texto integral nem as imagens. Para republicar uma descrição ou um
            cartaz, o pedido é a quem organiza — e o campo{' '}
            <code className="rounded bg-accent-soft px-1">url</code> de cada evento leva lá.
          </p>
          <p>
            Desde 21 de setembro de 2026, o{' '}
            <code className="rounded bg-accent-soft px-1">image_url</code> de alguns eventos aponta
            para uma cópia nossa, redimensionada, do cartaz que a câmara publicou — é mais rápida e
            não morre quando a câmara arruma a pasta do ano. Guardar uma cópia não a torna nossa:
            continua de quem a fez, e quem a quiser republicar continua a ter de pedir a quem
            organiza. O <code className="rounded bg-accent-soft px-1">image_miniatura</code> é a
            mesma imagem a 400 píxeis, para listas; é nulo quando o cartaz é servido de casa de quem
            o publicou.
          </p>
          <p>
            Atribuição sugerida: «Dados da agenda cultural{' '}
            <a href={origem} className="underline underline-offset-4">
              Coreto
            </a>
            , CC BY 4.0».
          </p>
        </div>
      </section>
    </>
  );
}
