import type { Metadata } from 'next';
import Link from 'next/link';
import { todayInLisbon } from '@coreto/core';
import { CaixaDePesquisa } from '@/src/components/CaixaDePesquisa';
import { FilaDePilulas } from '@/src/components/FilaDePilulas';
import { PageHeader } from '@/src/components/PageHeader';
import { ATALHOS, DEFAULTS, buildHref } from '@/src/lib/agenda';

/**
 * A página que aparece quando não há página, dentro de uma região.
 *
 * É de propósito que não vai à base de dados buscar nada: esta é a página
 * servida quando alguma coisa correu mal, e uma página de erro que depende do
 * que pode ter falhado não é uma página de erro. Rende dentro do layout da
 * região — o toldo, a barra de baixo e o rodapé ficam de pé, também para os
 * endereços que não correspondem a rota nenhuma (ver `[...resto]/page.tsx`) —,
 * mas o Next não lhe dá parâmetros, e por isso não nomeia a região nem lista
 * concelhos. Os atalhos são caminhos relativos, que valem em qualquer domínio.
 *
 * **O que se oferece é o que trazia a pessoa até aqui** (C1-023). Quem aterra
 * numa ficha que saiu da agenda vinha à procura de programação: a pesquisa e
 * os três recortes de tempo respondem a isso antes de qualquer pedido de
 * desculpa. Os recortes saem da mesma lista e do mesmo `buildHref` da agenda,
 * byte a byte, com o dia de hoje — e não pedem nada à base, que é a regra
 * desta página.
 */

/*
 * Sem `robots`: o Next já carimba `noindex` numa resposta 404, e um segundo
 * `<meta name="robots">` era a mesma coisa dita duas vezes, com o risco de um
 * dia as duas divergirem.
 */
export const metadata: Metadata = {
  title: 'Página não encontrada',
  description:
    'Este endereço não corresponde a nenhuma página da agenda. A pesquisa, os eventos de hoje, do fim de semana e dos próximos sete dias, e os atalhos para o resto do sítio.',
};

/*
 * Quatro destinos que existem sempre.
 *
 * Os coretos estavam aqui e saíram: são hoje uma secção que se desliga no
 * painel, e esta página não vai à base de dados saber se está ligada — nem
 * deve, pela razão acima. Uma página de erro que oferece um caminho para
 * outro erro é a pior versão de si própria, por isso oferece só o que não
 * depende de interruptor nenhum.
 */
const SHORTCUTS = [
  { href: '/agenda', label: 'A agenda completa' },
  { href: '/mapa', label: 'O mapa da região' },
  { href: '/espacos', label: 'Espaços e coletividades' },
  { href: '/submeter', label: 'Enviar um evento' },
];

export default function NotFound() {
  const hoje = todayInLisbon();
  const quando = ATALHOS.map((atalho) => ({
    chave: atalho.id,
    rotulo: atalho.rotulo,
    href: buildHref({ ...DEFAULTS, ...atalho.janela(hoje) }, 1),
    activa: false,
  }));

  return (
    <>
      <PageHeader
        title="Esta página não existe"
        lead="Pode ter sido um evento que já saiu da agenda, um endereço mal copiado ou uma ligação nossa que ficou para trás. A programação continua aqui:"
      >
        <CaixaDePesquisa className="mt-5 max-w-xl" />
        <FilaDePilulas
          nome="Atalhos de data"
          rotulo="Quando"
          destaque
          className="mt-4"
          pilulas={quando}
        />
      </PageHeader>

      <nav aria-labelledby="atalhos" className="mt-10">
        <h2 id="atalhos" className="ct-heading">
          Por onde continuar
        </h2>
        <ul className="mt-4 flex flex-wrap gap-3">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.href}>
              <Link
                href={shortcut.href}
                className="inline-flex min-h-11 items-center rounded border border-border bg-surface px-4 text-sm underline-offset-4 hover:underline"
              >
                {shortcut.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="mt-10 text-muted">
        Se chegou aqui a partir de uma ligação nossa,{' '}
        <Link href="/submeter" className="underline underline-offset-4">
          diga-nos onde estava
        </Link>{' '}
        — é assim que se corrige.
      </p>
    </>
  );
}
