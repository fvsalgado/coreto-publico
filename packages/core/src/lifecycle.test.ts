import { describe, expect, it } from 'vitest';
import {
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
