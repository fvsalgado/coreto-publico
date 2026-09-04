import { describe, expect, it } from 'vitest';
import { espacosPorConfirmar } from './coreto';

const ESPACOS = [
  { id: 'coreto-zibreira', kind: 'bandstand' },
  { id: 'jardim-municipal-torres-novas', kind: 'outdoor' },
  { id: 'cine-teatro-paraiso', kind: 'theatre' },
];

describe('espacosPorConfirmar', () => {
  it('marca o coreto que está por confirmar', () => {
    const marcados = espacosPorConfirmar(
      [{ is_confirmed: false, venue_id: 'coreto-zibreira' }],
      ESPACOS,
    );
    expect([...marcados]).toEqual(['coreto-zibreira']);
  });

  it('não marca o jardim onde o coreto por confirmar estaria', () => {
    // O caso que partiu: o Coreto do Jardim Municipal de Torres Novas está por
    // confirmar; o jardim existe, tem morada e tem fotografia verificada. A
    // dúvida é sobre o coreto, não sobre o lugar.
    const marcados = espacosPorConfirmar(
      [{ is_confirmed: false, venue_id: 'jardim-municipal-torres-novas' }],
      ESPACOS,
    );
    expect([...marcados]).toEqual([]);
  });

  it('não marca um coreto já confirmado', () => {
    const marcados = espacosPorConfirmar(
      [{ is_confirmed: true, venue_id: 'coreto-zibreira' }],
      ESPACOS,
    );
    expect([...marcados]).toEqual([]);
  });

  it('um coreto sem espaço não marca coisa nenhuma', () => {
    expect([...espacosPorConfirmar([{ is_confirmed: false, venue_id: null }], ESPACOS)]).toEqual(
      [],
    );
  });

  it('um espaço que não está no catálogo passado não se marca', () => {
    // Quem chama pode passar só os espaços de um concelho. Sem o tipo à mão,
    // a resposta honesta é não marcar — e não adivinhar que é um coreto pelo
    // nome do identificador.
    const marcados = espacosPorConfirmar(
      [{ is_confirmed: false, venue_id: 'coreto-de-outro-concelho' }],
      ESPACOS,
    );
    expect([...marcados]).toEqual([]);
  });
});
