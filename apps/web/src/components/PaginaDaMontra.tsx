import type { CSSProperties } from 'react';
import { AUTOR, FEED_COPYRIGHT, PRODUTO } from '@/src/lib/produto';

/**
 * A ficha técnica do produto — o que o Coreto é, o que faz, e com quem se
 * fala. É o que responde no `coreto.org`.
 *
 * **Ficha técnica e não página de venda, e a diferença é de registo.** Esta
 * página já vendeu: tinha vantagens em bloco escuro, uma parede de cartazes
 * inventados desenhada pela capa verdadeira, e uma agenda de mentira por
 * baixo — dois concelhos, oito espaços e trinta eventos que nunca
 * aconteceram, com mapa e tudo. Mostrava o produto imitando-o. O que se pede
 * a uma ficha técnica é o contrário: dizer o que a coisa é, com precisão
 * suficiente para quem decide poder decidir, e sair da frente.
 *
 * A regra que sobrevive à mudança de registo é a mesma de antes, e é a que
 * mais importa: **tudo o que aqui se afirma existe**. Cada linha da ficha
 * corresponde a uma rota, a um mecanismo ou a uma verificação do repositório.
 * Quem mantém esta página mantém essa promessa.
 *
 * **Um modo só.** Havia dois — com região por trás e sem ela —, porque a
 * região «montra» abria aqui e o resto do domínio dela era a demonstração.
 * Com a demonstração mudada para o seu próprio domínio, esta página passou a
 * ter um chamador só (`app/pagina-do-produto`) e deixou de precisar de saber
 * de regiões. Não toca na base de dados: tudo o que mostra sai de
 * `lib/produto.ts`, que é o que lhe permite continuar de pé no dia em que a
 * base não estiver.
 *
 * Só conteúdo: o `main` e o que o rodeia são de quem chama.
 */

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
      'Uma agenda comum que cada parceiro alimenta — e embebe no seu próprio sítio, com o ' +
      'widget, sem manter uma cópia.',
  },
];

/**
 * Os três passos, pela ordem em que acontecem — daí serem numerados.
 *
 * **Não há caixa para preencher no sítio, e não se anuncia nenhuma.** Estas
 * linhas anunciaram-na durante meses, e ela tinha sido removida de propósito
 * — `app/[regiao]/submeter/page.tsx` diz porquê: quem programa cultura já
 * vive no email, e partir o que já lá tem por campos que só a nós fazem falta
 * é trabalho que se pede sem dar nada em troca. O que existe ao lado do email
 * é `POST /api/submissions`, que é envio por programa; a rota recusa corpos
 * de `x-www-form-urlencoded` por decisão de segurança contra CSRF, e anunciar
 * aqui o contrário convida a reabrir essa porta. Ela não se reabre.
 */
const COMO_FUNCIONA: ReadonlyArray<{ titulo: string; texto: string }> = [
  {
    titulo: 'As fontes',
    texto:
      'O Coreto lê o que já está publicado: o sítio da câmara, a agenda do teatro, a página da ' +
      'biblioteca, o portal da junta. Quem não tem sítio envia por email e a ficha faz-se ' +
      'sozinha; quem já tem os eventos noutro sistema envia-os por programa.',
  },
  {
    titulo: 'A recolha',
    texto:
      'Uma vez por dia, fonte a fonte. As repetições da mesma fonte fundem-se com prova dela; ' +
      'os quase-duplicados entre fontes são assinalados e esperam por uma pessoa. As categorias ' +
      'normalizam-se, o que foi corrigido à mão fica protegido — e uma fonte avariada não ' +
      'derruba as outras.',
  },
  {
    titulo: 'A publicação',
    texto:
      'A agenda sai no seu domínio, com a sua marca. Quem visita filtra, vê no mapa e subscreve ' +
      'o calendário; quem embebe o widget no seu sítio recebe as novidades sem fazer nada.',
  },
];

/**
 * A ficha propriamente dita: o que se responde a quem pergunta «o que é isto,
 * exactamente?». Pares de campo e valor, e nenhum adjectivo — o que não for
 * verificável no repositório não entra aqui.
 *
 * **A frequência diz o dia e não a hora.** Dizia que a recolha era noturna e
 * diária; o cron do `scrape.yml` está às 03:20 UTC, mas a fila que o executa
 * atrasa-o horas — as execuções medidas foram às 08:2x, às 10:11 e às 15:28.
 * A cadência cumpre-se, a hora não: escreve-se a que se cumpre.
 */
const FICHA: ReadonlyArray<{ campo: string; valor: string }> = [
  {
    campo: 'O que é',
    valor:
      'Software de agenda cultural. Recolhe a programação que já está publicada num território, ' +
      'arruma-a numa base só e publica-a como sítio, calendário, feed e widget.',
  },
  {
    campo: 'Versão',
    valor:
      `${PRODUTO.versao} — a do produto, e muda quando o produto muda de capacidade. Não há ` +
      'notas de versão publicadas: o que esta faz é o que esta ficha descreve.',
  },
  {
    campo: 'Entrada de dados',
    valor:
      'Recolha automática das agendas publicadas, fonte a fonte, com disjuntor por fonte; ' +
      'submissão por email, com extração automática e fila de moderação; e envio por programa ' +
      'em POST /api/submissions, para quem tem os eventos noutro sistema.',
  },
  {
    campo: 'Frequência',
    valor:
      'Uma recolha por dia. A hora não se promete: o disparo está marcado para a madrugada e a ' +
      'fila que o executa atrasa-o horas. O que a câmara publicou ontem está na agenda hoje.',
  },
  {
    campo: 'Saídas',
    valor:
      'Páginas por evento, espaço, concelho e ciclo; calendário iCal da agenda, por concelho e ' +
      'por evento; feed RSS; API pública de eventos em JSON; widget de embutir; llms.txt.',
  },
  {
    campo: 'Endereço',
    valor:
      'Domínio próprio por agenda, com subdomínio automático e redirecionamento canónico dos ' +
      'alias. Cada território no seu endereço, com a sua identidade.',
  },
  {
    campo: 'Instalação',
    valor:
      'Uma instalação serve várias agendas. Uma agenda nova nasce por configuração — sem código ' +
      'novo e sem deploy —, e cada melhoria chega a todas ao mesmo tempo.',
  },
  {
    campo: 'Acessibilidade',
    valor:
      'Verificada a cada alteração, no CI (DL n.º 83/2018). Filtros e formulários funcionam sem ' +
      'JavaScript; o contraste é verificado nos temas claro e escuro.',
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
 * Onde se vê o produto a funcionar — e porque é só a demonstração.
 *
 * É a substituição honesta da parede de cartazes que aqui esteve: em vez de
 * desenhar eventos inventados com o componente verdadeiro — o produto a
 * imitar-se a si próprio —, aponta-se para onde ele está mesmo a correr.
 *
 * **Esta página não nomeia nenhum cliente, e é uma regra e não um esquecimento.**
 * Chegou a apontar também para a agenda real de uma CIM cliente, que seria a
 * demonstração mais forte que há. O `scripts/verificar-regioes.mjs` recusou, e
 * tinha razão: esta página não é servida só no `coreto.org` — é o que responde
 * a **qualquer** anfitrião que o mapa de domínios não conheça, incluindo o
 * domínio de um cliente apontado para cá antes de a região dele existir.
 * Nomear uma CIM aqui é mostrá-la a quem quer que apareça, e a promessa da
 * casa é a inversa: nem um byte de uma região dentro de outra.
 *
 * Quem quiser mostrar uma agenda a sério a alguém manda o endereço por email,
 * que é uma escolha, e não uma consequência de configuração de DNS.
 */
const A_FUNCIONAR: ReadonlyArray<{
  endereco: string;
  url: string;
  titulo: string;
  texto: string;
}> = [
  {
    endereco: 'demo.coreto.org',
    url: 'https://demo.coreto.org',
    titulo: 'A demonstração, e diz que é',
    texto:
      'O Vale do Coreto — um território inventado de propósito, sem terra nem nome de ninguém, ' +
      'com dois concelhos e uma agenda cheia. É o produto inteiro a funcionar: filtros, mapa, ' +
      'fichas de evento e de espaço, calendário e widget. Serve para mexer à vontade sem usar ' +
      'os dados de nenhum cliente.',
  },
];

/**
 * Os ecrãs, e porque são os da demonstração e não os de um cliente.
 *
 * A escolha foi entre capturar a agenda real de uma CIM — o que se vê melhor,
 * com programação verdadeira e o cartaz de cada evento — e capturar o Vale do
 * Coreto, o território inventado. Ganhou o inventado, pela mesma razão que
 * tirou o nome da CIM do texto desta página: **isto é servido a qualquer
 * anfitrião que o mapa de domínios não conheça**, incluindo o domínio de um
 * cliente apontado para cá antes de a região dele existir. Uma imagem expõe o
 * mesmo que uma frase — mais, até, porque traz a marca, os concelhos e o mapa
 * — e o `semFugas` do `scripts/verificar-regioes.mjs` só varre texto: passaria
 * em silêncio. Fechar a porta ao texto e deixá-la aberta à imagem não era
 * fechar porta nenhuma.
 *
 * O que se perde é pouco: a interface é a mesma, o desenho é o mesmo, e o
 * cartaz tipográfico que aparece na lista é o verdadeiro — é o que cada evento
 * sem imagem recebe em qualquer agenda. O que muda é o conteúdo, e esse diz
 * que é inventado.
 *
 * **A cor é a da demonstração.** O vermelho é a paleta da montra; cada
 * território leva a sua, e a legenda di-lo, para ninguém pensar que o produto
 * chega numa cor só.
 *
 * As medidas vão declaradas, como em toda a casa desde a 0126: o navegador
 * reserva a caixa antes de a imagem existir, e a página não salta.
 */
const ECRAS: ReadonlyArray<{
  ficheiro: string;
  alt: string;
  legenda: string;
  largura: number;
  altura: number;
}> = [
  {
    ficheiro: 'agenda',
    alt: 'A agenda da demonstração: filtros por pesquisa, datas, concelho, categoria, entrada livre e acessibilidade, e por baixo a lista de eventos agrupada por dia.',
    legenda:
      'A agenda, com os filtros. Cada filtro é uma ligação — guarda-se e partilha-se tal como está.',
    largura: 1400,
    altura: 875,
  },
  {
    ficheiro: 'mapa',
    alt: 'O mapa da demonstração, com os limites dos concelhos desenhados e marcas redondas a contar quantos eventos há em cada um.',
    legenda: 'O mapa. Marca cheia quando se sabe a morada, tracejada quando só se sabe o concelho.',
    largura: 1400,
    altura: 875,
  },
  {
    ficheiro: 'evento',
    alt: 'A ficha de um evento da demonstração, com o cartaz tipográfico, a data, o espaço, o preço e as ligações para o calendário e para a fonte.',
    legenda:
      'A ficha de um evento. O cartaz tipográfico é o verdadeiro: é o que recebe quem não tem imagem.',
    largura: 1400,
    altura: 875,
  },
  {
    ficheiro: 'telemovel',
    alt: 'A mesma agenda no telemóvel, num ecrã estreito, com os filtros recolhidos e a lista a ocupar a largura toda.',
    legenda: 'No telemóvel, que é por onde a maior parte das pessoas chega.',
    largura: 460,
    altura: 995,
  },
];

const FUNCIONALIDADES: ReadonlyArray<{ titulo: string; itens: readonly string[] }> = [
  {
    titulo: 'Para quem visita',
    itens: [
      'Agenda com filtros por concelho, categoria, data, entrada livre e acessibilidade',
      'Mapa vivo dos eventos e páginas por concelho, espaço e evento',
      'Ciclos e festivais que atravessam concelhos e anos',
      'Levantamento dos coretos do território, com mapa',
      'Estados vazios honestos: um concelho sem eventos continua na agenda',
      'Modo claro e escuro, e navegação pensada para o telemóvel',
    ],
  },
  {
    titulo: 'Para levar consigo',
    itens: [
      'Calendário iCal da agenda inteira, por concelho e por evento — subscreve-se uma vez',
      'Feed RSS e API pública de eventos',
      'Widget de embutir em qualquer sítio municipal ou de coletividade',
      'Dados abertos, reutilizáveis com atribuição, e llms.txt para as máquinas',
    ],
  },
  {
    titulo: 'Para quem edita',
    itens: [
      'Recolha automática das agendas publicadas, fonte a fonte, com disjuntor',
      'Entrada por email e por envio de programa, com extração automática e fila de moderação',
      'Deteção de duplicados e bloqueio dos campos corrigidos à mão',
      'Painel com qualidade por concelho, saúde das fontes e auditoria de cada gesto',
    ],
  },
  {
    titulo: 'Para quem promove',
    itens: [
      'Uma instalação serve várias agendas: cada território no seu domínio, com a sua identidade',
      'Uma agenda nova nasce por configuração — sem código novo, sem deploy',
      'Subdomínio automático e domínio próprio com redirecionamento canónico',
      'Identidade, textos, logótipos e secções geridos no painel, com auditoria',
      'Página de estado pública, e vigilância que avisa quando uma fonte emagrece',
    ],
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
 * é convite. As filas onde entram quebram linha em vez de rolar — no
 * telemóvel, dois botões lado a lado não cabem, e um botão cortado ao meio
 * não convida ninguém.
 */
const BOTAO =
  'inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-medium whitespace-nowrap underline-offset-4 hover:underline';
const BOTAO_CHEIO = `${BOTAO} border-accent bg-accent text-on-accent`;
const BOTAO_VAZADO = `${BOTAO} border-border bg-surface hover:border-accent`;
const FILA_DE_BOTOES = 'flex flex-wrap gap-2';

export function PaginaDaMontra() {
  return (
    <>
      <header className="pt-2 sm:pt-4">
        <div className="ct-enter">
          {/* Uma interpolação única: o SSR parte texto+expressões com comentários
              HTML, e «versão 2.1» tem de sobreviver inteiro a um includes() —
              do guião de verificação ou de quem copia a frase. */}
          <p className="ct-eyebrow">{`${PRODUTO.nome} · versão ${PRODUTO.versao}`}</p>
          <h1 className="ct-display mt-3 max-w-4xl">
            Toda a programação cultural do seu território, numa agenda só.
          </h1>
        </div>
        <p className="ct-enter mt-6 max-w-2xl text-lg text-pretty" style={vez(1)}>
          O {PRODUTO.nome} lê, uma vez por dia, o que as câmaras, os teatros, as bibliotecas e as
          coletividades já publicam; arruma tudo numa agenda só e leva-a a quem a procura — no
          sítio, no telemóvel, no calendário e nas páginas que a embebem. Serve um município, uma
          comunidade intermunicipal ou uma associação: cada um no seu endereço, com a sua
          identidade.
        </p>
        <p className="ct-enter mt-4 max-w-2xl text-sm text-muted" style={vez(2)}>
          Esta página é a ficha técnica do produto. Para o ver a funcionar, há uma demonstração
          aberta, com um território inventado de propósito.
        </p>
        <ul className={`ct-enter mt-7 ${FILA_DE_BOTOES}`} style={vez(3)}>
          <li>
            <a href={`mailto:${PRODUTO.email}`} className={BOTAO_CHEIO}>
              Falar connosco
            </a>
          </li>
          <li>
            <a href="#ficha" className={BOTAO_VAZADO}>
              Ver a ficha
            </a>
          </li>
        </ul>
      </header>

      <section aria-labelledby="a-funcionar" className="ct-reveal mt-16">
        <p className="ct-eyebrow">Ver a funcionar</p>
        <h2 id="a-funcionar" className="ct-heading mt-2.5">
          Uma demonstração a responder agora.
        </h2>
        <ul className="mt-6 grid gap-4">
          {A_FUNCIONAR.map((sitio) => (
            <li key={sitio.endereco} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-display text-xl font-semibold">{sitio.titulo}</h3>
              <p className="mt-2 text-sm text-muted">{sitio.texto}</p>
              <a
                href={sitio.url}
                className="mt-4 inline-flex min-h-11 items-center font-medium text-accent underline underline-offset-4"
              >
                {sitio.endereco}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ecras" className="ct-reveal mt-16">
        <p className="ct-eyebrow">Os ecrãs</p>
        <h2 id="ecras" className="ct-heading mt-2.5">
          O que quem visita vê.
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          Capturados da demonstração, que é o produto inteiro a funcionar sobre um território
          inventado. A cor é a dela — cada agenda leva a identidade do seu território.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {ECRAS.map((ecra) => (
            <figure key={ecra.ficheiro} className="min-w-0">
              {/* A casa não usa `next/image` — ver `cartaz.ts`; aqui são
                  ficheiros nossos, já dimensionados e em WebP. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/produto/${ecra.ficheiro}.webp`}
                alt={ecra.alt}
                width={ecra.largura}
                height={ecra.altura}
                loading="lazy"
                decoding="async"
                className="w-full rounded-xl border border-border bg-surface"
              />
              <figcaption className="mt-2.5 text-sm text-muted">{ecra.legenda}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section aria-labelledby="ficha" className="ct-reveal mt-16 scroll-mt-6">
        <p className="ct-eyebrow">A ficha</p>
        <h2 id="ficha" className="ct-heading mt-2.5">
          O que é, em campos.
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          Nada aqui é promessa: cada linha corresponde a uma rota, a um mecanismo ou a uma
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
      </section>

      <section aria-labelledby="como-funciona" className="ct-reveal mt-16">
        <p className="ct-eyebrow">Como funciona</p>
        <h2 id="como-funciona" className="ct-heading mt-2.5">
          Da fonte à agenda, uma vez por dia.
        </h2>
        <ol className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-3">
          {COMO_FUNCIONA.map((passo, i) => (
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
      </section>

      <section aria-labelledby="funcionalidades" className="ct-reveal mt-16 scroll-mt-6">
        {/* Dizia «O que a versão 2.1 faz», e não há para onde mandar quem
            perguntar o que a 2.1 trouxe: um cabeçalho com número de versão
            promete notas de versão que não existem. A lista é do que está a
            correr agora, e é isso que a sobrancelha passa a dizer. */}
        <p className="ct-eyebrow">O que faz hoje</p>
        <h2 id="funcionalidades" className="ct-heading mt-2.5">
          As funcionalidades
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {FUNCIONALIDADES.map((grupo) => (
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

      {/* O fecho é a lista de contactos, que é metade do que esta página é
          para ter. Há um endereço e é para escrever para ele; o autor fica ao
          lado, porque quem decide quer saber com quem está a falar. */}
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
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="ct-eyebrow">Correio</dt>
              <dd className="mt-1.5">
                <a
                  href={`mailto:${PRODUTO.email}`}
                  className="font-medium underline underline-offset-4"
                >
                  {PRODUTO.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="ct-eyebrow">Quem desenvolve</dt>
              <dd className="mt-1.5">
                <a href={AUTOR.url} className="font-medium underline underline-offset-4">
                  {AUTOR.nome} · salgado.zip
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </>
  );
}
