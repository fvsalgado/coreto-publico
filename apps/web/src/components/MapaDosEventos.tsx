'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Capa } from '@/src/components/Capa';
import {
  AtribuicaoDoMapa,
  EsperaDoMapa,
  PerguntaDoMapa,
  useMontarOMapa,
} from '@/src/components/MapaDeBase';
import { direcoesPara } from '@/src/lib/direcoes';
import { formatEventDates } from '@/src/lib/format';
import {
  nomeDaMarca,
  type ConcelhoNoMapa,
  type EventoNoMapa,
  type Lugar,
  type Marca,
} from '@/src/lib/mapa';

/** Onde está o mesmo sem o mapa: na pergunta da rede lenta e na caixa sem JavaScript. */
const ALTERNATIVA = 'A tabela por baixo tem o mesmo, concelho a concelho.';

/**
 * O MapLibre não renderiza no servidor — toca em `window` logo no arranque — e
 * são trezentos quilobytes que só esta página precisa. Carregado à parte, o
 * resto do sítio não os paga, e a tabela concelho a concelho continua a ser a
 * versão que funciona sem JavaScript nenhum.
 */
const MapaVivo = dynamic(() => import('@/src/components/MapaVivo').then((m) => m.MapaVivo), {
  ssr: false,
  loading: () => <EsperaDoMapa alternativa={ALTERNATIVA} />,
});

interface Props {
  lugares: Lugar[];
  concelhos: ConcelhoNoMapa[];
  /** Quantos eventos há em cada concelho. Dá o tom do preenchimento. */
  eventosPorConcelho: Record<string, number>;
  /** Hoje em Lisboa, vindo do servidor: o cliente não decide que dia é. */
  hoje: string;
  /** O mapa está a mostrar um recorte da agenda, e não a região inteira. */
  filtrado?: boolean;
}

function contarEventos(quantos: number): string {
  return quantos === 1 ? '1 evento' : `${quantos} eventos`;
}

/** O que o cabeçalho de um lugar diz: onde fica, e como se chama. */
function cabecalhoDoLugar(lugar: Lugar): { sobre: string; nome: string } {
  return lugar.precisao === 'exacta'
    ? { sobre: lugar.concelhoNome, nome: lugar.nome }
    : { sobre: 'Algures no concelho', nome: lugar.concelhoNome };
}

export function MapaDosEventos({
  lugares,
  concelhos,
  eventosPorConcelho,
  hoje,
  filtrado = false,
}: Props) {
  // A marca escolhida guarda-se inteira, e não pelo identificador: a
  // composição das marcas muda a cada zoom, e um identificador guardado
  // apontava para uma junção que já não existe assim que alguém se aproximasse.
  const [marca, setMarca] = useState<Marca | null>(null);
  // Numa ligação lenta pergunta-se antes de montar (C3-012); ver `useMontarOMapa`.
  const { montar, pedir } = useMontarOMapa();
  const titulo = useRef<HTMLHeadingElement>(null);
  const deOndeVeio = useRef<string | null>(null);

  // Estável, porque entra nas dependências do efeito das marcas do mapa.
  const escolher = useCallback((escolhida: Marca) => {
    deOndeVeio.current = escolhida.id;
    setMarca(escolhida);
  }, []);

  /*
   * Fechar devolve o foco à marca que abriu o painel. As marcas refazem-se a
   * cada zoom, e por isso procura-se pelo identificador e não por uma
   * referência guardada — a de há bocado pode já não estar no documento.
   */
  const fechar = useCallback(() => {
    setMarca(null);
    const id = deOndeVeio.current;
    if (id) document.querySelector<HTMLElement>(`[data-marca="${CSS.escape(id)}"]`)?.focus();
  }, []);

  /*
   * O painel abre à vista e recebe o foco (C2-026).
   *
   * Abria por baixo do mapa, a 951 píxeis do topo num ecrã de 844, e o foco
   * ficava no `body`: tocava-se numa marca e o ecrã não mudava — quem toca e
   * não vê nada conclui que não funciona, e quem usa leitor de ecrã não era
   * levado a lado nenhum. Agora é uma folha por cima da parte de baixo do ecrã
   * no telemóvel, e uma coluna ao lado do mapa na secretária; o foco vai para
   * o título dela, e o Escape fecha-a.
   */
  useEffect(() => {
    if (marca) titulo.current?.focus();
  }, [marca]);

  useEffect(() => {
    if (!marca) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') fechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [marca, fechar]);

  // Sem lugares não há mapa que se desenhe — mas desaparecer em silêncio deixa
  // a página com um buraco e sem explicação. A tabela por baixo continua a
  // valer, e é para lá que se manda quem chegou aqui.
  if (lugares.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
        {filtrado
          ? 'Nenhum evento passa nestes filtros, e por isso não há mapa. Tire um filtro, ou volte à lista.'
          : 'Não há nada marcado de hoje em diante, e por isso não há mapa. A tabela por baixo mostra concelho a concelho o que se sabe — e, em cada um, de onde vem a programação.'}
      </p>
    );
  }

  const total = lugares.reduce((soma, atual) => soma + atual.eventos.length, 0);
  const comMorada = lugares.filter((candidato) => candidato.precisao === 'exacta');
  const eventosComMorada = comMorada.reduce((soma, atual) => soma + atual.eventos.length, 0);
  const haExactas = comMorada.length > 0;
  const haDeConcelho = comMorada.length < lugares.length;
  const haConcelhosSemEventos = concelhos.some(
    (concelho) => !((eventosPorConcelho[concelho.id] ?? 0) > 0),
  );

  return (
    <section aria-labelledby="mapa-titulo">
      <h2 id="mapa-titulo" className="sr-only">
        Mapa dos eventos por acontecer
      </h2>

      {/* A instrução por cima do mapa, numa linha (C2-026): estava por baixo
          dele, onde só se lia depois de se ter tocado sem resultado. Na
          secretária vive no painel ao lado, que é onde o resultado aparece. */}
      <p className="ct-so-com-js mb-2 text-sm text-muted lg:hidden">
        Toque numa marca para ver o que ali acontece.
      </p>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-4">
        <div className="min-w-0">
          {montar === false ? (
            <PerguntaDoMapa alternativa={ALTERNATIVA} onPedir={pedir} />
          ) : montar ? (
            <MapaVivo
              lugares={lugares}
              concelhos={concelhos}
              eventosPorConcelho={eventosPorConcelho}
              escolhida={marca?.id ?? null}
              onEscolher={escolher}
            />
          ) : (
            <EsperaDoMapa alternativa={ALTERNATIVA} />
          )}

          {/*
           * A legenda desenhada, e não um parágrafo (C1-019, C2-028).
           *
           * Eram três linhas de prosa — «Marca cheia, sabe-se a morada;
           * tracejada e clara, sabe-se o concelho e mais nada…» — para três
           * desenhos que não estavam à vista ao lado das palavras. Cada item
           * desenha a marca de que fala, e só aparecem os que o mapa tem.
           *
           * A contagem é de eventos e não de marcas, e é de propósito: o que
           * interessa a quem olha é de quantos se sabe a morada, e não em
           * quantos pontos o mapa os arrumou.
           */}
          <div className="mt-2 text-sm text-muted">
            <p>
              {contarEventos(total)}, {eventosComMorada} {eventosComMorada === 1 ? 'dele' : 'deles'}{' '}
              com morada conhecida.
            </p>
            <ul aria-label="Legenda do mapa" className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
              {haExactas ? (
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded-full border-2 border-accent bg-accent"
                  />
                  Morada conhecida
                </li>
              ) : null}
              {haDeConcelho ? (
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded-full border-2 border-dashed border-accent bg-surface"
                  />
                  Só o concelho — a marca fica no centro dele
                </li>
              ) : null}
              {haExactas && haDeConcelho ? (
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded-full border-2 border-dashed border-on-accent bg-accent ring-1 ring-accent"
                  />
                  Os dois casos na mesma marca
                </li>
              ) : null}
              {haConcelhosSemEventos ? (
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-3 w-4 shrink-0 rounded-sm border-2 border-muted/70 bg-muted/10"
                  />
                  Concelho sem nada marcado
                </li>
              ) : null}
            </ul>
            <AtribuicaoDoMapa />
          </div>
        </div>

        {/* A folha do telemóvel fica por cima de menos de metade do ecrã: o
            resto do mapa continua à vista, e é por lá que se escolhe a
            seguinte. O que não couber desliza dentro dela. */}
        <div
          id="mapa-escolhido"
          className={
            marca
              ? 'fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 max-h-[45vh] overflow-y-auto rounded-t-xl border border-border bg-surface px-4 pt-3 pb-5 shadow-2xl sm:bottom-0 lg:static lg:z-auto lg:max-h-[560px] lg:rounded-lg lg:pt-4 lg:shadow-none'
              : 'hidden lg:block'
          }
        >
          {marca ? (
            <article aria-labelledby="mapa-escolhido-titulo">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {marca.lugares.length === 1 ? (
                    <p className="ct-eyebrow">
                      {cabecalhoDoLugar(marca.lugares[0] as Lugar).sobre}
                    </p>
                  ) : null}
                  <h3
                    id="mapa-escolhido-titulo"
                    ref={titulo}
                    tabIndex={-1}
                    className="font-display mt-1 text-xl leading-tight font-semibold focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {marca.lugares.length === 1
                      ? cabecalhoDoLugar(marca.lugares[0] as Lugar).nome
                      : nomeDaMarca(marca)}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={fechar}
                  className="inline-flex min-h-11 shrink-0 items-center rounded border border-field px-3 text-sm font-medium"
                >
                  Fechar
                </button>
              </div>

              {marca.lugares.map((lugar, indice) => {
                const cabecalho = cabecalhoDoLugar(lugar);
                return (
                  <div
                    key={lugar.id}
                    className={indice > 0 ? 'mt-6 border-t border-border pt-5' : 'mt-2'}
                  >
                    {marca.lugares.length > 1 ? (
                      <>
                        <p className="ct-eyebrow">{cabecalho.sobre}</p>
                        <h4 className="font-display mt-1 text-lg leading-tight font-semibold">
                          {cabecalho.nome}
                        </h4>
                      </>
                    ) : null}

                    {lugar.precisao === 'concelho' ? (
                      <p className="mt-1 text-sm text-muted">
                        Estes eventos não dizem em que espaço são — a marca está no centro do
                        concelho.
                      </p>
                    ) : (
                      // Direções só para quem tem morada. Mandar alguém para o
                      // centro geométrico de um concelho, com ar de morada, é pior
                      // do que não mandar: chega lá e não está lá nada.
                      <p className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
                        <span className="text-muted">Como chegar:</span>
                        {direcoesPara(lugar.latitude, lugar.longitude, lugar.nome).map(
                          (direcao) => (
                            <a
                              key={direcao.nome}
                              href={direcao.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 items-center rounded-full border border-border px-3 underline-offset-4 hover:underline"
                            >
                              {direcao.nome}
                            </a>
                          ),
                        )}
                      </p>
                    )}

                    <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                      {lugar.eventos.map((evento) => (
                        <li key={evento.id}>
                          <EventoDoMapa evento={evento} lugar={lugar} hoje={hoje} />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </article>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-4 text-sm text-muted">
              Carregue numa marca do mapa para ver o que ali acontece, com cartaz e como lá chegar.
              A lista completa, concelho a concelho, está a seguir.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Um evento no painel do mapa: cartaz, título, quando, e para onde ir a seguir.
 *
 * A capa entra porque uma agenda é feita de cartazes — carregar numa marca e
 * receber uma lista de títulos é receber menos do que a mesma agenda dá em
 * qualquer outra página. E a capa nunca falha: quando o cartaz da câmara
 * morre, fica a capa tipográfica que está por baixo.
 */
function EventoDoMapa({
  evento,
  lugar,
  hoje,
}: {
  evento: EventoNoMapa;
  lugar: Lugar;
  hoje: string;
}) {
  return (
    <div className="flex gap-3">
      <Link href={`/evento/${evento.slug}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <Capa event={evento} today={hoje} className="w-20" />
      </Link>

      <div className="min-w-0">
        <Link
          href={`/evento/${evento.slug}`}
          className="font-medium underline-offset-4 hover:underline"
        >
          {evento.title}
        </Link>
        <p className="text-sm text-muted">
          {formatEventDates(evento.date_start, evento.date_end, hoje)}
          {/* Numa marca de concelho os eventos são de sítios diferentes, e
              dizer só «Tomar» a sete eventos escondia a única pista que há. */}
          {lugar.precisao === 'concelho' && evento.location_name
            ? ` · ${evento.location_name}`
            : ''}
        </p>
        {evento.source_url ? (
          <a
            href={evento.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4"
          >
            Página oficial
          </a>
        ) : null}
      </div>
    </div>
  );
}
