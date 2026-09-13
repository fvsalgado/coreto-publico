import { describe, expect, it } from 'vitest';
import { diferenca, ondeVerAEntidade, volumososOmitidos } from './auditoria';

describe('diferenca', () => {
  it('mostra só o campo que mudou, e não os trinta que ficaram iguais', () => {
    const antes = { id: 'r1', name: 'Médio Tejo', tagline: 'Onde a região se encontra' };
    const depois = { id: 'r1', name: 'Médio Tejo', tagline: 'A agenda do Médio Tejo' };

    expect(diferenca(antes, depois)).toEqual([
      { campo: 'tagline', antes: 'Onde a região se encontra', depois: 'A agenda do Médio Tejo' },
    ]);
  });

  it('escreve a ponta que falta como ausente, em vez de um vazio ambíguo', () => {
    // `approve` cria do nada e não tem `before`; quem lê tem de ver «não havia»
    // e não uma célula em branco que tanto pode ser nulo como vazio.
    expect(diferenca(null, { status: 'published' })).toEqual([
      { campo: 'status', antes: null, depois: 'published' },
    ]);
    expect(diferenca({ status: 'draft' }, null)).toEqual([
      { campo: 'status', antes: 'draft', depois: null },
    ]);
  });

  it('deixa de fora o texto longo e os relógios', () => {
    // O `raw_text` repete o que está no `payload` e enche a gaveta; o
    // `updated_at` muda em toda a ação e não diz nada sobre ela.
    const antes = { raw_text: 'um email inteiro', updated_at: '2026-01-01', status: 'pending' };
    const depois = {
      raw_text: 'outro email inteiro',
      updated_at: '2026-01-02',
      status: 'approved',
    };

    expect(diferenca(antes, depois)).toEqual([
      { campo: 'status', antes: 'pending', depois: 'approved' },
    ]);
  });

  it('corta o que é comprido, mas diz que cortou', () => {
    const longo = 'a'.repeat(400);
    const [linha] = diferenca({ review_notes: null }, { review_notes: longo });

    expect(linha?.depois).toHaveLength(161);
    expect(linha?.depois?.endsWith('…')).toBe(true);
  });

  it('não inventa uma mudança quando nada mudou', () => {
    expect(diferenca({ a: 1 }, { a: 1 })).toEqual([]);
    expect(diferenca(null, null)).toEqual([]);
  });

  it('aguenta o que não é objeto sem rebentar', () => {
    // `after` de uma aprovação é `{"event_id": …}`, mas nada garante a forma de
    // uma ação futura — e uma gaveta de auditoria a rebentar leva a página toda.
    expect(diferenca('texto', 42)).toEqual([]);
    expect(diferenca([1, 2], { a: 1 })).toEqual([{ campo: 'a', antes: null, depois: '1' }]);
  });
});

describe('volumososOmitidos', () => {
  it('nomeia o que ficou de fora, em vez de calar que ficou', () => {
    const omitidos = volumososOmitidos(
      { raw_text: 'antes', payload: { a: 1 }, status: 'pending' },
      { raw_text: 'depois', payload: { a: 1 }, status: 'approved' },
    );

    // O `payload` não mudou, por isso não se anuncia; o `raw_text` mudou.
    expect(omitidos).toEqual(['raw_text']);
  });
});

describe('ondeVerAEntidade', () => {
  it('liga o que tem ficha própria no painel', () => {
    expect(ondeVerAEntidade('submission', 'abc')).toBe('/admin/fila/abc');
    expect(ondeVerAEntidade('region', 'medio-tejo')).toBe('/admin/regioes/medio-tejo');
  });

  it('e não inventa endereço para o que não tem', () => {
    // A lista de eventos do painel não filtra por identificador, e uma secção
    // do sítio não é uma coisa com endereço. Melhor sem ligação do que com uma
    // que dá 404.
    expect(ondeVerAEntidade('event', 'e1')).toBeNull();
    expect(ondeVerAEntidade('site_section', 'coretos')).toBeNull();
  });
});
