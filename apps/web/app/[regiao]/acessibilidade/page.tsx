import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { Pontos } from '@/src/components/informacoes/Pontos';
import { PorExtenso } from '@/src/components/informacoes/PorExtenso';
import { ACESSIBILIDADE, FEITO, LIMITACOES } from '@/src/components/informacoes/acessibilidade';
import { formatLongDate } from '@/src/lib/format';
import { exigirRegiao } from '@/src/lib/queries/regioes';
import { seccaoLigada } from '@/src/lib/queries/seccoes';
import { ELABORACAO_ACESSIBILIDADE, REVISAO_ACESSIBILIDADE } from '@/src/lib/revisao';

export const metadata: Metadata = {
  title: 'Acessibilidade',
  description:
    'Como está a acessibilidade do Coreto: o que está feito, o que falta e a quem escrever quando alguma coisa não se consegue usar. A declaração de acessibilidade por extenso.',
  alternates: { canonical: '/acessibilidade' },
};

/**
 * A declaração de acessibilidade, com endereço próprio.
 *
 * Viveu dentro de `/informacoes` pela mesma razão que a política de
 * privacidade, e saiu de lá pela mesma: as informações desligam-se no painel
 * e, desligadas, respondem 404. O Decreto-Lei n.º 83/2018 quer a declaração
 * publicada e alcançável de qualquer página do sítio, e um endereço que um
 * botão do painel transforma em 404 não é isso.
 *
 * Sem `exigirSeccao`, de propósito: a página não é de nenhuma secção e não se
 * desliga. O rodapé, que está em todas as páginas, é o que a torna alcançável
 * de qualquer uma. `/informacoes#acessibilidade` guarda o resumo e aponta
 * para aqui; o texto por extenso está só aqui, para não haver duas cópias a
 * divergir.
 */
export default async function AcessibilidadePage({
  params,
}: {
  params: Promise<{ regiao: string }>;
}) {
  const { regiao: regiaoId } = await params;
  const regiao = await exigirRegiao(regiaoId);

  // A ligação de volta às informações só se desenha quando a página existe:
  // é uma secção que se desliga no painel, e esta não.
  const haInformacoes = await seccaoLigada(regiao.id, 'informacoes');
  const EMAIL = regiao.email;
  const promotor = regiao.promotor;

  return (
    <article className="max-w-2xl">
      <PageHeader
        title="Acessibilidade"
        eyebrow="O projeto"
        lead="Como está a acessibilidade deste sítio: o que está feito, o que falta e a quem escrever quando alguma coisa não se consegue usar. Primeiro em quatro pontos; a declaração por extenso logo a seguir."
      />

      <p className="text-muted">
        O Coreto pretende cumprir o nível AA das WCAG 2.1 e considera-se{' '}
        <strong className="text-ink">parcialmente conforme</strong>. Dizer «conforme» sem
        verificação de fora seria mais simpático e menos verdadeiro.
      </p>
      <Pontos pontos={ACESSIBILIDADE} />

      <p className="mt-5 rounded border border-border bg-accent-soft p-4 text-sm">
        <strong>Encontrou uma barreira?</strong> Uma página que não consegue navegar com teclado, um
        texto que o leitor de ecrã não anuncia, um contraste insuficiente — escreva para{' '}
        {EMAIL ? (
          <a href={`mailto:${EMAIL}`} className="underline underline-offset-4">
            {EMAIL}
          </a>
        ) : (
          'o email da agenda'
        )}
        , de preferência com o endereço da página e o que estava a tentar fazer. Respondemos em 15
        dias úteis.
      </p>

      <PorExtenso titulo="A declaração de acessibilidade por extenso">
        <p>
          {promotor
            ? `O Coreto, promovido pela ${promotor.nome}, compromete-se a `
            : 'O Coreto compromete-se a '}
          disponibilizar este sítio em conformidade com o Decreto-Lei n.º 83/2018, de 19 de outubro,
          que transpõe a Diretiva (UE) 2016/2102.{' '}
          {regiao.dominio
            ? `Esta declaração aplica-se ao sítio ${regiao.dominio} e a todas as suas páginas.`
            : 'Esta declaração aplica-se a este sítio e a todas as suas páginas.'}
        </p>

        <h2 className="pt-2 font-semibold">Estado de conformidade</h2>
        <p>
          <strong>Parcialmente conforme</strong> com as Recomendações de Acessibilidade para o
          Conteúdo da Web, versão 2.1, nível AA: o sítio foi construído desde o início segundo esses
          critérios, mas não passou por auditoria independente nem por testes com pessoas que usam
          tecnologias de apoio.
        </p>

        <h2 className="pt-2 font-semibold">O que está feito</h2>
        <ul className="list-disc space-y-2 pl-5">
          {FEITO.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="pt-2 font-semibold">Limitações conhecidas</h2>
        <ul className="list-disc space-y-2 pl-5">
          {LIMITACOES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="pt-2 font-semibold">Como reportar um problema</h2>
        <p>
          Escreva para{' '}
          {EMAIL ? (
            <a href={`mailto:${EMAIL}`} className="underline underline-offset-4">
              {EMAIL}
            </a>
          ) : (
            'o email da agenda'
          )}
          . Respondemos no prazo de 15 dias úteis. Se o pedido for complexo e esse prazo não chegar,
          informamos da prorrogação e do novo prazo, nunca superior a mais 15 dias úteis. Se não
          obtiver resposta ou se a resposta não for satisfatória, pode apresentar queixa à ARTE —
          Agência para a Reforma Tecnológica do Estado, I. P., a entidade responsável pela
          supervisão do cumprimento do Decreto-Lei n.º 83/2018 (as declarações anteriores a 2026
          chamavam-lhe Agência para a Modernização Administrativa).
        </p>

        <h2 className="pt-2 font-semibold">Denúncia de situações de discriminação</h2>
        <p>
          Nos termos do n.º 1 do artigo 13.º do Decreto-Lei n.º 83/2018, de 19 de outubro, quem for
          objeto de um tratamento menos favorável do que aquele que é dado a outra pessoa em
          situação comparável, e isso constitua uma prática discriminatória contra pessoas com
          deficiência prevista e punida no artigo 4.º da Lei n.º 46/2006, de 28 de agosto, pode
          apresentar queixa nos termos do Decreto-Lei n.º 34/2007, de 15 de fevereiro. O{' '}
          <a
            href="https://www.inr.pt/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Instituto Nacional para a Reabilitação (INR, I. P.)
          </a>{' '}
          disponibiliza um formulário para denunciar situações de discriminação e encaminha as
          queixas às entidades competentes.
        </p>

        <h2 className="pt-2 font-semibold">Elaboração desta declaração</h2>
        <p>
          Elaborada a{' '}
          <time dateTime={ELABORACAO_ACESSIBILIDADE}>
            {formatLongDate(ELABORACAO_ACESSIBILIDADE)}
          </time>{' '}
          e revista pela última vez a{' '}
          <time dateTime={REVISAO_ACESSIBILIDADE}>{formatLongDate(REVISAO_ACESSIBILIDADE)}</time>,
          com base numa autoavaliação feita durante o desenvolvimento: verificação manual da
          navegação por teclado, dos contrastes e da estrutura de cabeçalhos, página a página, e uma
          auditoria automática que corre em cada alteração, a 360 e a 1280 pixéis de largura, sobre
          uma página de cada tipo que o sítio tem — as páginas fixas, uma ficha de evento, uma ficha
          de espaço, um concelho e um ciclo, e ainda a gaveta de navegação e o painel do mapa, que
          só existem depois de alguém lhes tocar. Será revista sempre que houver alterações
          relevantes e, no mínimo, uma vez por ano.
        </p>
      </PorExtenso>

      <p className="mt-10 text-sm text-muted">
        A política de privacidade tem a sua própria página, em{' '}
        <Link href="/privacidade" className="underline underline-offset-4">
          /privacidade
        </Link>
        {haInformacoes ? (
          <>
            . O que é o Coreto, porque se chama assim e quem o faz está nas{' '}
            <Link href="/informacoes" className="underline underline-offset-4">
              informações
            </Link>
          </>
        ) : null}
        .
      </p>
    </article>
  );
}
