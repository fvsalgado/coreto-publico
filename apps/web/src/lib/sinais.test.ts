import { describe, expect, it } from 'vitest';

import { sinaisDeAcessibilidade, sinalDePreco } from './sinais';

describe('sinaisDeAcessibilidade', () => {
  // O teste que guarda a decisão inteira: sem informação não se desenha nada.
  // A versão anterior do sítio escrevia aqui uma frase de trinta palavras a
  // explicar que a fonte não dizia; se alguém a reintroduzir, isto parte.
  it('não assinala o que a fonte não diz', () => {
    expect(
      sinaisDeAcessibilidade({
        wheelchair_accessible: null,
        has_sign_language: false,
        has_audio_description: false,
        has_subtitles: false,
        is_relaxed_performance: false,
      }),
    ).toEqual([]);
  });

  it('assinala a ausência verificada, que é diferente do silêncio', () => {
    const [sinal, ...resto] = sinaisDeAcessibilidade({ wheelchair_accessible: false });
    expect(resto).toEqual([]);
    expect(sinal?.curto).toBe('Sem acesso');
    expect(sinal?.tom).toBe('apagado');
  });

  it('dá sigla curta à vista e o rótulo inteiro por baixo', () => {
    const sinais = sinaisDeAcessibilidade({
      wheelchair_accessible: true,
      has_sign_language: true,
      has_audio_description: true,
      has_subtitles: true,
      is_relaxed_performance: true,
    });

    expect(sinais.map((sinal) => sinal.curto)).toEqual([
      'Acessível',
      'LGP',
      'AD',
      'Legendado',
      'Relaxada',
    ]);

    // Nenhuma sigla se explica sozinha: todas têm de trazer o significado.
    for (const sinal of sinais) {
      expect(sinal.rotulo.length).toBeGreaterThan(sinal.curto.length);
    }
  });
});

/**
 * De quem é o acesso (C2-011). Desde a 0129, o cartão lê a coluna resolvida —
 * a do evento, ou a do espaço quando o evento se cala — e dizia «Acessível»
 * nos dois casos. Um concerto no jardim do teatro não fica acessível por o
 * teatro o ser: quando o «sim» é do espaço, o sinal di-lo.
 */
describe('o acesso que vem do espaço', () => {
  it('diz que é do espaço, à vista e por extenso', () => {
    const [sinal] = sinaisDeAcessibilidade(
      { wheelchair_accessible: true },
      { acessoDoEspaco: true },
    );
    expect(sinal?.curto).toBe('Espaço acessível');
    expect(sinal?.rotulo).toBe('Espaço com acesso a cadeiras de rodas');
  });

  it('a declaração do próprio evento continua a ser «Acessível»', () => {
    const [sinal] = sinaisDeAcessibilidade({ wheelchair_accessible: true });
    expect(sinal?.curto).toBe('Acessível');
  });

  it('não inventa acesso: sem «sim», a origem não muda nada', () => {
    expect(
      sinaisDeAcessibilidade({ wheelchair_accessible: null }, { acessoDoEspaco: true }),
    ).toEqual([]);
    const [sinal] = sinaisDeAcessibilidade(
      { wheelchair_accessible: false },
      { acessoDoEspaco: true },
    );
    expect(sinal?.curto).toBe('Sem acesso');
  });
});

describe('sinalDePreco', () => {
  it('destaca a entrada livre', () => {
    expect(sinalDePreco({ is_free: true, price_display: '5 €' })).toMatchObject({
      curto: 'Entrada livre',
      tom: 'destaque',
    });
  });

  it('mostra o preço tal como a fonte o escreve', () => {
    expect(sinalDePreco({ is_free: false, price_display: '5 € / 3 €' })?.curto).toBe('5 € / 3 €');
  });

  it('cala-se quando não há preço, em vez de dizer que não há', () => {
    expect(sinalDePreco({ is_free: false, price_display: null })).toBeNull();
  });
});
