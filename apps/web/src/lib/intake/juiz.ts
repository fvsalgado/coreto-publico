/**
 * O juiz determinístico da extração por modelo.
 *
 * Entre a resposta do modelo e a fila de moderação havia uma porta só, e essa
 * porta é o Zod: confirma a **forma** — que `date` tem forma de data, que
 * `confidence` está entre zero e um — e nunca a **proveniência**. Uma data que
 * não está no email atravessa-a sem tocar em nada, é escrita com
 * `extraction_status: 'ok'`, pré-preenche o formulário do moderador e sai do
 * outro lado como o dia em que a peça se faz.
 *
 * Isto não substitui a pessoa que modera: confronta o que o modelo devolveu
 * com o que os leitores desta casa conseguem ler do mesmo texto, e diz **onde
 * olhar**. É o contrário de um filtro — não recusa nada, não apaga nada, não
 * volta a chamar o modelo. Marca.
 *
 * **O que não se julga, e porquê.** O título, a descrição, o nome do local, a
 * freguesia, o organizador e as notas de acessibilidade são paráfrase legítima:
 * um modelo que resuma bem escreve palavras que não estão no email. Julgá-los
 * por presença literal marcava tudo, e um estado que marca tudo não diz nada.
 * O concelho e o espaço têm a sua própria porta, no `resolve.ts`, que é
 * pertença a uma lista fechada e não presença no texto.
 *
 * **E o que se julga é o que se pode desmentir**: uma data, uma hora, um preço,
 * um público, um endereço de bilheteira. São os campos com leitor determinístico
 * do lado de cá, e são os que fazem estrago quando são inventados — mandar
 * alguém a uma porta no dia errado, ou a uma bilheteira que não é a do evento.
 */

import { parseAudience, parsePortugueseDates, parsePrice, type ExtractedEvent } from '@coreto/core';

export interface JuizoDaExtracao {
  /** Os campos que o texto de origem não confirma, prontos para uma frase. */
  naoVerificados: string[];
}

function dobrar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * As maneiras de escrever a mesma hora numa página portuguesa.
 *
 * «21:00», «21h00», «21h», «21.00», e a forma sem zero à esquerda que os
 * cartazes usam. Sem isto, uma hora certa que o email escreva «21h» ficava
 * marcada por o modelo a ter normalizado para «21:00» — que é exatamente o que
 * lhe pedimos que fizesse.
 */
function grafiasDaHora(hhmm: string): string[] {
  const [h, m] = hhmm.split(':');
  if (h === undefined || m === undefined) return [];
  const hSem = String(Number(h));
  const formas = [
    `${h}:${m}`,
    `${hSem}:${m}`,
    `${h}h${m}`,
    `${hSem}h${m}`,
    `${h}.${m}`,
    `${hSem}.${m}`,
  ];
  if (m === '00') formas.push(`${h}h`, `${hSem}h`, `${h} h`, `${hSem} h`);
  return formas;
}

/** O mesmo preço, lido dos dois lados: o que o modelo escreveu e o que lá está. */
function precoBate(doModelo: string, fonte: string): boolean {
  const lidoDoModelo = parsePrice(doModelo);
  const daFonte = parsePrice(fonte);
  if (lidoDoModelo.isFree === true) return daFonte.isFree === true;
  if (lidoDoModelo.priceMin === undefined) return false;
  if (daFonte.priceMin === undefined) return false;
  return (
    lidoDoModelo.priceMin >= daFonte.priceMin &&
    (lidoDoModelo.priceMax ?? lidoDoModelo.priceMin) <= (daFonte.priceMax ?? daFonte.priceMin)
  );
}

function publicoBate(doModelo: string, fonte: string): boolean {
  const lido = parseAudience(doModelo);
  const daFonte = parseAudience(fonte);
  if (lido.audience === undefined && lido.min_age === undefined) return false;
  return lido.audience === daFonte.audience && lido.min_age === daFonte.min_age;
}

/**
 * Confronta a resposta do modelo com o texto de onde ela devia ter saído.
 *
 * O `hoje` é o mesmo que foi ao prompt, e o `fonte` tem de ser a **mesma fatia**
 * que o modelo viu. Julgar contra texto que ele não leu dava «verificado» por
 * acidente, e uma referência de dia diferente fazia a inferência do ano divergir
 * à meia-noite.
 */
export function julgarExtracao(
  event: ExtractedEvent,
  fonte: string,
  hoje: string,
): JuizoDaExtracao {
  const naoVerificados: string[] = [];
  const dobrada = dobrar(fonte);

  /*
   * As datas que os leitores desta casa conseguem tirar do mesmo texto.
   *
   * Duas fraquezas conhecidas, e ficam escritas porque explicam metade dos
   * casos marcados: um dia da semana sem número («no próximo sábado») devolve
   * lista vazia — o mapa dos dias existe em `dates.ts` mas o recolector não o
   * consulta —, e um intervalo devolve só os dois extremos, por regra da casa.
   * Um modelo que acerte em qualquer dos dois fica marcado. É o preço de o
   * juiz marcar e nunca recusar: um falso positivo custa a alguém olhar para
   * o texto, e é para isso que a página o mostra logo por baixo.
   */
  const daFonte = new Set(parsePortugueseDates(fonte, { reference: hoje }));
  const semData = event.dates.filter((sessao) => !daFonte.has(sessao.date));
  for (const sessao of semData) naoVerificados.push(`data ${sessao.date}`);

  for (const sessao of event.dates) {
    if (!sessao.startTime) continue;
    const grafias = grafiasDaHora(sessao.startTime);
    if (!grafias.some((forma) => dobrada.includes(forma))) {
      naoVerificados.push(`hora ${sessao.startTime}`);
    }
  }

  if (event.priceRaw) {
    const literal = dobrada.includes(dobrar(event.priceRaw));
    if (!literal && !precoBate(event.priceRaw, fonte)) naoVerificados.push('preço');
  }

  if (event.audienceRaw) {
    const literal = dobrada.includes(dobrar(event.audienceRaw));
    if (!literal && !publicoBate(event.audienceRaw, fonte)) naoVerificados.push('público');
  }

  // O endereço é o mais barato de verificar e o de maior estrago quando é
  // inventado: manda quem quer bilhete a uma bilheteira que não é do evento.
  // Aqui a exigência é literal, sem paráfrase possível.
  if (event.ticketingUrl && !dobrada.includes(dobrar(event.ticketingUrl))) {
    naoVerificados.push('endereço de bilheteira');
  }

  return { naoVerificados };
}
