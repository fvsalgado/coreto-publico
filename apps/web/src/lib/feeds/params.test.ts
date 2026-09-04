import { describe, expect, it } from 'vitest';
import { eventFilterSchema } from '@coreto/core';
import { API_PARAMETERS, readEventFilter } from './params';

function parametros(consulta: string): URLSearchParams {
  return new URLSearchParams(consulta);
}

describe('readEventFilter', () => {
  it('sem parâmetros, dá os valores por omissão', () => {
    const resultado = readEventFilter(parametros(''));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.filter.page).toBe(1);
    expect(resultado.filter.limit).toBe(24);
    expect(resultado.filter.q).toBeUndefined();
  });

  it('a pesquisa chega sem espaços à volta, e vazia não chega', () => {
    const cheio = readEventFilter(parametros('q=%20%20fados%20%20'));
    expect(cheio.ok && cheio.filter.q).toBe('fados');
    const vazio = readEventFilter(parametros('q=%20%20'));
    expect(vazio.ok && vazio.filter.q).toBeUndefined();
  });

  it('os booleanos aceitam 1, true e sim; 0, false e não valem «sem filtro»', () => {
    const sim = readEventFilter(parametros('free=sim&accessible=true'));
    expect(sim.ok && sim.filter.free).toBe(true);
    expect(sim.ok && sim.filter.accessible).toBe(true);
    // `free=0` não é «só os pagos»: é a ausência do filtro, como não o pedir.
    const nao = readEventFilter(parametros('free=0'));
    expect(nao.ok).toBe(true);
    expect(nao.ok && nao.filter.free).toBeFalsy();
  });

  it('uma página fora dos limites é um erro com o nome do campo, não um valor de fábrica', () => {
    const resultado = readEventFilter(parametros('page=0'));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(Object.keys(resultado.errors)).toContain('page');
  });

  it('uma data mal escrita é um erro', () => {
    const resultado = readEventFilter(parametros('from=12-09-2026'));
    expect(resultado.ok).toBe(false);
  });

  it('uma pesquisa demasiado comprida é um erro, não uma consulta truncada', () => {
    const resultado = readEventFilter(parametros(`q=${'a'.repeat(121)}`));
    expect(resultado.ok).toBe(false);
  });
});

describe('API_PARAMETERS', () => {
  it('documenta exatamente os parâmetros que o filtro lê — nem mais, nem menos', () => {
    // A documentação da API, a página /levar e o llms.txt saem desta lista;
    // se o filtro ganhar um parâmetro e a lista não, a API passa a aceitar o
    // que não anuncia.
    const documentados = API_PARAMETERS.map((parametro) => parametro.name).sort();
    const lidos = Object.keys(eventFilterSchema.shape).sort();
    expect(documentados).toEqual(lidos);
  });

  it('cada parâmetro diz que valores aceita e para que serve', () => {
    for (const parametro of API_PARAMETERS) {
      expect(parametro.values.length, parametro.name).toBeGreaterThan(0);
      expect(parametro.description.length, parametro.name).toBeGreaterThan(10);
    }
  });
});
