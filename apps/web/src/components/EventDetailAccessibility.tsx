import { Sinais, Sinal } from '@/src/components/Sinais';
import type { EventDetail } from '@/src/lib/queries/types';
import { sinaisDeAcessibilidade } from '@/src/lib/sinais';

interface Props {
  event: EventDetail;
  /** O que o espaço declara, quando o evento nada diz. */
  venueWheelchairAccessible: boolean | null;
  venueAccessibilityNotes: string | null;
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
}: Props) {
  const sinais = sinaisDeAcessibilidade({
    ...event,
    wheelchair_accessible: event.wheelchair_accessible ?? venueWheelchairAccessible,
  });

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
