import { describe, expect, it } from 'vitest';
import { pareceInformacaoMunicipal, textoQueARecolhaArrumou } from './moderacao';

describe('as regras de moderação do C2-022', () => {
  it('mostra o texto da fonte quando a recolha o arrumou', () => {
    const arrumado = textoQueARecolhaArrumou({
      raw: { description: 'TU-TUUU\nDança e música para bebés.\nOrganização' },
      event: { description: 'Dança e música para bebés.' },
    });
    expect(arrumado?.lido).toContain('Organização');
    expect(arrumado?.proposto).toBe('Dança e música para bebés.');
  });

  it('não diz nada quando só mudaram espaços, ou quando não veio da recolha', () => {
    expect(
      textoQueARecolhaArrumou({
        raw: { description: 'Dança  e música\n\npara bebés.' },
        event: { description: 'Dança e música para bebés.' },
      }),
    ).toBeNull();
    expect(
      textoQueARecolhaArrumou({ title: 'Envio por programa', description: 'Texto' }),
    ).toBeNull();
    expect(
      textoQueARecolhaArrumou({
        raw: { description: 'A &amp; B' },
        event: { description: 'A & B' },
      }),
    ).toBeNull();
  });

  it('as reuniões, os atendimentos e as campanhas promocionais não são programação', () => {
    expect(pareceInformacaoMunicipal('Atendimento DECO')).toBe(true);
    expect(pareceInformacaoMunicipal('Reunião da Assembleia de Freguesia')).toBe(true);
    expect(pareceInformacaoMunicipal('Campanha promocional de descontos em estadias')).toBe(true);
    expect(pareceInformacaoMunicipal('Noite de Fados na Filarmónica')).toBe(false);
  });
});
