import Link from 'next/link';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { currentAdmin } from '@/src/lib/admin/auth';
import { endSession } from '@/src/lib/admin/auth';
import { ADMIN_PATH_HEADER, barreiraDoLayout } from '@/src/lib/admin/guarda';
import { redirect } from 'next/navigation';

/** Nada do backoffice pode ser servido de cache. */
export const dynamic = 'force-dynamic';

/*
 * O título do separador diz a página e depois a área — «Fila de moderação ·
 * Administração». Treze páginas com o mesmo título eram treze separadores
 * iguais para quem tem três abertos, e um só nome para quem navega por
 * títulos com um leitor de ecrã (WCAG 2.4.2). Cada página declara o seu.
 */
export const metadata: Metadata = {
  title: { default: 'Administração', template: '%s · Administração' },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: '/admin', label: 'Painel' },
  { href: '/admin/fila', label: 'Fila' },
  { href: '/admin/eventos', label: 'Eventos' },
  { href: '/admin/estatisticas', label: 'Estatísticas' },
  { href: '/admin/relatorios', label: 'Relatórios' },
  { href: '/admin/fontes', label: 'Fontes' },
  { href: '/admin/etiquetas', label: 'Etiquetas' },
  { href: '/admin/espacos', label: 'Espaços' },
  { href: '/admin/cartazes', label: 'Cartazes' },
  { href: '/admin/qualidade', label: 'Qualidade' },
  { href: '/admin/regioes', label: 'Regiões' },
  { href: '/admin/auditoria', label: 'Auditoria' },
];

async function sair(): Promise<void> {
  'use server';
  await endSession();
  redirect('/admin/entrar');
}

/**
 * A ligação da barra que corresponde à página aberta — ou a uma ficha debaixo
 * dela: em `/admin/fila/…` é a Fila que está aberta. O Painel só é o Painel,
 * porque todas as outras também começam por `/admin`.
 */
function estaAberta(caminho: string | null, href: string): boolean {
  if (!caminho) return false;
  if (href === '/admin') return caminho === '/admin';
  return caminho === href || caminho.startsWith(`${href}/`);
}

/**
 * O layout é a segunda barreira das leituras do painel, e o sítio onde ela
 * cabe uma vez só.
 *
 * As escritas sempre se defenderam sozinhas: cada ação de moderação chama
 * `requireAdmin()`. As leituras não — treze páginas, nenhuma a pedir sessão,
 * todas a confiar em quem estava à porta. Pô-la em cada uma seria treze
 * sítios por onde a próxima página se pode esquecer; aqui é o caminho por
 * onde todas passam.
 *
 * A sessão relê-se com `currentAdmin()` e não com o que o middleware decidiu,
 * de propósito: são verificações independentes, e é assim que uma apanha o
 * que a outra deixar passar. Já apanha uma divergência real — o middleware lê
 * o segredo em bruto de `process.env`, e um segredo curto de mais que ele
 * aceitasse não passa pelo `env.ts`, logo não passa aqui.
 *
 * A `barreiraDoLayout` explica quando é que se barra e porque é que o
 * cabeçalho é preciso para isso; a versão curta: sem ele, o layout
 * redirecionava a página de entrada — que também envolve — para si própria.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const gate = await currentAdmin();
  const caminho = (await headers()).get(ADMIN_PATH_HEADER);
  const entrada = barreiraDoLayout(gate.ok, caminho);
  if (entrada) redirect(entrada);

  /*
   * O esqueleto do painel: o elo de salto, a barra e o `main` onde cada
   * página desagua.
   *
   * O layout de raiz dá o documento e mais nada — o toldo, a goteira e o
   * `<main>` são do layout da região, por onde a área interna não passa.
   * Desde que a agenda ganhou regiões, o painel era um `<div>` nu: encostado
   * à borda do ecrã e sem um marco que fosse — nem `main` para o elo de salto
   * aterrar, nem região para um leitor de ecrã saltar por cima da barra. A
   * goteira e o ritmo vertical são os da agenda pública; a largura é um degrau
   * acima, porque as tabelas do painel são mais largas do que qualquer
   * página pública.
   */
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Saltar para o conteúdo
      </a>

      {gate.ok ? (
        <header className="ct-sem-impressao border-b border-border">
          {/* `ct-sem-impressao`: o relatório mensal imprime-se sem a barra. */}
          <div className="ct-goteira mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 py-1">
            <p className="text-sm font-semibold">Administração</p>
            {/*
              No telemóvel a barra desce para a linha de baixo, à largura
              toda, e o «Sair» fica ao lado do nome; a partir do tablet é uma
              linha só. Muda a ordem visual e não a do DOM: o teclado percorre
              sempre a navegação antes do «Sair».
            */}
            <nav
              aria-label="Administração"
              className="order-last basis-full sm:order-none sm:flex-1 sm:basis-auto"
            >
              <ul className="flex flex-wrap gap-x-4 text-sm">
                {NAV.map((item) => {
                  const aberta = estaAberta(caminho, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={aberta ? 'page' : undefined}
                        className={`inline-flex min-h-11 items-center underline-offset-4 hover:underline ${
                          aberta ? 'font-semibold underline' : ''
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <form action={sair} className="ml-auto">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
              >
                Sair
              </button>
            </form>
          </div>
        </header>
      ) : null}

      <main id="conteudo" className="ct-goteira mx-auto w-full max-w-6xl flex-1 py-8 sm:py-10">
        {children}
      </main>
    </>
  );
}
