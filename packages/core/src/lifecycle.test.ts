import { describe, expect, it } from 'vitest';
import {
  avaliarContagem,
  detectLayoutDrift,
  nextBaseline,
  reconcileDecision,
  shouldSkipReconcile,
  applyManualLocks,
  stripNullish,
} from './lifecycle';

describe('reconcileDecision', () => {
  it('recusa reconciliar quando a recolha não trouxe nada', () => {
    const decision = reconcileDecision(40, 0);
    expect(decision.skip).toBe(true);
    expect(decision.reason).toContain('não trouxe um único evento');
  });

  it('recusa reconciliar quando a recolha rendeu abaixo de 30%', () => {
    expect(shouldSkipReconcile(40, 10)).toBe(true);
    expect(shouldSkipReconcile(40, 12)).toBe(true);
  });

  it('deixa reconciliar quando a recolha rendeu o normal', () => {
    expect(shouldSkipReconcile(40, 13)).toBe(false);
    expect(shouldSkipReconcile(40, 38)).toBe(false);
  });

  it('não aplica a razão a catálogos pequenos', () => {
    // Numa fonte com 5 eventos, ver 1 é churn normal e não pode congelá-la.
    expect(shouldSkipReconcile(5, 1)).toBe(false);
    // Mas ver zero continua a ser suspeito, seja qual for o tamanho.
    expect(shouldSkipReconcile(5, 0)).toBe(true);
  });

  it('deixa passar uma fonte nova, que ainda não tinha nada', () => {
    expect(shouldSkipReconcile(0, 0)).toBe(false);
  });

  it('explica sempre o motivo quando recusa', () => {
    expect(reconcileDecision(40, 5).reason).toBeTruthy();
    expect(reconcileDecision(40, 30).reason).toBe(null);
  });
});

describe('detectLayoutDrift', () => {
  it('não conclui nada sem linha de base', () => {
    expect(detectLayoutDrift({ itemsFound: 0, baseline: null, minExpected: 0 })).toBe(false);
  });

  it('ignora linhas de base pequenas de mais para dizerem alguma coisa', () => {
    expect(detectLayoutDrift({ itemsFound: 1, baseline: 4, minExpected: 0 })).toBe(false);
  });

  it('dispara abaixo de metade da linha de base', () => {
    expect(detectLayoutDrift({ itemsFound: 9, baseline: 20, minExpected: 0 })).toBe(true);
    expect(detectLayoutDrift({ itemsFound: 10, baseline: 20, minExpected: 0 })).toBe(false);
  });

  it('respeita o mínimo declarado na fonte', () => {
    expect(detectLayoutDrift({ itemsFound: 3, baseline: null, minExpected: 5 })).toBe(true);
    expect(detectLayoutDrift({ itemsFound: 6, baseline: null, minExpected: 5 })).toBe(false);
  });
});

describe('avaliarContagem', () => {
  it('sem linha de base não há nada a concluir', () => {
    expect(avaliarContagem({ itemsFound: 0, baseline: null, minExpected: 0 })).toBe('normal');
    expect(avaliarContagem({ itemsFound: 1, baseline: 4, minExpected: 0 })).toBe('normal');
  });

  it('abaixo de metade é deriva, e nada se escreve', () => {
    expect(avaliarContagem({ itemsFound: 9, baseline: 20, minExpected: 0 })).toBe('deriva');
    expect(avaliarContagem({ itemsFound: 0, baseline: 20, minExpected: 0 })).toBe('deriva');
  });

  it('o mínimo declarado é deriva mesmo sem história', () => {
    expect(avaliarContagem({ itemsFound: 3, baseline: null, minExpected: 5 })).toBe('deriva');
  });

  // A faixa que não existia: entre metade e 70% da linha de base, a contagem
  // passava por normal e a média móvel aprendia a perda.
  it('entre metade e 70% da linha de base é queda', () => {
    expect(avaliarContagem({ itemsFound: 10, baseline: 20, minExpected: 0 })).toBe('queda');
    expect(avaliarContagem({ itemsFound: 12, baseline: 20, minExpected: 0 })).toBe('queda');
    expect(avaliarContagem({ itemsFound: 13, baseline: 20, minExpected: 0 })).toBe('queda');
  });

  it('a partir de 70% é normal', () => {
    expect(avaliarContagem({ itemsFound: 14, baseline: 20, minExpected: 0 })).toBe('normal');
    expect(avaliarContagem({ itemsFound: 25, baseline: 20, minExpected: 0 })).toBe('normal');
  });
});

/**
 * As duas sequências que decidem o limiar.
 *
 * Uma tem de acender e a outra não pode. Escritas como o mundo as dá — uma
 * contagem por noite, com a linha de base a mover-se conforme a regra manda —
 * porque o que interessa não é o valor de uma noite: é o que acontece à
 * quarta, quando a média móvel já teve tempo de aprender o que não devia.
 */
describe('a linha de base não aprende a perda', () => {
  function noites(inicial: number, contagens: readonly number[]) {
    let baseline: number | null = inicial;
    return contagens.map((itemsFound) => {
      const leitura = avaliarContagem({ itemsFound, baseline, minExpected: 0 });
      if (leitura === 'normal') baseline = nextBaseline(baseline, itemsFound);
      return { itemsFound, leitura, baseline };
    });
  }

  it('uma perda de 40% que se mantém fica marcada, e a linha de base não se mexe', () => {
    const dias = noites(20, [12, 12, 12]);
    expect(dias.map((dia) => dia.leitura)).toEqual(['queda', 'queda', 'queda']);
    expect(dias.map((dia) => dia.baseline)).toEqual([20, 20, 20]);
  });

  it('uma descida sazonal não marca nada', () => {
    const dias = noites(20, [18, 17, 16]);
    expect(dias.map((dia) => dia.leitura)).toEqual(['normal', 'normal', 'normal']);
    // A linha de base acompanha, que é para isso que a média móvel existe.
    expect(dias.at(-1)?.baseline).toBe(17);
  });

  // Sem o congelamento, a terceira noite já dava «normal»: 20 → 18 → 16 → 15,
  // e 12 contra 15 está acima dos 70%. É o teste que prova que o congelamento
  // faz falta, e não só o limiar.
  it('com a linha de base a aprender, a mesma perda deixava de se ver', () => {
    let baseline: number | null = 20;
    const leituras = [12, 12, 12].map((itemsFound) => {
      const leitura = avaliarContagem({ itemsFound, baseline, minExpected: 0 });
      baseline = nextBaseline(baseline, itemsFound);
      return leitura;
    });
    expect(leituras).toEqual(['queda', 'queda', 'normal']);
  });
});

describe('nextBaseline', () => {
  it('a primeira recolha fixa a linha de base', () => {
    expect(nextBaseline(null, 24)).toBe(24);
    expect(nextBaseline(0, 24)).toBe(24);
  });

  it('as seguintes puxam-na devagar, para agosto não a arrastar', () => {
    expect(nextBaseline(20, 10)).toBe(17);
    expect(nextBaseline(20, 30)).toBe(23);
  });
});

describe('applyManualLocks', () => {
  it('devolve ao campo bloqueado o valor que a pessoa lá pôs', () => {
    const result = applyManualLocks(
      { title: 'Título da fonte', date_start: '2026-05-11', description: 'Nova descrição' },
      { title: 'Título da fonte', date_start: '2026-05-10', description: 'Descrição antiga' },
      ['date_start'],
    );
    expect(result.event.date_start).toBe('2026-05-10');
    expect(result.event.description).toBe('Nova descrição');
    expect(result.blocked).toEqual(['date_start']);
  });

  it('assinala quando a fonte passou a discordar do que lá está', () => {
    const result = applyManualLocks({ date_start: '2026-05-11' }, { date_start: '2026-05-10' }, [
      'date_start',
    ]);
    expect(result.conflicts).toEqual(['date_start']);
  });

  it('não assinala conflito quando a fonte se corrigiu sozinha', () => {
    const result = applyManualLocks({ date_start: '2026-05-10' }, { date_start: '2026-05-10' }, [
      'date_start',
    ]);
    expect(result.blocked).toEqual(['date_start']);
    expect(result.conflicts).toEqual([]);
  });

  it('deixa passar tudo quando não há bloqueios', () => {
    const incoming = { title: 'x', date_start: '2026-05-10' };
    expect(applyManualLocks(incoming, { title: 'y' }, []).event).toEqual(incoming);
  });

  it('deixa passar tudo quando o evento é novo', () => {
    const incoming = { title: 'x' };
    expect(applyManualLocks(incoming, null, ['title']).event).toEqual(incoming);
  });

  it('só congela os campos bloqueados, não o evento inteiro', () => {
    const result = applyManualLocks(
      { title: 'novo', description: 'nova', image_url: 'nova.jpg' },
      { title: 'antigo', description: 'antiga', image_url: 'antiga.jpg' },
      ['title'],
    );
    expect(result.event).toEqual({
      title: 'antigo',
      description: 'nova',
      image_url: 'nova.jpg',
    });
  });

  it('ignora um bloqueio sobre um campo que já não existe', () => {
    const result = applyManualLocks({ title: 'x' }, { title: 'y' }, ['coluna_extinta']);
    expect(result.blocked).toEqual([]);
    expect(result.event.title).toBe('x');
  });
});

describe('stripNullish', () => {
  it('não deixa uma recolha vazia apagar o que já lá está', () => {
    expect(stripNullish({ title: 'Fado', description: null, image_url: undefined })).toEqual({
      title: 'Fado',
    });
  });

  it('trata a cadeia vazia como ausência', () => {
    expect(stripNullish({ description: '' })).toEqual({});
  });

  it('deixa passar o falso e o zero, que são opiniões', () => {
    expect(stripNullish({ is_free: false, price_min: 0 })).toEqual({
      is_free: false,
      price_min: 0,
    });
  });
});
