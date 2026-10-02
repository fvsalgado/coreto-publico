/**
 * O que é do produto, escrito uma vez.
 *
 * A tabela `regions` guarda o que muda de cliente para cliente — o nome, o
 * promotor, a prosa, o financiamento. Este módulo guarda o que não muda com a
 * região: o nome e a versão do software, quem o desenvolve e é titular dos
 * direitos, o contacto do produto, e a nota de licença que vai em todos os
 * feeds. É a fronteira que o modelo multi-inquilino exige: o que estiver aqui
 * aparece igual em todas as regiões, sempre — e o que não puder aparecer
 * igual em todas não pertence aqui.
 *
 * O que fica de fora, de propósito: o repositório e a licença do código. A
 * página do produto é a ficha técnica e fala com quem decide — quem quer o
 * código sabe onde ele está (`README.md` e `LICENSE`, na raiz).
 */

export const PRODUTO = {
  nome: 'Coreto',
  // A versão do produto, não a de um pacote: é a que a montra anuncia e a
  // que muda quando o produto muda de capacidade, decidida pelo dono.
  //
  // Não há notas de versão publicadas, e enquanto não houver o número não
  // pode servir de cabeçalho: a ficha chegou a anunciar «O que a versão 2.1
  // faz» sem ter para onde mandar quem quisesse ir ver o que ela fez. Quem
  // publicar notas de versão tira a ressalva de `PaginaDaMontra.tsx`.
  versao: '2.1',
  /*
   * O endereço de quem responde pelo produto — o mesmo que a região montra
   * tem em `contact_email` (posto na 0110, corrigido na 0125).
   *
   * Está escrito aqui, e não lido da base, por uma razão de desenho: a página
   * do produto que se serve a um anfitrião desconhecido não toca na base de
   * dados, porque é precisamente a página que tem de aguentar a base em baixo
   * e o mapa de domínios por ler. Um contacto que só existisse numa linha da
   * `regions` desaparecia no dia em que fosse mais preciso. Quando há região,
   * é o email dela que aparece; sem região, é este.
   *
   * **Era `ola@coreto.org`, e o endereço não existia.** Foi escolhido quando o
   * `coreto.org` ainda não tinha correio, e ficou a ser publicado no
   * `security.txt` como contacto de segurança depois de haver caixa — mas
   * noutro nome. Um contacto de segurança que não recebe é pior do que não ter
   * contacto: quem encontra uma falha escreve, não obtém resposta, e conclui
   * que ninguém está a ouvir. Este é o endereço que existe no Purelymail.
   */
  email: 'fabio@coreto.org',
} as const;

/**
 * O contacto que a página do produto mostra (C4-002, C4-026).
 *
 * A omissão é o `PRODUTO.email`, que já é público e recebe; quem instalar isto
 * noutro sítio põe o seu em `NEXT_PUBLIC_CORETO_CONTACTO`, e o domínio não se
 * crava no código. Uma variável que não seja um endereço — colada com
 * `mailto:` à frente, com aspas, com o nome da pessoa — não chega à página:
 * vale a omissão, em vez de um contacto partido em todas as linhas. É a mesma
 * regra do Paragem.pt, que é da mesma casa.
 */
const ENDERECO_DE_CORREIO = /^[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[^\s@<>"'(),;:]+$/;

export function contactoDoProduto(valor = process.env.NEXT_PUBLIC_CORETO_CONTACTO): string {
  const limpo = (valor ?? '').trim();
  return ENDERECO_DE_CORREIO.test(limpo) ? limpo : PRODUTO.email;
}

export const CONTACTO = contactoDoProduto();

/**
 * Um `mailto:` com o assunto já escrito — é o que separa um pedido de
 * proposta de um email perdido entre os outros.
 *
 * O assunto vai por `encodeURIComponent`, e não por `URLSearchParams`: este
 * escreve os espaços como `+`, e há clientes de correio que os deixam ficar.
 */
export function correioPara(assunto: string, endereco = CONTACTO): string {
  return `mailto:${endereco}?subject=${encodeURIComponent(assunto)}`;
}

/**
 * Onde está a demonstração (C4-003).
 *
 * `NEXT_PUBLIC_CORETO_DEMONSTRACAO`, quando a instalação a declara; sem ela, o
 * subdomínio `demo.` da origem do produto que quem chama passa — o
 * `ORIGEM_DA_MONTRA`, e daí o `demo.coreto.org` desta instalação, sem nenhum
 * domínio escrito aqui. Uma variável que não seja um endereço `http(s)`
 * inteiro não conta.
 *
 * **Não é o `demo.` do `SITE_URL`**, que seria a escolha instintiva: em
 * produção o `NEXT_PUBLIC_SITE_URL` é o endereço da região principal do
 * deployment, e a página do produto passava a mandar para o `demo.` do
 * domínio de um cliente — que não existe, e que nomeava o cliente numa
 * página que não nomeia nenhum. É a armadilha que o `montra.ts` já descreve
 * para o sitemap.
 */
export function origemDaDemonstracao(
  montra: string,
  valor = process.env.NEXT_PUBLIC_CORETO_DEMONSTRACAO,
): string {
  try {
    const declarada = new URL((valor ?? '').trim());
    if (declarada.protocol === 'https:' || declarada.protocol === 'http:') {
      return declarada.origin;
    }
  } catch {
    // Sem variável, ou uma que não é endereço: vale o subdomínio do produto.
  }
  const base = new URL(montra);
  return `${base.protocol}//demo.${base.host}`;
}

/** O produto irmão, da mesma casa, que se vende às mesmas entidades (C4-026). */
export const PARAGEM = 'https://www.paragem.pt';

/**
 * Quem desenvolve o Coreto e é titular dos direitos.
 *
 * A distinção está escrita nas páginas e é para levar a sério: cada região é
 * *promovida* pela sua CIM; o software é *desenvolvido e propriedade de* quem
 * aqui está. O nome e a marca «Coreto» não são cobertos pela licença do
 * código — a licença dá direitos sobre o software, não sobre a identidade
 * com que ele se apresenta.
 */
export const AUTOR = {
  nome: 'Fábio Salgado',
  url: 'https://salgado.zip',
} as const;

/**
 * Nota de licença que vai em todos os feeds.
 *
 * A distinção importa e é a mesma que a página `/fontes` explica: uma data e
 * um local são factos e não têm autor; o texto de apresentação e a fotografia
 * do cartaz têm, e continuam de quem os fez.
 */
export const FEED_COPYRIGHT =
  'Compilação sob CC BY 4.0. Descrições e imagens pertencem a quem organiza.';
