import Link from 'next/link';
import type { EventFilter } from '@coreto/core';
import { BandstandMark } from './BandstandMark';

interface Props {
  title: string;
  /** Só quando há mesmo alguma coisa a acrescentar ao título. */
  description?: string;
  action?: { href: string; label: string };
}

/**
 * O que se diz a quem filtrou a agenda e ficou sem nada.
 *
 * A frase era uma só — «Alargue o intervalo de datas ou limpe alguns
 * filtros» — e há um caso em que ela aconselha o que não pode resultar. O
 * acesso a cadeiras de rodas é uma declaração do próprio evento, e uma fonte
 * que nunca a escreve deixa o recorte vazio por mais anos de agenda que se
 * peçam: a 7 de setembro de 2026, `?accessible=1` devolvia 0 dos 128 eventos
 * do Médio Tejo. Mandar alargar as datas culpa quem lê por uma lacuna que é
 * do catálogo.
 *
 * O que a segunda frase **não** diz é quantos são: seria uma contagem que
 * esta função não tem e que muda de região para região. Diz o que o filtro
 * faz e onde está o que se sabe, que é verdade em todas.
 *
 * Vive ao lado do componente e não na página porque é a mesma doutrina do
 * comentário abaixo — o vazio explica-se —, e assim tem-se num teste sem
 * montar React.
 */
export function vazioDaAgenda(filter: Pick<EventFilter, 'accessible'>): {
  title: string;
  description: string;
} {
  if (filter.accessible === true) {
    return {
      title: 'Sem resultados para estes filtros.',
      description:
        'Este recorte mostra só os eventos onde o acesso a cadeiras de rodas está declarado: sem essa declaração, o evento fica de fora mesmo que o espaço seja acessível. Alargar o intervalo de datas não muda isso — o acesso ao espaço, quando se sabe, está na ficha de cada evento.',
    };
  }
  return {
    title: 'Sem resultados para estes filtros.',
    description: 'Alargue o intervalo de datas ou limpe alguns filtros.',
  };
}

/**
 * O vazio explica-se.
 *
 * «Não há nada» é precisamente a ideia que este projeto existe para desfazer:
 * uma lista vazia diz o que se pode fazer a seguir, não fica a olhar. O
 * coreto vazio é o convite — está ali à espera de quem suba.
 */
export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-10 text-center">
      <BandstandMark className="mx-auto size-10 text-accent opacity-80" />
      <p className="font-display mt-3 text-lg font-semibold">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>
      ) : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-sm font-medium text-on-accent"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
