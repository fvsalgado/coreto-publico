import { formatLongDate } from '../format';

/**
 * As fontes, ditas a quem gere uma região (C4-032).
 *
 * O painel mostrava «disjuntor aberto» e sessenta caracteres do último erro,
 * em inglês de servidor. A pergunta que uma CIM faz é «a agenda da câmara X
 * deixou de aparecer — o que se passa?», e a resposta tem de caber numa frase
 * que se possa repetir a quem perguntou.
 *
 * Puro, para se testar sem base.
 */

/** Quanto pode durar uma pausa declarada — o mesmo número da `pausar_fonte` (0174). */
export const PAUSA_MAXIMA_DIAS = 90;

/** O tamanho do motivo de uma pausa, que o `/estado` mostra a quem visita. */
export const MOTIVO_MAXIMO = 280;

/**
 * O último erro de uma fonte, numa frase de gente — ou `null` quando não se
 * reconhece, e a página mostra-o tal e qual a recolha o escreveu.
 */
export function erroEmPortugues(erro: string | null | undefined): string | null {
  if (!erro) return null;
  const e = erro.toLowerCase();
  if (e.includes('a fonte não respondeu')) {
    return 'O servidor da fonte não respondeu a nenhum pedido: não se leu nada, e zero eventos aqui não quer dizer agenda vazia.';
  }
  if (e.includes('contagem suspeita')) {
    return 'A página da fonte respondeu, mas a lista de eventos veio vazia ou muito mais curta do que o costume: é provável que a página tenha mudado de forma.';
  }
  if (/robots/.test(e)) {
    return 'O sítio da fonte pediu, no robots.txt, para não ser lido desta maneira.';
  }
  if (/enotfound|getaddrinfo|eai_again/.test(e)) {
    return 'O domínio da fonte deixou de responder, ou deixou de existir.';
  }
  if (
    /econnreset|econnrefused|und_err_connect_timeout|etimedout|socket hang up|timed? ?out|tempo esgotado/.test(
      e,
    )
  ) {
    return 'O servidor da fonte recusou ou cortou a ligação, ou demorou de mais a responder.';
  }
  if (/\b(403|429)\b|forbidden|too many requests/.test(e)) {
    return 'A fonte está a recusar os nossos pedidos — um bloqueio, ou um limite de pedidos. Vale a pena falar com quem gere o sítio.';
  }
  if (/\b404\b|not found/.test(e)) {
    return 'O endereço que se lia deixou de existir: a agenda mudou de sítio.';
  }
  if (/\b5\d\d\b/.test(e)) {
    return 'O servidor da fonte está com problemas do lado dele.';
  }
  if (/certificate|cert_|ssl|tls/.test(e)) {
    return 'O certificado de segurança do sítio da fonte não é válido.';
  }
  return null;
}

/** O estado de uma fonte numa palavra ou duas, e se merece a cor de alerta. */
export function estadoDaFonte(fonte: {
  is_enabled: boolean;
  em_pausa: boolean;
  pausada_ate: string | null;
  breaker_open: boolean;
  circuit_open_until: string | null;
  is_stale: boolean;
}): { rotulo: string; alerta: boolean } {
  const dia = (instante: string | null) => (instante ? formatLongDate(instante.slice(0, 10)) : '');
  if (!fonte.is_enabled) return { rotulo: 'desligada', alerta: false };
  if (fonte.em_pausa) return { rotulo: `em pausa até ${dia(fonte.pausada_ate)}`, alerta: false };
  if (fonte.breaker_open) {
    return { rotulo: `em pausa automática até ${dia(fonte.circuit_open_until)}`, alerta: true };
  }
  if (fonte.is_stale) return { rotulo: 'parada', alerta: true };
  return { rotulo: 'a ser lida', alerta: false };
}
