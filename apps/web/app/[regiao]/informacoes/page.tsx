import type { Metadata } from 'next';
import Link from 'next/link';
import { listMunicipalityNames } from '@coreto/core';
import { PageHeader } from '@/src/components/PageHeader';
import { FaqStructuredData } from '@/src/components/StructuredData';
import {
  IcAberto,
  IcFonte,
  IcIgual,
  IcRegiao,
  Pontos,
  type Ponto,
} from '@/src/components/informacoes/Pontos';
import { ACESSIBILIDADE } from '@/src/components/informacoes/acessibilidade';
import { PRIVACIDADE } from '@/src/components/informacoes/privacidade';
import { SITE_URL } from '@/src/lib/env';
import { formatLongDate } from '@/src/lib/format';
import { AUTOR } from '@/src/lib/produto';
import { listMunicipalities } from '@/src/lib/queries/events';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { exigirSeccao, seccaoLigada } from '@/src/lib/queries/seccoes';
import { urlDoSitio } from '@/src/lib/regiao';
import { REVISAO_PAGINA } from '@/src/lib/revisao';

export const metadata: Metadata = {
  title: 'Informações',
  description:
    'O que é o Coreto, porque se chama assim, como funciona e quem o faz — e, em resumo, o que faz com os seus dados e como está a acessibilidade do sítio.',
  alternates: { canonical: '/informacoes' },
};

/**
 * Uma página, e não cinco — e depois três.
 *
 * Havia «sobre», «privacidade», «acessibilidade» e um aviso de cookies que
 * nunca chegou a existir. Quatro endereços para quatro textos que a mesma
 * pessoa quer no mesmo momento — quando quer saber o que é isto e se pode
 * confiar. Juntaram-se aqui, do mais geral para o mais formal.
 *
 * Os dois textos formais voltaram a ter endereço próprio, e a razão é o
 * interruptor: esta página é uma secção que se desliga no painel, e
 * desligada responde 404. A declaração de acessibilidade tem de estar
 * alcançável de qualquer página (Decreto-Lei n.º 83/2018) e a informação
 * sobre o tratamento de dados tem de estar à vista onde os dados se recolhem
 * (RGPD) — um 404 num texto legal não é uma escolha que um painel possa dar.
 * Vivem em `/privacidade` e em `/acessibilidade`, que não se desligam. Aqui
 * fica o resumo de cada um e a ligação, nas secções com os identificadores de
 * sempre, para `/informacoes#privacidade` e `/informacoes#acessibilidade` —
 * que andam escritos por aí — continuarem a cair em cima de alguma coisa.
 */
const SECCOES = [
  { id: 'o-que-e', label: 'O que é' },
  { id: 'o-nome', label: 'O nome' },
  { id: 'regras', label: 'Como funciona' },
  { id: 'privacidade', label: 'Privacidade' },
  { id: 'acessibilidade', label: 'Acessibilidade' },
  { id: 'contacto', label: 'Contacto' },
  { id: 'financiamento', label: 'Quem financia' },
];

/**
 * A prosa que a página mostra **e** declara, escrita uma vez só.
 *
 * As três primeiras secções desta página são perguntas com resposta, e vão
 * daqui para o bloco `FAQPage` (ver `construirFaq`). O requisito é que a
 * resposta declarada seja a resposta visível — marcar uma que a página não dá
 * é spam de dados estruturados. A forma de o garantir não é ter cuidado: é
 * não haver segunda cópia. Uma frase com ligação parte-se em três pedaços
 * para o JSX poder pôr o `<Link>` no meio sem que o texto se duplique.
 */
const AQUI_NAO_HA_NADA =
  '«Aqui não há nada» é a frase que se ouve em todo o interior do país, e quase sempre é falsa. ' +
  'O que não há é um sítio onde tudo apareça junto. E o que não aparece junto parece pouco.';

const CONVITE = {
  antes: 'É de graça, não é preciso conta e ',
  ligacao: 'qualquer pessoa pode enviar um evento',
  depois: '.',
} as const;

const O_PALCO =
  'O coreto é o palco de quem não tem palco. Está no largo, no jardim, à beira da estrada — em ' +
  'ferro fundido ou em cimento, com uns degraus e um telhado. Ninguém precisa de bilhete para o ' +
  'ver e ninguém precisa de convite para lá subir.';

const HA_CORETOS_ASSIM = 'Há coretos assim por toda a região.';

const LEVANTAMENTO = {
  ligacao: 'O levantamento que fizemos está aqui',
  depois: ' — incompleto, e assumidamente incompleto.',
} as const;

/**
 * As regras da casa em quatro pontos.
 *
 * Isto eram quatro capítulos com título, três parágrafos cada, e diziam o
 * que aqui cabe em quatro linhas. O argumento longo tem lugar — mas não à
 * frente de quem só quer perceber o que é isto.
 */
function regras(concelhosPorExtenso: string): readonly Ponto[] {
  // A contagem entra na prosa por extenso; sem contagem (build sem base), as
  // frases dizem «os concelhos» e não inventam número nenhum.
  const cartazes = concelhosPorExtenso ? `${concelhosPorExtenso} cartazes` : 'cartazes';
  const todos = concelhosPorExtenso
    ? `Os ${concelhosPorExtenso} concelhos aparecem sempre todos`
    : 'Os concelhos aparecem sempre todos';
  return [
    {
      Icone: IcRegiao,
      titulo: 'A região toda, junta',
      texto: `Vinte eventos espalhados por ${cartazes}, cinco páginas de Facebook e três sítios de câmara leem-se como nada. Na mesma página, leem-se como uma região com programação.`,
    },
    {
      Icone: IcIgual,
      titulo: 'A aldeia ao lado da cidade',
      texto: `Um filme numa junta de freguesia ocupa aqui o mesmo espaço que uma estreia no cine-teatro municipal. ${todos}, mesmo os que ainda não têm nada.`,
    },
    {
      Icone: IcFonte,
      titulo: 'Cada evento diz de onde veio',
      texto:
        'A agenda não organiza nada: recolhe, arruma e devolve. Cada ficha leva a ligação para quem faz o trabalho, e a agenda não se põe à frente dele.',
    },
    {
      Icone: IcAberto,
      titulo: 'O que está aqui pode sair daqui',
      texto:
        'Feeds, calendários, uma API e um widget para o sítio de quem o quiser. O trabalho de reunir faz-se uma vez e serve toda a gente.',
    },
  ];
}

/**
 * A ligação de cada resumo à página onde o texto está por extenso.
 *
 * Não é uma ligação no meio do texto: é o passo seguinte de quem leu o resumo,
 * e por isso tem o tamanho de um botão e a forma das pílulas da navegação
 * desta página.
 */
function LerPorExtenso({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <p className="mt-5">
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 font-medium underline-offset-4 hover:underline"
      >
        {children}
        <span aria-hidden="true">→</span>
      </Link>
    </p>
  );
}

export default async function InformacoesPage({ params }: { params: Promise<{ regiao: string }> }) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);

  // Desligada no painel, esta página não existe. O guarda vem antes de
  // qualquer leitura: não vale a pena ir à base buscar o que não se mostra.
  await exigirSeccao(regiao.id, 'informacoes');
  const [haCoretos, haFontes, concelhos] = await Promise.all([
    seccaoLigada(regiao.id, 'coretos'),
    seccaoLigada(regiao.id, 'fontes'),
    listMunicipalities(regiao.id),
  ]);
  const EMAIL = regiao.email;
  const promotor = regiao.promotor;

  // «É a agenda cultural dos onze concelhos da Comunidade Intermunicipal do
  // Médio Tejo: Abrantes, …» — a enumeração continua viva, vinda da base; a
  // cauda do parágrafo é a prosa da região (`about_intro`).
  const nomesDosConcelhos = listMunicipalityNames(concelhos);
  const aberturaDoQueE =
    promotor && regiao.concelhosDeclarados > 0
      ? `É a agenda cultural dos ${regiao.concelhosPorExtenso} concelhos da ${promotor.nome}`
      : `É a agenda cultural ${regiao.doNome}`;
  const fraseDoQueE = `${aberturaDoQueE}${nomesDosConcelhos ? `: ${nomesDosConcelhos}` : ''}.`;

  const historiaDoNome = regiao.aboutStory ?? HA_CORETOS_ASSIM;
  const pontosDasRegras = regras(regiao.concelhosPorExtenso);

  /*
   * As três primeiras secções, ditadas à máquina.
   *
   * Cada resposta monta-se das mesmas constantes que o JSX mostra logo a
   * seguir — nunca de uma segunda redação da prosa. É o que faz esta
   * declaração continuar verdadeira quando alguém mudar um parágrafo, que é
   * a única altura em que isto podia passar a mentir.
   *
   * As outras quatro secções ficam de fora, e cada uma por sua razão. A
   * privacidade e a acessibilidade são resumos que apontam para o texto por
   * extenso: a resposta a sério está noutra página, e declará-la aqui era
   * dizer a um motor de resposta que a pergunta se esgota no resumo. O
   * contacto e o financiamento não são perguntas — são um endereço e uma
   * menção obrigatória.
   */
  const perguntas = [
    {
      pergunta: 'O que é o Coreto?',
      ancora: 'o-que-e',
      resposta: [
        `${fraseDoQueE}${regiao.aboutIntro ? ` ${regiao.aboutIntro}` : ''}`,
        AQUI_NAO_HA_NADA,
        `${CONVITE.antes}${CONVITE.ligacao}${CONVITE.depois}`,
      ].join(' '),
    },
    {
      pergunta: 'Porque se chama Coreto?',
      ancora: 'o-nome',
      resposta: [
        O_PALCO,
        `${historiaDoNome}${haCoretos ? ` ${LEVANTAMENTO.ligacao}${LEVANTAMENTO.depois}` : ''}`,
      ].join(' '),
    },
    {
      // O cabeçalho diz «Como funciona»; a pergunta ganha o sujeito, porque
      // uma pergunta citada fora desta página tem de se aguentar sozinha.
      pergunta: 'Como funciona o Coreto?',
      ancora: 'regras',
      resposta: pontosDasRegras.map((ponto) => `${ponto.titulo}: ${ponto.texto}`).join(' '),
    },
  ];

  const origem = urlDoSitio(regiao, SITE_URL);

  return (
    <article className="max-w-2xl">
      <FaqStructuredData
        perguntas={perguntas}
        nome="Informações"
        descricao={metadata.description}
        url={`${origem}/informacoes`}
        origem={origem}
        atualizada={REVISAO_PAGINA}
        trilha={[
          { href: '/', label: 'Coreto' },
          { href: '/informacoes', label: 'Informações' },
        ]}
      />
      <PageHeader
        title="Informações"
        eyebrow="O projeto"
        lead="O que é o Coreto, porque se chama assim, como funciona e quem o faz — e, em resumo, o que faz com os seus dados e como está a acessibilidade do sítio."
      />

      <nav aria-label="Nesta página" className="mb-10">
        <ul className="flex flex-wrap gap-2">
          {SECCOES.map((seccao) => (
            <li key={seccao.id}>
              <a
                href={`#${seccao.id}`}
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm underline-offset-4 hover:underline"
              >
                {seccao.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="o-que-e">
        <h2 id="o-que-e" className="ct-heading scroll-mt-6">
          O que é o Coreto
        </h2>
        <div className="mt-3 space-y-3">
          <p>
            {fraseDoQueE}
            {regiao.aboutIntro ? ` ${regiao.aboutIntro}` : ''}
          </p>
          <p>{AQUI_NAO_HA_NADA}</p>
          <p>
            {CONVITE.antes}
            <Link href="/submeter" className="underline underline-offset-4">
              {CONVITE.ligacao}
            </Link>
            {CONVITE.depois}
          </p>
        </div>
      </section>

      <section aria-labelledby="o-nome" className="mt-10">
        <h2 id="o-nome" className="ct-heading scroll-mt-6">
          Porque se chama Coreto
        </h2>
        <div className="mt-3 space-y-3">
          <p>{O_PALCO}</p>
          <p>
            {/* A frase com topónimos é da região (`about_story`); sem ela, o
                parágrafo do coreto-palco, que é do produto, chega sozinho. */}
            {historiaDoNome}
            {haCoretos ? (
              <>
                {' '}
                <Link href="/coretos" className="underline underline-offset-4">
                  {LEVANTAMENTO.ligacao}
                </Link>
                {LEVANTAMENTO.depois}
              </>
            ) : null}
          </p>
        </div>
      </section>

      <section aria-labelledby="regras" className="mt-10">
        <h2 id="regras" className="ct-heading scroll-mt-6">
          Como funciona
        </h2>
        <Pontos pontos={pontosDasRegras} />
        {haFontes ? (
          <p className="mt-4 text-sm text-muted">
            As fontes que lemos, as regras da recolha e os dados para reutilizar estão todos em{' '}
            <Link href="/fontes" className="underline underline-offset-4">
              de onde vêm os eventos
            </Link>
            .
          </p>
        ) : null}
      </section>

      {/*
       * Os dois resumos que se seguem são só resumos: os textos por extenso
       * vivem em `/privacidade` e em `/acessibilidade`, que não se desligam,
       * e é para lá que cada um aponta. Os quatro pontos são os mesmos que as
       * páginas mostram — vêm da mesma lista, para o resumo nunca dizer uma
       * coisa e o texto outra.
       */}
      <section aria-labelledby="privacidade" className="mt-12">
        <h2 id="privacidade" className="ct-heading scroll-mt-6">
          Privacidade
        </h2>
        <p className="mt-2 text-muted">
          Recolhe-se o mínimo para o sítio funcionar, e o mínimo cabe em quatro pontos. O que se faz
          com ele — com que fundamento, durante quanto tempo, quem responde pelo tratamento e como
          exercer os seus direitos — está por extenso na página da privacidade.
        </p>
        <Pontos pontos={PRIVACIDADE} />
        <LerPorExtenso href="/privacidade">Ler a política de privacidade</LerPorExtenso>
      </section>

      <section aria-labelledby="acessibilidade" className="mt-12">
        <h2 id="acessibilidade" className="ct-heading scroll-mt-6">
          Acessibilidade
        </h2>
        <p className="mt-2 text-muted">
          O sítio pretende cumprir o nível AA das WCAG 2.1 e considera-se{' '}
          <strong className="text-ink">parcialmente conforme</strong>: construído desde o início
          segundo esses critérios e auditado a cada alteração, mas ainda sem verificação de fora. O
          que está feito, o que falta e a quem escrever quando alguma coisa não se consegue usar
          está por extenso na declaração de acessibilidade.
        </p>
        <Pontos pontos={ACESSIBILIDADE} />
        <LerPorExtenso href="/acessibilidade">Ler a declaração de acessibilidade</LerPorExtenso>
      </section>

      <section aria-labelledby="contacto" className="mt-12 border-t border-border pt-6">
        <h2 id="contacto" className="ct-heading scroll-mt-6">
          Contacto
        </h2>
        <p className="mt-3">
          Há um endereço para tudo: enviar um evento, corrigir um erro, apontar uma fonte que falta,
          exercer um direito sobre os seus dados ou dizer que alguma coisa não se consegue usar.
        </p>
        {EMAIL ? (
          <p className="mt-4">
            <a
              href={`mailto:${EMAIL}`}
              className="font-display inline-flex min-h-11 items-center rounded-lg bg-accent px-5 py-3 text-lg font-semibold text-on-accent"
            >
              {EMAIL}
            </a>
          </p>
        ) : null}
        <p className="mt-4 text-sm text-muted">
          Esta página foi revista a{' '}
          <time dateTime={REVISAO_PAGINA}>{formatLongDate(REVISAO_PAGINA)}</time>. É atualizada
          quando o funcionamento do sítio mudar. A política de privacidade e a declaração de
          acessibilidade têm cada uma a sua data, na sua página: são três textos com ciclos
          diferentes.
        </p>
      </section>

      {/*
       * A menção de financiamento vive aqui — e, desde que esta página passou
       * a ser uma secção que se desliga no painel, também no rodapé quando
       * ela está desligada. A razão de não estar nos dois ao mesmo tempo
       * mantém-se e está escrita a seguir.
       *
       * O que o artigo 50.º do Regulamento (UE) 2021/1060 pede a quem é
       * cofinanciado não são logótipos espalhados: é, no sítio oficial, uma
       * descrição curta da operação — o que faz e para que serve — com o apoio
       * da União mencionado. Uma página que diga isso cumpre; uma tira de
       * marcas repetida em cada página não acrescenta nada ao que a norma quer
       * e tira espaço à programação, que é o que as pessoas vêm cá ver.
       *
       * A marca da CIM está no cabeçalho de todas as páginas, e isso é outra
       * coisa: é a assinatura de quem promove, uma linha de texto e um
       * logótipo pequeno. A tira do cofinanciamento — três marcas, uma
       * bandeira e uma menção ao fundo — é que fica só aqui.
       *
       * As duas marcas são as versões a branco publicadas pela própria CIM, e
       * é por isso que o bloco é grafite-escuro: assentam nele sem plinto nem
       * caixa, e funciona igual nos dois temas. Só a CIM liga para fora — as
       * marcas dos programas são a menção de origem do financiamento, não um
       * convite a sair daqui.
       */}
      <section
        aria-labelledby="financiamento"
        className="ct-bloco-escuro ct-grain mt-12 rounded-xl bg-accent-deep px-5 py-6 text-white sm:px-7 sm:py-8"
      >
        <div className="relative z-10">
          <h2 id="financiamento" className="ct-heading scroll-mt-6">
            Quem faz e quem financia
          </h2>
          {/* A frase é a da região (`funding_statement`): o rodapé di-la
              também, quando esta página está desligada, e escrita em dois
              sítios eram duas frases para divergir. Sem cofinanciamento, o
              bloco diz só quem promove e quem desenvolve. */}
          {promotor?.declaracaoDeFinanciamento ? (
            <p className="mt-3 max-w-2xl text-on-deep-muted">
              {promotor.declaracaoDeFinanciamento}
            </p>
          ) : null}

          {/*
            A distinção que o modelo multi-inquilino obriga a escrever: a
            região é *promovida* pela sua CIM; o software — o Coreto, o nome e
            o código — é *desenvolvido e propriedade de* Fábio Salgado. Uma
            linha em todas as regiões, sempre.
          */}
          <p className="mt-3 max-w-2xl text-on-deep-muted">
            O Coreto — o nome, o código, o software — é desenvolvido e propriedade de{' '}
            <a
              href={AUTOR.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-white"
            >
              {AUTOR.nome}
            </a>
            .
          </p>

          <div className="mt-7 flex flex-wrap items-end gap-x-10 gap-y-7">
            {promotor ? (
              <div>
                <p className="ct-sobrancelha-clara">Promotor</p>
                <a
                  href={promotor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${promotor.nome} (abre noutro separador)`}
                  className="mt-3 inline-flex min-h-11 items-center rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {promotor.logotipo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={promotor.logotipo.sobreGrafite}
                      width={promotor.logotipo.largura}
                      height={promotor.logotipo.altura}
                      alt={promotor.nome}
                      loading="lazy"
                      decoding="async"
                      className="h-11 w-auto sm:h-12"
                    />
                  ) : (
                    <span className="font-semibold text-white">{promotor.nome}</span>
                  )}
                </a>
              </div>
            ) : null}
            {promotor?.cofinanciamento ? (
              <div>
                <p className="ct-sobrancelha-clara">Cofinanciado por</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={promotor.cofinanciamento.ficheiro}
                  width={promotor.cofinanciamento.largura}
                  height={promotor.cofinanciamento.altura}
                  alt={promotor.cofinanciamento.alt}
                  loading="lazy"
                  decoding="async"
                  className="mt-3 h-9 w-auto sm:h-11"
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </article>
  );
}
