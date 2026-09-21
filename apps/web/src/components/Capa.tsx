import { posterBackground } from '@/src/lib/cartaz';
import { coverDay, formatCategory } from '@/src/lib/format';
import { BandstandMark } from '@/src/components/BandstandMark';

interface CapaEvent {
  title: string;
  image_url: string | null;
  /** A cópia pequena (400 px), quando o cartaz é nosso. Ver a migração 0162. */
  image_miniatura: string | null;
  image_alt: string | null;
  category_slug: string | null;
  date_start: string | null;
  date_end: string | null;
}

interface Props {
  event: CapaEvent;
  /**
   * O dia de hoje em Lisboa, `YYYY-MM-DD`.
   *
   * Vem de fora e não de `new Date()` cá dentro: metade destas capas está em
   * componentes de cliente, e uma data calculada no cliente diverge da que o
   * servidor desenhou sempre que a página foi construída ontem.
   */
  today: string;
  className?: string;
}

/**
 * A capa de um evento — o único sítio onde ela se desenha.
 *
 * Os cartazes das câmaras vêm em todos os feitios: A3 ao alto, banners ao
 * baixo, quadrados de rede social. Cortá-los ao meio para caberem num
 * retângulo era o que tornava as capas feias. Aqui nenhum cartaz é cortado:
 * a moldura é 3:4 sempre, o cartaz inteiro pousa no centro, e o fundo é o
 * próprio cartaz desfocado — qualquer rácio fica com ar de intenção.
 *
 * E o evento sem cartaz deixa de ser um espaço cinzento: recebe uma capa
 * tipográfica — o dia em numeral grande, o título, a cor da categoria e o
 * coreto em filigrana. Hoje são poucos os eventos sem cartaz, mas a capa
 * desenhada não existe por causa deles: existe porque **qualquer** cartaz
 * pode desaparecer de um dia para o outro, e a agenda tem de continuar a ter
 * desenho quando isso acontecer.
 *
 * A capa é decorativa de ponta a ponta, e o cartaz não leva descrição.
 * Não é desleixo: os cartazes do catálogo trazem um `image_alt` que repete à
 * letra o título do evento — e o título está sempre escrito ao lado da capa.
 * Anunciá-lo outra vez pela imagem faz o leitor de ecrã dizer a mesma coisa
 * duas vezes. Uma imagem que não acrescenta nada ao que está escrito ao lado
 * é, por definição, decorativa. (Há um cartaz sem `image_alt` nenhum, o que
 * não muda a conclusão: a alternativa a repetir o título é não dizer nada, e
 * é isso que uma imagem decorativa faz.)
 *
 * A capa tipográfica é sempre o chão, e o cartaz assenta por cima dela. A
 * esmagadora maioria dos eventos publicados aponta para uma imagem alojada em
 * casa de quem organiza, e num gestor de conteúdos municipal esses endereços
 * morrem — muda-se o tema, arruma-se a pasta do ano, e o cartaz de julho
 * deixa de responder. Quando isso acontece não fica um retângulo vazio no
 * cartão: fica a capa que estava por baixo. Sem JavaScript, porque é o
 * browser que já sabe fazer isto.
 */
/*
 * A escala é da caixa, e não de quem a chama.
 *
 * Havia um `size` com três valores — `xs`, `sm`, `lg` — que cada chamador
 * escolhia à mão, e foi isso que produziu o defeito: o painel do mapa pedia
 * `xs` a oitenta pixéis e a lista da agenda pedia `sm` a oitenta e quatro.
 * Quatro pixéis de diferença, dois tratamentos opostos. E a lista, com o
 * `sm` que fora desenhado para os cento e quarenta e quatro da fila de
 * destaques, punha um título de catorze pixéis em sessenta de largura útil:
 * partia a meio da palavra e o `line-clamp` comia o resto. Lia-se «Animália -
 * Fotograf» e «Constânc / Kayak / Trail».
 *
 * Agora quem decide é a moldura, por `@container`. Os três degraus dizem o
 * que cabe em cada largura, e nenhum chamador tem de saber qual escolheu:
 *
 *   · **até 7 rem** — só o dia, e a categoria pela cor de fundo. É a
 *     miniatura do mapa (80 px) e a da lista (84 px no telemóvel, 108 na
 *     secretária). O título e o nome da categoria estão escritos ao lado da
 *     miniatura nas duas, e nenhum dos dois cabe cá dentro: «Desporto e
 *     natureza» precisa de cento e vinte e cinco pixéis e há sessenta.
 *   · **a partir de 7 rem** — entra o título e o nome da categoria. É a fila
 *     de destaques (144 e 176 px), onde sempre coube.
 *   · **a partir de 16 rem** — a escala grande. É o visor dos destaques
 *     (336 px) e a célula do mural do widget quando o embutido é largo, que
 *     é o caso que nenhum `size` sabia servir: a grelha do mural muda de
 *     duas para quatro colunas conforme a largura de quem embute, e a partir
 *     de mil e sessenta pixéis a célula passa dos duzentos e cinquenta e
 *     seis. Com `size` fixo ficava um dia de trinta e seis pixéis numa capa
 *     de trezentos.
 *
 * Das sete chamadas que existem, quatro ficam onde já estavam — o painel do
 * mapa e a lista do widget no primeiro degrau, a fila de destaques no
 * segundo, o visor no terceiro. Mudam três: o cartão da agenda e o do ciclo,
 * que pediam `sm` a oitenta e quatro pixéis e é o defeito que isto corrige,
 * e o mural largo do widget, que passa a crescer com a caixa em vez de ficar
 * preso à escala do meio. E o próximo chamador já não pode escolher mal:
 * não há nada para escolher.
 */
const DIA = 'text-xl @min-[7rem]:text-4xl @min-[16rem]:text-7xl';
const MES = 'font-medium text-muted text-[0.5rem] @min-[7rem]:text-sm @min-[16rem]:text-xl';
const TITULO = 'text-sm @min-[16rem]:text-2xl';

export function Capa({ event, today, className = '' }: Props) {
  const category = formatCategory(event.category_slug);
  const when = coverDay(event.date_start, event.date_end, today);
  const cartaz = posterBackground(event.image_url);
  /*
   * A miniatura, quando o cartaz é nosso.
   *
   * O cartão da agenda desenha esta moldura a 84 píxeis no telemóvel; a
   * vitrine dos destaques desenha-a a 336. Servir o mesmo ficheiro aos dois
   * custa a diferença entre os dois **vinte vezes por página** — medido nos
   * primeiros 38 cartazes copiados, 14 KB a miniatura contra 43 KB o grande.
   *
   * Cai para o cartaz inteiro quando não há cópia nossa — um evento de fonte
   * não alojável, ou uma cópia que ainda não se fez —, e aí esta moldura faz
   * exactamente o que fazia antes de a cópia existir.
   */
  const pequeno = posterBackground(event.image_miniatura) ?? cartaz;
  const duasMedidas = pequeno !== cartaz;

  return (
    <div
      aria-hidden="true"
      className={`ct-capa ct-grain @container relative isolate aspect-[3/4] overflow-hidden rounded-lg border border-border bg-surface ${className}`}
    >
      <div className="absolute inset-0 flex flex-col justify-between p-1.5 @min-[7rem]:p-3">
        {/* A cor da categoria como luz ambiente, não como parede. */}
        <div className={`absolute inset-0 -z-10 opacity-[0.14] ${category?.dot ?? 'bg-accent'}`} />
        <BandstandMark className="pointer-events-none absolute -right-1 -bottom-1 -z-10 size-10 text-ink opacity-[0.07] @min-[7rem]:-right-3 @min-[7rem]:-bottom-3 @min-[7rem]:size-24" />

        {when ? (
          <p className="flex items-baseline gap-1 @min-[7rem]:gap-1.5">
            {/* Numa exposição que já abriu o numeral grande é o do último dia,
                e sem este «até» o leitor lê-o como o dia de abertura — com toda
                a confiança do mundo, e errado. */}
            {when.untilEnd ? <span className={MES}>até</span> : null}
            <span className={`ct-numeral font-display leading-none font-semibold ${DIA}`}>
              {when.day}
            </span>
            <span className={MES}>{when.month}</span>
          </p>
        ) : (
          <p className={MES}>por confirmar</p>
        )}

        {/* Abaixo de sete rem não cabe texto, e a moldura diz o resto pela
            cor. Está escondido e não ausente porque a decisão é da caixa e
            não do servidor: a mesma capa serve os dois lados do `sm:` do
            cartão sem trocar de árvore. */}
        <div className="hidden min-w-0 @min-[7rem]:block">
          <p className={`font-display line-clamp-4 leading-snug font-semibold ${TITULO}`}>
            {event.title}
          </p>
          {category ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
              <span className={`ct-octagon size-2 ${category.dot}`} />
              {category.label}
            </p>
          ) : null}
        </div>
      </div>

      {cartaz ? (
        <>
          {/* O cartaz duas vezes: atrás, desfocado, a encher a moldura; à
              frente, inteiro e sem corte.

              Em fundo e não em `<img>`, e isso é o que faz a capa tipográfica
              cumprir o que promete. Um `<img>` que falha desenha o ícone de
              imagem partida por cima da capa — no Chromium, e mesmo com
              `alt=""`, o que foi medido e não presumido. Um `background-image`
              que falha não desenha nada, e por baixo fica exatamente a capa
              que devia ficar. Como toda esta moldura é `aria-hidden` e o
              título está escrito ao lado, estas imagens são decorativas por
              definição — e uma imagem decorativa é do CSS.

              O desfocado é opaco de propósito. Com o cartaz da frente em
              `contain`, um cartaz mais largo ou mais estreito do que 3:4 deixa
              faixas vazias, e por elas via-se o chão: a data por cima do
              cartaz e um pedaço do título por baixo, dois textos sobrepostos e
              nenhum legível. */}
          <div aria-hidden="true" className="absolute inset-0 z-10 overflow-hidden">
            {/* O desfocado transborda a moldura e a moldura corta-o.
                `filter: blur(24px)` desvanece as margens do próprio elemento —
                σ é metade do raio e a franja chega a uns trinta e seis píxeis —,
                e era por essa franja que a capa tipográfica se via em fantasma
                por cima e por baixo do cartaz, que é exatamente onde a data e o
                título estão. Com quarenta e oito píxeis de folga a franja cai
                toda fora do que se vê.

                A folga é em `inset` negativo e não em `scale`: o `scale`
                amplia a franja na mesma proporção em que afasta a margem, e
                nunca a alcança. */}
            {/* O desfocado é sempre a miniatura, e nunca outra coisa: por
                baixo de um `blur(24px)` não há detalhe nenhum que os mil e
                duzentos píxeis do grande acrescentem. É o caso em que a
                medida pequena não é um compromisso — é a certa. */}
            <div
              style={{ backgroundImage: pequeno }}
              className="absolute -inset-12 bg-cover bg-center blur-xl saturate-150 dark:brightness-[0.45] dark:saturate-100"
            />
          </div>
          {/* E à frente, a medida que a caixa merece.
 
              São duas camadas e não uma com dois endereços porque não há
              maneira de escolher um endereço por largura de contentor: o
              `srcset` é do `<img>`, e esta moldura é de fundos por razões que
              estão escritas em cima. Duas camadas resolvem-no sem JavaScript —
              a que está `display:none` não é descarregada, que é a regra que
              faz isto valer a pena.
 
              Sem cópia nossa há uma só, porque os dois endereços eram o mesmo
              e duas camadas iguais é uma a mais. */}
          {duasMedidas ? (
            <>
              <div
                aria-hidden="true"
                style={{ backgroundImage: pequeno }}
                className="absolute inset-0 z-20 m-[3px] rounded-[3px] bg-contain bg-center bg-no-repeat drop-shadow-md @min-[16rem]:hidden"
              />
              <div
                aria-hidden="true"
                style={{ backgroundImage: cartaz }}
                className="absolute inset-0 z-20 m-[3px] hidden rounded-[3px] bg-contain bg-center bg-no-repeat drop-shadow-md @min-[16rem]:block"
              />
            </>
          ) : (
            <div
              aria-hidden="true"
              style={{ backgroundImage: cartaz }}
              className="absolute inset-0 z-20 m-[3px] rounded-[3px] bg-contain bg-center bg-no-repeat drop-shadow-md"
            />
          )}
        </>
      ) : null}
    </div>
  );
}
