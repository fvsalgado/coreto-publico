/**
 * Os endereços para receber um calendário — subscrito, e não descarregado.
 *
 * O `.ics` de cada concelho existe desde o princípio, e era oferecido como
 * uma ligação `https` no fundo da página, com o nome «Calendário iCal»
 * (C2-033). No telemóvel isso descarrega um ficheiro: fica uma cópia do dia
 * em que se tocou, que nunca mais se atualiza — o contrário do que o
 * calendário existe para fazer. A mesma ligação com o esquema `webcal:` é o
 * que o iPhone, o iPad e o Mac abrem como subscrição, e o que o Outlook e o
 * Thunderbird do computador reconhecem.
 *
 * O Google Calendar não abre `webcal:` sozinho, nem no Android: subscreve-se
 * por endereço, no computador, e a ligação `?cid=` é a porta que ele próprio
 * documenta para isso. O endereço `https` vai sempre à vista, para quem
 * prefere colá-lo à mão.
 *
 * Código puro, sem React: é o que deixa afirmar num teste que os três
 * endereços apontam para o mesmo ficheiro.
 */
export interface EnderecosDoCalendario {
  /** O endereço do ficheiro, para copiar, colar ou descarregar. */
  https: string;
  /** O mesmo, com o esquema que os calendários abrem como subscrição. */
  webcal: string;
  /** A porta do Google Calendar para subscrever por endereço. */
  google: string;
}

export function enderecosDoCalendario(origem: string, caminho: string): EnderecosDoCalendario {
  const https = new URL(caminho, origem).toString();
  const webcal = https.replace(/^https?:\/\//i, 'webcal://');
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
  };
}
