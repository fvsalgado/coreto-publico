import Link from 'next/link';
import type { Metadata } from 'next';
import { BandstandMark } from '@/src/components/BandstandMark';
import { headers } from 'next/headers';
import { escolherRegiao, sair } from '@/src/lib/admin/acoes-das-contas';
import { ambitoDoPainel, TODAS, type Ambito } from '@/src/lib/admin/ambito';
import { currentAdmin } from '@/src/lib/admin/auth';
import { ADMIN_PATH_HEADER, barreiraDoLayout } from '@/src/lib/admin/guarda';
import { regioesComPapel, type Sessao } from '@/src/lib/admin/papeis';
import { hasServiceRole } from '@/src/lib/env';
import { redirect } from 'next/navigation';

/** Nada do backoffice pode ser servido de cache. */
export const dynamic = 'force-dynamic';

/*
 * O título do separador diz a página e depois a área — «Fila de moderação ·
 * Painel · Coreto». Treze páginas com o mesmo título eram treze separadores
 * iguais para quem tem três abertos, e um só nome para quem navega por
 * títulos com um leitor de ecrã (WCAG 2.4.2). Cada página declara o seu.
 *
 * A área chama-se «Painel», e não «Administração», como no Paragem.pt (C4-026):
 * os dois produtos vendem-se às mesmas entidades, e quem modera os dois não
 * tem de aprender duas palavras para a mesma coisa. A primeira entrada da
 * barra passou a «Início», que «Painel» já é o nome da área.
 */
export const metadata: Metadata = {
  title: { default: 'Painel · Coreto', template: '%s · Painel · Coreto' },
  robots: { index: false, follow: false },
};

interface EntradaDaBarra {
  href: string;
  label: string;
  /** Uma das quatro de todos os dias, à vista também no telemóvel. */
  diaria?: boolean;
}

/**
 * A barra, pelo que a sessão pode (C4-015).
 *
 * Quem modera vê o que modera; quem gere uma região vê também as definições
 * e o relatório dela; o dono vê o resto — as regiões, as pessoas, a
 * auditoria. Esconder da barra não é a guarda (cada página e cada ação voltam
 * a verificar): é não oferecer a ninguém uma porta que não abre.
 */
function barraPara(sessao: Sessao, regiaoDoGestor: string | null): EntradaDaBarra[] {
  const gestor = sessao.tipo === 'dono' || regioesComPapel(sessao, 'gestor').length > 0;
  const entradas: Array<EntradaDaBarra | false> = [
    { href: '/admin', label: 'Início' },
    { href: '/admin/fila', label: 'Fila', diaria: true },
    { href: '/admin/eventos', label: 'Eventos', diaria: true },
    { href: '/admin/fontes', label: 'Fontes', diaria: true },
    gestor && { href: '/admin/relatorios', label: 'Relatórios', diaria: true },
    { href: '/admin/espacos', label: 'Espaços' },
    { href: '/admin/etiquetas', label: 'Etiquetas' },
    { href: '/admin/cartazes', label: 'Cartazes' },
    { href: '/admin/qualidade', label: 'Qualidade' },
    { href: '/admin/estatisticas', label: 'Estatísticas' },
    sessao.tipo !== 'dono' &&
      regiaoDoGestor !== null && {
        href: `/admin/regioes/${encodeURIComponent(regiaoDoGestor)}`,
        label: 'Definições da região',
      },
    sessao.tipo === 'dono' && { href: '/admin/regioes', label: 'Regiões' },
    sessao.tipo === 'dono' && { href: '/admin/pessoas', label: 'Pessoas' },
    sessao.tipo === 'dono' && { href: '/admin/auditoria', label: 'Auditoria' },
    // O que o papel de quem entra abre, e como se modera (C4-025). A todos:
    // é a única página que serve a uma conta ainda sem região.
    { href: '/admin/ajuda', label: 'Ajuda' },
  ];
  return entradas.filter((entrada): entrada is EntradaDaBarra => Boolean(entrada));
}

/**
 * A ligação da barra que corresponde à página aberta — ou a uma ficha debaixo
 * dela: em `/admin/fila/…` é a Fila que está aberta. O Início só é o Início,
 * porque todas as outras também começam por `/admin`.
 */
function estaAberta(caminho: string | null, href: string): boolean {
  if (!caminho) return false;
  if (href === '/admin') return caminho === '/admin';
  return caminho === href || caminho.startsWith(`${href}/`);
}

function Ligacao({ entrada, caminho }: { entrada: EntradaDaBarra; caminho: string | null }) {
  const aberta = estaAberta(caminho, entrada.href);
  return (
    <Link
      href={entrada.href}
      aria-current={aberta ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center underline-offset-4 hover:underline ${
        aberta ? 'font-semibold underline' : ''
      }`}
    >
      {entrada.label}
    </Link>
  );
}

/**
 * O seletor de região do cabeçalho: só aparece a quem vê mais do que uma.
 *
 * Um formulário e um botão, sem JavaScript, como o resto do painel: escolher
 * guarda a região num cookie e volta à mesma página, recortada pela região
 * nova. «Todas» existe — para quem tem mais de uma —, mas não é a omissão.
 */
function SeletorDeRegiao({ ambito, caminho }: { ambito: Ambito; caminho: string | null }) {
  if (ambito.disponiveis.length < 2) return null;
  return (
    <form action={escolherRegiao} className="flex items-center gap-2 text-sm">
      <input type="hidden" name="voltar" value={caminho ?? '/admin'} />
      <label htmlFor="regiao-do-painel" className="font-medium">
        Região
      </label>
      <select
        id="regiao-do-painel"
        name="regiao"
        defaultValue={ambito.escolhida?.id ?? TODAS}
        className="min-h-11 max-w-48 rounded border border-field bg-surface px-2 text-sm text-ink"
      >
        {ambito.disponiveis.map((regiao) => (
          <option key={regiao.id} value={regiao.id}>
            {regiao.name}
          </option>
        ))}
        <option value={TODAS}>
          {ambito.sessao.tipo === 'dono' ? 'Todas as regiões' : 'Todas as minhas regiões'}
        </option>
      </select>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded border border-field px-3 text-sm font-medium"
      >
        Mudar
      </button>
    </form>
  );
}

/**
 * O layout é a segunda barreira das leituras do painel, e o sítio onde ela
 * cabe uma vez só.
 *
 * As escritas sempre se defenderam sozinhas: cada ação de moderação volta a
 * pedir a sessão e, desde as contas por pessoa, o papel na região daquilo em
 * que mexe. As leituras não — treze páginas, nenhuma a pedir sessão, todas a
 * confiar em quem estava à porta. Pô-la em cada uma seria treze sítios por
 * onde a próxima página se pode esquecer; aqui é o caminho por onde todas
 * passam.
 *
 * A sessão relê-se com `currentAdmin()` e não com o que o middleware decidiu,
 * de propósito: são verificações independentes, e é assim que uma apanha o
 * que a outra deixar passar. A de uma pessoa, em particular, só aqui se
 * confere inteira — o middleware vê a assinatura da porta, e é aqui que se lê
 * a pessoa da base e se confere a assinatura feita com a palavra-passe dela.
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

  const sessao = gate.ok ? gate.sessao : null;
  const ambito = sessao && hasServiceRole ? await ambitoDoPainel() : null;
  // As definições que a barra oferece a um gestor são as da região escolhida,
  // se ele a gere; senão, as da primeira que gere.
  const geridas = sessao?.tipo === 'pessoa' ? regioesComPapel(sessao, 'gestor') : [];
  const listaDeGeridas = geridas === 'todas' ? [] : geridas;
  const escolhida = ambito?.escolhida?.id;
  const gestorDe =
    escolhida && listaDeGeridas.includes(escolhida) ? escolhida : (listaDeGeridas[0] ?? null);
  const barra = sessao ? barraPara(sessao, gestorDe) : [];
  const diarias = barra.filter((item) => item.diaria);
  const outras = barra.filter((item) => !item.diaria);

  /*
   * O esqueleto do painel: o elo de salto, a barra e o `main` onde cada
   * página desagua.
   *
   * O layout de raiz dá o documento e mais nada — o cabeçalho, as margens e
   * o `<main>` são do layout da região, por onde a área interna não passa.
   * A largura é um degrau acima da agenda pública, porque as tabelas do
   * painel são mais largas do que qualquer página pública.
   */
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Saltar para o conteúdo
      </a>

      {sessao ? (
        <header className="ct-sem-impressao border-b border-border">
          {/* `ct-sem-impressao`: o relatório mensal imprime-se sem a barra. */}
          <div className="ct-goteira mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 py-1">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <BandstandMark className="size-5" />
              Coreto · Painel
            </p>
            <p className="text-sm text-muted">
              {sessao.tipo === 'dono'
                ? 'Entraste com a chave de quem opera o Coreto'
                : `Entraste como ${sessao.pessoa.nome}`}
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-x-4">
              {ambito ? <SeletorDeRegiao ambito={ambito} caminho={caminho} /> : null}
              <form action={sair}>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                >
                  Sair
                </button>
              </form>
            </div>
            {/*
              No telemóvel ficam à vista as quatro de todos os dias, e o resto
              recolhe-se num «Mais» (C4-019): eram doze ligações em três linhas
              no topo de todas as páginas, antes de qualquer conteúdo. A partir
              do tablet é uma linha só, com todas. A ordem do DOM é a mesma nas
              duas, e só uma delas existe para quem lê o ecrã de cada vez.
            */}
            <nav aria-label="Painel" className="basis-full text-sm">
              <ul className="hidden flex-wrap gap-x-4 sm:flex">
                {barra.map((item) => (
                  <li key={item.href}>
                    <Ligacao entrada={item} caminho={caminho} />
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-start gap-x-4 sm:hidden">
                <ul className="flex flex-wrap gap-x-4">
                  {diarias.map((item) => (
                    <li key={item.href}>
                      <Ligacao entrada={item} caminho={caminho} />
                    </li>
                  ))}
                </ul>
                {outras.length > 0 ? (
                  <details className="group">
                    <summary className="inline-flex min-h-11 cursor-pointer items-center underline underline-offset-4">
                      Mais
                    </summary>
                    <ul className="pb-2">
                      {outras.map((item) => (
                        <li key={item.href}>
                          <Ligacao entrada={item} caminho={caminho} />
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </nav>
          </div>
        </header>
      ) : null}

      <main id="conteudo" className="ct-goteira mx-auto w-full max-w-6xl flex-1 py-8 sm:py-10">
        {children}
      </main>
    </>
  );
}
