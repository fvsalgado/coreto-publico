import { describe, expect, it } from 'vitest';
import { STAT_KINDS, isStatKind, statRequestSchema } from './kinds';

describe('statRequestSchema', () => {
  const eventId = '11111111-1111-4111-8111-111111111111';

  it('aceita um pedido bem formado', () => {
    const parsed = statRequestSchema.safeParse({ eventId, kind: 'ticket_click' });
    expect(parsed.success).toBe(true);
  });

  it('recusa um tipo de contagem que a base de dados não conhece', () => {
    // A função `record_event_stat` rebenta com um tipo destes. Barrá-lo aqui é
    // o que faz a rota devolver 400 em vez de 500.
    expect(statRequestSchema.safeParse({ eventId, kind: 'scroll' }).success).toBe(false);
  });

  it('recusa um identificador que não é um uuid', () => {
    expect(statRequestSchema.safeParse({ eventId: 'tomar', kind: 'view' }).success).toBe(false);
  });

  it('recusa um corpo sem os campos', () => {
    expect(statRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('isStatKind', () => {
  it('reconhece os quatro tipos e mais nenhum', () => {
    for (const kind of STAT_KINDS) expect(isStatKind(kind)).toBe(true);
    expect(isStatKind('views')).toBe(false);
    expect(isStatKind(null)).toBe(false);
    expect(isStatKind(undefined)).toBe(false);
  });
});

/**
 * A política de privacidade conta os contadores, e a conta tem de bater.
 *
 * `/privacidade` diz, por escrito, «cada ficha de evento tem
 * quatro contadores» e enumera-os um a um: quantas vezes foi aberta, e quantas
 * vezes se carregou em «Bilhetes e reservas», em «Adicionar ao calendário» e
 * em «Partilhar». É uma afirmação sobre que dados se recolhem — o género de
 * afirmação que uma política existe para fazer, e que não pode ficar falsa por
 * alguém acrescentar um contador e não reler a página.
 *
 * Este teste é o que liga as duas coisas. Quando falhar, o que se faz não é
 * mexer na lista aqui: é ir à página dizer a verdade nova.
 */
describe('os contadores que a política de privacidade descreve', () => {
  it('são quatro, e são estes', () => {
    expect(
      [...STAT_KINDS],
      'A política de privacidade em /privacidade enumera quatro contadores, um a um. ' +
        'Se acrescentou ou tirou um, o texto publicado deixou de ser verdade — actualize ' +
        'apps/web/app/[regiao]/privacidade/page.tsx (a secção «Como é medida a utilização») ' +
        'antes de mexer neste teste.',
    ).toEqual(['view', 'ticket_click', 'ical_download', 'share']);
  });
});
