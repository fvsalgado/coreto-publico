import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { EmptyState } from '@/src/components/EmptyState';
import { PageHeader } from '@/src/components/PageHeader';
import { ListagemStructuredData } from '@/src/components/StructuredData';
import { VenueCard } from '@/src/components/VenueCard';
import { espacosPorConfirmar } from '@/src/lib/coreto';
import { nomeCasaCom } from '@/src/lib/espaco';
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
import { urlDoSitio } from '@/src/lib/regiao';
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
 * `associations` é um literal e não um booleano coagido de propósito: o
 * formulário só emite `1`, e `z.coerce.boolean()` daria `true` a um
 * `associations=0` escrito à mão, que é o contrário do que quem o escreveu
 * queria.
 */
const venueFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  kind: z.string().trim().max(40).optional(),
  associations: z.literal('1').optional(),
});

type VenueFilter = z.infer<typeof venueFilterSchema>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readFilter(searchParams: SearchParams): VenueFilter {
  const raw: Record<string, string> = {};
  for (const key of ['q', 'kind', 'associations'] as const) {
    const value = firstValue(searchParams[key])?.trim();
    if (value) raw[key] = value;
  }
  const parsed = venueFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

interface Group {
  municipality: Municipality;
  venues: Venue[];
}

/**
 * Agrupa por concelho pela ordem oficial dos concelhos.
 *
 * Dentro de cada concelho as coletividades vêm primeiro. Não é uma questão
 * de gosto: numa lista alfabética a filarmónica fica sempre atrás do centro
 * cultural, e a filarmónica é metade da razão de esta agenda existir.
 */
function groupByMunicipality(municipalities: Municipality[], venues: Venue[]): Group[] {
  return municipalities
    .map((municipality) => ({
      municipality,
      venues: venues
        .filter((venue) => venue.municipality_id === municipality.id)
        .sort((a, b) => {
          if (a.is_association !== b.is_association) return a.is_association ? -1 : 1;
          return a.name.localeCompare(b.name, 'pt');
        }),
    }))
    .filter((group) => group.venues.length > 0);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  return {
    title: 'Espaços',
    description: `Teatros, museus, bibliotecas, coletividades, filarmónicas e coretos dos ${regiao.concelhosPorExtenso} concelhos ${regiao.doNome}, concelho a concelho.`,
    alternates: enderecos(urlDoSitio(regiao, SITE_URL), '/espacos'),
  };
}

export default async function VenuesPage({ params, searchParams }: Props) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const filter = readFilter(await searchParams);
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
  const procura = filter.q ?? '';

  const venues = allVenues.filter((venue) => {
    if (!nomeCasaCom(venue.name, procura)) return false;
    if (activeKind && venue.kind !== activeKind.kind) return false;
    if (onlyAssociations && !venue.is_association) return false;
    return true;
  });

  const groups = groupByMunicipality(municipalities, venues);
  const associationCount = allVenues.filter((venue) => venue.is_association).length;

  const hasCatalogue = allVenues.length > 0;

  const summary = !hasCatalogue
    ? 'O catálogo de espaços ainda não está disponível.'
    : venues.length === 0
      ? 'Nenhum espaço corresponde a estes filtros.'
      : venues.length === 1
        ? '1 espaço.'
        : `${venues.length} espaços em ${groups.length} ${groups.length === 1 ? 'concelho' : 'concelhos'}.`;

  const activeFilterCount = (procura ? 1 : 0) + (activeKind ? 1 : 0) + (onlyAssociations ? 1 : 0);
  const origem = urlDoSitio(regiao, SITE_URL);

  return (
    <>
      {/* A lista dita à máquina, e só sem filtros: com um filtro a valer, o
          que está no ecrã é um recorte, e o canónico continua a ser
          `/espacos`. Publicar o recorte com o endereço do todo era descrever o
          catálogo inteiro com meia dúzia de casas. */}
      {activeFilterCount === 0 && venues.length > 0 ? (
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

      <details className="ct-recolhivel rounded border border-border bg-surface">
        <summary aria-label="Mostrar ou esconder os filtros dos espaços">
          <span>Filtrar</span>
          {activeFilterCount > 0 ? (
            <span className="ct-octagon grid size-6 shrink-0 place-items-center bg-accent text-xs font-semibold text-on-accent">
              {activeFilterCount}
            </span>
          ) : null}
        </summary>

        <form
          method="get"
          action={PATH}
          role="search"
          aria-label="Filtrar os espaços"
          className="px-4 pt-1 pb-4 sm:pt-4"
        >
          <div className="mb-4">
            <label htmlFor="filtro-nome" className="block text-sm font-medium">
              Procurar pelo nome
            </label>
            <input
              type="search"
              id="filtro-nome"
              name="q"
              defaultValue={filter.q ?? ''}
              placeholder="Virgínia, Gil Vicente, filarmónica…"
              className="mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink"
            />
          </div>

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

            <label
              htmlFor="filtro-coletividades"
              className="flex min-h-11 items-center gap-2.5 text-sm sm:mt-6"
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
        </form>
      </details>

      <p role="status" className="mt-6 text-sm text-muted">
        {summary}
      </p>

      {/* Onze concelhos são uma página comprida: as âncoras poupam o dedo a
          quem só quer chegar ao seu. */}
      {groups.length > 1 ? (
        <nav aria-label="Saltar para um concelho" className="mt-4">
          <ul className="ct-fila-fichas">
            {groups.map((group) => (
              <li key={group.municipality.id}>
                <a
                  href={`#espacos-${group.municipality.id}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm whitespace-nowrap underline-offset-4 hover:border-accent hover:underline"
                >
                  {group.municipality.name}
                  <span className="text-muted">{group.venues.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {groups.length > 0 ? (
        <div className="mt-6 space-y-12">
          {groups.map((group) => (
            <section
              key={group.municipality.id}
              aria-labelledby={`espacos-${group.municipality.id}`}
            >
              <h2 id={`espacos-${group.municipality.id}`} className="ct-heading scroll-mt-6">
                <Link
                  href={`/concelho/${group.municipality.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {group.municipality.name}
                </Link>
              </h2>

              <ul className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
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
            hasCatalogue
              ? 'Talvez o tipo escolhido ainda não tenha nenhum espaço registado. E se faltar aqui a coletividade da vossa terra, basta dizer — é para isso que a lista existe.'
              : 'Estamos a reunir os espaços concelho a concelho. Se faltar aqui a coletividade da vossa terra, é a melhor altura para o dizer.'
          }
          action={{ href: '/submeter', label: 'Falta um espaço' }}
        />
      )}
    </>
  );
}
