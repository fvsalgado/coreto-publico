import { describe, expect, it } from 'vitest';
import {
  contagensDosCiclos,
  edicoesDoCiclo,
  ordemDosCiclos,
  quandoDoCiclo,
  type LinhaDeCiclo,
} from './ciclo';

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

describe('o índice dos ciclos: quando foi, quando é (C2-023)', () => {
  const HOJE = '2026-10-02';

  function linha(
    series_id: string,
    date_start: string | null,
    status = 'archived',
    date_end: string | null = null,
  ): LinhaDeCiclo {
    return { series_id, status, date_start, date_end };
  }

  it('o que está para vir e a última edição contam-se à parte, cada um com o seu período', () => {
    const contagens = contagensDosCiclos([
      linha('caminhos', '2025-05-10'),
      linha('caminhos', '2026-04-11'),
      linha('caminhos', '2026-05-30', 'archived', '2026-05-31'),
      linha('caminhos', '2026-11-07', 'published'),
      linha('caminhos', '2026-10-12', 'published', '2026-10-13'),
    ]);
    expect(contagens['caminhos']).toEqual({
      total: 5,
      porAcontecer: 2,
      aVir: { de: '2026-10-12', ate: '2026-11-07' },
      ultimaEdicao: { ano: '2026', de: '2026-04-11', ate: '2026-05-31' },
    });
  });

  it('uma data sem dia conta, e não inventa período nenhum', () => {
    const contagens = contagensDosCiclos([linha('x', null, 'published')]);
    expect(contagens['x']).toEqual({ total: 1, porAcontecer: 1, aVir: null, ultimaEdicao: null });
    expect(quandoDoCiclo(contagens['x'], HOJE)).toBe('Uma data por acontecer');
  });

  it('diz as datas do que está para vir, e quantas já passaram', () => {
    const contagens = contagensDosCiclos([
      linha('c', '2026-04-11'),
      linha('c', '2026-10-12', 'published'),
      linha('c', '2026-11-07', 'published'),
    ]);
    expect(quandoDoCiclo(contagens['c'], HOJE)).toBe(
      '2 datas por acontecer: 12 out – 7 nov (e uma já passada)',
    );
  });

  it('do que já passou, diz o ano e o intervalo da última edição', () => {
    const contagens = contagensDosCiclos([
      linha('c', '2025-05-10'),
      linha('c', '2026-04-11'),
      linha('c', '2026-05-30'),
    ]);
    expect(quandoDoCiclo(contagens['c'], HOJE)).toBe(
      '3 datas, todas já passadas — a última edição foi em 2026 (11 abr – 30 mai)',
    );
  });

  it('sem datas diz-se, sem adivinhar uma época', () => {
    expect(quandoDoCiclo(undefined, HOJE)).toBe('Sem datas registadas');
  });

  it('ordena pelo que está para vir, depois pelo que passou mais perto, depois pelo nome', () => {
    const contagens = contagensDosCiclos([
      linha('longe', '2026-12-01', 'published'),
      linha('perto', '2026-10-05', 'published'),
      linha('recente', '2026-06-01'),
      linha('antigo', '2024-06-01'),
    ]);
    const ciclos = ['antigo', 'sem-datas', 'recente', 'longe', 'perto'].map((id) => ({
      id,
      name: id,
    }));
    expect(ciclos.sort(ordemDosCiclos(contagens)).map((ciclo) => ciclo.id)).toEqual([
      'perto',
      'longe',
      'recente',
      'antigo',
      'sem-datas',
    ]);
  });
});
