import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FALHAS_ATE_PAUSA, HORAS_EM_PAUSA } from '@coreto/core';
import { describe, expect, it } from 'vitest';
import { PAUSA_MAXIMA_DIAS } from './fontes';
import { DE_QUEM_OPERA, PAPEIS } from './papeis';
import { PALAVRA_PASSE_MINIMA } from './password';
import {
  LOGIN_ATTEMPT_WINDOW_SECONDS,
  LOGIN_FALHAS_POR_EMAIL,
  LOGIN_FALHAS_POR_IP,
} from './session';

/**
 * O guia para a CIM diz o que o painel faz (C4-025).
 *
 * O `docs/ENTRADA.md` é o documento que uma CIM lê antes de escolher quem
 * modera e quem gere — e é o único dos guias de entrada escrito para fora da
 * casa. Uma promessa errada ali é um botão que o papel não abre, ou uma regra
 * de entrada que não é a do painel, ditos a quem paga. As frases dos papéis
 * vêm de `PAPEIS` e `DE_QUEM_OPERA`, que a página «Ajuda» também mostra; os
 * números vêm das constantes que o painel e a recolha usam. Muda uma, e este
 * teste diz que o guia ficou para trás.
 *
 * O guia vive no dossiê privado, e o espelho público não o leva
 * (`scripts/espelho/remover.txt`). Lá, e só lá — onde a marca
 * `.espelho-publico` existe —, isto salta; aqui, um guia em falta reprova.
 */
const RAIZ = fileURLToPath(new URL('../../../../../', import.meta.url));
const GUIA = `${RAIZ}docs/ENTRADA.md`;
const NO_ESPELHO = existsSync(`${RAIZ}.espelho-publico`) && !existsSync(GUIA);

/** O guia com as quebras de linha da prosa desfeitas — o Prettier parte as frases. */
function guia(): string {
  return readFileSync(GUIA, 'utf8').replace(/\s+/g, ' ');
}

/** Os números como o guia os escreve. Um número que não esteja aqui reprova. */
const POR_EXTENSO: Readonly<Record<number, string>> = {
  5: 'cinco',
  7: 'sete',
  12: 'doze',
  20: 'vinte',
  90: 'noventa',
};

function extenso(numero: number): string {
  const palavra = POR_EXTENSO[numero];
  if (!palavra) throw new Error(`o guia não sabe escrever ${numero} por extenso`);
  return palavra;
}

describe.skipIf(NO_ESPELHO)('o guia para a CIM (docs/ENTRADA.md)', () => {
  it('diz o que cada papel abre com as palavras do painel', () => {
    const texto = guia();
    for (const frase of [PAPEIS.editor.pormenor, PAPEIS.gestor.pormenor, DE_QUEM_OPERA]) {
      expect(texto).toContain(frase);
    }
  });

  it('diz as regras de entrada que a entrada aplica', () => {
    const texto = guia();
    const porEmail = extenso(LOGIN_FALHAS_POR_EMAIL);
    expect(texto).toContain(
      `${porEmail.charAt(0).toUpperCase()}${porEmail.slice(1)} tentativas falhadas para o mesmo email, ou ${extenso(LOGIN_FALHAS_POR_IP)} a partir da mesma rede`,
    );
    expect(LOGIN_ATTEMPT_WINDOW_SECONDS).toBe(15 * 60);
    expect(texto).toContain('fecham a entrada um quarto de hora');
    expect(texto).toContain(`${extenso(PALAVRA_PASSE_MINIMA)} caracteres, pelo menos`);
  });

  it('diz quanto vale a ligação de ativação, como a base a cria', () => {
    const pasta = fileURLToPath(new URL('../../../../../supabase/migrations/', import.meta.url));
    const contas = readdirSync(pasta).find((nome) => /_0170_/.test(nome));
    expect(contas).toBeDefined();
    const sql = readFileSync(`${pasta}${contas}`, 'utf8');
    // Dois sítios dizem a validade — o valor por omissão da coluna e o da
    // função que cria o convite —, e é a função que manda. Os dois têm de
    // concordar, e o guia com eles.
    const dias = [...sql.matchAll(/interval '(\d+) days'/g)].map((linha) => Number(linha[1]));
    expect(dias.length).toBeGreaterThanOrEqual(2);
    expect(new Set(dias).size).toBe(1);
    expect(guia()).toContain(`Vale ${extenso(dias[0] ?? 0)} dias e uma vez só`);
  });

  it('diz o que acontece a uma fonte como a recolha e o painel o fazem', () => {
    const texto = guia();
    expect(HORAS_EM_PAUSA).toBe(24);
    expect(texto).toContain(
      `falha ${extenso(FALHAS_ATE_PAUSA)} leituras seguidas fica de lado um dia`,
    );
    expect(texto).toContain(`no máximo ${extenso(PAUSA_MAXIMA_DIAS)} dias`);
  });
});
