import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
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
    description: `Os festivais, ciclos e programas em rede ${regiao.doNome}: os que já têm programação no Coreto e os que sabemos existir e ainda não conseguimos ler.`,
    alternates: enderecos(urlDoSitio(regiao, SITE_URL), '/ciclos'),
  };
}

function ordenar(a: Series, b: Series): number {
  return a.name.localeCompare(b.name, 'pt');
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

  const comPrograma = series.filter((item) => (counts[item.id]?.total ?? 0) > 0).sort(ordenar);
  const porRecolher = series.filter((item) => (counts[item.id]?.total ?? 0) === 0).sort(ordenar);

  /**
   * O que o cartão diz por baixo do nome.
   *
   * Dizia «10 datas» e as dez já tinham passado — quem lesse esperava dez
   * espetáculos por ir ver. O arquivo e o futuro contam-se em separado, e a
   * frase diz qual é qual.
   */
  function quantas(id: string): string {
    const contagem = counts[id];
    if (!contagem) return 'sem datas registadas';

    const total = contagem.total === 1 ? 'uma data' : `${contagem.total} datas`;
    if (contagem.porAcontecer === 0) return `${total}, todas já passadas`;
    if (contagem.porAcontecer === contagem.total) return total;
    return `${total}, ${contagem.porAcontecer} por acontecer`;
  }

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

      <section aria-labelledby="com-programa">
        <h2 id="com-programa" className="ct-heading">
          Com programação registada
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          O que está no Coreto, edição a edição — incluindo o que já passou. Uma edição que
          aconteceu não desaparece: é o melhor argumento para a próxima.
        </p>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {comPrograma.map((item) => (
            <li key={item.id}>
              <article className="ct-lift relative h-full rounded-lg border border-border bg-surface p-4">
                <p className="ct-eyebrow">{formatSeriesKind(item.kind)}</p>
                <h3 className="font-display mt-1.5 text-xl leading-snug font-semibold">
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
                  {onde(item)} · {quantas(item.id)}
                </p>
              </article>
            </li>
          ))}
        </ul>
      </section>

      {porRecolher.length > 0 ? (
        <section aria-labelledby="por-recolher" className="mt-12 border-t border-border pt-8">
          <h2 id="por-recolher" className="ct-heading">
            Conhecidos, ainda por recolher
          </h2>
          <p className="mt-2 max-w-2xl text-muted">
            Sabemos que existem e sabemos onde acontecem. O que falta não é vontade — é uma fonte de
            onde ler o programa sem o copiar à mão. Ficam aqui nomeados, porque uma lista que só
            mostra o que corre bem esconde metade da região.
          </p>

          <ul className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {porRecolher.map((item) => (
              <li key={item.id} className="border-b border-border pb-3">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted">
                  {formatSeriesKind(item.kind)} · {onde(item)}
                </p>
                {item.description ? (
                  <p className="mt-1 text-sm text-muted">{item.description}</p>
                ) : null}
              </li>
            ))}
          </ul>

          <p className="mt-6 max-w-2xl text-sm text-muted">
            Quem organiza um destes — ou qualquer outro que aqui falte — pode mandar as datas por
            email.{' '}
            <Link href="/submeter" className="underline underline-offset-4">
              Está explicado em duas linhas
            </Link>
            .
            {haFontes ? (
              <>
                {' '}
                E{' '}
                <Link href="/fontes" className="underline underline-offset-4">
                  de onde vêm os eventos
                </Link>{' '}
                explica que fontes é que a agenda lê hoje, e o que falta para ler as outras.
              </>
            ) : null}
          </p>
        </section>
      ) : null}
    </>
  );
}
