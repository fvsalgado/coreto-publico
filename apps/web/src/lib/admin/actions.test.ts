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
vi.mock('./auth', () => ({ requireAdmin }));
// Da chave de serviço só se usa o `rpc`: é o único caminho de escrita que as
// ações conhecem, e a regra da casa é que continue a sê-lo.
vi.mock('../supabase/server', () => ({ requireAdminClient: () => ({ rpc }) }));

const { actualizarSitio, criarRegiao, ligarSitio, porSitioDeLado } = await import('./actions');
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
      /function public\.create_region\(\s*p_id\s+text,\s*p_name\s+text,\s*p_article\s+text,\s*p_cim_name\s+text,\s*p_cim_url\s+text,\s*p_domain\s+text,\s*p_contact_email\s+text,\s*p_ical_uid_domain\s+text,\s*p_municipalities\s+jsonb,\s*p_actor\s+text,\s*p_ip_hash\s+text default null\s*\)/,
    );
  });
});
