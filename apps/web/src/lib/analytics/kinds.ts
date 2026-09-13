/**
 * O vocabulário da medição, partilhado pelo navegador e pelo servidor.
 *
 * Estes quatro nomes são os mesmos que a função `record_event_stat` aceita na
 * base de dados. Estão aqui num só sítio porque uma divergência entre os dois
 * lados não dá erro nenhum: dá contagens que ficam sempre a zero e um gestor
 * a concluir que ninguém carregou no botão.
 *
 * **Este ficheiro vai para o navegador, e por isso não tem uma única
 * dependência.** Teve: os schemas de validação do corpo do pedido viviam aqui
 * ao lado, e como o `AnalyticsProvider` está no layout da região, o Zod inteiro
 * — catorze quilobytes na rede — viajava para o navegador em **todas** as
 * páginas do sítio, para o cliente usar quatro constantes e uma função de três
 * linhas. Os schemas mudaram-se para `request.ts`, que só o servidor importa.
 *
 * A regra que isto deixa: o que é importado por um componente de cliente paga
 * tudo o que o ficheiro importa, mesmo o que esse componente não usa. Um
 * ficheiro partilhado pelos dois lados não pode ter dependências.
 */
export const STAT_KINDS = [
  'view',
  'ticket_click',
  'ical_download',
  'share',
  /*
   * Os dois da 0141, e são os dois que respondem a quem paga.
   *
   * «A agenda mandou 340 pessoas ao vosso portal em setembro» é a única prova
   * de retorno que um agregador sem bilheteira consegue dar a quem organiza —
   * e o «Página oficial» era, até aqui, o único botão daquela fila da ficha sem
   * marca nenhuma. O «como chegar» é o sinal mais próximo de intenção de
   * comparecer que este sítio consegue medir.
   */
  'source_click',
  'directions_click',
] as const;

export type StatKind = (typeof STAT_KINDS)[number];

/**
 * Atributo que marca no HTML o que é para contar.
 *
 * A alternativa era transformar cada botão medido num componente de cliente.
 * Assim a ficha do evento continua a ser renderizada no servidor — os
 * `<a>` são `<a>` de verdade, funcionam sem JavaScript e continuam a ser
 * ligações que se abrem noutro separador — e um único ouvinte trata de todos.
 */
export const STAT_KIND_ATTRIBUTE = 'data-stat-kind';

export function isStatKind(value: string | null | undefined): value is StatKind {
  return typeof value === 'string' && STAT_KINDS.some((kind) => kind === value);
}
