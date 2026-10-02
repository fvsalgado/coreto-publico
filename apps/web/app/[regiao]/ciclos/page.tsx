import type { Metadata } from 'next';
import Link from 'next/link';
import { todayInLisbon } from '@coreto/core';
import { EmptyState } from '@/src/components/EmptyState';
import { NotaDiscreta } from '@/src/components/NotaDiscreta';
import { PageHeader } from '@/src/components/PageHeader';
import { ordemDosCiclos, quandoDoCiclo } from '@/src/lib/ciclo';
import { formatSeriesKind } from '@/src/lib/format';
import { countEventsBySeries, listMunicipalities, listSeries } from '@/src/lib/queries/events';
import { enderecos } from '@/src/lib/enderecos';
import { SITE_URL } from '@/src/lib/env';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { urlDoSitio } from '@/src/lib/regiao';
import { exigirSeccao, seccaoLigada } from '@/src/lib/queries/seccoes';
import type { Series } from '@/src/lib/queries/types';

export const revalidate = 3600;

interface Props {
  params: Promise<{ regiao: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);
  return {
    title: 'Ciclos e festivais',
    description: `Os festivais, ciclos e programas em rede ${regiao.doNome}: quando é cada um, quando foi a última edição, e os que sabemos existir e ainda não têm datas.`,
    alternates: enderecos(urlDoSitio(regiao, SITE_URL), '/ciclos'),
  };
}

function ordenar(a: Series, b: Series): number {
  return a.name.localeCompare(b.name, 'pt');
}

/**
 * O sítio oficial de um ciclo, quando o temos — com a seta à vista (C2-023): a
 * ligação sai do Coreto, e quem lê tem de o saber antes de carregar, não só
 * quem ouve. Por cima do cartão inteiro, que é ele próprio uma ligação.
 */
function SitioOficial({ url }: { url: string }) {
  return (
    <a
      href={url}
      rel="noopener nofollow"
      className="relative z-10 -mx-1 inline-flex min-h-11 items-center px-1 text-sm font-medium text-accent underline underline-offset-4"
    >
      Sítio oficial
      <span aria-hidden="true">&nbsp;↗</span>
    </a>
  );
}

export default async function CiclosPage({ params }: Props) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);

  // Desligada no painel, esta página não existe. O guarda vem antes de
  // qualquer leitura: não vale a pena ir à base buscar o que não se mostra.
  await exigirSeccao(regiao.id, 'ciclos');
  const haFontes = await seccaoLigada(regiao.id, 'fontes');

  const [series, counts, municipalities] = await Promise.all([
    listSeries(regiao.id),
    countEventsBySeries(regiao.id),
    listMunicipalities(regiao.id),
  ]);

  const municipalityNames: Record<string, string> = Object.fromEntries(
    municipalities.map((municipality) => [municipality.id, municipality.name]),
  );

  const hoje = todayInLisbon();

  // O que está para vir primeiro, e o que acabou de acontecer a seguir: a
  // ordem da pergunta «o que há para ver?», e não a do alfabeto (C2-023).
  const comPrograma = series
    .filter((item) => (counts[item.id]?.total ?? 0) > 0)
    .sort(ordemDosCiclos(counts));
  const semDatas = series.filter((item) => (counts[item.id]?.total ?? 0) === 0).sort(ordenar);

  function onde(item: Series): string {
    if (item.is_regional) return 'Toda a região';
    if (item.municipality_id) return municipalityNames[item.municipality_id] ?? regiao.nome;
    return regiao.nome;
  }

  return (
    <>
      <PageHeader
        title="Ciclos e festivais"
        eyebrow="A região"
        lead="Há programação que não cabe num evento nem num espaço: atravessa concelhos, repete-se todos os anos e tem nome próprio. É essa que vive aqui."
      />

      {series.length === 0 ? (
        <EmptyState
          title="Ainda não há ciclos nem festivais registados."
          description="Quem organiza um pode enviar-nos as datas por email: entram na agenda como qualquer outro evento."
          action={{ href: '/submeter', label: 'Como enviar um evento' }}
        />
      ) : null}

      {/* Sem ciclos com datas, a secção não se desenha: um título por cima de
          uma lista vazia diz que falta alguma coisa sem dizer o quê. */}
      {comPrograma.length > 0 ? (
        <section aria-labelledby="com-programa">
          <h2 id="com-programa" className="ct-heading">
            Com datas registadas
          </h2>
          <p className="mt-2 max-w-2xl text-muted">
            Edição a edição, incluindo o que já passou: uma edição que aconteceu não desaparece — é
            o melhor argumento para a próxima.
          </p>

          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {comPrograma.map((item) => (
              <li key={item.id}>
                <article className="ct-lift relative h-full rounded-lg border border-border bg-surface p-4">
                  <p className="ct-eyebrow">{formatSeriesKind(item.kind)}</p>
                  <h3 className="font-display mt-1.5 text-xl leading-snug font-semibold [overflow-wrap:anywhere]">
                    <Link
                      href={`/ciclo/${item.id}`}
                      className="underline-offset-4 hover:underline after:absolute after:inset-0 after:content-['']"
                    >
                      {item.name}
                    </Link>
                  </h3>
                  {item.description ? (
                    <p className="mt-1.5 text-sm text-muted">{item.description}</p>
                  ) : null}
                  <p className="mt-2.5 text-sm text-muted">
                    {onde(item)} · {quandoDoCiclo(counts[item.id], hoje)}
                  </p>
                  {item.website_url ? <SitioOficial url={item.website_url} /> : null}
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {semDatas.length > 0 ? (
        <section
          aria-labelledby="sem-datas"
          className={comPrograma.length > 0 ? 'mt-12 border-t border-border pt-8' : undefined}
        >
          {/*
            «Conhecidos, ainda por recolher», e um parágrafo sobre fontes:
            conversa de quem programa, à cabeça de uma lista para quem
            visita (C2-023). O título diz o que falta a quem lê; a explicação
            das fontes passou para a nota do fim. E cada nome leva à página
            do ciclo, que existia e não tinha caminho até ela.
          */}
          <h2 id="sem-datas" className="ct-heading">
            Conhecidos, ainda sem datas
          </h2>
          <p className="mt-2 max-w-2xl text-muted">
            Sabemos que existem e onde acontecem; as datas ainda não chegaram aqui. Ficam nomeados,
            porque uma lista que só mostra o que corre bem esconde metade da região.
          </p>

          <ul className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {semDatas.map((item) => (
              <li key={item.id} className="border-b border-border pb-3">
                <Link
                  href={`/ciclo/${item.id}`}
                  className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
                >
                  {item.name}
                </Link>
                <p className="text-sm text-muted">
                  {formatSeriesKind(item.kind)} · {onde(item)} · {quandoDoCiclo(undefined, hoje)}
                </p>
                {item.description ? (
                  <p className="mt-1 text-sm text-muted">{item.description}</p>
                ) : null}
                {item.website_url ? <SitioOficial url={item.website_url} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {series.length > 0 ? (
        <NotaDiscreta className="mt-10">
          Quem organiza um destes — ou outro que aqui falte — pode enviar-nos as datas por email;{' '}
          <Link href="/submeter" className="underline underline-offset-4">
            está explicado em duas linhas
          </Link>
          . Os que estão sem datas são os que ainda não têm uma fonte de onde a agenda as possa ler
          sem as copiar à mão.
          {haFontes ? (
            <>
              {' '}
              <Link href="/fontes" className="underline underline-offset-4">
                De onde vêm os eventos
              </Link>{' '}
              explica que fontes a agenda lê hoje.
            </>
          ) : null}
        </NotaDiscreta>
      ) : null}
    </>
  );
}
