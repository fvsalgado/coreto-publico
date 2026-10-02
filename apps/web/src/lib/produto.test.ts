import { describe, expect, it } from 'vitest';
import { PRODUTO, contactoDoProduto, correioPara, origemDaDemonstracao } from './produto';

describe('o contacto do produto', () => {
  it('sem variável, ou com uma que não é endereço, vale o que já é público', () => {
    expect(contactoDoProduto(undefined)).toBe(PRODUTO.email);
    expect(contactoDoProduto('mailto:ola@exemplo.pt')).toBe(PRODUTO.email);
    expect(contactoDoProduto('Fábio <fabio@exemplo.pt>')).toBe(PRODUTO.email);
  });

  it('um endereço na variável é o que se mostra', () => {
    expect(contactoDoProduto('  propostas@exemplo.pt ')).toBe('propostas@exemplo.pt');
  });

  it('o assunto vai codificado, com os espaços como %20 e não como +', () => {
    expect(correioPara('Pedido de proposta do Coreto', 'a@b.pt')).toBe(
      'mailto:a@b.pt?subject=Pedido%20de%20proposta%20do%20Coreto',
    );
  });
});

describe('onde está a demonstração', () => {
  it('sem variável, é o subdomínio demo. do produto — sem domínio nenhum escrito', () => {
    expect(origemDaDemonstracao('https://agenda.exemplo.pt', undefined)).toBe(
      'https://demo.agenda.exemplo.pt',
    );
  });

  it('a variável manda, quando é um endereço inteiro', () => {
    expect(origemDaDemonstracao('https://agenda.exemplo.pt', 'https://ver.exemplo.pt/')).toBe(
      'https://ver.exemplo.pt',
    );
    expect(origemDaDemonstracao('https://agenda.exemplo.pt', 'ver.exemplo.pt')).toBe(
      'https://demo.agenda.exemplo.pt',
    );
  });

  it('a página do produto parte da origem do produto, e nunca do endereço de uma região', async () => {
    // Em produção o `NEXT_PUBLIC_SITE_URL` é o da região principal: partir
    // dele mandava a página do produto para o `demo.` do domínio de um
    // cliente. A página passa a origem que ela própria declara canónica.
    const { ORIGEM_DA_MONTRA } = await import('@/app/pagina-do-produto/montra');
    expect(origemDaDemonstracao(ORIGEM_DA_MONTRA, undefined)).toBe(
      `https://demo.${new URL(ORIGEM_DA_MONTRA).host}`,
    );
  });
});
