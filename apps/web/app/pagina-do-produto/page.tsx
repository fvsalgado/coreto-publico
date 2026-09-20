import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { AnalyticsProvider } from '@/src/components/AnalyticsProvider';
import { BandstandMark } from '@/src/components/BandstandMark';
import { PaginaDaMontra } from '@/src/components/PaginaDaMontra';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { REGIAO_DA_FICHA } from '@/src/lib/analytics/posthog';
import { FORNECEDOR, identidadeNumaLinha } from '@/src/lib/fornecedor';
import { CORES_DO_TOLDO } from '@/src/lib/marca';
import { AUTOR, PRODUTO } from '@/src/lib/produto';

/**
 * O que se serve a um anfitrião que não é de nenhuma região: o produto.
 *
 * Um Host que o mapa de domínios não conhece deixou de cair na região
 * principal (ver o histórico da decisão em `lib/regiao-host.ts`) e vem aqui
 * parar. É a página do produto e mais nada — nunca a agenda de um cliente num
 * endereço que ninguém lhe atribuiu.
 *
 * **Estática a sério, e não por acaso.** Não toca na base de dados: tudo o que
 * mostra sai de `lib/produto.ts`. É precisamente a página que tem de aguentar
 * o dia mau — a base em baixo, ou a leitura de `/api/regioes` a falhar, que
 * deixa o mapa vazio trinta segundos e faz de TODOS os anfitriões
 * desconhecidos. Uma página de recurso que precisasse da base era uma página
 * de recurso que caía junto com ela; o `dynamic = 'error'` é essa promessa
 * escrita de forma a partir o build de quem a quebrar, em vez de a degradar em
 * silêncio.
 *
 * **Onde vive, e porque tem este nome.** Fora do segmento `app/[regiao]/`, que
 * é todo de região e cujo layout chama `exigirRegiao` na primeira linha — aqui
 * não há região para exigir. O caminho interno é escolhido com o mesmo cuidado
 * do `sitemap-xml`: nada de nomes mágicos do Next, e não é endereçável por
 * fora — num anfitrião conhecido `/pagina-do-produto` reescreve-se para
 * `/<regiao>/pagina-do-produto`, que não existe, e num desconhecido só a raiz
 * chega aqui. O endereço público desta página é `/`, e um só.
 *
 * **Indexável, com canónico — e já não foi.** Enquanto isto era só a rede de
 * segurança de um anfitrião desconhecido, `noindex` era o certo: o mesmo
 * conteúdo servido em todos os hosts que apontassem para cá é conteúdo
 * duplicado de manual. Deixou de ser só isso. Com a demonstração mudada para
 * o seu domínio, esta é a página do `coreto.org` — a face pública do produto,
 * e uma ficha técnica que ninguém encontra não serve para nada.
 *
 * O duplicado resolve-se como se resolve: um canónico fixo para
 * `https://coreto.org/`. Um anfitrião desconhecido que caia aqui continua a
 * servir a página, e diz aos motores que o original está no `coreto.org` — em
 * vez de se esconder. O middleware deixa de carimbar `X-Robots-Tag` neste
 * caminho pela mesma razão: um cabeçalho que diz `noindex` ganha ao canónico
 * do HTML, e ganhava-lhe também no endereço onde queremos ser encontrados.
 */

export const metadata: Metadata = {
  title: 'Coreto — toda a programação cultural do seu território, numa agenda só.',
  description:
    'O Coreto lê todas as noites o que as câmaras, os teatros, as bibliotecas e as coletividades ' +
    'publicam, e arruma tudo numa agenda só — para municípios, comunidades intermunicipais e ' +
    'associações, cada um no seu domínio.',
  alternates: { canonical: 'https://coreto.org/' },
};

export const dynamic = 'error';

/*
 * A barra do sistema no telemóvel, pintada antes de haver CSS: aqui é o
 * vermelho da montra, e não o turquesa que o layout de raiz declara para as
 * regiões. A mesma forma que a raiz usa — duas preferências, uma cor — para
 * lhe ganhar chave a chave; o `viewportFit` dela fica.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: CORES_DO_TOLDO.montra },
    { media: '(prefers-color-scheme: dark)', color: CORES_DO_TOLDO.montra },
  ],
};

export default function PaginaDoProduto() {
  /*
   * O toldo, o lambrequim e o rodapé vêm daqui e não de um layout: por cima
   * desta página só está o esqueleto de raiz (documento, letra, tema), porque
   * a navegação e o rodapé de sempre são da região e não há região nenhuma.
   * Mas uma página de venda sem cabeçalho nem rodapé parecia uma página a
   * meio de carregar — e a assinatura visual do produto (a saia recortada, o
   * grafite) é parte do que se está a mostrar. Vestem-se aqui as mesmas
   * peças, reduzidas ao que faz sentido sem agenda: a marca, o botão de
   * falar, o tema, e o rodapé com o crédito.
   *
   * O invólucro `data-paleta="montra"` é o que a veste de vermelho — a paleta
   * está em `globals.css`; aqui só se diz que esta página é a montra, e não a
   * agenda de uma região. É `display: contents` para não criar caixa: o
   * `<body>` da raiz continua a ser o contentor flex do `main`.
   */
  return (
    <div data-paleta="montra" className="contents">
      {/*
        Esta página conta-se como as outras, com um nome que diz o que é: não
        há região nenhuma aqui, e é isso que a define. Sem ela, o endereço do
        produto era o único do sistema sobre o qual não se sabia nada.
      */}
      <AnalyticsProvider regiao={REGIAO_DA_FICHA} />
      <a className="skip-link" href="#conteudo">
        Saltar para o conteúdo
      </a>
      <header className="ct-bloco-marca ct-grain bg-brand text-on-brand">
        <div className="ct-goteira relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-x-3 py-3.5">
          <Link
            href="/"
            className="font-display flex min-h-11 items-center gap-2.5 text-2xl font-semibold tracking-tight"
          >
            <BandstandMark className="size-7" />
            {PRODUTO.nome}
          </Link>
          <div className="flex items-center gap-1.5">
            <a
              href={`mailto:${PRODUTO.email}`}
              className="inline-flex min-h-11 items-center rounded-full border border-on-brand/60 px-4 text-sm font-medium hover:bg-on-brand/10"
            >
              Falar connosco
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="ct-lambrequim ct-lambrequim-marca" aria-hidden="true" />

      <main id="conteudo" className="ct-goteira mx-auto w-full max-w-5xl flex-1 py-8 sm:py-10">
        <PaginaDaMontra />
      </main>

      <footer className="mt-14 sm:mt-16">
        <div className="ct-lambrequim ct-lambrequim-flip" aria-hidden="true" />
        <div className="ct-bloco-escuro ct-grain bg-accent-deep text-white">
          <div className="ct-goteira relative z-10 mx-auto w-full max-w-5xl py-10">
            <p className="font-display max-w-2xl text-xl text-balance">
              O coreto é o palco de quem não tem palco. Está no largo, no jardim, à beira da estrada
              — e ninguém precisa de convite para lá subir.
            </p>
            <p className="mt-9 border-t border-white/15 pt-7 text-sm text-on-deep-muted">
              {PRODUTO.nome} · Desenvolvido por{' '}
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

            {/*
             * Quem fornece o serviço, que o artigo 10.º do Decreto-Lei n.º
             * 7/2004 manda dar em acesso fácil, direto e permanente.
             *
             * Aqui e não no rodapé de uma região: o serviço é oferecido neste
             * domínio, e a agenda do Médio Tejo é da CIM — o rodapé dela diz
             * quem a promove, que é outra pergunta. Sai de `lib/fornecedor.ts`
             * inteira, morada incluída no dia em que houver uma.
             */}
            <p className="mt-2 text-sm text-on-deep-muted">
              Fornecido por {identidadeNumaLinha()} ·{' '}
              <a
                href={`mailto:${FORNECEDOR.email}`}
                className="underline underline-offset-4 hover:text-white"
              >
                {FORNECEDOR.email}
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
