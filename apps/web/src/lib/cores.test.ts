import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CORES_DAS_CATEGORIAS } from './format';

/**
 * As cores das categorias, medidas — e não só declaradas num comentário.
 *
 * A paleta passou a ser de famílias com nome (C1-007), e passou a ter dois
 * trabalhos: o ponto ao lado do nome (que tem de se ver contra a superfície) e
 * o fundo da capa tipográfica, com tinta por cima (que tem de se ler). Os dois
 * temas, e os três sítios onde as cores estão escritas — o `@theme`, os dois
 * blocos do escuro e o widget, que as copia por viver dentro de um `iframe`.
 */

const CSS = readFileSync(fileURLToPath(new URL('../../app/globals.css', import.meta.url)), 'utf8');
const WIDGET = readFileSync(
  fileURLToPath(new URL('../../app/[regiao]/widget/[municipality]/page.tsx', import.meta.url)),
  'utf8',
);

/** As variáveis `--color-cat-*` e `--color-on-cat` de um bloco de texto. */
function coresDe(bloco: string): Record<string, string> {
  return Object.fromEntries(
    [...bloco.matchAll(/--color-(cat-[a-z]+|on-cat):\s*(#[0-9a-f]{6})/gi)].map((m) => [
      m[1] as string,
      (m[2] as string).toLowerCase(),
    ]),
  );
}

/** O conteúdo do primeiro bloco `{ … }` a seguir a uma marca. */
function blocoDepoisDe(texto: string, marca: string): string {
  const inicio = texto.indexOf(marca);
  if (inicio < 0) throw new Error(`não encontrei «${marca}»`);
  const abre = texto.indexOf('{', inicio);
  const fecha = texto.indexOf('}', abre);
  return texto.slice(abre + 1, fecha);
}

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const canal = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * canal(r as number) + 0.7152 * canal(g as number) + 0.0722 * canal(b as number);
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (escuro + 0.05);
}

const CLARO = coresDe(blocoDepoisDe(CSS, '@theme {'));
const ESCURO = coresDe(blocoDepoisDe(CSS, ":root[data-theme='dark'] {"));
const ESCURO_DO_SISTEMA = coresDe(
  blocoDepoisDe(CSS, "@media (prefers-color-scheme: dark) {\n  :root:not([data-theme='light']) {"),
);
const FAMILIAS = [...new Set(Object.values(CORES_DAS_CATEGORIAS))];

describe('as cores das categorias', () => {
  it('cada categoria tem família, e cada família tem cor nos dois temas', () => {
    expect(Object.keys(CORES_DAS_CATEGORIAS)).toHaveLength(14);
    for (const familia of FAMILIAS) {
      expect(CLARO[familia], `${familia} no tema claro`).toBeDefined();
      expect(ESCURO[familia], `${familia} no tema escuro`).toBeDefined();
    }
  });

  it('o escuro pedido e o escuro do sistema são a mesma paleta', () => {
    expect(ESCURO_DO_SISTEMA).toEqual(ESCURO);
  });

  it('no claro, a tinta da capa lê-se sobre todas, e todas se veem no papel', () => {
    const tinta = CLARO['on-cat'] as string;
    for (const familia of FAMILIAS) {
      const cor = CLARO[familia] as string;
      expect(contraste(cor, tinta), `${familia} com a tinta`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cor, '#f6fafb'), `${familia} no papel`).toBeGreaterThanOrEqual(3);
    }
  });

  it('no escuro, o mesmo — com a tinta escura e a superfície escura', () => {
    const tinta = ESCURO['on-cat'] as string;
    for (const familia of FAMILIAS) {
      const cor = ESCURO[familia] as string;
      expect(contraste(cor, tinta), `${familia} com a tinta`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cor, '#1c1d24'), `${familia} na superfície`).toBeGreaterThanOrEqual(3);
    }
  });

  it('nenhuma é o turquesa da marca, que era a cor da música e lia-se como desporto', () => {
    for (const familia of FAMILIAS) {
      expect(CLARO[familia]).not.toBe('#14676b');
      expect(CLARO[familia]).not.toBe('#40c0c4');
    }
  });

  it('as famílias distinguem-se umas das outras', () => {
    const cores = FAMILIAS.map((familia) => CLARO[familia]);
    expect(new Set(cores).size).toBe(FAMILIAS.length);
  });

  it('o widget leva as mesmas cores, nos dois temas', () => {
    const claro = coresDe(blocoDepoisDe(WIDGET, "[data-widget-theme='light'] {"));
    const escuro = coresDe(blocoDepoisDe(WIDGET, "[data-widget-theme='dark'] {"));
    expect(claro).toEqual(CLARO);
    expect(escuro).toEqual(ESCURO);
  });
});
