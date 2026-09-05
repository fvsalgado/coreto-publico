import { describe, expect, it } from 'vitest';
import { statRequestSchema } from './request';

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
