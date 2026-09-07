import { describe, expect, it } from 'vitest';
import { extractAccessibility, parseAudience, parseDurationMinutes } from './accessibility';
import { cleanEventDescription, fixShoutyTitle } from './text';

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

/**
 * Os títulos gritados, e o que a normalização de caixa lhes fazia.
 *
 * **O plano estava errado sobre esta, e vale a pena registar como.** Dizia que
 * «FIF ABRANTES» devia dar «FIF Abrantes», como se a plataforma não
 * corrigisse. Corrige — corrige a mais: `fixShoutyTitle` existe desde sempre e
 * a única prova de que um token é sigla é uma lista fechada de treze. Fora
 * dela, «FIF» dava «Fif», «GNR» dava «Gnr», «XV» dava «Xv» e «A.R.C.A.» dava
 * «A.r.c.a.». E o exemplo do plano nem existe no catálogo: a fonte de Abrantes
 * publica «FIF Abrantes» em caixa mista, que a função nem toca.
 *
 * **O que o catálogo de produção tinha mesmo, medido a 7 de setembro de
 * 2026:** um título, e um só — «Pai Que Se Tornou Mãe», da fonte de Abrantes,
 * com o pronome relativo e o reflexo capitalizados como se fossem
 * substantivos. Os seis numerais romanos publicados (XVIII, II, III, IX, V,
 * XXIX) estão todos em títulos de caixa mista, que a função nunca toca.
 *
 * Por isso o alcance desta correção diz-se com honestidade: **uma reparação
 * medida e o resto profilaxia.** A classe existe — a mesma fonte publica
 * «XVIII Torneio Internacional» e publica títulos gritados —, mas só uma linha
 * do catálogo de hoje muda.
 */
const TITULOS: Array<{ entrada: string; esperado: string; origem: string }> = [
  {
    entrada: 'PAI QUE SE TORNOU MÃE',
    esperado: 'Pai que se Tornou Mãe',
    origem:
      'abrantes-proxy.json:23 — o único defeito desta função materializado no catálogo: a produção guarda «Pai Que Se Tornou Mãe»',
  },
  {
    entrada: 'XVIII TORNEIO INTERNACIONAL DE INICIADOS',
    esperado: 'XVIII Torneio Internacional de Iniciados',
    origem: 'A mesma fonte publica «XVIII Torneio…»; gritado, o numeral dava «Xviii»',
  },
  {
    entrada: 'XV DE AGOSTO EM TOMAR',
    esperado: 'XV de Agosto em Tomar',
    origem:
      'O numeral seguido de preposição: o ramo novo tem de marcar `seenWord`, ou a preposição vem capitalizada e fica pior do que estava',
  },
  {
    entrada: 'II ENCONTRO DE BANDAS',
    esperado: 'II Encontro de Bandas',
    origem: 'A forma mais comum de todas num cartaz de edição',
  },
  {
    entrada: 'FIF ABRANTES',
    esperado: 'FIF Abrantes',
    origem: 'O caso do plano. Hipotético — a fonte escreve-o em caixa mista —, mas a classe é real',
  },
  {
    entrada: 'A.R.C.A. DE TOMAR',
    esperado: 'A.R.C.A. de Tomar',
    origem: 'Sigla pontuada: a forma não é ambígua e nenhuma palavra portuguesa se escreve assim',
  },
  {
    entrada: 'CINE-TEATRO PARAÍSO REABRE',
    esperado: 'Cine-Teatro Paraíso Reabre',
    origem: 'O que vem depois do hífen ficava por levantar; «Cine-Teatro» é como o espaço se chama',
  },
  {
    entrada: "VAMOS SOMAR KM'S EM 2026!",
    esperado: "Vamos Somar Km's em 2026!",
    origem:
      "A armadilha do apóstrofo: alargar a regra do hífen a «qualquer não-letra» dá «Km'S». Título real",
  },
  {
    entrada: 'MIX DE VERÃO NO CORETO',
    esperado: 'MIX de Verão no Coreto',
    origem:
      'A colisão conhecida: «MIX» é um numeral romano válido (M+IX=1009). Fica a caixa da fonte — o lado seguro',
  },
  {
    entrada: 'EXPOSIÇÃO NO MIAA',
    esperado: 'Exposição no MIAA',
    origem: 'Não regredir: é o que a lista de siglas já acertava',
  },
  {
    entrada: 'FESTA DA NOSSA SENHORA DA PIEDADE',
    esperado: 'Festa da Nossa Senhora da Piedade',
    origem: 'Não regredir: nome próprio composto com palavras menores',
  },
  {
    entrada: 'D. MANUEL I',
    esperado: 'D. Manuel I',
    origem: 'Não regredir: o «I» sozinho não é numeral romano por esta regra (exige dois)',
  },
];

describe('os títulos gritados, e as siglas que a normalização comia', () => {
  it.each(TITULOS)('$origem', ({ entrada, esperado }) => {
    expect(fixShoutyTitle(entrada)).toBe(esperado);
  });
});

/**
 * A legenda que o ofuscador do Joomla deixava na prosa publicada.
 *
 * **Nove eventos, cinco concelhos** — medido na base de produção a 7 de
 * setembro de 2026. Barquinha, Alcanena, Entroncamento, Mação e Tomar. O que
 * se lia numa ficha do Coreto era mobília da plataforma da câmara apresentada
 * como programação:
 *
 *   «Inscrições gratuitas até 31 de agosto para Este endereço de email está
 *   protegido contra piratas. Necessita ativar o JavaScript para o
 *   visualizar.»
 *
 * **O plano descreveu mal a causa.** Dizia que o `stripTags` deixava passar o
 * `<script>` do ofuscador. Não deixa — salta-o. O que passa é o texto de
 * recurso, que vive num `<span>`, num `<noscript>` ou num
 * `<joomla-hidden-mail>`. E a frase que os documentos citam não é a que está
 * gravada na maioria dos casos: uma regra escrita contra a citação falhava em
 * sete dos nove.
 *
 * Os dois últimos casos são controlos, e são a parte que interessa guardar: a
 * regra não pode comer um email que o organizador escreveu, nem uma frase que
 * comece por «Este endereço» sem ser a legenda.
 */
const OFUSCADOR: Array<{ entrada: string; sobra: string; origem: string }> = [
  {
    entrada:
      'Entradas livres. Inscrições realizadas nos Serviços Culturais até dia 18 de setembro pelo email Este endereço de email está protegido contra piratas. Necessita ter o JavaScript autorizado para o visualizar. ou pelo telefone 249 720 400',
    sobra: 'pelo telefone 249 720 400',
    origem:
      '«18ª Edição da Feirinha de Setembro», cm-entroncamento — a variante «ter … autorizado», que dois dos nove eventos usam',
  },
  {
    entrada:
      'Inscrições gratuitas até 31 de agosto para Este endereço de email está protegido contra piratas. Necessita ativar o JavaScript para o visualizar.\nVagas limitadas a 12 participantes',
    sobra: 'Vagas limitadas a 12 participantes',
    origem: '«Clube de Fotografia - ATL de Verão», cm-tomar — a variante «ativar», a mais comum',
  },
  {
    entrada:
      'RESERVAS – Este endereço de email está protegido contra piratas. Necessita ativar o JavaScript para o visualizar. ou através do 249 720 358',
    sobra: '249 720 358',
    origem: '«AL Guitar Duo», cm-vnbarquinha — a legenda a meio da frase',
  },
  {
    entrada:
      'Informações e reservas:\nEste endereço de email está protegido contra piratas. Necessita ativar o JavaScript para o visualizar.\n249 720 358 (chamada rede fixa)',
    sobra: 'Informações e reservas:',
    origem: '«Barquinha Jazz 2026», cm-vnbarquinha — a legenda numa linha própria',
  },
  {
    entrada:
      'requer que faça a sua inscrição pelo e-mail:\nEste endereço de email está protegido contra piratas. Necessita ativar o JavaScript para o visualizar.',
    sobra: 'requer que faça a sua inscrição',
    origem: '«Exposição na Paisagem do Médio Tejo», cm-macao — o «e-mail» com hífen no conector',
  },
  {
    entrada:
      'Contact This email address is being protected from spambots. You need JavaScript enabled to view it. for details.',
    sobra: 'for details.',
    origem: 'A forma inglesa corrente, para o dia em que uma fonte a sirva em en-GB',
  },
  {
    entrada:
      'Contacto: This e-mail address is being protected from spambots. You need JavaScript enabled to view it',
    sobra: 'Contacto:',
    origem: 'A forma inglesa antiga, com hífen e sem ponto final',
  },
];

describe('a legenda do ofuscador de emails sai da prosa publicada', () => {
  it.each(OFUSCADOR)('$origem', ({ entrada, sobra }) => {
    const saida = cleanEventDescription(null, entrada) ?? '';
    expect(saida).not.toMatch(/javascript/i);
    expect(saida).not.toMatch(/spambots/i);
    expect(saida).not.toMatch(/protegido contra piratas/i);
    // E o que estava à volta fica: a regra está presa a uma frase, e uma regra
    // gulosa comia o resto da descrição do evento.
    expect(saida).toContain(sobra);
  });

  it('um email que o organizador escreveu não é legenda, e fica', () => {
    // Apagar endereços de email da descrição seria perder informação
    // verdadeira do evento — o mesmo pecado por outro lado.
    const saida = cleanEventDescription(
      null,
      'Inscrições por geral@junta.pt até 31 de agosto. O espetáculo é para maiores de 12.',
    );
    expect(saida).toContain('geral@junta.pt');
    expect(saida).toContain('maiores de 12');
  });

  it('uma frase que começa por «Este endereço» sem ser a legenda fica', () => {
    // A âncora da regra é o arranque da frase, mas confirmado pela palavra
    // «javascript». Sem essa confirmação, isto seria uma regra a comer prosa.
    const saida = cleanEventDescription(
      null,
      'Este endereço fica na Rua Direita. Envie o comprovativo por email.',
    );
    expect(saida).toContain('Rua Direita');
    expect(saida).toContain('comprovativo');
  });
});
