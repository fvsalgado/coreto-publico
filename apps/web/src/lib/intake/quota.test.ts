import { describe, expect, it } from 'vitest';
import { decideExtraction, EMPTY_QUOTA_STATE, type QuotaLimits, type QuotaState } from './quota';

const LIMITS: QuotaLimits = { senderDailyLimit: 20, dailyBudgetMicros: 2_000_000 };

function state(overrides: Partial<QuotaState> = {}): QuotaState {
  return { ...EMPTY_QUOTA_STATE, ...overrides };
}

describe('decisão de quota da extração', () => {
  it('deixa passar um remetente novo', () => {
    expect(decideExtraction(state(), LIMITS)).toEqual({ allowed: true });
  });

  it('trava um remetente bloqueado e diz porquê', () => {
    const decision = decideExtraction(
      state({ isBlocked: true, blockReason: 'envio automático em ciclo' }),
      LIMITS,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.reason).toContain('envio automático em ciclo');
  });

  it('trava um remetente bloqueado sem motivo escrito', () => {
    const decision = decideExtraction(state({ isBlocked: true }), LIMITS);
    expect(decision).toEqual({ allowed: false, reason: 'remetente bloqueado' });
  });

  it('trava exatamente no limite do remetente, não uma extração depois', () => {
    expect(decideExtraction(state({ senderExtractions: 19 }), LIMITS).allowed).toBe(true);
    expect(decideExtraction(state({ senderExtractions: 20 }), LIMITS).allowed).toBe(false);
  });

  it('nomeia o limite no motivo, para quem modera perceber o que aconteceu', () => {
    const decision = decideExtraction(state({ senderExtractions: 20 }), LIMITS);
    expect(decision.allowed === false && decision.reason).toBe(
      'quota diária do remetente esgotada (20 extrações)',
    );
  });

  it('trava quando o orçamento do dia está gasto, mesmo com quota de sobra', () => {
    const decision = decideExtraction(state({ dayCostMicros: 2_000_000 }), LIMITS);
    expect(decision).toEqual({ allowed: false, reason: 'orçamento diário de extração esgotado' });
  });

  it('deixa passar com o orçamento quase gasto: a estimativa trava à entrada seguinte', () => {
    expect(decideExtraction(state({ dayCostMicros: 1_999_999 }), LIMITS).allowed).toBe(true);
  });

  it('um limite a zero desliga a extração sem tirar a chave', () => {
    const off: QuotaLimits = { senderDailyLimit: 0, dailyBudgetMicros: 2_000_000 };
    expect(decideExtraction(state(), off)).toEqual({
      allowed: false,
      reason: 'extração automática desligada na configuração',
    });
  });

  it('um orçamento a zero desliga a extração da mesma maneira', () => {
    const off: QuotaLimits = { senderDailyLimit: 20, dailyBudgetMicros: 0 };
    expect(decideExtraction(state(), off).allowed).toBe(false);
  });

  it('o bloqueio manual ganha ao desligar da configuração', () => {
    const off: QuotaLimits = { senderDailyLimit: 0, dailyBudgetMicros: 0 };
    const decision = decideExtraction(state({ isBlocked: true, blockReason: 'spam' }), off);
    expect(decision.allowed === false && decision.reason).toContain('spam');
  });
});
