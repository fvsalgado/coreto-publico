import type { Metadata } from 'next';
import Link from 'next/link';
import {
  janelaDaSemana,
  listMunicipalityNames,
  todayInLisbon,
  type EventFilter,
} from '@coreto/core';
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
  withCardTimes,
} from '@/src/lib/queries/events';
import { listFeedSessions } from '@/src/lib/feeds/data';
import { ATALHOS, DEFAULTS, buildHref } from '@/src/lib/agenda';
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

/** Quantos eventos cabem na montra antes de valer mais a pena ir à agenda. */
const WEEK_LIMIT = 40;

/** Um atalho da entrada, e o que é preciso saber antes de o oferecer. */
interface AtalhoDaEntrada extends Ancora {
  /**
   * O recorte da agenda a que o atalho leva, quando é preciso contá-lo antes
   * de o oferecer. Sem isto, o atalho está sempre à vista.
   */
  recorte?: Partial<EventFilter>;
}

const SHORTCUTS: readonly AtalhoDaEntrada[] = [
  { href: '/agenda?free=1', label: 'Entrada livre' },
  { href: '/agenda?category=infantil', label: 'Para a família' },
  /*
   * Este conta-se antes de se oferecer, e a cicatriz é medida.
   *
   * A 7 de setembro de 2026, `?accessible=1` devolvia 0 dos 128 eventos do
   * Médio Tejo e 24 dos 30 da demonstração: o atalho estava na entrada da
   * agenda real a levar a «Sem resultados para estes filtros». É o modo de
   * falha mais perigoso que há — passa em todos os ensaios e só está vazio
   * onde há público —, porque a acessibilidade é declarada no evento e
   * nenhuma fonte real a declara; os espaços declaram-na, e é para lá que o
   * filtro há-de cair.
   *
   * Por contagem e não por remoção, de propósito: no dia em que o filtro
   * passar a olhar para o espaço, o atalho volta sozinho — sem ninguém se
   * lembrar de o repor.
   */
  { href: '/agenda?accessible=1', label: 'Acessível', recorte: { accessible: true } },
  // O único destes que se desliga no painel. Os outros três são recortes da
  // agenda, e a agenda não se desliga.
  { href: '/coretos', label: 'Coretos', seccao: 'coretos' },
];

/**
 * Os três recortes de tempo, à cabeça da fila.
 *
 * Os quatro atalhos que aqui estavam eram três recortes de público e uma
 * secção, e nenhum de tempo — quando «é hoje?» e «há alguma coisa no fim de
 * semana?» são as perguntas que fazem sair de casa. Os recortes existiam,
 * estavam bem construídos e viviam só na agenda, a dois cliques de quem chega
 * à entrada.
 *
 * O endereço sai do `buildHref` e da janela da própria agenda, e não de uma
 * cadeia escrita à mão aqui: é o que faz o atalho da entrada e o da agenda
 * serem o mesmo endereço byte a byte — e o mesmo canónico — em vez de por
 * coincidência. O rótulo é o de lá pela mesma razão: uma janela com dois nomes
 * é uma janela que parece duas.
 */
function atalhosDeTempo(hoje: string): AtalhoDaEntrada[] {
  return ATALHOS.map((atalho) => {
    const janela = atalho.janela(hoje);
    return {
      href: buildHref({ ...DEFAULTS, ...janela }, 1),
      label: atalho.rotulo,
      // Contam-se antes de se oferecerem, como o «Acessível»: numa
      // segunda-feira sem nada marcado, «Hoje» leva a uma lista vazia — e é
      // essa a promessa que a vaga 1 tirou da rua.
      recorte: janela,
    };
  });
}

/**
 * Os atalhos que levam a algum lado.
 *
 * `semAsDesligadas` tira os que o painel desligou; isto tira os que a base
 * ainda não sabe responder — um atalho que promete uma lista e entrega um
 * vazio gasta a confiança de tudo o que está à volta dele. Conta uma linha
 * por atalho (`limit: 1`, que só o total interessa), e as consultas ficam em
 * cache uma hora como as outras da página.
 *
 * Num build sem base, a contagem é zero e o atalho não aparece: numa página
 * sem eventos nenhuns é exatamente o que se quer.
 */
async function comResultados(
  regiao: string,
  atalhos: readonly AtalhoDaEntrada[],
): Promise<AtalhoDaEntrada[]> {
  const contados = await Promise.all(
    atalhos.map(async (atalho) => {
      if (!atalho.recorte) return atalho;
      const { total } = await listEvents(regiao, { ...atalho.recorte, page: 1, limit: 1 });
      return total > 0 ? atalho : null;
    }),
  );
  return contados.filter((atalho): atalho is AtalhoDaEntrada => atalho !== null);
}

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

  const [week, municipalities, counts, venueNames, desligadas, atalhosComEventos] =
    await Promise.all([
      // A mesma semana que o atalho «Esta semana» da agenda mostra — a definição
      // vive em `@coreto/core` para as duas vistas serem os mesmos sete dias por
      // construção, e não por coincidência.
      listEvents(regiao.id, {
        ...janelaDaSemana(today),
        page: 1,
        limit: WEEK_LIMIT,
      }),
      listMunicipalities(regiao.id),
      countEventsByMunicipality(regiao.id),
      listVenueNames(regiao.id),
      seccoesDesligadas(regiao.id),
      // O tempo primeiro, e o preço e o público a seguir: é a ordem da
      // pergunta, não a ordem por que os atalhos foram sendo escritos.
      comResultados(regiao.id, [...atalhosDeTempo(today), ...SHORTCUTS]),
    ]);

  // A hora de cada cartão da semana. A entrada chamava `listEvents` e mais
  // nada, e `listEvents` nunca lê `event_sessions`; as regras estão em
  // `withCardTimes`.
  const events = await withCardTimes(week.events, today, listFeedSessions);

  // «Onze concelhos, um palco» — a contagem por extenso vem da região; num
  // build sem base não há contagem e a frase degrada sem números.
  const temContagem = regiao.concelhosDeclarados > 0;

  // As duas peneiras pela ordem que faz sentido: primeiro o que a base tem
  // para dar, depois o que o painel deixa mostrar.
  const atalhos = semAsDesligadas(atalhosComEventos, desligadas);

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
        events={events}
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
          {events.length > 0 ? (
            <EventList
              events={events}
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
