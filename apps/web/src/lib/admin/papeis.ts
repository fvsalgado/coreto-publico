/**
 * Os papéis do painel, e a única conta que decide quem pode o quê.
 *
 * Puro de propósito — sem base, sem cookies, sem Next —, porque é aqui que se
 * decide se uma moderadora de uma CIM vê a fila de outra, e uma decisão dessas
 * tem de estar ao alcance de um teste de três linhas. As páginas e as ações
 * perguntam aqui; ninguém decide de cabeça.
 *
 * O desenho é o de `CONTAS.md`, comum aos dois painéis da casa:
 *
 * - o **dono** (quem opera o produto, com a senha do ambiente) vê e mexe em
 *   tudo, de todas as regiões, e é o único que mexe no que é do produto e não
 *   de uma região — pessoas, regiões, domínios, licenças, barreira;
 * - o **gestor** de uma região mexe nas definições dela (secções, textos, cor,
 *   fontes, relatório) e faz tudo o que o editor faz;
 * - o **editor** de uma região modera: a fila, os eventos, os espaços e as
 *   etiquetas dela.
 *
 * Uma pessoa sem papel numa região não vê nada dessa região — nem a lista.
 */

export type Papel = 'gestor' | 'editor';

export interface PapelNaRegiao {
  region_id: string;
  papel: Papel;
}

export interface PessoaDaSessao {
  id: string;
  nome: string;
  email: string;
}

export type Sessao =
  | { tipo: 'dono'; actor: string }
  | { tipo: 'pessoa'; actor: string; pessoa: PessoaDaSessao; papeis: readonly PapelNaRegiao[] };

/**
 * O que cada papel diz a quem o lê no painel — uma palavra, uma frase, e o
 * pormenor.
 *
 * A frase é a do seletor de papéis, onde o dono escolhe. O pormenor é a lista
 * do que o papel abre, gesto a gesto, e diz-se em dois sítios: na página
 * «Ajuda» do painel, a quem tem o papel, e no guia para a CIM
 * (`docs/ENTRADA.md`), a quem vai escolher quem o tem (C4-025). Os dois leem
 * daqui — o teste deste ficheiro confere que o guia diz as mesmas palavras —,
 * porque duas listas escritas à mão divergem, e a que ficasse para trás
 * prometia a uma CIM um botão que o papel não abre.
 *
 * Cada gesto do pormenor é uma ação do servidor com a guarda desse papel
 * (`exigirPapel`, `exigirPapelNas`, em `actions.ts`). Um gesto novo entra aqui
 * no mesmo commit que a ação.
 */
export const PAPEIS: Record<Papel, { nome: string; descricao: string; pormenor: string }> = {
  gestor: {
    nome: 'Gestor',
    descricao:
      'Gere a região: as secções, os textos, a cor, as fontes e o relatório — e modera, como o editor.',
    pormenor:
      'Tudo o que o editor faz e, na região: os textos (o nome e o artigo, o lema, as informações), o promotor e a declaração de financiamento, a cor, o planeador de transportes, as secções do sítio, os destaques da entrada, a porta de quem decide, as fontes — pôr em pausa, voltar a tentar, ligar e desligar — e o relatório mensal.',
  },
  editor: {
    nome: 'Editor',
    descricao: 'Modera a região: a fila de propostas, os eventos, os espaços e as etiquetas.',
    pormenor:
      'Modera a fila de propostas; corrige os eventos publicados, tira-os da agenda e junta os repetidos; liga aos espaços os nomes de sítio que a recolha não reconheceu; retira um cartaz a pedido de quem o fez. Vê as fontes, as etiquetas por mapear, a qualidade e as estatísticas da região.',
  },
};

/**
 * O que não é de papel nenhum de uma região: é de quem opera o Coreto, o dono
 * (`CONTAS.md`). Decisões comerciais e de infraestrutura, e o que entra por
 * commit — os logótipos são ficheiros do repositório.
 */
export const DE_QUEM_OPERA =
  'As pessoas e os papéis, as regiões novas, o email da região, os logótipos e a imagem de partilha, o responsável pelo tratamento dos dados, as licenças, a barreira temporária, de que fontes se guarda cópia dos cartazes, tirar uma agenda do ar e a auditoria.';

/** O gestor faz tudo o que o editor faz. A ordem é esta e não muda. */
const PESO: Record<Papel, number> = { editor: 1, gestor: 2 };

export function ehPapel(valor: unknown): valor is Papel {
  return valor === 'gestor' || valor === 'editor';
}

/** O papel de uma pessoa numa região, ou `null`. */
export function papelNaRegiao(
  papeis: readonly PapelNaRegiao[],
  regiao: string | null | undefined,
): Papel | null {
  if (!regiao) return null;
  return papeis.find((linha) => linha.region_id === regiao)?.papel ?? null;
}

/**
 * Se a sessão pode fazer, nesta região, o que pede o papel `minimo`.
 *
 * Uma região em falta (`null`) só é do dono: uma submissão que chegou sem
 * concelho nem região, um nome de sítio sem concelho — o que não se sabe de
 * quem é não se mostra a quem só tem uma região.
 */
export function pode(sessao: Sessao, regiao: string | null | undefined, minimo: Papel): boolean {
  if (sessao.tipo === 'dono') return true;
  const papel = papelNaRegiao(sessao.papeis, regiao);
  return papel !== null && PESO[papel] >= PESO[minimo];
}

/** Se a sessão pode fazer isto em **todas** as regiões dadas. */
export function podeEmTodas(
  sessao: Sessao,
  regioes: ReadonlyArray<string | null | undefined>,
  minimo: Papel,
): boolean {
  return regioes.every((regiao) => pode(sessao, regiao, minimo));
}

/**
 * As regiões onde a sessão tem pelo menos este papel, ou `'todas'` para o
 * dono — que é diferente de uma lista com todas: o dono também vê o que não
 * tem região (ver `pode`).
 */
export function regioesComPapel(sessao: Sessao, minimo: Papel): 'todas' | string[] {
  if (sessao.tipo === 'dono') return 'todas';
  return sessao.papeis.filter((linha) => PESO[linha.papel] >= PESO[minimo]).map((l) => l.region_id);
}

/** O primeiro nome, para o cumprimento da entrada. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/**
 * O autor que fica na auditoria: o nome **e** o email de uma pessoa.
 *
 * Os dois e não só o nome: há Anas em todas as câmaras, e a auditoria é o que
 * se abre quando há uma dúvida — tem de dizer exatamente quem. O separador é o
 * ponto médio, que não aparece num email e lê-se bem numa coluna.
 */
export function actorDaPessoa(pessoa: { nome: string; email: string }): string {
  return `${pessoa.nome.trim()} · ${pessoa.email}`;
}

/**
 * O autor do dono na auditoria. Com `ADMIN_EMAIL` definido, leva-o; sem ele,
 * fica «dono» — que diz o que é, e não «gestor», que era o nome de um papel
 * que passou a ser de outras pessoas.
 */
export function actorDoDono(email: string | undefined): string {
  return email ? `dono · ${email.toLowerCase()}` : 'dono';
}

/**
 * Se a entrada é a do dono: a palavra-passe já conferiu com
 * `ADMIN_PASSWORD_HASH`, e falta saber se o email também conta.
 *
 * Sem `ADMIN_EMAIL`, o dono entra como sempre entrou — com qualquer email e a
 * sua palavra-passe, porque o segredo é a palavra-passe e não o email. Com
 * ele, o email tem de bater, sem distinguir maiúsculas: é o que deixa uma
 * pessoa com uma conta chegar à sua conta mesmo que, por acaso, a sua
 * palavra-passe fosse igual à do dono.
 */
export function emailDoDonoConfere(emailEscrito: string, adminEmail: string | undefined): boolean {
  if (!adminEmail) return true;
  return emailEscrito.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}

/**
 * Um token de convite: 32 bytes aleatórios em base64url — 43 caracteres.
 *
 * Confere-se a forma antes de ir à base: um endereço truncado por um cliente
 * de email diz-se logo truncado, sem uma leitura.
 */
export function tokenDeConviteValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
