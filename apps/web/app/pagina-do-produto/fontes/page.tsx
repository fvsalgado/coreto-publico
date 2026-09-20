import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { FALHAS_ATE_PAUSA, HORAS_EM_PAUSA, USER_AGENT } from '@coreto/core';
import { AnalyticsProvider } from '@/src/components/AnalyticsProvider';
import { BandstandMark } from '@/src/components/BandstandMark';
import { PageHeader } from '@/src/components/PageHeader';
import { REGIAO_DA_FICHA } from '@/src/lib/analytics/posthog';
import { CORES_DO_TOLDO } from '@/src/lib/marca';
import { PRODUTO } from '@/src/lib/produto';
import { ORIGEM_DA_MONTRA } from '../montra';

/**
 * O cartão de visita da recolha, no domínio do produto.
 *
 * É o destino do endereço que o agente traz em cada pedido — `USER_AGENT`, em
 * `@coreto/core` —, e por isso a página que um administrador de sistemas abre
 * quando nos vê nos registos do servidor dele. Até 19 de setembro de 2026 esse
 * endereço era a `/fontes` da primeira região: apresentava a recolha com o
 * domínio de um cliente à porta das câmaras de qualquer outra, e, com a
 * barreira dessa região ligada, levava quem o seguisse a uma página a pedir
 * senha. Aqui não há senha, não há região e não há base de dados: é a página
 * que tem de responder no dia em que tudo o resto estiver em baixo.
 *
 * O que é de uma região — que fontes se leem, com que estado — continua na
 * `/fontes` dessa agenda, e é para lá que isto manda. O que é da recolha em
 * si — a linha do agente, as regras, como pedir que se pare — está aqui uma
 * vez, para todas.
 *
 * A linha do agente é lida de `@coreto/core` e não escrita à mão: quem a for
 * confrontar com os registos tem de encontrar carácter a carácter o que esta
 * página lhe promete. Uma asserção do CI recusa a cópia manual.
 */

export const metadata: Metadata = {
  title: 'A recolha do Coreto — quem somos nos seus registos',
  description:
    'O que o agente Coreto/1.0 lê, com que regras, como respeita o robots.txt e como pedir que abrande ou pare. Para quem administra o sítio de uma câmara, de uma junta ou de uma sala.',
  alternates: { canonical: `${ORIGEM_DA_MONTRA}/fontes` },
};

/* Estática a sério: não toca na base de dados, como a política ao lado. */
export const dynamic = 'error';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: CORES_DO_TOLDO.montra },
    { media: '(prefers-color-scheme: dark)', color: CORES_DO_TOLDO.montra },
  ],
};

export default function PaginaDaRecolha() {
  return (
    <div data-paleta="montra" className="contents">
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
        </div>
      </header>
      <div className="ct-lambrequim ct-lambrequim-marca" aria-hidden="true" />

      <main id="conteudo" className="ct-goteira mx-auto w-full max-w-5xl flex-1 py-8 sm:py-10">
        <article className="max-w-2xl">
          <PageHeader
            title="Encontrou-nos nos registos do seu servidor"
            eyebrow="A recolha"
            lead="Se administra o sítio de uma câmara, de uma junta ou de uma sala, é provável que tenha chegado aqui pela linha que trazemos em cada pedido. Isto é o que ela faz, com que regras, e como nos pedir que paremos."
          />

          <p className="mt-6 rounded border border-border bg-surface px-3 py-2 font-mono text-sm break-all">
            {USER_AGENT}
          </p>

          <h2 className="ct-heading mt-8">O que fazemos</h2>
          <p className="mt-3 text-muted">
            O Coreto reúne a programação cultural de uma região — a que está dispersa pelos sítios
            municipais, pelos equipamentos e pelas coletividades — numa agenda só, com o nome da
            fonte e uma ligação de volta à página de origem em cada evento. Uma vez por dia lemos a
            página da agenda de cada fonte — o endereço, ou os poucos endereços de listagem, que
            estão escritos na configuração dessa fonte, nunca descobertos por varrimento — e
            seguimos a ligação de cada evento para a ficha dele, que é onde estão a data, a hora e o
            local. Mais nada: não percorremos o resto do sítio, não adivinhamos endereços, não
            procuramos ficheiros. As imagens não são copiadas — continuam a ser servidas por si.
          </p>

          <h2 className="ct-heading mt-8">Com que ritmo</h2>
          <p className="mt-3 text-muted">
            Um pedido de cada vez por servidor, com pelo menos um segundo entre pedidos — e a conta
            é por máquina, não por endereço, porque vários sítios costumam partilhar o mesmo
            servidor. Se o seu <code>robots.txt</code> pedir mais tempo, é esse que vale. Uma fonte
            que falhe {FALHAS_ATE_PAUSA} noites seguidas fica em pausa {HORAS_EM_PAUSA} horas antes
            de voltarmos a tentar.
          </p>

          <h2 className="ct-heading mt-8">
            Lemos o seu <code>robots.txt</code>, e obedecemos-lhe
          </h2>
          <p className="mt-3 text-muted">
            Antes de pedir qualquer página perguntamos ao ficheiro do seu servidor se podemos, uma
            vez por dia e por servidor. O que ele proibir não é pedido. Se escrever um bloco{' '}
            <code>User-agent: Coreto</code>, é esse que vale — e vale sozinho, mesmo que seja mais
            largo do que o que escreveu para toda a gente. Se o ficheiro não existir, lemos a
            agenda: não haver ficheiro é não haver regras. Se o seu servidor não conseguir responder
            com ele, <strong className="text-ink">não lemos nada</strong> e a falha fica registada
            do nosso lado.
          </p>

          <h2 className="ct-heading mt-8">Se quiser que abrandemos, ou que paremos</h2>
          <p className="mt-3 text-muted">
            Escreva para{' '}
            <a
              href={`mailto:${PRODUTO.email}?subject=${encodeURIComponent('Recolha do Coreto')}`}
              className="underline underline-offset-4"
            >
              {PRODUTO.email}
            </a>{' '}
            e diga o domínio: desligamos a fonte no mesmo dia, ou espaçamos a leitura para o ritmo
            que lhe servir. Não é preciso justificar.
          </p>

          <h2 className="ct-heading mt-8">Se já nos bloqueou</h2>
          <p className="mt-3 text-muted">
            Fica bloqueado. Não trocamos de agente, não usamos intermediários e não voltamos a bater
            de outra morada para contornar a regra — contornar um controlo de acesso não é recolha.
            Se o bloqueio foi para travar um robô a mais e não a nós, basta dizer-nos.
          </p>

          <h2 className="ct-heading mt-8">Que fontes lemos, e em que estado estão</h2>
          <p className="mt-3 text-muted">
            Isso é de cada região, e está na página <code>/fontes</code> da agenda dela — a lista
            das fontes lidas, a última leitura de cada uma, as que estão desligadas e porquê. Se
            chegou aqui por um registo, o domínio da agenda que lhe bateu à porta é o que a ligação
            de volta em cada evento aponta.
          </p>
        </article>
      </main>
    </div>
  );
}
