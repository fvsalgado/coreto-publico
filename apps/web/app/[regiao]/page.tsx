import type { Metadata } from 'next';
import Link from 'next/link';
import { addDays, listMunicipalityNames, todayInLisbon } from '@coreto/core';
import { Destaques } from '@/src/components/Destaques';
import { EmptyState } from '@/src/components/EmptyState';
import { EventList } from '@/src/components/EventList';
import { MunicipalityGrid } from '@/src/components/MunicipalityGrid';
import { semAsDesligadas, type Ancora } from '@/src/lib/navegacao';
import {
  countEventsByMunicipality,
  listEvents,
  listMunicipalities,
  listVenueNames,
} from '@/src/lib/queries/events';
import { enderecos } from '@/src/lib/enderecos';
import { SITE_URL } from '@/src/lib/env';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { seccoesDesligadas } from '@/src/lib/queries/seccoes';
import { comInicialMaiuscula, urlDoSitio } from '@/src/lib/regiao';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ regiao: string }>;
}): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  // Só o canónico: o título e a descrição da entrada são os do sítio,
  // herdados do layout. O caminho vai por extenso porque um relativo
  // resolvia contra o caminho interno na pré-geração.
  return { alternates: enderecos(urlDoSitio(regiao, SITE_URL), '/') };
}

/** Sete dias contam a semana a partir de hoje, não a semana do calendário. */
const WEEK_DAYS = 7;

/** Quantos eventos cabem na montra antes de valer mais a pena ir à agenda. */
const WEEK_LIMIT = 40;

const SHORTCUTS: readonly Ancora[] = [
  { href: '/agenda?free=1', label: 'Entrada livre' },
  { href: '/agenda?category=infantil', label: 'Para a família' },
  { href: '/agenda?accessible=1', label: 'Acessível' },
  // O único destes que se desliga no painel. Os outros três são recortes da
  // agenda, e a agenda não se desliga.
  { href: '/coretos', label: 'Coretos', seccao: 'coretos' },
];

export default async function Home({ params }: { params: Promise<{ regiao: string }> }) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);

  /*
   * A montra abria aqui com a página do produto, e deixou de abrir.
   *
   * Fazia sentido enquanto a demonstração e o produto viviam no mesmo
   * endereço: quem escrevia `coreto.org` queria saber o que isto é, não a
   * agenda de um território inventado. Com a ficha técnica no `coreto.org` e
   * a demonstração no seu próprio domínio, a pergunta inverteu-se — quem
   * escreve `demo.coreto.org` já sabe o que isto é e vem ver a coisa a
   * funcionar. Uma demonstração que abre numa página de texto é uma
   * demonstração que obriga a mais um clique para começar.
   *
   * O que o tipo `montra` continua a decidir é a paleta (no `layout.tsx`) e o
   * aviso de que os dados são inventados. O que deixou de decidir é o que
   * está na entrada.
   */
  const today = todayInLisbon();

  const [week, municipalities, counts, venueNames, desligadas] = await Promise.all([
    listEvents(regiao.id, {
      from: today,
      to: addDays(today, WEEK_DAYS),
      page: 1,
      limit: WEEK_LIMIT,
    }),
    listMunicipalities(regiao.id),
    countEventsByMunicipality(regiao.id),
    listVenueNames(regiao.id),
    seccoesDesligadas(regiao.id),
  ]);

  // «Onze concelhos, um palco» — a contagem por extenso vem da região; num
  // build sem base não há contagem e a frase degrada sem números.
  const temContagem = regiao.concelhosDeclarados > 0;

  const atalhos = semAsDesligadas(SHORTCUTS, desligadas);

  const municipalityNames: Record<string, string> = Object.fromEntries(
    municipalities.map((municipality) => [municipality.id, municipality.name]),
  );

  return (
    <>
      {/* A abertura é a programação, não um manifesto: quem chega vê já os
          cartazes da semana. O que o Coreto é está em /informacoes, que é o sítio
          de o dizer com vagar. */}
      <header className="ct-enter flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-2 sm:pt-4">
        <div>
          <p className="ct-eyebrow">
            {temContagem
              ? `${comInicialMaiuscula(regiao.concelhosPorExtenso)} concelhos, um palco`
              : 'Uma região, um palco'}
          </p>
          <h1 className="ct-display-sm mt-2">{`A agenda cultural ${regiao.doNome}`}</h1>
        </div>
        <ul className="ct-fila-fichas">
          {atalhos.map((shortcut) => (
            <li key={shortcut.href}>
              <Link
                href={shortcut.href}
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium whitespace-nowrap underline-offset-4 hover:border-accent hover:underline"
              >
                {shortcut.label}
              </Link>
            </li>
          ))}
        </ul>
      </header>

      <Destaques
        events={week.events}
        today={today}
        municipalityNames={municipalityNames}
        venueNames={venueNames}
      />

      <section aria-labelledby="esta-semana" className="ct-reveal mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {/* «A semana dia a dia» e não «Esta semana no Médio Tejo»: numa
              lista de cabeçalhos de leitor de ecrã, este e o «Em cartaz esta
              semana» de cima eram quase indistinguíveis, e são duas vistas
              diferentes da mesma semana — uma prateleira de cartazes e a
              lista por dias. */}
          <h2 id="esta-semana" className="ct-heading">
            A semana dia a dia
          </h2>
          <Link
            href="/agenda"
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Ver a agenda completa
          </Link>
        </div>

        <div className="mt-5">
          {week.events.length > 0 ? (
            <EventList
              events={week.events}
              today={today}
              municipalityNames={municipalityNames}
              venueNames={venueNames}
              dayHeadingLevel={3}
              idPrefix="semana"
            />
          ) : (
            <EmptyState
              title="Ainda não há nada marcado para os próximos sete dias."
              action={{ href: '/agenda', label: 'Ver a agenda completa' }}
            />
          )}
        </div>
      </section>

      <section aria-labelledby="concelhos" className="ct-reveal mt-14">
        <p className="ct-eyebrow">O território</p>
        <h2 id="concelhos" className="ct-heading mt-2.5">
          {temContagem ? `Os ${regiao.concelhosPorExtenso} concelhos` : 'Os concelhos'}
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          {listMunicipalityNames(municipalities)}. Todos na mesma montra, tenham dez eventos ou
          nenhum.
        </p>

        <div className="mt-5">
          <MunicipalityGrid municipalities={municipalities} counts={counts} />
        </div>
      </section>
    </>
  );
}
