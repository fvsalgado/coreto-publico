import { numeroPorExtenso } from '@coreto/core';
import { PRODUTO } from './produto';

/**
 * A identidade de uma região, tal como o código a usa.
 *
 * A verdade vive na tabela `regions` (migração 0101); este módulo é a
 * tradução dela para o vocabulário da casa — sem uma letra regional escrita
 * aqui. É deliberadamente puro: quem lê a base é `queries/regioes.ts`, e por
 * isso tudo o que aqui está tem teste sem tocar em rede nenhuma.
 *
 * Duas decisões de gramática que o modelo de dados carrega:
 *
 * 1. O artigo. «**do** Médio Tejo», mas «**da** Lezíria do Tejo» e «**das**
 *    Terras de Trás-os-Montes» — a prosa precisa das contrações `de`+artigo e
 *    `em`+artigo, e nenhuma heurística acerta nos topónimos portugueses. A
 *    região declara o artigo (coluna `article`, migração 0104) e as formas
 *    compostas ficam pré-calculadas no objeto (`doNome`, `noNome`).
 *
 * 2. O promotor é uma CIM, e a prosa assume o feminino de «Comunidade» —
 *    «promovido pela …», «a agenda dos N concelhos da …». Todas as entidades
 *    plausíveis deste produto (Comunidade Intermunicipal, Área Metropolitana,
 *    Associação de Municípios) são femininas; se um dia o promotor puder ser
 *    «um Município», o artigo do promotor passa a coluna, como o do nome.
 */

export type ArtigoDeRegiao = 'o' | 'a' | 'os' | 'as';

/**
 * O que uma região é: uma CIM com a sua agenda, ou a montra do produto —
 * que na entrada mostra a página do Coreto e no resto a demonstração.
 * Vem da coluna `kind` (0113) e muda por migração, nunca pelo painel.
 */
export type TipoDeRegiao = 'cim' | 'montra';

const DE_MAIS_ARTIGO: Record<ArtigoDeRegiao, string> = { o: 'do', a: 'da', os: 'dos', as: 'das' };
const EM_MAIS_ARTIGO: Record<ArtigoDeRegiao, string> = { o: 'no', a: 'na', os: 'nos', as: 'nas' };

/** As duas tintas da marca do promotor — ver o comentário em `RodapeDoSitio`. */
export interface LogotipoDoPromotor {
  /** A versão a branco, para o bloco grafite do rodapé e de `/informacoes`. */
  sobreGrafite: string;
  /** A mesma máscara com a tinta escura, para o toldo do cabeçalho. */
  sobreMarca: string;
  largura: number;
  altura: number;
}

/** A tira de marcas do cofinanciamento, quando a região o tem. */
export interface Cofinanciamento {
  ficheiro: string;
  largura: number;
  altura: number;
  alt: string;
}

/**
 * Quem promove a região. É a forma que `PROMOTOR` tinha quando era uma
 * constante do Médio Tejo — os componentes leem os mesmos campos, agora
 * vindos da linha da região.
 */
export interface PromotorDaRegiao {
  nome: string;
  url: string;
  /**
   * A menção da operação e de quem a financia (artigo 50.º do Regulamento
   * (UE) 2021/1060). Nula quando a região não é cofinanciada — e sem ela o
   * bloco de financiamento não se desenha em lado nenhum.
   */
  declaracaoDeFinanciamento: string | null;
  cofinanciamento: Cofinanciamento | null;
  /** Nulo quando a região ainda não entregou ficheiros: a assinatura é texto. */
  logotipo: LogotipoDoPromotor | null;
}

export interface Regiao {
  id: string;
  /**
   * Se esta região está atrás de uma barreira de senha (0157).
   *
   * Público de propósito — a página que pede a senha anuncia-o na mesma a
   * quem lá bate. A senha não está aqui nem em lado nenhum que o `anon` leia:
   * está em `region_gates`, com as concessões revogadas.
   */
  barreiraLigada: boolean;
  /** «Médio Tejo» — o nome seco, sem artigo. */
  nome: string;
  artigo: ArtigoDeRegiao;
  tipo: TipoDeRegiao;
  /** «do Médio Tejo», «da Lezíria do Tejo» — para «a agenda cultural …». */
  doNome: string;
  /** «no Médio Tejo», «na Lezíria do Tejo» — para «o que acontece …». */
  noNome: string;
  dominio: string;
  email: string;
  /**
   * O espaço de nomes permanente dos UID do iCal. Nunca muda depois de haver
   * subscritores — ver o comentário da coluna na migração 0101.
   */
  dominioDosUid: string;
  tagline: string | null;
  aboutIntro: string | null;
  aboutStory: string | null;
  /** Nulo apenas na região de recurso: uma linha real tem sempre CIM. */
  promotor: PromotorDaRegiao | null;
  ogImage: { caminho: string; alt: string } | null;
  /** RGPD: quem responde pelo tratamento. Sem coluna própria, é a CIM. */
  responsavelPeloTratamento: ResponsavelPeloTratamento | null;
  /** A contagem que a própria região declara — a mesma das schema-checks. */
  concelhosDeclarados: number;
  /** A contagem por extenso: «onze». Pré-calculada porque a prosa a usa muito. */
  concelhosPorExtenso: string;
  bbox: { latMin: number; latMax: number; lonMin: number; lonMax: number };
}

/**
 * Quem responde pelos dados pessoais de uma agenda, e como se contacta.
 *
 * Nasceu com duas linhas — um nome e um endereço web — porque o caso previsto
 * era uma CIM, que tem sítio próprio. A 0158 acrescentou o resto do que o
 * `docs/RGPD.md` pede e o `docs/LICENCIAR.md` classifica como o que impede
 * assinar: o NIF, a morada, o contacto para direitos, e o encarregado de
 * proteção de dados — que **não é opcional** quando quem responde é uma
 * autoridade pública (RGPD, artigo 37.º, n.º 1, alínea a)), e cujo contacto o
 * n.º 7 do mesmo artigo manda publicar.
 *
 * Tudo anulável menos o nome: uma região com responsável declarado e o resto
 * por preencher mostra o que tem, e o que não tem não se inventa.
 */
export interface ResponsavelPeloTratamento {
  nome: string;
  /** `null` quando quem responde não tem sítio próprio — uma pessoa, por exemplo. */
  url: string | null;
  nif: string | null;
  morada: string | null;
  /** O contacto para o exercício de direitos; a nulo, vale o email da região. */
  email: string | null;
  epd: string | null;
  epdContacto: string | null;
}

/** Uma linha de `public.regions`, com os nomes das colunas. */
export interface LinhaDeRegiao {
  id: string;
  name: string;
  article: string;
  kind: string;
  cim_name: string;
  cim_url: string;
  domain: string;
  contact_email: string;
  ical_uid_domain: string;
  tagline: string | null;
  about_intro: string | null;
  about_story: string | null;
  funding_statement: string | null;
  funding_logo_path: string | null;
  funding_logo_width: number | null;
  funding_logo_height: number | null;
  funding_logo_alt: string | null;
  logo_on_graphite_path: string | null;
  logo_on_brand_path: string | null;
  logo_width: number | null;
  logo_height: number | null;
  og_image_path: string | null;
  og_image_alt: string | null;
  data_controller_name: string | null;
  data_controller_url: string | null;
  /** 0158 — o resto do que o RGPD pede sobre quem responde. */
  data_controller_nif: string | null;
  data_controller_address: string | null;
  data_controller_email: string | null;
  data_controller_dpo: string | null;
  data_controller_dpo_contact: string | null;
  expected_municipality_count: number;
  bbox_lat_min: number;
  bbox_lat_max: number;
  bbox_lon_min: number;
  bbox_lon_max: number;
  /** 0157 — se esta região está atrás de uma barreira de senha. */
  gate_enabled: boolean;
}

function artigoValido(article: string): ArtigoDeRegiao {
  return article === 'a' || article === 'os' || article === 'as' ? article : 'o';
}

// Um valor que este build não conhece vale «cim»: a tabela pode ir à frente
// do código num deploy, e a degradação certa é servir a agenda, não partir.
function tipoValido(kind: string): TipoDeRegiao {
  return kind === 'montra' ? 'montra' : 'cim';
}

/**
 * «do Médio Tejo», «da Travessia do Zêzere» — a contração `de`+artigo para
 * quem leu só duas colunas da região em vez da linha inteira (o intake, que
 * quer uma frase e não um objeto). `regiaoDaLinha` passa por aqui, para as
 * duas formas nunca divergirem.
 */
export function doNomeDaRegiao(article: string, nome: string): string {
  return `${DE_MAIS_ARTIGO[artigoValido(article)]} ${nome}`;
}

/** Traduz uma linha da base para o vocabulário da casa. */
export function regiaoDaLinha(linha: LinhaDeRegiao): Regiao {
  const artigo = artigoValido(linha.article);
  // Uma coluna que este build não conhece vale «sem barreira»: a tabela pode
  // ir à frente do código num deploy, e a degradação certa é servir a agenda.
  // O contrário — tapar uma região por causa de um `undefined` — tirava do ar
  // uma CIM contratada por causa de uma ordem de deploy.
  const barreiraLigada = linha.gate_enabled === true;

  const logotipo: LogotipoDoPromotor | null =
    linha.logo_on_graphite_path !== null &&
    linha.logo_on_brand_path !== null &&
    linha.logo_width !== null &&
    linha.logo_height !== null
      ? {
          sobreGrafite: linha.logo_on_graphite_path,
          sobreMarca: linha.logo_on_brand_path,
          largura: linha.logo_width,
          altura: linha.logo_height,
        }
      : null;

  const cofinanciamento: Cofinanciamento | null =
    linha.funding_logo_path !== null &&
    linha.funding_logo_width !== null &&
    linha.funding_logo_height !== null &&
    linha.funding_logo_alt !== null
      ? {
          ficheiro: linha.funding_logo_path,
          largura: linha.funding_logo_width,
          altura: linha.funding_logo_height,
          alt: linha.funding_logo_alt,
        }
      : null;

  return {
    id: linha.id,
    barreiraLigada,
    nome: linha.name,
    artigo,
    tipo: tipoValido(linha.kind),
    doNome: doNomeDaRegiao(artigo, linha.name),
    noNome: `${EM_MAIS_ARTIGO[artigo]} ${linha.name}`,
    dominio: linha.domain,
    email: linha.contact_email,
    dominioDosUid: linha.ical_uid_domain,
    tagline: linha.tagline,
    aboutIntro: linha.about_intro,
    aboutStory: linha.about_story,
    promotor: {
      nome: linha.cim_name,
      url: linha.cim_url,
      declaracaoDeFinanciamento: linha.funding_statement,
      cofinanciamento,
      logotipo,
    },
    ogImage:
      linha.og_image_path !== null
        ? { caminho: linha.og_image_path, alt: linha.og_image_alt ?? linha.name }
        : null,
    /*
     * O nome e o endereço viajam **juntos**, e antes não viajavam.
     *
     * Cada um caía na omissão por sua conta: `data_controller_name ??
     * cim_name` e `data_controller_url ?? cim_url`. Bastava declarar o
     * responsável e não ter sítio próprio — uma pessoa singular, que é
     * exatamente o caso da região de montra — para a política de privacidade
     * publicar o **nome dessa pessoa com uma ligação para o sítio da CIM**.
     * Duas omissões independentes a produzir uma terceira entidade que não
     * existe.
     *
     * Agora a decisão é uma só: ou a região declara quem responde, e então é
     * dela tudo o que se mostra — inclusive não ter endereço —, ou não declara
     * nada e vale a CIM inteira, como desde a 0101.
     */
    responsavelPeloTratamento:
      linha.data_controller_name !== null
        ? {
            nome: linha.data_controller_name,
            url: linha.data_controller_url,
            nif: linha.data_controller_nif,
            morada: linha.data_controller_address,
            email: linha.data_controller_email,
            epd: linha.data_controller_dpo,
            epdContacto: linha.data_controller_dpo_contact,
          }
        : {
            nome: linha.cim_name,
            url: linha.cim_url,
            nif: null,
            morada: null,
            email: null,
            epd: null,
            epdContacto: null,
          },
    concelhosDeclarados: linha.expected_municipality_count,
    concelhosPorExtenso: numeroPorExtenso(linha.expected_municipality_count),
    bbox: {
      latMin: linha.bbox_lat_min,
      latMax: linha.bbox_lat_max,
      lonMin: linha.bbox_lon_min,
      lonMax: linha.bbox_lon_max,
    },
  };
}

/**
 * O que o sítio diz quando não consegue dizer nenhuma região.
 *
 * É o degrau de degradação de um build sem base de dados — o mesmo em que
 * `listMunicipalities()` devolve vazio. Nunca serve tráfego real: serve o CI
 * e um `next build` sem credenciais. Não tem promotor porque ninguém promove
 * uma região de recurso, e os componentes têm de aguentar isso.
 */
export const REGIAO_DE_RECURSO: Regiao = {
  id: 'recurso',
  barreiraLigada: false,
  nome: 'região',
  artigo: 'a',
  tipo: 'cim',
  doNome: 'da região',
  noNome: 'na região',
  dominio: '',
  email: '',
  dominioDosUid: '',
  tagline: 'A agenda cultural da região.',
  aboutIntro: null,
  aboutStory: null,
  promotor: null,
  ogImage: null,
  responsavelPeloTratamento: null,
  concelhosDeclarados: 0,
  concelhosPorExtenso: '',
  bbox: { latMin: 0, latMax: 0, lonMin: 0, lonMax: 0 },
};

/** «Coreto — a agenda cultural do Médio Tejo»: o título do sítio. */
export function tituloDoSitio(regiao: Regiao): string {
  return `${PRODUTO.nome} — a agenda cultural ${regiao.doNome}`;
}

/**
 * A descrição dos metadados, inteira e tal como se lê.
 *
 * Quando a região escreveu a sua (`tagline`), é essa; sem texto, compõe-se a
 * frase do produto com a região interpolada — e para o Médio Tejo as duas
 * são a mesma, letra a letra, o que `regiao.test.ts` prova.
 */
export function descricaoDoSitio(regiao: Regiao): string {
  if (regiao.tagline !== null) return regiao.tagline;
  return (
    `Tudo o que há para fazer nos ${regiao.concelhosPorExtenso} concelhos ` +
    `${regiao.doNome}: música, teatro, exposições, festas, cinema e visitas. ` +
    'Da cidade-sede à aldeia.'
  );
}

/**
 * «A agenda cultural dos onze concelhos da Comunidade Intermunicipal do
 * Médio Tejo.» — a frase institucional do rodapé e do JSON-LD do sítio.
 */
export function descricaoInstitucional(regiao: Regiao): string {
  if (regiao.promotor === null || regiao.concelhosDeclarados === 0) {
    return `A agenda cultural ${regiao.doNome}.`;
  }
  return (
    `A agenda cultural dos ${regiao.concelhosPorExtenso} concelhos ` + `da ${regiao.promotor.nome}.`
  );
}

/** «onze» → «Onze», para a única frase que começa pela contagem. */
export function comInicialMaiuscula(texto: string): string {
  return texto.length === 0 ? texto : texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * A origem pública de uma região — a base dos canónicos, dos feeds, do
 * sitemap e do widget dela.
 *
 * **Uma região com domínio descreve-se por ele.** É o que a torna alcançável:
 * um pedido que chegou à Travessia chegou por `coreto.travessia.example`,
 * logo esse domínio existe e resolve. Sem domínio na base não há por onde,
 * e sobra a identidade do deployment (`SITE_URL`, com a escada do `env.ts`).
 *
 * **Aqui houve um ramo a mais, e valeu a pena tirá-lo.** A região principal
 * do deployment herdava o `SITE_URL` mesmo tendo domínio próprio. A razão era
 * boa quando foi escrita — evitava anunciar como canónico um domínio que
 * ainda não resolvia, enquanto o Médio Tejo só respondia no endereço do
 * deployment. Deixou de ser: o `mediotejo.coreto.org` resolve, e o
 * `SITE_URL` deste deployment passou a ser o `coreto.org`, que não é de
 * região nenhuma — é a página do produto. Com o ramo antigo, a região
 * principal anunciava a ficha técnica como canónico das suas páginas todas.
 *
 * A lição é a do costume nesta casa: uma condição escrita para um estado
 * transitório tem de sair quando o estado passa, senão passa a mentir com a
 * autoridade de quem já esteve certo.
 */
export function urlDoSitio(regiao: Regiao, siteUrlDoDeployment: string): string {
  return regiao.dominio ? `https://${regiao.dominio}` : siteUrlDoDeployment;
}
