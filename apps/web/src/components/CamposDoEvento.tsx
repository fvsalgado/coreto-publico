import type { ReactNode } from 'react';
import type { Proposed, ProposedSession } from '@/src/lib/admin/fields';

/**
 * Os campos de um evento, como o painel os pergunta — os mesmos para aprovar
 * uma proposta e para corrigir um evento publicado (C4-017).
 *
 * Viviam dentro da ficha da fila, e corrigir um evento publicado não tinha
 * formulário nenhum: a hora errada, o preço que faltou, o espaço trocado
 * corrigiam-se por SQL. Um componente só, para as duas fichas perguntarem o
 * mesmo da mesma maneira — e para um campo novo entrar nas duas de uma vez.
 *
 * O `fields.test.ts` lê ESTE ficheiro à procura de um `name=` para cada campo
 * de `EDITABLE_FIELDS`: acrescentar um campo à lista sem lhe desenhar a caixa
 * fazia a aprovação escrever nulo nele e trancá-lo contra a recolha.
 *
 * Não tem `<form>` nem botões: cada ficha põe os seus à volta.
 */

const FIELD =
  'mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';
const LABEL = 'block text-sm font-medium';
const HORA_OU_DATA =
  'min-h-11 max-w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';

/**
 * Quantas linhas de sessão o formulário oferece — e é um **chão**, não um tecto.
 *
 * Era um tecto, e o tecto perdia sessões em silêncio: a RPC aceita e grava as
 * que lhe derem — medi dez —, mas a página só desenhava seis, e o que não tem
 * caixa não é submetido. Um candidato com nove sessões ficava gravado com seis,
 * e o `date_end` saía no dia da sexta em vez do da nona.
 */
const SESSION_ROWS_MINIMO = 6;

/**
 * E um limite, porque um formulário com trezentas linhas não se modera.
 *
 * Quando há mais do que isto, a página **diz quantas leu e quantas está a
 * mostrar** em vez de as deixar cair caladas.
 */
const SESSION_ROWS_LIMITE = 60;

interface Props {
  valores: Proposed;
  sessoes: readonly ProposedSession[];
  emCartaz: boolean;
  /** As escolhas, já recortadas às regiões onde esta sessão modera. */
  concelhos: ReadonlyArray<{ id: string; name: string }>;
  categorias: ReadonlyArray<{ slug: string; name: string }>;
  espacos: ReadonlyArray<{ id: string; name: string; municipality_id: string }>;
  ciclos: ReadonlyArray<{ id: string; name: string; region_id: string }>;
  /** O nome de cada região, para os grupos dos ciclos não mostrarem identificadores. */
  nomeDaRegiao: ReadonlyMap<string, string>;
  /** «aprovar» numa proposta, «corrigir» num evento publicado: muda o que as ajudas dizem. */
  contexto: 'aprovar' | 'corrigir';
  /** O que se diz por baixo da descrição — o texto que a recolha arrumou, por exemplo. */
  notaDaDescricao?: ReactNode;
}

/**
 * Uma escolha que já está no evento e não vem na lista não pode desaparecer:
 * o `select` mandava vazio, e guardar apagava-a. Fica como opção, pelo nome que
 * houver.
 */
function comOAtual<T extends { id: string; name: string }>(
  lista: ReadonlyArray<T>,
  atual: string,
  extra: Omit<T, 'id' | 'name'>,
): ReadonlyArray<T> {
  if (!atual || lista.some((item) => item.id === atual)) return lista;
  return [...lista, { ...extra, id: atual, name: `${atual} (o que está no evento)` } as T];
}

export function CamposDoEvento({
  valores,
  sessoes,
  emCartaz,
  concelhos,
  categorias,
  espacos,
  ciclos,
  nomeDaRegiao,
  contexto,
  notaDaDescricao,
}: Props) {
  const linhasDeSessao = Math.min(
    Math.max(sessoes.length + 2, SESSION_ROWS_MINIMO),
    SESSION_ROWS_LIMITE,
  );
  const sessoesPorMostrar = sessoes.length - linhasDeSessao;
  const gesto = contexto === 'aprovar' ? 'aprovares' : 'guardares';

  // Só ao corrigir: numa proposta, o que a fonte propôs fora das regiões desta
  // sessão é uma sugestão que não se aceita — o campo fica por escolher, e a
  // ação recusá-lo-ia de qualquer maneira.
  const manter = contexto === 'corrigir';
  const listaDeConcelhos = manter ? comOAtual(concelhos, valores.municipality_id, {}) : concelhos;
  const listaDeEspacos = manter
    ? comOAtual(espacos, valores.venue_id, { municipality_id: valores.municipality_id })
    : espacos;
  const listaDeCiclos = manter ? comOAtual(ciclos, valores.series_id, { region_id: '' }) : ciclos;
  const nomeDoConcelho = new Map(listaDeConcelhos.map((concelho) => [concelho.id, concelho.name]));
  // Os espaços agrupados pelo concelho, pela ordem dos concelhos: eram mais de
  // cem numa lista lisa, de três regiões, e um nome repetido em dois concelhos
  // não se distinguia (C4-015).
  const concelhosDosEspacos = [...new Set(listaDeEspacos.map((espaco) => espaco.municipality_id))];

  return (
    <>
      <div>
        <label htmlFor="title" className={LABEL}>
          Título <span className="font-normal text-muted">(obrigatório)</span>
        </label>
        <input id="title" name="title" required defaultValue={valores.title} className={FIELD} />
      </div>

      {/*
        Os três que faltavam: subtítulo, freguesia e ciclo.
        O formulário desenhava doze dos quinze campos editáveis, e o
        `readEvent` percorria os quinze — uma ausência de pergunta saía de
        lá como um `null`, e o `changedFields` mandava trancá-lo contra a
        recolha. O `readEvent` deixou de fabricar; estes três fecham a
        outra metade, que é poder respondê-los.
      */}
      <div>
        <label htmlFor="subtitle" className={LABEL}>
          Subtítulo
        </label>
        <input id="subtitle" name="subtitle" defaultValue={valores.subtitle} className={FIELD} />
      </div>

      <div>
        <label htmlFor="description" className={LABEL}>
          Descrição
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={valores.description}
          className={FIELD}
        />
        {notaDaDescricao}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="municipality_id" className={LABEL}>
            Concelho <span className="font-normal text-muted">(obrigatório)</span>
          </label>
          <select
            id="municipality_id"
            name="municipality_id"
            required
            defaultValue={valores.municipality_id}
            className={FIELD}
          >
            <option value="">—</option>
            {listaDeConcelhos.map((concelho) => (
              <option key={concelho.id} value={concelho.id}>
                {concelho.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category_slug" className={LABEL}>
            Categoria
          </label>
          <select
            id="category_slug"
            name="category_slug"
            defaultValue={valores.category_slug}
            className={FIELD}
          >
            <option value="">—</option>
            {categorias.map((categoria) => (
              <option key={categoria.slug} value={categoria.slug}>
                {categoria.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="venue_id" className={LABEL}>
            Espaço
          </label>
          <select id="venue_id" name="venue_id" defaultValue={valores.venue_id} className={FIELD}>
            <option value="">— (local livre)</option>
            {concelhosDosEspacos.map((concelho) => (
              <optgroup key={concelho} label={nomeDoConcelho.get(concelho) ?? concelho}>
                {listaDeEspacos
                  .filter((espaco) => espaco.municipality_id === concelho)
                  .map((espaco) => (
                    <option key={espaco.id} value={espaco.id}>
                      {espaco.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="location_name" className={LABEL}>
            Local livre
          </label>
          <input
            id="location_name"
            name="location_name"
            defaultValue={valores.location_name}
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="parish" className={LABEL}>
            Freguesia
          </label>
          {/* Texto livre: não há tabela de freguesias, e a coluna é texto
              sem restrição. O limite é o do esquema do `RawEvent`, para o
              formulário dizer o mesmo que a validação. */}
          <input
            id="parish"
            name="parish"
            maxLength={120}
            defaultValue={valores.parish}
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="series_id" className={LABEL}>
            Ciclo
          </label>
          {/* Um `select` e não texto livre: `events.series_id` tem chave
              estrangeira para `series`, e um id escrito à mão rebentava a
              aprovação com um erro de Postgres em cima de quem modera.
              Agrupado por região, pelo nome dela. */}
          <select
            id="series_id"
            name="series_id"
            defaultValue={valores.series_id}
            className={FIELD}
          >
            <option value="">— (sem ciclo)</option>
            {[...new Set(listaDeCiclos.map((ciclo) => ciclo.region_id))].map((regiaoDoCiclo) => (
              <optgroup
                key={regiaoDoCiclo || 'atual'}
                label={nomeDaRegiao.get(regiaoDoCiclo) ?? 'O que está no evento'}
              >
                {listaDeCiclos
                  .filter((ciclo) => ciclo.region_id === regiaoDoCiclo)
                  .map((ciclo) => (
                    <option key={ciclo.id} value={ciclo.id}>
                      {ciclo.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <fieldset aria-describedby="sessoes-ajuda">
        <legend className={LABEL}>Sessões</legend>
        <p id="sessoes-ajuda" className="text-sm text-muted">
          Uma linha por dia — ou por sessão, se houver mais do que uma no mesmo dia. Linhas sem data
          são ignoradas.
        </p>
        {sessoesPorMostrar > 0 ? (
          <p className="mt-1 text-sm text-highlight">
            Há {sessoes.length} sessões e {linhasDeSessao} linhas à vista: {sessoesPorMostrar} não
            cabem no formulário e perdem-se se {gesto} assim. Pede a quem opera o Coreto que trate
            deste.
          </p>
        ) : null}
        <div className="mt-2 space-y-2">
          {Array.from({ length: linhasDeSessao }, (_, index) => {
            const sessao = sessoes[index];
            return (
              <div key={index} className="flex flex-wrap gap-2">
                <span className="sr-only">Sessão {index + 1}</span>
                <input
                  type="date"
                  name="session_date"
                  aria-label={`Data da sessão ${index + 1}`}
                  defaultValue={sessao?.date ?? ''}
                  className={HORA_OU_DATA}
                />
                <input
                  type="time"
                  name="session_start"
                  aria-label={`Hora de início da sessão ${index + 1}`}
                  defaultValue={sessao?.start ?? ''}
                  className={HORA_OU_DATA}
                />
                <input
                  type="time"
                  name="session_end"
                  aria-label={`Hora de fim da sessão ${index + 1}`}
                  defaultValue={sessao?.end ?? ''}
                  className={HORA_OU_DATA}
                />
              </div>
            );
          })}
        </div>
        {/* Um período, não sessões. O formulário público guardava «de X a
            Y» como os dois extremos mais `is_ongoing` (build-row.ts): as
            duas linhas são o dia de abrir e o de fechar, e a ficha escreve
            «em cartaz de X a Y». Sem a caixa, a aprovação deixava cair o
            `is_ongoing` e publicava dois espetáculos. */}
        <label
          htmlFor="is_ongoing"
          className="mt-3 flex min-h-11 items-center gap-2.5 text-sm font-medium"
        >
          <input
            type="checkbox"
            id="is_ongoing"
            name="is_ongoing"
            defaultChecked={emCartaz}
            aria-describedby="is-ongoing-ajuda"
            className="size-5 accent-accent"
          />
          Em cartaz: um período, não sessões soltas
        </label>
        <p id="is-ongoing-ajuda" className="text-sm text-muted">
          Uma exposição «de X a Y», um festival de três dias: a primeira e a última linha são o dia
          de abrir e o de fechar, e a ficha diz «em cartaz». Desligado, cada linha é uma sessão.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* O rótulo leva a altura toda: a caixa tem 20 px, o alvo é a
            linha inteira — como nos filtros da agenda pública. */}
        <label htmlFor="is_free" className="flex min-h-11 items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            id="is_free"
            name="is_free"
            defaultChecked={valores.is_free}
            className="size-5 accent-accent"
          />
          Entrada livre
        </label>

        <div>
          <label htmlFor="price_display" className={LABEL}>
            Preço
          </label>
          <input
            id="price_display"
            name="price_display"
            defaultValue={valores.price_display}
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="ticketing_url" className={LABEL}>
            Bilhética
          </label>
          <input
            id="ticketing_url"
            name="ticketing_url"
            type="url"
            defaultValue={valores.ticketing_url}
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="image_url" className={LABEL}>
            Imagem
          </label>
          <input
            id="image_url"
            name="image_url"
            type="url"
            defaultValue={valores.image_url}
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label htmlFor="how_to_arrive" className={LABEL}>
          Como chegar
        </label>
        <textarea
          id="how_to_arrive"
          name="how_to_arrive"
          rows={2}
          defaultValue={valores.how_to_arrive}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="accessibility_notes" className={LABEL}>
          Notas de acessibilidade
        </label>
        <textarea
          id="accessibility_notes"
          name="accessibility_notes"
          rows={2}
          defaultValue={valores.accessibility_notes}
          className={FIELD}
        />
      </div>
    </>
  );
}
