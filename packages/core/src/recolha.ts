/**
 * As regras da recolha que o sítio publica por escrito.
 *
 * Vivem aqui, e não dentro da recolha, por uma razão que já custou uma frase
 * falsa: a página `/fontes` promete ao público como é que uma fonte que falha
 * é tratada, e essa promessa estava escrita à mão. Dizia «fica em pausa até
 * ser vista por uma pessoa»; o código abria o disjuntor sozinho e voltava a
 * tentar passadas vinte e quatro horas. Ninguém mentiu — a frase envelheceu
 * quando o disjuntor foi escrito, e não havia nada que ligasse as duas coisas.
 *
 * `apps/web` depende de `@coreto/core` e não de `@coreto/ingest`, que é o
 * pacote onde o disjuntor mora. Pôr os números aqui é o que permite à página
 * lê-los em vez de os repetir: mudar o limite passa a mudar o texto publicado
 * no mesmo instante, que é a única forma de uma promessa se manter verdadeira
 * sem ninguém se lembrar dela.
 */

/**
 * Falhas seguidas a partir das quais a fonte deixa de ser tentada.
 *
 * Cinco noites, e não uma: um portal que esteja em baixo uma noite não é um
 * portal que mudou de forma, e desligar à primeira falha faria a agenda perder
 * concelhos por causa de uma manutenção.
 */
export const FALHAS_ATE_PAUSA = 5;

/** Quanto tempo o disjuntor fica aberto antes de a fonte voltar a ser tentada. */
export const HORAS_EM_PAUSA = 24;

/**
 * Quem bate à porta, e onde se lhe responde.
 *
 * O endereço aqui dentro tem de existir: é por ele que um administrador de
 * sistemas nos encontra, para pedir que abrandemos ou que paremos. Já falhou
 * duas vezes. O primeiro apontava para `coreto.pt/sobre`, domínio que nunca
 * chegou a existir. O segundo para `github.com/fvsalgado/coreto`, que devolve
 * **404** a quem não tem acesso — e quem segue este endereço é exatamente
 * quem não tem acesso. Um agente que se identifica com uma morada morta não é
 * identificável, é só educado na aparência.
 *
 * A frase é do produto e não de uma região, de propósito: a mesma recolha
 * serve todas as regiões, e um agente que dissesse «do Médio Tejo» a bater à
 * porta de uma câmara de outra CIM estaria a apresentar-se como quem não é.
 *
 * **Mora aqui, e não na recolha, pela razão escrita no topo deste ficheiro.**
 * A página `/fontes` é o destino deste endereço, e passou a mostrar a linha
 * que o servidor do outro lado recebe. Mostrá-la a partir daqui é o que
 * impede as duas de divergirem: quem for ver aos registos dele encontra
 * carácter a carácter o que a página lhe diz que vai encontrar. Escrita à mão
 * na página, bastava uma correção só de um lado para a página passar a
 * descrever um agente que já não existe — que é como as outras duas moradas
 * mortas duraram tanto tempo.
 */
export const USER_AGENT =
  'Coreto/1.0 (+https://mediotejo.coreto.org/fontes; agenda cultural, Portugal)';
