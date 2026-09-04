/**
 * Ourém publica uma API JSON pública, e é a melhor fonte do território.
 *
 * `servicos.ourem.pt/api/index.php?service=list_eventos` devolve, sem chave e
 * sem autenticação, o que nenhum HTML destes onze concelhos dá: identificador
 * estável, datas em ISO, hora, sinopse, imagem, local **e coordenadas**.
 *
 * Tudo o que este ficheiro assume foi lido de `../__fixtures__/ourem-api.json`,
 * capturado a 28 de agosto de 2026. Incluindo — e sobretudo — as duas
 * armadilhas: o cartaz por omissão e as coordenadas da própria câmara.
 *
 * Os outros serviços da mesma API (`filter_event`, `lists_event_day`)
 * devolveram lista vazia em todas as datas sondadas. Só `list_eventos` é lido,
 * e o adaptador não depende dos outros.
 */

import { z } from 'zod';
import type { RawEvent } from '@coreto/core';
import type { Adapter, AdapterContext, SourceDates } from '../adapter.js';

/**
 * O que a API devolve, campo a campo.
 *
 * Tudo opcional e tudo tolerante: é input externo de um serviço que ninguém
 * neste lado controla, e uma chave que desapareça não pode derrubar a recolha
 * do concelho inteiro. O que é indispensável — identificador, nome, data de
 * início — é verificado depois, por evento, e o evento sem isso é deixado cair
 * com aviso em vez de inventado.
 */
const eventoSchema = z.object({
  /**
   * Ora um UUID, ora um inteiro — porque são dois backends na mesma API.
   *
   * Os eventos que vêm do portal do associativismo trazem UUID
   * (`708a9714-2145-11f1-…`); os que a câmara publica trazem um inteiro
   * (`80023`). Exigir cadeia rebentava a recolha do concelho inteiro a meio da
   * lista, e exigir número rebentava-a na outra metade. Aceitam-se os dois e
   * fica tudo em texto, que é o que a chave precisa de ser.
   */
  id: z.union([z.string(), z.number()]).optional(),
  nome_atividade: z.string().optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  horario: z.string().optional(),
  sinopse: z.string().optional(),
  custo: z.string().optional(),
  tipologia: z.string().optional(),
  publico_destinatario: z.string().optional(),
  organizacao: z.string().nullish(),
  fotografia: z.string().optional(),
  localizacao: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

const respostaSchema = z.array(eventoSchema);

type Evento = z.infer<typeof eventoSchema>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(\d{2}):(\d{2})/;

/**
 * Caixa que contém Portugal continental.
 *
 * Serve para uma coisa só: apanhar o par trocado, o zero-zero e o campo que
 * ficou com lixo. Um evento do Médio Tejo cai aqui dentro com folga; o que cai
 * fora não é uma coordenada deste concelho, seja lá o que for.
 */
const LAT_MIN = 36.8;
const LAT_MAX = 42.2;
const LON_MIN = -9.6;
const LON_MAX = -6.1;

/**
 * `localizacao` quando ninguém a preencheu.
 *
 * Cinco dos doze eventos capturados dizem «Município de Ourém» e trazem todos
 * exatamente as mesmas coordenadas — as dos paços do concelho. Não é o sítio
 * de nenhum deles: é o valor por omissão do formulário.
 *
 * É o mesmo padrão do `.eb-individual-price` nas fontes Joomla — o campo que
 * sobrou, preenchido com o que estava à mão. Lê-lo como espaço criava um
 * espaço fantasma com nome de concelho; lê-lo como coordenada punha cinco
 * alfinetes na porta da câmara, em eventos que acontecem noutro lado.
 */
const LOCAL_POR_OMISSAO = /^munic[ií]pio de our[ée]m$/i;

/**
 * O cartaz que a plataforma põe quando não há cartaz.
 *
 * `default_cartaz.png` não é a imagem do evento: é o buraco onde ela devia
 * estar. Importá-lo dava uma agenda de cartões todos iguais, e pior do que uma
 * agenda sem imagens é uma agenda que finge tê-las.
 */
const CARTAZ_POR_OMISSAO = /\/default[_-]/i;

function texto(valor: string | null | undefined): string | null {
  const limpo = (valor ?? '').trim();
  return limpo || null;
}

/**
 * `horario` é `HH:MM:SS`, e a meia-noite não é uma hora.
 *
 * Nenhum dos doze eventos capturados marca `00:00:00`, mas a coluna tem um
 * valor por omissão e mais cedo ou mais tarde ele aparece. As duas leituras
 * possíveis não custam o mesmo: deixar cair a hora de um evento que é mesmo à
 * meia-noite mostra-o sem hora, e ninguém se engana; importar um zero por
 * omissão promete meia-noite a quem lê, e alguém aparece a uma porta fechada.
 */
function lerHora(valor: string | undefined): string | null {
  const encontrado = TIME.exec((valor ?? '').trim());
  if (!encontrado) return null;
  const hora = `${encontrado[1]}:${encontrado[2]}`;
  return hora === '00:00' ? null : hora;
}

/**
 * Início e fim, e nunca os dias pelo meio.
 *
 * A mesma regra das fontes Joomla, pela mesma razão: uma exposição de três
 * meses não são noventa eventos, e abri-los seria o sítio a prometer noventa
 * vezes o que ninguém prometeu.
 *
 * E a segunda metade da regra, que faltava aqui como faltava lá: os dois dias
 * saem marcados como o que são — os extremos de uma coisa que está patente —,
 * senão a ficha lê duas sessões, escreve «2 sessões» e diz a quem lê que entre
 * uma e outra não há nada.
 */
export function lerDatas(evento: Evento): SourceDates {
  const inicio = (evento.data_inicio ?? '').trim();
  if (!ISO_DATE.test(inicio)) return { sessions: [], isOngoing: false };

  const startTime = lerHora(evento.horario);
  const fim = (evento.data_fim ?? '').trim();

  // Um fim anterior ao início é um engano de quem escreveu, não um intervalo.
  if (!ISO_DATE.test(fim) || fim <= inicio) {
    return { sessions: [{ date: inicio, startTime }], isOngoing: false };
  }
  return { sessions: [{ date: inicio, startTime }, { date: fim }], isOngoing: true };
}

export interface Coordenadas {
  latitude: number | null;
  longitude: number | null;
}

export function lerCoordenadas(evento: Evento): Coordenadas {
  const vazio: Coordenadas = { latitude: null, longitude: null };

  if (LOCAL_POR_OMISSAO.test((evento.localizacao ?? '').trim())) return vazio;

  const latitude = Number.parseFloat(evento.latitude ?? '');
  const longitude = Number.parseFloat(evento.longitude ?? '');
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return vazio;
  if (latitude < LAT_MIN || latitude > LAT_MAX) return vazio;
  if (longitude < LON_MIN || longitude > LON_MAX) return vazio;

  return { latitude, longitude };
}

/** O nome do sítio, quando é mesmo um sítio e não o valor por omissão. */
export function lerLocal(evento: Evento): string | null {
  const local = texto(evento.localizacao);
  if (!local || LOCAL_POR_OMISSAO.test(local)) return null;
  return local;
}

export function lerImagem(evento: Evento): string | null {
  const imagem = texto(evento.fotografia);
  if (!imagem || CARTAZ_POR_OMISSAO.test(imagem)) return null;
  return imagem;
}

export function paraRawEvent(evento: Evento): RawEvent | null {
  const id = texto(evento.id === undefined ? null : String(evento.id));
  const title = texto(evento.nome_atividade);
  const datas = lerDatas(evento);
  if (!id || !title || datas.sessions.length === 0) return null;

  const { latitude, longitude } = lerCoordenadas(evento);
  const local = lerLocal(evento);

  return {
    sourceKey: id,
    // A API não publica endereço por evento — o portal é uma aplicação de uma
    // página só. Inventar um dava uma ligação partida em cada ficha, e uma
    // ligação partida é pior do que não haver ligação.
    sourceUrl: null,
    title,
    description: texto(evento.sinopse),
    dates: datas.sessions,
    isOngoing: datas.isOngoing,
    venueName: local,
    locationAddress: local,
    latitude,
    longitude,
    priceRaw: texto(evento.custo),
    audienceRaw: texto(evento.publico_destinatario),
    categoriesRaw: texto(evento.tipologia) ? [texto(evento.tipologia)!] : [],
    imageUrl: lerImagem(evento),
    // `organizacao` é quem organiza — e em Ourém é muitas vezes uma
    // coletividade: «Centro Recreativo e Cultural S. Gens», «Fátima Trail
    // Team». O modelo ainda não tem coluna para o organizador, e o registo em
    // bruto é onde isso fica guardado até ter, em vez de se perder.
    payload: { extractedBy: 'ourem-api', organizacao: texto(evento.organizacao) },
  };
}

export const ouremApiAdapter: Adapter = {
  id: 'ourem-api',

  async fetchEvents(context: AdapterContext): Promise<RawEvent[]> {
    const response = await context.http.get(context.source.url);
    if (!response.ok) {
      throw new Error(`a API de Ourém não respondeu: ${response.error ?? response.status}`);
    }

    let decodificado: unknown;
    try {
      decodificado = JSON.parse(response.body);
    } catch {
      throw new Error('a API de Ourém respondeu com o que não é JSON');
    }

    const lista = respostaSchema.safeParse(decodificado);
    if (!lista.success) {
      throw new Error(`a API de Ourém mudou de forma: ${lista.error.issues[0]?.message ?? ''}`);
    }

    const events: RawEvent[] = [];
    const vistos = new Set<string>();
    let deixadosCair = 0;

    for (const evento of lista.data) {
      const raw = paraRawEvent(evento);
      if (!raw) {
        deixadosCair += 1;
        continue;
      }
      if (vistos.has(raw.sourceKey)) continue;
      vistos.add(raw.sourceKey);
      events.push(raw);
    }

    if (deixadosCair > 0) {
      context.log.warn(`${deixadosCair} registos sem identificador, nome ou data de início`);
    }

    // Uma lista vazia que chegou com sucesso é indistinguível de uma agenda
    // que esvaziou. Quem decide é a reconciliação, com o histórico à frente —
    // mas o aviso tem de sair, senão a execução fica verde a não trazer nada.
    if (events.length === 0) context.log.warn('a API de Ourém devolveu zero eventos utilizáveis');

    return events;
  },
};
