import { describe, expect, it } from 'vitest';
import { extractAccessibility, parseAudience, parseDurationMinutes } from './accessibility';

describe('extractAccessibility', () => {
  it('lê os apoios anunciados na prosa', () => {
    const flags = extractAccessibility(
      'Espetáculo com interpretação em Língua Gestual Portuguesa e audiodescrição.',
    );
    expect(flags.has_sign_language).toBe(true);
    expect(flags.has_audio_description).toBe(true);
  });

  it('lê legendagem e sessão relaxada', () => {
    expect(extractAccessibility('Filme legendado').has_subtitles).toBe(true);
    expect(extractAccessibility('Sessão relaxada às 15h').is_relaxed_performance).toBe(true);
  });

  it('dá mais peso à negação do que à menção', () => {
    expect(extractAccessibility('Sem acesso a cadeiras de rodas.').wheelchair_accessible).toBe(
      false,
    );
    expect(
      extractAccessibility('Espaço acessível a cadeiras de rodas.').wheelchair_accessible,
    ).toBe(true);
  });

  it('não afirma nada quando o texto se cala', () => {
    const flags = extractAccessibility('Concerto de ano novo.');
    expect(flags.wheelchair_accessible).toBeUndefined();
    expect(flags.has_sign_language).toBe(false);
  });
});

describe('parseDurationMinutes', () => {
  it('lê as formas correntes', () => {
    expect(parseDurationMinutes('Duração: 90 min')).toBe(90);
    expect(parseDurationMinutes('cerca de 1h30')).toBe(90);
    expect(parseDurationMinutes('1 hora e 20 minutos')).toBe(80);
  });

  it('não adivinha a partir de números soltos', () => {
    expect(parseDurationMinutes('Sala com 300 lugares')).toBe(null);
    expect(parseDurationMinutes('')).toBe(null);
  });

  it('recusa durações impossíveis', () => {
    expect(parseDurationMinutes('duração 20 horas')).toBe(null);
  });
});

describe('parseAudience', () => {
  it('lê a classificação etária nas duas grafias', () => {
    expect(parseAudience('M/12')).toEqual({ min_age: 12, audience: 'family' });
    expect(parseAudience('M6')).toEqual({ min_age: 6, audience: 'family' });
    expect(parseAudience('Maiores de 16 anos')).toEqual({ min_age: 16, audience: 'adults' });
    expect(parseAudience('a partir dos 3 anos')).toEqual({ min_age: 3, audience: 'family' });
  });

  it('reconhece público escolar, familiar e sem restrição', () => {
    expect(parseAudience('Sessão para escolas').audience).toBe('schools');
    expect(parseAudience('Para toda a família').audience).toBe('family');
    expect(parseAudience('Para todas as idades').audience).toBe('all_ages');
  });

  it('«todos» solto não é uma declaração de idade', () => {
    // As três frases que puseram onze eventos em «para todas as idades» sem
    // que nenhum o dissesse — entre elas a do Almoço dos Idosos.
    expect(
      parseAudience('Levantamento todos os dias, das 10h00 às 13h00').audience,
    ).toBeUndefined();
    expect(parseAudience('Todos os concertos têm entrada livre').audience).toBeUndefined();
    expect(
      parseAudience('São convidados todos os naturais desta freguesia').audience,
    ).toBeUndefined();
  });

  it('a barra de idade manda sobre a linguagem de cartaz', () => {
    // O Festival Z: «Espetáculo para M/16 anos», e mais acima no mesmo texto
    // «(todos os dias, das 10h00 às 13h00)».
    expect(parseAudience('Espetáculo para M/16 anos. Bilhetes todos os dias.')).toEqual({
      min_age: 16,
      audience: 'adults',
    });
    expect(parseAudience('Para todos os públicos. M/16').audience).toBe('adults');
    // Mas uma sessão de escolas continua a ser de escolas.
    expect(parseAudience('Sessão para escolas, M/16').audience).toBe('schools');
  });

  it('não inventa público quando o texto se cala', () => {
    expect(parseAudience('Concerto de ano novo')).toEqual({});
  });
});
