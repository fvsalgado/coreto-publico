import { describe, expect, it } from 'vitest';
import { enderecoDeEmail, mensagemAPedir, oQueFalta } from './pedir';

const VAZIA = {
  venue_id: '',
  location_name: '',
  description: '',
  is_free: false,
  price_display: '',
};

describe('pedir o que falta (C4-030)', () => {
  it('o caso do «Magusto da associação»: tem dia, falta a hora, o sítio, o texto e o preço', () => {
    expect(oQueFalta(VAZIA, [{ date: '2026-11-11', start: '', end: '' }], false)).toEqual([
      'a hora a que começa',
      'o local exato (o espaço, ou a morada)',
      'duas ou três linhas sobre o que é',
      'o preço — ou se a entrada é livre',
    ]);
  });

  it('uma proposta completa não pede nada, e «em cartaz» não pede hora', () => {
    const completa = {
      venue_id: 'cine-teatro',
      location_name: '',
      description: 'Exposição de fotografia.',
      is_free: true,
      price_display: '',
    };
    expect(oQueFalta(completa, [{ date: '2026-11-01', start: '', end: '' }], true)).toEqual([]);
    expect(oQueFalta(completa, [], true)).toEqual(['o dia (ou os dias) em que acontece']);
  });

  it('a mensagem diz o evento, a agenda e o que falta, e acaba com o nome de quem pergunta', () => {
    const { assunto, corpo } = mensagemAPedir({
      titulo: 'Magusto da associação',
      falta: ['a hora a que começa', 'o local exato (o espaço, ou a morada)'],
      agenda: 'a agenda do Vale do Coreto',
      assinatura: 'Marta Sousa',
    });
    expect(assunto).toBe('«Magusto da associação» na agenda — falta informação');
    expect(corpo).toContain(
      'Recebemos «Magusto da associação» para a agenda do Vale do Coreto. Para o publicarmos, falta-nos:',
    );
    expect(corpo).toContain('- a hora a que começa;\n- o local exato (o espaço, ou a morada).');
    expect(corpo.endsWith('Cumprimentos,\nMarta Sousa')).toBe(true);
  });

  it('o endereço leva assunto e corpo com espaços como %20, e não como +', () => {
    const endereco = enderecoDeEmail('geral@associacao.example', 'Um assunto', 'Linha 1\nLinha 2');
    expect(endereco).toBe(
      'mailto:geral@associacao.example?subject=Um%20assunto&body=Linha%201%0ALinha%202',
    );
  });
});
