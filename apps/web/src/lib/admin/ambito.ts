import 'server-only';
import { cookies } from 'next/headers';
import { exigirLeitura } from '../queries/falhas';
import { REGIAO_PRINCIPAL } from '../regiao-host';
import { requireAdminClient } from '../supabase/server';
import { exigirSessao } from './auth';
import { pode, type Papel, type Sessao } from './papeis';
import { listRegionsAdmin, type RegionAdminRow } from './queries';

/**
 * O recorte por região do painel (C4-015): o que cada página mostra, e de que
 * região é cada coisa em que uma ação vai mexer.
 *
 * **Duas perguntas diferentes, e as duas vivem aqui.**
 *
 * - *O que mostrar?* — `ambitoDoPainel()`: as regiões que a sessão pode ver,
 *   a que está escolhida no seletor do cabeçalho, e os concelhos delas. As
 *   páginas passam isto às leituras, que recortam na base.
 * - *Posso mexer nisto?* — `regiaoDa…()`: a região de uma submissão, de um
 *   evento, de uma fonte, de um espaço. As ações perguntam-na **antes** de
 *   escrever, e a resposta vem da base, nunca do formulário — o formulário é
 *   de quem o envia.
 *
 * O recorte não precisa de coluna nova nenhuma, e é de propósito: onde a base
 * já dá `region_id` (regiões, concelhos, fontes, submissões, ciclos) é um
 * `in`; onde não dá (eventos, espaços) recorta-se pelo concelho, como
 * `listVenuesDeTodas` já fazia. O `docs/plano/07-painel.md` §2 deixou escrito
 * que não se acrescenta `region_id` a `events`.
 */

export const COOKIE_DA_REGIAO = 'coreto_admin_regiao';

/** O valor do seletor que quer dizer «todas as que esta sessão vê». */
export const TODAS = 'todas';

export interface Ambito {
  sessao: Sessao;
  /** As regiões que esta sessão pode ver, pela ordem das listas. */
  disponiveis: RegionAdminRow[];
  /** A região escolhida no seletor, ou `null` para «todas». */
  escolhida: RegionAdminRow | null;
  /**
   * O recorte que as leituras aplicam: `null` é «sem recorte» — o dono, em
   * «todas», que também vê o que não tem região. Uma lista é um recorte, e
   * uma lista vazia recorta tudo (uma pessoa ainda sem papel nenhum).
   */
  regioes: string[] | null;
  /** Os concelhos dessas regiões, com o mesmo significado do `null`. */
  concelhos: string[] | null;
  /** O nome de cada concelho e a região dele, para não se mostrar slugs. */
  nomeDoConcelho: ReadonlyMap<string, string>;
  regiaoDoConcelho: ReadonlyMap<string, string>;
}

/**
 * O recorte deste pedido.
 *
 * `minimo` é o papel que a página pede: as da moderação pedem editor, as das
 * definições pedem gestor. Uma pessoa com papel de editor numa região e de
 * gestor noutra vê, nas definições, só a segunda.
 *
 * A escolha vem do `?regiao=` da barra (para uma ligação poder levar a uma
 * região), e senão do cookie do seletor. Sem nenhum dos dois, **uma região, e
 * não todas**: a principal se a sessão a vê, senão a primeira — um painel que
 * abre a misturar a demonstração com a agenda a sério não distingue uma
 * melhoria de um artefacto (`docs/plano/07-painel.md` §2).
 */
export async function ambitoDoPainel(
  opcoes: { minimo?: Papel; pedida?: string | null } = {},
): Promise<Ambito> {
  const minimo = opcoes.minimo ?? 'editor';
  const sessao = await exigirSessao();
  const [regioes, concelhos, guardada] = await Promise.all([
    listRegionsAdmin(),
    concelhosDeTodas(),
    cookies().then((store) => store.get(COOKIE_DA_REGIAO)?.value ?? null),
  ]);

  const disponiveis = regioes.filter((regiao) => pode(sessao, regiao.id, minimo));
  const pedida = opcoes.pedida ?? guardada;
  const escolhida =
    pedida === TODAS
      ? null
      : (disponiveis.find((regiao) => regiao.id === pedida) ??
        disponiveis.find((regiao) => regiao.id === REGIAO_PRINCIPAL) ??
        disponiveis[0] ??
        null);

  const nomeDoConcelho = new Map(concelhos.map((concelho) => [concelho.id, concelho.name]));
  const regiaoDoConcelho = new Map(concelhos.map((concelho) => [concelho.id, concelho.region_id]));

  // O dono em «todas» não recorta nada. Qualquer outra coisa recorta.
  const semRecorte = sessao.tipo === 'dono' && escolhida === null;
  const idsDasRegioes = escolhida ? [escolhida.id] : disponiveis.map((regiao) => regiao.id);

  return {
    sessao,
    disponiveis,
    escolhida,
    regioes: semRecorte ? null : idsDasRegioes,
    concelhos: semRecorte
      ? null
      : concelhos
          .filter((concelho) => idsDasRegioes.includes(concelho.region_id))
          .map((concelho) => concelho.id),
    nomeDoConcelho,
    regiaoDoConcelho,
  };
}

/**
 * Os concelhos de todas as regiões, lidos agora pela chave de serviço.
 *
 * Não pela leitura pública (`listMunicipalitiesDeTodas`), que se guarda uma
 * hora: um concelho que nasceu há dez minutos ficava fora do recorte de quem o
 * modera até a cache expirar — fechado, que é o lado certo para errar, mas
 * errado na mesma. Como tudo o que o painel lê, sem cache.
 */
async function concelhosDeTodas(): Promise<Array<{ id: string; name: string; region_id: string }>> {
  const { data, error } = await requireAdminClient()
    .from('municipalities')
    .select('id, name, region_id')
    .order('sort_order');
  exigirLeitura('concelhosDeTodas', error);
  return (data ?? []) as Array<{ id: string; name: string; region_id: string }>;
}

/** Se uma coisa com este concelho (ou região) cabe no recorte. */
export function cabeNoAmbito(
  ambito: Pick<Ambito, 'regioes' | 'regiaoDoConcelho'>,
  coisa: { region_id?: string | null; municipality_id?: string | null },
): boolean {
  if (ambito.regioes === null) return true;
  const regiao =
    coisa.region_id ??
    (coisa.municipality_id ? ambito.regiaoDoConcelho.get(coisa.municipality_id) : undefined);
  return regiao !== undefined && ambito.regioes.includes(regiao);
}

/* ------------------------------------------------------ de quem é cada coisa */

/** A região de um concelho, lida da base agora — ou `null`. */
export async function regiaoDoConcelho(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const { data, error } = await requireAdminClient()
    .from('municipalities')
    .select('region_id')
    .eq('id', id)
    .maybeSingle();
  exigirLeitura('regiaoDoConcelho', error);
  return (data as { region_id: string } | null)?.region_id ?? null;
}

/**
 * A região de uma submissão: a que o email declarou (`region_id`), ou a do
 * concelho. Uma submissão sem nenhuma das duas não é de região nenhuma — só o
 * dono a vê, e só ele a decide.
 */
export async function regiaoDaSubmissao(id: string): Promise<string | null> {
  const { data, error } = await requireAdminClient()
    .from('submissions')
    .select('region_id, municipality_id')
    .eq('id', id)
    .maybeSingle();
  exigirLeitura('regiaoDaSubmissao', error);
  const linha = data as { region_id: string | null; municipality_id: string | null } | null;
  if (!linha) return null;
  return linha.region_id ?? (await regiaoDoConcelho(linha.municipality_id));
}

/** As regiões de uma lista de eventos, pela ordem dos ids; `null` onde não há evento. */
export async function regioesDosEventos(ids: readonly string[]): Promise<Array<string | null>> {
  if (ids.length === 0) return [];
  const { data, error } = await requireAdminClient()
    .from('events')
    .select('id, municipalities(region_id)')
    .in('id', [...ids]);
  exigirLeitura('regioesDosEventos', error);
  type Linha = {
    id: string;
    municipalities: { region_id: string } | { region_id: string }[] | null;
  };
  const porId = new Map(
    ((data ?? []) as unknown as Linha[]).map((linha) => {
      const concelho = Array.isArray(linha.municipalities)
        ? linha.municipalities[0]
        : linha.municipalities;
      return [linha.id, concelho?.region_id ?? null] as const;
    }),
  );
  return ids.map((id) => porId.get(id) ?? null);
}

export async function regiaoDoEvento(id: string): Promise<string | null> {
  const [regiao] = await regioesDosEventos([id]);
  return regiao ?? null;
}

/** A região de uma fonte: a que ela declara, ou a do concelho dela. */
export async function regiaoDaFonte(id: string): Promise<string | null> {
  const { data, error } = await requireAdminClient()
    .from('sources')
    .select('region_id, municipality_id')
    .eq('id', id)
    .maybeSingle();
  exigirLeitura('regiaoDaFonte', error);
  const linha = data as { region_id: string | null; municipality_id: string | null } | null;
  if (!linha) return null;
  return linha.region_id ?? (await regiaoDoConcelho(linha.municipality_id));
}

/** A região de um espaço, pelo concelho dele. */
export async function regiaoDoEspaco(id: string): Promise<string | null> {
  const { data, error } = await requireAdminClient()
    .from('venues')
    .select('municipality_id')
    .eq('id', id)
    .maybeSingle();
  exigirLeitura('regiaoDoEspaco', error);
  return regiaoDoConcelho((data as { municipality_id: string } | null)?.municipality_id);
}
