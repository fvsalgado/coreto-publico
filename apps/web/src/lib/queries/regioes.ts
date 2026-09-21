import 'server-only';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import { REGIAO_DE_RECURSO, regiaoDaLinha, type LinhaDeRegiao, type Regiao } from '../regiao';
import { REGIAO_PRINCIPAL } from '../regiao-host';
import { publicClient } from '../supabase/server';
import { CACHE_TAGS } from './events';
import { exigirLeitura } from './falhas';

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
    return data ? regiaoDaLinha(data as unknown as LinhaDeRegiao) : null;
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
    return ((data ?? []) as unknown as LinhaDeRegiao[]).map(regiaoDaLinha);
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
