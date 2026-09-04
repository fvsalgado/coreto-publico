import type { Metadata } from 'next';
import Link from 'next/link';
import { BandstandMark } from '@/src/components/BandstandMark';
import { CoretoMap } from '@/src/components/CoretoMap';
import { EmptyState } from '@/src/components/EmptyState';
import { PageHeader } from '@/src/components/PageHeader';
import { listCoretos, listMunicipalities, listVenueNames } from '@/src/lib/queries/events';
import { enderecos } from '@/src/lib/enderecos';
import { SITE_URL } from '@/src/lib/env';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { urlDoSitio } from '@/src/lib/regiao';
import { exigirSeccao, seccaoLigada } from '@/src/lib/queries/seccoes';
import type { Coreto, Municipality } from '@/src/lib/queries/types';

export const revalidate = 3600;

interface Props {
  params: Promise<{ regiao: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  return {
    title: 'Coretos',
    description: `O levantamento dos coretos ${regiao.doNome}, concelho a concelho: onde estão, de quando são e quais faltam confirmar.`,
    alternates: enderecos(urlDoSitio(regiao, SITE_URL), '/coretos'),
  };
}

interface Group {
  municipality: Municipality;
  coretos: Coreto[];
}

function groupByMunicipality(municipalities: Municipality[], coretos: Coreto[]): Group[] {
  return municipalities
    .map((municipality) => ({
      municipality,
      coretos: coretos
        .filter((coreto) => coreto.municipality_id === municipality.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    }))
    .filter((group) => group.coretos.length > 0);
}

function describe(coreto: Coreto): string | null {
  const parts = [coreto.parish, coreto.year_built ? `de ${coreto.year_built}` : null].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default async function CoretosPage({ params }: Props) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);

  // Desligada no painel, esta página não existe. O guarda vem antes de
  // qualquer leitura: não vale a pena ir à base buscar o que não se mostra.
  await exigirSeccao(regiao.id, 'coretos');
  const haInformacoes = await seccaoLigada(regiao.id, 'informacoes');

  const [coretos, municipalities, venueNames] = await Promise.all([
    listCoretos(regiao.id),
    listMunicipalities(regiao.id),
    listVenueNames(regiao.id),
  ]);

  const municipalityNames: Record<string, string> = Object.fromEntries(
    municipalities.map((municipality) => [municipality.id, municipality.name]),
  );

  const confirmed = coretos.filter((coreto) => coreto.is_confirmed);
  const unconfirmed = coretos.filter((coreto) => !coreto.is_confirmed);
  const groups = groupByMunicipality(municipalities, confirmed);
  const located = coretos.filter((coreto) => coreto.latitude !== null && coreto.longitude !== null);

  return (
    <>
      <PageHeader
        title="Coretos"
        eyebrow="O levantamento"
        lead="O palco de quem não tem palco: a filarmónica ao domingo, a banda que veio da terra ao lado. Este é o levantamento dos que conhecemos, com as dúvidas incluídas."
      />

      {coretos.length === 0 ? (
        <EmptyState
          title="O levantamento dos coretos ainda não está disponível."
          description="Estamos a reunir a lista concelho a concelho. Se conhece um coreto que devia estar aqui, é a melhor altura para o dizer."
          action={{ href: '/submeter', label: 'Falta um coreto' }}
        />
      ) : null}

      <CoretoMap
        coretos={coretos}
        municipalityNames={municipalityNames}
        noNomeDaRegiao={regiao.noNome}
      />

      {coretos.length > 0 && located.length < coretos.length ? (
        <p className="mt-4 text-sm text-muted">
          {located.length === 0
            ? 'Sem coordenadas registadas, não há mapa — há a lista.'
            : `Do mapa faltam ${coretos.length - located.length} coretos sem coordenadas registadas. Estão todos na lista.`}
        </p>
      ) : null}

      {groups.length > 0 ? (
        <div className="mt-10 space-y-10">
          {groups.map((group) => (
            <section
              key={group.municipality.id}
              aria-labelledby={`coretos-${group.municipality.id}`}
            >
              <h2
                id={`coretos-${group.municipality.id}`}
                className="flex items-center gap-3 ct-heading"
              >
                <span aria-hidden="true" className="ct-octagon size-2 shrink-0 bg-highlight" />
                <Link
                  href={`/concelho/${group.municipality.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {group.municipality.name}
                </Link>
                <span aria-hidden="true" className="ct-rule min-w-8 flex-1" />
              </h2>

              <ul className="mt-3 grid gap-3 sm:auto-rows-fr sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {group.coretos.map((coreto) => {
                  const detail = describe(coreto);
                  const venueName = coreto.venue_id ? venueNames[coreto.venue_id] : undefined;

                  return (
                    <li
                      key={coreto.id}
                      className="ct-lift flex h-full overflow-hidden rounded-lg border border-border bg-surface sm:flex-col"
                    >
                      {/* A moldura existe sempre, com fotografia ou sem ela.
                          Com metade dos coretos por fotografar, deixar o
                          cartão sem cabeça fazia a grelha coxear: um cartão de
                          quatrocentos pixéis ao lado de um de cento e vinte, e
                          um buraco entre os dois. Sem fotografia fica o coreto
                          em filigrana, que é o que a lista dos espaços já faz. */}
                      <div className="ct-grain relative aspect-square w-24 shrink-0 self-stretch overflow-hidden border-r border-border bg-accent-soft sm:aspect-[5/3] sm:w-full sm:border-r-0 sm:border-b">
                        {coreto.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={coreto.photo_url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <BandstandMark className="absolute inset-0 m-auto size-10 text-ink opacity-[0.12] sm:size-14" />
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col px-3.5 py-3 sm:px-4 sm:py-3.5">
                        <p className="font-display text-lg leading-snug font-semibold">
                          {coreto.name}
                        </p>
                        {detail ? <p className="mt-0.5 text-sm text-muted">{detail}</p> : null}
                        {coreto.description ? (
                          <p className="mt-1.5 text-sm">{coreto.description}</p>
                        ) : null}

                        <div className="mt-auto pt-2.5">
                          {coreto.venue_id && venueName ? (
                            <p className="text-sm">
                              <Link
                                href={`/espaco/${coreto.venue_id}`}
                                className="-mx-2 inline-flex min-h-11 items-center rounded px-2 font-medium text-accent underline underline-offset-4"
                              >
                                Ver a programação
                              </Link>
                            </p>
                          ) : null}
                          {coreto.photo_credit ? (
                            <p className="mt-1 text-xs text-muted">
                              Fotografia: {coreto.photo_credit}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {unconfirmed.length > 0 ? (
        <section aria-labelledby="por-confirmar" className="mt-12">
          <h2 id="por-confirmar" className="ct-heading">
            Por confirmar
          </h2>
          <p className="mt-2 max-w-2xl text-muted">
            {unconfirmed.length === 1
              ? 'Deste coreto não temos confirmação: não sabemos se existe, se foi demolido ou se lhe chamam outra coisa.'
              : `Destes ${unconfirmed.length} coretos não temos confirmação: não sabemos se existem, se foram demolidos ou se lhes chamam outra coisa.`}{' '}
            Ficam à vista assim mesmo. Um levantamento que assume o que lhe falta vale mais do que
            um mapa que finge estar completo — e é assim que se completa, com quem passa por lá
            todos os dias.
          </p>

          <ul className="mt-4 grid gap-3 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
            {unconfirmed.map((coreto) => (
              <li
                key={coreto.id}
                className="h-full rounded border border-dashed border-border bg-surface px-4 py-3"
              >
                <p className="font-medium">{coreto.name}</p>
                {/* A descrição do mapa promete «concelho, freguesia e ano de
                    construção» na lista a seguir, e o mapa desenha estes
                    também — tracejados. Sem a freguesia e o ano aqui, a
                    promessa só valia para os confirmados, e quem ouve o mapa
                    em vez de o ver ficava sem a metade que mais precisa de
                    quem passa por lá. */}
                <p className="mt-0.5 text-sm text-muted">
                  {[
                    municipalityNames[coreto.municipality_id] ?? coreto.municipality_id,
                    describe(coreto),
                  ]
                    .filter((parte): parte is string => Boolean(parte))
                    .join(' · ')}
                </p>
                {coreto.description ? <p className="mt-1.5 text-sm">{coreto.description}</p> : null}
              </li>
            ))}
          </ul>

          <p className="mt-4">
            <Link
              href="/submeter"
              className="inline-flex min-h-11 items-center rounded bg-accent px-5 text-sm font-medium text-on-accent"
            >
              Corrigir ou acrescentar um coreto
            </Link>
          </p>
        </section>
      ) : null}

      <section aria-labelledby="porque-coretos" className="mt-12 border-t border-border pt-6">
        <h2 id="porque-coretos" className="ct-heading">
          Porquê os coretos?
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Porque dão nome a esta agenda e porque explicam o que ela quer ser: um palco no meio da
          terra, aberto, de quem lá vive.
          {/* Com as informações desligadas não há «história completa» para onde
              mandar ninguém, e a frase cai em vez de ficar a apontar um 404. */}
          {haInformacoes ? (
            <>
              {' '}
              <Link href="/informacoes" className="underline underline-offset-4">
                A história completa está aqui
              </Link>
              .
            </>
          ) : null}
        </p>
      </section>
    </>
  );
}
