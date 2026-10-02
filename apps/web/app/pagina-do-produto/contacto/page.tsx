import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { AnalyticsProvider } from '@/src/components/AnalyticsProvider';
import { BandstandMark } from '@/src/components/BandstandMark';
import { PageHeader } from '@/src/components/PageHeader';
import { REGIAO_DA_FICHA } from '@/src/lib/analytics/posthog';
import { CORES_DO_TOLDO } from '@/src/lib/marca';
import { AUTOR, CONTACTO, PRODUTO, correioPara } from '@/src/lib/produto';
import { ORIGEM_DA_MONTRA } from '../montra';

/**
 * Com quem se fala — a página que faltava a quem já está convencido (C4-002).
 *
 * A página do produto tinha um gesto só, «Falar connosco», que abria o
 * programa de correio: numa câmara, muitas vezes, não abre nada, ou abre um
 * Outlook por configurar. Aqui o endereço está **escrito**, e seleciona-se de
 * um toque; os dois botões abrem o correio com o assunto já posto, para quem
 * o tiver. É a mesma página do Paragem.pt, que é da mesma casa e responde às
 * mesmas entidades (C4-026).
 *
 * Sem formulário, de propósito: um formulário guardava o que se escreve num
 * sítio nosso, e isso é um tratamento de dados que a casa não precisa de
 * fazer para responder a um email. O endereço vem de `lib/produto.ts`
 * (`NEXT_PUBLIC_CORETO_CONTACTO`, com a omissão no que já é público).
 */

export const metadata: Metadata = {
  title: `Falar connosco — ${PRODUTO.nome}`,
  description:
    'Marcar uma demonstração, pedir uma proposta ou perguntar o que for sobre o Coreto, a agenda cultural do seu território.',
  alternates: { canonical: `${ORIGEM_DA_MONTRA}/contacto` },
};

export const dynamic = 'error';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: CORES_DO_TOLDO.montra },
    { media: '(prefers-color-scheme: dark)', color: CORES_DO_TOLDO.montra },
  ],
};

export default function PaginaDoContacto() {
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
            title="Falar connosco"
            eyebrow="O produto"
            lead="Para marcar uma demonstração, pedir uma proposta ou perguntar o que for sobre o Coreto, escreva para:"
          />

          <p className="mt-4 font-display text-2xl font-semibold [overflow-wrap:anywhere] select-all">
            {CONTACTO}
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            <li>
              <a
                href={correioPara(`Marcar uma demonstração do ${PRODUTO.nome}`)}
                className="inline-flex min-h-11 items-center rounded-full border border-accent bg-accent px-5 text-sm font-medium text-on-accent underline-offset-4 hover:underline"
              >
                Marcar uma demonstração
              </a>
            </li>
            <li>
              <a
                href={correioPara(`Pedido de proposta do ${PRODUTO.nome}`)}
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-medium underline-offset-4 hover:border-accent hover:underline"
              >
                Pedir proposta
              </a>
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted">
            Os dois botões abrem o seu programa de correio com o assunto já escrito. Se não abrirem
            nada, copie o endereço acima.
          </p>

          <h2 className="ct-heading mt-10">O que ajuda a responder</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
            <li>o território: o município, a comunidade intermunicipal ou a associação;</li>
            <li>
              o que já está publicado — a agenda do sítio da câmara, a do teatro, a da biblioteca, a
              das juntas de freguesia;
            </li>
            <li>quem, na entidade, vai acompanhar a entrada e moderar os eventos;</li>
            <li>se a agenda vai viver num domínio seu ou num subdomínio do produto.</li>
          </ul>
          <p className="mt-3 text-muted">
            Não é preciso ter tudo isto à mão para escrever: a primeira conversa serve para o ver.
          </p>

          <h2 className="ct-heading mt-10">Quem responde</h2>
          <p className="mt-3 text-muted">
            {AUTOR.nome}, que desenha e desenvolve o {PRODUTO.nome}.
          </p>

          <h2 className="ct-heading mt-10">Uma falha de segurança</h2>
          <p className="mt-3 text-muted">
            Comunica-se em privado, como diz a{' '}
            <Link href="/seguranca" className="underline underline-offset-4">
              política de segurança
            </Link>
            , e não por um pedido público.
          </p>

          <p className="mt-10 text-sm">
            <Link href="/" className="underline underline-offset-4">
              Voltar à página do {PRODUTO.nome}
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}
