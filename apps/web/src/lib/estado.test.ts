import { describe, expect, it } from 'vitest';
import {
  avaliarAgenda,
  avaliarRecolha,
  desdeQuandoPorLer,
  fraseDaFonte,
  leituraDoConcelho,
  saudeDaFonte,
  veredito,
} from './estado';

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

function fonte(id: string, ultima: string | null, ligada = true, corrida = ultima) {
  return {
    id,
    name: `Agenda de ${id}`,
    is_enabled: ligada,
    last_success_at: ultima,
    last_run_at: corrida,
  };
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

/**
 * A frase que as duas páginas escrevem, escrita uma vez.
 *
 * O caso que a fez existir é o terceiro: uma fonte lida todas as noites que
 * não traz nada. Antes de `last_run_at` ser público, a `/fontes` escrevia
 * «Lida com sucesso a 20 de agosto» durante as três semanas em que o concelho
 * estava sem agenda nenhuma, e nada na página dizia que tinha havido
 * tentativas desde então.
 */
describe('fraseDaFonte', () => {
  const comSaude = (ultima: string | null, corrida: string | null) => {
    const [primeira] = avaliarRecolha([fonte('cm-tomar', ultima, true, corrida)], AGORA).vigiadas;
    if (!primeira) throw new Error('sem fonte');
    return primeira;
  };
  const data = (iso: string) => iso;

  it('em dia diz só que foi lida com sucesso', () => {
    expect(fraseDaFonte(comSaude(haDias(1), haDias(1)), data)).toBe(
      `Lida com sucesso a ${haDias(1).slice(0, 10)}.`,
    );
  });

  it('lida e sem nada legível: as duas datas, e a diferença entre elas', () => {
    const frase = fraseDaFonte(comSaude(haDias(20), haDias(0)), data);
    expect(frase).toBe(
      `Lida a ${haDias(0).slice(0, 10)}, mas sem eventos legíveis desde ${haDias(20).slice(0, 10)}.`,
    );
    // A frase antiga dizia «Lida com sucesso a …» e parava aí.
    expect(frase).not.toContain('com sucesso');
  });

  it('nunca lida, e nunca sequer tentada', () => {
    expect(fraseDaFonte(comSaude(null, null), data)).toBe('Ainda não foi lida.');
  });

  it('tentada e nunca com resultado não se confunde com nunca tentada', () => {
    expect(fraseDaFonte(comSaude(null, haDias(0)), data)).toBe(
      `Lida a ${haDias(0).slice(0, 10)}, e ainda sem eventos legíveis.`,
    );
  });
});

/**
 * A deriva ao terceiro dia, que é a promessa desta vaga do lado da página.
 *
 * A recolha deixou de escrever `last_success_at` quando a contagem cai muito
 * abaixo do costume (`avaliarContagem`, em @coreto/core). Aqui prova-se o
 * outro lado: com essa coluna congelada, a página apanha a fonte sozinha, sem
 * lhe ter sido dito que houve deriva nenhuma. É o instrumento e a avaria a
 * encontrarem-se.
 */
describe('uma fonte que derivou aparece como atrasada ao terceiro dia', () => {
  it('duas noites de deriva ainda não acusam; a terceira acusa', () => {
    // A fonte continua a ser lida todas as noites — `last_run_at` é de hoje —
    // e o que congelou foi a última leitura boa.
    const duasNoites = avaliarRecolha([fonte('cm-tomar', haDias(2), true, haDias(0))], AGORA);
    expect(duasNoites.emDia).toHaveLength(1);
    expect(duasNoites.atrasadas).toHaveLength(0);

    const tresNoites = avaliarRecolha([fonte('cm-tomar', haDias(3), true, haDias(0))], AGORA);
    expect(tresNoites.atrasadas).toHaveLength(1);
    expect(veredito(tresNoites, { total: 40, vazios: [] }).grau).toBe('atencao');
  });
});

/**
 * A distinção que dá título à página de um concelho.
 *
 * Não é um detalhe de redação: enquanto isto não existiu, a página de Mação
 * dizia «Ainda não há programação publicada» com a fonte da câmara bloqueada
 * há cinco dias. Cada caso abaixo é uma frase diferente que a página pode
 * dizer, e o que a separa das outras.
 */
describe('leituraDoConcelho', () => {
  it('sem conseguir ler as fontes, não sabe — e não finge que sabe', () => {
    // O caso que separa isto de tudo o resto: `null` não é «zero fontes».
    expect(leituraDoConcelho(null)).toEqual({ tipo: 'nao-sei' });
  });

  it('sem fontes ligadas, não é avaria: é um concelho que ninguém lê', () => {
    expect(leituraDoConcelho(avaliarRecolha([fonte('macao', null, false)], AGORA))).toEqual({
      tipo: 'sem-vigilancia',
    });
    // Uma região acabada de nascer está toda assim, e nenhuma delas está
    // partida.
    expect(leituraDoConcelho(avaliarRecolha([], AGORA))).toEqual({ tipo: 'sem-vigilancia' });
  });

  it('com tudo lido de fresco, o silêncio é do concelho e pode dizer-se', () => {
    const recolha = avaliarRecolha([fonte('a', haDias(1)), fonte('b', haDias(0))], AGORA);
    expect(leituraDoConcelho(recolha)).toEqual({ tipo: 'em-dia' });
  });

  it('uma fonte parada chega para o silêncio deixar de ser do concelho', () => {
    // O caso de Mação: duas fontes, uma lida hoje e outra bloqueada. A página
    // não pode dizer que não há nada só porque a que funciona não trouxe nada.
    const recolha = avaliarRecolha(
      [fonte('boa', haDias(0)), fonte('bloqueada', haDias(20))],
      AGORA,
    );
    const leitura = leituraDoConcelho(recolha);
    expect(leitura.tipo).toBe('por-ler');
    expect(leitura.tipo === 'por-ler' && leitura.fontes.map((f) => f.id)).toEqual(['bloqueada']);
  });

  it('as atrasadas e as por estrear contam como por ler, e as desligadas não', () => {
    const recolha = avaliarRecolha(
      [
        fonte('parada', haDias(20)),
        fonte('atrasada', haDias(4)),
        fonte('por-estrear', null),
        fonte('desligada', haDias(30), false),
      ],
      AGORA,
    );
    const leitura = leituraDoConcelho(recolha);
    expect(leitura.tipo === 'por-ler' && leitura.fontes.map((f) => f.id).sort()).toEqual([
      'atrasada',
      'parada',
      'por-estrear',
    ]);
  });
});

describe('desdeQuandoPorLer', () => {
  it('dá a leitura boa mais recente, que é até quando isto foi verdade', () => {
    const recolha = avaliarRecolha(
      [fonte('velha', haDias(40)), fonte('recente', haDias(5))],
      AGORA,
    );
    const leitura = leituraDoConcelho(recolha);
    const desde = leitura.tipo === 'por-ler' ? desdeQuandoPorLer(leitura.fontes) : null;
    expect(desde).toBe(haDias(5));
  });

  it('sem nenhuma leitura boa, não inventa uma data', () => {
    expect(desdeQuandoPorLer([])).toBeNull();
    const recolha = avaliarRecolha([fonte('nunca', null)], AGORA);
    const leitura = leituraDoConcelho(recolha);
    expect(leitura.tipo === 'por-ler' && desdeQuandoPorLer(leitura.fontes)).toBeNull();
  });
});
