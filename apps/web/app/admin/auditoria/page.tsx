import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { diferenca, ondeVerAEntidade, volumososOmitidos } from '@/src/lib/admin/auditoria';
import {
  listAdminActions,
  opcoesDaAuditoria,
  type OpcoesDaAuditoria,
  type RecorteDaAuditoria,
} from '@/src/lib/admin/queries';
import { hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Auditoria' };

const PER_PAGE = 50;

/**
 * Os três recortes de «o que mostrar», e o valor por omissão.
 *
 * Vem da barra de endereços, por isso valida-se contra a lista em vez de se
 * confiar: o que não for um destes é tratado como o primeiro, e não como um
 * filtro que a consulta não sabe o que fazer com ele.
 */
type Mostrar = NonNullable<RecorteDaAuditoria['mostrar']>;
const MOSTRAR: readonly Mostrar[] = ['accoes', 'leituras', 'tudo'];

/** As ligações da paginação, como as da agenda pública (`Pagination.tsx`): alvo de 44 px. */
const LIGACAO =
  'inline-flex min-h-11 items-center rounded border border-border px-4 text-sm underline-offset-4 hover:underline';

interface Props {
  searchParams: Promise<{
    page?: string;
    autor?: string;
    accao?: string;
    tipo?: string;
    mes?: string;
    mostrar?: string;
  }>;
}

/** Os recortes na barra de endereços, para as ligações da paginação os levarem. */
function comRecorte(recorte: RecorteDaAuditoria, page: number): string {
  const params = new URLSearchParams();
  if (recorte.actor) params.set('autor', recorte.actor);
  if (recorte.action) params.set('accao', recorte.action);
  if (recorte.entityType) params.set('tipo', recorte.entityType);
  if (recorte.mes) params.set('mes', recorte.mes);
  if (recorte.mostrar && recorte.mostrar !== 'accoes') params.set('mostrar', recorte.mostrar);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/admin/auditoria?${query}` : '/admin/auditoria';
}

/**
 * Os recortes, num formulário que funciona sem JavaScript.
 *
 * `method="get"` e mais nada: submeter põe os recortes na barra de endereços,
 * que é o que os torna partilháveis — «manda-me o link do que o João mexeu em
 * agosto» é a forma como uma auditoria se usa a sério.
 */
function Recortes({ opcoes, recorte }: { opcoes: OpcoesDaAuditoria; recorte: RecorteDaAuditoria }) {
  const campo = 'min-h-11 rounded border border-border bg-surface px-3 text-sm';

  return (
    <form method="get" action="/admin/auditoria" className="mb-6 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Quem</span>
        <select name="autor" defaultValue={recorte.actor ?? ''} className={campo}>
          <option value="">Todos</option>
          {opcoes.actors.map((actor) => (
            <option key={actor} value={actor}>
              {actor}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">O quê</span>
        <select name="accao" defaultValue={recorte.action ?? ''} className={campo}>
          <option value="">Todas</option>
          {opcoes.actions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Sobre</span>
        <select name="tipo" defaultValue={recorte.entityType ?? ''} className={campo}>
          <option value="">Tudo</option>
          {opcoes.entityTypes.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">O que mostrar</span>
        <select name="mostrar" defaultValue={recorte.mostrar ?? 'accoes'} className={campo}>
          <option value="accoes">Decisões</option>
          <option value="leituras">Acessos</option>
          <option value="tudo">Tudo</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Mês</span>
        <input
          type="month"
          name="mes"
          defaultValue={recorte.mes ?? ''}
          className={campo}
          aria-describedby="mes-ajuda"
        />
      </label>

      <button
        type="submit"
        className="min-h-11 rounded bg-accent px-5 text-sm font-medium text-on-accent"
      >
        Filtrar
      </button>
      {recorte.actor ||
      recorte.action ||
      recorte.entityType ||
      recorte.mes ||
      recorte.mostrar !== 'accoes' ? (
        <Link href="/admin/auditoria" className="min-h-11 text-sm underline underline-offset-4">
          Limpar
        </Link>
      ) : null}
      <p id="mes-ajuda" className="sr-only">
        Deixar em branco mostra todos os meses.
      </p>
    </form>
  );
}

/**
 * O antes e o depois de uma ação, dobrado.
 *
 * A promessa «o rasto: o que lá estava antes» estava cumprida na base desde a
 * 0006 e nunca tinha sido lida: `before` e `after` não entravam na consulta da
 * auditoria. Medido a 13 de setembro de 2026: das 185 ações, 91 têm o `before`
 * — as outras são as que criam do nada, onde não havia antes nenhum.
 *
 * **Dobrado e truncado, e não por estética.** Uma rejeição de submissão traz
 * perto de dois quilobytes, e uma marcação de duplicado perto de três: cinquenta
 * linhas despejadas fazem uma página de centenas de quilobytes para quem
 * normalmente só quer ver quem fez o quê. Quem precisa do detalhe abre a linha.
 */
function MudancaDaAcao({ before, after }: { before: unknown; after: unknown }) {
  const linhas = diferenca(before, after);
  const omitidos = volumososOmitidos(before, after);

  if (linhas.length === 0 && omitidos.length === 0) return <span className="text-muted">—</span>;

  const valor = (texto: string | null) =>
    texto === null ? <span className="text-muted italic">não havia</span> : texto;

  return (
    <details className="max-w-md">
      <summary className="cursor-pointer text-muted underline-offset-4 hover:underline">
        {linhas.length === 1 ? '1 campo' : `${linhas.length} campos`}
      </summary>
      <dl className="mt-2 space-y-2 text-xs">
        {linhas.map((linha) => (
          <div key={linha.campo}>
            <dt className="font-mono font-medium">{linha.campo}</dt>
            <dd className="mt-0.5 break-words">
              {valor(linha.antes)} <span aria-hidden="true">→</span>
              <span className="sr-only"> passou a </span> {valor(linha.depois)}
            </dd>
          </div>
        ))}
      </dl>
      {omitidos.length > 0 ? (
        <p className="mt-2 text-xs text-muted">
          Mudou também {omitidos.join(', ')} — texto longo, que não se mostra aqui para a gaveta
          continuar legível.
        </p>
      ) : null}
    </details>
  );
}

export default async function Auditoria({ searchParams }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Auditoria" />;

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const recorte: RecorteDaAuditoria = {
    actor: params.autor || undefined,
    action: params.accao || undefined,
    entityType: params.tipo || undefined,
    mes: params.mes || undefined,
    mostrar: MOSTRAR.includes(params.mostrar as Mostrar) ? (params.mostrar as Mostrar) : 'accoes',
  };
  const [actions, opcoes] = await Promise.all([
    listAdminActions(page, PER_PAGE, recorte),
    opcoesDaAuditoria(),
  ]);

  return (
    <>
      <PageHeader
        title="Auditoria"
        lead="Todas as ações de moderação passam pelas funções da base de dados, e todas deixam rasto aqui. As leituras da fila também — em «acessos», que é onde fica quem viu o quê."
      />

      <Recortes opcoes={opcoes} recorte={recorte} />

      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Tabela, deslocável na horizontal"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">Registo de ações de administração</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-2 pr-4">
                Quando
              </th>
              <th scope="col" className="py-2 pr-4">
                Quem
              </th>
              <th scope="col" className="py-2 pr-4">
                O quê
              </th>
              <th scope="col" className="py-2 pr-4">
                Sobre
              </th>
              <th scope="col" className="py-2 pr-4">
                O que mudou
              </th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => (
              <tr key={action.id} className="border-b border-border">
                <td className="py-2 pr-4 text-muted">
                  {action.created_at.slice(0, 16).replace('T', ' ')}
                </td>
                <td className="py-2 pr-4">{action.actor}</td>
                <td className="py-2 pr-4">{action.action}</td>
                <td className="py-2 pr-4 text-muted">
                  {action.entity_type}{' '}
                  {/*
                    O identificador por inteiro, e não cortado aos oito
                    carateres: cortado não serve nem para procurar. Com ficha
                    própria no painel, leva ligação; sem ela, mostra-se e
                    copia-se.
                  */}
                  {(() => {
                    const href = ondeVerAEntidade(action.entity_type, action.entity_id);
                    return href ? (
                      <Link href={href} className="font-mono text-xs underline underline-offset-4">
                        {action.entity_id}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs break-all">{action.entity_id}</span>
                    );
                  })()}
                </td>
                <td className="py-2 pr-4">
                  <MudancaDaAcao before={action.before} after={action.after} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actions.length === 0 ? (
        <p className="mt-4 text-muted">
          {recorte.actor ||
          recorte.action ||
          recorte.entityType ||
          recorte.mes ||
          recorte.mostrar !== 'accoes'
            ? 'Nenhuma linha com estes recortes. Não quer dizer que não tenha acontecido nada — quer dizer que não aconteceu isto.'
            : 'Sem registos nesta página.'}
        </p>
      ) : null}

      <nav aria-label="Paginação" className="mt-6 flex gap-4 text-sm">
        {page > 1 ? (
          <Link href={comRecorte(recorte, page - 1)} className={LIGACAO}>
            ← Mais recentes
          </Link>
        ) : null}
        {actions.length === PER_PAGE ? (
          <Link href={comRecorte(recorte, page + 1)} className={LIGACAO}>
            Mais antigos →
          </Link>
        ) : null}
      </nav>
    </>
  );
}
