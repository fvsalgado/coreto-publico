import 'server-only';
import type { EventFilter } from '@coreto/core';
import { listCategories, listMunicipalities } from '@/src/lib/queries/events';
import { descreverDatas } from '@/src/lib/agenda';
import type { Regiao } from '@/src/lib/regiao';

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
  if (municipality) partes.push(`em ${municipality.name}`);
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
      : ` nos ${regiao.concelhosPorExtenso} concelhos ${regiao.doNome}`;
  return { rotulo, frase: rotulo ? `Eventos ${rotulo}${onde}.` : '' };
}
