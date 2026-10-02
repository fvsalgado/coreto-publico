'use server';

import { randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { env } from '../env';
import { reportarErro } from '../registo';
import { requireAdminClient } from '../supabase/server';
import { sha256Hex } from '../token-assinado';
import { COOKIE_DA_REGIAO, TODAS } from './ambito';
import {
  actorDoDonoConfigurado,
  endSession,
  exigirDono,
  exigirSessao,
  iniciarSessaoDaPessoa,
  isAdminConfigured,
  pessoaPodeEntrar,
  startSession,
} from './auth';
import { comAviso, destinoDoPainel } from './fields';
import {
  consultarLimiteDaEntrada,
  limparLimiteDoEndereco,
  registarFalhaDaEntrada,
} from './limite-da-entrada';
import { actorDaPessoa, ehPapel, emailDoDonoConfere, pode, tokenDeConviteValido } from './papeis';
import {
  gastarOMesmoTempo,
  gerarHashDaSenha,
  PALAVRA_PASSE_MINIMA,
  verifyPassword,
} from './password';
import { faltaNoEsquema, lerPessoaPorEmail, registarAcesso } from './pessoas';
import { listRegionsAdmin } from './queries';

/**
 * As ações das contas por pessoa (0170): entrar, ativar, convidar, mudar
 * papéis, gerar uma ligação nova, desativar — e escolher a região do painel.
 *
 * Cada escrita passa por uma função `admin_*` da base, que deixa a linha na
 * auditoria. Nenhuma toca nas tabelas por fora.
 */

const ENTRADA = '/admin/entrar';
const PESSOAS = '/admin/pessoas';

/** Só caminhos internos. Um `destino` externo virava isto num redirecionador. */
function destinoSeguro(destino: string | undefined): string {
  if (!destino || !destino.startsWith('/admin') || destino.startsWith('//')) return '/admin';
  return destino;
}

/**
 * Um `Request` com os cabeçalhos do pedido em curso, para o limitador ler o
 * endereço de onde vem. O endereço do pedido não conta para nada — esteve aqui
 * `https://coreto.mediotejo.pt`, o domínio de um cliente escrito à mão no
 * painel de todos (C4-016).
 */
async function pedidoEmCurso(): Promise<Request> {
  return new Request('https://painel.invalid/admin/entrar', { headers: await headers() });
}

/** A hora de Lisboa, como se diz: «10h42». */
function horaDeLisboa(iso: string | null): string | null {
  if (!iso) return null;
  const partes = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const hora = partes.find((parte) => parte.type === 'hour')?.value;
  const minuto = partes.find((parte) => parte.type === 'minute')?.value;
  return hora && minuto ? `${hora}h${minuto}` : null;
}

/**
 * Entrar: o dono pela senha do ambiente, as pessoas pela sua conta.
 *
 * A ordem é a do `CONTAS.md`. Primeiro a senha do dono — com `ADMIN_EMAIL`
 * definido, o email também tem de bater —, e só depois a pessoa pelo email. A
 * resposta a um engano é **uma só**, para qualquer engano: não diz se o email
 * existe. E custa o mesmo tempo, porque um email desconhecido também passa por
 * um scrypt (`gastarOMesmoTempo`).
 *
 * O limitador conta só as falhadas (C4-016): espreita antes, conta depois de
 * falhar, e uma entrada certa limpa o balde do endereço.
 */
export async function entrar(formData: FormData): Promise<void> {
  const destino = destinoSeguro(String(formData.get('destino') ?? ''));
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!isAdminConfigured()) redirect(`${ENTRADA}?erro=configuracao`);

  const pedido = await pedidoEmCurso();
  const limite = await consultarLimiteDaEntrada(pedido, email);
  if (!limite.permitido) {
    const hora = horaDeLisboa(limite.repoeEm);
    redirect(`${ENTRADA}?erro=demasiadas${hora ? `&ate=${encodeURIComponent(hora)}` : ''}`);
  }

  if (
    verifyPassword(password, env.ADMIN_PASSWORD_HASH as string) &&
    emailDoDonoConfere(email, env.ADMIN_EMAIL)
  ) {
    const actor = actorDoDonoConfigurado();
    await limparLimiteDoEndereco(pedido);
    await startSession(actor);
    await registarAcesso(null, actor);
    redirect(destino);
  }

  const pessoa = email ? await lerPessoaPorEmail(email) : null;
  if (pessoa && pessoaPodeEntrar(pessoa) && verifyPassword(password, pessoa.senha_hash as string)) {
    await limparLimiteDoEndereco(pedido);
    await iniciarSessaoDaPessoa({ ...pessoa, senha_hash: pessoa.senha_hash as string });
    await registarAcesso(pessoa.id, actorDaPessoa(pessoa));
    redirect(destino);
  }
  if (!pessoa || !pessoaPodeEntrar(pessoa)) gastarOMesmoTempo(password);

  await registarFalhaDaEntrada(pedido, email);
  redirect(`${ENTRADA}?erro=credenciais`);
}

export async function sair(): Promise<void> {
  await endSession();
  redirect(ENTRADA);
}

/* --------------------------------------------------------------- a ativação */

function gerarToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Escolher a palavra-passe pela ligação de convite, e entrar.
 *
 * A ligação confere-se **antes** do scrypt: um token inventado custa uma
 * leitura e não trinta e dois megabytes de memória, e quem o tenta não pode
 * pôr o servidor a calcular hashes a pedido.
 */
export async function ativarConta(formData: FormData): Promise<void> {
  const token = String(formData.get('t') ?? '');
  const senha = String(formData.get('senha') ?? '');
  const repetida = String(formData.get('senha_repetida') ?? '');
  function voltar(erro: string): never {
    redirect(`/admin/ativar?${new URLSearchParams({ t: token, erro })}`);
  }

  if (!isAdminConfigured()) redirect(`${ENTRADA}?erro=configuracao`);
  if (!tokenDeConviteValido(token)) voltar('ligacao');
  if (senha.length < PALAVRA_PASSE_MINIMA) voltar('curta');
  if (senha.length > 200) voltar('longa');
  if (senha !== repetida) voltar('diferentes');

  const impressao = await sha256Hex(token);
  const supabase = requireAdminClient();
  const { data: convite, error: erroDoConvite } = await supabase
    .from('admin_convites')
    .select('usado_em, anulado_em, expira_em')
    .eq('token_sha256', impressao)
    .maybeSingle();
  if (erroDoConvite && !faltaNoEsquema(erroDoConvite)) throw new Error(erroDoConvite.message);
  const linha = convite as {
    usado_em: string | null;
    anulado_em: string | null;
    expira_em: string;
  } | null;
  if (!linha || linha.usado_em || linha.anulado_em || Date.parse(linha.expira_em) <= Date.now()) {
    voltar('ligacao');
  }

  const { data, error } = await supabase.rpc('admin_ativar_com_convite', {
    p_token_sha256: impressao,
    p_senha_hash: gerarHashDaSenha(senha),
  });
  // A base recusa com a mesma frase para tudo o que não vale — usada,
  // anulada, expirada, de uma pessoa desativada. O aviso diz o mesmo.
  if (error) voltar('ligacao');

  const pessoa = (Array.isArray(data) ? data[0] : data) as
    { id: string; email: string; nome: string } | undefined;
  const guardada = pessoa ? await lerPessoaPorEmail(pessoa.email) : null;
  if (!guardada || !pessoaPodeEntrar(guardada)) voltar('ligacao');

  await iniciarSessaoDaPessoa({ ...guardada, senha_hash: guardada.senha_hash as string });
  await registarAcesso(guardada.id, actorDaPessoa(guardada));
  redirect(
    comAviso('/admin', 'A conta ficou ativa. Esta é a palavra-passe com que volta a entrar.'),
  );
}

/* ------------------------------------------------------- as pessoas, do dono */

/** O endereço do painel tal como quem lá está o vê — para a ligação de convite. */
async function origemDoPainel(): Promise<string> {
  const cabecalhos = await headers();
  const anfitriao = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host') ?? 'localhost';
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$|\.localhost(:\d+)?$/.test(anfitriao);
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? (local ? 'http' : 'https');
  return `${protocolo}://${anfitriao}`;
}

/** Gera a ligação, regista-a na base e devolve o endereço inteiro. */
async function novaLigacao(pessoaId: string, actor: string): Promise<string> {
  const token = gerarToken();
  const { error } = await requireAdminClient().rpc('admin_criar_convite', {
    p_pessoa: pessoaId,
    p_token_sha256: await sha256Hex(token),
    p_actor: actor,
  });
  if (error) redirect(comAviso(PESSOAS, error.message));
  return `${await origemDoPainel()}/admin/ativar?t=${token}`;
}

/**
 * A ligação volta ao painel pela barra de endereços, e só daqui a página a
 * mostra — uma vez. É o mecanismo do segredo do balanço (`criarSegredoDeBalanco`),
 * e pela mesma razão: guardá-la do lado do servidor até alguém a ler era criar
 * um segundo sítio onde ela vive.
 */
function comLigacao(aviso: string, pessoaId: string, ligacao: string): string {
  return `${PESSOAS}?${new URLSearchParams({ aviso, pessoa: pessoaId, ligacao })}#ligacao`;
}

const PESSOA_NOVA = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
});

/** Os papéis que o formulário traz: um `<select>` por região, `papel:<região>`. */
function papeisDoFormulario(
  formData: FormData,
  regioes: readonly string[],
): Map<string, 'gestor' | 'editor' | null> {
  const papeis = new Map<string, 'gestor' | 'editor' | null>();
  for (const regiao of regioes) {
    const valor = formData.get(`papel:${regiao}`);
    if (valor === null) continue;
    papeis.set(regiao, ehPapel(valor) ? valor : null);
  }
  return papeis;
}

export async function convidarPessoa(formData: FormData): Promise<void> {
  const { actor } = await exigirDono();
  const lido = PESSOA_NOVA.safeParse({ nome: formData.get('nome'), email: formData.get('email') });
  if (!lido.success) {
    const campo = lido.error.issues[0]?.path[0];
    redirect(
      comAviso(
        PESSOAS,
        campo === 'email'
          ? 'O email tem de ser um endereço de email, como ana.silva@cim.pt.'
          : 'A pessoa precisa de um nome, com até 120 caracteres.',
      ),
    );
  }

  const supabase = requireAdminClient();
  const { data: id, error } = await supabase.rpc('admin_criar_pessoa', {
    p_email: lido.data.email,
    p_nome: lido.data.nome,
    p_actor: actor,
  });
  if (error || typeof id !== 'string') {
    redirect(
      comAviso(
        PESSOAS,
        faltaNoEsquema(error)
          ? 'A base ainda não tem as contas por pessoa — falta aplicar a migração 0170.'
          : (error?.message ?? 'A pessoa não foi criada.'),
      ),
    );
  }

  const regioes = (await listRegionsAdmin()).map((regiao) => regiao.id);
  for (const [regiao, papel] of papeisDoFormulario(formData, regioes)) {
    if (!papel) continue;
    const { error: erroDoPapel } = await supabase.rpc('admin_definir_papel', {
      p_pessoa: id,
      p_regiao: regiao,
      p_papel: papel,
      p_actor: actor,
    });
    if (erroDoPapel) reportarErro('admin_definir_papel', erroDoPapel);
  }

  const ligacao = await novaLigacao(id, actor);
  redirect(
    comLigacao(
      `Convite criado para ${lido.data.nome}. Envia-lhe a ligação abaixo pelos teus meios — vale sete dias e uma vez.`,
      id,
      ligacao,
    ),
  );
}

export async function mudarPapeis(formData: FormData): Promise<void> {
  const { actor } = await exigirDono();
  const pessoa = String(formData.get('pessoa') ?? '');
  const supabase = requireAdminClient();

  const regioes = (await listRegionsAdmin()).map((regiao) => regiao.id);
  let mudancas = 0;
  for (const [regiao, papel] of papeisDoFormulario(formData, regioes)) {
    const { data, error } = await supabase.rpc('admin_definir_papel', {
      p_pessoa: pessoa,
      p_regiao: regiao,
      p_papel: papel,
      p_actor: actor,
    });
    if (error) redirect(comAviso(PESSOAS, error.message));
    if (data === true) mudancas += 1;
  }

  redirect(
    comAviso(
      PESSOAS,
      mudancas === 0
        ? 'Nada mudou — os papéis já eram esses.'
        : 'Papéis guardados. Valem já: a pessoa vê a diferença no próximo clique.',
    ),
  );
}

export async function gerarLigacaoNova(formData: FormData): Promise<void> {
  const { actor } = await exigirDono();
  const pessoa = String(formData.get('pessoa') ?? '');
  const nome = String(formData.get('nome') ?? '').trim();
  const ligacao = await novaLigacao(pessoa, actor);
  redirect(
    comLigacao(
      `Ligação nova para ${nome || 'esta pessoa'}. A anterior, se havia, deixou de valer; a palavra-passe antiga deixa de valer quando a nova for escolhida.`,
      pessoa,
      ligacao,
    ),
  );
}

export async function mudarEstadoDaPessoa(formData: FormData): Promise<void> {
  const { actor } = await exigirDono();
  const pessoa = String(formData.get('pessoa') ?? '');
  const nome = String(formData.get('nome') ?? '').trim() || 'esta pessoa';
  const ativa = String(formData.get('ativa') ?? '') === 'sim';

  // A confirmação é um gesto a mais, escrito no formulário: uma caixa por
  // marcar. Desativar alguém é tirá-lo do painel a meio do que estiver a fazer.
  if (!ativa && formData.get('confirmo') === null) {
    redirect(
      comAviso(
        PESSOAS,
        `Para desativar, marque a caixa a confirmar — a conta de ${nome} continua ativa.`,
      ),
    );
  }

  const { data, error } = await requireAdminClient().rpc('admin_definir_estado_da_pessoa', {
    p_pessoa: pessoa,
    p_ativa: ativa,
    p_actor: actor,
  });
  if (error) redirect(comAviso(PESSOAS, error.message));

  redirect(
    comAviso(
      PESSOAS,
      data !== true
        ? 'Nada mudou — já estava assim.'
        : ativa
          ? `A conta de ${nome} voltou a entrar, com a palavra-passe que tinha.`
          : `A conta de ${nome} foi desativada: deixa de entrar já, e a auditoria continua a mostrar o que fez.`,
    ),
  );
}

/* ------------------------------------------------- a região do cabeçalho */

/**
 * Para onde se volta depois de mudar de região.
 *
 * A mesma página, sem a ficha que lá estava aberta: a submissão, o evento ou a
 * fonte eram da região de antes. A ficha de uma região passa à da região nova.
 */
export async function destinoDepoisDeMudar(caminho: string, regiao: string): Promise<string> {
  const limpo = destinoDoPainel(caminho.split('?')[0] ?? '/admin', '/admin');
  if (/^\/admin\/regioes\/[^/]+/.test(limpo)) {
    return regiao === TODAS ? '/admin/regioes' : `/admin/regioes/${encodeURIComponent(regiao)}`;
  }
  const ficha = limpo.match(/^\/admin\/(fila|eventos|fontes)\/[^/]+/);
  return ficha ? `/admin/${ficha[1]}` : limpo;
}

export async function escolherRegiao(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const regiao = String(formData.get('regiao') ?? '');
  const voltar = String(formData.get('voltar') ?? '/admin');

  // Só se guarda uma região que a sessão vê, ou «todas». O cookie não é uma
  // guarda — cada página volta a recortar pelos papéis —, mas um valor que não
  // vale nada também não tem de ficar guardado.
  const vale = regiao === TODAS || pode(sessao, regiao, 'editor');
  if (vale) {
    (await cookies()).set(COOKIE_DA_REGIAO, regiao, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/admin',
      maxAge: 60 * 60 * 24 * 90,
    });
  }
  redirect(await destinoDepoisDeMudar(voltar, vale ? regiao : TODAS));
}
