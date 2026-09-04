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
