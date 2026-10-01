import Link from 'next/link';
import { desdeQuandoPorLer, type FonteComSaude, type LeituraDoConcelho } from '@/src/lib/estado';
import { joinPt } from '@/src/lib/format';
import { BandstandMark } from './BandstandMark';

interface Props {
  title: string;
  /** Só quando há mesmo alguma coisa a acrescentar ao título. */
  description?: string;
  action?: { href: string; label: string };
  /**
   * Uma porta mais pequena, em texto — a de quem organiza, na página de quem
   * procura: «Organiza alguma coisa? Envie-nos.» O `depois` é o resto da
   * frase, quando a ligação fica no meio dela.
   */
  secundaria?: { texto: string; href: string; label: string; depois?: string };
  /** As saídas que o vazio propõe, por baixo do texto. */
  children?: React.ReactNode;
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
 * Vive aqui e não na página porque é doutrina, e assim tem-se num teste sem
 * montar React.
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
        'Lemos todos os dias as agendas deste concelho, e de momento não trazem nada. ' +
        'Quem organiza — câmara, coletividade, associação ou junta — pode enviar o que se ' +
        'prepara e fica na agenda da região.',
    };
  }

  if (leitura.tipo === 'por-ler') {
    return {
      title: `Não temos nada marcado em ${nome} — mas pode haver.`,
      description:
        `${quaisAgendasPorLer(leitura.fontes, formatarData)} O que lá se publicar não chega ` +
        'aqui enquanto isto durar — por isso não dizemos que não há nada. Se souber de algum ' +
        'evento, pode enviá-lo.',
    };
  }

  if (leitura.tipo === 'sem-vigilancia') {
    return {
      title: `Não temos nada publicado em ${nome}.`,
      description:
        'Não lemos automaticamente nenhuma agenda deste concelho — o que aparece aqui chega por ' +
        'quem o envia. Não quer dizer que não haja programação: quer dizer que ainda não temos ' +
        'de onde a ler.',
    };
  }

  return {
    title: `Não temos nada publicado em ${nome}.`,
    description:
      'E não conseguimos confirmar, neste momento, o estado das agendas deste concelho — por ' +
      'isso não dizemos que não há nada. Dizemos que não sabemos.',
  };
}

/**
 * Que agendas não conseguimos ler, e desde quando — com o nome delas.
 *
 * Dizia «uma fonte deste concelho está sem uma leitura com sucesso», que é o
 * vocabulário da equipa (C2-017): quem visita não sabe o que é uma fonte nem
 * uma leitura. Diz-se o que é — a agenda da câmara, a da junta, a da sala —
 * pelo nome que ela tem, e o nome vai no fim, depois de um travessão, para a
 * frase não ter de adivinhar se é «da» ou «do».
 */
export function quaisAgendasPorLer(
  fontes: readonly FonteComSaude[],
  formatarData: (iso: string) => string,
): string {
  const desde = desdeQuandoPorLer(fontes);
  const quais = fontes.length === 1 ? 'esta agenda' : 'estas agendas';
  const nomes = joinPt(fontes.map((fonte) => fonte.name));
  return desde
    ? `Desde ${formatarData(desde.slice(0, 10))} que não conseguimos ler ${quais} — ${nomes}.`
    : `Ainda não conseguimos ler ${quais} uma única vez — ${nomes}.`;
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
  return `Pode faltar programação. ${quaisAgendasPorLer(leitura.fontes, formatarData)}`;
}

/**
 * O vazio explica-se.
 *
 * «Não há nada» é precisamente a ideia que este projeto existe para desfazer:
 * uma lista vazia diz o que se pode fazer a seguir, não fica a olhar. O
 * coreto vazio é o convite — está ali à espera de quem suba.
 */
export function EmptyState({ title, description, action, secundaria, children }: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-10 text-center">
      <BandstandMark className="mx-auto size-10 text-accent opacity-80" />
      <p className="font-display mt-3 text-lg font-semibold">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>
      ) : null}
      {children}
      {secundaria ? (
        <p className="mt-5 text-sm text-muted">
          {secundaria.texto}{' '}
          <Link href={secundaria.href} className="underline underline-offset-4">
            {secundaria.label}
          </Link>
          {secundaria.depois ? ` ${secundaria.depois}` : null}
        </p>
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
