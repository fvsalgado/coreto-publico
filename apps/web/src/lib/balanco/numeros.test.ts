import { describe, expect, it } from 'vitest';
import type { RelatorioMensal } from '../admin/relatorio';
import { numerosDoBalanco } from './numeros';

/**
 * Os números que uma CIM leva à reunião de renovação (C4-028): as frases têm
 * de ser as da região que os lê, e de quem decide — não as do Médio Tejo, e
 * não as de quem vende.
 */
function relatorio(concelhos: number, emRede = 0): RelatorioMensal {
  return {
    promises: {
      cohesion: { municipalities: concelhos, municipalities_with_programming: concelhos },
      network: { events: emRede, municipalities_touched: emRede > 0 ? 2 : 0 },
    },
    visits: { available: false, by_municipality: [], clicks_since: null },
    submissions: { received_by_channel: { email: 3, form: 1, scraper: 0 } },
    quality: [{ pending: 4 }],
  } as unknown as RelatorioMensal;
}

const frase = (r: RelatorioMensal, chave: string) =>
  numerosDoBalanco(r).find((numero) => numero.chave === chave);

describe('numerosDoBalanco', () => {
  it('a soma das agendas é a desta região, e não as onze do Médio Tejo', () => {
    expect(frase(relatorio(2), 'rede')?.frase).toContain('a soma das agendas dos dois concelhos');
    expect(frase(relatorio(11), 'rede')?.frase).toContain('a soma das agendas dos onze concelhos');
    expect(frase(relatorio(1), 'rede')?.frase).toContain('a agenda do concelho sozinha');
    expect(frase(relatorio(2), 'rede')?.frase).not.toContain('onze');
  });

  it('a entrada diz «por programa», que é o que o canal é, e a ressalva fala a quem decide', () => {
    const entrada = frase(relatorio(2), 'entrada');
    expect(entrada?.rotulo).toBe('Eventos enviados por email ou por programa, e aprovados');
    expect(entrada?.rotulo).not.toContain('formulário');
    expect(entrada?.valor).toBe('4');
    expect(entrada?.ressalva).not.toMatch(/argumento de venda/);
  });
});
