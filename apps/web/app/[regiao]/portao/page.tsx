import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { exigirRegiao } from '@/src/lib/queries/regioes';

/**
 * A página que pede a senha de uma região tapada (0157).
 *
 * É o que quem passa vê quando uma região está pronta e ainda não contratada.
 * Diz o que é, sem fingir que é outra coisa: não é uma área de membros, não há
 * contas, não há registo. É uma senha partilhada, dita por quem mostra o
 * produto a quem o vem ver.
 *
 * **Não se desliga pelo painel e não vive numa secção.** Uma página que o
 * interruptor das secções pudesse apagar era uma região tapada sem porta.
 */
export const metadata: Metadata = {
  title: 'Agenda reservada',
  description: 'Esta agenda está reservada. É precisa uma senha para entrar.',
  robots: { index: false, follow: false },
};

const AVISOS: Record<string, string> = {
  errada: 'A senha não está certa. Confirme que é a que lhe enviaram, sem espaços à volta.',
  demasiadas:
    'Demasiadas tentativas deste endereço. Espere um quarto de hora e volte a tentar — ou peça a senha a quem lha deu.',
  'por-configurar':
    'A barreira está ligada e não há senha configurada, ou falta configuração ao servidor. Não é consigo: quem administra esta agenda tem de a repor.',
  regiao: 'Este endereço não corresponde a nenhuma agenda desta instalação.',
};

interface Props {
  params: Promise<{ regiao: string }>;
  searchParams: Promise<{ de?: string; erro?: string }>;
}

export default async function Portao({ params, searchParams }: Props) {
  const { regiao: regiaoId } = await params;
  const { de, erro } = await searchParams;
  const regiao = await exigirRegiao(regiaoId);

  /*
   * Uma região sem barreira não tem porta que pedir senha.
   *
   * Sem isto, `/portao` respondia 200 em todas as agendas abertas, com um
   * formulário a sugerir que há ali alguma coisa fechada. É o mesmo 404 das
   * secções desligadas: o endereço não significa nada aqui.
   */
  if (!regiao.barreiraLigada) notFound();

  const aviso = erro ? (AVISOS[erro] ?? AVISOS.errada) : null;

  return (
    <article className="max-w-md">
      <PageHeader
        title="Agenda reservada"
        eyebrow={regiao.nome}
        lead={`A agenda ${regiao.doNome} ainda não está aberta ao público. Quem tem a senha entra por aqui.`}
      />

      {aviso ? (
        <p
          role="alert"
          className="mb-4 rounded border border-highlight px-3 py-2 text-sm text-highlight"
        >
          {aviso}
        </p>
      ) : null}

      <form action="/api/portao" method="post">
        <input type="hidden" name="de" value={de ?? '/'} />
        <label htmlFor="senha" className="block text-sm font-medium">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          autoComplete="off"
          autoFocus
          className="mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink"
        />
        <button
          type="submit"
          className="mt-4 inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent"
        >
          Entrar
        </button>
      </form>

      <p className="text-muted mt-6 text-sm">
        A senha é a mesma para toda a gente a quem foi dada, e vale por um dia. Não é uma conta: não
        guardamos nada sobre quem entra, e nada do que escrever aqui identifica ninguém.
      </p>

      <p className="text-muted mt-3 text-sm">
        Não tem senha e acha que devia ter?{' '}
        {regiao.email ? (
          <a href={`mailto:${regiao.email}`} className="underline underline-offset-4">
            {regiao.email}
          </a>
        ) : (
          'fale com quem lhe falou desta agenda'
        )}
        .
      </p>
    </article>
  );
}
