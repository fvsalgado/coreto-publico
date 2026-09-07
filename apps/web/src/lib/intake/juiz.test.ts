import { describe, expect, it } from 'vitest';
import type { ExtractedEvent } from '@coreto/core';
import { julgarExtracao } from './juiz';

const HOJE = '2026-09-07';

const EMAIL = [
  'Assunto: Concerto de Outono no Cine-Teatro',
  '',
  'Boa tarde,',
  '',
  'Vimos por este meio divulgar o Concerto de Outono, que se realiza no dia',
  '20 de setembro de 2026, pelas 21h30, no Cine-Teatro Paraíso, em Tomar.',
  'Bilhetes a 12 € à venda em https://bilheteira.cm-tomar.pt/outono.',
  'Espetáculo para maiores de 6 anos.',
  '',
  'Com os melhores cumprimentos,',
  'Divisão de Cultura',
].join('\n');

function extraido(partial: Partial<ExtractedEvent> = {}): ExtractedEvent {
  return {
    title: 'Concerto de Outono',
    description: null,
    municipalityId: 'tomar',
    venueName: 'Cine-Teatro Paraíso',
    locationName: null,
    parish: null,
    dates: [{ date: '2026-09-20', startTime: '21:30' }],
    categorySlug: 'musica',
    audienceRaw: null,
    isFree: false,
    priceRaw: '12 €',
    ticketingUrl: 'https://bilheteira.cm-tomar.pt/outono',
    accessibilityNotes: null,
    organiser: 'Divisão de Cultura',
    confidence: 0.9,
    ...partial,
  };
}

describe('julgarExtracao', () => {
  it('uma leitura fiel não deixa nada por verificar', () => {
    expect(julgarExtracao(extraido(), EMAIL, HOJE).naoVerificados).toEqual([]);
  });

  it('uma data que não está no email é marcada', () => {
    const juizo = julgarExtracao(
      extraido({ dates: [{ date: '2026-09-21', startTime: '21:30' }] }),
      EMAIL,
      HOJE,
    );
    expect(juizo.naoVerificados).toEqual(['data 2026-09-21']);
  });

  it('uma hora que não está no email é marcada', () => {
    const juizo = julgarExtracao(
      extraido({ dates: [{ date: '2026-09-20', startTime: '22:00' }] }),
      EMAIL,
      HOJE,
    );
    expect(juizo.naoVerificados).toEqual(['hora 22:00']);
  });

  it('mas a hora que o email escreve à portuguesa conta como a mesma', () => {
    // «21h30» no email, «21:30» na resposta — que é a forma que lhe pedimos.
    expect(julgarExtracao(extraido(), EMAIL, HOJE).naoVerificados).toEqual([]);
    const semMinutos = 'Sessão a 20 de setembro de 2026, às 21h, no Cine-Teatro.';
    const juizo = julgarExtracao(
      extraido({
        dates: [{ date: '2026-09-20', startTime: '21:00' }],
        priceRaw: null,
        ticketingUrl: null,
      }),
      semMinutos,
      HOJE,
    );
    expect(juizo.naoVerificados).toEqual([]);
  });

  it('um preço que o email não diz é marcado', () => {
    expect(julgarExtracao(extraido({ priceRaw: '25 €' }), EMAIL, HOJE).naoVerificados).toEqual([
      'preço',
    ]);
  });

  it('mas o preço que o email diz por outras palavras não é', () => {
    // O email diz «12 €»; o modelo devolve «12 euros». É o mesmo preço, e os
    // leitores desta casa dizem-no.
    expect(julgarExtracao(extraido({ priceRaw: '12 euros' }), EMAIL, HOJE).naoVerificados).toEqual(
      [],
    );
  });

  it('um endereço de bilheteira inventado é marcado', () => {
    const juizo = julgarExtracao(
      extraido({ ticketingUrl: 'https://bilheteira.exemplo.pt/outono' }),
      EMAIL,
      HOJE,
    );
    expect(juizo.naoVerificados).toEqual(['endereço de bilheteira']);
  });

  it('e o público que o email declara é reconhecido', () => {
    expect(
      julgarExtracao(extraido({ audienceRaw: 'maiores de 6 anos' }), EMAIL, HOJE).naoVerificados,
    ).toEqual([]);
    expect(
      julgarExtracao(extraido({ audienceRaw: 'só para adultos' }), EMAIL, HOJE).naoVerificados,
    ).toEqual(['público']);
  });

  it('marca tudo o que não confirma, e não só o primeiro', () => {
    const juizo = julgarExtracao(
      extraido({
        dates: [{ date: '2026-10-01', startTime: '19:00' }],
        priceRaw: '30 €',
        ticketingUrl: 'https://outra.pt/x',
      }),
      EMAIL,
      HOJE,
    );
    expect(juizo.naoVerificados).toEqual([
      'data 2026-10-01',
      'hora 19:00',
      'preço',
      'endereço de bilheteira',
    ]);
  });

  /*
   * As duas fraquezas conhecidas, presas aqui de propósito.
   *
   * Não são o juiz a errar por descuido: são os leitores de datas desta casa a
   * não cobrirem dois casos, e a consequência é um falso positivo — o campo
   * fica marcado e alguém confirma. Ficam escritas porque quem olhar para a
   * taxa de «por confirmar» tem de saber que ela não é a taxa de fabricação.
   */
  it('um dia da semana sem número fica por confirmar, e é falso positivo', () => {
    const juizo = julgarExtracao(
      extraido({
        dates: [{ date: '2026-09-12', startTime: null }],
        priceRaw: null,
        ticketingUrl: null,
      }),
      'A festa é no próximo sábado, no jardim.',
      HOJE,
    );
    expect(juizo.naoVerificados).toEqual(['data 2026-09-12']);
  });

  it('e o meio de um intervalo também', () => {
    // «de 10 a 12 de agosto» lê-se como os dois extremos, por regra da casa.
    const juizo = julgarExtracao(
      extraido({
        dates: [{ date: '2026-08-11', startTime: null }],
        priceRaw: null,
        ticketingUrl: null,
      }),
      'A feira decorre de 10 a 12 de agosto de 2026.',
      HOJE,
    );
    expect(juizo.naoVerificados).toEqual(['data 2026-08-11']);
  });
});
