import Link from 'next/link';
import type { EventFilter } from '@coreto/core';
import { desdeQuandoPorLer, type LeituraDoConcelho } from '@/src/lib/estado';
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
 * O vazio de um concelho explica-se — e explica-se com o que se sabe, não com
 * o que se supõe.
 *
 * **A frase anterior dizia uma coisa que o produto não pode saber.** Era
 * «Ainda não há programação publicada em X. O concelho continua aqui, à
 * espera.», e saía sempre que a lista vinha vazia — inclusive quando a razão
 * de vir vazia éramos nós. A 16 de setembro de 2026 dizia isso de Mação, com a
 * fonte da câmara bloqueada desde o dia 11: o concelho não estava à espera de
 * nada, nós é que não o conseguíamos ler.
 *
 * O título passou a ser sobre **nós** em três dos quatro casos, e isso não é
 * um floreado de redação: «não temos nada publicado» é verificável e é sempre
 * verdade; «não há programação» é uma afirmação sobre a vida de um território,
 * e essa só se faz quando as fontes foram todas lidas e não trouxeram nada.
 *
 * Vive aqui e não na página pela razão do `vazioDaAgenda` acima: é doutrina,
 * e assim tem-se num teste sem montar React.
 */
export function vazioDoConcelho(
  nome: string,
  leitura: LeituraDoConcelho,
  formatarData: (iso: string) => string,
): { title: string; description: string } {
  if (leitura.tipo === 'em-dia') {
    return {
      title: `Não há nada marcado em ${nome}.`,
      description:
        'Lemos todas as noites as fontes deste concelho, e de momento não trazem nada. ' +
        'Quem organiza — câmara, coletividade, associação ou junta — pode enviar o que se ' +
        'prepara e fica na agenda da região.',
    };
  }

  if (leitura.tipo === 'por-ler') {
    const quantas = leitura.fontes.length;
    const desde = desdeQuandoPorLer(leitura.fontes);
    const quais =
      quantas === 1 ? 'Há uma fonte deste concelho' : `Há ${quantas} fontes deste concelho`;
    const quando = desde
      ? `sem uma leitura com sucesso desde ${formatarData(desde.slice(0, 10))}`
      : 'que ainda não conseguimos ler uma única vez';
    return {
      title: `Não conseguimos ler tudo o que se publica em ${nome}.`,
      description:
        `${quais} ${quando}. Pode estar a acontecer coisa que não chegou aqui — por isso ` +
        'não dizemos que não há nada. Se souber de algum evento, pode enviá-lo.',
    };
  }

  if (leitura.tipo === 'sem-vigilancia') {
    return {
      title: `Não temos nada publicado em ${nome}.`,
      description:
        'Não há nenhuma fonte deste concelho que leiamos automaticamente — o que aparece aqui ' +
        'chega por quem o envia. Não quer dizer que não haja programação: quer dizer que ainda ' +
        'não temos de onde a ler.',
    };
  }

  return {
    title: `Não temos nada publicado em ${nome}.`,
    description:
      'E não conseguimos confirmar, neste momento, o estado das fontes deste concelho — por ' +
      'isso não dizemos que não há nada. Dizemos que não sabemos.',
  };
}

/**
 * O mesmo aviso, para quando a lista **não** está vazia.
 *
 * Um concelho com três eventos e a única fonte parada há seis dias é a mesma
 * mentira do vazio, dita mais baixo: quem lê vê três e conclui que são três.
 * O aviso não grita — a lista continua a ser o assunto da página —, mas diz
 * que pode não ser tudo.
 *
 * Devolve `null` em tudo o resto de propósito. Com as fontes em dia não há
 * nada a avisar; sem fontes nenhumas, ou sem saber, a ressalva seria verdade
 * em todas as páginas e todos os dias — e uma ressalva permanente é uma
 * ressalva que ninguém lê.
 */
export function avisoDeFontesPorLer(
  leitura: LeituraDoConcelho,
  formatarData: (iso: string) => string,
): string | null {
  if (leitura.tipo !== 'por-ler') return null;
  const quantas = leitura.fontes.length;
  const desde = desdeQuandoPorLer(leitura.fontes);
  const quais =
    quantas === 1 ? 'uma fonte deste concelho está' : `${quantas} fontes deste concelho estão`;
  const quando = desde
    ? `sem uma leitura com sucesso desde ${formatarData(desde.slice(0, 10))}`
    : 'ainda por ler uma primeira vez';
  return `O que está aqui pode não ser tudo: ${quais} ${quando}.`;
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
