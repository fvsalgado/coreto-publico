import { PRODUTO } from './produto';

/**
 * Quem fornece o Coreto — a identidade com efeito legal e fiscal.
 *
 * São três identidades diferentes e o repositório tinha duas. `PRODUTO` é o
 * software: o nome, a versão, o endereço de quem responde por ele. `AUTOR` é
 * quem o escreveu e é titular dos direitos, e aparece no rodapé com ligação ao
 * sítio pessoal. Falta**va** a terceira, que é a que assina: quem **contrata,
 * fatura e responde** perante a CIM do outro lado da mesa, e perante a
 * Autoridade Tributária. Hoje são a mesma pessoa; no dia em que a atividade
 * passar a sociedade, mudam duas linhas neste ficheiro e nenhuma nas páginas.
 *
 * **Porque é que isto é código e não uma frase numa página.** O que aqui está
 * escrito é o que o Decreto-Lei n.º 7/2004 (comércio eletrónico), no artigo
 * 10.º, manda dar a quem visita um sítio que oferece um serviço: o nome, a
 * morada geográfica, o contacto e o número de identificação fiscal, em acesso
 * fácil, direto e permanente. Escrito uma vez, sai igual no rodapé da montra,
 * nos termos e em cada um dos seis documentos do dossiê contratual. Escrito
 * seis vezes, diverge à sexta — e a versão que diverge é a que alguém leu.
 *
 * **A morada é uma cidade, e sabe-se que não chega.** O dono decidiu a 19 de
 * setembro de 2026, depois de a objeção lhe ser posta por escrito, que o que se
 * publica é «Lisboa, Portugal». Uma cidade e um país não são o endereço
 * geográfico que a alínea b) pede: quem quiser notificar o fornecedor por via
 * postal não consegue com isto, e é na habilitação — quando o jurista da
 * entidade adjudicante confere a identificação de quem vai contratar — que a
 * falta se paga.
 *
 * A decisão é dele e está escrita. O que este repositório não faz é passar a
 * dizer que o requisito ficou cumprido: `scripts/verificar-afirmacoes.mjs`
 * procura um código postal na morada publicada — `NNNN-NNN`, que é o que em
 * Portugal faz de um sítio um endereço — e, enquanto não o encontrar, regista
 * a falta em cada execução, com a data, o artigo e a decisão ao lado. No dia em
 * que houver um código postal, a asserção passa sozinha a dura e a pendência
 * desaparece do relato sem ninguém se lembrar de a apagar.
 *
 * **Registada e não a falhar**, como estava quando o campo era `null`: uma
 * bateria vermelha à espera de uma decisão de outra pessoa é uma bateria que se
 * aprende a ignorar, e o que se perde nesse dia não é esta linha.
 */
export interface Fornecedor {
  /** A forma jurídica por extenso: «Empresário em nome individual». */
  forma: string;
  /** O nome ou a firma, como está na declaração de início de atividade. */
  nome: string;
  /** O NIF, em nove dígitos e sem espaços. */
  nif: string;
  /**
   * A morada geográfica que se publica — a do artigo 10.º, n.º 1, alínea b).
   *
   * `null` enquanto não houver nenhuma. Ver o comentário do tipo sobre o que
   * está lá hoje e porque é que isso não fecha o requisito.
   */
  morada: string | null;
  /** O contacto eletrónico. É o do produto, e é a mesma caixa. */
  email: string;
}

export const FORNECEDOR: Fornecedor = {
  forma: 'Empresário em nome individual',
  nome: 'Fábio Salgado',
  nif: '234085746',
  morada: 'Lisboa, Portugal',
  email: PRODUTO.email,
};

/**
 * Os campos que a lei pede e que ainda não estão preenchidos.
 *
 * Existe para que a falta seja contável e não uma leitura atenta do ficheiro:
 * é o que o guião das afirmações lê para registar a pendência, e é o que um
 * dia servirá para a página de termos se recusar a dizer-se completa.
 */
export function porPreencher(fornecedor: Fornecedor = FORNECEDOR): readonly string[] {
  const falta: string[] = [];
  if (!fornecedor.morada) falta.push('morada');
  return falta;
}

/**
 * A identidade numa linha, com o que existe e sem o que não existe.
 *
 * «Fábio Salgado, empresário em nome individual, NIF 234085746» — e com a
 * morada no fim, no dia em que houver uma. A forma vai em minúscula porque
 * entra a meio de uma frase, e não como título.
 */
export function identidadeNumaLinha(fornecedor: Fornecedor = FORNECEDOR): string {
  const partes = [fornecedor.nome, fornecedor.forma.toLowerCase(), `NIF ${fornecedor.nif}`];
  if (fornecedor.morada) partes.push(fornecedor.morada);
  return partes.join(', ');
}
