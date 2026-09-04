import Link from 'next/link';
import { todayInLisbon } from '@coreto/core';
import { ConcelhosMarquee } from '@/src/components/ConcelhosMarquee';
import {
  colunasDoRodape,
  type Ancora,
  type Atalho,
  type SeccaoOpcional,
} from '@/src/lib/navegacao';
import { AUTOR, FEED_COPYRIGHT, PRODUTO } from '@/src/lib/produto';
import { listMunicipalities } from '@/src/lib/queries/events';
import { descricaoInstitucional, type Regiao } from '@/src/lib/regiao';

/**
 * O chão da casa.
 *
 * Saiu do `layout.tsx` quando passou a ter de decidir coisas. Enquanto era uma
 * lista de ligações vivia bem lá dentro; desde que as secções se ligam e
 * desligam no painel, o rodapé tem de se aguentar em qualquer combinação — e
 * isso é lógica, não desenho.
 */

/** Uma ligação do rodapé, que tanto pode ser um destino como uma âncora. */
type Ligacao = Atalho | Ancora;

function LigacaoDoRodape({ item }: { item: Ligacao }) {
  const classe =
    'inline-flex min-h-11 items-center underline-offset-4 hover:text-white hover:underline sm:min-h-0';
  return 'externo' in item && item.externo ? (
    <a href={item.href} className={classe}>
      {item.label}
    </a>
  ) : (
    <Link href={item.href} className={classe}>
      {item.label}
    </Link>
  );
}

export async function RodapeDoSitio({
  desligadas,
  regiao,
}: {
  desligadas: readonly SeccaoOpcional[];
  regiao: Regiao;
}) {
  // Quantas colunas aguentam, e com que nome, decide-se em `navegacao.ts`.
  const colunas = colunasDoRodape(desligadas, regiao.email);
  const emDuas = colunas.length === 2;

  // A banda dos concelhos vem da base, como tudo o que é da região. Sem base,
  // vem vazia e a banda não se desenha — o rodapé aguenta.
  const concelhos = await listMunicipalities(regiao.id);

  /*
   * A menção do cofinanciamento aparece aqui **quando `/informacoes` está
   * desligada**, e só então — e só quando a região é mesmo cofinanciada.
   *
   * A decisão de a manter fora do rodapé continua escrita em
   * `app/informacoes/page.tsx`, e continua certa: o que o artigo 50.º do
   * Regulamento (UE) 2021/1060 pede é uma descrição da operação no sítio
   * oficial, não uma tira de marcas repetida em todas as páginas. O que mudou
   * é que essa descrição vivia numa página que hoje se desliga num botão — e
   * desligá-la fazia a menção desaparecer do sítio inteiro. Quando a página
   * existe, ela cumpre e o rodapé fica leve; quando não existe, o rodapé
   * assume. Uma região sem cofinanciamento não tem menção nenhuma a assumir.
   */
  const semPaginaDeInformacoes = desligadas.includes('informacoes');
  const promotor = regiao.promotor;
  const declaracao = promotor?.declaracaoDeFinanciamento ?? null;

  return (
    <footer className="mt-14 pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:mt-16 sm:pb-0">
      {concelhos.length > 0 && (
        <ConcelhosMarquee items={concelhos.map(({ id, name }) => ({ id, name }))} />
      )}

      <div className="ct-lambrequim ct-lambrequim-flip" aria-hidden="true" />
      <div className="ct-bloco-escuro ct-grain bg-accent-deep text-white">
        <div className="ct-goteira relative z-10 mx-auto w-full max-w-5xl py-10">
          <p className="font-display max-w-2xl text-xl text-balance">
            O coreto é o palco de quem não tem palco. Está no largo, no jardim, à beira da estrada —
            e ninguém precisa de convite para lá subir.
          </p>

          <div
            className={`mt-8 grid gap-6 text-sm text-on-deep-muted ${
              emDuas ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
            }`}
          >
            <div>
              <p className="font-semibold text-white">{PRODUTO.nome}</p>
              <p className="mt-1">{descricaoInstitucional(regiao)}</p>
            </div>
            {colunas.map((coluna) => (
              <nav key={coluna.titulo} aria-labelledby={`rodape-${coluna.titulo}`}>
                <p id={`rodape-${coluna.titulo}`} className="font-semibold text-white">
                  {coluna.titulo}
                </p>
                <ul className="mt-1 sm:space-y-1">
                  {coluna.itens.map((item) => (
                    <li key={item.href}>
                      <LigacaoDoRodape item={item} />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {/*
            A assinatura e a licença, que estão em todas as páginas porque é
            aqui que se procuram. A marca da CIM já vai no toldo, em cima; o
            que faltava era dizer por extenso quem promove e sob que licença é
            que estes dados se podem levar — que até aqui só se lia dentro de
            páginas que hoje se desligam.
          */}
          <div className="mt-9 border-t border-white/15 pt-7 text-sm text-on-deep-muted">
            {promotor && semPaginaDeInformacoes && declaracao ? (
              <>
                <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
                  <div>
                    <p className="ct-sobrancelha-clara">Promovido por</p>
                    <a
                      href={promotor.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${promotor.nome} (abre noutro separador)`}
                      className="mt-3 inline-flex min-h-11 items-center rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      {promotor.logotipo ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={promotor.logotipo.sobreGrafite}
                          width={promotor.logotipo.largura}
                          height={promotor.logotipo.altura}
                          alt={promotor.nome}
                          loading="lazy"
                          decoding="async"
                          className="h-10 w-auto sm:h-11"
                        />
                      ) : (
                        <span className="font-semibold text-white">{promotor.nome}</span>
                      )}
                    </a>
                  </div>
                  {promotor.cofinanciamento && (
                    <div>
                      <p className="ct-sobrancelha-clara">Cofinanciado por</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={promotor.cofinanciamento.ficheiro}
                        width={promotor.cofinanciamento.largura}
                        height={promotor.cofinanciamento.altura}
                        alt={promotor.cofinanciamento.alt}
                        loading="lazy"
                        decoding="async"
                        className="mt-3 h-8 w-auto sm:h-10"
                      />
                    </div>
                  )}
                </div>
                <p className="mt-5 max-w-2xl">{declaracao}</p>
              </>
            ) : promotor ? (
              <p className="max-w-2xl">
                Promovido pela{' '}
                <a
                  href={promotor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-white"
                >
                  {promotor.nome}
                </a>
                .
              </p>
            ) : null}

            {/*
              A linha de crédito do produto, igual em todas as regiões: a
              região é promovida pela sua CIM, ali em cima; o software é
              desenvolvido por quem aqui está, e é dele.
            */}
            <p className="mt-5 max-w-2xl text-xs">
              {PRODUTO.nome} · {todayInLisbon().slice(0, 4)} · {FEED_COPYRIGHT} · Desenvolvido por{' '}
              <a
                href={AUTOR.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-white"
              >
                {AUTOR.nome}
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
