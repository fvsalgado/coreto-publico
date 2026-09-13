import type { Metadata } from 'next';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import { listUnknownTags } from '@/src/lib/admin/queries';
import { listCategories } from '@/src/lib/queries/events';
import { hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Etiquetas por mapear' };

export default async function Etiquetas() {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Etiquetas por mapear" />;

  const [tags, categories] = await Promise.all([listUnknownTags(), listCategories()]);

  return (
    <>
      <PageHeader
        title="Etiquetas por mapear"
        lead="Etiquetas que as fontes usam e que o catálogo ainda não conhece. Nunca se adivinha uma categoria — mapeia-se."
      />

      {/*
        A ordem é por eventos, e a coluna que decide vem primeiro.
        Aqui ordenava-se por avistamentos, e a fila punha no topo «Infantis,
        12», que é **um** evento visto doze noites seguidas. O critério da 0084
        para abrir prateleira nova é meia dúzia de eventos; com a coluna errada
        à frente, lia-se um padrão onde havia um caso.
      */}
      <p className="max-w-prose text-sm text-muted">
        <strong>Eventos</strong> é o número que decide: uma prateleira nova abre-se quando houver
        meia dúzia de eventos de um género que não cabe em nenhuma das que há.{' '}
        <strong>Sem prateleira</strong> são, desses, os que hoje não caem em categoria nenhuma — se
        for zero, a etiqueta pede um alias e não uma prateleira. <strong>Vezes</strong> é quantas
        noites a recolha a viu, e serve só para distinguir uma etiqueta que apareceu uma vez de uma
        que a fonte repete todos os dias.
      </p>

      {tags.length === 0 ? (
        <p className="text-muted">Nada por mapear.</p>
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
                Etiquetas desconhecidas, por eventos que as trazem
              </caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-4">
                    Etiqueta
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Eventos
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Sem prateleira
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Vezes
                  </th>
                  <th scope="col" className="py-2 pr-4">
                    Vista pela última vez
                  </th>
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => (
                  <tr key={tag.tag} className="border-b border-border">
                    <th scope="row" className="py-2 pr-4 text-left font-normal">
                      {tag.tag}
                    </th>
                    <td className="py-2 pr-4 font-medium">{tag.eventos}</td>
                    <td className="py-2 pr-4 text-muted">{tag.eventos_sem_prateleira}</td>
                    <td className="py-2 pr-4 text-muted">{tag.hits}</td>
                    <td className="py-2 pr-4 text-muted">{tag.last_seen.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
            O mapeamento é uma migração, não um botão. Uma alteração de
            taxonomia feita a partir da web não fica no repositório, e uma base
            de dados que já não se reconstrói do repositório é o princípio do
            fim — foi por aí que a implementação de referência perdeu as
            primeiras noventa e sete migrações.
          */}
          <section aria-labelledby="como" className="mt-8">
            <h2 id="como" className="text-lg font-semibold">
              Como mapear
            </h2>
            <p className="mt-1 max-w-prose text-muted">
              Acrescenta uma migração nova em <code>supabase/migrations/</code> com as linhas
              abaixo. Fica no repositório, entra no CI, e uma base de dados nova reconstrói-se
              sozinha.
            </p>
            <pre
              className="mt-3 overflow-x-auto rounded border border-border bg-surface p-3 text-xs"
              tabIndex={0}
            >
              {`insert into public.category_aliases (alias, category_slug)
select distinct on (1) public.normalize_for_hash(alias), category_slug
from (values
  ('${tags[0]?.tag ?? 'a etiqueta'}', '${categories[0]?.slug ?? 'musica'}')
) as t(alias, category_slug)
order by 1
on conflict (alias) do update set category_slug = excluded.category_slug;`}
            </pre>
            <p className="mt-2 text-sm text-muted">
              Categorias disponíveis: {categories.map((category) => category.slug).join(', ')}.
            </p>
          </section>
        </>
      )}
    </>
  );
}
