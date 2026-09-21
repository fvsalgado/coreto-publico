import { describe, expect, it } from 'vitest';
import {
  REGIAO_DE_RECURSO,
  comInicialMaiuscula,
  descricaoDoSitio,
  descricaoInstitucional,
  regiaoDaLinha,
  tituloDoSitio,
  urlDoSitio,
  type LinhaDeRegiao,
} from './regiao';

/**
 * A linha do Médio Tejo, tal como a migração 0101 (e a 0104, para o artigo)
 * a semeou — os valores são cópias literais do seed. Este ficheiro é o
 * cadeado da promessa «o sítio não muda um byte»: cada frase que os
 * compositores geram para o Médio Tejo tem de ser exatamente a que estava
 * escrita à mão no código antes de a identidade vir da base.
 */
const LINHA_DO_MEDIO_TEJO: LinhaDeRegiao = {
  id: 'medio-tejo',
  name: 'Médio Tejo',
  article: 'o',
  kind: 'cim',
  cim_name: 'Comunidade Intermunicipal do Médio Tejo',
  cim_url: 'https://mediotejo.pt',
  domain: 'coreto.mediotejo.pt',
  contact_email: 'coreto@mediotejo.pt',
  ical_uid_domain: 'coreto.mediotejo.pt',
  tagline:
    'Tudo o que há para fazer nos onze concelhos do Médio Tejo: música, teatro, exposições, festas, cinema e visitas. Da cidade-sede à aldeia.',
  about_intro:
    'Reúne num sítio só o que já está a acontecer — concertos, teatro, exposições, festas, cinema, visitas — e ocupa o lugar da agenda intermunicipal que deixou de ser atualizada.',
  about_story:
    'Há coretos assim por todo o Médio Tejo: na Várzea Pequena, em Minde, no Jardim da Aranha, em Penhascoso, no Rossio ao Sul do Tejo. Alguns têm mais de cem anos.',
  funding_statement:
    'O Coreto é a agenda cultural dos onze concelhos do Médio Tejo: reúne num sítio só a programação que hoje está espalhada por onze agendas, publica-a em formatos abertos e devolve-a a quem a faz. É promovido pela Comunidade Intermunicipal do Médio Tejo e cofinanciado pelo Portugal 2030, através do programa regional Centro 2030, com o apoio da União Europeia.',
  funding_logo_path: '/logos/medio-tejo/cofinanciamento-centro-2030.png',
  funding_logo_width: 1200,
  funding_logo_height: 138,
  funding_logo_alt:
    'Centro 2030 — Os Fundos Europeus mais próximos de si · Portugal 2030 · Cofinanciado pela União Europeia',
  logo_on_graphite_path: '/logos/medio-tejo/cim-branco.png',
  logo_on_brand_path: '/logos/medio-tejo/cim-escuro.png',
  logo_width: 608,
  logo_height: 159,
  og_image_path: '/og/medio-tejo.png',
  og_image_alt:
    'Coreto de ferro estilizado sobre o turquesa do Médio Tejo, com a frase «A agenda cultural do Médio Tejo» e os nomes dos onze concelhos.',
  data_controller_name: null,
  data_controller_url: null,
  data_controller_nif: null,
  data_controller_address: null,
  data_controller_email: null,
  data_controller_dpo: null,
  data_controller_dpo_contact: null,
  expected_municipality_count: 11,
  bbox_lat_min: 39.3,
  bbox_lat_max: 39.85,
  bbox_lon_min: -8.8,
  bbox_lon_max: -7.8,
  gate_enabled: false,
  destaques_alvo: 12,
};

/**
 * Uma segunda região, com artigo feminino e sem ficheiros — o perfil da CIM
 * que assina contrato numa segunda-feira e ainda não entregou logótipos.
 */
const LINHA_DA_TRAVESSIA: LinhaDeRegiao = {
  id: 'travessia',
  name: 'Travessia do Zêzere',
  article: 'a',
  kind: 'cim',
  cim_name: 'Comunidade Intermunicipal da Travessia do Zêzere',
  cim_url: 'https://travessia.example',
  domain: 'coreto.travessia.example',
  contact_email: 'coreto@travessia.example',
  ical_uid_domain: 'coreto.travessia.example',
  tagline: null,
  about_intro: null,
  about_story: null,
  funding_statement: null,
  funding_logo_path: null,
  funding_logo_width: null,
  funding_logo_height: null,
  funding_logo_alt: null,
  logo_on_graphite_path: null,
  logo_on_brand_path: null,
  logo_width: null,
  logo_height: null,
  og_image_path: null,
  og_image_alt: null,
  data_controller_name: null,
  data_controller_url: null,
  data_controller_nif: null,
  data_controller_address: null,
  data_controller_email: null,
  data_controller_dpo: null,
  data_controller_dpo_contact: null,
  expected_municipality_count: 2,
  bbox_lat_min: 39.85,
  bbox_lat_max: 40.2,
  bbox_lon_min: -8.4,
  bbox_lon_max: -8.0,
  gate_enabled: false,
  destaques_alvo: 12,
};

const mt = regiaoDaLinha(LINHA_DO_MEDIO_TEJO);
const travessia = regiaoDaLinha(LINHA_DA_TRAVESSIA);

describe('regiaoDaLinha', () => {
  it('a barreira só está ligada quando a coluna o diz (0157)', () => {
    // O `=== true` do mapeador, provado pelos dois lados. Uma linha que chegue
    // sem a coluna — de uma cache antiga, de um build a servir com a tabela
    // ainda por migrar — vale «sem barreira»: a degradação certa é servir a
    // agenda, e não tapar uma CIM contratada por causa de um `undefined`.
    expect(mt.barreiraLigada).toBe(false);
    expect(regiaoDaLinha({ ...LINHA_DO_MEDIO_TEJO, gate_enabled: true }).barreiraLigada).toBe(true);

    const semColuna = { ...LINHA_DO_MEDIO_TEJO } as Record<string, unknown>;
    delete semColuna.gate_enabled;
    expect(regiaoDaLinha(semColuna as unknown as LinhaDeRegiao).barreiraLigada).toBe(false);
  });

  it('compõe as contrações do artigo', () => {
    expect(mt.doNome).toBe('do Médio Tejo');
    expect(mt.noNome).toBe('no Médio Tejo');
    expect(travessia.doNome).toBe('da Travessia do Zêzere');
    expect(travessia.noNome).toBe('na Travessia do Zêzere');
  });

  it('escreve a contagem por extenso', () => {
    expect(mt.concelhosPorExtenso).toBe('onze');
    expect(travessia.concelhosPorExtenso).toBe('dois');
  });

  it('monta o promotor completo quando os ficheiros existem', () => {
    expect(mt.promotor).toEqual({
      nome: 'Comunidade Intermunicipal do Médio Tejo',
      url: 'https://mediotejo.pt',
      declaracaoDeFinanciamento: LINHA_DO_MEDIO_TEJO.funding_statement,
      cofinanciamento: {
        ficheiro: '/logos/medio-tejo/cofinanciamento-centro-2030.png',
        largura: 1200,
        altura: 138,
        alt: LINHA_DO_MEDIO_TEJO.funding_logo_alt,
      },
      logotipo: {
        sobreGrafite: '/logos/medio-tejo/cim-branco.png',
        sobreMarca: '/logos/medio-tejo/cim-escuro.png',
        largura: 608,
        altura: 159,
      },
    });
  });

  it('sem ficheiros, o promotor fica em texto — nunca meio logótipo', () => {
    expect(travessia.promotor?.logotipo).toBeNull();
    expect(travessia.promotor?.cofinanciamento).toBeNull();
    expect(travessia.promotor?.declaracaoDeFinanciamento).toBeNull();
  });

  it('sem responsável declarado, quem responde pelo tratamento é a CIM', () => {
    expect(mt.responsavelPeloTratamento).toEqual({
      nome: 'Comunidade Intermunicipal do Médio Tejo',
      url: 'https://mediotejo.pt',
      nif: null,
      morada: null,
      email: null,
      epd: null,
      epdContacto: null,
    });
  });

  it('um responsável sem sítio próprio não empresta o endereço da CIM', () => {
    /*
     * O defeito que a 0158 fechou, e que ninguém via porque exigia duas
     * condições ao mesmo tempo: responsável declarado E sem endereço. As duas
     * omissões eram independentes — `data_controller_name ?? cim_name` de um
     * lado, `data_controller_url ?? cim_url` do outro —, e juntas publicavam o
     * nome de uma pessoa com uma ligação para o sítio de uma comunidade
     * intermunicipal. Uma terceira entidade, que não existe.
     */
    const pessoa = regiaoDaLinha({
      ...LINHA_DO_MEDIO_TEJO,
      data_controller_name: 'Fulana de Tal',
      data_controller_url: null,
    });
    expect(pessoa.responsavelPeloTratamento).toEqual({
      nome: 'Fulana de Tal',
      url: null,
      nif: null,
      morada: null,
      email: null,
      epd: null,
      epdContacto: null,
    });
  });

  it('declarado o responsável, é dele tudo o que a política mostra', () => {
    const proprio = regiaoDaLinha({
      ...LINHA_DO_MEDIO_TEJO,
      data_controller_name: 'CIM do Médio Tejo',
      data_controller_url: 'https://exemplo.pt',
      data_controller_nif: '508000000',
      data_controller_address: 'Rua de Exemplo, 1\n2300-000 Tomar',
      data_controller_email: 'dados@exemplo.pt',
      data_controller_dpo: 'Encarregada de Exemplo',
      data_controller_dpo_contact: 'epd@exemplo.pt',
    });
    expect(proprio.responsavelPeloTratamento).toEqual({
      nome: 'CIM do Médio Tejo',
      url: 'https://exemplo.pt',
      nif: '508000000',
      morada: 'Rua de Exemplo, 1\n2300-000 Tomar',
      email: 'dados@exemplo.pt',
      epd: 'Encarregada de Exemplo',
      epdContacto: 'epd@exemplo.pt',
    });
  });
});

describe('os compositores reproduzem o Médio Tejo letra a letra', () => {
  it('o título do sítio', () => {
    expect(tituloDoSitio(mt)).toBe('Coreto — a agenda cultural do Médio Tejo');
  });

  it('a descrição dos metadados é a tagline', () => {
    expect(descricaoDoSitio(mt)).toBe(
      'Tudo o que há para fazer nos onze concelhos do Médio Tejo: música, teatro, exposições, festas, cinema e visitas. Da cidade-sede à aldeia.',
    );
  });

  it('sem tagline, a frase gerada é a mesma que o seed guardou', () => {
    // É a prova de que a tagline do Médio Tejo é a frase do produto com a
    // região interpolada — o gerador e o seed não podem divergir em silêncio.
    expect(descricaoDoSitio({ ...mt, tagline: null })).toBe(descricaoDoSitio(mt));
  });

  it('a frase institucional', () => {
    expect(descricaoInstitucional(mt)).toBe(
      'A agenda cultural dos onze concelhos da Comunidade Intermunicipal do Médio Tejo.',
    );
  });
});

describe('uma segunda região não deixa fugir o Médio Tejo', () => {
  it('nenhuma frase da Travessia menciona a primeira região', () => {
    const frases = [
      tituloDoSitio(travessia),
      descricaoDoSitio(travessia),
      descricaoInstitucional(travessia),
    ];
    for (const frase of frases) {
      expect(frase).not.toContain('Médio Tejo');
      expect(frase).not.toContain('mediotejo');
      expect(frase).not.toContain('onze');
    }
  });

  it('as frases geradas dizem a Travessia como deve ser', () => {
    expect(tituloDoSitio(travessia)).toBe('Coreto — a agenda cultural da Travessia do Zêzere');
    expect(descricaoDoSitio(travessia)).toBe(
      'Tudo o que há para fazer nos dois concelhos da Travessia do Zêzere: música, teatro, exposições, festas, cinema e visitas. Da cidade-sede à aldeia.',
    );
    expect(descricaoInstitucional(travessia)).toBe(
      'A agenda cultural dos dois concelhos da Comunidade Intermunicipal da Travessia do Zêzere.',
    );
  });
});

describe('a região de recurso aguenta um build sem base', () => {
  it('tem frases inteiras e nenhum «zero»', () => {
    expect(tituloDoSitio(REGIAO_DE_RECURSO)).toBe('Coreto — a agenda cultural da região');
    expect(descricaoDoSitio(REGIAO_DE_RECURSO)).toBe('A agenda cultural da região.');
    expect(descricaoInstitucional(REGIAO_DE_RECURSO)).toBe('A agenda cultural da região.');
    expect(descricaoInstitucional(REGIAO_DE_RECURSO)).not.toContain('zero');
  });

  it('não tem promotor, e isso é deliberado', () => {
    expect(REGIAO_DE_RECURSO.promotor).toBeNull();
  });
});

describe('o tipo da região', () => {
  it('a montra declara-se pela coluna, e o que não se conhece vale cim', () => {
    // A tabela pode ir à frente do código num deploy: um tipo novo que este
    // build não sabe desenhar degrada para a agenda, nunca para um erro.
    expect(regiaoDaLinha({ ...LINHA_DO_MEDIO_TEJO, kind: 'montra' }).tipo).toBe('montra');
    expect(regiaoDaLinha(LINHA_DO_MEDIO_TEJO).tipo).toBe('cim');
    expect(regiaoDaLinha({ ...LINHA_DO_MEDIO_TEJO, kind: 'vitrine' }).tipo).toBe('cim');
  });
});

describe('comInicialMaiuscula', () => {
  it('sobe a primeira letra e não toca no resto', () => {
    expect(comInicialMaiuscula('onze')).toBe('Onze');
    expect(comInicialMaiuscula('')).toBe('');
  });
});

describe('urlDoSitio: cada região descreve-se pelo domínio que tem', () => {
  const SITE_URL = 'https://coreto.org';

  it('uma região com domínio anuncia esse domínio, e não o do deployment', () => {
    const regiao = regiaoDaLinha({ ...LINHA_DO_MEDIO_TEJO, domain: 'mediotejo.coreto.org' });
    expect(urlDoSitio(regiao, SITE_URL)).toBe('https://mediotejo.coreto.org');
  });

  /*
   * O caso que motivou a mudança, e que vale a pena ficar preso.
   *
   * A regra antiga tinha um ramo para a «região principal do deployment»: ela
   * herdava o `SITE_URL` mesmo tendo domínio próprio. Era certo enquanto o
   * `SITE_URL` fosse o endereço onde essa região respondia. Deixou de ser: o
   * `coreto.org` passou a ser a ficha técnica do produto, que não é de região
   * nenhuma. Com o ramo antigo, a região principal anunciava a ficha técnica
   * como canónico das suas páginas todas — e um canónico errado tira do
   * índice as páginas certas.
   */
  it('nem a região principal do deployment reclama o endereço da ficha técnica', () => {
    const regiao = regiaoDaLinha({ ...LINHA_DO_MEDIO_TEJO, domain: 'mediotejo.coreto.org' });
    expect(urlDoSitio(regiao, SITE_URL)).not.toBe(SITE_URL);
  });

  it('sem domínio na base sobra a identidade do deployment, que é por onde se responde', () => {
    // Vazio, e não `null`: é assim que a `REGIAO_DE_RECURSO` representa «sem
    // domínio», e o tipo da linha não admite nulo.
    const regiao = regiaoDaLinha({ ...LINHA_DO_MEDIO_TEJO, domain: '' });
    expect(urlDoSitio(regiao, SITE_URL)).toBe(SITE_URL);
  });
});
