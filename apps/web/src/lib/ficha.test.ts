import { describe, expect, it } from 'vitest';
import {
  estadoDaFicha,
  localSoATerra,
  novaDataDoAdiado,
  partilhaDoEvento,
  pedidoDeCorrecao,
  precoDaFicha,
  quandoCurto,
  quandoDaFicha,
  type EventoDaFicha,
  type SessaoDaFicha,
} from './ficha';

const HOJE = '2026-10-01';

function sessao(dia: string, inicio: string | null = null, extra: Partial<SessaoDaFicha> = {}) {
  return { session_date: dia, start_time: inicio, end_time: null, is_cancelled: false, ...extra };
}

function evento(parcial: Partial<EventoDaFicha> = {}): EventoDaFicha {
  return {
    status: 'published',
    date_start: '2026-10-03',
    date_end: '2026-10-03',
    is_ongoing: false,
    sessions: [sessao('2026-10-03', '21:30:00')],
    ...parcial,
  };
}

describe('estadoDaFicha', () => {
  it('um evento publicado cujo último dia já passou já aconteceu, mesmo antes do arquivo', () => {
    // O teatro de 19 de setembro, visto a 1 de outubro: abria com a data em
    // destaque e «Adicionar ao calendário» (C2-005).
    const passado = evento({
      date_start: '2026-09-19',
      date_end: '2026-09-19',
      sessions: [sessao('2026-09-19', '21:30')],
    });
    expect(estadoDaFicha(passado, HOJE)).toBe('ja-aconteceu');
  });

  it('o arquivo é registo mesmo com data por vir, e a exposição aberta não passou', () => {
    expect(estadoDaFicha(evento({ status: 'archived' }), HOJE)).toBe('ja-aconteceu');
    const exposicao = evento({
      is_ongoing: true,
      date_start: '2026-05-01',
      date_end: '2026-10-22',
      sessions: [sessao('2026-05-01'), sessao('2026-10-22')],
    });
    expect(estadoDaFicha(exposicao, HOJE)).toBe('por-acontecer');
  });

  it('cancelado e adiado vêm do estado; e um evento sem sessão de pé conta como cancelado', () => {
    expect(estadoDaFicha(evento({ status: 'cancelled' }), HOJE)).toBe('cancelado');
    expect(estadoDaFicha(evento({ status: 'postponed' }), HOJE)).toBe('adiado');
    const todasCanceladas = evento({
      sessions: [sessao('2026-10-03', '21:30', { is_cancelled: true })],
    });
    expect(estadoDaFicha(todasCanceladas, HOJE)).toBe('cancelado');
  });
});

describe('novaDataDoAdiado', () => {
  it('só há nova data quando a sessão antiga foi cancelada e há uma de pé depois dela', () => {
    const semData = evento({ status: 'postponed' });
    expect(novaDataDoAdiado(semData)).toBe(null);

    const comData = evento({
      status: 'postponed',
      sessions: [
        sessao('2026-10-03', '21:30', { is_cancelled: true }),
        sessao('2026-11-14', '21:30'),
      ],
    });
    expect(novaDataDoAdiado(comData)).toBe('2026-11-14');
    // E a linha «Quando» já mostra a nova, porque não lê sessões canceladas.
    expect(quandoDaFicha(comData, HOJE).texto).toBe('Sábado, 14 de novembro · 21h30');
  });

  it('num evento que não está adiado não há nova data nenhuma', () => {
    const publicado = evento({
      sessions: [sessao('2026-10-03', '21:30', { is_cancelled: true }), sessao('2026-11-14')],
    });
    expect(novaDataDoAdiado(publicado)).toBe(null);
  });
});

describe('quandoDaFicha', () => {
  it('a próxima sessão com o dia por extenso e a hora', () => {
    const quando = quandoDaFicha(evento(), HOJE);
    expect(quando.texto).toBe('Sábado, 3 de outubro · 21h30');
    expect(quando.dateTime).toBe('2026-10-03T21:30');
    expect(quando.outras).toBe(null);
  });

  it('duas sessões em dias separados não são um intervalo (C2-013)', () => {
    const coro = evento({
      date_start: '2026-10-04',
      date_end: '2026-10-12',
      sessions: [sessao('2026-10-04', '16:00:00'), sessao('2026-10-12', '21:00:00')],
    });
    const quando = quandoDaFicha(coro, HOJE);
    expect(quando.texto).toBe('Domingo, 4 de outubro · 16h');
    expect(quando.outras).toBe('Também a 12 de outubro, às 21h');
  });

  it('duas sessões no mesmo dia dizem-se as duas, e muitas datas contam-se', () => {
    const bebes = evento({
      sessions: [sessao('2026-10-03', '16:30'), sessao('2026-10-03', '10:30')],
    });
    expect(quandoDaFicha(bebes, HOJE).texto).toBe('Sábado, 3 de outubro · 10h30 e 16h30');

    const ciclo = evento({
      sessions: ['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24'].map((d) =>
        sessao(d, '18:00'),
      ),
    });
    expect(quandoDaFicha(ciclo, HOJE).outras).toBe('E mais 3 datas');
  });

  it('a meia-noite sem fim é «hora por confirmar», e não «0h» (C2-004)', () => {
    const almoco = evento({
      date_start: '2026-10-04',
      date_end: '2026-10-04',
      sessions: [sessao('2026-10-04', '00:00:00')],
    });
    const quando = quandoDaFicha(almoco, HOJE);
    expect(quando.texto).toBe('Domingo, 4 de outubro');
    expect(quando.horaPorConfirmar).toBe(true);
    expect(quando.dateTime).toBe('2026-10-04');
  });

  it('a meia-noite com fim diz-se pelo nome', () => {
    const fados = evento({
      sessions: [sessao('2026-10-03', '00:00:00', { end_time: '02:00:00' })],
    });
    expect(quandoDaFicha(fados, HOJE).texto).toBe('Sábado, 3 de outubro · meia-noite');
  });

  it('uma exposição diz até quando, e um ano que não é este escreve-se', () => {
    const exposicao = evento({
      is_ongoing: true,
      date_start: '2026-09-01',
      date_end: '2027-01-29',
      sessions: [sessao('2026-09-01'), sessao('2027-01-29')],
    });
    expect(quandoDaFicha(exposicao, HOJE).texto).toBe('Em cartaz até 29 de janeiro de 2027');
  });

  it('o que já passou diz quando foi, sem pedir hora', () => {
    const passado = evento({
      date_start: '2026-09-19',
      date_end: '2026-09-19',
      sessions: [sessao('2026-09-19')],
    });
    const quando = quandoDaFicha(passado, HOJE);
    expect(quando.texto).toBe('Sábado, 19 de setembro');
    expect(quando.horaPorConfirmar).toBe(false);
  });

  it('sem sessão nenhuma, as datas do evento; sem datas, diz-se', () => {
    expect(quandoDaFicha(evento({ sessions: [] }), HOJE).texto).toBe('Sábado, 3 de outubro');
    expect(
      quandoDaFicha(evento({ sessions: [], date_start: null, date_end: null }), HOJE).texto,
    ).toBe('Data por confirmar');
  });
});

describe('precoDaFicha', () => {
  it('a falta de preço diz-se, com o caminho para a página oficial quando há (C2-014)', () => {
    expect(precoDaFicha({ is_free: false, preco: null, temPaginaOficial: true })).toEqual({
      texto: 'Não indicado — confirme na página oficial',
      tom: 'nao-indicado',
    });
    expect(precoDaFicha({ is_free: false, preco: null, temPaginaOficial: false }).texto).toBe(
      'Não indicado pela fonte',
    );
  });

  it('entrada livre, um valor, e um «Pago» que não diz quanto', () => {
    expect(precoDaFicha({ is_free: true, preco: null, temPaginaOficial: false }).tom).toBe('livre');
    expect(precoDaFicha({ is_free: false, preco: '4,80 €', temPaginaOficial: true }).texto).toBe(
      '4,80 €',
    );
    expect(precoDaFicha({ is_free: false, preco: 'Pago', temPaginaOficial: true }).texto).toBe(
      'Pago — o valor não foi indicado',
    );
  });
});

describe('localSoATerra', () => {
  it('reconhece a vila ou o concelho dados como sítio, sem olhar a acentos', () => {
    expect(localSoATerra('Constância', ['Constância', null])).toBe(true);
    expect(localSoATerra('constancia', ['Constância'])).toBe(true);
    expect(localSoATerra('Salão da Junta', ['Constância'])).toBe(false);
    expect(localSoATerra(null, ['Constância'])).toBe(false);
  });
});

describe('partilhaDoEvento', () => {
  it('o título leva o quando, e a descrição começa pelo sítio e pelo preço (C3-014)', () => {
    const partilha = partilhaDoEvento({
      titulo: 'Filho de ninguém',
      quando: 'domingo, 4 out, 21h',
      onde: 'Cine-Teatro Paraíso, Tomar',
      preco: '4,80 €',
      resumo: 'Mathilda e Thomas estão casados há mais de 15 anos.',
    });
    expect(partilha.titulo).toBe('Filho de ninguém — domingo, 4 out, 21h');
    expect(partilha.descricao).toBe(
      'Cine-Teatro Paraíso, Tomar · 4,80 €. Mathilda e Thomas estão casados há mais de 15 anos.',
    );
  });

  it('corta uma sinopse longa à palavra, e não inventa o que falta', () => {
    const partilha = partilhaDoEvento({
      titulo: 'X',
      quando: null,
      onde: null,
      preco: null,
      resumo: 'palavra '.repeat(60),
    });
    expect(partilha.titulo).toBe('X');
    expect(partilha.descricao.length).toBeLessThanOrEqual(200);
    expect(partilha.descricao.endsWith('…')).toBe(true);
  });
});

describe('quandoCurto', () => {
  it('o dia da semana, o dia e a hora, para caber num título', () => {
    expect(quandoCurto(evento(), HOJE)).toBe('sábado, 3 out, 21h30');
  });
});

describe('pedidoDeCorrecao', () => {
  it('leva o evento no assunto e o endereço da ficha no corpo (C2-031)', () => {
    const href = pedidoDeCorrecao({
      email: 'agenda@exemplo.pt',
      titulo: 'Almoço convívio',
      quando: 'domingo, 4 out',
      endereco: 'https://agenda.exemplo.pt/evento/almoco',
    });
    expect(href.startsWith('mailto:agenda@exemplo.pt?subject=')).toBe(true);
    const parametros = new URLSearchParams(href.split('?')[1]);
    expect(parametros.get('subject')).toBe('Correção: Almoço convívio (domingo, 4 out)');
    expect(parametros.get('body')).toContain('https://agenda.exemplo.pt/evento/almoco');
    expect(parametros.get('body')).toContain('O que está errado:');
  });
});
