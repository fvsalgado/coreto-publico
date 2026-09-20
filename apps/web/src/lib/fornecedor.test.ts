import { describe, expect, it } from 'vitest';
import { FORNECEDOR, identidadeNumaLinha, porPreencher, type Fornecedor } from './fornecedor';
import { PRODUTO } from './produto';

const COMPLETO: Fornecedor = {
  forma: 'Unipessoal, Lda.',
  nome: 'Coreto Software',
  nif: '500000000',
  morada: 'Rua do Coreto, 1, 1000-000 Lisboa',
  email: 'geral@exemplo.test',
};

describe('o fornecedor', () => {
  it('tem os campos que o artigo 10.º do DL 7/2004 pede, menos os que faltam', () => {
    expect(FORNECEDOR.nome).not.toBe('');
    expect(FORNECEDOR.forma).not.toBe('');
    // Nove dígitos e nada mais: um NIF com espaços ou pontos é um NIF que
    // alguém copia para um formulário e vê recusado.
    expect(FORNECEDOR.nif).toMatch(/^\d{9}$/);
  });

  it('responde no endereço do produto, e não noutro', () => {
    expect(FORNECEDOR.email).toBe(PRODUTO.email);
  });

  it('não conta nada por preencher, agora que a morada existe', () => {
    expect(porPreencher()).toEqual([]);
    expect(porPreencher(COMPLETO)).toEqual([]);
  });

  it('conta a morada como o que falta quando não há nenhuma', () => {
    expect(porPreencher({ ...COMPLETO, morada: null })).toEqual(['morada']);
  });

  it('escreve a linha com a morada que o dono decidiu publicar', () => {
    expect(identidadeNumaLinha()).toBe(
      'Fábio Salgado, empresário em nome individual, NIF 234085746, Lisboa, Portugal',
    );
  });

  it('escreve a linha sem a morada quando não há nenhuma', () => {
    expect(identidadeNumaLinha({ ...COMPLETO, morada: null })).toBe(
      'Coreto Software, unipessoal, lda., NIF 500000000',
    );
  });

  /*
   * O que esta morada é, e o que não é.
   *
   * «Lisboa, Portugal» é o que o dono decidiu publicar a 19 de setembro de
   * 2026, depois de a objeção lhe ser posta por escrito. Não tem código postal,
   * e é isso que a separa do endereço geográfico que o artigo 10.º, n.º 1,
   * alínea b) do DL 7/2004 pede: por «Lisboa, Portugal» não se notifica
   * ninguém. O teste prende a diferença para que o dia em que ela deixar de
   * existir seja um dia em que alguém tem de vir aqui — e não um dia em que
   * ninguém repara.
   */
  it('a morada publicada ainda não tem código postal, e o repositório sabe-o', () => {
    expect(FORNECEDOR.morada).not.toMatch(/\d{4}-\d{3}/);
  });

  it('acrescenta a morada no fim quando existe', () => {
    expect(identidadeNumaLinha(COMPLETO)).toBe(
      'Coreto Software, unipessoal, lda., NIF 500000000, Rua do Coreto, 1, 1000-000 Lisboa',
    );
  });

  it('nunca escreve «por preencher» na linha que vai para uma página', () => {
    expect(identidadeNumaLinha()).not.toMatch(/por preencher/i);
    expect(identidadeNumaLinha()).not.toMatch(/null|undefined/);
  });
});
