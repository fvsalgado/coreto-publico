import { describe, expect, it } from 'vitest';

import {
  ascendentes,
  migalhasDoCiclo,
  migalhasDoConcelho,
  migalhasDoEspaco,
  migalhasDoEvento,
} from './migalhas';

const TOMAR = { id: 'tomar', name: 'Tomar' };

describe('o caminho até uma página', () => {
  it('começa sempre na casa', () => {
    for (const trilha of [
      migalhasDoEvento({ slug: 'festa-abc123', title: 'Festa' }, TOMAR),
      migalhasDoEspaco({ id: 'teatro-virginia', name: 'Teatro Virgínia' }, TOMAR),
      migalhasDoConcelho(TOMAR),
      migalhasDoCiclo({ id: 'caminhos', name: 'CAMINHOS' }),
    ]) {
      expect(trilha[0]).toEqual({ href: '/', label: 'Coreto' });
    }
  });

  it('acaba na própria página, porque é isso que o schema.org quer', () => {
    const trilha = migalhasDoEvento({ slug: 'festa-abc123', title: 'Festa' }, TOMAR);
    expect(trilha.at(-1)).toEqual({ href: '/evento/festa-abc123', label: 'Festa' });
  });

  it('leva o concelho pelo meio quando ele é conhecido', () => {
    expect(migalhasDoEvento({ slug: 'x', title: 'X' }, TOMAR).map((m) => m.label)).toEqual([
      'Coreto',
      'Tomar',
      'X',
    ]);
  });

  it('salta o concelho quando não há — e não inventa um degrau vazio', () => {
    // Um evento sem concelho resolvido não pode ficar com «Coreto › › X».
    expect(migalhasDoEvento({ slug: 'x', title: 'X' }, null).map((m) => m.label)).toEqual([
      'Coreto',
      'X',
    ]);
    expect(migalhasDoEspaco({ id: 'y', name: 'Y' }, null).map((m) => m.label)).toEqual([
      'Coreto',
      'Y',
    ]);
  });

  it('arruma o concelho debaixo do mapa, que é por onde se lá chega', () => {
    expect(migalhasDoConcelho(TOMAR).map((m) => m.href)).toEqual(['/', '/mapa', '/concelho/tomar']);
  });

  it('arruma um ciclo debaixo da lista dos ciclos', () => {
    expect(migalhasDoCiclo({ id: 'caminhos', name: 'CAMINHOS' }).map((m) => m.href)).toEqual([
      '/',
      '/ciclos',
      '/ciclo/caminhos',
    ]);
  });

  it('nunca aponta um degrau para uma secção que se desliga, tirando os ciclos', () => {
    /*
     * As migalhas não sabem que secções estão ligadas, e não precisam: só
     * apontam para `/`, `/mapa`, `/concelho/…` — que não se desligam — e para
     * `/ciclos`, que só é alcançável a partir de uma página de ciclo, e essa
     * devolve 404 com a secção desligada.
     */
    const opcionais = ['/coretos', '/fontes', '/informacoes'];
    const todas = [
      ...migalhasDoEvento({ slug: 'x', title: 'X' }, TOMAR),
      ...migalhasDoEspaco({ id: 'y', name: 'Y' }, TOMAR),
      ...migalhasDoConcelho(TOMAR),
      ...migalhasDoCiclo({ id: 'caminhos', name: 'CAMINHOS' }),
    ];
    for (const migalha of todas) expect(opcionais, migalha.href).not.toContain(migalha.href);
  });
});

describe('o que o cabeçalho desenha', () => {
  it('deixa a própria página de fora, que o h1 já a diz', () => {
    const trilha = migalhasDoEvento({ slug: 'festa-abc123', title: 'Festa' }, TOMAR);
    expect(ascendentes(trilha).map((m) => m.label)).toEqual(['Coreto', 'Tomar']);
  });

  it('não desenha nada quando a trilha é só a própria página', () => {
    expect(ascendentes([{ href: '/x', label: 'X' }])).toEqual([]);
  });
});
