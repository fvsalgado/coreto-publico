import type { CSSProperties } from 'react';
import Link from 'next/link';
import { emLisboa } from '@coreto/core/dates';
import { FALHAS_ATE_PAUSA, HORAS_EM_PAUSA } from '@coreto/core';
import type { NumerosDaDemonstracao } from '@/src/lib/demonstracao';
import { formatLongDate, formatTime } from '@/src/lib/format';
import { AUTOR, CONTACTO, FEED_COPYRIGHT, PARAGEM, PRODUTO, correioPara } from '@/src/lib/produto';

/**
 * A página do produto — o que o Coreto é, a demonstração a funcionar, como se
 * contrata e com quem se fala. É o que responde no `coreto.org`.
 *
 * **A ordem é a da pergunta de quem decide** (C4-001 a C4-005, C1-026): o que
 * é e para quem, com o produto à vista; onde se vê a funcionar; o que inclui;
 * como se contrata; a ficha; quem está por trás — e com quem se fala, no
 * princípio e no fim. Era uma ficha técnica que pedia para ler antes de
 * mostrar: o primeiro ecrã era um título de cinco linhas e um parágrafo de
 * dez, os dois botões eram um `mailto:` e uma âncora para a ficha, e a
 * demonstração só aparecia na secção seguinte. A estrutura passa a ser a da
 * página do Paragem.pt, que é da mesma casa e vende às mesmas entidades: o
 * contacto à vista, a demonstração no primeiro ecrã, «Pedir proposta».
 *
 * A regra que sobrevive a tudo é a mesma de antes, e é a que mais importa:
 * **tudo o que aqui se afirma existe**. Cada linha corresponde a uma rota, a um
 * mecanismo ou a uma verificação do repositório. E **não há preços** — um
 * preço de tabela inventado é a primeira coisa que uma entidade pública
 * cobra; o modelo e o que entra na proposta vêm do rascunho das condições
 * (`docs/contrato/CONDICOES.md` §2.2 a §2.4).
 *
 * **Esta página não nomeia nenhum cliente** — decisão do dono a 2 de outubro
 * de 2026. Não é servida só no `coreto.org`: é o que responde a **qualquer**
 * anfitrião que o mapa de domínios não conheça, incluindo o domínio de um
 * cliente apontado para cá antes de a região dele existir, e o que aqui se
 * escrevesse sobre um cliente mostrava-se a quem quer que aparecesse. A prova
 * de que funciona é a demonstração — um território inventado —, com os
 * números lidos do estado público dela, e as capturas são dela.
 *
 * **A língua é a de quem compra** (C4-004). Um técnico de cultura, um
 * vereador ou um jurista não sabem o que é um adaptador, uma API ou um
 * `llms.txt`; o pormenor técnico existe, e vai recolhido no fim da ficha,
 * para a informática municipal.
 *
 * Só conteúdo: o `main` e o que o rodeia são de quem chama. Não toca na base
 * de dados — os números da demonstração chegam por propriedade, lidos por um
 * pedido HTTP a um endereço público (`lib/demonstracao.ts`).
 */

/** O que se diz em resumo, logo por baixo do convite. Só o que se verifica. */
const GARANTIAS = [
  'Acessível: WCAG 2.1 AA, verificado a cada alteração',
  'Sem cookies de rastreio',
  'Os dados saem em calendário, feed e dados abertos',
  'Cada agenda no seu endereço, com a sua cor',
] as const;

/**
 * Para quem é. A escala é o que muda de um para o outro — e é isso que a
 * sobrancelha diz, porque é a única coisa que o software precisa de saber.
 */
const PARA_QUEM: ReadonlyArray<{ escala: string; titulo: string; texto: string }> = [
  {
    escala: 'Um concelho',
    titulo: 'Municípios',
    texto:
      'A programação da câmara, das juntas de freguesia, do teatro, da biblioteca e das ' +
      'coletividades do concelho — numa agenda só, no domínio do município.',
  },
  {
    escala: 'Vários concelhos',
    titulo: 'Regiões',
    texto:
      'Comunidades intermunicipais e áreas metropolitanas: os concelhos todos lado a lado, da ' +
      'cidade-sede à aldeia, e nenhum fica de fora por ter poucos eventos.',
  },
  {
    escala: 'Os parceiros que quiser',
    titulo: 'Associações e redes',
    texto:
      'Uma agenda comum que cada parceiro alimenta — e embebe no seu próprio sítio, com a caixa ' +
      'da agenda, sem manter uma cópia.',
  },
];

/**
 * O que inclui, por quem o usa — na língua de quem o compra.
 *
 * **Não há caixa de envio no sítio, e não se anuncia nenhuma.** Foi tirada
 * de propósito — `app/[regiao]/submeter/page.tsx` diz porquê: quem programa
 * cultura já vive no email. O que existe ao lado do email é o envio por
 * programa, que está no pormenor técnico, lá em baixo; a rota recusa os
 * corpos `x-www-form-urlencoded` por decisão de segurança contra CSRF, e
 * anunciar aqui o contrário convida a reabrir essa porta. Ela não se reabre.
 */
const INCLUI: ReadonlyArray<{ titulo: string; itens: readonly string[] }> = [
  {
    titulo: 'Para quem visita',
    itens: [
      'A agenda, com filtros por concelho, categoria, data, entrada livre e acessibilidade',
      'O mapa dos eventos, e uma página para cada concelho, espaço e evento',
      'Os ciclos e os festivais que atravessam concelhos e anos',
      'O levantamento dos coretos do território, com mapa',
      'Um concelho sem eventos continua na agenda — e diz porquê',
      'Pensada primeiro para o telemóvel, com tema claro e escuro — e os eventos guardados continuam à mão sem rede',
    ],
  },
  {
    titulo: 'Para levar a outros sítios',
    itens: [
      'O calendário da agenda, de cada concelho e de cada evento: subscreve-se uma vez e atualiza-se sozinho',
      'A caixa da agenda para o sítio da câmara ou da coletividade, com a cor delas',
      'Os dados em aberto, para quem os quiser reutilizar com atribuição',
    ],
  },
  {
    titulo: 'Para quem edita',
    itens: [
      'A recolha automática das agendas já publicadas, fonte a fonte, com uma pausa automática para a que avariar',
      'Os eventos por email, lidos e revistos por uma pessoa antes de aparecerem',
      'Os quase-duplicados assinalados, e o que se corrigiu à mão protegido da recolha seguinte',
      'Um painel com a qualidade de cada concelho, a saúde de cada fonte e o registo de cada alteração',
    ],
  },
  {
    titulo: 'Para quem promove',
    itens: [
      'A agenda no seu endereço, com o nome, a cor e o logótipo de quem a promove',
      'Uma agenda nova nasce por configuração, sem programação — e cada melhoria chega a todas',
      'Uma página de estado pública, que diz o que está a ser lido e o que não está',
      'Um balanço mensal, numa página feita para quem decide',
    ],
  },
];

/**
 * Como se contrata (C4-002) — os passos, pela ordem em que acontecem, e sem
 * preço: o preço é da proposta, e o que a faz variar está escrito.
 */
const COMO_SE_CONTRATA: ReadonlyArray<{ titulo: string; texto: string }> = [
  {
    titulo: 'Uma conversa',
    texto:
      'Mostramos a demonstração e vemos o que o território já publica: que câmaras, juntas, ' +
      'salas e coletividades têm agenda, e onde.',
  },
  {
    titulo: 'A proposta',
    texto:
      'Uma licença anual por território, renovável. Inclui o alojamento, a recolha diária, a ' +
      'moderação, as atualizações e as cópias de segurança; o que se orçamenta à parte — uma ' +
      'fonte num formato novo, a migração de um catálogo, formação no local — vai escrito ao lado.',
  },
  {
    titulo: 'A identidade',
    texto:
      'Quem promove escolhe o endereço, a cor e o logótipo, e quem modera os eventos. O nome dele ' +
      'vai no cabeçalho de todas as páginas.',
  },
  {
    titulo: 'As fontes',
    texto:
      'Ligamos as agendas que já estão publicadas, e combinamos a entrada por email com quem não ' +
      'tem sítio. A quem já publica não se pede trabalho nenhum.',
  },
  {
    titulo: 'No ar',
    texto:
      'A agenda nasce por configuração, sem programação, e a página de estado diz, desde o ' +
      'primeiro dia, o que está a ser lido.',
  },
];

/**
 * A ficha: o que se responde a quem pergunta «o que é isto, exatamente?»,
 * em campos — e nenhum adjetivo. O que não for verificável no repositório não
 * entra aqui.
 *
 * **A frequência diz o dia e não a hora.** O cron do `scrape.yml` está às
 * 03:20 UTC, mas a fila que o executa atrasa-o horas — as execuções medidas
 * foram às 08:2x, às 10:11 e às 15:28. A cadência cumpre-se, a hora não: diz-se
 * a que se cumpre, e o porquê da hora fica no pormenor técnico.
 */
const FICHA: ReadonlyArray<{ campo: string; valor: string }> = [
  {
    campo: 'O que é',
    valor:
      'Software de agenda cultural. Recolhe a programação que já está publicada num território, ' +
      'arruma-a numa base só e publica-a como sítio, calendário, feed e caixa para outros sítios.',
  },
  {
    campo: 'Entrada de dados',
    valor:
      'Lê as agendas que já estão publicadas, fonte a fonte. Quem não tem sítio envia por email, ' +
      'e uma pessoa revê antes de aparecer; quem tem os eventos noutro sistema envia-os ' +
      'automaticamente.',
  },
  {
    campo: 'Frequência',
    valor: 'Uma recolha por dia. O que a câmara publicou ontem está na agenda hoje.',
  },
  {
    campo: 'Endereço',
    valor:
      'Cada agenda no seu domínio, ou num subdomínio do produto, com a identidade de quem a ' +
      'promove: o nome, a cor e o logótipo.',
  },
  {
    campo: 'Instalação',
    valor:
      'Uma agenda nova nasce por configuração, sem programação. Uma instalação serve várias ' +
      'agendas, e cada melhoria chega a todas ao mesmo tempo.',
  },
  {
    campo: 'Acessibilidade',
    valor:
      'Verificada automaticamente a cada alteração do software (DL n.º 83/2018). ' +
      'Filtros e formulários funcionam sem JavaScript; ' +
      'o contraste é verificado nos temas claro e escuro, e o texto pode crescer até ao dobro ' +
      'sem a página sair do ecrã.',
  },
  {
    campo: 'Privacidade',
    valor:
      'Sem cookies de rastreio e sem perfis de quem visita. Contam-se eventos, não pessoas: os ' +
      'contadores são por ficha.',
  },
  {
    campo: 'Dados',
    valor: `${FEED_COPYRIGHT} A compilação é aberta e reutilizável com atribuição; o que cada organizador escreveu continua dele.`,
  },
  {
    campo: 'Propriedade',
    valor: `O nome, o código, o software e o desenho são de ${AUTOR.nome}. Quem promove cada agenda assina-a ao lado da marca do produto: a agenda é sua, os dados são seus.`,
  },
];

/**
 * O pormenor técnico, recolhido: o que a informática municipal pergunta e o
 * decisor não precisa de ler para decidir (C4-004).
 */
const PARA_A_INFORMATICA: ReadonlyArray<{ campo: string; valor: string }> = [
  {
    campo: 'Versão',
    // Uma interpolação única: o SSR parte texto e expressões com comentários
    // HTML, e «versão 2.1» tem de sobreviver inteiro a um includes() — dos
    // guiões de verificação ou de quem copia a frase.
    valor: `${PRODUTO.nome}, versão ${PRODUTO.versao} — a do produto, que muda quando ele muda de capacidade. Não há notas de versão publicadas: o que esta faz é o que esta página descreve.`,
  },
  {
    campo: 'Saídas',
    valor:
      'Páginas por evento, espaço, concelho e ciclo; calendário iCal da agenda, por concelho e por ' +
      'evento; feed RSS; API pública de eventos em JSON; widget de embutir; llms.txt.',
  },
  {
    campo: 'Entrada por programa',
    valor:
      'POST /api/submissions, para quem tem os eventos noutro sistema — revistos na mesma fila ' +
      'de moderação que o email.',
  },
  {
    campo: 'Endereços',
    valor:
      'Subdomínio automático e domínio próprio, com redirecionamento canónico dos alias. A ' +
      'agenda é servida da cache e invalida-se quando a recolha ou a moderação mudam alguma coisa.',
  },
  {
    campo: 'Recolha',
    valor:
      'O disparo diário está marcado para a madrugada, e a fila que o executa atrasa-o horas: ' +
      `promete-se o dia, não a hora. Uma fonte que falhe ${FALHAS_ATE_PAUSA} dias seguidos ` +
      `descansa ${HORAS_EM_PAUSA} horas sozinha, e as outras seguem.`,
  },
  {
    campo: 'Verificação',
    valor:
      'A cada alteração: testes, auditoria automática de acessibilidade a 360 e 1280 píxeis nos ' +
      'dois temas, migrações aplicadas a uma base nova, e duas regiões a servir do mesmo código ' +
      'sem uma letra de uma na outra.',
  },
];

/**
 * Os ecrãs, e porque são os da demonstração e não os de um cliente.
 *
 * Pela mesma razão que tirou o nome de qualquer cliente do texto desta
 * página: ela é servida a qualquer anfitrião que o mapa de domínios não
 * conheça, e uma imagem expõe o mesmo que uma frase — mais, até, porque traz
 * a marca, os concelhos e o mapa — sem que o `semFugas` do
 * `scripts/verificar-regioes.mjs`, que só varre texto, dê por isso.
 *
 * Geram-se por guião (`scripts/capturas-do-produto.mjs`), em português de
 * Portugal, com a letra do sítio e a hora de Lisboa, para não voltarem a ficar
 * para trás (C4-005): as antigas tinham datas americanas, a letra de recurso
 * do sistema e quatro semanas de idade. As medidas vão declaradas, como em
 * toda a casa desde a 0126: o navegador reserva a caixa antes de a imagem
 * existir, e a página não salta.
 */
const ECRAS: ReadonlyArray<{ ficheiro: string; alt: string; legenda: string }> = [
  {
    ficheiro: 'agenda',
    alt: 'A agenda da demonstração num ecrã largo: o cabeçalho na cor do promotor, os atalhos de data e de concelho, e os cartazes em destaque.',
    legenda: 'A entrada: o fim de semana, os concelhos e os cartazes em destaque.',
  },
  {
    ficheiro: 'mapa',
    alt: 'O mapa da demonstração, com os limites dos concelhos e marcas redondas a contar quantos eventos há em cada um.',
    legenda: 'O mapa. Marca cheia quando se sabe a morada, tracejada quando só se sabe o concelho.',
  },
  {
    ficheiro: 'evento',
    alt: 'A ficha de um evento da demonstração, com o cartaz, a data, o espaço, o preço e as ligações para o calendário e para o mapa.',
    legenda: 'A ficha de um evento: quando, onde, quanto custa, e de onde veio a informação.',
  },
];

/** A vez de cada bloco do cabeçalho na entrada: `ct-enter` escalona por esta variável. */
function vez(i: number): CSSProperties {
  return { '--ct-i': i } as CSSProperties;
}

/*
 * Os dois convites, cheio e vazado. O cheio é o mesmo par de cores do botão
 * «Filtrar» da agenda (`bg-accent text-on-accent`), e não o grafite: no tema
 * escuro o grafite é quase o papel, e um convite que desaparece no escuro não
 * é convite. As filas onde entram quebram linha em vez de rolar.
 */
const BOTAO =
  'inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-medium whitespace-nowrap underline-offset-4 hover:underline';
const BOTAO_CHEIO = `${BOTAO} border-accent bg-accent text-on-accent`;
const BOTAO_VAZADO = `${BOTAO} border-border bg-surface hover:border-accent`;
const FILA_DE_BOTOES = 'flex flex-wrap gap-2';

/** «às 14h05 de 2 de outubro» — quando o estado da demonstração foi lido. */
function quandoSeLeu(iso: string): string {
  const { date, time } = emLisboa(Date.parse(iso));
  return `às ${formatTime(time)} de ${formatLongDate(date)}`;
}

export function PaginaDaMontra({
  demonstracao,
  numeros,
}: {
  /** A origem da demonstração — `origemDaDemonstracao()`, nunca um domínio escrito. */
  demonstracao: string;
  /** Lidos do estado público da demonstração; `null` quando não se conseguiram ler. */
  numeros: NumerosDaDemonstracao | null;
}) {
  const enderecoDaDemonstracao = new URL(demonstracao).host;
  const pedirProposta = correioPara(`Pedido de proposta do ${PRODUTO.nome}`);

  return (
    <>
      {/*
        O título a toda a largura, e por baixo dele a frase, os convites e o
        produto lado a lado: numa coluna só de meia largura, o título partia-se
        em cinco linhas e empurrava os botões para o fundo do primeiro ecrã.
      */}
      <header className="pt-2 sm:pt-4">
        <div className="ct-enter">
          <p className="ct-eyebrow">Para municípios, comunidades intermunicipais e associações</p>
          <h1 className="ct-display mt-3 max-w-4xl">
            Toda a programação cultural do seu território, numa agenda só.
          </h1>
        </div>
        <div className="mt-6 grid items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div>
            <p className="ct-enter max-w-xl text-lg text-pretty" style={vez(1)}>
              O {PRODUTO.nome} lê, uma vez por dia, o que as câmaras, os teatros, as bibliotecas e
              as coletividades já publicam, e junta tudo numa agenda — no seu endereço, com a sua
              cor e o seu logótipo.
            </p>
            {/*
            «Ver a demonstração» primeiro, e cheio (C4-003): o gesto natural de
            quem chega é «mostrem-me», e pedir um email antes de mostrar o
            produto invertia a ordem da conversa. O contacto vai a seguir, para
            uma página com o endereço por extenso, e o endereço também aqui em
            baixo — um `mailto:` sem programa de correio configurado não abre
            nada, e quem carrega fica sem saber para onde escrever.
          */}
            <ul className={`ct-enter mt-7 ${FILA_DE_BOTOES}`} style={vez(2)}>
              <li>
                <a href={demonstracao} className={BOTAO_CHEIO}>
                  Ver a demonstração
                </a>
              </li>
              <li>
                <Link href="/contacto" className={BOTAO_VAZADO}>
                  Falar connosco
                </Link>
              </li>
            </ul>
            <p className="ct-enter mt-3 text-sm text-muted" style={vez(3)}>
              Ou escreva para <span className="font-medium text-ink">{CONTACTO}</span>.
            </p>
            <ul
              aria-label="Em resumo"
              className="ct-enter mt-6 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2"
              style={vez(3)}
            >
              {GARANTIAS.map((garantia) => (
                <li key={garantia} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="ct-octagon mt-1.5 size-2 shrink-0 bg-accent"
                  />
                  <span>{garantia}</span>
                </li>
              ))}
            </ul>
          </div>

          {/*
          O produto a funcionar, no primeiro ecrã (C1-026): o portátil e o
          telemóvel, as duas larguras por onde a agenda se lê. São capturas da
          demonstração — nunca de um cliente, pela razão escrita em `ECRAS`.
          A do portátil é a maior pintura da página, e pede-se cedo.
        */}
          <figure className="ct-enter" style={vez(2)}>
            <div className="relative pr-[12%] pb-[8%]">
              {/* A casa não usa `next/image` — ver `cartaz.ts`; aqui são
                ficheiros nossos, já dimensionados e em WebP. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/produto/agenda.webp"
                width={1400}
                height={875}
                alt={ECRAS[0]?.alt ?? ''}
                fetchPriority="high"
                decoding="async"
                className="w-full rounded-xl border border-border bg-surface shadow-lg"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/produto/telemovel.webp"
                width={780}
                height={1688}
                alt="A mesma agenda no telemóvel, com os cartazes em destaque e a barra de navegação em baixo."
                decoding="async"
                className="absolute right-0 bottom-0 w-[27%] rounded-[1.1rem] border-[3px] border-ink bg-surface shadow-xl"
              />
            </div>
            <figcaption className="mt-3 text-sm text-muted">
              A demonstração, no portátil e no telemóvel: um território inventado, com o nome, a cor
              e o logótipo de um promotor também inventado.
            </figcaption>
          </figure>
        </div>
      </header>

      {/*
        A demonstração a funcionar, com os números dela (C4-001). Os números
        não se escrevem à mão — leem-se do estado público da demonstração, com
        a hora da leitura ao lado; sem eles, diz-se onde se veem ao vivo.
      */}
      <section aria-labelledby="a-funcionar" className="ct-reveal mt-16">
        <p className="ct-eyebrow">Ver a funcionar</p>
        <h2 id="a-funcionar" className="ct-heading mt-2.5">
          Uma demonstração a responder agora.
        </h2>
        <div className="mt-6 rounded-xl border border-border bg-surface p-5 sm:p-6">
          <h3 className="font-display text-xl font-semibold">O Vale do Coreto</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {/* Sem contagens na prosa: as que há leem-se do estado, aqui por
                baixo, e uma escrita à mão ficava a mentir no dia em que a
                demonstração crescesse. */}
            Um território inventado de propósito — os concelhos, um promotor, os espaços e a
            programação, com cartazes desenhados para ela —, para mexer à vontade sem usar os dados
            de ninguém. É o produto inteiro: a agenda, o mapa, as fichas, o calendário e a caixa
            para outros sítios.
          </p>
          {numeros ? (
            <>
              <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-4">
                <div className="flex flex-col-reverse">
                  <dt className="text-sm text-muted">eventos marcados</dt>
                  <dd className="ct-numeral text-3xl text-accent">{numeros.eventos}</dd>
                </div>
                {numeros.concelhos !== null ? (
                  <div className="flex flex-col-reverse">
                    <dt className="text-sm text-muted">concelhos</dt>
                    <dd className="ct-numeral text-3xl text-accent">{numeros.concelhos}</dd>
                  </div>
                ) : null}
                {numeros.espacos !== null ? (
                  <div className="flex flex-col-reverse">
                    <dt className="text-sm text-muted">espaços no catálogo</dt>
                    <dd className="ct-numeral text-3xl text-accent">{numeros.espacos}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-3 text-xs text-muted">
                Lido no estado público da demonstração {quandoSeLeu(numeros.lidoEm)}.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm">
              Os números dela — os eventos marcados, os concelhos, os espaços — veem-se ao vivo no
              estado da demonstração.
            </p>
          )}
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            <a
              href={demonstracao}
              className="inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4"
            >
              {enderecoDaDemonstracao}
            </a>
            <a
              href={`${demonstracao}/estado`}
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              O estado dela, ao vivo
            </a>
          </p>
        </div>
      </section>

      <section aria-labelledby="ecras" className="ct-reveal mt-16">
        <p className="ct-eyebrow">Os ecrãs</p>
        <h2 id="ecras" className="ct-heading mt-2.5">
          O que quem visita vê.
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          Capturados da demonstração. A cor e o logótipo são os do promotor dela — cada agenda leva
          a identidade de quem a promove.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {ECRAS.map((ecra) => (
            <figure key={ecra.ficheiro} className="min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/produto/${ecra.ficheiro}.webp`}
                alt={ecra.alt}
                width={1400}
                height={875}
                loading="lazy"
                decoding="async"
                className="w-full rounded-xl border border-border bg-surface"
              />
              <figcaption className="mt-2.5 text-sm text-muted">{ecra.legenda}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section aria-labelledby="para-quem" className="ct-reveal mt-16">
        <p className="ct-eyebrow">Para quem</p>
        <h2 id="para-quem" className="ct-heading mt-2.5">
          Um município, uma região, uma associação — a agenda é a mesma.
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          O que muda de um para o outro é a escala, e a escala é configuração: os concelhos que
          entram, as fontes que se leem, o domínio onde a agenda vive.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {PARA_QUEM.map((alvo) => (
            <li key={alvo.titulo} className="rounded-xl border border-border bg-surface p-5">
              <p className="ct-eyebrow">{alvo.escala}</p>
              <h3 className="font-display mt-2.5 text-xl font-semibold">{alvo.titulo}</h3>
              <p className="mt-2 text-sm text-muted">{alvo.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="inclui" className="ct-reveal mt-16 scroll-mt-6">
        <p className="ct-eyebrow">O que faz hoje</p>
        <h2 id="inclui" className="ct-heading mt-2.5">
          O que inclui
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {INCLUI.map((grupo) => (
            <div key={grupo.titulo} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-display text-xl font-semibold">{grupo.titulo}</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {grupo.itens.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="ct-octagon mt-1.5 size-2 shrink-0 bg-accent"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="como-se-contrata" className="ct-reveal mt-16">
        <p className="ct-eyebrow">Como se contrata</p>
        <h2 id="como-se-contrata" className="ct-heading mt-2.5">
          Da primeira conversa à agenda no ar.
        </h2>
        <ol className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-5">
          {COMO_SE_CONTRATA.map((passo, i) => (
            <li key={passo.titulo} className="border-t-2 border-accent pt-4">
              {/* O `ol` já conta para o leitor de ecrã; o numeral grande é o
                  mesmo número, só que visível. */}
              <p aria-hidden="true" className="ct-numeral text-4xl leading-none text-accent">
                {i + 1}
              </p>
              <h3 className="font-display mt-3 text-xl font-semibold">{passo.titulo}</h3>
              <p className="mt-2 text-sm text-muted">{passo.texto}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 max-w-2xl text-muted">
          Não há preço de tabela. O preço consta da proposta para cada território: depende da
          dimensão dele, do número de fontes a manter e do estado de partida do catálogo — e não do
          número de eventos, que não tem limite.
        </p>
        <p className={`mt-5 ${FILA_DE_BOTOES}`}>
          <a href={pedirProposta} className={BOTAO_CHEIO}>
            Pedir proposta
          </a>
        </p>
      </section>

      <section aria-labelledby="ficha" className="ct-reveal mt-16 scroll-mt-6">
        <p className="ct-eyebrow">A ficha</p>
        <h2 id="ficha" className="ct-heading mt-2.5">
          O que é, em campos.
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          Nada aqui é promessa: cada linha corresponde a uma página, a um mecanismo ou a uma
          verificação que existe no produto hoje.
        </p>
        <dl className="mt-6 divide-y divide-border border-y border-border">
          {FICHA.map((linha) => (
            <div
              key={linha.campo}
              className="grid gap-1 py-4 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6"
            >
              <dt className="font-display text-base font-semibold">{linha.campo}</dt>
              <dd className="text-sm text-muted">{linha.valor}</dd>
            </div>
          ))}
        </dl>
        {/*
          O pormenor técnico, recolhido: existe, e é verdade, mas não é o que
          um vereador lê para decidir (C4-004). Um `<details>` abre sem
          JavaScript, e o leitor de ecrã sabe dizer que está fechado.
        */}
        <details className="mt-4 rounded-lg border border-border bg-surface px-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">
            Para a informática municipal
          </summary>
          <dl className="divide-y divide-border border-t border-border">
            {PARA_A_INFORMATICA.map((linha) => (
              <div
                key={linha.campo}
                className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6"
              >
                <dt className="text-sm font-semibold">{linha.campo}</dt>
                <dd className="text-sm text-muted">{linha.valor}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      <section aria-labelledby="como-funciona" className="ct-reveal mt-16">
        <p className="ct-eyebrow">Como funciona</p>
        <h2 id="como-funciona" className="ct-heading mt-2.5">
          Da fonte à agenda, uma vez por dia.
        </h2>
        <ol className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-3">
          {[
            {
              titulo: 'As fontes',
              texto:
                'O Coreto lê o que já está publicado: o sítio da câmara, a agenda do teatro, a ' +
                'página da biblioteca, o portal da junta. Quem não tem sítio envia por email, e a ' +
                'ficha faz-se sozinha.',
            },
            {
              titulo: 'A recolha',
              texto:
                'Uma vez por dia, fonte a fonte. As repetições da mesma fonte fundem-se com prova ' +
                'dela; os quase-duplicados entre fontes são assinalados e esperam por uma pessoa. ' +
                'O que foi corrigido à mão fica protegido — e uma fonte avariada não derruba as ' +
                'outras.',
            },
            {
              titulo: 'A publicação',
              texto:
                'A agenda sai no seu domínio, com a sua marca. Quem visita filtra, vê no mapa e ' +
                'subscreve o calendário; quem embebe a caixa da agenda no seu sítio recebe as ' +
                'novidades sem fazer nada.',
            },
          ].map((passo, i) => (
            <li key={passo.titulo} className="border-t-2 border-accent pt-4">
              <p aria-hidden="true" className="ct-numeral text-4xl leading-none text-accent">
                {i + 1}
              </p>
              <h3 className="font-display mt-3 text-xl font-semibold">{passo.titulo}</h3>
              <p className="mt-2 text-sm text-muted">{passo.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="quem" className="ct-reveal mt-16">
        <p className="ct-eyebrow">Quem está por trás</p>
        <h2 id="quem" className="ct-heading mt-2.5">
          Uma pessoa, e o nome dela.
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          O {PRODUTO.nome} é desenhado e desenvolvido por {AUTOR.nome}: o nome, o código e o desenho
          são dele. Cada agenda é publicada em nome de quem a promove, e os dados dela são dela.
        </p>
        {/* Da mesma casa (C4-026): os dois produtos vendem-se às mesmas
            entidades, e uma câmara que veja os dois no mesmo dia deve saber
            que fala com a mesma pessoa. */}
        <p className="mt-3 max-w-2xl text-muted">
          Da mesma casa:{' '}
          <a href={PARAGEM} className="underline underline-offset-4">
            o Paragem.pt
          </a>
          , os transportes do seu território, num sítio só.
        </p>
      </section>

      {/* O fecho é com quem se fala, que é metade do que esta página é para
          ter. O endereço vai escrito, e os dois botões abrem o correio com o
          assunto já posto. */}
      <section
        aria-labelledby="contactos"
        className="ct-reveal ct-grain mt-16 mb-4 rounded-xl bg-accent-soft px-5 py-7 sm:px-8 sm:py-9"
      >
        <div className="relative z-10">
          <p className="ct-eyebrow">Contactos</p>
          <h2 id="contactos" className="ct-display-sm mt-3 max-w-2xl">
            Falar sobre uma agenda para o seu território.
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            Escreva com o nome do território e o que já publica hoje. A resposta diz o que é preciso
            para a agenda nascer — e, quase sempre, é menos do que se imagina.
          </p>
          <p className={`mt-6 ${FILA_DE_BOTOES}`}>
            <a href={pedirProposta} className={BOTAO_CHEIO}>
              Pedir proposta
            </a>
            <Link href="/contacto" className={BOTAO_VAZADO}>
              Outras formas de falar
            </Link>
          </p>
          <p className="mt-4 text-lg font-medium select-all">{CONTACTO}</p>
        </div>
      </section>
    </>
  );
}
