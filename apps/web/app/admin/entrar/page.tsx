import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/src/components/PageHeader';
import { entrar } from '@/src/lib/admin/acoes-das-contas';
import { currentAdmin } from '@/src/lib/admin/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Entrar no painel' };

interface Props {
  searchParams: Promise<{ destino?: string; erro?: string; ate?: string }>;
}

/** Só caminhos internos. Um `destino` externo virava isto num redirecionador. */
function safeDestination(destino: string | undefined): string {
  if (!destino || !destino.startsWith('/admin') || destino.startsWith('//')) return '/admin';
  return destino;
}

/**
 * As mensagens de uma entrada recusada.
 *
 * **Uma só para qualquer engano**, e é de propósito: «este email não tem
 * conta» e «a palavra-passe está errada» diziam a quem tenta quais são os
 * emails das contas. A do limite diz a hora, que é o que quem está do outro
 * lado precisa de saber, e diz porquê — sem sugerir um ataque a uma equipa que
 * só se enganou a escrever (C4-016).
 */
function mensagem(erro: string | undefined, ate: string | undefined): string | null {
  if (erro === 'credenciais') return 'O email ou a palavra-passe não estão certos.';
  if (erro === 'demasiadas') {
    const hora = ate && /^\d{2}h\d{2}$/.test(ate) ? ate : null;
    return (
      'Foram feitas demasiadas tentativas com a palavra-passe errada, a partir desta rede ou ' +
      `para este email. ${hora ? `Podes voltar a tentar às ${hora}.` : 'Podes voltar a tentar daqui a um quarto de hora.'}`
    );
  }
  if (erro === 'configuracao') return 'O painel ainda não está configurado.';
  return null;
}

const CAMPO =
  'mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';

export default async function Entrar({ searchParams }: Props) {
  const gate = await currentAdmin();
  if (gate.ok) redirect('/admin');

  const params = await searchParams;

  if (gate.reason === 'unconfigured') {
    return (
      <>
        <PageHeader title="Painel por configurar" eyebrow="Coreto" />
        <p className="max-w-prose text-muted">
          Faltam as variáveis <code>ADMIN_PASSWORD_HASH</code> e <code>ADMIN_SESSION_SECRET</code>.
          A primeira gera-se com <code>pnpm dlx tsx scripts/hash-password.ts</code>; a segunda é uma
          cadeia aleatória com pelo menos 32 caracteres. Enquanto faltarem, esta área não abre — que
          é o comportamento pretendido.
        </p>
      </>
    );
  }

  const erro = mensagem(params.erro, params.ate);

  return (
    <>
      {/* Com a marca do produto e o nome da área (C4-026): a página dizia só
          «Entrar», sem dizer onde. */}
      <PageHeader title="Entrar no painel" eyebrow="Coreto" />

      {erro ? (
        <p
          role="alert"
          className="mb-4 max-w-sm rounded border border-highlight px-3 py-2 text-highlight"
        >
          {erro}
        </p>
      ) : null}

      <form action={entrar} className="max-w-sm">
        <input type="hidden" name="destino" value={safeDestination(params.destino)} />
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          spellCheck={false}
          className={CAMPO}
        />
        <label htmlFor="password" className="mt-4 block text-sm font-medium">
          Palavra-passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={CAMPO}
        />
        <button
          type="submit"
          className="mt-4 inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent"
        >
          Entrar
        </button>
      </form>

      {/*
        Não há «recuperar a palavra-passe» por email, e é de propósito: o
        painel não envia correio. Quem convidou gera uma ligação nova, e a
        palavra-passe antiga deixa de valer quando a nova for escolhida.
      */}
      <p className="mt-6 max-w-sm text-sm text-muted">
        Esqueceste-te da palavra-passe? Pede uma ligação nova a quem te convidou para o painel — a
        antiga deixa de valer quando escolheres a nova.
      </p>
    </>
  );
}
