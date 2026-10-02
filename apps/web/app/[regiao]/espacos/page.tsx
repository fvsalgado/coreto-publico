import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { EmptyState } from '@/src/components/EmptyState';
import { PageHeader } from '@/src/components/PageHeader';
import { ListagemStructuredData } from '@/src/components/StructuredData';
import { VenueCard } from '@/src/components/VenueCard';
import { espacosPorConfirmar } from '@/src/lib/coreto';
import { filtrarEspacos, ordenarEspacos } from '@/src/lib/espaco';
import { formatVenueKind } from '@/src/lib/format';
import {
  countEventsByVenue,
  listCoretos,
  listMunicipalities,
  listVenues,
} from '@/src/lib/queries/events';
import { enderecos } from '@/src/lib/enderecos';
import { SITE_URL } from '@/src/lib/env';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { osConcelhosDaRegiao, urlDoSitio } from '@/src/lib/regiao';
import type { Municipality, Venue } from '@/src/lib/queries/types';

export const revalidate = 3600;

const PATH = '/espacos';

type SearchParams = Record<string, string | string[] | undefined>;

interface Props {
  params: Promise<{ regiao: string }>;
  searchParams: Promise<SearchParams>;
}

/**
 * Filtros da página.
 *
 * `associations` e `acessivel` são literais e não booleanos coagidos de
 * propósito: o formulário só emite `1`, e `z.coerce.boolean()` daria `true` a
 * um `associations=0` escrito à mão, que é o contrário do que quem o escreveu
 * queria.
 */
const venueFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  concelho: z.string().trim().max(80).optional(),
  kind: z.string().trim().max(40).optional(),
  associations: z.literal('1').optional(),
  acessivel: z.literal('1').optional(),
});

type VenueFilter = z.infer<typeof venueFilterSchema>;

/** Os campos do formulário, pela ordem em que vão no endereço. */
const CAMPOS = ['q', 'concelho', 'kind', 'associations', 'acessivel'] as const;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readFilter(searchParams: SearchParams): VenueFilter {
  const raw: Record<string, string> = {};
  for (const key of CAMPOS) {
    const value = firstValue(searchParams[key])?.trim();
    if (value) raw[key] = value;
  }
  const parsed = venueFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

/** O endereço canónico de um filtro: só os campos que valem, pela ordem de `CAMPOS`. */
function hrefDoFiltro(filtro: VenueFilter): string {
  const params = new URLSearchParams();
  for (const key of CAMPOS) {
    const valor = filtro[key];
    if (valor) params.set(key, valor);
  }
  const query = params.toString();
  return query ? `${PATH}?${query}` : PATH;
}

/**
 * O formulário é GET, e um GET submete os campos que ficaram por preencher:
 * `/espacos?q=&concelho=&kind=tomar`. O endereço funciona, mas parece avariado
 * num WhatsApp — e a promessa da casa é que cada filtro é uma ligação que se
 * partilha tal como está (C2-037). Com um campo vazio no endereço, a página
 * manda para o canónico; sem JavaScript continua a funcionar, porque é o
 * servidor que o faz.
 */
function temCamposVazios(searchParams: SearchParams): boolean {
  return CAMPOS.some((key) => {
    const valor = searchParams[key];
    return valor !== undefined && (firstValue(valor)?.trim() ?? '') === '';
  });
}

interface Group {
  municipality: Municipality;
  venues: Venue[];
}

/**
 * Agrupa por concelho pela ordem oficial dos concelhos. A ordem dentro de
 * cada um — os que têm programação primeiro, as coletividades a seguir — e as
 * razões dela estão em `ordenarEspacos`.
 */
function groupByMunicipality(
  municipalities: Municipality[],
  venues: Venue[],
  eventCounts: Readonly<Record<string, number>>,
): Group[] {
  return municipalities
    .map((municipality) => ({
      municipality,
      venues: ordenarEspacos(
        venues.filter((venue) => venue.municipality_id === municipality.id),
        eventCounts,
      ),
    }))
    .filter((group) => group.venues.length > 0);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  return {
    title: 'Espaços',
    description: `Teatros, museus, bibliotecas, coletividades, filarmónicas e coretos ${osConcelhosDaRegiao(regiao, 'de')} ${regiao.doNome}, concelho a concelho.`,
    alternates: enderecos(urlDoSitio(regiao, SITE_URL), '/espacos'),
  };
}

export default async function VenuesPage({ params, searchParams }: Props) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const pedidos = await searchParams;
  const filter = readFilter(pedidos);
  if (temCamposVazios(pedidos)) redirect(hrefDoFiltro(filter));
  const [municipalities, allVenues, eventCounts, coretos] = await Promise.all([
    listMunicipalities(regiao.id),
    listVenues(regiao.id),
    countEventsByVenue(regiao.id),
    listCoretos(regiao.id),
  ]);

  // Os espaços que são coretos que ninguém confirmou ainda. É a única dúvida
  // que esta lista mostra por fora: `status = 'provisional'` quer dizer que a
  // ficha veio de fonte secundária, e não que o lugar possa não existir.
  // A regra de quem leva o selo está em `lib/coreto.ts`, com o caso que a
  // obrigou a existir.
  const porConfirmar = espacosPorConfirmar(coretos, allVenues);

  // Os tipos da caixa de seleção saem do catálogo inteiro, não do resultado
  // filtrado: uma lista de opções que encolhe a cada filtro deixa quem está a
  // procurar sem caminho de volta.
  const kinds = [...new Set(allVenues.map((venue) => venue.kind))]
    .map((kind) => ({ kind, label: formatVenueKind(kind) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt'));

  const activeKind = kinds.find((item) => item.kind === filter.kind) ?? null;
  const onlyAssociations = filter.associations === '1';
  /*
   * Só os espaços que declaram acesso a cadeiras de rodas (C2-012).
   *
   * «Um sítio onde se entre de cadeira de rodas» é das perguntas mais
   * concretas que se trazem a uma lista de espaços, e a casa tinha a resposta
   * em cada ficha — a 3 700 píxeis do topo da do Cine-Teatro — e em nenhum
   * cartão nem filtro. É a declaração do espaço e mais nada: sem ela, o
   * espaço fica de fora, e a nota da caixa di-lo.
   */
  const soAcessiveis = filter.acessivel === '1';
  const procura = filter.q ?? '';

  const venues = filtrarEspacos(allVenues, {
    procura,
    tipo: activeKind?.kind ?? null,
    soColetividades: onlyAssociations,
    soAcessiveis,
  });

  /*
   * O concelho, que era uma fila de onze âncoras — «Saltar para um concelho»
   * — e passou a campo do formulário. Onze opções num nível de navegação é o
   * que o requisito 3.1 da lista «Conteúdo» do Selo recusa (no máximo nove,
   * `docs/SELO.md`); como campo, filtra a lista em vez de a percorrer, e
   * funciona sem JavaScript.
   */
  const concelhoEscolhido =
    municipalities.find((municipality) => municipality.id === filter.concelho) ?? null;
  const groups = groupByMunicipality(municipalities, venues, eventCounts).filter(
    (group) => !concelhoEscolhido || group.municipality.id === concelhoEscolhido.id,
  );
  const quantosNaLista = groups.reduce((soma, group) => soma + group.venues.length, 0);
  const associationCount = allVenues.filter((venue) => venue.is_association).length;
  const acessiveisCount = allVenues.filter((venue) => venue.wheelchair_accessible === true).length;

  const hasCatalogue = allVenues.length > 0;

  const summary = !hasCatalogue
    ? 'O catálogo de espaços ainda não está disponível.'
    : quantosNaLista === 0
      ? 'Nenhum espaço corresponde a estes filtros.'
      : quantosNaLista === 1
        ? '1 espaço.'
        : `${quantosNaLista} espaços em ${groups.length} ${groups.length === 1 ? 'concelho' : 'concelhos'}.`;

  const activeFilterCount =
    (procura ? 1 : 0) +
    (concelhoEscolhido ? 1 : 0) +
    (activeKind ? 1 : 0) +
    (onlyAssociations ? 1 : 0) +
    (soAcessiveis ? 1 : 0);
  // Os que vivem atrás de «Mais filtros»: o nome e o concelho estão à vista.
  const filtrosEscondidos =
    (activeKind ? 1 : 0) + (onlyAssociations ? 1 : 0) + (soAcessiveis ? 1 : 0);
  const origem = urlDoSitio(regiao, SITE_URL);

  return (
    <>
      {/* A lista dita à máquina, e só sem filtros: com um filtro a valer, o
          que está no ecrã é um recorte, e o canónico continua a ser
          `/espacos`. Publicar o recorte com o endereço do todo era descrever o
          catálogo inteiro com meia dúzia de casas. */}
      {activeFilterCount === 0 && quantosNaLista > 0 ? (
        <ListagemStructuredData
          nome="Espaços"
          descricao={`Teatros, museus, bibliotecas, coletividades, filarmónicas e coretos ${regiao.doNome}.`}
          url={`${origem}${PATH}`}
          origem={origem}
          itens={venues.map((espaco) => ({
            nome: espaco.name,
            url: `${origem}/espaco/${espaco.id}`,
          }))}
          trilha={[
            { href: '/', label: 'Coreto' },
            { href: PATH, label: 'Espaços' },
          ]}
        />
      ) : null}

      <PageHeader
        title="Espaços"
        eyebrow="Os palcos"
        lead={`Onde acontece a programação ${regiao.doNome}: cine-teatros e museus, mas também filarmónicas, ranchos, cineclubes e casas do povo — que vêm primeiro em cada concelho.`}
      />

      {/*
        A pesquisa pelo nome e o concelho à vista; o resto atrás de «Mais
        filtros», recolhido em qualquer largura.

        Em secretária o formulário estava aberto à frente da grelha, e os
        primeiros espaços começavam aos 760 píxeis (C1-017). O nome é o que
        quem chega costuma saber — «Virgínia», «a filarmónica» — e o concelho
        é a outra pergunta da lista; o tipo e as duas caixas são para quem já
        está a afinar.

        Um formulário só, e por isso um botão só: as duas metades escrevem no
        mesmo endereço, e partido em dois um deles perdia os campos do outro.
      */}
      <form method="get" action={PATH} role="search" aria-label="Procurar nos espaços">
        <div className="flex flex-wrap gap-2">
          <label htmlFor="filtro-nome" className="sr-only">
            Procurar pelo nome
          </label>
          <input
            type="search"
            id="filtro-nome"
            name="q"
            defaultValue={filter.q ?? ''}
            placeholder="Virgínia, Gil Vicente, filarmónica…"
            className="min-h-11 min-w-0 flex-[1_1_14rem] rounded border border-field bg-surface px-3 py-2 text-base text-ink"
          />
          {municipalities.length > 1 ? (
            <>
              <label htmlFor="filtro-concelho" className="sr-only">
                Concelho
              </label>
              <select
                id="filtro-concelho"
                name="concelho"
                defaultValue={concelhoEscolhido?.id ?? ''}
                className="min-h-11 min-w-0 flex-[1_1_10rem] rounded border border-field bg-surface px-3 py-2 text-base text-ink"
              >
                <option value="">Todos os concelhos</option>
                {municipalities.map((municipality) => (
                  <option key={municipality.id} value={municipality.id}>
                    {municipality.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <button
            type="submit"
            className="min-h-11 rounded bg-accent px-5 text-sm font-medium text-on-accent"
          >
            Procurar
          </button>
        </div>

        <details className="ct-recolhivel ct-recolhivel-sempre mt-2 rounded border border-border bg-surface">
          <summary>
            <span>Mais filtros</span>
            {filtrosEscondidos > 0 ? (
              <>
                <span
                  aria-hidden="true"
                  className="ct-octagon grid size-6 shrink-0 place-items-center bg-accent text-xs font-semibold text-on-accent"
                >
                  {filtrosEscondidos}
                </span>
                <span className="sr-only">
                  {filtrosEscondidos === 1
                    ? ', 1 filtro ativo'
                    : `, ${filtrosEscondidos} filtros ativos`}
                </span>
              </>
            ) : null}
          </summary>

          <div className="ct-recolhivel-conteudo px-4 pt-1 pb-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="filtro-tipo" className="block text-sm font-medium">
                  Tipo de espaço
                </label>
                {/* `border-field` e não `border-border`: a moldura de um campo
                    identifica um controlo e tem de ter 3:1 contra o fundo. */}
                <select
                  id="filtro-tipo"
                  name="kind"
                  defaultValue={activeKind?.kind ?? ''}
                  className="mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink"
                >
                  <option value="">Todos os tipos</option>
                  {kinds.map((item) => (
                    <option key={item.kind} value={item.kind}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset>
                <legend className="block text-sm font-medium">Mostrar apenas</legend>
                <label
                  htmlFor="filtro-coletividades"
                  className="flex min-h-11 items-center gap-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    id="filtro-coletividades"
                    name="associations"
                    value="1"
                    defaultChecked={onlyAssociations}
                    className="size-5 accent-accent"
                  />
                  Só coletividades{associationCount > 0 ? ` (${associationCount})` : ''}
                </label>
                {/* Oferece-se quando há o que mostrar, como as caixas da agenda:
                    uma caixa que devolve sempre zero é uma armadilha. Sem
                    nenhum, diz-se — esconder calado é a outra armadilha. */}
                {acessiveisCount > 0 || soAcessiveis ? (
                  <label
                    htmlFor="filtro-acessivel"
                    className="flex min-h-11 items-center gap-2.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      id="filtro-acessivel"
                      name="acessivel"
                      value="1"
                      defaultChecked={soAcessiveis}
                      aria-describedby="filtro-acessivel-nota"
                      className="size-5 accent-accent"
                    />
                    Com acesso a cadeiras de rodas
                    {acessiveisCount > 0 ? ` (${acessiveisCount})` : ''}
                  </label>
                ) : null}
                <p id="filtro-acessivel-nota" className="mt-1 text-sm text-muted">
                  {acessiveisCount > 0 || soAcessiveis
                    ? 'Os espaços que declaram acesso a cadeiras de rodas — sem declaração, um espaço fica de fora. A ficha de cada um diz o que se sabe.'
                    : 'Por agora, nenhum espaço desta lista declara acesso a cadeiras de rodas.'}
                </p>
              </fieldset>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="min-h-11 rounded bg-accent px-5 text-sm font-medium text-on-accent"
              >
                Filtrar
              </button>
              <Link
                href={PATH}
                className="inline-flex min-h-11 items-center rounded px-3 text-sm underline underline-offset-4"
              >
                Limpar filtros
              </Link>
            </div>
          </div>
        </details>
      </form>

      <p role="status" className="mt-6 text-sm text-muted">
        {summary}
      </p>

      {groups.length > 0 ? (
        <div className="mt-6 space-y-12">
          {groups.map((group) => (
            <section
              key={group.municipality.id}
              aria-labelledby={`espacos-${group.municipality.id}`}
            >
              <h2 id={`espacos-${group.municipality.id}`} className="ct-heading scroll-mt-6">
                {/* 44 px de alvo, e não os 34 da linha do título: é uma ligação
                    que se toca, e o check:selo mediu-a com dados (5.2). */}
                <Link
                  href={`/concelho/${group.municipality.id}`}
                  className="inline-flex min-h-11 max-w-full items-center underline-offset-4 [overflow-wrap:anywhere] hover:underline"
                >
                  {group.municipality.name}
                </Link>
              </h2>

              <ul className="@container mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {group.venues.map((venue) => (
                  <VenueCard
                    key={venue.id}
                    venue={venue}
                    count={eventCounts[venue.id] ?? 0}
                    porConfirmar={porConfirmar.has(venue.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            hasCatalogue
              ? 'Sem espaços para estes filtros.'
              : 'O catálogo ainda não está disponível.'
          }
          description={
            !hasCatalogue
              ? 'Estamos a reunir os espaços concelho a concelho. Se faltar aqui a coletividade da sua terra, é a melhor altura para o dizer.'
              : soAcessiveis
                ? 'Só aparecem os espaços que declaram acesso a cadeiras de rodas, e sem declaração não quer dizer sem acesso: a ficha de cada espaço diz o que se sabe.'
                : 'Talvez o tipo escolhido ainda não tenha nenhum espaço registado. E se faltar aqui a coletividade da sua terra, basta dizer — é para isso que a lista existe.'
          }
          action={{ href: '/submeter', label: 'Falta um espaço' }}
        />
      )}
    </>
  );
}
