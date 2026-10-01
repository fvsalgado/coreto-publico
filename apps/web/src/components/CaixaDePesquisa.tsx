import type { EventFilter } from '@coreto/core';
import { PATH, buildHref } from '@/src/lib/agenda';
// De `caminhos.ts`, e não do `LupaDoToldo`: uma constante importada de um
// módulo de cliente chega a um componente de servidor como uma referência, e
// não como o texto que tem.
import { ANCORA_DA_PESQUISA } from '@/src/lib/caminhos';
import { ReporAoVoltar } from './ReporAoVoltar';

// `border-field` e não `border-border` (WCAG 1.4.11), e `text-base` para o
// Safari do iPhone não dar zoom ao focar — as razões do `FilterBar`.
const CAMPO =
  'min-h-11 w-full min-w-0 rounded border border-field bg-surface px-3 py-2 text-base text-ink';

interface Props {
  /**
   * O filtro em vigor. Uma pesquisa nova guarda os outros recortes, como o
   * formulário dos filtros sempre guardou; sem filtro, pesquisa a agenda
   * inteira.
   */
  filter?: EventFilter;
  /** Se esta é a caixa a que a lupa do toldo leva (`#pesquisa`). */
  alvoDaLupa?: boolean;
  className?: string;
}

/**
 * A pesquisa, à vista.
 *
 * Vivia só dentro da gaveta «Pesquisar e filtrar» da agenda, a dois toques de
 * quem chegava, e não existia em mais página nenhuma (C3-020): quem entrava a
 * querer «fado» ou o nome de uma sala tinha de ir à agenda, abrir a gaveta e
 * só então escrever. Agora está no topo da agenda e na entrada, e a lupa do
 * toldo leva a ela de qualquer página.
 *
 * Os outros filtros viajam escondidos, e só os que estão a valer: saem do
 * endereço canónico (`buildHref`), e não de um campo por filtro — um campo
 * vazio no endereço é um endereço com ar de avariado quando se partilha.
 *
 * A `key` é o endereço do filtro: quando a agenda muda de recorte sem
 * recarregar, o formulário nasce outra vez com o termo certo em vez de
 * guardar o que lá se escreveu antes (C2-036). O «voltar» do navegador é o
 * `ReporAoVoltar` que o resolve.
 */
export function CaixaDePesquisa({ filter, alvoDaLupa = false, className }: Props) {
  const resto = filter
    ? new URLSearchParams(buildHref(filter, 1, 'q').split('?')[1] ?? '')
    : new URLSearchParams();
  const ancora = alvoDaLupa ? ANCORA_DA_PESQUISA : undefined;

  return (
    <form
      key={filter ? buildHref(filter, 1) : PATH}
      id={ancora}
      method="get"
      action={PATH}
      role="search"
      aria-label="Pesquisar na agenda"
      className={className}
    >
      {[...resto.entries()].map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      {/* O rótulo só se esconde no telemóvel, e só aos olhos: o primeiro
          cartão da agenda tem de caber inteiro no primeiro ecrã (é uma
          verificação do CI), e ali o botão «Pesquisar» ao lado já diz o que
          a caixa é. Quem ouve ouve o rótulo em todas as larguras. */}
      <label htmlFor="pesquisa-q" className="sr-only text-sm font-medium sm:not-sr-only sm:block">
        Pesquisar na agenda
      </label>
      <div className="flex gap-2 sm:mt-1">
        <input
          type="search"
          id="pesquisa-q"
          name="q"
          defaultValue={filter?.q ?? ''}
          // Curto de propósito: a 390 px a caixa tem uns 250 px ao lado do
          // botão, e «Um título, uma sala, um concelho…» cortava-se em
          // «um conce». Um exemplo cortado ensina pior do que um inteiro.
          placeholder="Título, sala, concelho…"
          maxLength={120}
          enterKeyHint="search"
          className={CAMPO}
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded bg-accent px-4 text-sm font-medium text-on-accent"
        >
          Pesquisar
        </button>
      </div>
      <ReporAoVoltar ancora={ancora} />
    </form>
  );
}
