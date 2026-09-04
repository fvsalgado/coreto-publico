import type { Metadata } from 'next';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { ligarSitio, porSitioDeLado } from '@/src/lib/admin/actions';
import {
  listUnresolvedVenues,
  listVenuesForLinking,
  type LinkableVenue,
} from '@/src/lib/admin/queries';
import { hasServiceRole } from '@/src/lib/env';
import { listMunicipalitiesDeTodas } from '@/src/lib/queries/events';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Espaços por resolver' };

const CAMPO = 'min-h-11 max-w-60 rounded border border-field bg-surface px-2 text-sm text-ink';
const BOTAO =
  'inline-flex min-h-11 items-center rounded border border-field px-3 text-sm font-medium hover:bg-surface';
const BOTAO_DISCRETO =
  'inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:underline';

interface Props {
  searchParams: Promise<{ aviso?: string }>;
}

/** Uma cadeia dentro de aspas simples de SQL: só a plica precisa de dobrar. */
function emSql(texto: string): string {
  return texto.replace(/'/g, "''");
}

export default async function EspacosPorResolver({ searchParams }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Espaços por resolver" />;

  const [{ aviso }, fila, espacos, concelhos] = await Promise.all([
    searchParams,
    listUnresolvedVenues(),
    listVenuesForLinking(),
    listMunicipalitiesDeTodas(),
  ]);
  const primeiro = fila[0];

  // Os espaços por concelho, para os `<optgroup>`; e o nome de cada concelho,
  // que a lista de espaços só traz por identificador.
  const porConcelho = new Map<string, LinkableVenue[]>();
  for (const espaco of espacos) {
    const lista = porConcelho.get(espaco.municipality_id) ?? [];
    lista.push(espaco);
    porConcelho.set(espaco.municipality_id, lista);
  }
  const nomeDoConcelho = new Map(concelhos.map((concelho) => [concelho.id, concelho.name]));
  // Pela ordem do catálogo; um concelho de que só os espaços sabem — uma
  // região que entrou por configuração há menos de uma hora — vai para o fim.
  const ordemDosConcelhos = [
    ...concelhos.map((concelho) => concelho.id).filter((id) => porConcelho.has(id)),
    ...[...porConcelho.keys()].filter((id) => !nomeDoConcelho.has(id)),
  ];

  /** O concelho da linha à frente; os outros a seguir, pela ordem do catálogo. */
  function concelhosPara(linha: { municipality_id: string | null }): string[] {
    const seu = linha.municipality_id;
    if (!seu || !porConcelho.has(seu)) return ordemDosConcelhos;
    return [seu, ...ordemDosConcelhos.filter((id) => id !== seu)];
  }

  return (
    <>
      <PageHeader
        title="Espaços por resolver"
        lead="Nomes de sítio que as fontes escrevem e que o catálogo ainda não reconhece. Enquanto não têm espaço, o evento aparece com o local em texto solto — sem mapa e sem ficha. Ligar um nome a um espaço que já existe faz-se aqui, uma vez: liga os eventos que estavam à espera, e a recolha fica a saber."
      />

      {aviso ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          {aviso}
        </p>
      ) : null}

      {fila.length === 0 ? (
        <p className="text-muted">Nada por resolver.</p>
      ) : (
        <>
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Tabela, deslocável na horizontal"
          >
            <table className="w-full text-sm">
              <caption className="sr-only">
                Nomes de espaço por resolver, por eventos à espera e número de ocorrências
              </caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-4">
                    Nome, como a fonte o escreve
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Concelho
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Por acontecer
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Vezes
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Visto pela última vez
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Ligar a
                  </th>
                </tr>
              </thead>
              <tbody>
                {fila.map((linha) => (
                  <tr key={linha.normalized} className="border-b border-border align-top">
                    <th scope="row" className="py-3 pr-4 text-left font-normal">
                      {linha.example_url ? (
                        <a
                          href={linha.example_url}
                          rel="noreferrer noopener"
                          className="underline underline-offset-4"
                        >
                          {linha.name}
                        </a>
                      ) : (
                        linha.name
                      )}
                    </th>
                    <td className="py-3 pr-4 text-muted">{linha.municipality_id ?? '—'}</td>
                    <td
                      className={`py-3 pr-4 tabular-nums ${
                        linha.eventos_por_acontecer > 0 ? 'font-medium' : 'text-muted'
                      }`}
                    >
                      {linha.eventos_por_acontecer}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-muted">{linha.hits}</td>
                    <td className="py-3 pr-4 text-muted">{linha.last_seen.slice(0, 10)}</td>
                    <td className="py-2 pr-4">
                      <form action={ligarSitio} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="normalized" value={linha.normalized} />
                        <input type="hidden" name="name" value={linha.name} />
                        <input
                          type="hidden"
                          name="municipality"
                          value={linha.municipality_id ?? ''}
                        />
                        <select
                          name="venue"
                          required
                          defaultValue=""
                          aria-label={`Espaço a que «${linha.name}» pertence`}
                          className={CAMPO}
                        >
                          <option value="">Escolhe o espaço…</option>
                          {concelhosPara(linha).map((concelho) => (
                            <optgroup
                              key={concelho}
                              label={nomeDoConcelho.get(concelho) ?? concelho}
                            >
                              {(porConcelho.get(concelho) ?? []).map((espaco) => (
                                <option key={espaco.id} value={espaco.id}>
                                  {espaco.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <button type="submit" className={BOTAO}>
                          Ligar
                        </button>
                      </form>
                      <form action={porSitioDeLado} className="mt-1">
                        <input type="hidden" name="normalized" value={linha.normalized} />
                        <button type="submit" className={BOTAO_DISCRETO}>
                          Não é um sítio
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
            A regra mudou aqui, e só aqui — e vale a pena dizer porquê, porque
            nas etiquetas continua a ser a outra. Mapear uma etiqueta é
            taxonomia, desenho do produto, e fica no repositório por migração.
            Ligar um nome que uma fonte escreve a um espaço que JÁ ESTÁ no
            catálogo é trabalho editorial, como aprovar uma submissão ou editar
            a prosa de uma região (0109): faz-se aqui, fica em `admin_actions`
            com quem e quando, e o registo é a auditoria e a cópia de segurança
            da base — a mesma que guarda as submissões aprovadas. O que se
            perde é a linha no repositório; o que se ganha é que quem vê a fila
            é quem a fecha, sem abrir um editor de SQL. Criar um espaço NOVO
            continua a ser uma migração, e não por teimosia: precisa de morada,
            coordenadas, tipo e de quem confirmou o quê e onde — é catálogo,
            com fonte, e é o repositório que o reconstrói. A 0117 tem a
            decisão inteira.
          */}
          <section aria-labelledby="novo" className="mt-8">
            <h2 id="novo" className="text-lg font-semibold">
              Quando o espaço ainda não existe
            </h2>
            <p className="mt-1 max-w-prose text-muted">
              Se o nome é de um espaço que já está no catálogo com outra grafia, liga-se acima e
              acabou. Se é um espaço que o catálogo não tem, cria-se primeiro — por migração, porque
              um espaço leva morada, coordenadas, tipo e a nota de onde se confirmou cada coisa.
              Depois volta-se aqui a ligar-lhe o nome como a fonte o escreve.
            </p>
            <pre
              className="mt-3 overflow-x-auto rounded border border-border bg-surface p-3 text-xs"
              tabIndex={0}
            >
              {`-- Só quando o espaço não existe. Confirma a morada, as coordenadas e o
-- tipo contra uma fonte primária, e diz na nota onde e quando.
insert into public.venues (id, name, municipality_id, kind, address, postal_code, latitude, longitude, notes)
values ('id-novo', '${emSql(primeiro?.name ?? 'o nome')}', '${primeiro?.municipality_id ?? 'concelho'}', 'other',
        null, null, null, null, 'Criado pela 0NNN. Confirmado em … a …');

-- O próprio nome resolve para si, como em todos os outros espaços; a grafia
-- da fonte liga-se depois, aqui no painel.
insert into public.venue_aliases (alias, venue_id, municipality_id)
values (public.normalize_for_hash('${emSql(primeiro?.name ?? 'o nome')}'), 'id-novo', '${primeiro?.municipality_id ?? 'concelho'}')
on conflict do nothing;`}
            </pre>
            <p className="mt-3 max-w-prose text-sm text-muted">
              Um alias com concelho ganha ao regional na resolução, e um nome com concelho só se
              liga a um espaço desse concelho — a base recusa o resto. «Vários locais», «A anunciar»
              e o nome de um concelho não são sítios: «Não é um sítio» tira-os da fila sem apagar o
              histórico de quantas vezes apareceram.
            </p>
          </section>
        </>
      )}
    </>
  );
}
