'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BandstandMark } from '@/src/components/BandstandMark';
import {
  caminhoPublico,
  BARRA,
  MAIS,
  comEmailDaRegiao,
  estaEm,
  estaEmMais,
  semAsDesligadas,
  type IconeDeAtalho,
  type SeccaoOpcional,
} from '@/src/lib/navegacao';

const traco = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** Um ícone por destino, no traço da casa: 24×24, sem preenchimento. */
const ICONES: Record<string, (props: { className: string }) => React.ReactElement> = {
  '/': ({ className }) => <BandstandMark className={className} />,

  '/agenda': ({ className }) => (
    <svg {...traco} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M7.5 14h1.5M11.25 14h1.5M15 14h1.5M7.5 17.5h1.5M11.25 17.5h1.5" />
    </svg>
  ),

  // Um mapa dobrado. Desenhado quando o destino se chamava «Concelhos» e
  // ficou-lhe melhor depois de passar a chamar-se «Mapa».
  '/mapa': ({ className }) => (
    <svg {...traco} className={className}>
      <path d="M9 4 3 6.4v13.4L9 17.4l6 2.4 6-2.4V4l-6 2.4z" />
      <path d="M9 4v13.4M15 6.4v13.4" />
    </svg>
  ),

  '/espacos': ({ className }) => (
    <svg {...traco} className={className}>
      <path d="M3.5 21h17" />
      <path d="M5.5 21V5.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1V21" />
      <path d="M8.75 8.5h1.5M13.75 8.5h1.5M8.75 12.5h1.5M13.75 12.5h1.5" />
      <path d="M10 21v-3.75a2 2 0 0 1 4 0V21" />
    </svg>
  ),
};

/**
 * Um ícone por entrada da gaveta, no mesmo traço.
 *
 * `Record<AtalhoHref, …>` e não `Record<string, …>`: faltar aqui uma entrada
 * passa a ser um erro de compilação, e não uma linha da gaveta que aparece
 * sem desenho e ninguém repara.
 */
const ICONES_MAIS: Record<IconeDeAtalho, (props: { className: string }) => React.ReactElement> = {
  // O octógono é a planta de um coreto — a marca vista de cima, a par da
  // marca vista de frente que abre a barra.
  coreto: ({ className }) => (
    <svg {...traco} className={className}>
      <path d="M8.7 3h6.6L21 8.7v6.6L15.3 21H8.7L3 15.3V8.7z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  ),

  submeter: ({ className }) => (
    <svg {...traco} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.8 6.5 7.1 5.3a2 2 0 0 0 2.2 0l7.1-5.3" />
    </svg>
  ),

  // Um ciclo é uma coisa que volta: a seta fecha a volta, e os dois pontos
  // são as edições que já lá passaram.
  ciclo: ({ className }) => (
    <svg {...traco} className={className}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M17.5 3v3.6h-3.6" />
      <circle cx="12" cy="12" r="1.4" />
    </svg>
  ),

  fontes: ({ className }) => (
    <svg {...traco} className={className}>
      <path d="M5 20a1 1 0 0 1 0-16h9.5a1 1 0 0 1 0 6H9a1 1 0 0 0 0 6h10" />
      <path d="m16 17 3 2-3 2" />
    </svg>
  ),

  widget: ({ className }) => (
    <svg {...traco} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18" />
      <path d="M7 13h5M7 16h8" />
    </svg>
  ),

  informacoes: ({ className }) => (
    <svg {...traco} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6h.01" />
    </svg>
  ),

  // Um avião de papel, e não a seta de descarregar que aqui esteve: a seta
  // para baixo diz «guardar isto», e o que este atalho faz é o contrário.
  email: ({ className }) => (
    <svg {...traco} className={className}>
      <path d="M21.4 2.6 2.9 9.9a.7.7 0 0 0 .06 1.32L10 13.4l2.18 7.04a.7.7 0 0 0 1.32.06z" />
      <path d="M21.4 2.6 10 13.4" />
    </svg>
  ),
};

/**
 * A barra de baixo, só no telemóvel.
 *
 * O cabeçalho desta casa foi desenhado para um ecrã largo: num telemóvel a
 * navegação partia-se em três linhas e comia trezentos dos oitocentos e
 * quarenta pixéis do primeiro ecrã — um terço da montra gasto a dizer o nome
 * da montra. Os destinos passam para baixo, onde o polegar chega sem a mão
 * mudar de posição, e o cabeçalho fica com o nome, o botão de enviar e o
 * tema.
 *
 * Ícone **e** rótulo, sempre: um ícone sozinho obriga a adivinhar.
 *
 * O quinto lugar é um «+» que abre uma gaveta. A barra tem cinco lugares e a
 * casa tem mais páginas do que isso; com cinco destinos fixos, o widget, o
 * envio, as fontes e as informações só existiam no rodapé, ao fim de uma
 * página inteira de deslocamento. Trocar um destino por seis é o melhor
 * negócio que este lugar permite.
 *
 * A gaveta é um `<details>` e não um menu montado à mão: abre e fecha sem
 * JavaScript, o teclado já sabe usá-la e os leitores de ecrã já sabem
 * anunciá-la. O que o JavaScript acrescenta são as três cortesias que o
 * elemento não traz — fechar com Escape, fechar ao tocar fora e fechar ao
 * mudar de página.
 *
 * A barra é opaca e não desaparece ao deslizar. Uma barra que se esconde
 * devolve uns pixéis e tira a referência — e numa agenda que se percorre aos
 * dedos, ter sempre para onde voltar vale mais do que esses pixéis.
 */
export function BarraInferior({
  desligadas,
  email,
  regiao,
}: {
  desligadas: readonly SeccaoOpcional[];
  email: string;
  /** O identificador da região, para tirar o segmento interno do caminho. */
  regiao: string;
}) {
  const pathname = caminhoPublico(usePathname() ?? '/', regiao);
  /*
   * As secções desligadas no painel — e o email da região — chegam do layout
   * de raiz, que os leu da base. Este componente é de cliente e não pode ler
   * nada: passar tudo como propriedade é o que mantém a gaveta a dizer o
   * mesmo que o cabeçalho e o rodapé, que leram da mesma vez.
   */
  const gavetaVisivel = comEmailDaRegiao(semAsDesligadas(MAIS, desligadas), email);
  const [aberta, setAberta] = useState(false);
  const gaveta = useRef<HTMLDetailsElement>(null);

  /*
   * Mudar de página fecha a gaveta. Sem isto, quem toca num atalho continua
   * com a gaveta aberta por cima da página que pediu.
   *
   * Ajustado durante a renderização e não num efeito: um `setState` dentro de
   * um efeito só corre depois de o browser pintar, e o que se via era a
   * página nova com a gaveta ainda aberta por um instante. Guardar o caminho
   * anterior em estado e compará-lo aqui é o padrão que a documentação do
   * React indica para repor estado quando uma entrada muda — o segundo
   * render acontece antes de haver pintura nenhuma.
   */
  const [caminhoAnterior, setCaminhoAnterior] = useState(pathname);
  if (caminhoAnterior !== pathname) {
    setCaminhoAnterior(pathname);
    setAberta(false);
  }

  useEffect(() => {
    if (!aberta) return;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setAberta(false);
        // O foco volta ao botão que a abriu: quem navega por teclado não
        // pode ficar com o foco num sítio que deixou de existir.
        gaveta.current?.querySelector('summary')?.focus();
      }
    };
    const aoTocar = (evento: PointerEvent) => {
      if (!gaveta.current?.contains(evento.target as Node)) setAberta(false);
    };

    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('pointerdown', aoTocar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoTocar);
    };
  }, [aberta]);

  const naGaveta = estaEmMais(pathname);

  return (
    <nav
      aria-label="Principal"
      /*
       * `pb-[env(safe-area-inset-bottom)]`: no iPhone a faixa do indicador de
       * início fica por baixo da barra, e sem esta almofada os rótulos ficam
       * debaixo dela. O `viewportFit: 'cover'` do layout é o que dá valor a
       * este `env()` — sem ele responde sempre zero.
       */
      className="ct-bloco-escuro fixed inset-x-0 bottom-0 z-40 bg-accent-deep pb-[env(safe-area-inset-bottom)] text-white sm:hidden"
    >
      {/*
       * O véu por cima da página, para a gaveta se ler como uma camada e não
       * como parte do texto que está por trás. Vive fora do `<details>` de
       * propósito: enquanto fechado, o conteúdo de um `<details>` tem
       * contenção de pintura, e um `position: fixed` lá dentro deixaria de
       * se medir pelo ecrã. Sem JavaScript não há véu — e a gaveta abre na
       * mesma, que é o que interessa.
       */}
      {aberta ? (
        <div
          aria-hidden="true"
          className="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] bg-ink/45"
        />
      ) : null}

      <ul className="flex items-stretch">
        {BARRA.map((destino) => {
          const activo = estaEm(pathname, destino);
          const Icone = ICONES[destino.href];
          if (!Icone) return null;

          return (
            <li key={destino.href} className="flex-1">
              <Link
                href={destino.href}
                aria-current={activo ? 'page' : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 px-0.5 ${
                  activo ? 'text-white' : 'text-on-deep-muted'
                }`}
              >
                <span
                  className={`ct-octagon grid size-7 place-items-center ${
                    activo ? 'bg-white/18' : 'bg-transparent'
                  }`}
                >
                  <Icone className="size-5" />
                </span>
                <span className="text-[0.6875rem] leading-none font-medium">{destino.label}</span>
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <details
            ref={gaveta}
            open={aberta}
            onToggle={(evento) => setAberta(evento.currentTarget.open)}
          >
            <summary
              className={`ct-sem-marca flex h-14 cursor-pointer flex-col items-center justify-center gap-1 px-0.5 ${
                aberta || naGaveta ? 'text-white' : 'text-on-deep-muted'
              }`}
            >
              <span
                className={`ct-octagon grid size-7 place-items-center ${
                  aberta || naGaveta ? 'bg-white/18' : 'bg-transparent'
                }`}
              >
                <svg
                  {...traco}
                  className={`ct-cruz size-5 ${aberta ? 'rotate-45' : ''}`}
                  strokeWidth={2}
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="text-[0.6875rem] leading-none font-medium">Mais</span>
            </summary>

            {/*
             * `absolute` e não `fixed`: o ascendente posicionado mais
             * próximo é a própria barra, e `bottom-full` põe a gaveta a
             * assentar em cima dela. Um `fixed` aqui dentro dependia de o
             * navegador não aplicar contenção ao conteúdo do `<details>`, e
             * isso muda de navegador para navegador.
             */}
            <ul className="absolute inset-x-2 bottom-full mb-2 max-h-[70dvh] overflow-y-auto rounded-xl border border-border bg-surface p-1.5 text-ink shadow-2xl">
              {gavetaVisivel.map((atalho) => {
                const Icone = ICONES_MAIS[atalho.icone];
                // Os prefixos contam. `/ciclos` é a lista e `/ciclo/caminhos`
                // é um deles — nomes diferentes por serem coisas diferentes —,
                // e sem isto a linha da gaveta ficava apagada numa página que
                // veio dela. É a mesma conta que `estaEmMais` faz para acender
                // o «+»; fazê-la de duas maneiras era garantir que um dia
                // divergiam.
                const casa = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
                const activo =
                  !atalho.externo && (casa(atalho.href) || (atalho.prefixos ?? []).some(casa));

                return (
                  <li key={atalho.href}>
                    <Link
                      href={atalho.href}
                      aria-current={activo ? 'page' : undefined}
                      className={`flex min-h-14 items-center gap-3 rounded-lg px-2.5 py-2 ${
                        activo ? 'bg-accent-soft' : ''
                      }`}
                    >
                      {Icone ? (
                        <span className="ct-octagon grid size-9 shrink-0 place-items-center bg-accent-soft text-accent">
                          <Icone className="size-5" />
                        </span>
                      ) : null}
                      <span className="min-w-0">
                        <span className="block font-medium">{atalho.label}</span>
                        <span className="block text-xs text-muted">{atalho.nota}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        </li>
      </ul>
    </nav>
  );
}
