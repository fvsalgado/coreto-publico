import { describe, expect, it } from 'vitest';
import { passosDeArranque, type DadosDoArranque } from './arranque';

/**
 * A lista de arranque de uma região (C4-031): o que se mostra à CIM no
 * primeiro dia, e o que quem opera ainda tem de fazer.
 */
const RECEM_NASCIDA: DadosDoArranque = {
  cor: '#c2281c',
  corPorOmissao: '#c2281c',
  temLogotipo: false,
  concelhos: 3,
  concelhosComFonteLigada: 0,
  fontesLigadas: 0,
  coretos: 0,
  seccaoDosCoretosLigada: true,
  licenca: { texto: 'Sem licença registada.', alerta: false, existe: false },
  barreiraLigada: false,
  temResponsavelProprio: false,
  dominio: 'coreto.ensaio.example',
};

const estado = (dados: DadosDoArranque, chave: string) =>
  passosDeArranque(dados).find((passo) => passo.chave === chave);

describe('passosDeArranque', () => {
  it('uma região acabada de nascer tem por fazer a cor, o logótipo, as fontes, os coretos e a licença', () => {
    const porFazer = passosDeArranque(RECEM_NASCIDA)
      .filter((passo) => passo.estado === 'por-fazer')
      .map((passo) => passo.chave);
    expect(porFazer).toEqual(['cor', 'logotipo', 'fontes', 'coretos', 'licenca']);
  });

  it('sem fontes diz que o que entra chega por email, sem alarme', () => {
    expect(estado(RECEM_NASCIDA, 'fontes')?.texto).toMatch(/chega por email/);
    expect(estado(RECEM_NASCIDA, 'fontes')?.texto).not.toMatch(/ATENÇÃO/i);
  });

  it('os coretos: sem levantamento, a secção ligada é um passo por fazer; desligada, está resolvido', () => {
    expect(estado(RECEM_NASCIDA, 'coretos')?.estado).toBe('por-fazer');
    expect(estado({ ...RECEM_NASCIDA, seccaoDosCoretosLigada: false }, 'coretos')?.estado).toBe(
      'feito',
    );
    expect(estado({ ...RECEM_NASCIDA, coretos: 1 }, 'coretos')?.texto).toBe(
      '1 coreto no levantamento.',
    );
  });

  it('uma região pronta só deixa notas', () => {
    const pronta: DadosDoArranque = {
      ...RECEM_NASCIDA,
      cor: '#1f5c4a',
      temLogotipo: true,
      concelhosComFonteLigada: 3,
      fontesLigadas: 5,
      coretos: 4,
      licenca: {
        texto: 'Licença «piloto» até 30 de setembro de 2027.',
        alerta: false,
        existe: true,
      },
    };
    expect(passosDeArranque(pronta).filter((passo) => passo.estado === 'por-fazer')).toEqual([]);
    expect(estado(pronta, 'fontes')?.texto).toBe(
      '5 fontes ligadas; 3 de 3 concelhos com pelo menos uma.',
    );
  });

  it('uma licença a acabar continua por fazer', () => {
    expect(
      estado(
        { ...RECEM_NASCIDA, licenca: { texto: 'Licença a acabar.', alerta: true, existe: true } },
        'licenca',
      )?.estado,
    ).toBe('por-fazer');
  });
});
