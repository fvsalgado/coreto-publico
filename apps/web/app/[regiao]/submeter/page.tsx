import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { seccaoLigada } from '@/src/lib/queries/seccoes';
import type { Regiao } from '@/src/lib/regiao';

interface Props {
  params: Promise<{ regiao: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  return {
    title: 'Enviar um evento',
    description: `Como pôr um evento na agenda ${regiao.doNome}: um email com os dados, com o cartaz ou com a agenda em PDF. Sem conta e sem formulário.`,
    alternates: { canonical: '/submeter' },
  };
}

/**
 * O envio de eventos é por email, por decisão do editor.
 *
 * Houve aqui um formulário; saiu. Quem programa cultura — a filarmónica, a
 * comissão de festas, o técnico da câmara — já vive no email, já lá tem o
 * cartaz e o texto que mandou à imprensa, e reencaminhar custa um gesto.
 * Um formulário obrigava a partir essa informação por campos que nós é que
 * precisamos, e a moderação humana existe de qualquer maneira do outro lado.
 *
 * Esta página é, por isso, sobretudo pedagógica: o que fazer, o que serve, e
 * a única coisa que não serve. Escrita a pensar em quem chega aqui sem
 * saber o que é um «feed» nem porque é que uma newsletter não chega.
 */
const ASSUNTO = encodeURIComponent('Evento para a agenda');
const CORPO = encodeURIComponent(
  [
    'Nome do evento:',
    'Dia (e hora, se houver):',
    'Onde (espaço e concelho):',
    'Entrada (livre? bilhetes? quanto?):',
    '',
    'Duas linhas sobre o evento:',
    '',
    '(Se houver cartaz, junte-o ao email. Um PDF com a agenda inteira também serve.)',
  ].join('\n'),
);

// O endereço é o da região, lido na renderização; o guião é do produto.
function mailtoDe(email: string): string {
  return `mailto:${email}?subject=${ASSUNTO}&body=${CORPO}`;
}

const traco = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

type Icone = (props: { className: string }) => React.ReactElement;

const IcEscrever: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <path d="M4 20h4.2L19 9.2a2.3 2.3 0 0 0-3.2-3.2L5 16.8z" />
    <path d="m14.4 7.4 2.2 2.2" />
  </svg>
);

const IcCartaz: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
    <circle cx="9" cy="9.5" r="1.6" />
    <path d="m4.5 17.5 4.3-4.3a2 2 0 0 1 2.8 0l4.6 4.6M14 14.6l1.6-1.6a2 2 0 0 1 2.8 0l2.1 2.1" />
  </svg>
);

const IcPdf: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="M8.5 13h7M8.5 16.2h4.5" />
  </svg>
);

const IcNao: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.8 6.5 7.1 5.3a2 2 0 0 0 2.2 0l7.1-5.3" />
    <path d="m4 20 16-16" />
  </svg>
);

const IcConversa: Icone = ({ className }) => (
  <svg {...traco} className={className}>
    <path d="M20.5 12.5a7.5 7.5 0 0 1-10.9 6.7L4 20.5l1.3-5.6A7.5 7.5 0 1 1 20.5 12.5z" />
    <path d="M10 10.2a2.1 2.1 0 1 1 2.9 1.9c-.5.2-.9.7-.9 1.3v.3M12 16.4h.01" />
  </svg>
);

/**
 * As três formas, por ordem de esforço de quem envia.
 *
 * A ordem não é casual: quem chega convencido de que «isto vai dar trabalho»
 * desiste no primeiro cartão. O primeiro cartão é, por isso, o mais barato
 * de todos — três linhas — e o último é o que resolve a vida a uma câmara
 * com uma agenda inteira para passar.
 */
const FORMAS: readonly { Icone: Icone; titulo: string; texto: string; nota: string }[] = [
  {
    Icone: IcEscrever,
    titulo: 'Escreva o que sabe',
    texto: 'O nome, o dia e o sítio. Três linhas chegam para começar.',
    nota: 'O resto perguntamos nós, se fizer falta.',
  },
  {
    Icone: IcCartaz,
    titulo: 'Ou mande só o cartaz',
    texto: 'Uma fotografia do cartaz, no tamanho que houver, serve.',
    nota: 'É de lá que tiramos os dados.',
  },
  {
    Icone: IcPdf,
    titulo: 'Ou a agenda inteira',
    texto: 'Um PDF com o mês todo ou com a temporada vai no mesmo email.',
    nota: 'Muitos eventos de uma vez não são problema.',
  },
];

/**
 * Onde é que «tem lugar aqui» é — composto da região, nunca escrito à mão.
 *
 * Esteve aqui a contagem do Médio Tejo escrita por extenso, o que é verdade
 * lá e mentira em todas as outras agendas: esta página serve-se em todas, e a
 * demonstração tem dois concelhos. Abaixo de dois a contagem não faz frase —
 * e a região de recurso declara zero —, por isso aí nomeia-se o território em
 * vez de o contar.
 */
function ondeHaLugar(regiao: Regiao): string {
  return regiao.concelhosDeclarados >= 2
    ? `num dos ${regiao.concelhosPorExtenso} concelhos`
    : regiao.noNome;
}

const AJUDA: readonly [string, string][] = [
  ['O nome do evento', 'como aparece no cartaz.'],
  ['A data e a hora', 'e as datas todas, se repetir.'],
  ['Onde', 'o espaço e o concelho — «no coreto de Minde» chega perfeitamente.'],
  ['A entrada', 'livre, ou quanto custa e onde se compra.'],
  ['O cartaz', 'em anexo, no tamanho que houver.'],
];

export default async function SubmitPage({ params }: Props) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  const haFontes = await seccaoLigada(regiao.id, 'fontes');
  const EMAIL = regiao.email;
  const MAILTO = mailtoDe(EMAIL);

  return (
    <>
      <PageHeader
        title="Enviar um evento"
        eyebrow="Participar"
        lead="Tem um concerto, uma exposição, uma festa? Mande-nos um email. Não é preciso conta, nem formulário, nem escrever bonito — e uma pessoa lê tudo antes de aparecer na agenda."
      />

      <section aria-labelledby="tres-formas" className="mt-8">
        <h2 id="tres-formas" className="ct-heading">
          Qualquer uma destas três serve
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {FORMAS.map(({ Icone, titulo, texto, nota }) => (
            <li
              key={titulo}
              className="flex h-full flex-col rounded-lg border border-border bg-surface p-4"
            >
              <span className="ct-octagon grid size-11 place-items-center bg-accent-soft text-accent">
                <Icone className="size-6" />
              </span>
              <p className="font-display mt-3 text-lg font-semibold">{titulo}</p>
              <p className="mt-1 text-sm">{texto}</p>
              <p className="mt-auto pt-2 text-sm text-muted">{nota}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Sem base não há endereço — e uma ligação sem texto é uma barreira,
          não uma degradação. O bloco só se desenha quando há para onde
          escrever. */}
      {EMAIL ? (
        <div className="mt-8 max-w-2xl rounded-lg border border-border bg-accent-soft p-5">
          <p className="text-sm font-medium">Para aqui:</p>
          <a
            href={MAILTO}
            className="font-display mt-2 inline-flex min-h-11 items-center rounded-lg bg-accent px-5 py-3 text-xl font-semibold break-all text-on-accent shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {EMAIL}
          </a>
          <p className="mt-3 text-sm text-muted">
            O botão abre o seu programa de email já com um guião do que ajuda. Um email escrito à
            maneira de cada um serve exatamente na mesma.
          </p>
        </div>
      ) : null}

      <section aria-labelledby="o-que-ajuda" className="mt-10 max-w-2xl">
        <h2 id="o-que-ajuda" className="ct-heading">
          O que ajuda a publicar depressa
        </h2>
        <ul className="mt-3 grid gap-2 text-[0.95rem]">
          {AJUDA.map(([forte, resto]) => (
            <li key={forte} className="flex gap-2.5">
              <span aria-hidden="true" className="ct-octagon mt-2 size-2 shrink-0 bg-accent" />
              <span>
                <strong className="font-medium">{forte}</strong> — {resto}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">
          Nada disto é obrigatório. Falta a hora? Escreva sem ela — pergunta-se depois.
        </p>
      </section>

      {/*
       * O único «não» desta página, e por isso tem caixa própria.
       *
       * Inscrever a agenda numa newsletter é o gesto que quem faz comunicação
       * cultural conhece, e é natural que seja o primeiro que ocorre. Dizer
       * só «não serve» deixava a pessoa sem saber porquê nem o que fazer a
       * seguir; por isso a caixa explica a razão numa linha e acaba sempre
       * com o caminho que resolve o problema dela.
       */}
      <section
        aria-labelledby="nao-entra"
        className="mt-10 max-w-2xl rounded-lg border border-highlight/40 bg-surface p-5"
      >
        <div className="flex items-start gap-3">
          <span className="ct-octagon grid size-11 shrink-0 place-items-center bg-highlight/12 text-highlight">
            <IcNao className="size-6" />
          </span>
          <div>
            <h2 id="nao-entra" className="ct-heading">
              Newsletters e mailing lists não entram
            </h2>
            <div className="mt-2 space-y-3 text-[0.95rem]">
              <p>
                Inscrever o Coreto numa newsletter <strong>não põe cá nada</strong>. Uma newsletter
                é uma carta escrita para pessoas: traz o mês inteiro num texto corrido, sem cada
                evento separado, muitas vezes sem o espaço e quase sempre sem o preço. A agenda
                precisa de um evento de cada vez, com data e sítio — e isso não se tira de lá com
                confiança.
              </p>
              <p>
                Por isso não estamos inscritos em lista nenhuma, e o que chegar por essa via não é
                tido em consideração. Não é desinteresse: é que ninguém a leria.
              </p>
              <p className="rounded border border-border bg-accent-soft p-3">
                <strong>Em vez disso:</strong> mande o mesmo conteúdo — ou o cartaz, ou o PDF — para{' '}
                {EMAIL ? (
                  <a href={MAILTO} className="underline underline-offset-4">
                    {EMAIL}
                  </a>
                ) : (
                  'o email da agenda'
                )}
                . E se a vossa agenda já vive num sítio que se possa ler todos os dias,{' '}
                {haFontes ? (
                  <Link href="/fontes" className="underline underline-offset-4">
                    ligamo-la de vez
                  </Link>
                ) : (
                  'ligamo-la de vez'
                )}{' '}
                e nunca mais têm de enviar nada.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="na-duvida"
        className="mt-8 flex max-w-2xl items-start gap-3 rounded-lg border border-border bg-surface p-5"
      >
        <span className="ct-octagon grid size-11 shrink-0 place-items-center bg-accent-soft text-accent">
          <IcConversa className="size-6" />
        </span>
        <div>
          <h2 id="na-duvida" className="ct-heading">
            Na dúvida, escreva a perguntar
          </h2>
          <p className="mt-2 text-[0.95rem]">
            Tem uma programação grande, um sistema de bilheteira, uma folha de cálculo, um site que
            já publica tudo? Diga o que tem e combinamos a melhor forma de o passar para cá. Muitas
            vezes é mais simples do que parece — e resolve-se de uma vez para sempre.
          </p>
        </div>
      </section>

      <div className="mt-8 max-w-2xl rounded border border-border bg-accent-soft p-4 text-sm">
        <p>
          Esta agenda é feita para caber a programação toda — a do teatro municipal e a do concerto
          da filarmónica no coreto. Quem organiza alguma coisa aberta ao público{' '}
          {ondeHaLugar(regiao)} tem lugar aqui.
        </p>
      </div>

      {/* A ligação à política está sempre aqui, sem interruptor: o RGPD quer
          a informação sobre o tratamento à vista onde os dados se recolhem, e
          é nesta página que se pede o email. A política teve casa dentro das
          informações — uma secção que se desliga — e esta ligação caía com
          ela; hoje vive em `/privacidade`, que não se desliga. */}
      <p className="mt-8 max-w-2xl text-sm text-muted">
        O endereço de quem envia serve só para falarmos sobre o que foi enviado e não é publicado. O
        que fazemos com ele está por extenso na{' '}
        <Link href="/privacidade" className="underline underline-offset-4">
          política de privacidade
        </Link>
        .
      </p>
    </>
  );
}
