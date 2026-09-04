import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';

/**
 * O robots.txt de cada domínio.
 *
 * Não é uma fechadura — `/admin` está fechado por sessão — e por isso o que
 * há a provar é pouco e é de encaminhamento: a linha `Sitemap:` tem de
 * apontar para o mapa do domínio em que responde. Um motor de busca que leia
 * o robots da Travessia e seja mandado ao sitemap do Médio Tejo indexa a
 * agenda errada com a nossa bênção.
 *
 * A região vem substituída; a origem é a que o `urlDoSitio` verdadeiro
 * calcula. O `notFound` é de mentira porque é a única forma de afirmar um
 * 404 fora do Next — e o que a rota tem de fazer com ele é nada: deixá-lo
 * subir.
 */

const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
const notFound = vi.hoisted(() =>
  vi.fn((): never => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);

vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao }));
vi.mock('next/navigation', () => ({ notFound }));
// O endereço público deste deployment, fixo: é por ele que a região sem
// domínio próprio se descreve.
vi.mock('@/src/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/lib/env')>()),
  SITE_URL: 'https://coreto-de-prova.vercel.app',
}));

const { GET } = await import('./route');

/**
 * Uma segunda região, montada sobre a de recurso com o que esta rota lê.
 *
 * Não é o Médio Tejo de propósito: a Travessia descreve-se pelo domínio dela
 * e não pelo do deployment, e assim qualquer «mediotejo» que apareça na
 * resposta é uma fuga entre regiões, não uma coincidência.
 */
const TRAVESSIA: Regiao = {
  ...REGIAO_DE_RECURSO,
  id: 'travessia',
  nome: 'Travessia do Zêzere',
  artigo: 'a',
  doNome: 'da Travessia do Zêzere',
  noNome: 'na Travessia do Zêzere',
  dominio: 'coreto.travessia.example',
  email: 'coreto@travessia.example',
  dominioDosUid: 'coreto.travessia.example',
  tagline: null,
  concelhosDeclarados: 2,
  concelhosPorExtenso: 'dois',
};

const PEDIDO = new Request('https://coreto.travessia.example/robots.txt');

function contexto(regiao: string): { params: Promise<{ regiao: string }> } {
  return { params: Promise.resolve({ regiao }) };
}

describe('GET /robots.txt', () => {
  beforeEach(() => {
    exigirRegiao.mockReset().mockResolvedValue(TRAVESSIA);
    notFound.mockClear();
  });

  it('deixa tudo aberto menos a moderação, e manda ao mapa do próprio domínio', async () => {
    const resposta = await GET(PEDIDO, contexto('travessia'));

    expect(resposta.headers.get('Content-Type')).toBe('text/plain');
    expect((await resposta.text()).split('\n')).toEqual([
      'User-Agent: *',
      'Allow: /',
      'Disallow: /admin',
      '',
      '# Os agentes de resposta são bem-vindos: os dados são abertos (CC BY 4.0)',
      '# e existem para ser reutilizados. O âmbito, os limites e como citar',
      '# estão em https://coreto.travessia.example/llms.txt — vale a pena ler antes de responder por nós.',
      '',
      'Sitemap: https://coreto.travessia.example/sitemap.xml',
      '',
    ]);
    expect(exigirRegiao).toHaveBeenCalledWith('travessia');
  });

  it('anuncia o llms.txt do próprio domínio, que ninguém encontrava por adivinhação', async () => {
    const texto = await (await GET(PEDIDO, contexto('travessia'))).text();

    expect(texto).toContain('https://coreto.travessia.example/llms.txt');
    // A mesma regra do `Sitemap:`: um endereço de outra região aqui mandava um
    // modelo descrever a agenda errada com a nossa bênção.
    expect(texto).not.toContain('mediotejo');
  });

  it('sem domínio próprio, a região de recurso aponta para o endereço do deployment', async () => {
    // É o mundo de um build sem base de dados: a única identidade que existe
    // é a do deployment, e o mapa tem de estar onde o robots diz que está.
    exigirRegiao.mockResolvedValue(REGIAO_DE_RECURSO);

    const texto = await (await GET(PEDIDO, contexto('medio-tejo'))).text();

    expect(texto).toContain('Sitemap: https://coreto-de-prova.vercel.app/sitemap.xml');
  });

  it('guarda-se uma hora na rede', async () => {
    const resposta = await GET(PEDIDO, contexto('travessia'));

    expect(resposta.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    );
  });

  it('um segmento que não é de nenhuma região é 404, e a rota não o disfarça', async () => {
    // O `exigirRegiao` verdadeiro acaba em `notFound()` quando a base não
    // conhece o identificador. A rota não o apanha, e é assim que o Next
    // responde 404 em vez de um robots.txt de uma região que não existe.
    exigirRegiao.mockImplementation(async () => notFound());

    await expect(GET(PEDIDO, contexto('nao-existe'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledOnce();
  });
});

describe('a montra fecha-se aos robôs, e com um ficheiro próprio', () => {
  /*
   * O programa da montra é inventado — eventos que nunca aconteceram, em
   * concelhos que não existem, com datas empurradas para a frente todas as
   * noites. Numa agenda cultural isso é conteúdo plausível: tem título, data,
   * sítio e cartaz, e um motor de busca não tem como saber que é ficção.
   * Indexá-lo leva alguém a deslocar-se a uma coisa que não existe.
   */
  const MONTRA: Regiao = { ...TRAVESSIA, id: 'vale-do-coreto', tipo: 'montra' };

  beforeEach(() => {
    exigirRegiao.mockReset();
    exigirRegiao.mockResolvedValue(MONTRA);
  });

  it('fecha tudo', async () => {
    const texto = await (
      await GET(new Request('http://x/robots.txt'), {
        params: Promise.resolve({ regiao: 'vale-do-coreto' }),
      })
    ).text();
    expect(texto).toContain('User-Agent: *');
    expect(texto).toContain('Disallow: /');
    expect(texto).not.toContain('Allow: /');
  });

  /*
   * E não se contradiz, que é o que este bloco existe para prender.
   *
   * O robots.txt normal convida os agentes de resposta, diz que os dados são
   * CC BY e existem para ser reutilizados, e anuncia o sitemap. Está certo
   * para uma agenda a sério. Numa demonstração seria pedir que não se
   * indexasse e, na linha seguinte, entregar o mapa de tudo e autorizar a
   * reutilização — e um ficheiro que se contradiz é um ficheiro que alguém
   * há-de resolver pelo lado errado.
   */
  it('não anuncia sitemap nem convida agentes de resposta', async () => {
    const texto = await (
      await GET(new Request('http://x/robots.txt'), {
        params: Promise.resolve({ regiao: 'vale-do-coreto' }),
      })
    ).text();
    expect(texto).not.toContain('Sitemap:');
    expect(texto).not.toContain('llms.txt');
    expect(texto).not.toContain('CC BY');
  });
});
