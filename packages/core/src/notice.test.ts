import { describe, expect, it } from 'vitest';
import { looksLikeMunicipalNotice, matchesExcludedTitle } from './notice';

describe('looksLikeMunicipalNotice', () => {
  it('apanha os avisos que já entraram no catálogo uma vez', () => {
    // Cada um destes esteve publicado como se fosse um evento.
    expect(looksLikeMunicipalNotice('Piscina Municipal Vasco Jacob')).toBe(true);
    expect(looksLikeMunicipalNotice('Época Balnear no Concelho de Mação - 2026')).toBe(true);
    expect(looksLikeMunicipalNotice('Reuniao Camara')).toBe(true);
    expect(looksLikeMunicipalNotice('Vacinação Antirrábica')).toBe(true);
    expect(looksLikeMunicipalNotice('Campanha de Sensibilização para o Bem-Estar Animal')).toBe(
      true,
    );
  });

  it('apanha variações de caixa e de acentos', () => {
    expect(looksLikeMunicipalNotice('EPOCA BALNEAR 2026')).toBe(true);
    expect(looksLikeMunicipalNotice('Horário de funcionamento da Biblioteca')).toBe(true);
    expect(looksLikeMunicipalNotice('Inscrições abertas — Universidade Sénior')).toBe(true);
    expect(looksLikeMunicipalNotice('Edital n.º 42/2026')).toBe(true);
  });

  it('a fronteira é a palavra, não a substring', () => {
    // «horário» não pode apanhar títulos que só contêm a palavra por acaso.
    expect(looksLikeMunicipalNotice('Coreografia e Horizonte')).toBe(false);
    expect(looksLikeMunicipalNotice('Aviso — corte de água')).toBe(true);
    // «aviso» só denuncia em posição inicial: uma peça chamada «O Aviso» passa.
    expect(looksLikeMunicipalNotice('O Aviso — peça de teatro')).toBe(false);
    expect(looksLikeMunicipalNotice('Concerto com aviso de tempestade')).toBe(false);
  });

  it('deixa passar programação normal', () => {
    expect(looksLikeMunicipalNotice('Noite de Fados')).toBe(false);
    expect(looksLikeMunicipalNotice('Feira de S. Bartolomeu')).toBe(false);
    expect(looksLikeMunicipalNotice('Exposição «Ser em Construção»')).toBe(false);
    expect(looksLikeMunicipalNotice('Verão no Coreto')).toBe(false);
    // «vacinação» só denuncia em início de título, e «campanha» sozinha não
    // denuncia nada: uma campanha de recolha de livros é programação de
    // biblioteca, e o que a rede apanha é a expressão inteira.
    expect(looksLikeMunicipalNotice('Campanha de recolha de livros')).toBe(false);
    expect(looksLikeMunicipalNotice('O Ensaio Geral da Vacinação')).toBe(false);
    expect(looksLikeMunicipalNotice(null)).toBe(false);
    expect(looksLikeMunicipalNotice('')).toBe(false);
  });
});

describe('matchesExcludedTitle', () => {
  it('casa com a mesma normalização do detetor', () => {
    expect(matchesExcludedTitle('Fábrica das Artes | Tomar', ['fábrica das artes'])).toBe(true);
    expect(matchesExcludedTitle('PISCINA MUNICIPAL VASCO JACOB', ['piscina municipal'])).toBe(true);
  });

  it('não casa fora da fronteira de palavra nem sem exclusões', () => {
    expect(matchesExcludedTitle('A fábrica de sonhos', ['fábrica das artes'])).toBe(false);
    expect(matchesExcludedTitle('Piscina Municipal', undefined)).toBe(false);
    expect(matchesExcludedTitle('Piscina Municipal', [])).toBe(false);
    expect(matchesExcludedTitle('', ['piscina'])).toBe(false);
  });
});
