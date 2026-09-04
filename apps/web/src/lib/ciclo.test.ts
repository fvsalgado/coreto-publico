import { describe, expect, it } from 'vitest';
import { edicoesDoCiclo } from './ciclo';

function evento(date_start: string | null, status = 'archived') {
  return { date_start, status };
}

describe('edicoesDoCiclo', () => {
  it('agrupa por ano, do mais recente para o mais antigo', () => {
    const edicoes = edicoesDoCiclo([
      evento('2026-04-13'),
      evento('2026-05-23'),
      evento('2027-03-01', 'published'),
    ]);

    expect(edicoes.map((edicao) => edicao.ano)).toEqual(['2027', '2026']);
    expect(edicoes[0]!.eventos).toHaveLength(1);
    expect(edicoes[1]!.eventos).toHaveLength(2);
  });

  it('uma edição só passou quando passou inteira', () => {
    // Meio a acontecer não é «já aconteceu»: a página diz «esta edição já
    // passou» e essa frase tem de ser verdade sobre todas as datas.
    expect(edicoesDoCiclo([evento('2026-04-13'), evento('2026-05-23')])[0]!.passou).toBe(true);
    expect(
      edicoesDoCiclo([evento('2026-04-13'), evento('2026-05-23', 'published')])[0]!.passou,
    ).toBe(false);
  });

  it('um evento sem data não inventa um ano', () => {
    const edicoes = edicoesDoCiclo([evento(null), evento('2026-04-13')]);
    expect(edicoes).toHaveLength(1);
    expect(edicoes[0]!.ano).toBe('2026');
  });

  it('um ciclo sem eventos não tem edições', () => {
    expect(edicoesDoCiclo([])).toEqual([]);
  });

  it('não estraga a ordem que veio de trás', () => {
    // A consulta já ordena por data; reordenar aqui era arriscar desfazê-la.
    const edicoes = edicoesDoCiclo([evento('2026-05-23'), evento('2026-04-13')]);
    expect(edicoes[0]!.eventos.map((e) => e.date_start)).toEqual(['2026-05-23', '2026-04-13']);
  });
});
