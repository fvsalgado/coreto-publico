import type { Proposed, ProposedSession } from './fields';

/**
 * «Falta informação — vou perguntar», com a pergunta já escrita (C4-030).
 *
 * Pedir o que falta é o gesto que transforma a proposta fraca de uma
 * coletividade num evento publicado — e era o que mais tempo comia a quem
 * modera, porque se escrevia de raiz de cada vez: o endereço de quem enviou
 * estava na página em texto, sem ligação, e não havia modelo nenhum.
 *
 * Puro, para se testar: a página dá-lhe a proposta e a região, e ele devolve
 * o que falta e a mensagem.
 */

/**
 * O que falta para a ficha pública dizer o essencial — quando, onde, o que é e
 * quanto custa —, dito como se diz numa mensagem a quem organiza.
 *
 * A categoria e a imagem não entram: quem modera escolhe a primeira, e a
 * segunda é bem-vinda mas não impede ninguém de ir.
 */
export function oQueFalta(
  proposta: Pick<
    Proposed,
    'venue_id' | 'location_name' | 'description' | 'is_free' | 'price_display'
  >,
  sessoes: readonly ProposedSession[],
  emCartaz: boolean,
): string[] {
  const falta: string[] = [];
  const comData = sessoes.filter((sessao) => sessao.date);
  if (comData.length === 0) falta.push('o dia (ou os dias) em que acontece');
  // Uma exposição «em cartaz» não tem hora de começar: tem horário de abertura.
  else if (!emCartaz && comData.some((sessao) => !sessao.start)) falta.push('a hora a que começa');
  if (!proposta.venue_id && !proposta.location_name) {
    falta.push('o local exato (o espaço, ou a morada)');
  }
  if (!proposta.description) falta.push('duas ou três linhas sobre o que é');
  if (!proposta.is_free && !proposta.price_display) {
    falta.push('o preço — ou se a entrada é livre');
  }
  return falta;
}

/**
 * A mensagem: o assunto e o corpo, em texto simples, para um `mailto:`.
 *
 * `agenda` é «a agenda do Médio Tejo» — o nome que quem enviou conhece.
 * `assinatura` é o nome de quem modera, ou a equipa quando entra o dono.
 */
export function mensagemAPedir(opcoes: {
  titulo: string;
  falta: readonly string[];
  agenda: string;
  assinatura: string;
}): { assunto: string; corpo: string } {
  const titulo = opcoes.titulo.trim() || 'o evento que nos enviou';
  const nomeado = opcoes.titulo.trim() ? `«${titulo}»` : titulo;
  const pedido =
    opcoes.falta.length > 0
      ? [
          'Para o publicarmos, falta-nos:',
          '',
          ...opcoes.falta.map(
            (item, indice) => `- ${item}${indice === opcoes.falta.length - 1 ? '.' : ';'}`,
          ),
        ]
      : ['Antes de o publicarmos, gostávamos de confirmar uma coisa:', '', '- '];
  return {
    assunto: `${nomeado} na agenda — falta informação`,
    corpo: [
      'Olá,',
      '',
      `Recebemos ${nomeado} para ${opcoes.agenda}. ${pedido[0]}`,
      ...pedido.slice(1),
      '',
      'Pode responder a este email com o que falta? Assim que chegar, publicamos.',
      '',
      'Cumprimentos,',
      opcoes.assinatura,
    ].join('\n'),
  };
}

/**
 * O endereço `mailto:` com assunto e corpo. `encodeURIComponent` e não
 * `URLSearchParams`: este escreve os espaços como `+`, e há programas de email
 * que os mostram assim.
 */
export function enderecoDeEmail(para: string, assunto: string, corpo: string): string {
  return `mailto:${encodeURIComponent(para).replace(/%40/g, '@')}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}
