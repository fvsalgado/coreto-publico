import { describe, expect, it } from 'vitest';
import { estaEscuro } from './tema';

describe('estaEscuro', () => {
  it('a escolha explícita ganha ao sistema, nos dois sentidos', () => {
    expect(estaEscuro('dark', false)).toBe(true);
    expect(estaEscuro('light', true)).toBe(false);
  });

  it('sem atributo vale o sistema — que é o terceiro estado, e não um esquecimento', () => {
    expect(estaEscuro(undefined, true)).toBe(true);
    expect(estaEscuro(undefined, false)).toBe(false);
  });

  it('um valor que não é nenhum dos dois trata-se como ausência', () => {
    // O atributo é escrito por um script de arranque; um valor estranho lá
    // dentro não pode fazer o mapa escolher o tema errado com confiança.
    expect(estaEscuro('', true)).toBe(true);
    expect(estaEscuro('sistema', false)).toBe(false);
  });
});
