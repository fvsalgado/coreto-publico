/**
 * CAMINHOS — a programação cultural em rede da CIM do Médio Tejo.
 *
 * É a única fonte que cobre os onze concelhos ao mesmo tempo: a mesma
 * produção percorre o território, com sessões em escolas, museus e centros
 * culturais de vários concelhos. Por isso este adaptador devolve **um
 * `RawEvent` por concelho** — com `municipalityId` próprio e só as sessões
 * desse concelho — em vez de fingir que a itinerância acontece toda num
 * sítio.
 *
 * O sítio é WordPress com Elementor e não publica JSON-LD nem RSS. O que
 * publica, publica de forma disciplinada, e é disso que se lê:
 *
 *   - a grelha `/programacao/` tem um cartão `.mix` por produção, com o
 *     título em `data-name`, a ligação para a página própria e a imagem em
 *     `data-bg-image`;
 *   - a página de cada produção repete sempre os mesmos blocos de texto:
 *     categoria, «DURAÇÃO: …», público («Comunidade escolar (M/3)»),
 *     «CONDIÇÕES DE ACESSO: …», e a sinopse;
 *   - as sessões vêm num bloco próprio, um `<p>` por sessão, com três
 *     linhas: `DD.MM.AAAA / HH:MM`, o espaço, e o concelho.
 *
 * Tudo o que este ficheiro assume foi lido de
 * `../__fixtures__/caminhos.html` e `../__fixtures__/caminhos-evento.html`,
 * capturadas a 28 de agosto de 2026.
 */

import {
  MUNICIPALITIES,
  parseDurationMinutes,
  slugify,
  type RawEvent,
  type RawSession,
} from '@coreto/core';
import { selectAll, stripTags, textFrom } from '../html.js';
import { parseAdapterConfig, type Adapter, type AdapterContext } from '../adapter.js';

/** Primeira linha de uma sessão: `13.04.2026  / 11:00` (a hora é opcional). */
const SESSAO_RE = /^(\d{2})\.(\d{2})\.(\d{4})\s*(?:\/\s*(\d{1,2}:\d{2}))?\s*$/;

/** `url('https://…')` dentro de `data-bg-image`, já sem entidades. */
const BG_IMAGE_RE = /url\(\s*['"]?([^'")]+)/i;

/** Ligações para páginas de produção, na grelha e só lá. */
const EVENTO_URL_RE = /^https?:\/\/caminhos\.mediotejo\.pt\/eventos\/[a-z0-9-]+\/?$/;

/** Tecto de páginas de detalhe quando a fonte não o configura. */
const DETALHE_POR_OMISSAO = 30;

/** `slugify(name)` coincide com o id em todos os onze — o teste garante-o. */
const CONCELHO_POR_SLUG = new Map(
  MUNICIPALITIES.map((municipality) => [slugify(municipality.name), municipality.id]),
);

/** Uma sessão já lida do bloco, com o concelho por resolver separado. */
interface SessaoLida {
  session: RawSession;
  /** `null` quando a página não diz o concelho e o nome do espaço não o trai. */
  municipalityId: string | null;
  venue: string | null;
}

/**
 * O concelho escondido no nome do espaço.
 *
 * «Cine-Teatro de Mação» diz onde é sem precisar de mais nada. Só vale com
 * exatamente um concelho no nome: zero não diz nada, e dois seria adivinhar.
 */
function concelhoNoNome(texto: string): string | null {
  const slug = `-${slugify(texto)}-`;
  const acertos = MUNICIPALITIES.filter((municipality) => slug.includes(`-${municipality.id}-`));
  return acertos.length === 1 ? (acertos[0]?.id ?? null) : null;
}

/**
 * Lê as sessões de uma página de produção.
 *
 * Não se ancora no Elementor: qualquer `<p>` da página cuja primeira linha
 * seja `DD.MM.AAAA / HH:MM` é uma sessão — é um convite mais estável do que
 * uma classe de tema. A última linha é o concelho — quando é um dos onze. Há
 * produções em que a linha do concelho vem vazia e a última linha é o espaço
 * («01.05.2026 / 18:00 ⏎ Cine-Teatro de Mação ⏎»): nesses casos o concelho
 * lê-se do nome do espaço quando lá está, e quando não está fica por
 * resolver — o pipeline tenta casá-lo com o catálogo de espaços, e recusa com
 * registo se não conseguir. Inventar um concelho poria o evento na agenda
 * errada.
 */
export function lerSessoes(body: string): { sessoes: SessaoLida[]; porResolver: string[] } {
  const sessoes: SessaoLida[] = [];
  const porResolver: string[] = [];

  for (const paragraph of selectAll(body, 'p')) {
    const lines = stripTags(paragraph.inner)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const head = lines[0] ? SESSAO_RE.exec(lines[0]) : null;
    if (!head || lines.length < 2) continue;

    const ultima = lines[lines.length - 1] as string;
    let municipalityId: string | null = CONCELHO_POR_SLUG.get(slugify(ultima)) ?? null;
    const venueLines = municipalityId ? lines.slice(1, -1) : lines.slice(1);
    const venue = venueLines.join(' — ') || null;

    if (!municipalityId && venue) {
      municipalityId = concelhoNoNome(venue);
      if (!municipalityId) porResolver.push(venue);
    }

    const [, dia, mes, ano, hora] = head;
    sessoes.push({
      session: {
        date: `${ano}-${mes}-${dia}`,
        startTime: hora ? hora.padStart(5, '0') : null,
      },
      municipalityId,
      venue,
    });
  }

  return { sessoes, porResolver };
}

/** Os blocos de texto de uma página de produção, já classificados. */
export interface FichaLida {
  categoria: string | null;
  duracaoMinutos: number | null;
  publico: string | null;
  condicoesDeAcesso: string | null;
  descricao: string | null;
  gratuito: boolean | null;
}

const CONTACTOS_RE = /caminhos@cimt\.pt|made with/i;
const DURACAO_RE = /^dura[çc][ãa]o\s*:/i;
const CONDICOES_RE = /^condi[çc][õo]es de acesso\s*:\s*/i;
const PUBLICO_RE = /\(m\/\d{1,2}\)\s*$|^(?:comunidade escolar|p[úu]blico geral|fam[íi]lias)\b/i;
const GRATUITO_RE = /entrada livre|gratuit/i;

/**
 * Classifica os blocos de texto pelo que contêm, não pela posição.
 *
 * A ordem na página é sempre a mesma hoje — categoria, duração, público,
 * condições, sinopse — mas contar com ela é contar com o tema. Cada bloco
 * declara o que é: «DURAÇÃO:» e «CONDIÇÕES DE ACESSO:» pelo rótulo, o
 * público pelo «(M/3)», os contactos pelo email da rede. A categoria é o
 * primeiro bloco curto que sobra, e a sinopse é tudo o resto.
 */
export function lerFicha(body: string): FichaLida {
  const ficha: FichaLida = {
    categoria: null,
    duracaoMinutos: null,
    publico: null,
    condicoesDeAcesso: null,
    descricao: null,
    gratuito: null,
  };
  const prosa: string[] = [];

  for (const widget of selectAll(body, '.elementor-widget-text-editor')) {
    const texto = stripTags(widget.inner).trim();
    if (!texto || CONTACTOS_RE.test(texto)) continue;

    if (DURACAO_RE.test(texto)) {
      ficha.duracaoMinutos = parseDurationMinutes(texto);
      continue;
    }
    if (CONDICOES_RE.test(texto)) {
      ficha.condicoesDeAcesso = texto.replace(CONDICOES_RE, '').trim() || null;
      continue;
    }
    if (!ficha.publico && PUBLICO_RE.test(texto) && texto.length <= 80) {
      ficha.publico = texto;
      continue;
    }
    if (!ficha.categoria && prosa.length === 0 && texto.length <= 48 && !texto.includes('\n')) {
      ficha.categoria = texto;
      continue;
    }
    prosa.push(texto);
  }

  ficha.descricao = prosa.join('\n\n') || null;
  const acessoEProsa = [ficha.condicoesDeAcesso ?? '', ficha.descricao ?? ''].join('\n');
  if (GRATUITO_RE.test(acessoEProsa)) ficha.gratuito = true;

  return ficha;
}

/** O título como o sítio o escreve: `Produção | Companhia`. */
export function partirTitulo(bruto: string): { title: string; subtitle: string | null } {
  const [cabeca, ...resto] = bruto.split('|').map((parte) => parte.trim());
  if (!cabeca || resto.length === 0) return { title: bruto.trim(), subtitle: null };
  return { title: cabeca, subtitle: resto.join(' | ') || null };
}

/** Cartões da grelha: endereço → imagem, para não depender do detalhe. */
export function lerGrelha(body: string): Map<string, { imageUrl: string | null }> {
  const out = new Map<string, { imageUrl: string | null }>();

  for (const card of selectAll(body, '.mix')) {
    const href = selectAll(card.inner, 'a', 1)[0]?.attributes['href']?.trim();
    if (!href || !EVENTO_URL_RE.test(href)) continue;

    const thumb = selectAll(card.inner, '.the-thumb', 1)[0]?.attributes['data-bg-image'] ?? '';
    const imagem = BG_IMAGE_RE.exec(thumb)?.[1] ?? null;
    if (!out.has(href)) out.set(href, { imageUrl: imagem });
  }

  return out;
}

/** O último segmento do endereço: `…/eventos/coro-dos-comuns/` → `coro-dos-comuns`. */
function slugDoEndereco(url: string): string {
  return url.replace(/\/+$/, '').split('/').pop() ?? url;
}

/**
 * Parte uma produção lida em um `RawEvent` por concelho.
 *
 * Quando todas as sessões de um concelho são no mesmo espaço, o espaço sobe
 * para o evento e pode casar com o catálogo por alias. Quando são em espaços
 * diferentes, cada sessão guarda o seu (`venueOverride`) e o evento fica com
 * os nomes todos como local em texto — verdadeiro, ainda que por resolver.
 */
export function porConcelho(
  url: string,
  ficha: FichaLida,
  titulo: { title: string; subtitle: string | null },
  sessoes: SessaoLida[],
  imageUrl: string | null,
): RawEvent[] {
  const slug = slugDoEndereco(url);
  const ordem: string[] = [];
  const grupos = new Map<string, SessaoLida[]>();
  for (const sessao of sessoes) {
    // As sessões sem concelho agrupam-se pelo espaço: partilham a chave
    // porque partilham o sítio, e é pelo sítio que o pipeline vai tentar
    // descobrir o concelho no catálogo.
    const chave = sessao.municipalityId ?? `?${slugify(sessao.venue ?? 'sessao')}`;
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(sessao);
    else {
      grupos.set(chave, [sessao]);
      ordem.push(chave);
    }
  }

  const out: RawEvent[] = [];

  for (const chave of ordem) {
    const grupo = grupos.get(chave)!;
    const municipalityId = grupo[0]?.municipalityId ?? null;
    const espacos = [...new Set(grupo.map((s) => s.venue).filter((v): v is string => v !== null))];
    const umSoEspaco = espacos.length === 1 ? (espacos[0] as string) : null;

    out.push({
      // Com concelho, a chave é o concelho; sem ele, é o espaço — estável
      // enquanto a página disser o mesmo, que é o que uma chave pode prometer.
      sourceKey: `${slug}:${municipalityId ?? slugify(umSoEspaco ?? chave)}`,
      sourceUrl: url,
      title: titulo.title,
      subtitle: titulo.subtitle,
      description: ficha.descricao,
      dates: grupo.map(({ session, venue }) => ({
        ...session,
        venueOverride: umSoEspaco ? null : venue,
      })),
      municipalityId,
      venueName: umSoEspaco,
      locationName: umSoEspaco ? null : espacos.join(' · ').slice(0, 200) || null,
      categoriesRaw: ficha.categoria ? [ficha.categoria] : [],
      audienceRaw: ficha.publico,
      durationMinutes: ficha.duracaoMinutos,
      isFree: ficha.gratuito,
      accessibilityNotes: ficha.condicoesDeAcesso,
      imageUrl,
      seriesId: 'caminhos',
      payload: { extractedBy: 'caminhos', concelho: municipalityId },
    });
  }

  return out;
}

export const caminhosAdapter: Adapter = {
  id: 'caminhos',

  async fetchEvents(context: AdapterContext): Promise<RawEvent[]> {
    const { config } = parseAdapterConfig(context.source.config);
    const listUrl = config.listUrls?.[0] ?? context.source.url;

    const grelha = await context.http.get(listUrl);
    if (!grelha.ok) {
      // **Falhar alto, e não devolver lista vazia.** Devolver `[]` aqui dizia
      // «a rede intermunicipal não tem programação», que é uma afirmação sobre
      // o CAMINHOS feita sem se ter conseguido lê-lo. A 5 e a 9 de setembro de
      // 2026, dezassete fontes gravaram sucesso por este caminho, sem terem
      // lido um byte — o painel ficou verde vindo da própria avaria.
      //
      // Esta fonte está hoje a levar `ECONNRESET` todas as noites. O que a
      // salvou de gravar sucesso foi ter linha de base 9: como esperava
      // alguma coisa, o zero deu na vista. Uma fonte nova, com linha de base
      // zero, não teria essa sorte — e é por isso que a guarda vive aqui, e
      // não na contagem.
      throw new Error(
        `a grelha não respondeu: ${grelha.error ?? grelha.status} — não se leu nada, e zero eventos aqui não quer dizer rede sem programação`,
      );
    }

    const cartoes = lerGrelha(grelha.body);
    if (cartoes.size === 0) {
      context.log.warn('nenhum cartão de produção na grelha — mudou o tema?');
      return [];
    }

    const tecto = config.maxDetailPages ?? DETALHE_POR_OMISSAO;
    const events: RawEvent[] = [];
    let lidos = 0;

    for (const [url, cartao] of cartoes) {
      if (lidos >= tecto) break;
      lidos += 1;

      const detalhe = await context.http.get(url);
      if (!detalhe.ok) {
        context.log.warn(`página da produção sem resposta: ${url}`);
        continue;
      }

      const tituloBruto = textFrom(detalhe.body, ['h1.elementor-heading-title', 'h1']);
      if (!tituloBruto) {
        context.log.warn(`página sem título legível: ${url}`);
        continue;
      }

      const { sessoes, porResolver } = lerSessoes(detalhe.body);
      if (porResolver.length > 0) {
        context.log.info(
          `sessões sem concelho na página — fica o espaço para o pipeline resolver: ${url}`,
          [...new Set(porResolver)].join(', '),
        );
      }
      if (sessoes.length === 0) {
        context.log.info(`produção sem sessões datadas: ${url}`);
        continue;
      }

      events.push(
        ...porConcelho(
          url,
          lerFicha(detalhe.body),
          partirTitulo(tituloBruto),
          sessoes,
          cartao.imageUrl,
        ),
      );
    }

    return events;
  },
};
