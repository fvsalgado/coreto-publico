/**
 * Abrantes publica a agenda numa API JSON — atrás de uma verificação de Origin.
 *
 * O site municipal é uma aplicação Flutter e todo o conteúdo vem de
 * `sitecmaproxy.cm-abrantes.pt/proxy/agenda/eventos`, que responde 403
 * «Origem não autorizada» a quem não enviar o cabeçalho `Origin` do próprio
 * site. **A Câmara Municipal de Abrantes autorizou expressamente esta
 * recolha**, e é essa autorização que legitima o cabeçalho — sem ela, este
 * adaptador não existia (era a posição do plano de dados, e mantém-se para
 * qualquer fonte sem autorização). O cabeçalho vem da configuração da fonte
 * (`originHeader`), onde a autorização está anotada.
 *
 * Tudo o que este ficheiro assume foi lido de
 * `../__fixtures__/abrantes-proxy.json` e `abrantes-proxy-detalhe.json`,
 * capturados a 28 de agosto de 2026. Incluindo a armadilha da casa: em
 * `lstAtividades`, o campo `tipoEntrada` traz «Para todos os públicos» — o
 * público, não a entrada. O mesmo padrão do preço de Tomar e das coordenadas
 * de Ourém: o campo que estava à mão, preenchido com outra coisa.
 */

import { z } from 'zod';
import type { RawEvent, RawSession } from '@coreto/core';
import {
  parseAdapterConfig,
  type Adapter,
  type AdapterContext,
  type SourceDates,
} from '../adapter.js';

const itemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  titulo: z.string().optional(),
  projeto: z.string().nullish(),
  local: z.string().nullish(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  imagemDestaque: z.string().nullish(),
  tipo: z.string().nullish(),
  estado: z.string().nullish(),
  areaTematica: z.string().nullish(),
});

const listaSchema = z.object({
  payload: z.object({
    lstAtividadesPassado: z.array(itemSchema).optional(),
    lstAtividadesHoje: z.array(itemSchema).optional(),
    lstAtividadesFuturo: z.array(itemSchema).optional(),
  }),
});

const atividadeSchema = z.object({
  valorEntrada: z.string().nullish(),
  publicoAlvo: z.string().nullish(),
  url: z.string().nullish(),
  sessoes: z
    .array(
      z.object({
        dataInicio: z.string().nullish(),
        horaInicio: z.string().nullish(),
        local: z.string().nullish(),
      }),
    )
    .nullish(),
});

const detalheSchema = z.object({
  payload: z.union([
    z.array(
      z.object({
        evento: z
          .object({
            horaInicio: z.string().nullish(),
            horaFim: z.string().nullish(),
            descricao: z.string().nullish(),
            sinopse: z.string().nullish(),
            promotor: z.string().nullish(),
            lstAtividades: z.array(atividadeSchema).nullish(),
          })
          .optional(),
      }),
    ),
    // Eventos passados respondem com `payload: ""` — não é um erro, é a forma
    // que a API tem de dizer «não há detalhe».
    z.string(),
  ]),
});

type Item = z.infer<typeof itemSchema>;

const DATA_PT = /^(\d{2})-(\d{2})-(\d{4})$/;
const HORA = /^(\d{2}):(\d{2})/;

/** Quantos dias de passado continuam «vistos», para a reconciliação não esconder o que só acabou. */
const PASSADO_DIAS = 45;

/** Tecto de páginas de detalhe por execução, quando a fonte não o configura. */
const DETALHE_POR_OMISSAO = 30;

function texto(valor: string | null | undefined): string | null {
  const limpo = (valor ?? '').trim();
  return limpo || null;
}

/** `03-09-2026` → `2026-09-03`. O que não couber no molde não é uma data. */
export function lerDataPt(valor: string | null | undefined): string | null {
  const m = DATA_PT.exec((valor ?? '').trim());
  if (!m) return null;
  const [, dia, mes, ano] = m;
  if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31) return null;
  return `${ano}-${mes}-${dia}`;
}

function lerHora(valor: string | null | undefined): string | null {
  const m = HORA.exec((valor ?? '').trim());
  if (!m) return null;
  const hora = `${m[1]}:${m[2]}`;
  return hora === '00:00' ? null : hora;
}

/**
 * Início e fim, e nunca os dias pelo meio — a regra de sempre.
 *
 * Com a outra metade dela, que faltava: os dois extremos saem marcados como
 * extremos. Sem isso a ficha lia duas sessões e escrevia «2 sessões» para uma
 * exposição de meio ano — o dia de abrir e o dia de fechar, e o silêncio pelo
 * meio a passar por facto.
 */
export function lerDatas(item: Item, startTime: string | null): SourceDates {
  const inicio = lerDataPt(item.dataInicio);
  if (!inicio) return { sessions: [], isOngoing: false };

  const primeira: RawSession = startTime ? { date: inicio, startTime } : { date: inicio };
  const fim = lerDataPt(item.dataFim);
  if (!fim || fim <= inicio) return { sessions: [primeira], isOngoing: false };

  return { sessions: [primeira, { date: fim }], isOngoing: true };
}

export function paraRawEvent(item: Item): RawEvent | null {
  const id = texto(item.id === undefined ? null : String(item.id));
  const title = texto(item.titulo);
  const datas = lerDatas(item, null);
  if (!id || !title || datas.sessions.length === 0) return null;

  // «Cancelado» e afins não entram: um evento cancelado publicado como se
  // estivesse de pé é exatamente a porta fechada que esta casa não promete.
  const estado = (item.estado ?? '').toLowerCase();
  if (estado.includes('cancel')) return null;

  const categorias = [texto(item.areaTematica), texto(item.projeto)].filter(
    (valor): valor is string => Boolean(valor),
  );

  return {
    sourceKey: id,
    // A app é de página única: não há endereço público por evento.
    sourceUrl: null,
    title,
    dates: datas.sessions,
    isOngoing: datas.isOngoing,
    venueName: texto(item.local),
    categoriesRaw: categorias,
    imageUrl: texto(item.imagemDestaque),
    payload: { extractedBy: 'abrantes-proxy', tipo: texto(item.tipo) },
  };
}

interface Detalhe {
  startTime: string | null;
  /**
   * `horaFim`, com as regras de `horaInicio`. O detalhe sempre a trouxe — o
   * Festival ao Alto da fixture acaba às «03:00» — e o esquema até a
   * declarava; só nunca ninguém a carregou.
   */
  endTime: string | null;
  description: string | null;
  audienceRaw: string | null;
  priceRaw: string | null;
  ticketingUrl: string | null;
  promotor: string | null;
}

export function lerDetalhe(body: string): Detalhe | null {
  let decodificado: unknown;
  try {
    decodificado = JSON.parse(body);
  } catch {
    return null;
  }
  const parsed = detalheSchema.safeParse(decodificado);
  if (!parsed.success || typeof parsed.data.payload === 'string') return null;

  const evento = parsed.data.payload[0]?.evento;
  if (!evento) return null;

  const atividade = (evento.lstAtividades ?? [])[0] ?? null;

  return {
    startTime: lerHora(evento.horaInicio),
    endTime: lerHora(evento.horaFim),
    description: texto(evento.descricao) ?? texto(evento.sinopse),
    audienceRaw: texto(atividade?.publicoAlvo),
    // `valorEntrada` é o único campo que é mesmo um preço. `tipoEntrada` traz
    // «Para todos os públicos» — quem o lesse como bilhete inventava tarifas.
    priceRaw: texto(atividade?.valorEntrada),
    ticketingUrl: texto(atividade?.url),
    promotor: texto(evento.promotor),
  };
}

function limiar(diasAtras: number, hoje: Date): string {
  const corte = new Date(hoje.getTime() - diasAtras * 86_400_000);
  return corte.toISOString().slice(0, 10);
}

export const abrantesProxyAdapter: Adapter = {
  id: 'abrantes-proxy',

  async fetchEvents(context: AdapterContext): Promise<RawEvent[]> {
    const { config } = parseAdapterConfig(context.source.config);
    const origin = config.originHeader;
    if (!origin) {
      throw new Error(
        'a fonte não tem originHeader configurado — sem a autorização anotada, este adaptador não corre',
      );
    }
    const headers = { Origin: origin, Referer: `${origin}/` };

    const response = await context.http.get(context.source.url, { headers });
    if (!response.ok) {
      throw new Error(`o proxy de Abrantes não respondeu: ${response.error ?? response.status}`);
    }

    let decodificado: unknown;
    try {
      decodificado = JSON.parse(response.body);
    } catch {
      throw new Error('o proxy de Abrantes respondeu com o que não é JSON');
    }

    const lista = listaSchema.safeParse(decodificado);
    if (!lista.success) {
      throw new Error(
        `o proxy de Abrantes mudou de forma: ${lista.error.issues[0]?.message ?? ''}`,
      );
    }

    const {
      lstAtividadesHoje = [],
      lstAtividadesFuturo = [],
      lstAtividadesPassado = [],
    } = lista.data.payload;

    // O passado recente continua «visto»: sem ele, a reconciliação contava
    // como desaparecido tudo o que simplesmente já aconteceu.
    const corte = limiar(PASSADO_DIAS, new Date());
    const recentes = lstAtividadesPassado.filter((item) => {
      const fim = lerDataPt(item.dataFim) ?? lerDataPt(item.dataInicio);
      return fim !== null && fim >= corte;
    });

    const events: RawEvent[] = [];
    const vistos = new Set<string>();
    let deixadosCair = 0;

    for (const item of [...lstAtividadesHoje, ...lstAtividadesFuturo, ...recentes]) {
      const raw = paraRawEvent(item);
      if (!raw) {
        deixadosCair += 1;
        continue;
      }
      if (vistos.has(raw.sourceKey)) continue;
      vistos.add(raw.sourceKey);
      events.push(raw);
    }

    // O detalhe traz a hora, a descrição e o promotor — mas só para o que
    // ainda vai acontecer (o passado responde com payload vazio).
    const tecto = config.maxDetailPages ?? DETALHE_POR_OMISSAO;
    const futuros = new Set(
      [...lstAtividadesHoje, ...lstAtividadesFuturo]
        .map((item) => (item.id === undefined ? null : String(item.id)))
        .filter((id): id is string => id !== null),
    );

    let visitados = 0;
    for (const event of events) {
      if (!futuros.has(event.sourceKey) || visitados >= tecto) continue;
      visitados += 1;

      const detalheResponse = await context.http.get(
        `${context.source.url.replace(/\/$/, '')}/${event.sourceKey}`,
        { headers },
      );
      if (!detalheResponse.ok) {
        context.log.warn(`detalhe sem resposta: ${event.sourceKey}`);
        continue;
      }
      const detalhe = lerDetalhe(detalheResponse.body);
      if (!detalhe) continue;

      // A hora de fim só entra com a de início: um fim sem começo é uma
      // duração sem âncora, e a ficha nem a mostrava. O harmonizador é que
      // decide se «19:30 → 03:00» atravessa a meia-noite ou é um engano.
      if (detalhe.startTime && event.dates[0]) {
        event.dates[0] = {
          ...event.dates[0],
          startTime: detalhe.startTime,
          ...(detalhe.endTime ? { endTime: detalhe.endTime } : {}),
        };
      }
      event.description = detalhe.description;
      event.audienceRaw = detalhe.audienceRaw;
      event.priceRaw = detalhe.priceRaw;
      event.ticketingUrl = detalhe.ticketingUrl;
      event.payload = { ...event.payload, promotor: detalhe.promotor };
    }

    if (deixadosCair > 0) {
      context.log.warn(`${deixadosCair} registos sem identificador, nome ou data — ou cancelados`);
    }
    if (events.length === 0) {
      context.log.warn('o proxy de Abrantes devolveu zero eventos utilizáveis');
    }

    return events;
  },
};
