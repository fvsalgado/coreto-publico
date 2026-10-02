import Link from 'next/link';
import { PageHeader } from './PageHeader';

/**
 * O que uma página do painel mostra a quem a sessão não deixa vê-la.
 *
 * As páginas que são do produto e não de uma região — as pessoas, as regiões,
 * a auditoria — são do dono. A barra não as oferece a mais ninguém, mas um
 * endereço escreve-se à mão; e um 404 a quem tem conta diria que a página não
 * existe, quando o que se passa é que não é desta conta.
 */
export function SemAcessoNoPainel({ titulo }: { titulo: string }) {
  return (
    <>
      <PageHeader title={titulo} />
      <p className="max-w-prose text-muted">
        Esta página é de quem opera o Coreto, e não desta conta. Se precisas do que está aqui,
        pede-o a quem te convidou para o painel.
      </p>
      <p className="mt-4">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Voltar ao início do painel
        </Link>
      </p>
    </>
  );
}
