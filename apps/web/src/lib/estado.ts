/**
 * O estado da casa, em números que se podem publicar.
 *
 * Isto responde a uma pergunta concreta e a uma só: **a agenda desta região
 * está a ser alimentada?** Não responde a «o sítio está de pé» — essa não se
 * responde de dentro do sítio, e a página que usa este módulo diz-lo por
 * extenso em vez de fingir que sim.
 *
 * O que aqui está é lógica pura, sem base de dados e sem React, porque é isto
 * que decide se uma CIM lê «está tudo bem» ou «há três fontes paradas». Um
 * limiar errado aqui não estraga um ecrã: dá sossego a quem devia estar
 * preocupado.
 */

/**
 * Duas noites. É o limiar, e vem da máquina e não do gosto.
 *
 * A recolha corre uma vez por dia (`.github/workflows/scrape.yml`, 03:20 UTC).
 * Uma fonte lida ontem está em dia; uma fonte que não é lida com sucesso há
 * mais de dois dias falhou **duas** rondas seguidas, e duas rondas seguidas já
 * não é o portal da câmara a estar em manutenção uma noite.
 */
export const DIAS_ATE_ATRASO = 2;

/**
 * Uma semana sem uma leitura boa é uma fonte parada, não uma fonte lenta.
 *
 * O disjuntor da recolha pausa uma fonte ao fim de cinco falhas seguidas
 * (`FALHAS_ATE_PAUSA`, em `@coreto/core`) e volta a tentar 24 horas depois.
 * Sete dias é esse ciclo inteiro a não dar resultado — o sítio mudou de forma,
 * mudou de endereço, ou deixou de existir. Nenhuma dessas se resolve
 * esperando mais.
 */
export const DIAS_ATE_PARAGEM = 7;

export type SaudeDaFonte = 'em-dia' | 'atrasada' | 'parada' | 'por-estrear';

/** O que uma página precisa de saber de uma fonte para dizer como ela está. */
export interface FonteVigiada {
  id: string;
  name: string;
  is_enabled: boolean;
  last_success_at: string | null;
}

/** Dias inteiros entre dois instantes. Trunca: meio dia não é um dia. */
function diasDesde(instante: string, agora: Date): number {
  const quando = new Date(instante).getTime();
  if (Number.isNaN(quando)) return Number.POSITIVE_INFINITY;
  return Math.floor((agora.getTime() - quando) / 86_400_000);
}

/**
 * Como está uma fonte, pela última vez que foi lida com sucesso.
 *
 * **`por-estrear` não é `parada`**, e a distinção é o que evita um alarme
 * falso de cada vez que uma CIM nasce: uma fonte acabada de ligar no painel
 * ainda não tem leitura nenhuma, e dizer que está parada é dizer que está
 * avariada uma coisa que nunca chegou a arrancar. Quem lê a página precisa de
 * saber qual dos dois é — a primeira espera-se, a segunda arranja-se.
 */
export function saudeDaFonte(ultimaLeitura: string | null, agora: Date): SaudeDaFonte {
  if (!ultimaLeitura) return 'por-estrear';
  const dias = diasDesde(ultimaLeitura, agora);
  if (dias <= DIAS_ATE_ATRASO) return 'em-dia';
  if (dias <= DIAS_ATE_PARAGEM) return 'atrasada';
  return 'parada';
}

export interface FonteComSaude extends FonteVigiada {
  saude: SaudeDaFonte;
  /** Dias desde a última leitura boa; `null` numa fonte por estrear. */
  dias: number | null;
}

export interface EstadoDaRecolha {
  /** Só as fontes ligadas: uma fonte desligada no painel não está avariada. */
  vigiadas: FonteComSaude[];
  emDia: FonteComSaude[];
  atrasadas: FonteComSaude[];
  paradas: FonteComSaude[];
  porEstrear: FonteComSaude[];
}

/**
 * As fontes ligadas, arrumadas pelo tempo que levam sem uma leitura boa.
 *
 * **As desligadas não entram, e não é para melhorar o número.** Uma fonte
 * desligada é uma decisão de quem administra — o portal fechou, o município
 * pediu, a câmara passou a publicar noutro sítio. Contá-la como parada era
 * transformar todas essas decisões em avarias por publicar, e uma página de
 * estado que grita por coisas que ninguém vai arranjar é uma página que se
 * deixa de ler.
 */
export function avaliarRecolha(
  fontes: readonly FonteVigiada[],
  agora: Date = new Date(),
): EstadoDaRecolha {
  const vigiadas: FonteComSaude[] = fontes
    .filter((fonte) => fonte.is_enabled)
    .map((fonte) => ({
      ...fonte,
      saude: saudeDaFonte(fonte.last_success_at, agora),
      dias: fonte.last_success_at ? diasDesde(fonte.last_success_at, agora) : null,
    }));

  const das = (saude: SaudeDaFonte) => vigiadas.filter((fonte) => fonte.saude === saude);

  return {
    vigiadas,
    emDia: das('em-dia'),
    atrasadas: das('atrasada'),
    paradas: das('parada'),
    porEstrear: das('por-estrear'),
  };
}

export interface EstadoDaAgenda {
  /** Eventos por vir na região inteira. */
  total: number;
  /** Os concelhos sem nada marcado, pelo nome, por ordem alfabética. */
  vazios: string[];
}

/**
 * A agenda que está para vir, e os concelhos que estão a zero.
 *
 * É a outra metade da pergunta, e a que apanha o que a primeira deixa passar:
 * uma fonte pode ser lida todas as noites com sucesso e trazer zero eventos
 * porque a câmara mudou o desenho da página. A recolha diz «li»; só a
 * contagem diz «li e não veio nada».
 */
export function avaliarAgenda(
  concelhos: ReadonlyArray<{ id: string; name: string }>,
  contagens: Readonly<Record<string, number>>,
): EstadoDaAgenda {
  return {
    total: concelhos.reduce((soma, concelho) => soma + (contagens[concelho.id] ?? 0), 0),
    vazios: concelhos
      .filter((concelho) => (contagens[concelho.id] ?? 0) === 0)
      .map((concelho) => concelho.name)
      .sort((a, b) => a.localeCompare(b, 'pt')),
  };
}

export type Grau = 'bom' | 'atencao' | 'mau';

export interface Veredito {
  grau: Grau;
  frase: string;
}

/**
 * A frase do topo — a única coisa que muita gente vai ler.
 *
 * A ordem é a da gravidade e não a da comodidade: primeiro o que está partido,
 * depois o que está a ficar, e só no fim o sossego. Uma página de estado que
 * abre com «tudo bem» e esconde o problema num parágrafo mais abaixo é um
 * painel verde por cima de uma luz vermelha.
 *
 * **Uma agenda vazia é `mau` mesmo com as fontes todas em dia**, porque é
 * exatamente esse o caso que ninguém apanha: as leituras correm, os números
 * de erro estão a zero, e não há nada para mostrar a quem visita.
 */
export function veredito(recolha: EstadoDaRecolha, agenda: EstadoDaAgenda): Veredito {
  if (recolha.vigiadas.length === 0) {
    return { grau: 'atencao', frase: 'Não há nenhuma fonte ligada nesta região.' };
  }

  if (agenda.total === 0) {
    return { grau: 'mau', frase: 'Não há um único evento marcado daqui para a frente.' };
  }

  if (recolha.paradas.length > 0) {
    const quantas = recolha.paradas.length;
    return {
      grau: 'mau',
      frase:
        quantas === 1
          ? 'Há uma fonte sem ser lida com sucesso há mais de uma semana.'
          : `Há ${quantas} fontes sem serem lidas com sucesso há mais de uma semana.`,
    };
  }

  if (recolha.atrasadas.length > 0) {
    const quantas = recolha.atrasadas.length;
    return {
      grau: 'atencao',
      frase:
        quantas === 1
          ? 'Há uma fonte que falhou as últimas rondas.'
          : `Há ${quantas} fontes que falharam as últimas rondas.`,
    };
  }

  return {
    grau: 'bom',
    frase: 'Todas as fontes ligadas foram lidas com sucesso nas últimas 48 horas.',
  };
}
