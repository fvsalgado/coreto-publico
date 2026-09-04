import { describe, expect, it } from 'vitest';
import { direcoesPara, verNoGoogleMaps } from './direcoes';

describe('direcoesPara', () => {
  const [google, apple, waze] = direcoesPara(39.4615727, -8.1983196, 'Praça Barão da Batalha');

  it('dá as três aplicações, por ordem', () => {
    expect([google?.nome, apple?.nome, waze?.nome]).toEqual(['Google Maps', 'Apple Maps', 'Waze']);
  });

  it('arredonda a coordenada ao metro', () => {
    // Onze casas decimais numa ligação não servem ninguém e denunciam que
    // ninguém olhou para ela.
    expect(google?.href).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=39.46157,-8.19832',
    );
  });

  it('leva o nome do sítio ao Apple Maps, escapado', () => {
    expect(apple?.href).toBe(
      'https://maps.apple.com/?daddr=39.46157,-8.19832&q=Pra%C3%A7a%20Bar%C3%A3o%20da%20Batalha',
    );
  });

  it('sem nome, não inventa parâmetro nenhum', () => {
    expect(direcoesPara(39.5, -8.2)[1]?.href).toBe(
      'https://maps.apple.com/?daddr=39.50000,-8.20000',
    );
  });

  it('manda o Waze navegar, e não só mostrar', () => {
    expect(waze?.href).toBe('https://waze.com/ul?ll=39.46157,-8.19832&navigate=yes');
  });
});

describe('verNoGoogleMaps', () => {
  it('procura pelo nome, morada e concelho quando há nome', () => {
    expect(
      verNoGoogleMaps({
        nome: 'Teatro Virgínia',
        morada: 'Largo José Lopes dos Santos',
        concelho: 'Torres Novas',
        latitude: 39.4803,
        longitude: -8.54,
      }),
    ).toBe(
      'https://www.google.com/maps/search/?api=1&query=Teatro%20Virg%C3%ADnia%2C%20Largo%20Jos%C3%A9%20Lopes%20dos%20Santos%2C%20Torres%20Novas',
    );
  });

  it('a coordenada não entra na procura quando há nome — é a ficha que se quer, não o alfinete', () => {
    const href = verNoGoogleMaps({
      nome: 'Coreto de Alvega',
      morada: 'Largo do Coreto',
      concelho: 'Abrantes',
      latitude: 39.4,
      longitude: -8.1,
    });

    expect(href).toContain('Coreto%20de%20Alvega');
    expect(href).not.toContain('39.4');
  });

  it('não repete o que já lá está', () => {
    const href = verNoGoogleMaps({
      nome: 'Tomar',
      morada: null,
      concelho: 'Tomar',
      latitude: null,
      longitude: null,
    });

    expect(href).toBe('https://www.google.com/maps/search/?api=1&query=Tomar');
  });

  it('sem nome nenhum, cai na coordenada', () => {
    expect(
      verNoGoogleMaps({
        nome: null,
        morada: null,
        concelho: null,
        latitude: 39.46157,
        longitude: -8.19832,
      }),
    ).toBe('https://www.google.com/maps/search/?api=1&query=39.46157,-8.19832');
  });

  it('sem nome e sem ponto, não há ligação a oferecer', () => {
    expect(
      verNoGoogleMaps({
        nome: null,
        morada: null,
        concelho: null,
        latitude: null,
        longitude: null,
      }),
    ).toBeNull();
  });
});

describe('verNoGoogleMaps e os nomes do catálogo', () => {
  const procura = (nome: string) =>
    decodeURIComponent(
      (
        verNoGoogleMaps({
          nome,
          morada: null,
          concelho: 'Tomar',
          latitude: null,
          longitude: null,
        }) ?? ''
      ).replace('https://www.google.com/maps/search/?api=1&query=', ''),
    );

  it('tira o parêntesis que repete o nome', () => {
    expect(procura('Convento de Cristo (Castelo Templário e Convento de Cristo)')).toBe(
      'Convento de Cristo, Tomar',
    );
    expect(
      procura(
        'Museu Nacional Ferroviário (Fundação Museu Nacional Ferroviário Armando Ginestal Machado)',
      ),
    ).toBe('Museu Nacional Ferroviário, Tomar');
  });

  it('deixa o travessão, que é onde está o nome por extenso', () => {
    // Cortar pela sigla deixava a procura com quatro letras.
    expect(procura('MIAA — Museu Ibérico de Arqueologia e Arte (Abrantes)')).toBe(
      'MIAA — Museu Ibérico de Arqueologia e Arte, Tomar',
    );
    expect(procura('CCLT — Complexo Cultural da Levada de Tomar')).toBe(
      'CCLT — Complexo Cultural da Levada de Tomar, Tomar',
    );
  });

  it('não deixa espaço a mais quando o parêntesis está a meio', () => {
    expect(procura('Casa da Cultura de Alcanena (Casa Municipal da Cultura) e Páteo')).toBe(
      'Casa da Cultura de Alcanena e Páteo, Tomar',
    );
  });
});
