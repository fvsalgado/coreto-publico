import type { Metadata } from 'next';
import Link from 'next/link';
import {
  addDays,
  comporDestaques,
  janelaDaSemana,
  todayInLisbon,
  type EventFilter,
} from '@coreto/core';
import { CaixaDePesquisa } from '@/src/components/CaixaDePesquisa';
import { Destaques } from '@/src/components/Destaques';
import { EmptyState } from '@/src/components/EmptyState';
import { EventList } from '@/src/components/EventList';
import { FilaDePilulas } from '@/src/components/FilaDePilulas';
import { semAsDesligadas, type Ancora } from '@/src/lib/navegacao';
import {
  countEventsByMunicipality,
  eventosComAcessoDoEspaco,
  listDestaquesFixados,
  listEvents,
  listMunicipalities,
  listVenueNames,
  withCardTimes,
} from '@/src/lib/queries/events';
import { listFeedSessions } from '@/src/lib/feeds/data';
import { dosPrimeirosDias } from '@/src/lib/agrupar';
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

/**
 * Quantos dias a lista da entrada mostra: hoje e os dois seguintes (C2-018).
 * A semana inteira continua a ser lida — é dela que saem os destaques —, e
 * está a um toque, no atalho dos sete dias.
 */
const DIAS_NA_ENTRADA = 3;

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
  // Um público e não uma categoria (C2-009): a regra está em `FAMILIA`, e
  // conta-se antes de se oferecer, como os outros recortes.
  { href: '/agenda?familia=1', label: 'Para crianças e famílias', recorte: { familia: true } },
  /*
   * Este conta-se antes de se oferecer, e a cicatriz é medida.
   *
   * A 7 de setembro de 2026, `?accessible=1` devolvia 0 dos 128 eventos do
   * Médio Tejo e 24 dos 30 da demonstração: o atalho estava na entrada da
   * agenda real a levar a «Sem resultados para estes filtros». É o modo de
   * falha mais perigoso que há — passa em todos os ensaios e só está vazio
   * onde há público —, porque a acessibilidade é declarada no evento e
   * nenhuma fonte real a declara; os espaços declaram-na.
   *
   * **E o filtro caiu para lá.** A 0129 materializa `coalesce(evento,
   * espaço)` numa coluna e o filtro passou a procurá-la, que é o que a ficha
   * já mostrava desde sempre. A contagem que aqui está foi escrita a pensar
   * neste dia: o atalho volta sozinho, sem ninguém se lembrar de o repor, e
   * volta a esconder-se se um dia a resposta voltar a ser zero. É a razão de
   * ser por contagem e não por remoção — a lista de atalhos não é o sítio
   * onde se guarda o estado do catálogo.
   */
  { href: '/agenda?accessible=1', label: 'Acessível', recorte: { accessible: true } },
  /*
   * Os Coretos estiveram aqui, e saíram (C2-024).
   *
   * Eram a sétima pílula da fila, ao lado de «Hoje», «Entrada livre» e
   * «Acessível» — onde parecem um recorte de eventos, e não são: levam ao
   * levantamento, e numa semana sem um único evento num coreto, a promessa de
   * programação era a que a fila fazia e a página não cumpria. Os Coretos
   * continuam no cabeçalho, na gaveta do «+» e no rodapé, que é onde estão as
   * páginas; esta fila é de recortes da agenda.
   */
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

  const [week, municipalities, counts, venueNames, desligadas, atalhosComEventos, fixados] =
    await Promise.all([
      // A mesma janela que o atalho «Próximos 7 dias» da agenda mostra — a
      // definição vive em `@coreto/core` para as duas vistas serem os mesmos
      // sete dias por construção, e não por coincidência.
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
      // Os que quem administra fixou na montra (0161). Podem ser de fora da
      // semana: um destaque é uma escolha, e uma escolha não se limita a sete
      // dias.
      listDestaquesFixados(regiao.id),
    ]);

  // A hora de cada cartão da semana. A entrada chamava `listEvents` e mais
  // nada, e `listEvents` nunca lê `event_sessions`; as regras estão em
  // `withCardTimes`. E de que eventos o acesso é o do espaço (C2-011).
  const [daSemana, acessoDoEspaco] = await Promise.all([
    withCardTimes(week.events, today, listFeedSessions),
    eventosComAcessoDoEspaco(week.events),
  ]);
  // A lista curta: os primeiros dias, cortados pelo dia em que cada evento
  // entra na lista — que já leva em conta as sessões que `withCardTimes` leu.
  const ultimoDia = addDays(today, DIAS_NA_ENTRADA - 1);
  const events = dosPrimeirosDias(daSemana, today, ultimoDia);
  // O atalho dos sete dias, com o mesmo endereço do da fila de cima — é para
  // lá que a lista curta manda quem quer a semana toda.
  const semanaToda = buildHref({ ...DEFAULTS, ...janelaDaSemana(today) }, 1);

  /*
   * A montra: o que foi escolhido primeiro, o resto tirado à sorte da semana.
   *
   * A hora vem pelo mesmo `withCardTimes` dos cartões da semana, e sobre a
   * lista já composta — os fixados podem não estar na semana, e sem isto
   * entravam na montra sem hora enquanto os da semana a tinham.
   *
   * A semente é a região e o dia: o dia inteiro vê a mesma montra, ela muda
   * sozinha de manhã, e duas pessoas na mesma vila veem a mesma coisa. As
   * razões estão em `comporDestaques`.
   */
  const destaques = await withCardTimes(
    comporDestaques({
      fixados: fixados.map((evento) => ({ ...evento, ate: evento.date_end ?? evento.date_start })),
      daSemana: week.events.map((evento) => ({
        ...evento,
        ate: evento.date_end ?? evento.date_start,
      })),
      alvo: regiao.destaquesAlvo,
      hoje: today,
      semente: `${regiao.id}:${today}`,
    }),
    today,
    listFeedSessions,
  );

  // «Onze concelhos, um palco» — a contagem por extenso vem da região; num
  // build sem base não há contagem e a frase degrada sem números.
  const temContagem = regiao.concelhosDeclarados > 0;

  // As duas peneiras pela ordem que faz sentido: primeiro o que a base tem
  // para dar, depois o que o painel deixa mostrar.
  const atalhos = semAsDesligadas(atalhosComEventos, desligadas);

  const municipalityNames: Record<string, string> = Object.fromEntries(
    municipalities.map((municipality) => [municipality.id, municipality.name]),
  );
  // Os concelhos pela ordem da região, partidos em dois: os que têm alguma
  // coisa marcada e os que ainda não têm. Num build sem base não há nenhum, e
  // a fila não se desenha.
  const concelhosComEventos = municipalities.filter((concelho) => (counts[concelho.id] ?? 0) > 0);
  const concelhosSemEventos = municipalities.filter((concelho) => !(counts[concelho.id] ?? 0));

  return (
    <>
      {/* A abertura é a programação, não um manifesto: quem chega vê já os
          cartazes da semana. O que o Coreto é está em /informacoes, que é o sítio
          de o dizer com vagar. */}
      <header className="ct-enter pt-2 sm:pt-4">
        <p className="ct-eyebrow">
          {temContagem
            ? `${comInicialMaiuscula(regiao.concelhosPorExtenso)} concelhos, um palco`
            : 'Uma região, um palco'}
        </p>
        <h1 className="ct-display-sm mt-2">{`A agenda cultural ${regiao.doNome}`}</h1>
      </header>

      {/*
        Duas filas com nome, como as da agenda (C1-027): os atalhos, e a porta
        dos concelhos logo a seguir (C2-018).

        A porta dos concelhos estava a dez ecrãs do topo, depois da prateleira
        e de quarenta cartões, quando «o que há na minha terra» é a segunda
        pergunta mais natural — e os atalhos eram todos de tempo e de público.
        Subiu inteira, e não foi copiada: a grelha de onze cartões que estava
        em baixo, com a lista dos nomes num parágrafo por cima e a mesma lista
        outra vez na faixa do rodapé, dizia três vezes a mesma coisa no fim da
        página (C1-010).

        Cada pílula de concelho leva à página do concelho, que é a resposta à
        pergunta. Os que não têm nada marcado continuam todos na fila, à parte
        e com a página deles — como na agenda (C2-007).
      */}
      <div className="ct-enter mt-4 space-y-2">
        <FilaDePilulas
          nome="Atalhos"
          rotulo="Atalhos"
          pilulas={atalhos.map((atalho) => ({
            chave: atalho.href,
            rotulo: atalho.label,
            href: atalho.href,
            activa: false,
          }))}
        />
        <FilaDePilulas
          nome="Concelhos"
          rotulo="Onde"
          maximo={8}
          pilulas={concelhosComEventos.map((concelho) => ({
            chave: concelho.id,
            rotulo: concelho.name,
            href: `/concelho/${concelho.id}`,
            activa: false,
            quantos: counts[concelho.id] ?? 0,
          }))}
          semEventos={concelhosSemEventos.map((concelho) => ({
            chave: concelho.id,
            rotulo: concelho.name,
            href: `/concelho/${concelho.id}`,
          }))}
        />
      </div>

      {/* Quem chega a saber o que quer — «fado», o nome de uma sala, o seu
          concelho — escreve aqui, sem ir primeiro à agenda abrir a gaveta
          dos filtros (C3-020). */}
      <CaixaDePesquisa className="ct-enter mt-6 max-w-xl" />

      <Destaques
        events={destaques}
        today={today}
        municipalityNames={municipalityNames}
        venueNames={venueNames}
      />

      <section aria-labelledby="esta-semana" className="ct-reveal mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {/* A janela tem um nome só, e diz o que mostra (C2-040): hoje e os
              dois dias seguintes (C2-018). A semana inteira tem o nome do
              atalho que leva a ela — «Próximos 7 dias» —, e é para lá que a
              ligação manda. Os destaques, por cima, chamam-se pelo que são,
              uma escolha. */}
          <h2 id="esta-semana" className="ct-heading">
            Os próximos {DIAS_NA_ENTRADA} dias
          </h2>
          <Link
            href={semanaToda}
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          >
            Ver os próximos 7 dias
          </Link>
        </div>

        <div className="mt-5">
          {events.length > 0 ? (
            <>
              <EventList
                events={events}
                today={today}
                municipalityNames={municipalityNames}
                venueNames={venueNames}
                acessoDoEspaco={acessoDoEspaco}
                dayHeadingLevel={3}
                idPrefix="semana"
              />
              {/* O fim da lista curta diz quanto fica por ver, e leva lá. */}
              {week.total > events.length ? (
                <p className="mt-6">
                  <Link
                    href={semanaToda}
                    className="inline-flex min-h-11 items-center rounded bg-accent px-5 text-sm font-medium text-on-accent"
                  >
                    {`Ver os próximos 7 dias — ${week.total} eventos`}
                  </Link>
                </p>
              ) : null}
            </>
          ) : week.total > 0 ? (
            <EmptyState
              title={`Não há nada marcado para os próximos ${DIAS_NA_ENTRADA} dias.`}
              action={{ href: semanaToda, label: 'Ver os próximos 7 dias' }}
            />
          ) : (
            <EmptyState
              title="Ainda não há nada marcado para os próximos 7 dias."
              action={{ href: '/agenda', label: 'Ver a agenda completa' }}
            />
          )}
        </div>
      </section>
    </>
  );
}
