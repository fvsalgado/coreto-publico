/**
 * Visitar a página de cada evento para completar o que a listagem não deu.
 *
 * Uma listagem é um cartaz: título, data, imagem, e raramente mais. O texto
 * que diz o que o espetáculo é costuma estar só na página do evento — e sem
 * ele a ficha do Coreto fica com um título e um mapa, que não chega para
 * alguém decidir se vai.
 *
 * O ciclo é sempre o mesmo, e é o que vive aqui: um tecto de páginas por
 * execução, uma falha que não leva o evento atrás, e um aviso quando o tecto
 * se atinge. O que **muda** entre fontes é como se lê a página, e isso é a
 * função `completar` que cada adaptador traz — o `municipal-cms` sabe ler
 * JSON-LD, o `generic-html` lê pelos seletores que a fonte declarou.
 *
 * O tecto não é uma economia: é a diferença entre uma recolha que demora dois
 * minutos e uma que demora vinte, e é a promessa que se faz a quem nos deixa
 * ler o sítio. `HttpClient` já espaça os pedidos por servidor; isto limita
 * quantos são.
 */

import type { RawEvent } from '@coreto/core';
import type { AdapterContext } from '../adapter.js';
import type { RunLogger } from '../run-logger.js';

/** Páginas de detalhe visitadas por execução, quando a fonte não o diz. */
export const DETALHES_POR_OMISSAO = 40;

export interface SeguirDetalhesOptions {
  events: readonly RawEvent[];
  context: AdapterContext;
  /** Tecto de páginas visitadas. `0` desliga a passagem por completo. */
  cap?: number;
  /** Quando vale a pena gastar um pedido neste evento. */
  precisa: (event: RawEvent) => boolean;
  /** Como completar o evento com o que a página trouxe. */
  completar: (event: RawEvent, html: string, pageUrl: string, log: RunLogger) => RawEvent;
}

export async function seguirDetalhes(options: SeguirDetalhesOptions): Promise<RawEvent[]> {
  const { context, precisa, completar } = options;
  const cap = options.cap ?? DETALHES_POR_OMISSAO;
  const events = [...options.events];
  if (cap === 0) return events;

  let visitadas = 0;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!event || visitadas >= cap) break;
    if (!event.sourceUrl || !precisa(event)) continue;

    const response = await context.http.get(event.sourceUrl);
    visitadas += 1;
    if (!response.ok) {
      // Um detalhe que não responde custa o que a listagem não deu — não o
      // evento. O que já se sabe fica.
      context.log.warn(`detalhe sem resposta: ${event.sourceUrl}`, response.error ?? undefined);
      continue;
    }
    events[index] = completar(event, response.body, response.url, context.log);
  }

  if (visitadas >= cap) {
    context.log.warn('tecto de páginas de detalhe atingido', `${cap} páginas`);
  }

  return events;
}
