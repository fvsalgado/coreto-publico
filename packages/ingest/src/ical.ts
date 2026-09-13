/**
 * Leitor de iCalendar (RFC 5545), sem dependências.
 *
 * Um calendário público é a forma mais antiga e mais honesta de uma casa
 * publicar a sua agenda: o Google Calendar, o Outlook, o Nextcloud e metade
 * dos CMS exportam um `.ics`, e quem o exporta já decidiu que aquilo é para
 * ser lido por máquinas. Não há tema para mudar nem seletor para partir — há
 * um formato de 1998 que ninguém vai reescrever.
 *
 * O que se lê: `SUMMARY`, `DESCRIPTION`, `LOCATION`, `URL`, `UID`,
 * `CATEGORIES`, `STATUS`, `RRULE`, e as datas — `DTSTART`/`DTEND` em dia
 * inteiro, em hora de parede com ou sem fuso, ou em UTC. Tudo o que sai é
 * dia e hora **de Lisboa**, que é o que a base guarda: um `20261003T200000Z`
 * é 21:00 em outubro e 20:00 em dezembro, e quem lê a ficha não tem de saber
 * em que fuso o servidor escreve.
 *
 * O que **não** se faz, e de propósito: expandir uma `RRULE`. «Todas as
 * terças até dezembro» são catorze datas que a fonte não escreveu uma a uma,
 * e a regra da casa (`packages/core/src/dates.ts`) é nunca fabricar. Fica a
 * primeira ocorrência, com a regra guardada ao lado para quem a quiser ver.
 * Também não se lê `DURATION`: tudo o que exporta calendários escreve `DTEND`
 * na mesma, e um campo que ninguém usa é código à espera de um defeito.
 */

import { addDays, emLisboa, isValidIsoDate } from '@coreto/core';

export interface IcalEvent {
  uid: string | null;
  /** `RECURRENCE-ID`: a ocorrência de uma série que a fonte alterou à mão. */
  recurrenceId: string | null;
  summary: string | null;
  description: string | null;
  location: string | null;
  url: string | null;
  categories: string[];
  /** Dia de início, já em Lisboa. */
  startDate: string | null;
  startTime: string | null;
  /** Último dia, quando é outro que não o de início. `null` num dia só. */
  endDate: string | null;
  endTime: string | null;
  allDay: boolean;
  /** `STATUS:CANCELLED`, tal como a fonte o declara. Quem lê decide o que fazer. */
  isCancelled: boolean;
  /** A regra de recorrência, por expandir. */
  rrule: string | null;
  /** O fuso declarado em `DTSTART;TZID=…`, quando o há. */
  tzid: string | null;
}

/**
 * Tecto de `VEVENT` lidos.
 *
 * É alto de propósito: um Google Calendar exporta a história inteira, com o
 * passado todo lá dentro, e o que interessa costuma estar no fim. Quem corta
 * pelo que é agenda e não arquivo é o adaptador, depois de saber as datas —
 * isto só impede que um ficheiro desmesurado ocupe a recolha inteira.
 */
export const MAX_EVENTS = 2000;

interface Propriedade {
  name: string;
  params: Record<string, string>;
  value: string;
}

/**
 * Desfaz o dobrar de linhas da norma.
 *
 * Uma linha com mais de 75 octetos é partida, e a continuação começa por um
 * espaço ou uma tabulação. A quebra pode cair a meio de uma palavra — ou a
 * meio de um caractere acentuado, se quem escreveu contou octetos e não
 * letras, que é o que a norma manda. Junta-se primeiro e lê-se depois.
 */
function desdobrar(text: string): string[] {
  const linhas: string[] = [];
  for (const linha of text.split(/\r\n|\n|\r/)) {
    if ((linha.startsWith(' ') || linha.startsWith('\t')) && linhas.length > 0) {
      linhas[linhas.length - 1] = `${linhas[linhas.length - 1] ?? ''}${linha.slice(1)}`;
    } else {
      linhas.push(linha);
    }
  }
  return linhas;
}

/** `NOME;PARAM=valor;OUTRO="com:dois pontos":valor` → as três partes. */
function lerPropriedade(linha: string): Propriedade | null {
  let aspas = false;
  let fim = -1;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (c === '"') aspas = !aspas;
    else if (c === ':' && !aspas) {
      fim = i;
      break;
    }
  }
  if (fim <= 0) return null;

  const partes: string[] = [];
  let atual = '';
  aspas = false;
  for (const c of linha.slice(0, fim)) {
    if (c === '"') aspas = !aspas;
    if (c === ';' && !aspas) {
      partes.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  partes.push(atual);

  const name = (partes[0] ?? '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9-]*$/.test(name)) return null;

  const params: Record<string, string> = {};
  for (const parte of partes.slice(1)) {
    const igual = parte.indexOf('=');
    if (igual === -1) continue;
    params[parte.slice(0, igual).trim().toUpperCase()] = parte
      .slice(igual + 1)
      .trim()
      .replace(/^"|"$/g, '');
  }

  return { name, params, value: linha.slice(fim + 1) };
}

/** Desfaz o que a norma manda escapar num texto: `\n`, `\,`, `\;` e `\\`. */
export function unescapeIcalText(value: string): string {
  return value
    .replace(/\\([\\;,nN])/g, (_todo, letra: string) =>
      letra === 'n' || letra === 'N' ? '\n' : letra,
    )
    .trim();
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

interface Instante {
  date: string;
  time: string | null;
  allDay: boolean;
}

const DATA = /^(\d{4})(\d{2})(\d{2})$/;
const DATA_HORA = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/;

/** Os fusos que são o de Lisboa por outro nome. Não há nada a converter. */
const FUSOS_DE_LISBOA = /^(?:europe\/lisbon|portugal|wet)$/i;

/*
 * O `paraLisboa` que aqui esteve foi para `@coreto/core` com o nome
 * `emLisboa`, e este ficheiro passou a chamá-lo.
 *
 * O comentário do `instanteDeParede`, mesmo abaixo, já dizia por extenso que
 * isto era «a mesma aproximação de `lisbonUtcOffset` em `@coreto/core`» — uma
 * cópia declarada é na mesma uma cópia, e a que não estava aqui (a do
 * `html.ts`) descartava o fuso em silêncio. Agora a regra é uma, e o
 * `dates.test.ts` do core é onde ela se prova.
 */

/**
 * O desvio de um fuso em relação a UTC num dado instante, em minutos.
 *
 * `null` quando o sistema não conhece o fuso — os Outlooks escrevem
 * `TZID=GMT Standard Time`, que não é um nome IANA e que o `Intl` recusa.
 */
function desvioMinutos(zona: string, ms: number): number | null {
  try {
    const nome =
      new Intl.DateTimeFormat('en-GB', { timeZone: zona, timeZoneName: 'longOffset' })
        .formatToParts(new Date(ms))
        .find((parte) => parte.type === 'timeZoneName')?.value ?? '';
    if (nome === 'GMT' || nome === 'UTC') return 0;
    const desvio = /GMT([+-])(\d{2}):?(\d{2})?/.exec(nome);
    if (!desvio) return null;
    const sinal = desvio[1] === '-' ? -1 : 1;
    return sinal * (Number(desvio[2]) * 60 + Number(desvio[3] ?? '0'));
  } catch {
    return null;
  }
}

/**
 * A hora de parede de outro fuso, como instante absoluto.
 *
 * A mesma aproximação de `lisbonUtcOffset` em `@coreto/core`: lê-se a hora
 * como se fosse UTC, pergunta-se o desvio nesse instante e corrige-se — duas
 * vezes, para a hora que cai à volta da mudança dos relógios cair do lado
 * certo. Só se engana dentro da própria hora ambígua, duas madrugadas por
 * ano, em eventos que ninguém marca a essa hora.
 */
function instanteDeParede(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  segundos: number,
  zona: string,
): number | null {
  const comoUtc = Date.UTC(ano, mes - 1, dia, hora, minuto, segundos);
  const primeiro = desvioMinutos(zona, comoUtc);
  if (primeiro === null) return null;
  const corrigido = desvioMinutos(zona, comoUtc - primeiro * 60_000) ?? primeiro;
  return comoUtc - corrigido * 60_000;
}

function lerData(prop: Propriedade | null): Instante | null {
  if (!prop) return null;
  const valor = prop.value.trim();
  const tipo = (prop.params['VALUE'] ?? '').toUpperCase();

  const soDia = DATA.exec(valor);
  if (tipo === 'DATE' || soDia) {
    if (!soDia) return null;
    const iso = `${soDia[1]}-${soDia[2]}-${soDia[3]}`;
    return isValidIsoDate(iso) ? { date: iso, time: null, allDay: true } : null;
  }

  const completo = DATA_HORA.exec(valor);
  if (!completo) return null;
  const iso = `${completo[1]}-${completo[2]}-${completo[3]}`;
  const hora = Number(completo[4]);
  const minuto = Number(completo[5]);
  const segundos = Number(completo[6] ?? '0');
  if (!isValidIsoDate(iso) || hora > 23 || minuto > 59 || segundos > 60) return null;

  const ano = Number(completo[1]);
  const mes = Number(completo[2]);
  const dia = Number(completo[3]);

  if (completo[7] === 'Z') {
    return { ...emLisboa(Date.UTC(ano, mes - 1, dia, hora, minuto, segundos)), allDay: false };
  }

  const tzid = prop.params['TZID'];
  if (tzid && !FUSOS_DE_LISBOA.test(tzid)) {
    const instante = instanteDeParede(ano, mes, dia, hora, minuto, segundos, tzid);
    if (instante !== null) return { ...emLisboa(instante), allDay: false };
    // Um fuso que o sistema não conhece lê-se como hora de parede. Numa fonte
    // portuguesa a hora de parede é a de Lisboa muito mais vezes do que não é,
    // e a alternativa era deitar fora a hora inteira.
  }

  return { date: iso, time: `${completo[4]}:${completo[5]}`, allDay: false };
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

function primeira(props: readonly Propriedade[], nome: string): Propriedade | null {
  return props.find((prop) => prop.name === nome) ?? null;
}

function texto(props: readonly Propriedade[], nome: string): string | null {
  const prop = primeira(props, nome);
  if (!prop) return null;
  const limpo = unescapeIcalText(prop.value);
  return limpo || null;
}

/** `CATEGORIES:Música,Teatro` — separa pela vírgula que não está escapada. */
function categorias(props: readonly Propriedade[]): string[] {
  const out: string[] = [];
  for (const prop of props.filter((candidate) => candidate.name === 'CATEGORIES')) {
    for (const parte of prop.value.split(/(?<!\\),/)) {
      const limpa = unescapeIcalText(parte);
      if (limpa && !out.includes(limpa)) out.push(limpa);
    }
  }
  return out.slice(0, 20);
}

function montar(props: readonly Propriedade[]): IcalEvent {
  const inicio = lerData(primeira(props, 'DTSTART'));
  const fim = lerData(primeira(props, 'DTEND'));

  let endDate: string | null = null;
  let endTime: string | null = null;

  if (inicio && fim) {
    if (inicio.allDay) {
      // Num evento de dia inteiro o `DTEND` é EXCLUSIVO: uma feira de sábado
      // escreve-se `DTSTART:…19` e `DTEND:…20`, e é um dia só. Lê-lo à letra
      // punha a feira também no domingo, que é o dia em que não há feira.
      const ultimo = fim.allDay ? addDays(fim.date, -1) : fim.date;
      if (ultimo > inicio.date) endDate = ultimo;
    } else if (fim.date === inicio.date) {
      endTime = fim.time;
    } else if (fim.time && fim.time < '06:00' && fim.date === addDays(inicio.date, 1)) {
      // Um baile que acaba à uma da manhã não é um evento de dois dias — é a
      // noite de sábado, que se prolongou. O mesmo critério de `saneEndTime`
      // em `@coreto/core`: antes das seis é madrugada, não é outro dia.
      endTime = fim.time;
    } else {
      endDate = fim.date;
      endTime = fim.time;
    }
  }

  const status = (texto(props, 'STATUS') ?? '').toUpperCase();

  return {
    uid: texto(props, 'UID'),
    recurrenceId: primeira(props, 'RECURRENCE-ID')?.value.trim() || null,
    summary: texto(props, 'SUMMARY'),
    description: texto(props, 'DESCRIPTION'),
    location: texto(props, 'LOCATION'),
    url: primeira(props, 'URL')?.value.trim() || null,
    categories: categorias(props),
    startDate: inicio?.date ?? null,
    startTime: inicio?.time ?? null,
    endDate,
    endTime,
    allDay: inicio?.allDay ?? false,
    isCancelled: status === 'CANCELLED',
    rrule: primeira(props, 'RRULE')?.value.trim() || null,
    tzid: primeira(props, 'DTSTART')?.params['TZID'] ?? null,
  };
}

/**
 * Todos os `VEVENT` de um calendário, pela ordem em que vêm.
 *
 * Um ficheiro que não seja um calendário devolve uma lista vazia, sem
 * rebentar: quem chama sabe distinguir «vazio» de «não é isto», porque é quem
 * viu o cabeçalho.
 */
export function parseIcal(text: string): IcalEvent[] {
  const eventos: IcalEvent[] = [];
  let atual: Propriedade[] | null = null;
  // Componentes abertos dentro do `VEVENT` — um `VALARM` traz a sua própria
  // `DESCRIPTION`, e ela não é a do evento.
  let profundidade = 0;

  for (const linha of desdobrar(text)) {
    const prop = lerPropriedade(linha);
    if (!prop) continue;

    if (prop.name === 'BEGIN') {
      if (atual === null) {
        if (prop.value.trim().toUpperCase() === 'VEVENT') atual = [];
      } else {
        profundidade += 1;
      }
      continue;
    }

    if (prop.name === 'END') {
      if (atual === null) continue;
      if (profundidade > 0) {
        profundidade -= 1;
        continue;
      }
      if (prop.value.trim().toUpperCase() === 'VEVENT') {
        eventos.push(montar(atual));
        atual = null;
        if (eventos.length >= MAX_EVENTS) break;
      }
      continue;
    }

    if (atual !== null && profundidade === 0) atual.push(prop);
  }

  return eventos;
}
