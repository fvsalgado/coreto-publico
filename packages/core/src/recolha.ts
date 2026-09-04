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
