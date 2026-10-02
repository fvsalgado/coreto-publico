import { describe, expect, it } from 'vitest';
import {
  COR_DO_TEMA,
  COR_POR_OMISSAO,
  MINIMO,
  contraste,
  folhaDaPaleta,
  paletaDaMarca,
  tintaSobre,
} from './paleta';

describe('a paleta de uma região', () => {
  it('as duas paletas afinadas à mão não mudam um byte', () => {
    expect(paletaDaMarca(COR_DO_TEMA)?.claro.accent).toBe('#14676b');
    expect(paletaDaMarca(COR_DO_TEMA)?.escuro.accent).toBe('#40c0c4');
    expect(paletaDaMarca(COR_POR_OMISSAO)?.claro.accent).toBe('#b3261e');
    expect(paletaDaMarca('#C2281C')?.escuro.accent).toBe('#f4806f');
  });

  it('uma cor que não se escreve como #rrggbb não dá paleta', () => {
    expect(paletaDaMarca('vermelho')).toBeNull();
    expect(paletaDaMarca('#abc')).toBeNull();
    expect(paletaDaMarca(null)).toBeNull();
  });

  it('uma cor sem tinta que se leia por cima é recusada', () => {
    // O cinzento médio: 4,48:1 com o branco, 3,9:1 com o grafite.
    expect(tintaSobre('#777777')).toBeNull();
    expect(paletaDaMarca('#777777')).toBeNull();
  });

  // Uma amostra das cores que uma CIM pode trazer: escuras, claras, quentes,
  // frias, e a verde da demonstração.
  const CORES = ['#1f5c4a', '#1d4e9e', '#f2c200', '#5b3a8e', '#e06c00', '#0a5c7a', '#7fd1ae'];

  it.each(CORES)('%s: todos os pares de texto passam os 4,5:1, nos dois temas', (cor) => {
    const paleta = paletaDaMarca(cor);
    expect(paleta).not.toBeNull();
    if (!paleta) return;
    const { claro, escuro } = paleta;
    expect(claro.brand).toBe(cor);
    expect(contraste(claro['on-brand'], claro.brand)).toBeGreaterThanOrEqual(MINIMO);
    // O acento sobre o papel e a superfície, e o branco dos botões sobre ele.
    expect(contraste(claro.accent, '#f6fafb')).toBeGreaterThanOrEqual(MINIMO);
    expect(contraste(claro.accent, '#ffffff')).toBeGreaterThanOrEqual(MINIMO);
    expect(contraste(claro['on-accent'], claro.accent)).toBeGreaterThanOrEqual(MINIMO);
    expect(contraste(claro.accent, claro['accent-soft'])).toBeGreaterThanOrEqual(MINIMO);
    // No escuro, sobre o papel e a superfície escuros, e a tinta dos botões.
    expect(contraste(escuro.accent, '#131418')).toBeGreaterThanOrEqual(MINIMO);
    expect(contraste(escuro.accent, '#1c1d24')).toBeGreaterThanOrEqual(MINIMO);
    expect(contraste(escuro['on-accent'], escuro.accent)).toBeGreaterThanOrEqual(MINIMO);
    expect(contraste(escuro.accent, escuro['accent-soft'])).toBeGreaterThanOrEqual(MINIMO);
  });

  it('a folha declara os tokens nos três estados do tema', () => {
    const paleta = paletaDaMarca('#1f5c4a');
    expect(paleta).not.toBeNull();
    const folha = folhaDaPaleta(paleta!);
    expect(folha).toContain("[data-paleta='regiao']{--color-brand:#1f5c4a");
    expect(folha).toContain(":root[data-theme='dark'] [data-paleta='regiao']{");
    expect(folha).toContain(
      "@media (prefers-color-scheme: dark){:root:not([data-theme='light']) [data-paleta='regiao']{",
    );
  });
});
