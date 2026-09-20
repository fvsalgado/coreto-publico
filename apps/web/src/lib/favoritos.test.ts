import { describe, expect, it } from 'vitest';
import { porOrdemDeData, type Favorito } from './favoritos';
import { entradasDeCalendario } from './favoritos-calendario';

/**
 * As duas partes destes módulos que não tocam no armazenamento.
 *
 * O resto — guardar, esquecer, ouvir as outras abas — é `localStorage`, que
 * aqui não existe: as funções que lhe tocam estão todas dentro de um `try` e
 * devolvem vazio, o que é exactamente o que fazem num navegador que as
 * bloqueia. O que vale a pena prender com um teste é a ordem por que a lista
 * se lê e a forma do ficheiro que ela exporta.
 */
const HOJE = '2026-09-20';

function favorito(dados: Partial<Favorito> & { slug: string }): Favorito {
  return {
    title: `Evento ${dados.slug}`,
    date_start: null,
    date_end: null,
    start_time: null,
    location: null,
    guardadoEm: '2026-09-19T10:00:00.000Z',
    ...dados,
  };
}

describe('porOrdemDeData', () => {
  it('põe o que está para vir pela ordem em que acontece', () => {
    const lista = [
      favorito({ slug: 'novembro', date_start: '2026-11-02' }),
      favorito({ slug: 'amanha', date_start: '2026-09-21' }),
      favorito({ slug: 'outubro', date_start: '2026-10-05' }),
    ];
    expect(porOrdemDeData(lista, HOJE).map((f) => f.slug)).toEqual([
      'amanha',
      'outubro',
      'novembro',
    ]);
  });

  /*
   * O que já passou não se apaga — apagar o que alguém guardou é uma decisão
   * que não é desta casa — mas vai para o fim, onde não estorva a pergunta a
   * que a lista responde: o que é que eu tenho para fazer a seguir.
   */
  it('manda o que já passou para o fim, sem o deitar fora', () => {
    const lista = [
      favorito({ slug: 'passado', date_start: '2026-09-01', date_end: '2026-09-02' }),
      favorito({ slug: 'futuro', date_start: '2026-09-25' }),
    ];
    expect(porOrdemDeData(lista, HOJE).map((f) => f.slug)).toEqual(['futuro', 'passado']);
  });

  it('uma exposição a decorrer hoje não conta como passada', () => {
    const lista = [
      favorito({ slug: 'em-cartaz', date_start: '2026-08-01', date_end: '2026-10-30' }),
      favorito({ slug: 'depois', date_start: '2026-09-28' }),
    ];
    expect(porOrdemDeData(lista, HOJE).map((f) => f.slug)).toEqual(['em-cartaz', 'depois']);
  });

  it('não mexe na lista que recebe', () => {
    const lista = [favorito({ slug: 'b', date_start: '2026-10-01' }), favorito({ slug: 'a' })];
    const copia = [...lista];
    porOrdemDeData(lista, HOJE);
    expect(lista).toEqual(copia);
  });
});

describe('entradasDeCalendario', () => {
  const guardados = [
    favorito({
      slug: 'concerto-de-outono',
      title: 'Concerto de Outono',
      date_start: '2026-10-04',
      start_time: '21:30',
      location: 'Cine-Teatro Paraíso · Tomar',
    }),
  ];

  it('leva o título, o dia, a hora e o sítio, e liga para a página do evento', () => {
    const [entrada] = entradasDeCalendario(guardados, 'https://mediotejo.coreto.org');
    expect(entrada).toMatchObject({
      date: '2026-10-04',
      startTime: '21:30',
      summary: 'Concerto de Outono',
      location: 'Cine-Teatro Paraíso · Tomar',
      url: 'https://mediotejo.coreto.org/evento/concerto-de-outono',
    });
  });

  /*
   * A cicatriz que este teste segura: o `.ics` da agenda é uma subscrição que
   * se atualiza, e este ficheiro é uma fotografia que não. Com o mesmo `UID`,
   * importar os guardados sobrepunha uma entrada viva por uma cópia
   * congelada — uma sessão adiada voltava à hora antiga sem ninguém perceber.
   */
  it('usa um espaço de nomes próprio, para não se fazer passar pelo feed da região', () => {
    const [entrada] = entradasDeCalendario(guardados, 'https://mediotejo.coreto.org');
    expect(entrada?.uid).toBe('concerto-de-outono@favoritos.mediotejo.coreto.org');
  });

  it('deixa de fora o que não tem data — um compromisso sem dia não é um compromisso', () => {
    const entradas = entradasDeCalendario(
      [...guardados, favorito({ slug: 'sem-data' })],
      'https://mediotejo.coreto.org',
    );
    expect(entradas).toHaveLength(1);
  });

  it('aguenta um endereço mal formado em vez de rebentar', () => {
    const [entrada] = entradasDeCalendario(guardados, 'nem-sequer-e-um-endereco');
    expect(entrada?.uid).toBe('concerto-de-outono@favoritos.coreto.org');
  });
});
