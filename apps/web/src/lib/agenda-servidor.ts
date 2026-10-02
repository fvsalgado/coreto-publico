import 'server-only';
import type { EventFilter } from '@coreto/core';
import { addDays } from '@coreto/core/dates';
import { avisoDeFontesPorLer } from '@/src/components/EmptyState';
import {
  fontesDoConcelhoOuNada,
  listCategories,
  listEvents,
  listMunicipalities,
} from '@/src/lib/queries/events';
import { alargamentos, buildHref, descreverDatas, type NomesDosFiltros } from '@/src/lib/agenda';
import { avaliarRecolha, leituraDoConcelho } from '@/src/lib/estado';
import { formatLongDate, formatWeekdayDate } from '@/src/lib/format';
import { emNome, osConcelhosDaRegiao, type Regiao } from '@/src/lib/regiao';

export interface DescricaoDoFiltro {
  /** Curto, para o título do separador e o cabeçalho da página. */
  rotulo: string;
  /** Uma frase inteira, para a descrição que vai para os motores de busca. */
  frase: string;
}

/**
 * Os filtros activos por extenso — em duas medidas, e não numa.
 *
 * Havia uma cadeia só a servir o título e a descrição, e daí saíam frases como
 * «Eventos Música em Ourém nos onze concelhos do Médio Tejo», que diz uma
 * coisa e o contrário dela. E o intervalo de datas não entrava em nenhuma das
 * duas: a agenda de um fim-de-semana anunciava-se como a agenda inteira, sem
 * dizer de que dias falava — no título, na descrição e no cabeçalho da página.
 *
 * Vivia dentro de `agenda/page.tsx`; saiu para aqui quando o mapa passou a
 * aceitar os mesmos filtros e a precisar da mesma frase.
 */
export async function descreverFiltro(
  regiao: Regiao,
  filter: EventFilter,
  hoje: string,
): Promise<DescricaoDoFiltro> {
  const [municipalities, categories] = await Promise.all([
    listMunicipalities(regiao.id),
    listCategories(),
  ]);
  const municipality = municipalities.find((item) => item.id === filter.municipality);
  const category = categories.find((item) => item.slug === filter.category);
  const datas = descreverDatas(filter.from, filter.to, hoje);

  const partes: string[] = [];
  if (category) partes.push(category.name);
  if (municipality) partes.push(emNome(municipality.name, municipality.article));
  if (filter.familia) partes.push('para crianças e famílias');
  if (filter.free) partes.push('com entrada livre');
  if (filter.accessible) partes.push('com acesso a cadeiras de rodas');
  if (filter.q) partes.push(`sobre «${filter.q}»`);

  // As datas ficam para o fim e atrás de uma vírgula: «Música em Tomar, a
  // partir de domingo» lê-se; sem a vírgula, os dois complementos colam-se.
  const semDatas = partes.join(' ');
  const rotulo = datas ? (semDatas ? `${semDatas}, ${datas}` : datas) : semDatas;
  // «nos onze concelhos» só quando não há concelho escolhido: com um escolhido,
  // a frase estaria a dizer que é em Ourém e nos onze ao mesmo tempo.
  const onde =
    municipality || regiao.concelhosDeclarados === 0
      ? ''
      : ` ${osConcelhosDaRegiao(regiao, 'em')} ${regiao.doNome}`;
  return { rotulo, frase: rotulo ? `Eventos ${rotulo}${onde}.` : '' };
}

/** Uma saída do vazio: o que se propõe, para onde leva, e quantos lá estão. */
export interface PropostaDoVazio {
  rotulo: string;
  href: string;
  quantos: number;
}

export interface SaidasDoVazio {
  /** Os filtros a tirar um a um, só os que dão alguma coisa. */
  alargar: PropostaDoVazio[];
  /** Com datas no filtro: o dia mais próximo, depois delas, em que há eventos. */
  proximoDia: PropostaDoVazio | null;
  /** Com um concelho no filtro: os outros concelhos onde a mesma procura dá. */
  outrosConcelhos: PropostaDoVazio[];
  /** Com um concelho no filtro: a agenda dele que não se lê, se a há. */
  avisoDoConcelho: string | null;
}

const NADA: SaidasDoVazio = {
  alargar: [],
  proximoDia: null,
  outrosConcelhos: [],
  avisoDoConcelho: null,
};

/**
 * Por onde se sai de uma agenda vazia — com números (C2-008).
 *
 * O vazio era um beco: dizia «Alargue o intervalo de datas ou limpe alguns
 * filtros», repetia por baixo o que a linha de estado já dizia, e o único
 * botão era «Enviar um evento». Quem procurava uma atividade gratuita para
 * crianças no sábado chegava a zero e saía do sítio.
 *
 * Aqui conta-se cada saída antes de a oferecer, como os atalhos da entrada:
 * uma proposta que leva a outro zero é o mesmo beco com mais um passo. As
 * contagens são as leituras de sempre (`listEvents`, uma linha, em cache), e
 * só se fazem quando a lista veio vazia.
 *
 * **Degrada, e é de propósito.** As saídas são uma ajuda, e o vazio já diz o
 * que tem a dizer sem elas: uma contagem que falhe tira a proposta, e não a
 * página. O vazio em si não degrada — esse vem de `listEvents`, que propaga.
 */
export async function saidasDoVazio(
  regiao: Regiao,
  filter: EventFilter,
  nomes: NomesDosFiltros,
  contagemPorConcelho: Readonly<Record<string, number>> | null,
): Promise<SaidasDoVazio> {
  const contar = async (filtro: EventFilter): Promise<number> => {
    try {
      return (await listEvents(regiao.id, { ...filtro, page: 1, limit: 1 })).total;
    } catch {
      return 0;
    }
  };

  try {
    const [alargar, proximoDia, avisoDoConcelho] = await Promise.all([
      Promise.all(
        alargamentos(filter, nomes).map(async (alargamento) => ({
          rotulo: alargamento.rotulo,
          href: alargamento.href,
          quantos: await contar(alargamento.filtro),
        })),
      ),
      proximoDiaComEventos(regiao, filter, contar),
      avisoDoConcelhoEscolhido(regiao, filter),
    ]);

    const outrosConcelhos =
      filter.municipality && contagemPorConcelho
        ? Object.entries(contagemPorConcelho)
            .filter(([id, quantos]) => id !== filter.municipality && quantos > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([id, quantos]) => ({
              rotulo: nomes.municipalities[id] ?? id,
              href: buildHref({ ...filter, municipality: id }, 1),
              quantos,
            }))
        : [];

    return {
      alargar: alargar.filter((proposta) => proposta.quantos > 0),
      proximoDia,
      outrosConcelhos,
      avisoDoConcelho,
    };
  } catch {
    return NADA;
  }
}

/**
 * O dia mais próximo, depois das datas pedidas, com eventos que respondem ao
 * resto do filtro. A lista vem ordenada pelo dia da agenda e não pelo começo
 * (`agenda_date`, 0053), por isso lêem-se vinte e escolhe-se o começo mais
 * cedo, em vez de confiar no primeiro.
 */
async function proximoDiaComEventos(
  regiao: Regiao,
  filter: EventFilter,
  contar: (filtro: EventFilter) => Promise<number>,
): Promise<PropostaDoVazio | null> {
  if (!filter.to) return null;
  const depois = addDays(filter.to, 1);
  const { events } = await listEvents(regiao.id, {
    ...filter,
    from: depois,
    to: undefined,
    page: 1,
    limit: 20,
  });
  const dia = events
    .map((evento) => evento.date_start)
    .filter((data): data is string => typeof data === 'string' && data >= depois)
    .sort()[0];
  if (!dia) return null;
  const filtro = { ...filter, from: dia, to: dia, page: 1 };
  const quantos = await contar(filtro);
  if (quantos === 0) return null;
  return {
    rotulo: `O dia mais próximo com eventos: ${formatWeekdayDate(dia)}`,
    href: buildHref(filtro, 1),
    quantos,
  };
}

/**
 * Se a agenda do concelho escolhido não se está a ler, o vazio di-lo — a
 * mesma frase da página do concelho. Sem isto, a agenda calava a falha que a
 * página do concelho admite, e um zero em Ferreira do Zêzere lia-se como um
 * concelho sem nada.
 */
async function avisoDoConcelhoEscolhido(
  regiao: Regiao,
  filter: EventFilter,
): Promise<string | null> {
  if (!filter.municipality) return null;
  const fontes = await fontesDoConcelhoOuNada(regiao.id);
  const doConcelho = fontes?.filter((fonte) => fonte.municipality_id === filter.municipality);
  return avisoDeFontesPorLer(
    leituraDoConcelho(doConcelho ? avaliarRecolha(doConcelho) : null),
    formatLongDate,
  );
}
