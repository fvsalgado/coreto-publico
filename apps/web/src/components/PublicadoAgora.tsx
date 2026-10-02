import { bulkSetEventStatus } from '@/src/lib/admin/actions';
import type { Ambito } from '@/src/lib/admin/ambito';
import type { Ligacoes } from '@/src/lib/admin/ligacoes';
import { pode } from '@/src/lib/admin/papeis';
import { lerEventoResumido } from '@/src/lib/admin/queries';
import { ESTADO_DO_EVENTO, rotulo } from '@/src/lib/admin/rotulos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const BOTAO =
  'inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium';

/**
 * O que acabou de ser publicado, dito no cimo da página seguinte (C4-013).
 *
 * Aprovar devolvia à fila sem uma palavra, e quem modera ia ao sítio público
 * confirmar — cada proposta custava o dobro. A faixa diz «Publicado», leva ao
 * evento no domínio da região dele, e deixa tirá-lo da agenda logo ali.
 *
 * «Tirar da agenda» e não «Desfazer»: a aprovação fica registada como foi, e
 * o evento passa a rascunho — volta-se a publicar na lista de eventos. É uma
 * mudança de estado com rasto, como qualquer outra, e não um apagar.
 *
 * Um evento de uma região onde esta sessão não modera não se mostra: o
 * identificador vem da barra, e a barra é de quem a escreve. A pergunta é
 * pelo papel, e não pela região escolhida no cimo: aprovar uma proposta do
 * Mirante com o Médio Tejo escolhido também publica, e também se diz.
 */
export async function PublicadoAgora({
  eventoId,
  ambito,
  ligacoes,
  voltar,
}: {
  eventoId: string | undefined;
  ambito: Pick<Ambito, 'sessao' | 'regiaoDoConcelho'>;
  ligacoes: Ligacoes;
  voltar: string;
}) {
  if (!eventoId || !UUID.test(eventoId)) return null;
  const evento = await lerEventoResumido(eventoId);
  if (!evento) return null;
  const regiao = ambito.regiaoDoConcelho.get(evento.municipality_id) ?? null;
  if (!pode(ambito.sessao, regiao, 'editor')) return null;

  const publicado = evento.status === 'published';
  const fichaPublica = publicado
    ? ligacoes.doConcelho(evento.municipality_id, `/evento/${evento.slug}`)
    : null;

  return (
    <div
      role="status"
      className="mb-6 rounded border border-border border-l-4 border-l-accent bg-surface px-4 py-3"
    >
      <p>
        {publicado ? (
          <>
            <strong>Publicado:</strong> «{evento.title}».
          </>
        ) : (
          <>
            «{evento.title}» está em <strong>{rotulo(ESTADO_DO_EVENTO, evento.status)}</strong>.
          </>
        )}
      </p>
      {publicado ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {fichaPublica ? (
            <a href={fichaPublica} target="_blank" rel="noopener noreferrer" className={BOTAO}>
              Ver no sítio<span className="sr-only"> (abre noutro separador)</span>
            </a>
          ) : null}
          <form action={bulkSetEventStatus}>
            <input type="hidden" name="ids" value={evento.id} />
            <input type="hidden" name="status" value="draft" />
            <input type="hidden" name="voltar" value={voltar} />
            <button type="submit" className={BOTAO}>
              Enganaste-te? Tirar da agenda
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
