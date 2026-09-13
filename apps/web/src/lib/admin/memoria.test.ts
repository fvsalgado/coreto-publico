import { describe, expect, it } from 'vitest';
import { compararQualidade, fimDoMesPassado } from './memoria';
import type { QualityRow } from './queries';

function linha(id: string, campos: Partial<QualityRow> = {}): QualityRow {
  return {
    id,
    name: id,
    published: 0,
    pending: 0,
    in_catalogue: 0,
    with_time: 0,
    with_venue: 0,
    with_image: 0,
    with_description: 0,
    with_price: 0,
    with_coordinates: 0,
    ...campos,
  };
}

function medida(comparacao: ReturnType<typeof compararQualidade>, chave: string) {
  const encontrada = comparacao.find((m) => m.chave === chave);
  if (!encontrada) throw new Error(`sem medida «${chave}»`);
  return encontrada;
}

describe('comparar duas fotografias da qualidade', () => {
  /**
   * O caso que dá nome a esta secção do painel.
   *
   * Oito eventos com hora em dez são 80%; vinte e cinco em quarenta são 63%.
   * A percentagem desceu dezassete pontos e fizeram-se dezassete eventos com
   * hora a mais. Um painel que mostrasse só a seta chamava a isto uma queda.
   */
  it('leva sempre os dois números, porque a percentagem sozinha engana', () => {
    const antes = [linha('tomar', { in_catalogue: 10, with_time: 8 })];
    const hoje = [linha('tomar', { in_catalogue: 40, with_time: 25 })];

    const hora = medida(compararQualidade(antes, hoje), 'hora');
    expect(hora.antes).toBe(8);
    expect(hora.agora).toBe(25);
    expect(hora.catalogoAntes).toBe(10);
    expect(hora.catalogoAgora).toBe(40);
    expect(hora.pcAntes).toBe(80);
    expect(hora.pcAgora).toBe(63);
    expect(hora.pontos).toBe(-17);
  });

  /**
   * A diferença sai das percentagens escritas, não das frações. 62,5% menos
   * 80% são −17,5 pontos; o painel escreve 63% e 80%, e a diferença entre o
   * que está escrito é −17. Quem faz a conta de cabeça tem de chegar ao
   * número que está lá.
   */
  it('a diferença bate com as duas percentagens que se mostram', () => {
    const comparacao = compararQualidade(
      [linha('tomar', { in_catalogue: 10, with_time: 8 })],
      [linha('tomar', { in_catalogue: 40, with_time: 25 })],
    );
    for (const m of comparacao) {
      if (m.pcAntes === null || m.pcAgora === null) continue;
      expect(m.pontos).toBe(m.pcAgora - m.pcAntes);
    }
  });

  it('soma os concelhos que a fotografia e o hoje têm em comum', () => {
    const antes = [
      linha('tomar', { in_catalogue: 10, with_image: 5 }),
      linha('abrantes', { in_catalogue: 10, with_image: 10 }),
    ];
    const hoje = [
      linha('tomar', { in_catalogue: 10, with_image: 7 }),
      linha('abrantes', { in_catalogue: 10, with_image: 10 }),
    ];

    const imagem = medida(compararQualidade(antes, hoje), 'imagem');
    expect(imagem.antes).toBe(15);
    expect(imagem.agora).toBe(17);
    expect(imagem.pontos).toBe(10);
  });

  /**
   * Um concelho que entrou na região depois da fotografia não tem linha lá.
   * Contá-lo só do lado de hoje fazia a qualidade parecer pior sem nada ter
   * acontecido — e um que saiu fazia-a parecer melhor. Os dois lados têm de
   * ser o mesmo conjunto, ou a comparação é entre coisas diferentes.
   */
  it('só compara os concelhos que estão nos dois lados', () => {
    const antes = [
      linha('tomar', { in_catalogue: 10, with_price: 10 }),
      linha('saiu', { in_catalogue: 100, with_price: 0 }),
    ];
    const hoje = [
      linha('tomar', { in_catalogue: 10, with_price: 10 }),
      linha('entrou', { in_catalogue: 100, with_price: 0 }),
    ];

    const preco = medida(compararQualidade(antes, hoje), 'preco');
    expect(preco.catalogoAntes).toBe(10);
    expect(preco.catalogoAgora).toBe(10);
    expect(preco.pontos).toBe(0);
  });

  it('sem catálogo não há pontos percentuais, e zero não é 0%', () => {
    const vazio = [linha('mação', { in_catalogue: 0 })];
    const cheio = [linha('mação', { in_catalogue: 4, with_venue: 1 })];

    expect(medida(compararQualidade(vazio, cheio), 'espaco').pontos).toBeNull();
    expect(medida(compararQualidade(vazio, cheio), 'espaco').pcAntes).toBeNull();
    expect(medida(compararQualidade(cheio, vazio), 'espaco').pontos).toBeNull();
    expect(medida(compararQualidade(cheio, vazio), 'espaco').pcAgora).toBeNull();
  });

  it('sem concelhos em comum não compara nada, e não atira', () => {
    const comparacao = compararQualidade([linha('a', { in_catalogue: 5 })], [linha('b')]);
    expect(comparacao).toHaveLength(6);
    for (const m of comparacao) {
      expect(m.catalogoAntes).toBe(0);
      expect(m.catalogoAgora).toBe(0);
      expect(m.pontos).toBeNull();
    }
  });

  it('traz as seis medidas, pela ordem em que a tabela as mostra', () => {
    const comparacao = compararQualidade([linha('tomar')], [linha('tomar')]);
    expect(comparacao.map((m) => m.chave)).toEqual([
      'hora',
      'espaco',
      'descricao',
      'imagem',
      'preco',
      'mapa',
    ]);
  });
});

/**
 * «Memória mensal» é o mês, e não «há trinta dias»: o mês é a unidade em que
 * o relatório se escreve, e uma janela móvel dava um número diferente a cada
 * dia sem nada ter mudado.
 */
describe('o fim do mês passado', () => {
  it('é o último dia do mês anterior', () => {
    expect(fimDoMesPassado(new Date('2026-09-13T19:00:00Z'))).toBe('2026-08-31');
    expect(fimDoMesPassado(new Date('2026-03-01T00:00:00Z'))).toBe('2026-02-28');
    expect(fimDoMesPassado(new Date('2026-01-15T12:00:00Z'))).toBe('2025-12-31');
  });

  it('acerta num fevereiro bissexto', () => {
    expect(fimDoMesPassado(new Date('2028-03-07T08:00:00Z'))).toBe('2028-02-29');
  });

  it('não muda com a hora do dia', () => {
    expect(fimDoMesPassado(new Date('2026-09-01T00:00:00Z'))).toBe('2026-08-31');
    expect(fimDoMesPassado(new Date('2026-09-01T23:59:59Z'))).toBe('2026-08-31');
  });
});
