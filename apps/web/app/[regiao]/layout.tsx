import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { AnalyticsProvider } from '@/src/components/AnalyticsProvider';
import { BandstandMark } from '@/src/components/BandstandMark';
import { BarraInferior } from '@/src/components/BarraInferior';
import { NavegacaoDoToldo } from '@/src/components/NavegacaoDoToldo';
import { RodapeDoSitio } from '@/src/components/RodapeDoSitio';
import { SiteStructuredData } from '@/src/components/StructuredData';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { SITE_URL } from '@/src/lib/env';
import { CORES_DO_TOLDO } from '@/src/lib/marca';
import { DESTINOS, semAsDesligadas } from '@/src/lib/navegacao';
import { descricaoDoSitio, tituloDoSitio, urlDoSitio } from '@/src/lib/regiao';
import { REGIAO_PRINCIPAL } from '@/src/lib/regiao-host';
import { exigirRegiao, listRegioes } from '@/src/lib/queries/regioes';
import { seccoesDesligadas } from '@/src/lib/queries/seccoes';

/**
 * O toldo, a navegação e o chão de uma região.
 *
 * É aqui que um pedido ganha identidade: o middleware leu o Host, traduziu
 * para o segmento `[regiao]`, e este layout carrega a linha da região e veste
 * a página — metadados, assinatura do promotor, navegação com as secções
 * dela, rodapé. Um identificador que a base não conhece é um 404.
 *
 * O que é do produto e não muda com a região — o esqueleto do documento, a
 * letra, o tema — ficou no layout de raiz, por cima deste. A medição é a
 * exceção que confirma a regra: mora aqui, e não lá em cima, porque só aqui
 * se sabe de que região é a página que se está a contar.
 */

interface Props {
  children: React.ReactNode;
  params: Promise<{ regiao: string }>;
}

export async function generateStaticParams(): Promise<Array<{ regiao: string }>> {
  const regioes = await listRegioes();
  // Sem base na compilação, produz-se a região principal na mesma: é o que
  // deixa um build sem credenciais servir alguma coisa.
  if (regioes.length === 0) return [{ regiao: REGIAO_PRINCIPAL }];
  return regioes.map((regiao) => ({ regiao: regiao.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const origem = urlDoSitio(regiao, SITE_URL);
  return {
    metadataBase: new URL(origem),
    title: {
      default: tituloDoSitio(regiao),
      template: '%s · Coreto',
    },
    description: descricaoDoSitio(regiao),
    applicationName: 'Coreto',
    /*
     * A demonstração não se indexa, e a razão não é de arrumação.
     *
     * O programa da montra é inventado de propósito — trinta eventos que
     * nunca aconteceram, em dois concelhos que não existem, com datas que a
     * `renovar_montra()` empurra para a frente todas as noites para nunca
     * envelhecerem. Numa agenda cultural isso é conteúdo perfeitamente
     * plausível: tem título, data, sítio e cartaz, e um motor de busca não
     * tem como saber que não é verdade.
     *
     * Um evento falso indexado é pior do que uma página a menos. Alguém
     * procura o que há para fazer, encontra-o, e desloca-se. E os dados desta
     * casa saem sob CC BY, com API aberta e `llms.txt` a convidar os agentes
     * de resposta — o que torna a ficção fácil de propagar e difícil de
     * desmentir.
     *
     * Fica só na montra: uma agenda a sério indexa-se, que é para o que
     * existe. O `robots.txt` da região diz o mesmo, para a regra valer também
     * para quem nunca chega a ler o HTML.
     */
    ...(regiao.tipo === 'montra' ? { robots: { index: false, follow: false } } : {}),
    /*
     * Sem `og:url` aqui, de propósito — e já cá esteve um `url: './'`. Um
     * caminho relativo resolve contra o caminho da rota, e numa página
     * pré-gerada esse caminho é o interno, com o segmento da região: o
     * `og:url` saía `…/medio-tejo/concelho/tomar`, um endereço que não é o
     * público. As fichas que precisam de `og:url` declaram-no por extenso; um
     * og:url errado é pior do que nenhum. Os caminhos absolutos («/og/…»)
     * resolvem contra o `metadataBase` desta região, que é o que faz cada
     * domínio descrever-se a si próprio.
     */
    openGraph: {
      type: 'website',
      locale: 'pt_PT',
      siteName: 'Coreto',
      // O cartaz social é da região, quando ela o entregou; sem ficheiro não
      // se promete imagem nenhuma — um og:image a 404 é pior do que nenhum.
      ...(regiao.ogImage
        ? { images: [{ url: regiao.ogImage.caminho, alt: regiao.ogImage.alt }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
    },
    /*
     * O que o iOS precisa de saber, que não vem no manifesto — ver o
     * histórico desta decisão no git: o `capable: true` escreve a forma
     * moderna e a meta `apple-` vai à mão porque a cadeia com esse prefixo
     * já não existe no pacote.
     */
    appleWebApp: {
      capable: true,
      title: 'Coreto',
      statusBarStyle: 'default',
    },
    other: {
      'apple-mobile-web-app-capable': 'yes',
    },
    // A convenção `app/manifest.ts` punha esta ligação sozinha; com o
    // manifesto por região (ver `[regiao]/manifest.webmanifest/route.ts`),
    // declara-se aqui. O caminho é de raiz e o middleware leva-o à região.
    manifest: '/manifest.webmanifest',
    // Sem canónico de omissão: cada página declara o seu, por extenso. O
    // `./` que aqui viveu resolvia contra o caminho interno nas páginas
    // pré-geradas — ver o comentário do openGraph — e um canónico único de
    // layout diria que todas as páginas são a mesma.
  };
}

/*
 * A barra do sistema no telemóvel, que é pintada antes de haver CSS. A raiz
 * declara o turquesa para todos; aqui escolhe-se pelo tipo da região, para a
 * montra levar o vermelho dela. A forma é a mesma da raiz — duas entradas
 * com `media` e uma cor só — para uma região `cim` não mudar um byte.
 */
export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const toldo = CORES_DO_TOLDO[regiao.tipo];
  return {
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: toldo },
      { media: '(prefers-color-scheme: dark)', color: toldo },
    ],
  };
}

/*
 * O mesmo mapa da barra de baixo, sem o Início — aqui em cima o Início é o
 * logótipo. Uma lista só: acrescentar um destino num sítio e esquecer o outro
 * era o engano fácil de fazer e difícil de ver.
 */
const NAV = DESTINOS.filter((destino) => destino.href !== '/');

export default async function RegiaoLayout({ children, params }: Props) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const origem = urlDoSitio(regiao, SITE_URL);
  const desligadas = await seccoesDesligadas(regiao.id);
  const nav = semAsDesligadas(NAV, desligadas);
  const promotor = regiao.promotor;

  const sitio = (
    <>
      {/* Quem é o sítio e quem responde por ele, em todas as páginas. */}
      <SiteStructuredData regiao={regiao} origem={origem} />

      {/*
        A medição, com o nome da região colado a cada vista de página: é o que
        deixa somar por cliente sem depender do domínio, que muda quando uma
        CIM leva a agenda para o nome dela. Sem chave configurada não carrega
        nada nem faz um único pedido.
      */}
      <AnalyticsProvider regiao={regiao.id} />
      <a className="skip-link" href="#conteudo">
        Saltar para o conteúdo
      </a>

      {/*
        O toldo.

        O cabeçalho é o telhado do coreto, e um telhado de coreto não é
        cinzento: é a cor viva da marca, com a saia do lambrequim a pender
        dele. Por cima vai tinta escura e não branco — o branco sobre este
        turquesa dá 2,2:1 e desfaz-se.
      */}
      <header className="ct-bloco-marca ct-grain bg-brand text-on-brand">
        <div className="ct-goteira relative z-10 mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 py-3.5 sm:gap-x-5">
          <Link
            href="/"
            className="font-display flex min-h-11 items-center gap-2.5 text-2xl font-semibold tracking-tight"
          >
            <BandstandMark className="size-7" />
            Coreto
          </Link>

          {/*
            A assinatura de quem promove, ao lado do nome da casa — dentro da
            mesma linha de 44 px do logótipo, pelas razões de altura medidas
            quando ela entrou. O logótipo é servido daqui e não do sítio da
            CIM: a regra da casa é não fazer um único pedido a terceiros para
            desenhar uma página.
          */}
          {promotor && (
            <a
              href={promotor.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Promovido por ${promotor.nome} (abre noutro separador)`}
              className="flex min-h-11 flex-col items-start justify-center gap-0.5 rounded"
            >
              <span className="text-[0.5625rem] leading-none font-medium">Promovido por</span>
              {promotor.logotipo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={promotor.logotipo.sobreMarca}
                  width={promotor.logotipo.largura}
                  height={promotor.logotipo.altura}
                  alt={promotor.nome}
                  decoding="async"
                  className="h-5 w-auto"
                />
              ) : (
                // Uma região sem ficheiros assina em texto — o nascimento
                // não pode depender de um commit de ativos.
                <span className="text-xs leading-none font-semibold">{promotor.nome}</span>
              )}
            </a>
          )}

          {/* Os cinco destinos vivem na barra de baixo no telemóvel; aqui em
              cima ficam só a partir do tablet, onde há linha para eles. */}
          <nav aria-label="Principal" className="flex-1">
            <ul className="flex items-center justify-end gap-x-1 text-sm">
              <NavegacaoDoToldo destinos={nav} regiao={regiao.id} />
              <li>
                <Link
                  href="/submeter"
                  className="ml-1.5 inline-flex min-h-11 items-center rounded-full border border-on-brand/60 px-4 font-medium hover:bg-on-brand/10"
                >
                  Enviar<span className="hidden sm:inline">&nbsp;evento</span>
                </Link>
              </li>
              <li className="ml-1.5">
                <ThemeToggle />
              </li>
            </ul>
          </nav>
        </div>
      </header>
      {/* A saia do telhado, a assinatura da casa — na cor do telhado. */}
      <div className="ct-lambrequim ct-lambrequim-marca" aria-hidden="true" />

      <main id="conteudo" className="ct-goteira mx-auto w-full max-w-5xl flex-1 py-8 sm:py-10">
        {children}
      </main>

      <BarraInferior desligadas={desligadas} email={regiao.email} regiao={regiao.id} />

      <RodapeDoSitio desligadas={desligadas} regiao={regiao} />
    </>
  );

  /*
   * A montra veste vermelho — é o sítio do produto, não a agenda de uma
   * região, e não pode parecer a do Médio Tejo. É a montra inteira, entrada
   * e demonstração: o toldo e o rodapé são deste layout, que não sabe em que
   * página está, e um toldo turquesa por cima da página do produto era
   * exatamente a confusão a evitar. O invólucro só diz o que isto é; a paleta
   * está em `globals.css`, no âmbito `[data-paleta='montra']`. É `display:
   * contents` para não criar caixa — o `<body>` da raiz continua a ser o
   * contentor flex do `main`. Uma região `cim` fica como estava, byte a byte.
   */
  if (regiao.tipo === 'montra') {
    return (
      <div data-paleta="montra" className="contents">
        {sitio}
      </div>
    );
  }
  return sitio;
}
