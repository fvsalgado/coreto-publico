import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';

/**
 * A página que aparece quando não há página, dentro de uma região.
 *
 * É de propósito que não vai à base de dados buscar nada: esta é a página
 * servida quando alguma coisa correu mal, e uma página de erro que depende do
 * que pode ter falhado não é uma página de erro. Rende dentro do layout da
 * região — o toldo e o rodapé ficam de pé —, mas o Next não lhe dá parâmetros,
 * e por isso não nomeia a região nem lista concelhos: a grelha dos onze que
 * aqui viveu era uma lista regional numa página que não pode ler nenhuma.
 * Os atalhos são caminhos relativos, que valem em qualquer domínio.
 */

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
  return (
    <>
      <PageHeader
        title="Esta página não existe"
        lead="Pode ter sido um evento que já saiu da agenda, um endereço mal copiado ou uma ligação nossa que ficou para trás. Nenhuma dessas é culpa de quem chegou aqui."
      />

      <nav aria-labelledby="atalhos" className="mt-8">
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
