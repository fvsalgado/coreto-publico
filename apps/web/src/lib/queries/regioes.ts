import 'server-only';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import { COR_DO_TEMA, COR_POR_OMISSAO } from '../paleta';
import { REGIAO_DE_RECURSO, regiaoDaLinha, type LinhaDeRegiao, type Regiao } from '../regiao';
import { REGIAO_PRINCIPAL } from '../regiao-host';
import { publicClient } from '../supabase/server';
import { CACHE_TAGS } from './events';
import { degradarForaDaCache, exigirLeitura } from './falhas';

/**
 * A leitura das regiões, com o mesmo contrato do resto das queries: cache
 * etiquetada, e sem base de dados devolve-se o vazio — o sítio degrada, nunca
 * dá 500 por falta de credenciais.
 *
 * As três leituras deste ficheiro **propagam** o erro, e são as que mais o
 * justificam: a identidade de uma região não é conteúdo de uma página, é a
 * condição para haver página. O porquê de cada uma está escrito por cima
 * dela; a mecânica está em `falhas.ts`.
 */

const COLUNAS_DA_REGIAO =
  'id, name, article, kind, cim_name, cim_url, domain, contact_email, ical_uid_domain, ' +
  'tagline, about_intro, about_story, ' +
  'funding_statement, funding_logo_path, funding_logo_width, funding_logo_height, funding_logo_alt, ' +
  'logo_on_graphite_path, logo_on_brand_path, logo_width, logo_height, ' +
  'og_image_path, og_image_alt, data_controller_name, data_controller_url, ' +
  'data_controller_nif, data_controller_address, data_controller_email, ' +
  'data_controller_dpo, data_controller_dpo_contact, ' +
  'expected_municipality_count, bbox_lat_min, bbox_lat_max, bbox_lon_min, bbox_lon_max, ' +
  'gate_enabled, destaques_alvo';

/**
 * O artigo de quem promove cada região (0169): `{ 'medio-tejo': 'a' }`.
 *
 * **Uma leitura à parte, e que degrada**, pela razão do planeador e da cor lá
 * em baixo: a coluna é nova, e posta em `COLUNAS_DA_REGIAO` uma coluna em
 * falta fazia o PostgREST recusar a leitura da região inteira — o domínio de
 * uma CIM caía por causa de um «da» ou de um «do». Sem a coluna, o mapa vem
 * vazio e o artigo vale «a», que é o que a prosa dizia antes dela. Uma
 * leitura só para todas as regiões: são poucas linhas, e a lista e a região
 * avulsa usam a mesma.
 */
const lerArtigosDosPromotores = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const supabase = publicClient();
    if (!supabase) return {};
    const { data, error } = await supabase.from('regions').select('id, cim_article');
    exigirLeitura('artigosDosPromotores', error);
    const linhas = (data ?? []) as unknown as Array<{ id: string; cim_article?: string | null }>;
    return Object.fromEntries(
      linhas
        .filter((linha) => typeof linha.cim_article === 'string')
        .map((linha) => [linha.id, linha.cim_article as string]),
    );
  },
  ['artigos-dos-promotores'],
  { tags: [CACHE_TAGS.regions], revalidate: 3600 },
);

const artigosDosPromotores = degradarForaDaCache(
  'artigosDosPromotores',
  lerArtigosDosPromotores,
  () => ({}),
);

/**
 * Uma região pelo identificador. `null` para slug desconhecido ou sem base.
 *
 * **Propaga o erro, e é o pior caso de todos os desta correção.** Antes, uma
 * leitura falhada devolvia `null` como um slug inventado devolve `null`; o
 * `exigirRegiao` fazia `notFound()`, e o domínio inteiro de uma CIM respondia
 * 404 — o layout, a agenda, as fichas, os feeds, tudo — durante a hora que a
 * cache guardasse a resposta, com o ISR a guardar também o 404 de cada
 * página. Uma CIM desaparecia da internet por causa de dois segundos de rede.
 *
 * As duas situações passam a ser duas: um erro sobe e não fica guardado;
 * `null` só quer dizer «a base respondeu e não conhece este identificador»,
 * que é um 404 verdadeiro, o mesmo das secções desligadas, e esse pode ficar
 * em cache à vontade porque é uma resposta e não uma falta de resposta.
 */
export const carregarRegiao = unstable_cache(
  async (id: string): Promise<Regiao | null> => {
    const supabase = publicClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('regions')
      .select(COLUNAS_DA_REGIAO)
      .eq('id', id)
      .maybeSingle();
    exigirLeitura('carregarRegiao', error);
    if (!data) return null;
    const artigos = await artigosDosPromotores();
    return regiaoDaLinha({
      ...(data as unknown as LinhaDeRegiao),
      cim_article: artigos[id] ?? null,
    });
  },
  ['regiao'],
  { tags: [CACHE_TAGS.regions], revalidate: 3600 },
);

/**
 * Os domínios alias, agrupados por região: `{ 'medio-tejo':
 * ['mediotejo.coreto.org'] }`. São encaminhamento puro — quem os consome é o
 * `/api/regioes`, para o middleware redirecionar cada um ao canónico.
 *
 * **Propaga**, e quem degrada é o middleware — que já o sabe fazer melhor do
 * que esta função alguma vez saberia. O `carregarMapa` de `regiao-host.ts`
 * apanha a falha de `/api/regioes`, fica com o mapa que já tinha e volta a
 * tentar dali a trinta segundos. Um mapa vazio guardado uma hora aqui dentro
 * cegava esse mecanismo: nada teria falhado, e portanto nada voltaria a
 * tentar.
 */
export const aliasesDasRegioes = unstable_cache(
  async (): Promise<Record<string, string[]>> => {
    const supabase = publicClient();
    if (!supabase) return {};
    const { data, error } = await supabase
      .from('region_domain_aliases')
      .select('domain, region_id');
    exigirLeitura('aliasesDasRegioes', error);
    const porRegiao: Record<string, string[]> = {};
    for (const linha of (data ?? []) as Array<{ domain: string; region_id: string }>) {
      (porRegiao[linha.region_id] ??= []).push(linha.domain);
    }
    return porRegiao;
  },
  ['aliases-das-regioes'],
  { tags: [CACHE_TAGS.regions], revalidate: 3600 },
);

/**
 * As regiões ligadas, pela ordem declarada. A RLS já esconde as desligadas.
 *
 * **Propaga.** A lista vazia é o mapa domínio→região vazio, e um mapa vazio
 * quer dizer que nenhum anfitrião é de ninguém: por `regiao-host.ts`, todos os
 * domínios das CIM passam a servir a página do produto. Guardada uma hora, é
 * uma hora com o Coreto a responder a todas as CIM que não as conhece.
 *
 * Também é o `generateStaticParams` do layout, e aí o erro faz o `next build`
 * falhar em vez de pré-gerar só a região principal. É a escolha certa: um
 * build que passa e entrega um deployment sem duas das três regiões é pior do
 * que um build que não passa. Sem credenciais nenhumas continua a devolver
 * vazio, sem erro, que é o mundo do CI e dos forks.
 */
export const listRegioes = unstable_cache(
  async (): Promise<Regiao[]> => {
    const supabase = publicClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('regions')
      .select(COLUNAS_DA_REGIAO)
      .order('sort_order');
    exigirLeitura('listRegioes', error);
    const artigos = await artigosDosPromotores();
    return ((data ?? []) as unknown as LinhaDeRegiao[]).map((linha) =>
      regiaoDaLinha({ ...linha, cim_article: artigos[linha.id] ?? null }),
    );
  },
  ['regioes'],
  { tags: [CACHE_TAGS.regions], revalidate: 3600 },
);

/**
 * A região do segmento, ou a página não existe.
 *
 * É o guarda que cada página do segmento `[regiao]` chama na primeira linha:
 * um identificador que a base não conhece é um endereço que não existe — 404,
 * como as secções desligadas. A exceção é a região principal do deployment num
 * build sem base: aí serve a região de recurso, que é a mesma degradação que o
 * resto da casa pratica — o sítio fica de pé, nunca dá 500 por falta de
 * credenciais.
 */
export async function exigirRegiao(id: string): Promise<Regiao> {
  const regiao = await carregarRegiao(id);
  if (regiao) return regiao;
  if (id === REGIAO_PRINCIPAL) return REGIAO_DE_RECURSO;
  notFound();
}

/**
 * O planeador de transportes públicos que a região declarou (0164), ou `null`.
 *
 * **Uma leitura à parte, e que degrada.** A coluna é nova, e o código chega à
 * produção antes da migração sempre que o deploy corre à frente dela — o que já
 * custou duas publicações (ver `deploy.yml`). Posta em `COLUNAS_DA_REGIAO`, uma
 * coluna em falta fazia o PostgREST recusar a leitura da região inteira, e o
 * domínio inteiro de uma CIM caía por causa de uma ligação de «como chegar».
 * Aqui, sem a coluna, a resposta é a de uma região sem planeador: a ligação
 * não aparece, e o resto da ficha nem dá por isso.
 *
 * Só se aceita `https://`, que é o que a restrição da coluna já garante: o
 * endereço vai parar a um `href` público, e a dupla verificação custa uma
 * expressão regular.
 */
const lerPlaneador = unstable_cache(
  async (id: string): Promise<string | null> => {
    const supabase = publicClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('regions')
      .select('transit_planner_url')
      .eq('id', id)
      .maybeSingle();
    exigirLeitura('planeadorDaRegiao', error);
    const endereco = (data as { transit_planner_url?: string | null } | null)?.transit_planner_url;
    return typeof endereco === 'string' && /^https:\/\/\S+$/.test(endereco) ? endereco : null;
  },
  ['planeador-da-regiao'],
  { tags: [CACHE_TAGS.regions], revalidate: 3600 },
);

export const planeadorDaRegiao = degradarForaDaCache('planeadorDaRegiao', lerPlaneador, () => null);

/**
 * A cor da marca que a região declarou (0167), ou `null`.
 *
 * **Uma leitura à parte, e que degrada, pela razão do planeador acima:** a
 * coluna é nova, e um deploy que corra à frente da migração não pode deitar o
 * domínio de uma CIM abaixo por causa de uma cor. Sem a coluna, a resposta é
 * `null`, e o layout veste o que vestia antes dela — o turquesa da casa, ou o
 * vermelho do produto na demonstração.
 *
 * Só se aceita `#rrggbb`, que é o que a restrição da coluna já garante: o
 * valor vai parar a uma folha de estilos servida, e a dupla verificação custa
 * uma expressão regular.
 */
const lerCor = unstable_cache(
  async (id: string): Promise<string | null> => {
    const supabase = publicClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('regions')
      .select('brand_color')
      .eq('id', id)
      .maybeSingle();
    exigirLeitura('corDaRegiao', error);
    const cor = (data as { brand_color?: string | null } | null)?.brand_color;
    return typeof cor === 'string' && /^#[0-9a-f]{6}$/i.test(cor) ? cor.toLowerCase() : null;
  },
  ['cor-da-regiao'],
  { tags: [CACHE_TAGS.regions], revalidate: 3600 },
);

export const corDaRegiao = degradarForaDaCache('corDaRegiao', lerCor, () => null);

/**
 * A cor do toldo de uma região: a que ela declarou, ou — com a coluna ainda
 * por migrar — a que vestia antes dela: o vermelho do produto na
 * demonstração, o turquesa da casa nas outras.
 */
export async function toldoDaRegiao(regiao: Pick<Regiao, 'id' | 'tipo'>): Promise<string> {
  return (
    (await corDaRegiao(regiao.id)) ?? (regiao.tipo === 'montra' ? COR_POR_OMISSAO : COR_DO_TEMA)
  );
}
