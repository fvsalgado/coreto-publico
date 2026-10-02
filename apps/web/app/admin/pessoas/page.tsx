import type { Metadata } from 'next';
import { BotaoDeCopiar } from '@/src/components/BotaoDeCopiar';
import { PageHeader } from '@/src/components/PageHeader';
import { SemAcessoNoPainel } from '@/src/components/SemAcessoNoPainel';
import { SemChaveDeServico } from '@/src/components/SemChaveDeServico';
import {
  convidarPessoa,
  gerarLigacaoNova,
  mudarEstadoDaPessoa,
  mudarPapeis,
} from '@/src/lib/admin/acoes-das-contas';
import { exigirSessao } from '@/src/lib/admin/auth';
import { PAPEIS, papelNaRegiao, type PapelNaRegiao } from '@/src/lib/admin/papeis';
import { estadoDaPessoa, listarPessoas, type PessoaNaLista } from '@/src/lib/admin/pessoas';
import { listRegionsAdmin, type RegionAdminRow } from '@/src/lib/admin/queries';
import { hasServiceRole } from '@/src/lib/env';
import { emNome } from '@/src/lib/artigos';
import { formatLongDate } from '@/src/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Pessoas' };

interface Props {
  searchParams: Promise<{ aviso?: string; ligacao?: string; pessoa?: string }>;
}

const CAMPO =
  'mt-1 min-h-11 w-full rounded border border-field bg-surface px-3 py-2 text-base text-ink';
const BOTAO =
  'inline-flex min-h-11 items-center rounded border border-field px-4 text-sm font-medium hover:bg-surface';

/** Uma data e hora de Lisboa, por extenso — «2 de outubro de 2026, 10h42». */
function quando(iso: string | null): string {
  if (!iso) return 'nunca';
  const data = new Date(iso);
  const hora = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(data)
    .replace(':', 'h');
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(data);
  return `${formatLongDate(dia)}, ${hora}`;
}

/** O estado da conta, numa frase que diz o que fazer a seguir. */
function frasesDoEstado(pessoa: PessoaNaLista): { rotulo: string; nota: string } {
  const estado = estadoDaPessoa(pessoa);
  if (estado === 'desativada') {
    return { rotulo: 'Desativada', nota: `Desde ${quando(pessoa.desativada_em)}. Não entra.` };
  }
  if (estado === 'ativa') {
    return { rotulo: 'Ativa', nota: `Último acesso: ${quando(pessoa.ultimo_acesso)}.` };
  }
  const convite = pessoa.convite;
  if (
    convite &&
    !convite.usado_em &&
    !convite.anulado_em &&
    Date.parse(convite.expira_em) > Date.now()
  ) {
    return {
      rotulo: 'Convidada',
      nota: `Ainda não escolheu a palavra-passe. A ligação vale até ${quando(convite.expira_em)}.`,
    };
  }
  return {
    rotulo: 'Convidada',
    nota: 'Ainda não escolheu a palavra-passe, e a ligação já não vale — gere uma nova.',
  };
}

/** Os papéis de uma pessoa, por região, numa linha. */
function resumoDosPapeis(
  papeis: readonly PapelNaRegiao[],
  regioes: readonly RegionAdminRow[],
): string {
  if (papeis.length === 0) return 'Sem papel em nenhuma região — entra e não vê nada.';
  return papeis
    .map((papel) => {
      const nome = regioes.find((regiao) => regiao.id === papel.region_id)?.name ?? papel.region_id;
      const regiao = regioes.find((linha) => linha.id === papel.region_id);
      return `${PAPEIS[papel.papel].nome} ${regiao ? emNome(regiao.name, regiao.article) : `em ${nome}`}`;
    })
    .join(' · ');
}

/** Um `<select>` por região: sem papel, editor ou gestor. */
function SeletoresDePapel({
  regioes,
  papeis,
  prefixo,
}: {
  regioes: readonly RegionAdminRow[];
  papeis: readonly PapelNaRegiao[];
  prefixo: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {regioes.map((regiao) => (
        <div key={regiao.id}>
          <label htmlFor={`${prefixo}-${regiao.id}`} className="block text-sm font-medium">
            {regiao.name}
          </label>
          <select
            id={`${prefixo}-${regiao.id}`}
            name={`papel:${regiao.id}`}
            defaultValue={papelNaRegiao(papeis, regiao.id) ?? ''}
            className={CAMPO}
          >
            <option value="">Sem papel</option>
            <option value="editor">{PAPEIS.editor.nome}</option>
            <option value="gestor">{PAPEIS.gestor.nome}</option>
          </select>
        </div>
      ))}
    </div>
  );
}

/**
 * As pessoas que entram no painel, e o que cada uma pode (C4-015, 0170).
 *
 * Só o dono vê esta página: dar e tirar acesso é uma decisão de quem responde
 * pela instalação e pelos contratos, não de uma região. Cada pessoa é criada
 * aqui, com os papéis por região, e recebe uma ligação de ativação — de uso
 * único, válida sete dias — que o dono lhe envia pelos seus meios: o painel
 * não envia correio.
 */
export default async function Pessoas({ searchParams }: Props) {
  if (!hasServiceRole) return <SemChaveDeServico titulo="Pessoas" />;
  const sessao = await exigirSessao();
  if (sessao.tipo !== 'dono') return <SemAcessoNoPainel titulo="Pessoas" />;

  const [{ aviso, ligacao, pessoa: comLigacao }, pessoas, regioes] = await Promise.all([
    searchParams,
    listarPessoas(),
    listRegionsAdmin(),
  ]);
  const ligacaoValida =
    ligacao && /^https?:\/\/[^\s]+\/admin\/ativar\?t=[A-Za-z0-9_-]{43}$/.test(ligacao)
      ? ligacao
      : null;
  const convidada = pessoas?.find((linha) => linha.id === comLigacao);
  // O endereço da entrada sai da própria ligação: é o mesmo painel, no mesmo
  // anfitrião por onde o dono a gerou.
  const entrada = ligacaoValida
    ? ligacaoValida.replace(/\/admin\/ativar\?t=.*$/, '/admin/entrar')
    : '';
  const textoDoEmail =
    ligacaoValida && convidada
      ? `Olá, ${convidada.nome}.\n\nPara entrares no painel do Coreto, abre esta ligação e escolhe a tua palavra-passe:\n\n${ligacaoValida}\n\n` +
        `A ligação vale sete dias e uma vez só. Depois disso, entra em ${entrada} com o teu email e a palavra-passe que escolheste.`
      : '';

  return (
    <>
      <PageHeader
        title="Pessoas"
        lead="Quem entra no painel, e o que pode fazer em cada região. O editor modera a fila, os eventos, os espaços e as etiquetas; o gestor faz isso e gere as definições da região. As pessoas, as regiões, as licenças e a barreira ficam só com quem opera o Coreto."
      />

      {aviso ? (
        <p role="status" className="mb-6 rounded border border-border bg-surface px-3 py-2 text-sm">
          {aviso}
        </p>
      ) : null}

      {ligacaoValida ? (
        <section
          id="ligacao"
          aria-labelledby="ligacao-titulo"
          className="mb-8 max-w-2xl rounded border border-highlight bg-surface px-4 py-3 text-sm"
        >
          <h2 id="ligacao-titulo" className="font-semibold">
            A ligação de ativação, uma vez
          </h2>
          <p className="mt-1 text-muted">
            Copia-a agora: não volta a aparecer — a base guarda só uma impressão dela. Se se perder,
            gera outra; a nova anula esta.
          </p>
          <p className="mt-2 font-mono text-xs break-all select-all">{ligacaoValida}</p>
          <p className="mt-2">
            <BotaoDeCopiar
              texto={ligacaoValida}
              etiqueta="Copiar a ligação"
              anuncio="Ligação copiada"
            />
          </p>
          {textoDoEmail ? (
            <>
              <p className="mt-4 font-medium">Um texto para a mensagem</p>
              <p className="mt-1 rounded border border-border px-3 py-2 whitespace-pre-line select-all">
                {textoDoEmail}
              </p>
              <p className="mt-2">
                <BotaoDeCopiar
                  texto={textoDoEmail}
                  etiqueta="Copiar o texto"
                  anuncio="Texto copiado"
                />
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      {pessoas === null ? (
        <p className="max-w-prose rounded border border-border px-3 py-2 text-sm">
          A base ainda não tem as contas por pessoa: falta aplicar a migração 0170. Até lá, o painel
          abre só com a palavra-passe de quem o opera, como sempre abriu.
        </p>
      ) : (
        <>
          <section aria-labelledby="quem" className="mb-10">
            <h2 id="quem" className="text-lg font-semibold">
              {pessoas.length === 0
                ? 'Ainda ninguém'
                : pessoas.length === 1
                  ? 'Uma pessoa'
                  : `${pessoas.length} pessoas`}
            </h2>
            {pessoas.length === 0 ? (
              <p className="mt-1 text-sm text-muted">
                Até haver alguém, o painel abre só com a palavra-passe de quem o opera.
              </p>
            ) : null}
            <ul className="mt-3 space-y-4">
              {pessoas.map((pessoa) => {
                const estado = frasesDoEstado(pessoa);
                const desativada = estadoDaPessoa(pessoa) === 'desativada';
                return (
                  <li key={pessoa.id} className="rounded border border-border p-4">
                    <h3 className="font-semibold">
                      {pessoa.nome}{' '}
                      <span className="font-normal break-all text-muted">{pessoa.email}</span>
                    </h3>
                    <p className={`mt-1 text-sm ${desativada ? 'text-highlight' : ''}`}>
                      <strong>{estado.rotulo}.</strong>{' '}
                      <span className="text-muted">{estado.nota}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {resumoDosPapeis(pessoa.papeis, regioes)}
                    </p>

                    <details className="mt-3">
                      <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-medium">
                        Mudar os papéis
                      </summary>
                      <form action={mudarPapeis} className="mt-2 space-y-3">
                        <input type="hidden" name="pessoa" value={pessoa.id} />
                        <SeletoresDePapel
                          regioes={regioes}
                          papeis={pessoa.papeis}
                          prefixo={`p-${pessoa.id}`}
                        />
                        <button type="submit" className={BOTAO}>
                          Guardar os papéis
                        </button>
                      </form>
                    </details>

                    <div className="mt-3 flex flex-wrap items-start gap-3">
                      {!desativada ? (
                        <form action={gerarLigacaoNova}>
                          <input type="hidden" name="pessoa" value={pessoa.id} />
                          <input type="hidden" name="nome" value={pessoa.nome} />
                          <button type="submit" className={BOTAO}>
                            {pessoa.senha_hash
                              ? 'Gerar uma ligação para mudar a palavra-passe'
                              : 'Gerar uma ligação nova'}
                          </button>
                        </form>
                      ) : null}

                      {desativada ? (
                        <form action={mudarEstadoDaPessoa}>
                          <input type="hidden" name="pessoa" value={pessoa.id} />
                          <input type="hidden" name="nome" value={pessoa.nome} />
                          <input type="hidden" name="ativa" value="sim" />
                          <button type="submit" className={BOTAO}>
                            Reativar
                          </button>
                        </form>
                      ) : (
                        <form
                          action={mudarEstadoDaPessoa}
                          className="flex flex-wrap items-center gap-3"
                        >
                          <input type="hidden" name="pessoa" value={pessoa.id} />
                          <input type="hidden" name="nome" value={pessoa.nome} />
                          <input type="hidden" name="ativa" value="nao" />
                          <label className="flex min-h-11 items-center gap-2.5 text-sm">
                            <input
                              type="checkbox"
                              name="confirmo"
                              required
                              className="size-5 accent-accent"
                            />
                            Confirmo: deixa de entrar já
                          </label>
                          <button type="submit" className={BOTAO}>
                            Desativar
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="convidar" className="max-w-2xl">
            <h2 id="convidar" className="text-lg font-semibold">
              Convidar uma pessoa
            </h2>
            <p className="mt-1 text-sm text-muted">
              A pessoa recebe de si uma ligação, escolhe a palavra-passe e entra. Os papéis mudam-se
              depois, aqui, a qualquer momento — e valem no clique seguinte dela.
            </p>
            <form action={convidarPessoa} className="mt-4 space-y-4">
              <div>
                <label htmlFor="nome" className="block text-sm font-medium">
                  Nome
                </label>
                <input
                  id="nome"
                  name="nome"
                  required
                  maxLength={120}
                  autoComplete="off"
                  className={CAMPO}
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  className={CAMPO}
                />
              </div>
              <fieldset>
                <legend className="text-sm font-medium">Papel em cada região</legend>
                <p className="mb-2 text-sm text-muted">
                  {PAPEIS.editor.nome}: {PAPEIS.editor.descricao} {PAPEIS.gestor.nome}:{' '}
                  {PAPEIS.gestor.descricao}
                </p>
                <SeletoresDePapel regioes={regioes} papeis={[]} prefixo="nova" />
              </fieldset>
              <button type="submit" className={BOTAO}>
                Criar e gerar a ligação
              </button>
            </form>
          </section>
        </>
      )}
    </>
  );
}
