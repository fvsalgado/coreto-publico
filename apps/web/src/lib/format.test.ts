import { describe, expect, it } from 'vitest';
import { thumbUrl } from './format';

/**
 * O catálogo do Médio Tejo tem 112 fotografias do Commons, todas gravadas com
 * `width=1600`, e a regra antiga — trocar essa cadeia literal por `width=800`
 * — acertava-lhes a todas. Era por isso que o defeito não se via: bastava uma
 * fotografia chegar com outra largura, ou sem largura nenhuma, para ir inteira
 * para uma miniatura de noventa e seis píxeis, e nenhum teste o dizia.
 */
describe('thumbUrl', () => {
  const FICHEIRO = 'https://commons.wikimedia.org/wiki/Special:FilePath/Teatro_Virg%C3%ADnia.jpg';

  it('reduz a largura de ficha que o catálogo grava hoje', () => {
    expect(thumbUrl(`${FICHEIRO}?width=1600`)).toBe(`${FICHEIRO}?width=800`);
  });

  it('reduz um endereço do Commons que chega sem largura nenhuma', () => {
    expect(thumbUrl(FICHEIRO)).toBe(`${FICHEIRO}?width=800`);
  });

  it('reduz um endereço do Commons que chega com outra largura qualquer', () => {
    expect(thumbUrl(`${FICHEIRO}?width=2400`)).toBe(`${FICHEIRO}?width=800`);
  });

  it('preserva a acentuação percentual do nome do ficheiro', () => {
    // O nome vive no caminho e vem percent-encoded do Commons. Descodificá-lo
    // ao reescrever a largura dava um 404 em todas as fotografias com acento —
    // e são quase todas, num catálogo português.
    expect(thumbUrl(`${FICHEIRO}?width=1600`)).toContain('Teatro_Virg%C3%ADnia.jpg');
  });

  it('não estraga o endereço já reduzido quando volta a passar', () => {
    expect(thumbUrl(`${FICHEIRO}?width=800`)).toBe(`${FICHEIRO}?width=800`);
  });

  it('deixa intacto o que não é do Commons', () => {
    // As dez fotografias do blogger e a do infoportugal. O `blogger` até tem
    // um segmento de tamanho no caminho, mas é um esquema de endereços de
    // outra casa: um parâmetro `width` inventado aqui não encolhia nada e só
    // sujava o endereço.
    const blogger =
      'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjl6Ad0/s1600/HPIM6453.JPG';
    expect(thumbUrl(blogger)).toBe(blogger);

    const infoportugal = 'https://cms.infoportugal.info/media/fotos/final/Tomar/TOM9276.jpg';
    expect(thumbUrl(infoportugal)).toBe(infoportugal);
  });

  it('devolve intacto o que nem endereço é', () => {
    // Degradação graciosa: a coluna `image_url` é texto livre, e uma linha
    // torta de uma recolha não pode rebentar a página dos espaços.
    expect(thumbUrl('')).toBe('');
    expect(thumbUrl('/imagens/local.jpg')).toBe('/imagens/local.jpg');
  });
});
