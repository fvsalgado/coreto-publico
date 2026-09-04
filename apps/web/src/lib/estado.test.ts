import { describe, expect, it } from 'vitest';
import { avaliarAgenda, avaliarRecolha, saudeDaFonte, veredito } from './estado';

/**
 * O que decide se alguém fica descansado.
 *
 * Um limiar errado aqui não estraga um ecrã: dá sossego a quem devia estar
 * preocupado, ou o contrário — enche de alarmes uma página que se deixa de
 * ler ao terceiro falso. Os casos escolhidos são as fronteiras, e as duas
 * distinções que a página existe para fazer: uma fonte que nunca arrancou não
 * é uma fonte avariada, e uma fonte lida com sucesso não é uma agenda cheia.
 */

const AGORA = new Date('2026-09-03T12:00:00Z');

/** Um instante a N dias de `AGORA`, em ISO. */
function haDias(dias: number): string {
  return new Date(AGORA.getTime() - dias * 86_400_000).toISOString();
}

function fonte(id: string, ultima: string | null, ligada = true) {
  return { id, name: `Agenda de ${id}`, is_enabled: ligada, last_success_at: ultima };
}

describe('saudeDaFonte', () => {
  it('dois dias ainda é «em dia»; três já é atraso', () => {
    // A recolha corre uma vez por noite: dois dias são duas rondas, e é aí
    // que a fronteira tem de estar. Um dia era apanhar a manutenção de uma
    // noite; uma semana era só dar pela avaria quando já se via na agenda.
    expect(saudeDaFonte(haDias(2), AGORA)).toBe('em-dia');
    expect(saudeDaFonte(haDias(3), AGORA)).toBe('atrasada');
  });

  it('sete dias ainda é atraso; oito é paragem', () => {
    expect(saudeDaFonte(haDias(7), AGORA)).toBe('atrasada');
    expect(saudeDaFonte(haDias(8), AGORA)).toBe('parada');
  });

  it('nunca lida não é o mesmo que parada', () => {
    // É a distinção que evita um alarme falso de cada vez que uma CIM nasce:
    // uma fonte acabada de ligar não tem leitura nenhuma, e chamar-lhe
    // avariada é dizer que rebentou uma coisa que nunca arrancou.
    expect(saudeDaFonte(null, AGORA)).toBe('por-estrear');
  });

  it('uma data ilegível conta como parada, e não como recente', () => {
    // O contrário — tratar o que não se percebe como «em dia» — é a maneira
    // de uma avaria de dados se disfarçar de saúde.
    expect(saudeDaFonte('nem-data-nem-nada', AGORA)).toBe('parada');
  });
});

describe('avaliarRecolha', () => {
  it('as fontes desligadas ficam de fora das contas', () => {
    // Uma fonte desligada é uma decisão de quem administra, não uma avaria.
    const estado = avaliarRecolha(
      [fonte('tomar', haDias(1)), fonte('abrantes', null, false)],
      AGORA,
    );
    expect(estado.vigiadas.map((f) => f.id)).toEqual(['tomar']);
    expect(estado.porEstrear).toHaveLength(0);
  });

  it('conta os dias desde a última leitura boa, e nenhum quando não houve', () => {
    const estado = avaliarRecolha([fonte('tomar', haDias(4)), fonte('macao', null)], AGORA);
    expect(estado.atrasadas[0]?.dias).toBe(4);
    expect(estado.porEstrear[0]?.dias).toBeNull();
  });
});

describe('avaliarAgenda', () => {
  const CONCELHOS = [
    { id: 'tomar', name: 'Tomar' },
    { id: 'macao', name: 'Mação' },
    { id: 'abrantes', name: 'Abrantes' },
  ];

  it('soma o que há e nomeia quem está a zero, por ordem', () => {
    const agenda = avaliarAgenda(CONCELHOS, { tomar: 12, abrantes: 3 });
    expect(agenda.total).toBe(15);
    expect(agenda.vazios).toEqual(['Mação']);
  });

  it('um concelho sem entrada nas contagens conta como zero, não como ausente', () => {
    // A contagem devolve um objeto indexado pelo concelho, e um concelho sem
    // eventos pode simplesmente não lá estar. Lê-lo como «não sei» em vez de
    // «zero» era a maneira de um concelho vazio nunca aparecer nesta página.
    const agenda = avaliarAgenda(CONCELHOS, {});
    expect(agenda.total).toBe(0);
    expect(agenda.vazios).toEqual(['Abrantes', 'Mação', 'Tomar']);
  });
});

describe('veredito', () => {
  const CHEIA = { total: 40, vazios: [] };

  it('uma agenda vazia é o pior caso, mesmo com as fontes todas em dia', () => {
    // É exatamente o caso que ninguém apanha de outra maneira: as leituras
    // correm, os erros estão a zero, e não há nada para mostrar a quem
    // visita. As fontes em dia não podem servir de tranquilizante.
    const recolha = avaliarRecolha([fonte('tomar', haDias(1))], AGORA);
    const parecer = veredito(recolha, { total: 0, vazios: ['Tomar'] });
    expect(parecer.grau).toBe('mau');
  });

  it('uma fonte parada manda no veredito à frente de uma atrasada', () => {
    const recolha = avaliarRecolha([fonte('tomar', haDias(20)), fonte('macao', haDias(4))], AGORA);
    const parecer = veredito(recolha, CHEIA);
    expect(parecer.grau).toBe('mau');
    expect(parecer.frase).toContain('mais de uma semana');
  });

  it('conta as fontes no plural e no singular', () => {
    const uma = avaliarRecolha([fonte('tomar', haDias(4))], AGORA);
    expect(veredito(uma, CHEIA).frase).toBe('Há uma fonte que falhou as últimas rondas.');

    const duas = avaliarRecolha([fonte('tomar', haDias(4)), fonte('macao', haDias(5))], AGORA);
    expect(veredito(duas, CHEIA).frase).toBe('Há 2 fontes que falharam as últimas rondas.');
  });

  it('sem fontes ligadas não diz que está tudo bem', () => {
    // Zero fontes ligadas passa em todas as contagens de avaria — não há
    // nenhuma parada nem nenhuma atrasada — e sem este caso a página abria
    // com «todas as fontes foram lidas» por cima de fonte nenhuma.
    const parecer = veredito(avaliarRecolha([], AGORA), CHEIA);
    expect(parecer.grau).toBe('atencao');
    expect(parecer.frase).toContain('nenhuma fonte ligada');
  });

  it('tudo lido e agenda cheia dá o sossego, e só aí', () => {
    const recolha = avaliarRecolha([fonte('tomar', haDias(1)), fonte('macao', haDias(2))], AGORA);
    expect(veredito(recolha, CHEIA).grau).toBe('bom');
  });
});
