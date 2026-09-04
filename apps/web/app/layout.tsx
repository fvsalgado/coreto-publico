import type { Metadata, Viewport } from 'next';
import { Fraunces } from 'next/font/google';
import { ScrollReveal } from '@/src/components/ScrollReveal';
import { CORES_DO_TOLDO } from '@/src/lib/marca';
import './globals.css';

/**
 * O esqueleto do produto — o que é igual em todas as regiões, sempre.
 *
 * O documento, a letra e o tema vivem aqui; o toldo, a navegação, o rodapé e
 * os metadados vivem no layout da região (`[regiao]/layout.tsx`), porque são
 * dela. O que fica por baixo deste layout sem passar pelo da região — a área
 * interna e a página de erro de raiz — recebe o esqueleto e mais nada, que é
 * o que essas superfícies precisam.
 *
 * A medição esteve aqui e saiu, por ser aqui que ela não sabe o que está a
 * medir: este layout não tem região para declarar e serve também a área
 * interna. Montam-na agora o layout da região e a página do produto — ver
 * `components/AnalyticsProvider.tsx`.
 */

/**
 * A letra de cartaz. Servida pelo próprio sítio (o `next/font` descarrega na
 * compilação e serve do nosso domínio): nem um pedido a terceiros, que é a
 * regra da casa. Os eixos SOFT e WONK são o feitio da Fraunces — a curva
 * ligeiramente torta que um cartaz de festa pintado à mão também tem.
 */
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
});

/**
 * Metadados mínimos, do produto. Os verdadeiros — título com a região,
 * descrição, canónicos, cartaz social — são do layout da região; estes só
 * servem o que não passa por lá.
 */
export const metadata: Metadata = {
  title: 'Coreto',
  applicationName: 'Coreto',
};

export const viewport: Viewport = {
  /*
   * `cover` põe a página por baixo do entalhe e da faixa do indicador de
   * início do iPhone — é o que dá valor a `env(safe-area-inset-*)`, que sem
   * ele responde sempre zero. Quem trata das margens é a barra de baixo e o
   * `main`; a página inteira ganha o ecrã todo.
   */
  viewportFit: 'cover',
  /*
   * O turquesa do toldo, que é o que o telemóvel pinta à volta da página.
   *
   * É o valor de `--color-brand`, escrito em `marca.ts` porque a barra do
   * sistema é pintada antes de haver CSS. Duas entradas e não uma: a lista
   * com `media` é a forma de o dizer por preferência, e as duas dizem a mesma
   * cor porque o toldo não muda com o tema. É a omissão do produto: o layout
   * da região e a página do produto declaram a sua, na mesma forma, e a
   * montra leva o vermelho dela.
   */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: CORES_DO_TOLDO.cim },
    { media: '(prefers-color-scheme: dark)', color: CORES_DO_TOLDO.cim },
  ],
};

/**
 * Repõe o tema escolhido antes da primeira pintura, para não haver um piscar
 * de claro para escuro ao abrir cada página. Lê a mesma chave que o botão do
 * masthead escreve; sem escolha guardada não toca em nada e vale a
 * preferência do sistema. Corre inline de propósito — um ficheiro externo
 * chegava tarde de mais.
 */
const TEMA_ARRANQUE = `try{var t=localStorage.getItem('coreto-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` porque o script de arranque escreve o
    // `data-theme` na raiz antes de o React hidratar — a diferença é
    // intencional, não um erro a assinalar.
    <html lang="pt-PT" className={fraunces.variable} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <script dangerouslySetInnerHTML={{ __html: TEMA_ARRANQUE }} />
        {children}

        <ScrollReveal />
      </body>
    </html>
  );
}
