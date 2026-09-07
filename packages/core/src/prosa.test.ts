import { describe, expect, it } from 'vitest';
import { extractAccessibility, parseAudience, parseDurationMinutes } from './accessibility';

/**
 * O banco de regressão do leitor de prosa.
 *
 * **Nunca fabricar** é a regra que esta casa põe acima de todas as outras, e
 * era a que estava a falhar em público com número: das 128 fichas do Médio
 * Tejo, 30 mostravam duração e **14 eram horas de relógio**; e «não é
 * acessível a pessoas em cadeira de rodas» publicava acesso **verdadeiro**.
 *
 * As correções vivem em `accessibility.ts` e têm testes lá. Este ficheiro é
 * outra coisa, e a diferença é o que o torna útil: aqui estão as **frases
 * reais** — as que a recolha leu em produção e leu mal —, cada uma com o
 * resultado que tem de dar. Um teste de unidade prova que a regra faz o que a
 * regra diz; isto prova que a regra resolve o caso que a fez existir.
 *
 * Cada linha traz a origem. Quando alguém apertar ou alargar um padrão daqui
 * a um ano, é esta lista que lhe diz o que não pode voltar a acontecer — e a
 * frase, escrita como a câmara a escreveu, vale mais do que qualquer
 * explicação que eu deixe aqui.
 *
 * **Como se acrescenta.** Uma ficha publicada mostra um campo que a fonte não
 * diz? A frase da fonte entra aqui, com o esperado, antes de se tocar na
 * regra. É a ordem que faz este ficheiro crescer com os enganos em vez de
 * crescer com as regras.
 */

interface CasoDeDuracao {
  /** A frase, como a fonte a escreveu. */
  frase: string;
  /** Minutos, ou `null` quando o texto não declara duração nenhuma. */
  esperado: number | null;
  /** De onde veio, e o que estava a acontecer. */
  origem: string;
}

const DURACOES: CasoDeDuracao[] = [
  {
    frase:
      'No dia 12 de setembro, sábado, entre as 10h00 e as 13h00, a Rua Luís Falcão de Sommer recebe a Feira para Todos.',
    esperado: null,
    origem:
      'Feira para Todos, Constância — publicava «Duração: 10h». É a mesma frase de harmonize.test.ts, que verificava a hora e não a duração',
  },
  {
    frase: 'Visita à oficina de calafate, das 9h às 11h.',
    esperado: null,
    origem:
      'A Arte do Calafate, Constância — a ficha mostrava a sessão das 9h às 11h e, ao lado, «Duração: 9h»',
  },
  {
    frase: 'Concerto às 21h30. Duração aproximada 1h30.',
    esperado: 90,
    origem:
      'A forma que tem de continuar a funcionar: uma hora de relógio e uma duração declarada na mesma frase',
  },
  {
    frase: 'Sessões às 15h e às 18h30.',
    esperado: null,
    origem: 'Duas horas de relógio e nenhuma duração — o caso mais comum de todos',
  },
  {
    frase: 'Espetáculo com duração de 1h45.',
    esperado: 105,
    origem: 'A duração declarada com pista à esquerda',
  },
  {
    frase: 'A palestra dura cerca de 50 minutos.',
    esperado: 50,
    origem: 'Duração em minutos com pista',
  },
  {
    frase: 'Oficina de 1 hora e 20 minutos, para maiores de 6 anos.',
    esperado: 80,
    origem:
      'Por extenso, sem pista: nenhum relógio se escreve assim, e por isso a forma basta-se a si própria',
  },
  {
    frase: 'A exposição está patente das 10h às 18h, de terça a domingo.',
    esperado: null,
    origem: 'Horário de abertura de uma exposição — publicava «Duração: 10h»',
  },
  {
    frase: 'Abertura de portas às 20h. O espetáculo começa às 21h.',
    esperado: null,
    origem: 'Duas horas de relógio em frases diferentes',
  },
  {
    frase: 'Sala com 300 lugares, entrada pela Rua 5 de Outubro.',
    esperado: null,
    origem: 'Números que não são tempo nenhum',
  },
];

describe('as durações que a prosa declara, e as que ela não declara', () => {
  it.each(DURACOES)('$origem', ({ frase, esperado }) => {
    expect(parseDurationMinutes(frase)).toBe(esperado);
  });
});

interface CasoDeAcesso {
  frase: string;
  /** `true`, `false`, ou `undefined` quando o texto não diz. */
  esperado: boolean | undefined;
  origem: string;
}

const ACESSOS: CasoDeAcesso[] = [
  {
    frase: 'O espaço não é acessível a pessoas em cadeira de rodas.',
    esperado: false,
    origem:
      'A negação mais comum em português, e a que escapava: o «é» pelo meio bastava para a menção ganhar e o Coreto publicar acesso verdadeiro',
  },
  {
    frase: 'A sala não está acessível a cadeiras de rodas.',
    esperado: false,
    origem: 'A mesma negação com outro verbo',
  },
  {
    frase: 'Sem acesso a cadeiras de rodas.',
    esperado: false,
    origem: 'A forma que já funcionava, e tem de continuar a funcionar',
  },
  {
    frase: 'Acesso condicionado a pessoas com mobilidade reduzida.',
    esperado: false,
    origem: 'A terceira forma que já funcionava',
  },
  {
    frase: 'Espaço acessível a cadeiras de rodas.',
    esperado: true,
    origem: 'A afirmação, que tem de continuar a valer',
  },
  {
    frase: 'Lugares reservados para pessoas com mobilidade reduzida.',
    esperado: true,
    origem: 'Uma afirmação escrita sem a palavra «acessível»',
  },
  {
    frase: 'Entrada pela rampa lateral, adaptada a cadeiras de rodas.',
    esperado: true,
    origem: 'A afirmação por meio do que lá está construído',
  },
  {
    frase: 'Venha a pé, de carro, de autocarro ou de cadeira de rodas.',
    esperado: undefined,
    origem:
      'A menção nua: o texto nomeia a cadeira de rodas e não diz nada sobre o espaço. Marcava o evento como acessível',
  },
  {
    frase: 'Concerto de ano novo, com a Banda Filarmónica.',
    esperado: undefined,
    origem: 'O silêncio, que continua silêncio',
  },
  {
    frase:
      'O piso térreo é acessível. O auditório do primeiro andar não é acessível a cadeiras de rodas.',
    esperado: false,
    origem:
      'Duas frases que se contradizem: quem precisa da informação é quem fica na segunda, e por isso a negação manda',
  },
];

describe('o que a prosa diz sobre entrar em cadeira de rodas', () => {
  it.each(ACESSOS)('$origem', ({ frase, esperado }) => {
    expect(extractAccessibility(frase).wheelchair_accessible).toBe(esperado);
  });
});

/**
 * O público, que já tinha um banco destes disperso pelos testes de unidade.
 *
 * Fica aqui a parte que veio de fichas publicadas, para as três famílias
 * viverem no mesmo sítio quando a próxima armadilha aparecer.
 */
const PUBLICOS: Array<{ frase: string; esperado: string | undefined; origem: string }> = [
  {
    frase: 'Almoço dos Idosos da freguesia. Levantamento todos os dias, das 10h00 às 13h00.',
    esperado: undefined,
    origem:
      'Marcava «para todas as idades» por causa do «todos» solto — onze dos trinta e cinco eventos assim marcados',
  },
  {
    frase: 'Espetáculo para M/16 anos. Bilhetes todos os dias.',
    esperado: 'adults',
    origem: 'Festival Z, Ferreira do Zêzere — a barra de idade manda sobre a linguagem de cartaz',
  },
  {
    frase: 'Sessão para escolas do 1.º ciclo.',
    esperado: 'schools',
    origem: 'Uma sessão fechada continua a mandar sobre o resto',
  },
];

describe('o público que a prosa declara', () => {
  it.each(PUBLICOS)('$origem', ({ frase, esperado }) => {
    expect(parseAudience(frase).audience).toBe(esperado);
  });
});
