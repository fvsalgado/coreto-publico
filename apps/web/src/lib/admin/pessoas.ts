import 'server-only';
import { exigirLeitura } from '../queries/falhas';
import { reportarErro } from '../registo';
import { adminClient, requireAdminClient } from '../supabase/server';
import { ehPapel, type Papel, type PapelNaRegiao } from './papeis';

/**
 * As pessoas do painel, tal como a base as guarda (0170).
 *
 * Tudo pela chave de serviço e sem cache, como o resto do painel: desativar
 * uma pessoa ou tirar-lhe um papel tem de valer no clique seguinte, e uma
 * cache de cinco minutos era uma porta aberta cinco minutos depois de alguém a
 * fechar.
 *
 * **Sem as tabelas, não há pessoas — e não é um erro.** O código chega a
 * produção antes da migração (o portão do CI só deixa passar depois de o dono
 * a aplicar, e o deploy pode chegar primeiro). Nesse intervalo, a entrada não
 * encontra pessoa nenhuma e cai na senha do dono, que é o painel de hoje.
 * Nenhum outro erro se engole: «não consegui ler» continua a não ser «não
 * há» (`queries/falhas.ts`).
 */

/**
 * Os códigos de «essa tabela, ou essa função, ainda não existe».
 *
 * O `PGRST200` está cá por ter sido medido, e não suposto: a leitura de uma
 * pessoa traz os papéis embebidos (`admin_papeis(...)`), e numa base sem a
 * 0170 o PostgREST não responde «a tabela não existe» — responde «não encontro
 * a relação entre as duas», antes de chegar a perguntar à base. Sem ele, a
 * entrada de quem se enganava na palavra-passe rebentava em vez de dizer que
 * se enganou, no intervalo entre o deploy e a migração.
 */
const FALTA_NO_ESQUEMA = new Set(['42P01', 'PGRST205', 'PGRST200', '42883', 'PGRST202']);

export function faltaNoEsquema(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && FALTA_NO_ESQUEMA.has(error.code));
}

export interface PessoaGuardada {
  id: string;
  email: string;
  nome: string;
  senha_hash: string | null;
  ativada_em: string | null;
  desativada_em: string | null;
  criada_em: string;
  criada_por: string;
  ultimo_acesso: string | null;
  papeis: PapelNaRegiao[];
}

const COLUNAS =
  'id, email, nome, senha_hash, ativada_em, desativada_em, criada_em, criada_por, ultimo_acesso, admin_papeis(region_id, papel)';

type Linha = Omit<PessoaGuardada, 'papeis'> & {
  admin_papeis: Array<{ region_id: string; papel: string }> | null;
};

function dalinha(linha: Linha): PessoaGuardada {
  const { admin_papeis, ...resto } = linha;
  return {
    ...resto,
    // Um papel que a base não conhecesse não chega a ser papel: a restrição
    // da tabela já o recusa, e isto é a mesma regra do lado de cá.
    papeis: (admin_papeis ?? [])
      .filter((papel) => ehPapel(papel.papel))
      .map((papel) => ({ region_id: papel.region_id, papel: papel.papel as Papel })),
  };
}

/** Uma pessoa pelo identificador, com os papéis — ou `null`. */
export async function lerPessoa(id: string): Promise<PessoaGuardada | null> {
  const supabase = adminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('admin_pessoas')
    .select(COLUNAS)
    .eq('id', id)
    .maybeSingle();
  if (faltaNoEsquema(error)) return null;
  exigirLeitura('lerPessoa', error);
  return data ? dalinha(data as unknown as Linha) : null;
}

/** Uma pessoa pelo email, sem distinguir maiúsculas — ou `null`. */
export async function lerPessoaPorEmail(email: string): Promise<PessoaGuardada | null> {
  const supabase = adminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('admin_pessoas')
    .select(COLUNAS)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (faltaNoEsquema(error)) return null;
  exigirLeitura('lerPessoaPorEmail', error);
  return data ? dalinha(data as unknown as Linha) : null;
}

/** Uma ligação de ativação, sem o hash — só o que o painel mostra. */
export interface ConviteResumo {
  pessoa_id: string;
  criado_em: string;
  expira_em: string;
  usado_em: string | null;
  anulado_em: string | null;
}

export interface PessoaNaLista extends PessoaGuardada {
  /** A ligação mais recente, se houver — para dizer «convidada a…». */
  convite: ConviteResumo | null;
}

/**
 * Todas as pessoas, para a página que as gere — com a ligação mais recente de
 * cada uma. `null` quando as tabelas ainda não existem: a página diz então
 * que a base ainda não tem as contas, em vez de uma lista vazia.
 */
export async function listarPessoas(): Promise<PessoaNaLista[] | null> {
  const supabase = requireAdminClient();
  const [pessoas, convites] = await Promise.all([
    supabase.from('admin_pessoas').select(COLUNAS).order('nome'),
    supabase
      .from('admin_convites')
      .select('pessoa_id, criado_em, expira_em, usado_em, anulado_em')
      .order('criado_em', { ascending: false }),
  ]);
  if (faltaNoEsquema(pessoas.error) || faltaNoEsquema(convites.error)) return null;
  exigirLeitura('listarPessoas', pessoas.error);
  exigirLeitura('listarPessoas (convites)', convites.error);

  const maisRecente = new Map<string, ConviteResumo>();
  for (const convite of (convites.data ?? []) as ConviteResumo[]) {
    if (!maisRecente.has(convite.pessoa_id)) maisRecente.set(convite.pessoa_id, convite);
  }
  return ((pessoas.data ?? []) as unknown as Linha[]).map((linha) => {
    const pessoa = dalinha(linha);
    return { ...pessoa, convite: maisRecente.get(pessoa.id) ?? null };
  });
}

/** O estado de uma pessoa numa palavra — o que a lista mostra. */
export type EstadoDaPessoa = 'convidada' | 'ativa' | 'desativada';

export function estadoDaPessoa(
  pessoa: Pick<PessoaGuardada, 'senha_hash' | 'desativada_em'>,
): EstadoDaPessoa {
  if (pessoa.desativada_em) return 'desativada';
  return pessoa.senha_hash ? 'ativa' : 'convidada';
}

/**
 * Regista a entrada de alguém. Não lança: uma entrada certa não pode falhar
 * porque a auditoria não escreveu — e antes da 0170 a função nem existe.
 */
export async function registarAcesso(pessoaId: string | null, actor: string): Promise<void> {
  const supabase = adminClient();
  if (!supabase) return;
  const { error } = await supabase.rpc('admin_registar_acesso', {
    p_pessoa: pessoaId,
    p_actor: actor,
  });
  if (error && !faltaNoEsquema(error)) reportarErro('admin_registar_acesso', error);
}
