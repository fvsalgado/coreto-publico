import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/src/components/PageHeader';
import { ativarConta } from '@/src/lib/admin/acoes-das-contas';
import { isAdminConfigured } from '@/src/lib/admin/auth';
import { tokenDeConviteValido } from '@/src/lib/admin/papeis';
import { PALAVRA_PASSE_MINIMA } from '@/src/lib/admin/password';
import { faltaNoEsquema } from '@/src/lib/admin/pessoas';
import { hasServiceRole } from '@/src/lib/env';
import { adminClient } from '@/src/lib/supabase/server';
import { sha256Hex } from '@/src/lib/token-assinado';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Ativar a conta' };

interface Props {
  searchParams: Promise<{ t?: string; erro?: string }>;
}

const CAMPO =
  'mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';

const ERROS: Record<string, string> = {
  curta: `A palavra-passe tem de ter pelo menos ${PALAVRA_PASSE_MINIMA} caracteres.`,
  longa: 'A palavra-passe tem de ter no máximo 200 caracteres.',
  diferentes: 'As duas palavras-passe não são iguais — escreve a mesma nas duas caixas.',
};

/**
 * O nome de quem a ligação convida, ou `null` quando ela já não vale.
 *
 * Diz-se o nome a quem traz a ligação — é a pessoa dela —, e mais nada: nem o
 * email, nem os papéis. Uma ligação que não vale tem uma frase só, como na
 * base, venha ela usada, anulada, expirada ou inventada.
 */
async function quemConvida(token: string): Promise<string | null> {
  if (!tokenDeConviteValido(token)) return null;
  const supabase = adminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('admin_convites')
    .select('usado_em, anulado_em, expira_em, admin_pessoas(nome, desativada_em)')
    .eq('token_sha256', await sha256Hex(token))
    .maybeSingle();
  if (error) {
    if (faltaNoEsquema(error)) return null;
    throw new Error(error.message);
  }
  type Linha = {
    usado_em: string | null;
    anulado_em: string | null;
    expira_em: string;
    admin_pessoas: { nome: string; desativada_em: string | null } | null;
  };
  const linha = data as unknown as Linha | null;
  if (!linha || linha.usado_em || linha.anulado_em || Date.parse(linha.expira_em) <= Date.now()) {
    return null;
  }
  if (!linha.admin_pessoas || linha.admin_pessoas.desativada_em) return null;
  return linha.admin_pessoas.nome;
}

/**
 * Onde uma pessoa convidada escolhe a sua palavra-passe (0170).
 *
 * Abre sem sessão — é a segunda das duas páginas do painel que o fazem —, e a
 * guarda é a ligação: 32 bytes aleatórios de uso único, de que a base guarda
 * só o sha256. A palavra-passe escolhida aqui faz-se scrypt no servidor e é
 * esse hash, e só ele, que chega à base. Depois de a escolher, a pessoa já
 * está dentro.
 */
export default async function Ativar({ searchParams }: Props) {
  const { t = '', erro } = await searchParams;

  if (!isAdminConfigured() || !hasServiceRole) {
    return (
      <>
        <PageHeader title="Ativar a conta" eyebrow="Coreto" />
        <p className="max-w-prose text-muted">O painel ainda não está configurado.</p>
      </>
    );
  }

  const nome = await quemConvida(t);
  if (!nome || erro === 'ligacao') {
    return (
      <>
        <PageHeader title="Esta ligação já não vale" eyebrow="Coreto" />
        <p className="max-w-prose text-muted">
          As ligações de ativação valem sete dias e uma vez só, e uma ligação nova anula as
          anteriores. Pede outra a quem te convidou para o painel. Se já escolheste a palavra-passe,
          entra com ela.
        </p>
        <p className="mt-4">
          <Link
            href="/admin/entrar"
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Entrar no painel
          </Link>
        </p>
      </>
    );
  }

  const mensagem = erro ? ERROS[erro] : undefined;

  return (
    <>
      <PageHeader
        title="Ativar a conta"
        eyebrow="Coreto"
        lead={`Olá, ${nome}. Escolhe a palavra-passe com que vais entrar no painel. Só quem a escolhe a fica a saber: nem quem te convidou a consegue ler.`}
      />

      {mensagem ? (
        <p
          role="alert"
          className="mb-4 max-w-sm rounded border border-highlight px-3 py-2 text-highlight"
        >
          {mensagem}
        </p>
      ) : null}

      <form action={ativarConta} className="max-w-sm">
        <input type="hidden" name="t" value={t} />
        <label htmlFor="senha" className="block text-sm font-medium">
          Palavra-passe nova
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          minLength={PALAVRA_PASSE_MINIMA}
          maxLength={200}
          autoComplete="new-password"
          aria-describedby="senha-ajuda"
          className={CAMPO}
        />
        <p id="senha-ajuda" className="mt-1 text-sm text-muted">
          Pelo menos {PALAVRA_PASSE_MINIMA} caracteres. Uma frase de quatro palavras serve, e
          lembra-se melhor do que uma sigla.
        </p>
        <label htmlFor="senha_repetida" className="mt-4 block text-sm font-medium">
          A mesma palavra-passe, outra vez
        </label>
        <input
          id="senha_repetida"
          name="senha_repetida"
          type="password"
          required
          minLength={PALAVRA_PASSE_MINIMA}
          maxLength={200}
          autoComplete="new-password"
          className={CAMPO}
        />
        <button
          type="submit"
          className="mt-4 inline-flex min-h-11 items-center rounded bg-accent px-4 text-sm font-medium text-on-accent"
        >
          Guardar e entrar
        </button>
      </form>
    </>
  );
}
