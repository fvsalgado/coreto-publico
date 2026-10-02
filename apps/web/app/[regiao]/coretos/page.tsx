import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/src/components/EmptyState';
import { FotografiaDeCartao } from '@/src/components/FotografiaDeCartao';
import { MapaDosCoretos } from '@/src/components/MapaDosCoretos';
import { PageHeader } from '@/src/components/PageHeader';
import {
  countEventsByVenueOuNada,
  listCoretos,
  listMunicipalities,
  listMunicipalityBoundaries,
  listVenueNames,
} from '@/src/lib/queries/events';
import { enderecos } from '@/src/lib/enderecos';
import { SITE_URL } from '@/src/lib/env';
import { ancoraDoCoreto, type ConcelhoNoMapa, type CoretoNoMapa } from '@/src/lib/mapa';
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

/** O `id` da lista inteira — o destino de quem salta o mapa. */
const LISTA = 'lista-dos-coretos';

/**
 * O cartão que a marca do mapa abriu, aceso: a página salta para ele, e sem o
 * anel não se sabia qual dos três à vista era. A margem de cima é para o
 * cartão não ficar colado à borda do ecrã.
 */
const ALVO_DO_MAPA = 'scroll-mt-4 target:ring-2 target:ring-highlight target:ring-offset-2';

function contarEventos(quantos: number): string {
  return quantos === 1 ? 'Ver o evento marcado' : `Ver os ${quantos} eventos marcados`;
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

  const [coretos, municipalities, fronteiras, venueNames, eventosPorEspaco] = await Promise.all([
    listCoretos(regiao.id),
    listMunicipalities(regiao.id),
    // Os contornos vêm à parte, como no mapa dos eventos: pesam, e só os mapas
    // os querem.
    listMunicipalityBoundaries(regiao.id),
    listVenueNames(regiao.id),
    // `null` quando a contagem não chegou — e então não se diz nada sobre a
    // programação de nenhum coreto. Ver `countEventsByVenueOuNada`.
    countEventsByVenueOuNada(regiao.id),
  ]);

  const municipalityNames: Record<string, string> = Object.fromEntries(
    municipalities.map((municipality) => [municipality.id, municipality.name]),
  );

  const confirmed = coretos.filter((coreto) => coreto.is_confirmed);
  const unconfirmed = coretos.filter((coreto) => !coreto.is_confirmed);
  const groups = groupByMunicipality(municipalities, confirmed);

  const noMapa: CoretoNoMapa[] = coretos.flatMap((coreto) =>
    coreto.latitude !== null && coreto.longitude !== null
      ? [
          {
            id: coreto.id,
            nome: coreto.name,
            concelhoNome: municipalityNames[coreto.municipality_id] ?? coreto.municipality_id,
            latitude: coreto.latitude,
            longitude: coreto.longitude,
            confirmado: coreto.is_confirmed,
          },
        ]
      : [],
  );
  const concelhosNoMapa: ConcelhoNoMapa[] = municipalities.map((municipality) => ({
    id: municipality.id,
    name: municipality.name,
    latitude: municipality.latitude,
    longitude: municipality.longitude,
    boundary: fronteiras[municipality.id] ?? null,
  }));

  /*
   * Quantos dos confirmados têm programação (C2-024).
   *
   * Eram vinte e duas ligações «Ver a programação», uma por coreto com ficha,
   * e todas davam no mesmo «Ainda não há nada marcado neste coreto» — numa
   * semana em que nenhum coreto tinha um evento. A ligação passa a existir só
   * onde há eventos marcados, e a página diz à cabeça quantos são e o que se
   * faz para pôr um coreto na agenda.
   */
  const eventosDe = (coreto: Coreto): number =>
    coreto.venue_id ? (eventosPorEspaco?.[coreto.venue_id] ?? 0) : 0;
  const comProgramacao = confirmed.filter((coreto) => eventosDe(coreto) > 0).length;

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

      {noMapa.length > 0 ? (
        <MapaDosCoretos
          coretos={noMapa}
          concelhos={concelhosNoMapa}
          semCoordenadas={coretos.length - noMapa.length}
          noNomeDaRegiao={regiao.noNome}
          lista={LISTA}
        />
      ) : coretos.length > 0 ? (
        <p className="mt-4 text-sm text-muted">
          Sem coordenadas registadas, não há mapa — há a lista.
        </p>
      ) : null}

      {/* A frase franca sobre a programação, à cabeça da lista (C2-024): quem
          vem à procura da filarmónica ao domingo sabe logo se há alguma coisa
          marcada, e quem a organiza sabe o que fazer para lá a pôr. Calada
          quando a contagem não chegou. */}
      {eventosPorEspaco !== null && confirmed.length > 0 ? (
        <p className="mt-8 max-w-2xl">
          {comProgramacao === 0
            ? 'Por agora não há eventos marcados em nenhum coreto.'
            : comProgramacao === 1
              ? `Por agora há eventos marcados em 1 dos ${confirmed.length} coretos confirmados.`
              : `Por agora há eventos marcados em ${comProgramacao} dos ${confirmed.length} coretos confirmados.`}{' '}
          Se a sua banda, rancho ou filarmónica toca num, envie-nos as datas: um concerto num coreto
          entra na agenda como qualquer outro evento.{' '}
          <Link href="/submeter" className="font-medium text-accent underline underline-offset-4">
            Enviar um evento
          </Link>
        </p>
      ) : null}

      <div id={LISTA} className="scroll-mt-4">
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
                    className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                  >
                    {group.municipality.name}
                  </Link>
                  <span aria-hidden="true" className="ct-rule min-w-8 flex-1" />
                </h2>

                <ul className="mt-3 grid gap-3 sm:auto-rows-fr sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                  {group.coretos.map((coreto) => {
                    const detail = describe(coreto);
                    const venueName = coreto.venue_id ? venueNames[coreto.venue_id] : undefined;

                    const eventos = eventosDe(coreto);

                    return (
                      <li
                        key={coreto.id}
                        id={ancoraDoCoreto(coreto.id)}
                        className={`ct-lift flex h-full overflow-hidden rounded-lg border border-border bg-surface sm:flex-col ${ALVO_DO_MAPA}`}
                      >
                        {/* A moldura existe sempre, com fotografia ou sem ela.
                          Com metade dos coretos por fotografar, deixar o
                          cartão sem cabeça fazia a grelha coxear: um cartão de
                          quatrocentos pixéis ao lado de um de cento e vinte, e
                          um buraco entre os dois. Sem fotografia — ou quando
                          ela falha, que era o ícone de imagem partida na
                          primeira da lista (C2-025) — fica a capa do coreto. */}
                        <FotografiaDeCartao
                          url={coreto.photo_url}
                          kind="bandstand"
                          isAssociation={false}
                          semRotulo
                        />

                        <div className="flex min-w-0 flex-1 flex-col px-3.5 py-3 sm:px-4 sm:py-3.5">
                          <p className="font-display text-lg leading-snug font-semibold">
                            {coreto.name}
                          </p>
                          {detail ? <p className="mt-0.5 text-sm text-muted">{detail}</p> : null}
                          {coreto.description ? (
                            <p className="mt-1.5 text-sm">{coreto.description}</p>
                          ) : null}

                          <div className="mt-auto pt-2.5">
                            {/* A ligação só onde há onde chegar; o «sem
                              eventos» só quando a contagem chegou. */}
                            {coreto.venue_id && venueName && eventos > 0 ? (
                              <p className="text-sm">
                                <Link
                                  href={`/espaco/${coreto.venue_id}#programacao`}
                                  className="-mx-2 inline-flex min-h-11 items-center rounded px-2 font-medium text-accent underline underline-offset-4"
                                >
                                  {contarEventos(eventos)}
                                </Link>
                              </p>
                            ) : eventosPorEspaco !== null ? (
                              <p className="text-sm text-muted">Sem eventos marcados.</p>
                            ) : null}
                            {/* A catorze píxeis, e não a doze: o Selo pede
                                no mínimo dez pontos em texto corrido (2.2), e
                                um crédito é texto que se lê. */}
                            {coreto.photo_credit ? (
                              <p className="mt-1 text-sm text-muted">
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
                  id={ancoraDoCoreto(coreto.id)}
                  className={`h-full rounded border border-dashed border-border bg-surface px-4 py-3 ${ALVO_DO_MAPA}`}
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
                  {coreto.description ? (
                    <p className="mt-1.5 text-sm">{coreto.description}</p>
                  ) : null}
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
      </div>

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
