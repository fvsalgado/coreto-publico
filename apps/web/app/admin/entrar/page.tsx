import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { PageHeader } from '@/src/components/PageHeader';
import { currentAdmin, isAdminConfigured, startSession } from '@/src/lib/admin/auth';
import { LOGIN_ATTEMPT_LIMIT, LOGIN_ATTEMPT_WINDOW_SECONDS } from '@/src/lib/admin/session';
import { verifyPassword } from '@/src/lib/admin/password';
import { checkRateLimit } from '@/src/lib/rate-limit';
import { env } from '@/src/lib/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Entrar' };

interface Props {
  searchParams: Promise<{ destino?: string; erro?: string }>;
}

/** Só caminhos internos. Um `destino` externo virava isto num redirecionador. */
function safeDestination(destino: string | undefined): string {
  if (!destino || !destino.startsWith('/admin') || destino.startsWith('//')) return '/admin';
  return destino;
}

async function entrar(formData: FormData): Promise<void> {
  'use server';

  const destino = safeDestination(String(formData.get('destino') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!isAdminConfigured()) redirect('/admin/entrar?erro=configuracao');

  // O limite é por IP e a janela é curta: chega para travar quem tenta às
  // cegas sem trancar quem se enganou a escrever.
  const request = new Request('https://coreto.mediotejo.pt/admin/entrar', {
    headers: await headers(),
  });
  const limit = await checkRateLimit(request, {
    route: 'admin-login',
    limit: LOGIN_ATTEMPT_LIMIT,
    windowSeconds: LOGIN_ATTEMPT_WINDOW_SECONDS,
  });
  if (!limit.allowed) redirect('/admin/entrar?erro=demasiadas');

  if (!verifyPassword(password, env.ADMIN_PASSWORD_HASH as string)) {
    redirect('/admin/entrar?erro=credenciais');
  }

  await startSession('gestor');
  redirect(destino);
}

const MESSAGES: Record<string, string> = {
  credenciais: 'Palavra-passe incorreta.',
  demasiadas: 'Demasiadas tentativas. Tenta daqui a um quarto de hora.',
  configuracao: 'A área de administração ainda não está configurada.',
};

export default async function Entrar({ searchParams }: Props) {
  const gate = await currentAdmin();
  if (gate.ok) redirect('/admin');

  const params = await searchParams;

  if (gate.reason === 'unconfigured') {
    return (
      <>
        <PageHeader title="Administração por configurar" />
        <p className="max-w-prose text-muted">
          Faltam as variáveis <code>ADMIN_PASSWORD_HASH</code> e <code>ADMIN_SESSION_SECRET</code>.
          A primeira gera-se com <code>pnpm dlx tsx scripts/hash-password.ts</code>; a segunda é uma
          cadeia aleatória com pelo menos 32 caracteres. Enquanto faltarem, esta área não abre — que
          é o comportamento pretendido.
        </p>
      </>
    );
  }

  const erro = params.erro ? MESSAGES[params.erro] : undefined;

  return (
    <>
      <PageHeader title="Entrar" />

      {erro ? (
        <p role="alert" className="mb-4 rounded border border-highlight px-3 py-2 text-highlight">
          {erro}
        </p>
      ) : null}

      <form action={entrar} className="max-w-sm">
        <input type="hidden" name="destino" value={safeDestination(params.destino)} />
        <label htmlFor="password" className="block text-sm font-medium">
          Palavra-passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink"
        />
        <button
          type="submit"
          className="mt-4 inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent"
        >
          Entrar
        </button>
      </form>
    </>
  );
}
