import { looksLikeMunicipalNotice, unescapeHtml } from '@coreto/core';

/**
 * As regras de moderação que o C2-022 pediu, ditas a quem modera onde a
 * decisão se toma.
 *
 * **O texto que a recolha arrumou.** A recolha limpa a descrição antes de a
 * propor (`cleanEventDescription`): tira o título repetido no início, a tabela
 * de datas no fim, a legenda do ofuscador de emails, um «Organização» solto. É
 * quase sempre o certo, e às vezes corta de mais — a ficha do «Almoço dos
 * Idosos» abriu com uma vírgula. Quem modera passa a ver o texto como veio, ao
 * lado do que vai ser publicado, e decide; o que corrigir fica trancado.
 *
 * **O que não é programação.** Reuniões dos órgãos autárquicos, atendimentos,
 * campanhas promocionais, horários de serviços: entram nas agendas das câmaras
 * e não são agenda cultural. A recolha nunca os publica sozinha — mandá-los
 * para a fila é o detetor de `packages/core/src/notice.ts` —, e o painel diz
 * porquê e qual é a regra.
 */

/** O texto lido na fonte e o que a recolha propõe, quando diferem. */
export function textoQueARecolhaArrumou(
  payload: Record<string, unknown>,
): { lido: string; proposto: string } | null {
  const bruto = payload.raw;
  const evento = payload.event;
  if (
    typeof bruto !== 'object' ||
    bruto === null ||
    typeof evento !== 'object' ||
    evento === null
  ) {
    return null;
  }
  const descricaoLida = (bruto as Record<string, unknown>).description;
  const descricaoProposta = (evento as Record<string, unknown>).description;
  const lido = unescapeHtml(typeof descricaoLida === 'string' ? descricaoLida : null)?.trim() ?? '';
  const proposto = typeof descricaoProposta === 'string' ? descricaoProposta.trim() : '';
  if (!lido) return null;
  // Espaços e quebras de linha não contam: arrumá-los é mecânico, e não muda
  // o que se lê.
  const junto = (texto: string) => texto.replace(/\s+/g, ' ').trim();
  return junto(lido) === junto(proposto) ? null : { lido, proposto };
}

/** Se o título parece informação municipal, e não programação. */
export function pareceInformacaoMunicipal(titulo: string | null | undefined): boolean {
  return looksLikeMunicipalNotice(titulo);
}

/** O que não é programação, enumerado — o mesmo na regra e na ajuda do painel. */
export const O_QUE_NAO_E_PROGRAMACAO =
  'uma reunião, um atendimento, uma campanha, um horário de serviço';

/** O que é. */
export const O_QUE_E_PROGRAMACAO =
  'Publica-se o que é aberto ao público como espetáculo, exposição, oficina, festa ou encontro.';

/** A regra, numa frase — a mesma na fila e na ficha de um evento publicado. */
export const REGRA_DO_QUE_E_PROGRAMACAO = `Parece informação municipal, e não programação: ${O_QUE_NAO_E_PROGRAMACAO}. ${O_QUE_E_PROGRAMACAO}`;
