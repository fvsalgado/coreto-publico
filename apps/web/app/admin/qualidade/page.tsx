import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import {
  listEventsWithoutTime,
  qualityByMunicipality,
  qualityBySource,
  type EventWithoutTimeRow,
  type QualityRow,
} from '@/src/lib/admin/queries';
import { hasServiceRole } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Qualidade' };

/**
 * Sem casas decimais, de propósito.
 *
 * A decisão que estes números informam é «onde é que vale a pena mexer», e
 * para isso 62 e 62,4 dizem exatamente o mesmo. Uma casa decimal aqui é falsa
 * precisão sobre um catálogo que ainda está a encher.
 */
function percentagem(parte: number, total: number): string {
  if (total === 0) return '—';
  return `${Math.round((parte / total) * 100)}%`;
}

const COLUNAS = [
  {
    chave: 'with_time',
    rotulo: 'Hora',
    ajuda: 'Eventos com hora de início em pelo menos uma sessão',
  },
  {
    chave: 'with_venue',
    rotulo: 'Espaço',
    ajuda: 'Eventos ligados a um espaço do catálogo, e não a texto solto',
  },
  { chave: 'with_description', rotulo: 'Descrição', ajuda: 'Eventos com texto além do título' },
  { chave: 'with_image', rotulo: 'Imagem', ajuda: 'Eventos com cartaz ou fotografia' },
  { chave: 'with_price', rotulo: 'Preço', ajuda: 'Eventos que dizem se é pago ou gratuito' },
  { chave: 'with_coordinates', rotulo: 'Mapa', ajuda: 'Eventos com coordenadas' },
] as const satisfies ReadonlyArray<{
  chave: keyof Omit<QualityRow, 'id' | 'name' | 'published' | 'pending' | 'in_catalogue'>;
  rotulo: string;
  ajuda: string;
}>;

function Tabela({
  id,
  titulo,
  legenda,
  linhas,
}: {
  id: string;
  titulo: string;
  legenda: string;
  linhas: QualityRow[];
}) {
  const total = linhas.reduce((soma, linha) => soma + linha.in_catalogue, 0);

  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className="text-lg font-semibold">
        {titulo}
      </h2>
      <p className="mt-1 max-w-prose text-muted">{legenda}</p>

      <div
        className="mt-3 overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label="Tabela, deslocável na horizontal"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">{legenda}</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-2 pr-4">
                Nome
              </th>
              <th scope="col" className="py-2 pr-4">
                <abbr title="Eventos no sítio, à vista do público" className="no-underline">
                  Publicados
                </abbr>
              </th>
              <th scope="col" className="py-2 pr-4">
                <abbr
                  title="Recolhidos e à espera de que alguém os aprove. As percentagens contam sobre publicados mais estes."
                  className="no-underline"
                >
                  Por publicar
                </abbr>
              </th>
              {COLUNAS.map((coluna) => (
                <th key={coluna.chave} scope="col" className="py-2 pr-4">
                  <abbr title={coluna.ajuda} className="no-underline">
                    {coluna.rotulo}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.id} className="border-b border-border">
                <th scope="row" className="py-2 pr-4 text-left font-normal">
                  {linha.name}
                </th>
                <td className="py-2 pr-4 tabular-nums">{linha.published}</td>
                <td className="py-2 pr-4 tabular-nums">{linha.pending}</td>
                {COLUNAS.map((coluna) => (
                  <td key={coluna.chave} className="py-2 pr-4 tabular-nums text-muted">
                    {percentagem(linha[coluna.chave], linha.in_catalogue)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="py-2 pr-4 text-left font-semibold">
                Total
              </th>
              <td className="py-2 pr-4 font-semibold tabular-nums">
                {linhas.reduce((soma, linha) => soma + linha.published, 0)}
              </td>
              <td className="py-2 pr-4 font-semibold tabular-nums">
                {linhas.reduce((soma, linha) => soma + linha.pending, 0)}
              </td>
              {COLUNAS.map((coluna) => (
                <td key={coluna.chave} className="py-2 pr-4 font-semibold tabular-nums">
                  {percentagem(
                    linhas.reduce((soma, linha) => soma + linha[coluna.chave], 0),
                    total,
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/**
 * A percentagem diz se a agenda está a melhorar; não diz quais são os eventos
 * que faltam. Este é o número absoluto — só dos que ainda vão acontecer,
 * porque corrigir a hora de um que já passou não leva ninguém a lado nenhum —
 * e a ligação leva à lista, pronta a corrigir. É o passo entre saber e
 * resolver.
 */
function SemHora({ linhas, nomes }: { linhas: EventWithoutTimeRow[]; nomes: Map<string, string> }) {
  const porConcelho = new Map<string, number>();
  for (const linha of linhas) {
    porConcelho.set(linha.municipality_id, (porConcelho.get(linha.municipality_id) ?? 0) + 1);
  }
  const repartidos = [...porConcelho]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${nomes.get(id) ?? id} ${n}`)
    .join(' · ');

  return (
    <section aria-labelledby="sem-hora" className="mt-8">
      <h2 id="sem-hora" className="text-lg font-semibold">
        Sem hora
      </h2>
      {linhas.length === 0 ? (
        <p className="mt-1 max-w-prose text-muted">
          Todos os eventos que ainda vão acontecer dizem a que horas são.
        </p>
      ) : (
        <>
          <p className="mt-1 max-w-prose">
            <span className="font-semibold tabular-nums">{linhas.length}</span>{' '}
            {linhas.length === 1 ? 'evento' : 'eventos'} por vir sem hora em sessão nenhuma —
            publicados e por publicar.
          </p>
          <p className="mt-1 max-w-prose text-sm text-muted tabular-nums">{repartidos}</p>
          <p className="mt-2">
            <Link
              href="/admin/eventos?falta=hora&estado=todos"
              className="underline underline-offset-4"
            >
              Ver a lista, pronta a corrigir →
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

export default async function Qualidade() {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Qualidade" />;

  const [porConcelho, porFonte, semHora] = await Promise.all([
    qualityByMunicipality(),
    qualityBySource(),
    listEventsWithoutTime(),
  ]);

  return (
    <>
      <PageHeader
        title="Qualidade"
        lead="Não quantos eventos há — quantos deles dizem a que horas, onde e com que imagem. É a diferença entre uma montra e um depósito."
      />

      {/*
        Um concelho com quarenta eventos sem hora é pior do que um com dez que
        dizem a que horas. Sem esta medida os dois pareciam iguais, e a única
        pergunta que o projeto sabia responder era «quantos?».
      */}
      <Tabela
        id="por-concelho"
        titulo="Por concelho"
        legenda="O que está preenchido no catálogo, concelho a concelho — publicado e por publicar, porque a recolha escreve rascunhos e é uma pessoa que os aprova. Um concelho a zero não é um defeito escondido: é o que ainda não entrou."
        linhas={porConcelho}
      />

      <Tabela
        id="por-fonte"
        titulo="Por fonte"
        legenda="A mesma medida por fonte. É por aqui que se vê qual adaptador está a deixar por trazer um campo que a página do lado de lá tem — e por isso conta o catálogo todo: um adaptador não aprova nada."
        linhas={porFonte}
      />

      <SemHora
        linhas={semHora}
        nomes={new Map(porConcelho.map((linha) => [linha.id, linha.name]))}
      />
    </>
  );
}
