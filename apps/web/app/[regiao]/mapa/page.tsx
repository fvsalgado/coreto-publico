import type { Metadata } from 'next';
import Link from 'next/link';
import { todayInLisbon } from '@coreto/core';
import { EmptyState } from '@/src/components/EmptyState';
import { MapaDosEventos } from '@/src/components/MapaDosEventos';
import { PageHeader } from '@/src/components/PageHeader';
import { formatEventDates } from '@/src/lib/format';
import { agruparEmLugares, type ConcelhoNoMapa } from '@/src/lib/mapa';
import {
  listEventsForMap,
  listMunicipalities,
  listMunicipalityBoundaries,
  listPublicSources,
  listVenues,
} from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { seccaoLigada } from '@/src/lib/queries/seccoes';

export const revalidate = 3600;

interface Props {
  params: Promise<{ regiao: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  return {
    title: 'Mapa',
    description: `Onde é que acontece o quê ${regiao.noNome}: todos os eventos por acontecer no mapa da região, e a lista completa concelho a concelho.`,
    alternates: { canonical: '/mapa' },
  };
}

export default async function MapaPage({ params }: Props) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const [haCiclos, haFontes] = await Promise.all([
    seccaoLigada(regiao.id, 'ciclos'),
    seccaoLigada(regiao.id, 'fontes'),
  ]);
  const hoje = todayInLisbon();

  const [concelhos, fronteiras, eventos, espacos, fontes] = await Promise.all([
    listMunicipalities(regiao.id),
    // Os contornos vêm à parte: pesam, e só esta página os quer.
    listMunicipalityBoundaries(regiao.id),
    listEventsForMap(regiao.id),
    listVenues(regiao.id),
    listPublicSources(regiao.id),
  ]);

  const paraOMapa: ConcelhoNoMapa[] = concelhos.map((concelho) => ({
    id: concelho.id,
    name: concelho.name,
    latitude: concelho.latitude,
    longitude: concelho.longitude,
    boundary: fronteiras[concelho.id] ?? null,
  }));

  const lugares = agruparEmLugares(eventos, espacos, paraOMapa);

  const eventosPorConcelho: Record<string, number> = {};
  for (const evento of eventos) {
    eventosPorConcelho[evento.municipality_id] =
      (eventosPorConcelho[evento.municipality_id] ?? 0) + 1;
  }

  const porConcelho = new Map(concelhos.map((concelho) => [concelho.id, [] as typeof eventos]));
  for (const evento of eventos) {
    porConcelho.get(evento.municipality_id)?.push(evento);
  }

  const nomeDoEspaco = new Map(espacos.map((espaco) => [espaco.id, espaco.name]));

  /** O espaço do catálogo quando existe; senão, o que a fonte escreveu. */
  const ondeE = (evento: (typeof eventos)[number]): string =>
    (evento.venue_id ? nomeDoEspaco.get(evento.venue_id) : null) ?? evento.location_name ?? '—';

  const comFonte = new Set(
    fontes
      .filter((fonte) => fonte.is_enabled && fonte.municipality_id !== null)
      .map((fonte) => fonte.municipality_id as string),
  );

  if (concelhos.length === 0) {
    return (
      <>
        <PageHeader title="Mapa" eyebrow="O território" />
        <EmptyState
          title="O mapa ainda não está disponível."
          description="Volte daqui a pouco. Entretanto, a agenda mostra tudo o que já foi recolhido na região."
          action={{ href: '/agenda', label: 'Ver a agenda' }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Mapa" eyebrow="O território" />

      <MapaDosEventos
        lugares={lugares}
        concelhos={paraOMapa}
        eventosPorConcelho={eventosPorConcelho}
        hoje={hoje}
      />

      <h2 className="font-display mt-10 text-2xl leading-tight font-semibold">
        Concelho a concelho
      </h2>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            {`Todos os eventos por acontecer nos ${concelhos.length} concelhos ${regiao.doNome}, agrupados por concelho, com a data e o sítio de cada um.`}
          </caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="w-40 py-2 pr-4 font-semibold">
                Quando
              </th>
              <th scope="col" className="py-2 pr-4 font-semibold">
                O quê
              </th>
              {/* Num telemóvel esta coluna desce para baixo do título: três
                  colunas em 390 px cortavam o sítio ao meio e obrigavam a
                  rolar de lado para saber onde é. */}
              <th scope="col" className="hidden py-2 font-semibold sm:table-cell">
                Onde
              </th>
            </tr>
          </thead>

          {concelhos.map((concelho) => {
            const doConcelho = porConcelho.get(concelho.id) ?? [];

            return (
              <tbody key={concelho.id} className="border-b border-border last:border-b-0">
                <tr className="bg-paper">
                  <th
                    scope="colgroup"
                    colSpan={3}
                    className="border-y border-border py-2 pr-4 text-left"
                  >
                    <Link
                      href={`/concelho/${concelho.id}`}
                      className="font-display text-base font-semibold underline-offset-4 hover:underline"
                    >
                      {concelho.name}
                    </Link>
                    <span className="ml-2 font-normal text-muted">
                      {doConcelho.length === 0
                        ? 'sem nada marcado'
                        : doConcelho.length === 1
                          ? '1 evento'
                          : `${doConcelho.length} eventos`}
                    </span>
                  </th>
                </tr>

                {doConcelho.length === 0 ? (
                  <tr>
                    {/* Um concelho sem nada marcado não é um concelho sem
                        programação: é, quase sempre, programação que ainda não
                        foi publicada onde a possamos ler. A distinção é a
                        diferença entre um convite e um veredicto. */}
                    <td colSpan={3} className="py-2.5 text-muted">
                      {comFonte.has(concelho.id)
                        ? 'Lemos as fontes deste concelho todas as noites e, de momento, não há nada marcado.'
                        : 'Ainda sem fonte que possamos ler todas as noites.'}{' '}
                      <span className="text-ink">Enviem o que se prepara.</span>
                    </td>
                  </tr>
                ) : (
                  doConcelho.map((evento) => (
                    <tr key={evento.id} className="border-t border-border/60 align-baseline">
                      <td className="py-2.5 pr-4 whitespace-nowrap text-muted">
                        {formatEventDates(evento.date_start, evento.date_end, hoje)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Link
                          href={`/evento/${evento.slug}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {evento.title}
                        </Link>
                        <span className="block text-muted sm:hidden">{ondeE(evento)}</span>
                      </td>
                      <td className="hidden py-2.5 text-muted sm:table-cell">{ondeE(evento)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            );
          })}
        </table>
      </div>

      {/* As duas frases finais dependem de duas secções que se desligam no
          painel. Cada uma cai por si: o parágrafo continua a dizer o que a
          tabela é, e não fica a mandar ninguém a uma página que não existe. */}
      <p className="mt-8 max-w-2xl text-sm text-muted">
        O mapa e a tabela são dos eventos marcados de hoje em diante: um mapa do que já passou seria
        um mapa de sítios onde não há nada para ir fazer.
        {haCiclos ? (
          <>
            {' '}
            O que já aconteceu fica na página do seu{' '}
            <Link href="/ciclos" className="underline underline-offset-4">
              ciclo
            </Link>
            , quando pertence a um.
          </>
        ) : null}
        {haFontes ? (
          <>
            {' '}
            <Link href="/fontes" className="underline underline-offset-4">
              De onde vem a programação de cada concelho
            </Link>{' '}
            está explicado por extenso.
          </>
        ) : null}
      </p>
    </>
  );
}
