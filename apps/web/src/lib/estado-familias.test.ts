import { describe, expect, it } from 'vitest';
import { avaliarRecolha, familiasCaladas, type FonteVigiada } from './estado';

const AGORA = new Date('2026-09-13T09:00:00Z');

function fonte(
  id: string,
  adapter: string | null,
  ultimoSucesso: string | null,
  is_enabled = true,
): FonteVigiada {
  return {
    id,
    name: `Fonte ${id}`,
    is_enabled,
    last_success_at: ultimoSucesso,
    last_run_at: ESTA_MADRUGADA,
    adapter,
  };
}

/*
 * A recolha correu esta madrugada e tentou todas as fontes — é o caso normal,
 * e é o que faz a diferença entre «ninguém a leu» e «leram-na e não trouxe
 * nada». Uma fonte que correu bem tem a leitura boa na mesma hora da tentativa.
 */
const ESTA_MADRUGADA = '2026-09-13T03:00:00Z';
const HA_DOIS_DIAS = '2026-09-11T03:00:00Z';

describe('familiasCaladas', () => {
  it('nomeia o leitor quando a família se cala quase toda', () => {
    // É o caso real de 12 e 13 de setembro de 2026: sete das oito fontes do
    // mesmo leitor sem uma leitura boa, enquanto as vinte e seis juntas de
    // freguesia responderam a todos os pedidos.
    const fontes = [
      ...Array.from({ length: 7 }, (_, i) => fonte(`eb${i}`, 'joomla-eventbooking', HA_DOIS_DIAS)),
      fonte('eb-ok', 'joomla-eventbooking', ESTA_MADRUGADA),
      ...Array.from({ length: 26 }, (_, i) => fonte(`jf${i}`, 'portal-freguesia', ESTA_MADRUGADA)),
    ];

    const familias = familiasCaladas(avaliarRecolha(fontes, AGORA));

    expect(familias).toHaveLength(1);
    expect(familias[0]).toMatchObject({
      adapter: 'joomla-eventbooking',
      total: 8,
      caladas: 7,
    });
    expect(familias[0]?.nomes).toHaveLength(7);
  });

  it('uma fonte calada sozinha não é um padrão', () => {
    // O CAMINHOS calou-se na mesma noite e é o único do seu leitor. Uma fonte
    // calada é uma fonte calada; é a segunda que muda o que se faz a seguir.
    const familias = familiasCaladas(
      avaliarRecolha([fonte('caminhos', 'caminhos', HA_DOIS_DIAS)], AGORA),
    );

    expect(familias).toEqual([]);
  });

  it('duas em vinte e seis é ruído, e não o produto', () => {
    const fontes = [
      fonte('jf1', 'portal-freguesia', HA_DOIS_DIAS),
      fonte('jf2', 'portal-freguesia', HA_DOIS_DIAS),
      ...Array.from({ length: 24 }, (_, i) =>
        fonte(`jf${i + 3}`, 'portal-freguesia', ESTA_MADRUGADA),
      ),
    ];

    expect(familiasCaladas(avaliarRecolha(fontes, AGORA))).toEqual([]);
  });

  it('as desligadas não entram, nem para o total nem para as caladas', () => {
    // Uma fonte desligada é uma decisão de quem administra, e não uma avaria —
    // a mesma regra do `avaliarRecolha`. Contá-la no denominador fazia duas
    // caladas em quatro parecerem metade de um leitor que só tem duas ligadas.
    const fontes = [
      fonte('a', 'generic-html', HA_DOIS_DIAS),
      fonte('b', 'generic-html', HA_DOIS_DIAS),
      fonte('c', 'generic-html', null, false),
      fonte('d', 'generic-html', null, false),
    ];

    const familias = familiasCaladas(avaliarRecolha(fontes, AGORA));

    expect(familias[0]).toMatchObject({ total: 2, caladas: 2 });
  });

  it('uma fonte que nunca correu não é uma fonte calada', () => {
    // Sem `last_run_at` não houve tentativa nenhuma: é uma fonte acabada de
    // ligar, e dizer que se calou é dizer que avariou o que nunca arrancou.
    const porEstrear = (id: string): FonteVigiada => ({
      id,
      name: `Fonte ${id}`,
      is_enabled: true,
      last_success_at: null,
      last_run_at: null,
      adapter: 'generic-html',
    });

    expect(familiasCaladas(avaliarRecolha([porEstrear('a'), porEstrear('b')], AGORA))).toEqual([]);
  });

  it('a família fala à primeira noite, e não à terceira', () => {
    // `saudeDaFonte` tolera duas noites antes de chamar «atrasada» a uma fonte,
    // e faz bem: uma noite falhada não é uma avaria. Mas foi essa tolerância
    // que deixou a /estado chamar «em dia» a oito fontes mudas há duas noites.
    // O sinal da família é outro — tentada depois da última leitura boa.
    const ontemDeManha = '2026-09-12T03:00:00Z';
    const fontes = [
      fonte('a', 'joomla-eventbooking', ontemDeManha),
      fonte('b', 'joomla-eventbooking', ontemDeManha),
    ];

    // A saúde das duas ainda é «em dia»: uma noite só.
    expect(avaliarRecolha(fontes, AGORA).atrasadas).toEqual([]);
    // E a família já fala.
    expect(familiasCaladas(avaliarRecolha(fontes, AGORA))[0]).toMatchObject({ caladas: 2 });
  });

  it('sem o nome do leitor não há família — uma fonte sem ele não faz par com outra sem ele', () => {
    const fontes = [fonte('a', null, HA_DOIS_DIAS), fonte('b', null, HA_DOIS_DIAS)];

    expect(familiasCaladas(avaliarRecolha(fontes, AGORA))).toEqual([]);
  });
});
