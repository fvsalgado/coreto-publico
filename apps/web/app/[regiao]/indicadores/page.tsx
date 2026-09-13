import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { ENVIESAMENTOS, INDICADORES, O_QUE_NAO_DIZ } from '@/src/lib/indicadores';
import { exigirRegiao } from '@/src/lib/queries/regioes';

export const metadata: Metadata = {
  title: 'O que cada número conta',
  description:
    'A ficha técnica dos indicadores do relatório mensal do Coreto: campo a campo, o que conta, o que não conta, sobre que universo e com que periodicidade — e o enviesamento conhecido de cada contagem.',
  alternates: { canonical: '/indicadores' },
  /*
   * Fora dos motores de busca, e é decisão e não esquecimento: quem procura a
   * agenda de um concelho não procura isto, e uma ficha técnica a competir nas
   * buscas pelo nome da CIM com as páginas que interessam a quem procura
   * programação é um mau negócio para as duas. Chega-se aqui pelo relatório e
   * por ligação. `follow`, porque as ligações daqui são boas.
   */
  robots: { index: false, follow: true },
};

/**
 * A ficha técnica dos indicadores, com endereço público.
 *
 * **Porquê pública, e não um documento no repositório.** Esteve escrita em
 * `docs/INDICADORES.md` durante exatamente um commit, e não servia: o
 * repositório é privado, e quem precisa desta página é quem tem de defender
 * estes números numa assembleia intermunicipal sem ter acesso a ele. Com o
 * método publicado, quem cita o Coreto cita-o corretamente, e quem o quiser
 * atacar tem de atacar o método — que está escrito.
 *
 * **Sem `exigirSeccao`, de propósito.** Não é de nenhuma secção e não se
 * desliga no painel: o relatório mensal aponta para aqui, e uma ligação que um
 * botão transforma em 404 é pior do que não a haver. Mesma razão da
 * `/acessibilidade`.
 *
 * Fora dos motores de busca: quem procura a agenda de um concelho não procura
 * isto, e uma ficha técnica a competir nas buscas pelo nome da CIM com as
 * páginas que interessam a quem procura programação seria um mau negócio para
 * as duas. `follow`, porque as ligações daqui são boas.
 */
export const revalidate = 86_400;

type Props = { params: Promise<{ regiao: string }> };

export default async function IndicadoresPage({ params }: Props) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);

  return (
    <article className="max-w-2xl">
      <PageHeader
        title="O que cada número conta"
        eyebrow="A ficha técnica"
        lead={`O relatório mensal ${regiao.doNome} é a peça que se anexa quando é preciso justificar o que se pagou. Quase todos os seus números respondem a uma pergunta ligeiramente diferente da que o nome sugere — esta página diz qual.`}
      />

      <p className="mt-6 max-w-prose text-muted">
        Somar colunas de blocos diferentes dá um número que não quer dizer nada, e o erro não é de
        quem soma. Onde a periodicidade diz «do mês», o corte é sempre do primeiro dia do mês ao
        primeiro dia do mês seguinte, à meia-noite UTC.
      </p>

      {INDICADORES.map((bloco) => (
        <section key={bloco.bloco} aria-labelledby={bloco.bloco} className="mt-10">
          <h2 id={bloco.bloco} className="ct-heading">
            {bloco.titulo}
          </h2>
          <p className="ct-eyebrow mt-1">
            <code className="font-mono">{bloco.bloco}</code>
          </p>

          {bloco.prosa.map((paragrafo) => (
            <p key={paragrafo} className="mt-2 max-w-prose text-muted">
              {paragrafo}
            </p>
          ))}

          {bloco.universo || bloco.periodicidade || bloco.deOndeVem ? (
            <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              {bloco.universo ? (
                <>
                  <dt className="font-semibold">Universo</dt>
                  <dd className="text-muted">{bloco.universo}</dd>
                </>
              ) : null}
              {bloco.periodicidade ? (
                <>
                  <dt className="font-semibold">Periodicidade</dt>
                  <dd className="text-muted">{bloco.periodicidade}</dd>
                </>
              ) : null}
              {bloco.deOndeVem ? (
                <>
                  <dt className="font-semibold">De onde vem</dt>
                  <dd className="text-muted">{bloco.deOndeVem}</dd>
                </>
              ) : null}
            </dl>
          ) : null}

          <ul className="mt-4 space-y-3">
            {bloco.campos.map((campo) => (
              <li key={campo.campo} className="rounded border border-border px-4 py-3">
                <p className="font-mono text-sm break-all">{campo.campo}</p>
                <p className="mt-1 text-sm">{campo.conta}</p>
                {campo.naoConta ? (
                  <p className="mt-1 text-sm text-muted">
                    <span className="font-semibold">O que não conta: </span>
                    {campo.naoConta}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section aria-labelledby="enviesamento" className="mt-12 border-t border-border pt-8">
        <h2 id="enviesamento" className="ct-heading">
          O enviesamento que se conhece
        </h2>
        <p className="mt-2 max-w-prose text-muted">
          Dito antes de alguém o descobrir. É a diferença entre um número que resiste a uma pergunta
          numa assembleia e um número que se desfaz à primeira.
        </p>
        <ul className="mt-4 space-y-4">
          {ENVIESAMENTOS.map((item) => (
            <li key={item.titulo}>
              <h3 className="font-semibold">{item.titulo}</h3>
              <p className="mt-1 max-w-prose text-muted">{item.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="nao-diz" className="mt-12 border-t border-border pt-8">
        <h2 id="nao-diz" className="ct-heading">
          O que este relatório não diz
        </h2>
        <ul className="mt-4 space-y-4">
          {O_QUE_NAO_DIZ.map((item) => (
            <li key={item.titulo}>
              <h3 className="font-semibold">{item.titulo}</h3>
              <p className="mt-1 max-w-prose text-muted">{item.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-12 border-t border-border pt-4 text-sm text-muted">
        <p>
          De onde vem cada linha da agenda está em{' '}
          <Link href="/fontes" className="underline underline-offset-4">
            De onde vêm os eventos
          </Link>
          , e se a recolha está a correr, em{' '}
          <Link href="/estado" className="underline underline-offset-4">
            Estado
          </Link>
          .
        </p>
      </footer>
    </article>
  );
}
