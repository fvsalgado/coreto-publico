import type { StatKind } from './kinds';

/**
 * Envio de uma contagem, do navegador para `/api/stats`.
 *
 * Duas exigências mandam nesta função. A primeira é que o pedido sobreviva à
 * navegação: quem carrega no botão da bilhética sai da página no instante
 * seguinte, e um `fetch` normal é cancelado quando a página se descarrega —
 * daí `sendBeacon`, que é entregue pelo navegador depois de a página morrer.
 * A segunda é que falhar não custe nada a ninguém: sem rede, com um bloqueador
 * pelo meio ou com a rota em baixo, isto não pode lançar exceções nem escrever
 * na consola de quem visita. Uma contagem perdida é irrelevante; uma ficha de
 * evento partida por causa dela, não.
 */

const ENDPOINT = '/api/stats';

export function recordStat(eventId: string, kind: StatKind): void {
  const payload = JSON.stringify({ eventId, kind });

  try {
    if (typeof navigator.sendBeacon === 'function') {
      // O tipo do `Blob` é o que faz o navegador enviar `application/json`;
      // sem ele o pedido sai como `text/plain` e a rota recusa-o.
      const sent = navigator.sendBeacon(
        ENDPOINT,
        new Blob([payload], { type: 'application/json' }),
      );
      if (sent) return;
    }

    // Alternativa para quem não tem `sendBeacon` (ou quando a fila do
    // navegador está cheia). `keepalive` dá-lhe a mesma hipótese de
    // sobreviver à navegação.
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Em silêncio, de propósito: ver acima.
    });
  } catch {
    // Idem. Nem uma exceção nem um aviso na consola.
  }
}
