import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O botão «Actualizar o sítio agora» tem duas promessas, e as duas partem-se
 * em silêncio.
 *
 * A primeira é que exige sessão: a acção não recebe formulário nenhum, e uma
 * acção de servidor é um endereço que responde a quem lhe bata. Sem a guarda,
 * qualquer visitante podia descartar a cache do sítio a pedido — não apagaria
 * dados, mas obrigaria a base a servir tudo outra vez, tantas vezes quantas
 * quisesse.
 *
 * A segunda é que limpa **tudo** o que é público. A lista de etiquetas está
 * escrita à mão na acção, e uma etiqueta nova em `CACHE_TAGS` que se esqueça
 * aqui dá o pior desfecho possível: a pessoa carrega no botão, o sítio diz que
 * actualizou, e uma parte continua velha. O teste percorre o `CACHE_TAGS` real
 * — não uma cópia — para que a próxima etiqueta que nasça obrigue a decidir.
 *
 * As ações da fila de espaços (`ligarSitio`, `porSitioDeLado`) e a que faz
 * nascer uma região (`criarRegiao`) testam-se a seguir com a mesma armação: o
 * que se verifica é que chamam a função certa da base, com os argumentos
 * certos, e que descartam o que têm de descartar — a função em si prova-se
 * nas schema-checks, contra um Postgres a sério.
 */

const revalidateTag = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const requireAdmin = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const eventoPeloEndereco = vi.hoisted(() => vi.fn());
const getPropostaDaSubmissao = vi.hoisted(() => vi.fn());
const proximaSubmissao = vi.hoisted(() => vi.fn());
const lerEventoResumido = vi.hoisted(() => vi.fn());
const listRegionsAdmin = vi.hoisted(() => vi.fn());
const ambitoDoPainel = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
);

// O `unstable_cache` entra porque o módulo das consultas o chama ao carregar,
// para construir as suas funções. Aqui devolve a função tal e qual: o que se
// está a testar é quem invalida, não quem guarda.
vi.mock('next/cache', () => ({
  revalidateTag,
  revalidatePath,
  unstable_cache: <T>(fn: T) => fn,
}));
vi.mock('next/navigation', () => ({ redirect }));
/*
 * As guardas por papel (`exigirDono`, `exigirPapel`, `exigirPapelNas`) são
 * aqui a sessão do dono, que pode tudo: estes testes são do que cada ação
 * escreve. O que cada papel pode prova-se em `papeis.test.ts` e em
 * `auth.test.ts`, e a recusa de uma região alheia no ensaio contra a base.
 * Sem sessão, todas rebentam — como o `requireAdmin` que já cá estava.
 */
vi.mock('./auth', () => {
  const sessaoDoDono = async () => ({ tipo: 'dono' as const, actor: await requireAdmin() });
  return {
    requireAdmin,
    exigirSessao: sessaoDoDono,
    exigirDono: sessaoDoDono,
    exigirPapel: sessaoDoDono,
    exigirPapelNas: sessaoDoDono,
  };
});
// Da chave de serviço só se usa o `rpc`: é o único caminho de escrita que as
// ações conhecem, e a regra da casa é que continue a sê-lo.
vi.mock('../supabase/server', () => ({ requireAdminClient: () => ({ rpc }) }));
// As duas leituras que a recusa e a fusão fazem antes de escrever: o endereço
// colado por quem modera e a proposta guardada. O resto do módulo é o real.
vi.mock('./queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./queries')>()),
  eventoPeloEndereco,
  getPropostaDaSubmissao,
  lerEventoResumido,
  listRegionsAdmin,
  proximaSubmissao,
}));
// O recorte de quem modera, só para «abrir a seguinte»: o resto do módulo
// (as perguntas «de que região é isto?») é o real, e as guardas falsas de cima
// nem chegam a fazê-las.
vi.mock('./ambito', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ambito')>()),
  ambitoDoPainel,
  regiaoDaSubmissao: async () => 'mirante',
}));

const {
  actualizarSitio,
  alternarSeccao,
  approveSubmission,
  atualizarEvento,
  atualizarRegiao,
  criarRegiao,
  definirRegiaoNoAr,
  destrancarCampo,
  fundirSubmissao,
  ligarFonte,
  pausarFonte,
  reabrirFonte,
  ligarSitio,
  porSitioDeLado,
  rejectSubmission,
} = await import('./actions');
const { CACHE_TAGS } = await import('../queries/events');

function formulario(campos: Record<string, string>): FormData {
  const dados = new FormData();
  for (const [campo, valor] of Object.entries(campos)) dados.set(campo, valor);
  return dados;
}

/** Para onde a ação mandou, e o aviso que levou — já descodificado. */
async function destinoDe(accao: Promise<void>): Promise<{ caminho: string; aviso: string }> {
  try {
    await accao;
  } catch (erro) {
    const destino = (erro as Error).message.replace(/^REDIRECT:/, '');
    const [caminho = '', query = ''] = destino.split('?');
    return { caminho, aviso: new URLSearchParams(query).get('aviso') ?? '' };
  }
  throw new Error('a ação devia ter redirecionado');
}

describe('actualizarSitio', () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    redirect.mockClear();
    requireAdmin.mockReset();
    requireAdmin.mockResolvedValue('fvsalgado');
  });

  it('recusa quem não tem sessão de administração', async () => {
    requireAdmin.mockRejectedValue(new Error('sem sessão'));

    await expect(actualizarSitio()).rejects.toThrow('sem sessão');
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('descarta todas as etiquetas públicas', async () => {
    await expect(actualizarSitio()).rejects.toThrow(/^REDIRECT:/);

    const limpas = new Set(revalidateTag.mock.calls.map(([tag]) => tag));

    // `municipality` é uma função — a etiqueta por concelho nasce de um id e
    // não se enumera. Cai com a de eventos, que é a que a fabrica.
    const publicas = Object.values(CACHE_TAGS).filter((tag) => typeof tag === 'string');

    expect(publicas.length).toBeGreaterThan(0);
    for (const tag of publicas) {
      expect(limpas, `a etiqueta «${tag}» ficou por descartar`).toContain(tag);
    }
  });

  it('descarta a fundo, e não só até à próxima expiração', async () => {
    await expect(actualizarSitio()).rejects.toThrow(/^REDIRECT:/);

    for (const [, opcoes] of revalidateTag.mock.calls) {
      expect(opcoes).toEqual({ expire: 0 });
    }
  });

  it('volta ao painel a dizer o que aconteceu', async () => {
    await expect(actualizarSitio()).rejects.toThrow(/^REDIRECT:\/admin\?aviso=/);
  });
});

/** O caso da 0066: «Casa da Cultura», em Alcanena, é a Casa Municipal da Cultura. */
const LIGACAO = {
  normalized: 'casadacultura',
  name: 'Casa da Cultura',
  municipality: 'alcanena',
  venue: 'casa-da-cultura-pateo',
};

describe('ligarSitio', () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    revalidatePath.mockClear();
    redirect.mockClear();
    rpc.mockReset();
    rpc.mockResolvedValue({ data: 3, error: null });
    requireAdmin.mockReset();
    requireAdmin.mockResolvedValue('fvsalgado');
  });

  it('escreve pela função da base, com o autor da sessão', async () => {
    const { caminho, aviso } = await destinoDe(ligarSitio(formulario(LIGACAO)));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('set_venue_alias', {
      p_name: 'Casa da Cultura',
      p_venue_id: 'casa-da-cultura-pateo',
      p_municipality_id: 'alcanena',
      p_actor: 'fvsalgado',
    });
    expect(caminho).toBe('/admin/espacos');
    expect(aviso).toContain('3 eventos ligados');
  });

  it('descarta os eventos, o concelho e a própria fila', async () => {
    await destinoDe(ligarSitio(formulario(LIGACAO)));

    const limpas = revalidateTag.mock.calls.map(([tag]) => tag);
    expect(limpas).toContain(CACHE_TAGS.events);
    expect(limpas).toContain(CACHE_TAGS.municipality('alcanena'));
    expect(revalidatePath).toHaveBeenCalledWith('/admin/espacos');
  });

  it('sem concelho, o alias é regional e não há etiqueta de concelho a descartar', async () => {
    await destinoDe(ligarSitio(formulario({ ...LIGACAO, municipality: '' })));

    expect(rpc).toHaveBeenCalledWith(
      'set_venue_alias',
      expect.objectContaining({ p_municipality_id: null }),
    );
    const limpas = revalidateTag.mock.calls.map(([tag]) => String(tag));
    expect(limpas).toContain(CACHE_TAGS.events);
    expect(limpas.some((tag) => tag.startsWith('events:'))).toBe(false);
  });

  it('diz quando nenhum evento estava à espera', async () => {
    rpc.mockResolvedValue({ data: 0, error: null });

    const { aviso } = await destinoDe(ligarSitio(formulario(LIGACAO)));
    expect(aviso).toContain('Nenhum evento estava à espera');
  });

  it('recusa o formulário sem espaço escolhido, antes de chegar à base', async () => {
    const { caminho, aviso } = await destinoDe(ligarSitio(formulario({ ...LIGACAO, venue: '' })));

    expect(caminho).toBe('/admin/espacos');
    expect(aviso).toMatch(/Escolhe primeiro o espaço/);
    expect(rpc).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('recusa um identificador de espaço que não é um slug', async () => {
    await destinoDe(ligarSitio(formulario({ ...LIGACAO, venue: "x'; drop table venues; --" })));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('recusa um nome que não é o da chave que se estava a ver', async () => {
    const { aviso } = await destinoDe(
      ligarSitio(formulario({ ...LIGACAO, name: 'Cine-Teatro Paraíso' })),
    );

    expect(aviso).toMatch(/não batem certo/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uma recusa da base volta à fila como aviso, sem descartar nada', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'um nome de tomar não pode apontar a um espaço de abrantes (miaa)' },
    });

    const { caminho, aviso } = await destinoDe(ligarSitio(formulario(LIGACAO)));

    expect(caminho).toBe('/admin/espacos');
    expect(aviso).toBe('um nome de tomar não pode apontar a um espaço de abrantes (miaa)');
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('recusa quem não tem sessão de administração', async () => {
    requireAdmin.mockRejectedValue(new Error('sem sessão'));

    await expect(ligarSitio(formulario(LIGACAO))).rejects.toThrow('sem sessão');
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('porSitioDeLado', () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    revalidatePath.mockClear();
    redirect.mockClear();
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
    requireAdmin.mockReset();
    requireAdmin.mockResolvedValue('fvsalgado');
  });

  it('marca pela função da base, com o autor da sessão', async () => {
    const { caminho, aviso } = await destinoDe(
      porSitioDeLado(formulario({ normalized: 'varioslocais' })),
    );

    expect(rpc).toHaveBeenCalledWith('dismiss_unresolved_venue', {
      p_normalized: 'varioslocais',
      p_actor: 'fvsalgado',
    });
    expect(caminho).toBe('/admin/espacos');
    expect(aviso).toMatch(/Posto de lado/);
  });

  it('refaz a fila e mais nada — nada de público mudou', async () => {
    await destinoDe(porSitioDeLado(formulario({ normalized: 'varioslocais' })));

    expect(revalidatePath).toHaveBeenCalledWith('/admin/espacos');
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('recusa uma chave que não está normalizada', async () => {
    const { aviso } = await destinoDe(porSitioDeLado(formulario({ normalized: 'Vários locais' })));

    expect(aviso).toMatch(/Falta a chave/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('um erro da base volta como aviso', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'sem autor não se põe nome nenhum de lado' },
    });

    const { aviso } = await destinoDe(porSitioDeLado(formulario({ normalized: 'varioslocais' })));

    expect(aviso).toBe('sem autor não se põe nome nenhum de lado');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('recusa quem não tem sessão de administração', async () => {
    requireAdmin.mockRejectedValue(new Error('sem sessão'));

    await expect(porSitioDeLado(formulario({ normalized: 'varioslocais' }))).rejects.toThrow(
      'sem sessão',
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});

/**
 * A Lezíria do Tejo, com três concelhos: um com sítio, um de outro distrito
 * (a Azambuja é de Lisboa), um sem sítio — e uma linha em branco pelo meio,
 * que uma lista colada de uma folha de cálculo traz sempre.
 */
const REGIAO_NOVA = {
  id: 'leziria-do-tejo',
  name: 'Lezíria do Tejo',
  article: 'a',
  cim_name: 'Comunidade Intermunicipal da Lezíria do Tejo',
  cim_url: 'https://cimlt.pt',
  domain: 'coreto.cimlt.pt',
  contact_email: 'coreto@cimlt.pt',
  ical_uid_domain: '',
  district: 'Santarém',
  municipalities: [
    'santarem | Santarém | 39.2362 | -8.6850 | https://www.cm-santarem.pt',
    'azambuja | Azambuja | 39.0703 | -8.8680 | | Lisboa',
    '',
    'cartaxo | Cartaxo | 39.1592 | -8.7873',
  ].join('\n'),
};

/** Os parâmetros com que a ação mandou de volta — o formulário preservado. */
async function parametrosDe(accao: Promise<void>): Promise<URLSearchParams> {
  try {
    await accao;
  } catch (erro) {
    const [, query = ''] = (erro as Error).message.replace(/^REDIRECT:/, '').split('?');
    return new URLSearchParams(query);
  }
  throw new Error('a ação devia ter redirecionado');
}

describe('criarRegiao', () => {
  beforeEach(() => {
    revalidateTag.mockClear();
    revalidatePath.mockClear();
    redirect.mockClear();
    rpc.mockReset();
    rpc.mockResolvedValue({ data: 'leziria-do-tejo', error: null });
    requireAdmin.mockReset();
    requireAdmin.mockResolvedValue('fvsalgado');
  });

  it('faz nascer a região pela função da base, com os concelhos lidos linha a linha', async () => {
    const { caminho, aviso } = await destinoDe(criarRegiao(formulario(REGIAO_NOVA)));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('create_region', {
      p_id: 'leziria-do-tejo',
      p_name: 'Lezíria do Tejo',
      p_article: 'a',
      p_cim_name: 'Comunidade Intermunicipal da Lezíria do Tejo',
      p_cim_url: 'https://cimlt.pt',
      p_domain: 'coreto.cimlt.pt',
      p_contact_email: 'coreto@cimlt.pt',
      // Em branco, o domínio dos UID nasce igual ao domínio — como o guia manda.
      p_ical_uid_domain: 'coreto.cimlt.pt',
      p_municipalities: [
        {
          id: 'santarem',
          name: 'Santarém',
          district: 'Santarém',
          latitude: 39.2362,
          longitude: -8.685,
          website: 'https://www.cm-santarem.pt',
        },
        {
          id: 'azambuja',
          name: 'Azambuja',
          district: 'Lisboa',
          latitude: 39.0703,
          longitude: -8.868,
          website: null,
        },
        {
          id: 'cartaxo',
          name: 'Cartaxo',
          district: 'Santarém',
          latitude: 39.1592,
          longitude: -8.7873,
          website: null,
        },
      ],
      p_actor: 'fvsalgado',
    });
    expect(caminho).toBe('/admin/regioes/leziria-do-tejo');
    expect(aviso).toContain('3 concelhos');
  });

  it('um domínio dos UID próprio segue tal e qual, em minúsculas', async () => {
    await destinoDe(
      criarRegiao(formulario({ ...REGIAO_NOVA, ical_uid_domain: 'Calendarios.CIMLT.pt' })),
    );

    expect(rpc).toHaveBeenCalledWith(
      'create_region',
      expect.objectContaining({ p_ical_uid_domain: 'calendarios.cimlt.pt' }),
    );
  });

  it('descarta as regiões e o catálogo que nasceu com elas, a fundo', async () => {
    await destinoDe(criarRegiao(formulario(REGIAO_NOVA)));

    const limpas = revalidateTag.mock.calls.map(([tag]) => tag);
    // As regiões: é por esta etiqueta que /api/regioes e o middleware passam
    // a conhecer o domínio novo sem deploy.
    expect(limpas).toContain(CACHE_TAGS.regions);
    // E os concelhos, o espaço e a fonte de cada um.
    expect(limpas).toContain(CACHE_TAGS.taxonomy);
    expect(limpas).toContain(CACHE_TAGS.venues);
    expect(limpas).toContain(CACHE_TAGS.sources);
    for (const [, opcoes] of revalidateTag.mock.calls) {
      expect(opcoes).toEqual({ expire: 0 });
    }
  });

  it('recusa um identificador que não é um slug, antes de chegar à base', async () => {
    const { caminho, aviso } = await destinoDe(
      criarRegiao(formulario({ ...REGIAO_NOVA, id: 'Lezíria do Tejo' })),
    );

    expect(caminho).toBe('/admin/regioes/nova');
    expect(aviso).toMatch(/identificador/);
    expect(rpc).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('recusa um domínio escrito com esquema ou barras', async () => {
    const { aviso } = await destinoDe(
      criarRegiao(formulario({ ...REGIAO_NOVA, domain: 'https://coreto.cimlt.pt/' })),
    );

    expect(aviso).toMatch(/domínio/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('recusa um artigo que não é um dos quatro', async () => {
    const { aviso } = await destinoDe(criarRegiao(formulario({ ...REGIAO_NOVA, article: 'um' })));

    expect(aviso).toMatch(/artigo/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('recusa a lista de concelhos vazia', async () => {
    const { aviso } = await destinoDe(
      criarRegiao(formulario({ ...REGIAO_NOVA, municipalities: '\n  \n' })),
    );

    expect(aviso).toMatch(/pelo menos um concelho/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('aponta a linha que veio com campos a menos', async () => {
    const { aviso } = await destinoDe(
      criarRegiao(
        formulario({
          ...REGIAO_NOVA,
          municipalities: REGIAO_NOVA.municipalities.replace(
            'cartaxo | Cartaxo | 39.1592 | -8.7873',
            'cartaxo | Cartaxo | 39.1592',
          ),
        }),
      ),
    );

    // A quarta linha do texto, e não o terceiro concelho: é a linha que a
    // pessoa vê na caixa, com a linha em branco a contar.
    expect(aviso).toMatch(/^Linha 4 dos concelhos: esperavam-se/);
    expect(aviso).toContain('vieram 3 campos');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('aponta a linha com a latitude e a longitude trocadas', async () => {
    const { aviso } = await destinoDe(
      criarRegiao(
        formulario({
          ...REGIAO_NOVA,
          municipalities: REGIAO_NOVA.municipalities.replace(
            '39.2362 | -8.6850',
            '-8.6850 | 39.2362',
          ),
        }),
      ),
    );

    expect(aviso).toMatch(/^Linha 1 dos concelhos/);
    expect(aviso).toMatch(/não caem em Portugal/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('aponta a linha com coordenadas que não são números', async () => {
    const { aviso } = await destinoDe(
      criarRegiao(
        formulario({
          ...REGIAO_NOVA,
          municipalities: REGIAO_NOVA.municipalities.replace(
            '39.1592 | -8.7873',
            '39,1592 | -8,7873',
          ),
        }),
      ),
    );

    expect(aviso).toMatch(/^Linha 4 dos concelhos/);
    expect(aviso).toMatch(/dois números decimais/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('aponta a linha com um concelho repetido, e a linha onde ele já estava', async () => {
    const { aviso } = await destinoDe(
      criarRegiao(
        formulario({
          ...REGIAO_NOVA,
          municipalities: `${REGIAO_NOVA.municipalities}\nsantarem | Santarém, outra vez | 39.24 | -8.69`,
        }),
      ),
    );

    expect(aviso).toMatch(/^Linha 5 dos concelhos/);
    expect(aviso).toMatch(/já apareceu na linha 1/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('exige o distrito quando nem a região nem a linha o dizem', async () => {
    const { aviso } = await destinoDe(criarRegiao(formulario({ ...REGIAO_NOVA, district: '' })));

    // A Azambuja traz o seu; Santarém, na primeira linha, não — e é essa.
    expect(aviso).toMatch(/^Linha 1 dos concelhos/);
    expect(aviso).toMatch(/distrito/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('devolve o formulário preenchido com o aviso, para uma linha errada não custar as outras', async () => {
    const params = await parametrosDe(
      criarRegiao(formulario({ ...REGIAO_NOVA, domain: 'coreto cimlt pt' })),
    );

    expect(params.get('aviso')).toMatch(/domínio/);
    expect(params.get('name')).toBe('Lezíria do Tejo');
    expect(params.get('municipalities')).toBe(REGIAO_NOVA.municipalities);
    expect(params.get('domain')).toBe('coreto cimlt pt');
  });

  it('uma recusa da base volta ao formulário como aviso, sem descartar nada', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'já há um concelho com o identificador santarem' },
    });

    const { caminho, aviso } = await destinoDe(criarRegiao(formulario(REGIAO_NOVA)));

    expect(caminho).toBe('/admin/regioes/nova');
    expect(aviso).toBe('já há um concelho com o identificador santarem');
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('recusa quem não tem sessão de administração', async () => {
    requireAdmin.mockRejectedValue(new Error('sem sessão'));

    await expect(criarRegiao(formulario(REGIAO_NOVA))).rejects.toThrow('sem sessão');
    expect(rpc).not.toHaveBeenCalled();
  });
});

/**
 * Aprovar diz o que publicou, e pode abrir a seguinte (C4-013).
 *
 * Devolvia à fila sem uma palavra. Agora o evento publicado segue na barra
 * (`publicado=`), e a página que recebe diz «Publicado» com a ligação para o
 * ver; com «Aprovar e abrir a seguinte», a página que recebe é a próxima
 * proposta por rever do recorte de quem modera.
 */
describe('approveSubmission: o retorno', () => {
  const SUBMISSAO = '11111111-2222-4333-8444-555555555555';
  const EVENTO = '66666666-7777-4888-9999-000000000000';
  const SEGUINTE = '77777777-7777-4777-8777-777777777777';

  function aprovar(extra: Record<string, string> = {}): FormData {
    return formulario({
      submission_id: SUBMISSAO,
      title: 'Concerto de Outono',
      municipality_id: 'tomar',
      session_date: '2026-10-10',
      ...extra,
    });
  }

  beforeEach(() => {
    rpc.mockReset();
    redirect.mockClear();
    proximaSubmissao.mockReset();
    ambitoDoPainel.mockReset();
    getPropostaDaSubmissao.mockReset();
    requireAdmin.mockResolvedValue('dono');
    getPropostaDaSubmissao.mockResolvedValue({
      payload: { title: 'Concerto de Outono', municipality_id: 'tomar' },
      municipality_id: 'tomar',
      venue_id: null,
    });
    rpc.mockImplementation((funcao: string) =>
      Promise.resolve(
        funcao === 'approve_submission' ? { data: EVENTO, error: null } : { data: 1, error: null },
      ),
    );
    ambitoDoPainel.mockResolvedValue({ regioes: ['medio-tejo'], concelhos: ['tomar'] });
  });

  it('volta à fila com o evento publicado na barra', async () => {
    const { caminho } = await destinoDe(approveSubmission(aprovar()));
    expect(caminho).toBe('/admin/fila');
    // A fila da região da proposta, e não a escolhida no cimo.
    expect(redirect).toHaveBeenLastCalledWith(`/admin/fila?regiao=mirante&publicado=${EVENTO}`);
  });

  it('«abrir a seguinte» abre a próxima do recorte, com o mesmo aviso', async () => {
    proximaSubmissao.mockResolvedValue(SEGUINTE);
    await destinoDe(approveSubmission(aprovar({ seguinte: '1' })));
    // A seguinte é da região da proposta aprovada, e não da escolhida no cimo.
    expect(ambitoDoPainel).toHaveBeenCalledWith({ pedida: 'mirante' });
    expect(proximaSubmissao).toHaveBeenCalledWith(
      { regioes: ['medio-tejo'], concelhos: ['tomar'] },
      SUBMISSAO,
    );
    expect(redirect).toHaveBeenLastCalledWith(`/admin/fila/${SEGUINTE}?publicado=${EVENTO}`);
  });

  it('e, quando era a última, diz isso na fila', async () => {
    proximaSubmissao.mockResolvedValue(null);
    const { caminho, aviso } = await destinoDe(approveSubmission(aprovar({ seguinte: '1' })));
    expect(caminho).toBe('/admin/fila');
    expect(aviso).toBe('Era a última proposta por rever.');
  });
});

/**
 * A zona de perigo (C4-035): tirar uma agenda do ar obriga a escrever o nome
 * da região, e o aviso diz a hora; o interruptor de uma secção diz qual, e o
 * caminho de volta leva o «desfazer».
 */
describe('definirRegiaoNoAr e alternarSeccao', () => {
  beforeEach(() => {
    rpc.mockReset();
    redirect.mockClear();
    requireAdmin.mockResolvedValue('dono');
    listRegionsAdmin.mockResolvedValue([
      { id: 'mirante', name: 'Mirante', article: 'o', domain: 'coreto.mirante.example' },
    ]);
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it('sem o nome escrito, nada sai do ar', async () => {
    const { caminho, aviso } = await destinoDe(
      definirRegiaoNoAr(formulario({ id: 'mirante', no_ar: '0', confirmacao: 'sim' })),
    );
    expect(caminho).toBe('/admin/regioes/mirante');
    expect(aviso).toMatch(/escreve o nome da região — «Mirante»/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('com o nome escrito (a caixa não conta), sai do ar e diz a hora', async () => {
    const { aviso } = await destinoDe(
      definirRegiaoNoAr(formulario({ id: 'mirante', no_ar: '0', confirmacao: ' mirante ' })),
    );
    expect(rpc).toHaveBeenCalledWith('update_region', {
      p_id: 'mirante',
      p_patch: { is_enabled: false },
      p_actor: 'dono',
    });
    expect(aviso).toMatch(/^A agenda do Mirante saiu do ar às \d{1,2}h(\d{2})?/);
  });

  it('o interruptor de uma secção diz qual, e leva o «desfazer» na volta', async () => {
    const destino = await destinoDe(
      alternarSeccao(formulario({ seccao: 'coretos', ligar: '0', regiao: 'mirante' })),
    );
    expect(destino.aviso).toMatch(/^«Coretos» passou a estar desligada/);
    expect(redirect.mock.calls.at(-1)?.[0]).toMatch(/[?&]desfazer=coretos&estava=1&aviso=/);
  });
});

/**
 * As fontes no painel (C4-032): os gestos chegam à base com o que ela precisa
 * — a pausa até ao fim do dia escolhido, na hora de Lisboa —, e um engano no
 * formulário volta em português sem lá chegar.
 */
describe('pausarFonte, reabrirFonte e ligarFonte', () => {
  beforeEach(() => {
    rpc.mockReset();
    redirect.mockClear();
    revalidateTag.mockClear();
    requireAdmin.mockResolvedValue('dono');
  });

  it('pausa até ao fim do dia escolhido, na hora de Lisboa, e diz até quando', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { caminho, aviso } = await destinoDe(
      pausarFonte(
        formulario({ fonte: 'cm-tomar', ate: '2026-12-10', motivo: 'À espera de resposta' }),
      ),
    );
    expect(rpc).toHaveBeenCalledWith('pausar_fonte', {
      p_fonte: 'cm-tomar',
      p_ate: '2026-12-10T23:59:00+00:00',
      p_motivo: 'À espera de resposta',
      p_actor: 'dono',
    });
    expect(caminho).toBe('/admin/fontes/cm-tomar');
    expect(aviso).toMatch(/^Em pausa até 10 de dezembro de 2026\./);
    expect(revalidateTag).toHaveBeenCalled();
  });

  it('sem motivo, ou com uma fonte que não é fonte, não chega à base', async () => {
    const semMotivo = await destinoDe(
      pausarFonte(formulario({ fonte: 'cm-tomar', ate: '2026-12-10', motivo: ' ' })),
    );
    expect(semMotivo.aviso).toMatch(/^Escreve o motivo da pausa/);
    const forjada = await destinoDe(
      pausarFonte(formulario({ fonte: '../regioes', ate: '2026-12-10', motivo: 'x' })),
    );
    expect(forjada.caminho).toBe('/admin/fontes');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('desligar pede a confirmação; reabrir diz quando não havia nada a reabrir', async () => {
    const semConfirmar = await destinoDe(
      ligarFonte(formulario({ fonte: 'cm-tomar', ligar: '0', motivo: 'O município pediu' })),
    );
    expect(semConfirmar.aviso).toMatch(/marca a caixa/);
    expect(rpc).not.toHaveBeenCalled();

    rpc.mockResolvedValue({ data: false, error: null });
    const reaberta = await destinoDe(reabrirFonte(formulario({ fonte: 'cm-tomar' })));
    expect(rpc).toHaveBeenCalledWith('reabrir_fonte', { p_fonte: 'cm-tomar', p_actor: 'dono' });
    expect(reaberta.aviso).toBe('Não havia pausa automática nem falhas para reabrir.');
  });
});

/**
 * O planeador de transportes é do gestor da região, e a recusa fala
 * português a quem o preenche: a base diz «com https://», e a ação diz também
 * «sem espaços» — o engano provável de quem cola um endereço.
 */
describe('atualizarRegiao: o planeador de transportes', () => {
  beforeEach(() => {
    rpc.mockReset();
    redirect.mockClear();
    requireAdmin.mockResolvedValue('dono');
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it('um espaço no meio do endereço volta com o porquê, sem chegar à base', async () => {
    const { caminho, aviso } = await destinoDe(
      atualizarRegiao(
        formulario({
          id: 'mirante',
          transit_planner_url: 'https://planeador.exemplo.pt/via gem/',
        }),
      ),
    );
    expect(caminho).toBe('/admin/regioes/mirante');
    expect(aviso).toMatch(/não pode ter espaços/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sem https:// também, e um endereço bom segue para a base', async () => {
    const semHttps = await destinoDe(
      atualizarRegiao(formulario({ id: 'mirante', transit_planner_url: 'planeador.exemplo.pt' })),
    );
    expect(semHttps.aviso).toMatch(/tem de começar por https:\/\//);
    expect(rpc).not.toHaveBeenCalled();

    await destinoDe(
      atualizarRegiao(
        formulario({ id: 'mirante', transit_planner_url: 'https://planeador.exemplo.pt/viagem/' }),
      ),
    );
    expect(rpc).toHaveBeenCalledWith(
      'update_region',
      expect.objectContaining({
        p_patch: expect.objectContaining({
          transit_planner_url: 'https://planeador.exemplo.pt/viagem/',
        }),
      }),
    );
  });
});

/**
 * Corrigir um evento publicado (C4-017): o formulário vai inteiro para a
 * `update_event`, que decide o que mudou; a ação diz o que mudou em português
 * e nunca chega à base sem uma data.
 */
describe('atualizarEvento e destrancarCampo', () => {
  const EVENTO = '66666666-7777-4888-9999-000000000000';
  const FICHA = `/admin/eventos/${EVENTO}`;

  function corrigir(extra: Record<string, string> = {}): FormData {
    const dados = formulario({
      event_id: EVENTO,
      title: 'Concerto de Outono',
      municipality_id: 'tomar',
      price_display: '5 €',
      ...extra,
    });
    if (!('sem_datas' in extra)) {
      dados.append('session_date', '2026-10-10');
      dados.append('session_start', '18:00');
      dados.append('session_end', '');
    }
    return dados;
  }

  beforeEach(() => {
    rpc.mockReset();
    redirect.mockClear();
    lerEventoResumido.mockReset();
    requireAdmin.mockResolvedValue('dono');
    lerEventoResumido.mockResolvedValue({ municipality_id: 'tomar' });
  });

  it('manda o que o formulário tem, sem o identificador, e diz o que mudou', async () => {
    rpc.mockResolvedValue({ data: ['price_display', 'sessions'], error: null });
    const { caminho, aviso } = await destinoDe(atualizarEvento(corrigir()));
    expect(rpc).toHaveBeenCalledWith(
      'update_event',
      expect.objectContaining({
        p_event_id: EVENTO,
        p_patch: expect.objectContaining({ title: 'Concerto de Outono', price_display: '5 €' }),
        p_sessions: [{ session_date: '2026-10-10', start_time: '18:00' }],
        p_actor: 'dono',
      }),
    );
    const patch = (rpc.mock.calls[0]?.[1] as { p_patch: Record<string, unknown> }).p_patch;
    expect(patch).not.toHaveProperty('id');
    expect(caminho).toBe(FICHA);
    expect(aviso).toMatch(/^Guardado\. Mudou o preço e as datas — e fica trancado/);
  });

  it('sem mudanças, diz isso; sem datas, nem chega à base', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect((await destinoDe(atualizarEvento(corrigir()))).aviso).toBe(
      'Nada mudou: o evento já estava assim.',
    );
    rpc.mockReset();
    const { aviso } = await destinoDe(atualizarEvento(corrigir({ sem_datas: '1' })));
    expect(aviso).toMatch(/^Um evento sem data nenhuma/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uma recusa da base volta à ficha em português', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'o título não pode ficar vazio' },
    });
    const { caminho, aviso } = await destinoDe(atualizarEvento(corrigir()));
    expect(caminho).toBe(FICHA);
    expect(aviso).toBe('O título não pode ficar vazio');
  });

  it('destranca só os campos que o painel corrige', async () => {
    rpc.mockResolvedValue({ data: 1, error: null });
    const { aviso } = await destinoDe(
      destrancarCampo(formulario({ event_id: EVENTO, campo: 'price_display' })),
    );
    expect(rpc).toHaveBeenCalledWith('unlock_event_fields', {
      p_event_id: EVENTO,
      p_actor: 'dono',
      p_fields: ['price_display'],
    });
    expect(aviso).toMatch(/o preço na próxima noite/);

    rpc.mockReset();
    const recusado = await destinoDe(
      destrancarCampo(formulario({ event_id: EVENTO, campo: 'status' })),
    );
    expect(recusado.aviso).toBe('Esse campo não se destranca aqui.');
    expect(rpc).not.toHaveBeenCalled();
  });
});

/**
 * Recusar como duplicada e fundir: nenhum campo pede um identificador a uma
 * pessoa, e um engano volta ao formulário em português (C4-014, C4-029).
 *
 * O caso que o achado mediu: o nome do evento escrito onde se pedia o
 * identificador. Dava «Não foi possível falar com a base de dados» e um erro
 * do React em inglês. A ação tem de o recusar antes de chamar a base.
 */
describe('rejectSubmission e fundirSubmissao', () => {
  const SUBMISSAO = '11111111-2222-4333-8444-555555555555';
  const EVENTO = '66666666-7777-4888-9999-000000000000';
  const FICHA = `/admin/fila/${SUBMISSAO}`;

  beforeEach(() => {
    rpc.mockReset();
    redirect.mockClear();
    revalidateTag.mockClear();
    eventoPeloEndereco.mockReset();
    getPropostaDaSubmissao.mockReset();
    requireAdmin.mockResolvedValue('dono');
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it('o nome do evento no lugar do identificador volta à ficha, sem tocar na base', async () => {
    const { caminho, aviso } = await destinoDe(
      rejectSubmission(
        formulario({
          submission_id: SUBMISSAO,
          status: 'duplicate',
          duplicate_of: 'Noite de Fados na Filarmónica',
        }),
      ),
    );
    expect(caminho).toBe(FICHA);
    expect(aviso).toContain('Pode já cá estar');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('o endereço da ficha pública diz de que evento é duplicada', async () => {
    eventoPeloEndereco.mockResolvedValue({ id: EVENTO });
    const { caminho, aviso } = await destinoDe(
      rejectSubmission(
        formulario({
          submission_id: SUBMISSAO,
          status: 'duplicate',
          duplicate_url: 'https://mediotejo.coreto.org/evento/noite-de-fados-na-filarmonica-abc123',
        }),
      ),
    );
    expect(eventoPeloEndereco).toHaveBeenCalledWith(
      'https://mediotejo.coreto.org/evento/noite-de-fados-na-filarmonica-abc123',
    );
    expect(rpc).toHaveBeenCalledWith(
      'reject_submission',
      expect.objectContaining({ p_status: 'duplicate', p_duplicate_of: EVENTO }),
    );
    expect(caminho).toBe('/admin/fila');
    expect(aviso).toMatch(/^Marcada como duplicada/);
  });

  it('um endereço que não é de evento nenhum, ou nenhum, volta a explicar o que se pede', async () => {
    eventoPeloEndereco.mockResolvedValue(null);
    const semEvento = await destinoDe(
      rejectSubmission(
        formulario({
          submission_id: SUBMISSAO,
          status: 'duplicate',
          duplicate_url: 'Noite de Fados',
        }),
      ),
    );
    expect(semEvento.caminho).toBe(FICHA);
    expect(semEvento.aviso).toContain('/evento/');

    const semNada = await destinoDe(
      rejectSubmission(formulario({ submission_id: SUBMISSAO, status: 'duplicate' })),
    );
    expect(semNada.caminho).toBe(FICHA);
    expect(semNada.aviso).toMatch(/^Para marcar como duplicada, diz de que evento/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uma recusa da base volta à ficha em português, em vez do ecrã de avaria', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'esta proposta já foi decidida — recarrega a página' },
    });
    const { caminho, aviso } = await destinoDe(
      rejectSubmission(formulario({ submission_id: SUBMISSAO, status: 'rejected' })),
    );
    expect(caminho).toBe(FICHA);
    expect(aviso).toBe('Esta proposta já foi decidida — recarrega a página');
  });

  it('cada decisão diz o que aconteceu', async () => {
    const pedir = await destinoDe(
      rejectSubmission(formulario({ submission_id: SUBMISSAO, status: 'needs_info' })),
    );
    expect(pedir.aviso).toMatch(/^Fica à espera de resposta/);
    const recusar = await destinoDe(
      rejectSubmission(formulario({ submission_id: SUBMISSAO, status: 'rejected' })),
    );
    expect(recusar.aviso).toMatch(/^Não publicada/);
  });

  it('fundir leva as datas da proposta guardada e diz quantas entraram', async () => {
    getPropostaDaSubmissao.mockResolvedValue({
      payload: {
        sessions: [
          { session_date: '2026-10-04', start_time: '21:30' },
          { session_date: '2026-10-05', start_time: '21:30', end_time: '23:00' },
          { session_date: '', start_time: '10:00' },
        ],
      },
      municipality_id: 'ponte-do-bombo',
      venue_id: null,
    });
    rpc.mockResolvedValue({ data: 1, error: null });

    const { caminho, aviso } = await destinoDe(
      fundirSubmissao(formulario({ submission_id: SUBMISSAO, evento: EVENTO })),
    );
    expect(rpc).toHaveBeenCalledWith('fundir_submissao_no_evento', {
      p_submission_id: SUBMISSAO,
      p_event_id: EVENTO,
      p_sessions: [
        { session_date: '2026-10-04', start_time: '21:30' },
        { session_date: '2026-10-05', start_time: '21:30', end_time: '23:00' },
      ],
      p_actor: 'dono',
    });
    expect(caminho).toBe('/admin/fila');
    expect(aviso).toBe('Fundida: uma data nova juntou-se ao evento que já existia.');
    expect(revalidateTag).toHaveBeenCalled();
  });

  it('fundir sem um evento escolhido da lista não chega à base', async () => {
    const { caminho } = await destinoDe(
      fundirSubmissao(formulario({ submission_id: SUBMISSAO, evento: 'Noite de Fados' })),
    );
    expect(caminho).toBe(FICHA);
    expect(rpc).not.toHaveBeenCalled();
    expect(getPropostaDaSubmissao).not.toHaveBeenCalled();
  });
});

/**
 * As ações chamam funções pelo nome, e um nome é uma cadeia que o compilador
 * não verifica. Ler as migrações é o mais perto que se chega, sem base de
 * dados, de garantir que a assinatura que a ação usa é a que a base tem.
 */
describe('as funções da base que as ações chamam', () => {
  it('existem numa migração, com a assinatura que as ações usam', () => {
    const pasta = fileURLToPath(new URL('../../../../../supabase/migrations/', import.meta.url));
    const sql = readdirSync(pasta)
      .filter((nome) => nome.endsWith('.sql'))
      .map((nome) => readFileSync(pasta + nome, 'utf8'))
      .join('\n');

    expect(sql).toMatch(
      /function public\.set_venue_alias\(\s*p_name\s+text,\s*p_venue_id\s+text,\s*p_municipality_id\s+text,\s*p_actor\s+text\s*\)/,
    );
    expect(sql).toMatch(
      /function public\.dismiss_unresolved_venue\(\s*p_normalized\s+text,\s*p_actor\s+text\s*\)/,
    );
    expect(sql).toMatch(
      /function public\.pausar_fonte\(\s*p_fonte\s+text,\s*p_ate\s+timestamptz,\s*p_motivo\s+text,\s*p_actor\s+text,\s*p_ip_hash\s+text default null\s*\)/,
    );
    expect(sql).toMatch(
      /function public\.reabrir_fonte\(\s*p_fonte\s+text,\s*p_actor\s+text,\s*p_ip_hash\s+text default null\s*\)/,
    );
    expect(sql).toMatch(
      /function public\.definir_fonte_ligada\(\s*p_fonte\s+text,\s*p_ligada\s+boolean,\s*p_motivo\s+text,\s*p_actor\s+text,\s*p_ip_hash\s+text default null\s*\)/,
    );
    expect(sql).toMatch(
      /function public\.update_event\(\s*p_event_id\s+uuid,\s*p_patch\s+jsonb,\s*p_sessions\s+jsonb,\s*p_actor\s+text,\s*p_ip_hash\s+text default null\s*\)/,
    );
    expect(sql).toMatch(
      /function public\.unlock_event_fields\(\s*p_event_id\s+uuid,\s*p_actor\s+text,\s*p_fields\s+text\[\] default null\s*\)/,
    );
    expect(sql).toMatch(
      /function public\.fundir_submissao_no_evento\(\s*p_submission_id\s+uuid,\s*p_event_id\s+uuid,\s*p_sessions\s+jsonb,\s*p_actor\s+text,\s*p_ip_hash\s+text default null\s*\)/,
    );
    expect(sql).toMatch(
      /function public\.create_region\(\s*p_id\s+text,\s*p_name\s+text,\s*p_article\s+text,\s*p_cim_name\s+text,\s*p_cim_url\s+text,\s*p_domain\s+text,\s*p_contact_email\s+text,\s*p_ical_uid_domain\s+text,\s*p_municipalities\s+jsonb,\s*p_actor\s+text,\s*p_ip_hash\s+text default null\s*\)/,
    );
  });
});
