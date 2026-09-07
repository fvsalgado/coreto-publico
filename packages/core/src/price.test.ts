import { describe, expect, it } from 'vitest';
import { formatPrice, parsePrice } from './price';

describe('parsePrice', () => {
  it('lê um valor único', () => {
    expect(parsePrice('12€')).toEqual({ priceMin: 12, priceMax: 12 });
    expect(parsePrice('10,00 €')).toEqual({ priceMin: 10, priceMax: 10 });
    expect(parsePrice('5 euros')).toEqual({ priceMin: 5, priceMax: 5 });
    expect(parsePrice('€ 7,50')).toEqual({ priceMin: 7.5, priceMax: 7.5 });
  });

  it('lê um intervalo', () => {
    expect(parsePrice('de 8 a 25 euros')).toEqual({ priceMin: 8, priceMax: 25 });
    expect(parsePrice('10€ - 20€')).toEqual({ priceMin: 10, priceMax: 20 });
  });

  it('lê as várias maneiras de dizer que é de graça', () => {
    for (const text of [
      'Entrada livre',
      'entrada gratuita',
      'Acesso livre',
      'Gratuito',
      'ENTRADA FRANCA',
    ]) {
      expect(parsePrice(text)).toEqual({ isFree: true, priceMin: 0 });
    }
  });

  it('deixa o preço pago ganhar à palavra «gratuito»', () => {
    expect(parsePrice('12€ (entrada livre para menores de 12)')).toEqual({
      priceMin: 12,
      priceMax: 12,
    });
  });

  it('junta os vários preços de uma tabela', () => {
    expect(parsePrice('5€ / 3€ estudantes')).toEqual({ priceMin: 3, priceMax: 5 });
  });

  it('ignora números que não são preços de bilhete', () => {
    expect(parsePrice(null, 'Prémio de 5000 euros para o vencedor')).toEqual({});
    expect(parsePrice('Lotação: 300 lugares')).toEqual({});
  });

  it('ignora valores acima do tecto', () => {
    expect(parsePrice('apoio de 20000 euros')).toEqual({});
  });

  it('devolve vazio quando não há nada a ler', () => {
    expect(parsePrice(null, undefined)).toEqual({});
    expect(parsePrice('', '')).toEqual({});
  });
});

/**
 * Os números que este leitor lia de dentro de outros.
 *
 * O `\d{1,3}` sem fronteira fazia o motor recomeçar um caractere à frente
 * depois de falhar, e o resultado era um preço fabricado: um número que a
 * fonte nunca escreveu, publicado como se fosse dela. É o pecado que esta casa
 * põe acima de todos os outros, e estava aqui.
 *
 * Cada linha é um par medido contra o leitor antigo — o que ele dava, e o que
 * tem de dar. Nenhum destes casos existe hoje no catálogo do Médio Tejo (0 de
 * 274 eventos com `price_min = 500`, medido a 7 de setembro de 2026); o que
 * existe é a porta aberta, e é a porta que se fecha.
 */
describe('o número lido de dentro de outro', () => {
  const fabricacoes: Array<{ entrada: string; antes: string; agora: string | null }> = [
    { entrada: '1500€', antes: '500 €', agora: '1500€' },
    { entrada: '1200 €', antes: '200 €', agora: '1200 €' },
    { entrada: '2500€', antes: '500 €', agora: '2500€' },
    { entrada: '501€', antes: '501€', agora: '501€' },
    // Os dois piores: um evento pago anunciado como entrada livre.
    { entrada: '1000€', antes: 'Entrada livre', agora: '1000€' },
    { entrada: '10.000 €', antes: 'Entrada livre', agora: '10.000 €' },
    // O intervalo em que só o extremo de cima passa do tecto.
    {
      entrada: 'Bilhetes de 10 a 1500 euros',
      antes: '500 €',
      agora: 'Bilhetes de 10 a 1500 euros',
    },
  ];

  for (const { entrada, antes, agora } of fabricacoes) {
    it(`«${entrada}» dava «${antes}» e passa a dizer o que a fonte escreveu`, () => {
      const lido = parsePrice(entrada);
      expect(lido.priceMin).toBeUndefined();
      expect(lido.isFree).toBeUndefined();
      expect(formatPrice(lido, entrada)).toBe(agora);
    });
  }

  it('e o milhar à portuguesa lê-se como milhar, não como decimal', () => {
    // Três dígitos a seguir ao separador são milhar; um ou dois são decimal.
    // Não há terceira forma, e é o que faz «€2.00» e «1.500 €» caberem na
    // mesma regra.
    expect(parsePrice('1.500 €')).toEqual({});
    expect(parsePrice('1 500€')).toEqual({});
    expect(parsePrice('€2.00')).toEqual({ priceMin: 2, priceMax: 2 });
    expect(parsePrice('2,50€')).toEqual({ priceMin: 2.5, priceMax: 2.5 });
    expect(parsePrice('12.50€')).toEqual({ priceMin: 12.5, priceMax: 12.5 });
  });
});

/**
 * O campo do preço e a prosa não valem o mesmo.
 *
 * O veto por contexto («prémio», «orçamento», «apoio de») serve para a prosa,
 * onde números grandes falam de outra coisa. Aplicado ao campo que a fonte
 * dedicou ao preço, deitava fora a única informação boa que havia — e foi o
 * que aconteceu ao XXIX Grande Prémio do Museu Nacional Ferroviário, no
 * Entroncamento: o único evento do catálogo com o rótulo em forma
 * estrangeira, «€2.00», enquanto os dados estruturados da mesma página diziam
 * 2.
 */
describe('o campo do preço lê-se sozinho', () => {
  const GRANDE_PREMIO =
    'Decorre no dia 20 de setembro, pelas 10h00, o XXIX Grande Prémio Museu Nacional Ferroviário e a 11ª Caminhada José Canelo. A prova tem o custo de 2€ com t-shirt técnica e troféus para os 3 primeiros de cada escalão.';

  it('uma palavra da prosa não veta o campo que a fonte dedicou ao preço', () => {
    const lido = parsePrice('€2.00', GRANDE_PREMIO);
    expect(lido).toEqual({ priceMin: 2, priceMax: 2 });
    expect(formatPrice(lido, '€2.00')).toBe('2 €');
  });

  it('nem a gratuitidade declarada no campo', () => {
    const lido = parsePrice('Entrada livre', 'Concurso de fotografia com prémio para o vencedor.');
    expect(lido).toEqual({ isFree: true, priceMin: 0 });
  });

  it('mas a prosa continua a decidir quando o campo se cala', () => {
    expect(parsePrice(null, 'Bilhetes a 8 euros.')).toEqual({ priceMin: 8, priceMax: 8 });
    expect(parsePrice(null, 'Prémio de 5000 euros para o vencedor')).toEqual({});
  });
});

/**
 * O árbitro de dez concelhos.
 *
 * `readPriceOrVenue` (`packages/ingest/src/adapters/joomla-eventbooking.ts`)
 * não usa este leitor para ler um preço: usa-o para decidir se o campo
 * `.eb-individual-price` traz um preço ou o **nome do espaço**. Uma mudança
 * aqui muda para onde vão dezassete cadeias reais de dez câmaras, e os testes
 * que lá estão só verificam a forma do que saiu — passariam com a decisão
 * trocada.
 *
 * Por isso as dezassete ficam presas aqui por conteúdo. São as capturadas nas
 * sete listagens dos fixtures: onze dizem que a entrada é livre, seis são
 * nomes de espaços.
 */
describe('o árbitro entre um preço e o nome de um espaço', () => {
  const ehPreco = (texto: string): boolean => {
    const parsed = parsePrice(texto);
    return parsed.isFree !== undefined || parsed.priceMin !== undefined;
  };

  it.each([
    ['INSCRIÇÕES GRATUITAS', true],
    ['Entrada Gratuita', true],
    ['Entrada Livre', true],
    ['Mercado Municipal António Teixeira Antunes', false],
    ['Complexo Cultural da Levada de Tomar', false],
    ['NAC.2 - Complexo Cultural da Levada', false],
    ['Tomar', false],
    ['CEFT - Casa dos Cubos e Convento de Cristo', false],
    ['Complexo Cultural da Levada de Tomar - Sala Multiusos', false],
  ])('«%s» é preço: %s', (texto, esperado) => {
    expect(ehPreco(texto)).toBe(esperado);
  });
});

describe('formatPrice', () => {
  it('escreve os rótulos que aparecem no cartão', () => {
    expect(formatPrice({ isFree: true })).toBe('Entrada livre');
    expect(formatPrice({ priceMin: 12, priceMax: 12 })).toBe('12 €');
    expect(formatPrice({ priceMin: 7.5, priceMax: 7.5 })).toBe('7,50 €');
    expect(formatPrice({ priceMin: 8, priceMax: 25 })).toBe('8 € – 25 €');
  });

  it('cai para o texto original quando não há número', () => {
    expect(formatPrice({}, 'Consultar bilheteira')).toBe('Consultar bilheteira');
    expect(formatPrice({})).toBe(null);
  });

  /**
   * O segundo juiz da gratuitidade, que dizia o contrário do primeiro.
   *
   * `is_free` saía de `parsePrice`; o rótulo saía daqui, com uma regra sua —
   * «um mínimo a zero é entrada livre». Duas decisões sobre a mesma coisa, na
   * mesma linha da base de dados. Um zero que venha de uma leitura falhada
   * deixa de afirmar seja o que for.
   */
  it('um zero sem gratuitidade declarada não afirma nada', () => {
    expect(formatPrice({ priceMin: 0 })).toBe(null);
    expect(formatPrice({ priceMin: 0, priceMax: 0 })).toBe(null);
    expect(formatPrice({ priceMin: 0 }, '1000€')).toBe('1000€');
  });

  it('mas um zero honesto continua a ser entrada livre', () => {
    expect(parsePrice('0€')).toEqual({ priceMin: 0, priceMax: 0, isFree: true });
    expect(formatPrice(parsePrice('0€'), '0€')).toBe('Entrada livre');
  });

  it('e um intervalo que começa em zero continua a ser um intervalo', () => {
    const lido = parsePrice('de 0 a 5 euros');
    expect(lido).toEqual({ priceMin: 0, priceMax: 5 });
    expect(formatPrice(lido)).toBe('0 € – 5 €');
  });
});
