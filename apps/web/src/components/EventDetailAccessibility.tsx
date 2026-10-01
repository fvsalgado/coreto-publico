import { Sinais, Sinal } from '@/src/components/Sinais';
import type { EventDetail } from '@/src/lib/queries/types';
import { sinaisDeAcessibilidade } from '@/src/lib/sinais';

interface Props {
  event: EventDetail;
  /** O que o espaço declara, quando o evento nada diz. */
  venueWheelchairAccessible: boolean | null;
  venueAccessibilityNotes: string | null;
  /**
   * O acesso a cadeiras de rodas é o do espaço: o evento não declara nada
   * (`eventosComAcessoDoEspaco`). É o que a coluna resolvida já não deixa ver.
   */
  acessoDoEspaco?: boolean;
}

/**
 * Acessibilidade declarada, em sinais.
 *
 * Isto foi, durante muito tempo, o parágrafo mais comprido da página — e o
 * único que aparecia sempre, porque a esmagadora maioria das fontes municipais
 * não declara nada:
 *
 *   «Não há informação sobre acesso a cadeiras de rodas, Língua Gestual
 *   Portuguesa, audiodescrição, legendagem e sessão relaxada. Sem informação
 *   não quer dizer que não exista: quer dizer que a fonte não o diz. Vale a
 *   pena contactar o Cine-Teatro Paraíso antes de ir.»
 *
 * O raciocínio que o justificava está certo e continua a valer: «não há
 * informação» não é «não tem», e quem precisa de audiodescrição para decidir se
 * sai de casa merece saber qual dos dois é. O que estava errado era a
 * conclusão. Escrever a ausência não a preenche: quem lê uma agenda já assume
 * que o que não está marcado não está garantido, e trinta palavras a dizê-lo em
 * todas as páginas ensinam a saltar a secção — inclusive nas poucas em que ela
 * tem alguma coisa.
 *
 * Ficam as marcas do que existe. A única ausência que se assinala é a
 * verificada: «sem acesso a cadeiras de rodas» poupa uma viagem, e por isso
 * paga o espaço que ocupa.
 */
export function EventDetailAccessibility({
  event,
  venueWheelchairAccessible,
  venueAccessibilityNotes,
  acessoDoEspaco = false,
}: Props) {
  /*
   * O `??` fica, e passou a ser cinto sobre suspensórios.
   *
   * Desde a 0129, `event.wheelchair_accessible` já vem resolvido da base —
   * o do evento quando ele o declara, o do espaço quando ele se cala — e é a
   * mesma resposta que o cartão mostra e que o filtro procura. Esta linha
   * era, até aí, o único sítio onde a regra existia; agora é a rede para o
   * caso de o evento vir de uma cache mais velha do que a última alteração
   * ao espaço, que é o que se lê do lado direito.
   */
  /*
   * De quem é o acesso que se mostra (C2-011). Do espaço quando o evento se
   * cala — o que a leitura à parte diz, ou o caso do `??` acima, em que a
   * coluna resolvida ainda vinha a nulo e o «sim» só pode ser do espaço.
   */
  const doEspaco =
    acessoDoEspaco || (event.wheelchair_accessible === null && venueWheelchairAccessible === true);
  const sinais = sinaisDeAcessibilidade(
    {
      ...event,
      wheelchair_accessible: event.wheelchair_accessible ?? venueWheelchairAccessible,
    },
    { acessoDoEspaco: doEspaco },
  );

  if (sinais.length === 0 && !event.accessibility_notes && !venueAccessibilityNotes) return null;

  return (
    <div className="mt-3 space-y-3">
      {sinais.length > 0 ? (
        <Sinais>
          {sinais.map((sinal) => (
            <Sinal key={sinal.rotulo} icone={sinal.icone} rotulo={sinal.rotulo} tom={sinal.tom}>
              {sinal.curto}
            </Sinal>
          ))}
        </Sinais>
      ) : null}

      {/* A ressalva por extenso, que o cartão não tem onde pôr: o espaço
          declara o acesso dele, e o evento pode não ser no espaço — um
          concerto no jardim ao lado, uma caminhada que parte do coreto. */}
      {doEspaco ? (
        <p className="text-muted">
          É o acesso que o espaço declara; o evento não diz nada. Se não for no próprio espaço — no
          jardim ao lado, na rua, num percurso —, confirme com quem organiza.
        </p>
      ) : null}

      {event.accessibility_notes ? <p>{event.accessibility_notes}</p> : null}

      {venueAccessibilityNotes ? (
        <p className="text-muted">
          <span className="font-medium text-ink">Sobre o espaço:</span> {venueAccessibilityNotes}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Se há alguma coisa que valha um título «Acessibilidade».
 *
 * A página precisa de saber antes de desenhar o cabeçalho: uma secção com
 * título e nada por baixo é pior do que secção nenhuma.
 */
export function temAcessibilidade(
  event: EventDetail,
  venueWheelchairAccessible: boolean | null,
  venueAccessibilityNotes: string | null,
): boolean {
  return (
    sinaisDeAcessibilidade({
      ...event,
      wheelchair_accessible: event.wheelchair_accessible ?? venueWheelchairAccessible,
    }).length > 0 ||
    Boolean(event.accessibility_notes) ||
    Boolean(venueAccessibilityNotes)
  );
}
