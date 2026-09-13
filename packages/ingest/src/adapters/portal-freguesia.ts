/**
 * O «Portal da Freguesia», o CMS que muitas juntas usam.
 *
 * O rodapé identifica-se: `<meta name="author" content="GESAutarquia">` e
 * `og:site_name` «Portal da Freguesia V3». É produto, não é sítio feito à
 * medida — o que quer dizer que o que aqui se aprende serve para todas as
 * juntas que o usam, e não só para a de Minde.
 *
 * ## Porque não se lê o RSS
 *
 * A junta serve `/eventos/rss`, e foi por aí que esta casa entrou primeiro.
 * Foi um erro, e a conta é fácil de fazer contra o feed vivo de 29 de agosto
 * de 2026:
 *
 * 1. **A ligação de cada item é um 404.** O feed escreve
 *    `/autarquia/noticias/75-<slug>`, que é a rota das notícias; a página do
 *    evento é `/freguesia/agenda/19-09-2026/75-<slug>`. Verificado: a
 *    primeira responde 404, a segunda 200. O botão «Página oficial» de cada
 *    ficha levava a lado nenhum.
 * 2. **Não há horas.** Todo o `pubDate` é `00:00:00`. A listagem diz
 *    «21:30h - 22:30h».
 * 3. **Não há cartaz.** A listagem traz `/images/freguesia/eventos/75/…`.
 * 4. **É arquivo, não é agenda.** Vinte e quatro itens, vinte e um deles já
 *    passados. A listagem mostra os que faltam acontecer, que é o que uma
 *    agenda quer.
 *
 * A listagem é servida pelo servidor, sem JavaScript pelo meio. Tudo o que
 * este ficheiro assume foi lido de `../__fixtures__/jf-minde-agenda.html` e
 * `../__fixtures__/jf-minde-evento.html`, capturados nesse dia.
 *
 * ## Onde é o evento
 *
 * O CMS tem **um** campo de texto livre por evento, e as juntas usam-no como
 * lhes apetece: nos três eventos de Minde, um traz o sítio («Pavilhão Ana
 * Sonça»), um traz o que a coisa é («Torneio de tiro ao alvo com pressão de
 * ar») e um repete o título. Um em três.
 *
 * Por isso esse texto **não é escrito como local**. É oferecido ao catálogo
 * de espaços: se casar com um espaço que conhecemos, ganha-se o espaço certo;
 * se não casar, é deitado fora enquanto local e fica só na descrição. Quem
 * decide é o catálogo, nunca uma adivinhação daqui.
 *
 * O que se sabe de certeza é a freguesia — é a junta dela que publica isto —,
 * e é isso que `parish` e `locationName` na configuração da fonte declaram.
 */

import { normalizeForHash } from '@coreto/core';
import type { RawEvent } from '@coreto/core';
import { parseAdapterConfig, type Adapter, type AdapterContext } from '../adapter.js';
import { absoluteUrl, selectAll, selectFirst, stripTags } from '../html.js';

/** O bloco de um evento na listagem. */
const BLOCO = 'article.agenda-item';

/**
 * A data e o identificador vivem no próprio endereço da página do evento:
 * `/freguesia/agenda/29-08-2026/74-ii_prova_de_resistencia_terrantez_trail_team`.
 *
 * Lê-se dali e não do texto («29-AGO-2026») de propósito: o endereço é
 * canónico, não depende da língua nem do tema, e serve ao mesmo tempo de
 * validação — o que não tem esta forma não é um evento desta agenda.
 */
const ENDERECO_DO_EVENTO = /\/freguesia\/agenda\/(\d{2})-(\d{2})-(\d{4})\/(\d+)(?:[-/]|$)/;

/** `09:00h - 10:00h`, e também `21:30h` sozinho. */
const HORAS = /(\d{1,2}):(\d{2})\s*h?(?:\s*[-–—]\s*(\d{1,2}):(\d{2})\s*h?)?/;

/**
 * A prova de que isto é mesmo a página da agenda.
 *
 * Uma agenda de freguesia está legitimamente vazia semanas a fio, e um seletor
 * que deixou de casar parece exatamente uma agenda vazia. Numa câmara essa
 * diferença mede-se pela contagem — trinta eventos que passam a zero é uma
 * avaria. Numa freguesia com três, a contagem não distingue nada.
 *
 * Distingue-se pela mobília: a página da agenda tem sempre os botões para
 * «Eventos Concluídos» e «Todos», que são rotas do produto e não do tema.
 * Página com mobília e sem eventos é uma agenda vazia, e escreve-se zero sem
 * alarme. Página sem mobília é outra página — e aí a recolha grita, que é o
 * que tem de fazer.
 */
const MOBILIA = /\/freguesia\/agenda\/(todos|concluidos)/i;

/** Quantos eventos ler de uma listagem. Acima disto é arquivo, não é agenda. */
const MAX_ITENS = 60;

/** Quantas páginas de detalhe visitar por execução, sem configuração. */
const MAX_DETALHES = 12;

/**
 * O que se oferece ao catálogo como nome de espaço.
 *
 * Um parágrafo não é um sítio. A primeira versão disto só media a forma —
 * curto e sem pontuação de fim de frase — e deixava passar tudo o que era
 * curto: «Yoga Sénior Turma 1», «Torneio de tiro ao alvo com pressão de ar»,
 * «II Prova de Resistência Terrantêz Trail Team». Um nome que não casa com o
 * catálogo vai para `unresolved_venues`, que é a fila de trabalho de uma
 * pessoa — «este nome é um espaço, dá-lhe o alias certo» —, e em 29 de agosto
 * de 2026 sete das quarenta e oito linhas dessa fila eram títulos de eventos
 * que ninguém pode resolver. Uma fila que se enche de coisas impossíveis
 * deixa de ser lida.
 *
 * Por isso a forma passou a incluir **o que a coisa diz ser**. Em português,
 * um sítio começa quase sempre por dizer que tipo de sítio é: pavilhão, casa,
 * centro, cine-teatro, capela, largo, coreto. É vocabulário fechado e é
 * pequeno, e distingue «Pavilhão Ana Sonça» — que é mesmo um sítio, e que
 * vale a pena alguém pôr no catálogo — de «Torneio de tiro ao alvo», que não
 * é.
 *
 * Não se perde nada com um falso negativo: o texto vai na descrição de
 * qualquer maneira, e a freguesia continua a ser o chão do sítio.
 */
const MAX_NOME_DE_ESPACO = 80;

/**
 * As palavras por que um sítio começa.
 *
 * Normalizadas como os alias — minúsculas, sem acentos, sem hífens —, que é
 * como «Cine-Teatro» e «Cineteatro» passam a ser a mesma entrada. Inclui as
 * coletividades porque neste catálogo várias delas *são* o espaço: a Sociedade
 * Musical Mindense, o Cineclube de Torres Novas, o Choral Phydellius.
 */
const PALAVRAS_DE_SITIO = new Set([
  'adega',
  'agrupamento',
  'anfiteatro',
  'arquivo',
  'associacao',
  'auditorio',
  'banda',
  'biblioteca',
  'capela',
  'casa',
  'castelo',
  'cemiterio',
  'centro',
  'cineclube',
  'cineteatro',
  'claustro',
  'clube',
  'coliseu',
  'complexo',
  'convento',
  'cooperativa',
  'coreto',
  'ermida',
  'escola',
  'espaco',
  'esplanada',
  'estadio',
  'estudio',
  'fabrica',
  'filarmonica',
  'forte',
  'forum',
  'fundacao',
  'galeria',
  'ginasio',
  'grupo',
  'igreja',
  'instituto',
  'jardim',
  'junta',
  'lago',
  'largo',
  'mercado',
  'miradouro',
  'moinho',
  'monumento',
  'mosteiro',
  'museu',
  'nucleo',
  'paco',
  'palacio',
  'parque',
  'pavilhao',
  'piscina',
  'polidesportivo',
  'ponte',
  'posto',
  'praca',
  'praia',
  'quartel',
  'quinta',
  'rancho',
  'recinto',
  'sala',
  'salao',
  'santuario',
  'sede',
  'seminario',
  'sociedade',
  'teatro',
  'terreiro',
  'torre',
  'universidade',
  'zona',
]);

/** `II`, `IX`, `XXV` — como começa meia agenda de freguesia, e não é sigla. */
const NUMERO_ROMANO = /^[IVXLCDM]+$/;

/** `Ana`, `Cultural` — uma palavra escrita como nome, e não aos gritos. */
const ESCRITA_COMO_NOME = /^\p{Lu}\p{Ll}/u;

/**
 * Uma sigla à cabeça: `CAORG`, `MARG`, `NAC.2`.
 *
 * Metade dos espaços desta região anuncia-se pela sigla, e nenhuma sigla está
 * no vocabulário acima. Aceita-se a sigla desde que o resto do nome venha
 * escrito como nome — é isso que separa «CAORG, Minde» de «FESTA DAS
 * VINDIMAS», que é um título aos gritos e não um sítio.
 */
function comecaPorSigla(palavras: string[]): boolean {
  // «CAORG, Minde» traz a vírgula colada à sigla. Apara-se o que não é letra,
  // algarismo ou ponto — o ponto fica porque «NAC.2» é um nome a sério.
  const primeira = (palavras[0] ?? '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.]+$/gu, '');
  if (primeira.length < 2 || primeira.length > 8) return false;
  if (!/^[\p{Lu}\p{N}.]+$/u.test(primeira)) return false;
  if (NUMERO_ROMANO.test(primeira)) return false;
  return palavras.slice(1).some((palavra) => ESCRITA_COMO_NOME.test(palavra));
}

/**
 * Pontuação que só aparece em prosa.
 *
 * O ponto é o caso interessante: a primeira versão recusava-o sempre, e com
 * isso recusava «Biblioteca Municipal Dr. António Baião» e «NAC.2 — Complexo
 * Cultural da Levada», que são nomes de espaços deste catálogo. Um ponto no
 * meio de um nome é uma abreviatura; um ponto **a fechar**, ou seguido de
 * palavra em minúscula, é uma frase.
 */
function temPontuacaoDeFrase(texto: string): boolean {
  if (/[!?;]/.test(texto)) return true;
  if (/\.\s*$/.test(texto)) return true;
  return /\.\s+\p{Ll}/u.test(texto);
}

export function pareceNomeDeEspaco(texto: string | null): boolean {
  if (!texto) return false;
  const limpo = texto.trim();
  if (limpo.length === 0 || limpo.length > MAX_NOME_DE_ESPACO) return false;
  if (temPontuacaoDeFrase(limpo) || /\n/.test(limpo)) return false;

  const palavras = limpo.split(/\s+/).filter(Boolean);
  const primeira = normalizeForHash(palavras[0] ?? '');
  return PALAVRAS_DE_SITIO.has(primeira) || comecaPorSigla(palavras);
}

function horaValida(h: string | undefined, m: string | undefined): string | null {
  if (!h || !m) return null;
  const horas = Number.parseInt(h, 10);
  const minutos = Number.parseInt(m, 10);
  if (!Number.isInteger(horas) || horas > 23 || !Number.isInteger(minutos) || minutos > 59) {
    return null;
  }
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

export interface ItemDaListagem {
  /** O identificador numérico do evento no CMS — estável, ao contrário do slug. */
  id: string;
  url: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  imageUrl: string | null;
}

/**
 * Os eventos de uma página de listagem.
 *
 * `base` é o endereço da própria listagem, para resolver as ligações e as
 * imagens relativas — este CMS escreve-as absolutas, mas nem todas as
 * instalações o farão.
 */
export function parseListagem(html: string, base: string, limite = MAX_ITENS): ItemDaListagem[] {
  const itens: ItemDaListagem[] = [];
  const vistos = new Set<string>();

  for (const bloco of selectAll(html, BLOCO, limite * 2)) {
    if (itens.length >= limite) break;

    const ancora = selectFirst(bloco.inner, 'a');
    const url = absoluteUrl(base, ancora?.attributes['href']);
    if (!url) continue;

    const partes = ENDERECO_DO_EVENTO.exec(url);
    if (!partes) continue;
    const [, dia, mes, ano, id] = partes as unknown as [string, string, string, string, string];
    const date = `${ano}-${mes}-${dia}`;

    const title = stripTags(selectFirst(bloco.inner, 'h4.portfolio-item-title')?.inner).trim();
    // Sem título não é um evento. Não se inventa a partir do slug do endereço,
    // que é o título passado por uma máquina e devolvido sem acentos.
    if (title.length < 2) continue;

    if (vistos.has(id)) continue;
    vistos.add(id);

    const categoria = stripTags(selectFirst(bloco.inner, 'span.portfolio-item-category')?.inner);
    const horas = HORAS.exec(categoria);

    itens.push({
      id,
      url,
      title,
      date,
      startTime: horaValida(horas?.[1], horas?.[2]),
      endTime: horaValida(horas?.[3], horas?.[4]),
      imageUrl: absoluteUrl(base, selectFirst(bloco.inner, 'img')?.attributes['src']),
    });
  }

  return itens;
}

/** O corpo de texto da página de um evento. É o único que o CMS tem. */
export function parseDetalhe(html: string): string | null {
  const corpo = stripTags(selectFirst(html, 'div.text-justify')?.inner).trim();
  return corpo.length > 0 ? corpo : null;
}

function paraEvento(
  item: ItemDaListagem,
  corpo: string | null,
  config: { venueName?: string; locationName?: string; parish?: string },
): RawEvent {
  // O texto livre só se oferece ao catálogo; o `venueName` da configuração,
  // quando existe, ganha-lhe, porque aí a fonte é de uma casa só e isso é
  // uma declaração de quem configurou, não uma leitura de texto.
  const candidato = config.venueName ?? (pareceNomeDeEspaco(corpo) ? (corpo as string) : null);

  return {
    // O identificador do CMS, e não o endereço: o endereço leva a data lá
    // dentro, e um evento adiado passaria a ser um evento novo.
    sourceKey: `evento-${item.id}`,
    sourceUrl: item.url,
    title: item.title,
    description: corpo,
    dates: [{ date: item.date, startTime: item.startTime, endTime: item.endTime }],
    venueName: candidato,
    // O chão do que se sabe: a freguesia de quem publica. Se o `venueName`
    // casar com o catálogo, o espaço certo ganha a este; se não casar, este
    // fica — e o texto que não é um sítio não chega a ser escrito como local.
    locationName: config.locationName ?? null,
    parish: config.parish ?? null,
    imageUrl: item.imageUrl,
    payload: { ...item },
  };
}

export const portalFreguesiaAdapter: Adapter = {
  id: 'portal-freguesia',
  async fetchEvents({ source, http, log }: AdapterContext): Promise<RawEvent[]> {
    const { config } = parseAdapterConfig(source.config);
    const listas = config.listUrls?.length ? config.listUrls : [source.url];
    const limite = Math.min(config.maxItems ?? MAX_ITENS, MAX_ITENS);

    const itens: ItemDaListagem[] = [];
    for (const lista of listas) {
      const resposta = await http.get(lista);
      if (!resposta.ok) {
        log.warn(`listagem sem resposta utilizável: ${lista}`, resposta.error ?? undefined);
        continue;
      }
      // Antes de contar eventos, confirmar que se está na página certa. Sem
      // isto, um sítio que mude de rotas devolvia zero eventos com ar de
      // agenda vazia, e a recolha apagava a programação da freguesia em
      // silêncio.
      if (!MOBILIA.test(resposta.body)) {
        throw new Error(
          `${lista} respondeu, mas não é a página da agenda: faltam as ligações para «todos» e «concluídos». O sítio mudou de forma.`,
        );
      }
      for (const item of parseListagem(resposta.body, lista, limite - itens.length)) {
        itens.push(item);
      }
    }

    if (itens.length === 0) {
      // Uma freguesia sem nada marcado é normal — e a mobília acima já provou
      // que a página é a certa. Zero eventos é uma leitura, não uma avaria.
      log.info(`agenda de ${source.name} sem eventos marcados`);
      return [];
    }

    // A listagem só mostra o que falta acontecer — em Minde, três eventos.
    // Seguir três ligações por noite é barato; seguir quarenta não seria, e é
    // por isso que há tecto. Quem passar do tecto fica sem descrição, não sem
    // evento.
    const seguir = config.followLinks !== false;
    const tectoDetalhes = seguir
      ? Math.min(config.maxDetailPages ?? MAX_DETALHES, itens.length)
      : 0;

    const eventos: RawEvent[] = [];
    for (const [indice, item] of itens.entries()) {
      let corpo: string | null = null;
      if (indice < tectoDetalhes) {
        const detalhe = await http.get(item.url);
        if (detalhe.ok) corpo = parseDetalhe(detalhe.body);
        else log.warn(`página de evento sem resposta: ${item.url}`, detalhe.error ?? undefined);
      }
      eventos.push(
        paraEvento(item, corpo, {
          ...(config.venueName === undefined ? {} : { venueName: config.venueName }),
          ...(config.locationName === undefined ? {} : { locationName: config.locationName }),
          ...(config.parish === undefined ? {} : { parish: config.parish }),
        }),
      );
    }

    log.info(`${eventos.length} eventos na agenda de ${source.name}`);
    return eventos;
  },
};
