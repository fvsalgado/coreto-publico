import { describe, expect, it } from 'vitest';
import { creditoDoCartaz, decidirCartaz, pastaDoCartaz, type EstadoDoCartaz } from './cartazes';

const ORIGEM = 'https://cm-tomar.pt/cartazes/2026/festa.jpg';

function estado(parcial: Partial<EstadoDoCartaz> = {}): EstadoDoCartaz {
  return { origem: ORIGEM, alojavel: true, retirado: false, anterior: null, ...parcial };
}

function copiado(origem = ORIGEM) {
  return {
    image_url: 'https://balde/storage/v1/object/public/media/cartazes/e1/abc-1200.webp',
    image_origem: origem,
    image_miniatura: 'https://balde/storage/v1/object/public/media/cartazes/e1/abc-400.webp',
  };
}

describe('decidirCartaz', () => {
  it('um evento sem cartaz não dá trabalho nenhum', () => {
    expect(decidirCartaz(estado({ origem: null }))).toEqual({ accao: 'nenhum' });
    expect(decidirCartaz(estado({ origem: '   ' }))).toEqual({ accao: 'nenhum' });
  });

  /*
   * A cautela que dá sentido às outras duas. Um cartaz retirado a pedido não
   * chega sequer a ser pedido à rede — o gatilho da 0162 apanharia a escrita,
   * mas ir buscar a imagem de quem pediu para a tirarmos era cumprir o pedido
   * pela metade.
   */
  it('um cartaz retirado a pedido não se vai buscar', () => {
    expect(decidirCartaz(estado({ retirado: true }))).toEqual({ accao: 'retirado' });
    expect(decidirCartaz(estado({ retirado: true, anterior: copiado() }))).toEqual({
      accao: 'retirado',
    });
  });

  it('uma fonte não declarada como alojável continua a apontar para a origem', () => {
    expect(decidirCartaz(estado({ alojavel: false }))).toEqual({
      accao: 'apontar',
      origem: ORIGEM,
      havia: false,
    });
  });

  /*
   * Desligar o alojamento de uma fonte no painel não é só deixar de copiar: é
   * apagar o que já se copiou dela. Sem o `havia`, quem executa a decisão não
   * sabia que havia ficheiros no balde para tirar.
   */
  it('desligar uma fonte que já tinha cópias assinala-as para limpeza', () => {
    expect(decidirCartaz(estado({ alojavel: false, anterior: copiado() }))).toEqual({
      accao: 'apontar',
      origem: ORIGEM,
      havia: true,
    });
  });

  it('uma cópia desta mesma origem mantém-se sem tocar na rede', () => {
    expect(decidirCartaz(estado({ anterior: copiado() }))).toEqual({ accao: 'manter' });
  });

  it('um cartaz novo na mesma ficha copia-se outra vez', () => {
    const anterior = copiado('https://cm-tomar.pt/cartazes/2025/outra.jpg');
    expect(decidirCartaz(estado({ anterior }))).toEqual({ accao: 'copiar', origem: ORIGEM });
  });

  it('um evento nunca copiado copia-se', () => {
    expect(decidirCartaz(estado())).toEqual({ accao: 'copiar', origem: ORIGEM });
  });

  /*
   * A noite em que o servidor da câmara respondeu 503 deixa a origem escrita e
   * a miniatura por escrever. É a única marca de que a cópia não se fez, e é o
   * que faz a tentativa repetir-se amanhã em vez de ficar lá para sempre.
   */
  it('uma cópia que falhou ontem tenta-se outra vez', () => {
    const anterior = { image_url: ORIGEM, image_origem: ORIGEM, image_miniatura: null };
    expect(decidirCartaz(estado({ anterior }))).toEqual({ accao: 'copiar', origem: ORIGEM });
  });

  it('a origem vem aparada, para não copiar duas vezes por causa de um espaço', () => {
    expect(decidirCartaz(estado({ origem: ` ${ORIGEM} ` }))).toEqual({
      accao: 'copiar',
      origem: ORIGEM,
    });
  });
});

describe('pastaDoCartaz', () => {
  it('uma pasta por evento', () => {
    expect(pastaDoCartaz('e1')).toBe('cartazes/e1');
  });
});

describe('creditoDoCartaz', () => {
  it('sem crédito, fica o nome de quem publicou', () => {
    expect(creditoDoCartaz(null, 'Câmara Municipal de Tomar')).toBe('Câmara Municipal de Tomar');
    expect(creditoDoCartaz('  ', 'Junta de Freguesia de Valhascos')).toBe(
      'Junta de Freguesia de Valhascos',
    );
  });

  // Quem escreveu um crédito à mão na moderação sabia mais do que isto sabe.
  it('um crédito escrito à mão não é sobreposto', () => {
    expect(creditoDoCartaz('Fotografia de Ana Ferreira', 'Câmara Municipal de Tomar')).toBe(
      'Fotografia de Ana Ferreira',
    );
  });

  it('sem fonte com nome, fica nulo em vez de uma cadeia vazia', () => {
    expect(creditoDoCartaz(null, null)).toBeNull();
    expect(creditoDoCartaz(null, '   ')).toBeNull();
  });
});
