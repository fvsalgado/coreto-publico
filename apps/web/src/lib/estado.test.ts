import { describe, expect, it } from 'vitest';
import {
  avaliarAgenda,
  avaliarRecolha,
  desdeQuandoPorLer,
  fraseDaFonte,
  leituraDoConcelho,
  pausaAtiva,
  resumoParaQuemVisita,
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
      `Tentámos lê-la a ${haDias(0).slice(0, 10)}, mas não conseguimos ler eventos desde ${haDias(20).slice(0, 10)}.`,
    );
    // A frase antiga dizia «Lida com sucesso a …» e parava aí.
    expect(frase).not.toContain('com sucesso');
  });

  it('nunca lida, e nunca sequer tentada', () => {
    expect(fraseDaFonte(comSaude(null, null), data)).toBe('Ainda não foi lida.');
  });

  it('tentada e nunca com resultado não se confunde com nunca tentada', () => {
    expect(fraseDaFonte(comSaude(null, haDias(0)), data)).toBe(
      `Tentámos lê-la a ${haDias(0).slice(0, 10)}, e ainda não conseguimos ler nenhum evento.`,
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

/**
 * A pausa declarada (0159) — o mecanismo que separa «avariada» de «calada de
 * propósito».
 *
 * O que se está a proteger aqui não é uma contagem: é a confiança no alarme.
 * Um painel que fica vermelho durante duas semanas por causa de oito fontes
 * que a própria casa decidiu não contactar ensina, nessas duas semanas, que o
 * vermelho não quer dizer nada — e a lição não se desaprende no dia em que o
 * vermelho voltar a ser verdade.
 *
 * As fronteiras que interessam são duas, e as duas estão medidas abaixo: uma
 * pausa de pé cala o veredito, e uma pausa que acabou grita mais alto do que a
 * avaria que tapava.
 */

const CHEIA_P = { total: 40, vazios: [] };

/** A mesma fonte do resto do ficheiro, com uma pausa que acaba daqui a `dias`. */
function pausada(id: string, ultima: string | null, dias: number, motivo = 'bloqueio da CIM') {
  return {
    ...fonte(id, ultima),
    pausada_ate: new Date(AGORA.getTime() + dias * 86_400_000).toISOString(),
    pausa_motivo: motivo,
  };
}

describe('pausaAtiva', () => {
  it('sem pausa marcada, não há pausa', () => {
    expect(pausaAtiva(fonte('tomar', haDias(20)), AGORA)).toBe(false);
  });

  it('uma data no futuro cala; uma data no passado deixou de calar', () => {
    // É aqui que mora a segurança inteira do mecanismo: a pausa **acaba
    // sozinha**. Ninguém a levanta, ninguém se lembra dela, e no instante
    // seguinte ao fim a fonte volta a ser avaliada pela régua de sempre.
    expect(pausaAtiva(pausada('macao', haDias(20), 1), AGORA)).toBe(true);
    expect(pausaAtiva(pausada('macao', haDias(20), -1), AGORA)).toBe(false);
  });

  it('uma data que não se percebe não cala nada', () => {
    // Na dúvida, vigia-se. Uma pausa ilegível a silenciar um alarme seria a
    // pior das duas falhas possíveis.
    const torta = {
      ...fonte('macao', haDias(20)),
      pausada_ate: 'ontem à tarde',
      pausa_motivo: 'x',
    };
    expect(pausaAtiva(torta, AGORA)).toBe(false);
  });
});

describe('a pausa e o veredito', () => {
  it('uma fonte parada põe o painel a mau — é a régua de sempre', () => {
    const recolha = avaliarRecolha([fonte('macao', haDias(20))], AGORA);
    expect(veredito(recolha, CHEIA_P).grau).toBe('mau');
  });

  it('a mesma fonte, com pausa de pé, deixa de pôr', () => {
    const recolha = avaliarRecolha([pausada('macao', haDias(20), 4)], AGORA);
    expect(recolha.paradas).toHaveLength(0);
    expect(recolha.emPausa).toHaveLength(1);
    expect(veredito(recolha, CHEIA_P).grau).toBe('bom');
  });

  it('e o sossego diz que ficou uma de fora, em vez de dizer que se leu tudo', () => {
    // A frase antiga — «todas as fontes ligadas foram lidas» — passaria a ser
    // falsa: a que está em pausa está ligada e não foi lida. Um verde por cima
    // de oito câmaras caladas é a mentira que a 0159 existe para não contar.
    const recolha = avaliarRecolha([pausada('macao', haDias(20), 4)], AGORA);
    const { frase } = veredito(recolha, CHEIA_P);
    expect(frase).toContain('em pausa declarada');
    expect(frase).not.toBe('Todas as fontes ligadas foram lidas com sucesso nas últimas 48 horas.');
  });

  it('uma pausa que acabou volta a pôr a mau — e com a frase da pausa, não a da avaria', () => {
    // As duas descrevem a mesma fonte. A diferença é o que mandam fazer: «uma
    // fonte sem ser lida» manda olhar para a fonte, e não há lá nada para ver;
    // o que há para rever é a decisão que expirou.
    const recolha = avaliarRecolha([pausada('macao', haDias(20), -1)], AGORA);
    const { grau, frase } = veredito(recolha, CHEIA_P);
    expect(grau).toBe('mau');
    expect(frase).toBe('A pausa de uma fonte acabou e ninguém a renovou.');
  });

  it('com duas pausas expiradas, o plural sai certo', () => {
    const recolha = avaliarRecolha(
      [pausada('macao', haDias(20), -1), pausada('tomar', haDias(30), -3)],
      AGORA,
    );
    expect(veredito(recolha, CHEIA_P).frase).toBe(
      'A pausa de 2 fontes acabou e ninguém as renovou.',
    );
  });

  it('uma pausa que acabou numa fonte que voltou a responder não é esquecimento nenhum', () => {
    // Fez o trabalho e acabou. Contá-la como expirada era inventar um alarme
    // para uma fonte que está em dia.
    const recolha = avaliarRecolha([pausada('macao', haDias(1), -5)], AGORA);
    expect(recolha.vigiadas[0]?.pausaExpirada).toBe(false);
    expect(recolha.emDia).toHaveLength(1);
    expect(veredito(recolha, CHEIA_P).grau).toBe('bom');
  });

  it('uma fonte desligada continua a não contar, com pausa ou sem ela', () => {
    const desligada = { ...pausada('macao', haDias(20), 4), is_enabled: false };
    const recolha = avaliarRecolha([desligada], AGORA);
    expect(recolha.vigiadas).toHaveLength(0);
    expect(recolha.emPausa).toHaveLength(0);
  });
});

describe('a pausa e quem vive no concelho', () => {
  it('uma fonte em pausa deixa o concelho por ler, e não «em dia»', () => {
    // O veredito responde a quem administra («tenho o que arranjar?») e uma
    // pausa não é. Isto responde a quem vive lá («a página está completa?») e
    // uma pausa também a deixa incompleta. Calá-la aqui era voltar a dizer
    // «não há» onde o certo é «não consegui saber».
    const recolha = avaliarRecolha([pausada('macao', haDias(20), 4)], AGORA);
    const leitura = leituraDoConcelho(recolha);
    expect(leitura.tipo).toBe('por-ler');
  });
});

describe('a frase de uma fonte em pausa', () => {
  const comoData = (iso: string) => iso;

  it('diz até quando e porquê, e não fala de leituras', () => {
    const recolha = avaliarRecolha(
      [pausada('macao', haDias(20), 4, 'bloqueio da CIM, à espera de resposta')],
      AGORA,
    );
    const frase = fraseDaFonte(recolha.emPausa[0]!, comoData);
    expect(frase).toContain('Em pausa até');
    expect(frase).toContain('bloqueio da CIM, à espera de resposta');
    expect(frase).not.toMatch(/conseguimos ler|Tentámos/);
  });
});

/**
 * O topo da página, para quem a lê de fora (C4-023, C1-024, C4-024).
 *
 * O caso de produção a 1 de outubro de 2026, reconstituído: 31 agendas em dia;
 * as oito câmaras do mesmo sistema de publicação caladas desde 11 de setembro
 * com a pausa já expirada; o CAMINHOS, regional, também calado; três
 * concelhos sem nada marcado. O veredito disse «A pausa de 8 fontes acabou e
 * ninguém as renovou» — e continua a dizê-lo à sonda. A página diz isto.
 */
describe('resumoParaQuemVisita', () => {
  const CONCELHOS_MT = [
    { id: 'abrantes', name: 'Abrantes' },
    { id: 'entroncamento', name: 'Entroncamento' },
    { id: 'tomar', name: 'Tomar' },
    { id: 'sardoal', name: 'Sardoal' },
  ];
  const EM_DIA = Array.from({ length: 31 }, (_, i) => ({
    ...fonte(`jf-${i}`, haDias(0)),
    municipality_id: 'abrantes',
  }));
  const PARADAS = [
    { ...pausada('cm-tomar', haDias(22), -9), municipality_id: 'tomar' },
    { ...pausada('cm-entroncamento', haDias(22), -9), municipality_id: 'entroncamento' },
    { ...fonte('cm-sardoal', haDias(13)), municipality_id: 'sardoal' },
    { ...pausada('caminhos', haDias(22), -9), name: 'CAMINHOS', municipality_id: null },
  ];
  const AGENDA = { total: 85, vazios: ['Entroncamento'] };

  const resumo = resumoParaQuemVisita(
    avaliarRecolha([...EM_DIA, ...PARADAS], AGORA),
    AGENDA,
    CONCELHOS_MT,
  );
  const texto = [resumo.titulo, ...resumo.linhas.map((l) => `${l.rotulo}: ${l.texto}`)].join('\n');

  it('abre com o que há, e o que está em dia vem antes do que falta', () => {
    expect(resumo.titulo).toBe('A agenda tem 85 eventos marcados daqui para a frente.');
    const tipos = resumo.linhas.map((linha) => linha.tipo);
    expect(tipos[0]).toBe('em-dia');
    expect(resumo.linhas[0]?.texto).toBe('31 das 35 agendas que lemos todos os dias.');
    expect(tipos.indexOf('em-dia')).toBeLessThan(tipos.indexOf('por-ler'));
  });

  it('diz o que falta pelo efeito em quem procura, sem esconder a agenda regional', () => {
    const incompleta = resumo.linhas.find((linha) => linha.tipo === 'incompleto');
    expect(incompleta?.texto).toBe(
      'a programação de Entroncamento, Sardoal e Tomar; e a de uma agenda regional: CAMINHOS.',
    );
  });

  it('liga o concelho a zero à agenda que não se lê, em vez de deixar concluir que não há nada', () => {
    const semNada = resumo.linhas.find((linha) => linha.tipo === 'sem-nada');
    expect(semNada?.texto).toContain('Entroncamento.');
    expect(semNada?.texto).toContain('pode haver programação que não chegou aqui');
  });

  it('não fala para dentro: nem pausas por renovar, nem «parado», nem «fonte»', () => {
    expect(texto).not.toMatch(/renov|PARADO|parad|fonte/i);
  });

  it('o veredito da sonda continua o mesmo, que é para ele que ela olha', () => {
    const recolha = avaliarRecolha([...EM_DIA, ...PARADAS], AGORA);
    expect(veredito(recolha, AGENDA)).toEqual({
      grau: 'mau',
      frase: 'A pausa de 3 fontes acabou e ninguém as renovou.',
    });
  });

  it('com tudo em dia, diz que está tudo em dia e mais nada', () => {
    const tudo = resumoParaQuemVisita(
      avaliarRecolha(EM_DIA, AGORA),
      { total: 12, vazios: [] },
      CONCELHOS_MT,
    );
    expect(tudo.linhas).toEqual([
      { tipo: 'em-dia', rotulo: 'Em dia', texto: 'as 31 agendas que lemos todos os dias.' },
    ]);
  });

  it('numa demonstração diz o que é uma demonstração, e não uma avaria', () => {
    const demo = resumoParaQuemVisita(avaliarRecolha([], AGORA), { total: 30, vazios: [] }, [], {
      demonstracao: true,
    });
    expect(demo.titulo).toBe(
      'Esta é uma demonstração: os eventos foram escritos à mão, e não há agendas para ler.',
    );
    expect(demo.linhas.map((linha) => linha.texto).join(' ')).toContain('30 eventos inventados');
    // O que a página dizia: «ATENÇÃO — Não há nenhuma fonte ligada nesta região.»
    expect(JSON.stringify(demo)).not.toMatch(/ATENÇÃO|fonte ligada/i);
  });

  it('numa região a sério sem agendas ligadas, diz de onde vem o que lá está', () => {
    const nova = resumoParaQuemVisita(avaliarRecolha([], AGORA), { total: 3, vazios: [] }, []);
    expect(nova.linhas).toEqual([
      {
        tipo: 'nota',
        rotulo: 'Sem agendas ligadas',
        texto:
          'ainda não lemos automaticamente nenhuma agenda desta região: o que aparece aqui chega por quem o envia.',
      },
    ]);
  });

  it('as em pausa contam como podendo faltar, e mandam ver o motivo', () => {
    const comPausa = resumoParaQuemVisita(
      avaliarRecolha(
        [...EM_DIA, { ...pausada('cm-tomar', haDias(22), 5), municipality_id: 'tomar' }],
        AGORA,
      ),
      { total: 40, vazios: [] },
      CONCELHOS_MT,
    );
    const linhas = Object.fromEntries(comPausa.linhas.map((linha) => [linha.tipo, linha.texto]));
    expect(linhas['em-pausa']).toContain('o motivo de cada uma está na lista abaixo');
    expect(linhas.incompleto).toBe('a programação de Tomar.');
  });
});
