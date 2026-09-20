import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * O domínio de correio deste deployment é o do `SITE_URL`, e o `SITE_URL`
 * resolve-se quando o `env` carrega — antes de qualquer `import` daqui. Até
 * 19 de setembro de 2026 estes testes viviam do último degrau da resolução,
 * que era `coreto.mediotejo.pt`; esse degrau passou a ser o domínio do
 * produto, e um teste que dependa de um valor por omissão está a testar a
 * omissão, não o middleware. Diz-se o domínio de propósito.
 */
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://coreto.mediotejo.pt';
});

import { NextRequest } from 'next/server';
import { ADMIN_PATH_HEADER } from '@/src/lib/admin/guarda';
import { ADMIN_COOKIE_NAME, createSessionToken } from '@/src/lib/admin/session';
import { PORTAO_COOKIE_NAME, criarBilhete } from '@/src/lib/portao';
import { esquecerMapaDeDominios } from '@/src/lib/regiao-host';
import { middleware } from './middleware';

/*
 * A porta do multi-inquilino, batida de fora.
 *
 * O middleware é o único sítio onde um Host vira região, um alias vira 308 e
 * um anfitrião desconhecido vira a página do produto — e até aqui não tinha
 * um teste. Cada caso abaixo é uma frase sobre o produto, com o pedido
 * construído como o Vercel o entrega (`NextRequest` com o cabeçalho `host`) e
 * a resposta lida como o Next a escreve: um `rewrite` é o cabeçalho
 * `x-middleware-rewrite`, um «deixa passar» é o `x-middleware-next`, e um
 * redirecionamento é o `status` com o `location`.
 *
 * O mapa de domínios vem de `/api/regioes` pelo `fetch` global, que aqui é um
 * dublê; e como o mapa fica guardado no módulo cinco minutos, esquece-se entre
 * testes para nenhum caso herdar o mapa do anterior.
 */

const MAPA = [
  { id: 'medio-tejo', domain: 'coreto.mediotejo.pt', aliases: ['mediotejo.coreto.org'] },
  { id: 'vale-do-coreto', domain: 'coreto.org', aliases: ['www.coreto.org'] },
];

/** Um `fetch` que só sabe responder ao mapa das regiões, e conta as vezes. */
function fetchDoMapa(mapa: unknown = MAPA): ReturnType<typeof vi.fn> {
  return vi.fn(async (entrada: string | URL | Request) => {
    const url = String(entrada instanceof Request ? entrada.url : entrada);
    if (url.endsWith('/api/regioes')) {
      return new Response(JSON.stringify(mapa), { status: 200 });
    }
    return new Response('não é o mapa', { status: 404 });
  });
}

function pedido(url: string, cabecalhos: Record<string, string> = {}): NextRequest {
  const { host } = new URL(url);
  return new NextRequest(url, { headers: { host, ...cabecalhos } });
}

let buscar: ReturnType<typeof vi.fn>;

beforeEach(() => {
  buscar = fetchDoMapa();
  vi.stubGlobal('fetch', buscar);
});

afterEach(() => {
  esquecerMapaDeDominios();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('cada domínio serve a sua região', () => {
  it('reescreve o caminho para o segmento da região, com a query intacta', async () => {
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/agenda?categoria=musica'),
    );
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.mediotejo.pt/medio-tejo/agenda?categoria=musica',
    );
  });

  it('a raiz de uma região é a raiz do segmento dela (o Next tira a barra final)', async () => {
    const resposta = await middleware(pedido('https://coreto.org/'));
    expect(resposta.headers.get('x-middleware-rewrite')).toBe('https://coreto.org/vale-do-coreto');
  });

  it('o Host lê-se sem o porto e sem maiúsculas', async () => {
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/mapa', { host: 'Coreto.MedioTejo.pt:443' }),
    );
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.mediotejo.pt/medio-tejo/mapa',
    );
  });

  it('o sitemap público tem um nome interno diferente, e o interno não é endereço', async () => {
    const publico = await middleware(pedido('https://coreto.mediotejo.pt/sitemap.xml'));
    expect(publico.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.mediotejo.pt/medio-tejo/sitemap-xml',
    );
    const interno = await middleware(pedido('https://coreto.mediotejo.pt/sitemap-xml'));
    expect(interno.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.mediotejo.pt/medio-tejo/sitemap-xml/nao-e-endereco',
    );
  });

  it('a API pública de eventos é da região: reescreve-se como uma página', async () => {
    const resposta = await middleware(pedido('https://coreto.mediotejo.pt/api/events?page=2'));
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.mediotejo.pt/medio-tejo/api/events?page=2',
    );
  });

  it('o mapa pede-se uma vez e guarda-se: dois pedidos, uma ida ao /api/regioes', async () => {
    await middleware(pedido('https://coreto.mediotejo.pt/agenda'));
    await middleware(pedido('https://coreto.org/agenda'));
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(String(buscar.mock.calls[0]?.[0])).toBe('https://coreto.mediotejo.pt/api/regioes');
  });
});

describe('um anfitrião que não é de ninguém vê o produto, e mais nada', () => {
  it('a raiz é a página do produto, e é indexável', async () => {
    const resposta = await middleware(pedido('https://agenda.exemplo-qualquer.pt/'));
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://agenda.exemplo-qualquer.pt/pagina-do-produto',
    );
    /*
     * Sem `X-Robots-Tag`, e é a parte que interessa provar: a página do
     * produto é a face pública do `coreto.org`, e o cabeçalho ganha ao
     * canónico do HTML. Com ele, o duplicado ficava resolvido e a ficha
     * ficava por indexar em todo o lado — o canónico fixo da página é que
     * manda os motores para o original.
     */
    expect(resposta.headers.get('x-robots-tag')).toBeNull();
  });

  it('qualquer outro caminho vai dar a um endereço que não existe, esse sim sem indexar', async () => {
    const resposta = await middleware(pedido('https://agenda.exemplo-qualquer.pt/agenda'));
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://agenda.exemplo-qualquer.pt/pagina-do-produto/nao-e-endereco',
    );
    expect(resposta.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('o nome interno da página do produto também não é endereço', async () => {
    const resposta = await middleware(
      pedido('https://agenda.exemplo-qualquer.pt/pagina-do-produto'),
    );
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://agenda.exemplo-qualquer.pt/pagina-do-produto/nao-e-endereco',
    );
  });

  it('num domínio de região, o nome interno da página do produto é um 404 da região', async () => {
    const resposta = await middleware(pedido('https://coreto.mediotejo.pt/pagina-do-produto'));
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.mediotejo.pt/medio-tejo/pagina-do-produto',
    );
  });

  it('sem cabeçalho Host, ninguém: é o produto', async () => {
    const semHost = new NextRequest('https://coreto.mediotejo.pt/agenda');
    semHost.headers.delete('host');
    const resposta = await middleware(semHost);
    expect(resposta.headers.get('x-middleware-rewrite')).toContain('/pagina-do-produto');
  });

  it('com o mapa em baixo, todos os anfitriões são desconhecidos — degrada, nunca parte', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('a base está em baixo');
      }),
    );
    const resposta = await middleware(pedido('https://coreto.mediotejo.pt/agenda'));
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.mediotejo.pt/pagina-do-produto/nao-e-endereco',
    );
  });
});

describe('um alias não serve: redireciona para o canónico', () => {
  it('308 para o mesmo caminho e a mesma query no domínio canónico', async () => {
    const resposta = await middleware(pedido('https://www.coreto.org/agenda?categoria=musica'));
    expect(resposta.status).toBe(308);
    expect(resposta.headers.get('location')).toBe('https://coreto.org/agenda?categoria=musica');
  });

  it('o alias de uma região manda para o domínio dessa região', async () => {
    const resposta = await middleware(pedido('https://mediotejo.coreto.org/'));
    expect(resposta.status).toBe(308);
    expect(resposta.headers.get('location')).toBe('https://coreto.mediotejo.pt/');
  });

  it('a API do produto passa antes do alias: é o que impede o /api/regioes de se pedir a si mesmo', async () => {
    const resposta = await middleware(pedido('https://www.coreto.org/api/regioes'));
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('x-middleware-next')).toBe('1');
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe('o que é do produto não tem região', () => {
  it.each(['/api/revalidate', '/api/intake/email', '/api/stats', '/api/submissions'])(
    '%s deixa passar em qualquer anfitrião, sem ir ao mapa',
    async (caminho) => {
      const resposta = await middleware(pedido(`https://agenda.exemplo-qualquer.pt${caminho}`));
      expect(resposta.headers.get('x-middleware-next')).toBe('1');
      expect(resposta.headers.get('x-middleware-rewrite')).toBeNull();
      expect(buscar).not.toHaveBeenCalled();
    },
  );

  it.each([
    '/favicon.ico',
    '/icon.svg',
    '/apple-icon.png',
    '/icones/coreto-192.png',
    '/logos/medio-tejo/cim-escuro.png',
    '/og/medio-tejo.png',
    // As capturas da ficha técnica. Entraram na lista depois de as quatro
    // darem 404 numa pré-visualização, com os ficheiros em `public/` à espera:
    // o que não está aqui é tratado como caminho de página.
    '/produto/agenda.webp',
    // O processador do MapLibre 6, servido por nós. Sem esta linha o
    // `setWorkerUrl` do `MapaVivo` apontava para um 404 e o mapa arrancava sem
    // Worker — um canvas cinzento sem uma linha na consola.
    '/maplibre/6.10.0/maplibre-gl-worker.mjs',
    '/.well-known/carta-qualquer.txt',
  ])('%s é um ficheiro: sai tal como está, mesmo num anfitrião desconhecido', async (caminho) => {
    const resposta = await middleware(pedido(`https://agenda.exemplo-qualquer.pt${caminho}`));
    expect(resposta.headers.get('x-middleware-next')).toBe('1');
    expect(resposta.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('o security.txt é a exceção dentro de /.well-known/: é rota da região, não ficheiro', async () => {
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/.well-known/security.txt'),
    );
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.mediotejo.pt/medio-tejo/seguranca-txt',
    );
  });

  it('o mta-sts.txt é rota da região, como o security.txt', async () => {
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/.well-known/mta-sts.txt'),
    );
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.mediotejo.pt/medio-tejo/mta-sts-txt',
    );
  });

  it('o nome interno do security.txt não é endereço', async () => {
    const resposta = await middleware(pedido('https://coreto.mediotejo.pt/seguranca-txt'));
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.mediotejo.pt/medio-tejo/seguranca-txt/nao-e-endereco',
    );
  });
});

describe('a área interna é uma só, guardada à porta', () => {
  const SEGREDO = 'um-segredo-só-para-os-testes';

  it('a página de entrada passa, com o caminho num cabeçalho de pedido', async () => {
    const resposta = await middleware(pedido('https://coreto.mediotejo.pt/admin/entrar'));
    expect(resposta.headers.get('x-middleware-next')).toBe('1');
    expect(resposta.headers.get(`x-middleware-request-${ADMIN_PATH_HEADER}`)).toBe('/admin/entrar');
    expect(resposta.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');
    expect(resposta.headers.get('cache-control')).toBe('no-store, must-revalidate');
  });

  it('sem sessão, manda para a entrada e guarda o destino', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', SEGREDO);
    const resposta = await middleware(pedido('https://coreto.mediotejo.pt/admin/fila'));
    expect(resposta.status).toBe(307);
    const destino = new URL(resposta.headers.get('location') ?? '');
    expect(destino.pathname).toBe('/admin/entrar');
    expect(destino.searchParams.get('destino')).toBe('/admin/fila');
    expect(resposta.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');
  });

  it('com uma sessão assinada pelo segredo, passa', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', SEGREDO);
    const token = await createSessionToken('ana', SEGREDO);
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/admin/fila', { cookie: `${ADMIN_COOKIE_NAME}=${token}` }),
    );
    expect(resposta.headers.get('x-middleware-next')).toBe('1');
    expect(resposta.headers.get(`x-middleware-request-${ADMIN_PATH_HEADER}`)).toBe('/admin/fila');
  });

  it('uma sessão assinada por outro segredo não passa', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', SEGREDO);
    const token = await createSessionToken('ana', 'outro-segredo');
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/admin/fila', { cookie: `${ADMIN_COOKIE_NAME}=${token}` }),
    );
    expect(resposta.status).toBe(307);
  });

  it('sem segredo configurado, fecha: nem uma sessão válida entra', async () => {
    const token = await createSessionToken('ana', SEGREDO);
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/admin/fila', { cookie: `${ADMIN_COOKIE_NAME}=${token}` }),
    );
    expect(resposta.status).toBe(307);
    expect(new URL(resposta.headers.get('location') ?? '').pathname).toBe('/admin/entrar');
  });

  it('um visitante não consegue forjar o cabeçalho do caminho: o middleware sobrepõe-o', async () => {
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/admin/entrar', { [ADMIN_PATH_HEADER]: '/admin/fila' }),
    );
    expect(resposta.headers.get(`x-middleware-request-${ADMIN_PATH_HEADER}`)).toBe('/admin/entrar');
  });

  it('a área interna vive fora das regiões: nem vai ao mapa', async () => {
    await middleware(pedido('https://agenda.exemplo-qualquer.pt/admin/entrar'));
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe('a escotilha REGIAO_DE_OMISSAO', () => {
  /*
   * O valor é lido quando o módulo carrega, e é assim de propósito (ver
   * `regiao-host.ts`); para provar o outro mundo, carrega-se o middleware de
   * novo com a variável definida.
   */
  it('com a escotilha aberta, um anfitrião desconhecido vê essa região', async () => {
    vi.stubEnv('REGIAO_DE_OMISSAO', 'medio-tejo');
    vi.resetModules();
    const { middleware: comEscotilha } = await import('./middleware');
    const resposta = await comEscotilha(pedido('https://agenda.exemplo-qualquer.pt/agenda'));
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://agenda.exemplo-qualquer.pt/medio-tejo/agenda',
    );
    vi.resetModules();
  });

  it('a escotilha nunca rouba um domínio que está no mapa', async () => {
    vi.stubEnv('REGIAO_DE_OMISSAO', 'medio-tejo');
    vi.resetModules();
    const { middleware: comEscotilha } = await import('./middleware');
    const resposta = await comEscotilha(pedido('https://coreto.org/agenda'));
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.org/vale-do-coreto/agenda',
    );
    vi.resetModules();
  });
});

describe('o anfitrião mta-sts. serve a política, e mais nada', () => {
  it('a política sai da região do domínio a que o prefixo pertence', async () => {
    // A RFC 8461 exige `https://mta-sts.<domínio>/.well-known/mta-sts.txt` sem
    // redirecionamentos — daí este anfitrião ser tratado antes dos alias.
    const resposta = await middleware(
      pedido('https://mta-sts.coreto.mediotejo.pt/.well-known/mta-sts.txt'),
    );
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://mta-sts.coreto.mediotejo.pt/medio-tejo/mta-sts-txt',
    );
    expect(resposta.status).not.toBe(308);
  });

  /*
   * A regressão que este bloco passa a prender, e que aconteceu mesmo.
   *
   * Aqui estava escrito que «cada domínio de região tem o seu»: o prefixo
   * caía, o que sobrava procurava-se no mapa das regiões, e a política saía
   * se estivesse lá. No dia em que o `coreto.org` deixou de ser uma região —
   * a montra mudou-se, e é isso que faz dele a ficha técnica —, a política
   * de correio foi atrás dela: `mta-sts.coreto.org` passou a 404, e um
   * domínio que recebe correio ficou sem publicar a política que promete TLS.
   *
   * A pergunta estava errada de origem. A política não é de uma região: a
   * rota que a serve nem olha para o segmento, lê o MX e o modo do ambiente.
   * É do domínio de correio do deployment — e um domínio de região que não
   * seja esse não deve receber esta política, porque anunciaria este MX para
   * correio que não passa por aqui. Uma política de MTA-STS errada é pior do
   * que nenhuma.
   */
  it('um domínio que não é o do correio deste deployment não recebe política', async () => {
    const resposta = await middleware(pedido('https://mta-sts.coreto.org/.well-known/mta-sts.txt'));
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://mta-sts.coreto.org/pagina-do-produto/nao-e-endereco',
    );
  });

  it('e o do domínio de correio sai mesmo quando ele não é de região nenhuma', async () => {
    // É o caso do `coreto.org` em produção: serve a ficha técnica, não é de
    // região nenhuma, e continua a receber correio. A política tem de sair.
    const resposta = await middleware(
      pedido('https://mta-sts.coreto.mediotejo.pt/.well-known/mta-sts.txt'),
    );
    expect(resposta.headers.get('x-middleware-rewrite')).toContain('/mta-sts-txt');
    expect(resposta.headers.get('x-middleware-rewrite')).not.toContain('nao-e-endereco');
  });

  it.each(['/', '/agenda', '/feed.xml', '/admin'])(
    '%s neste anfitrião não é endereço: existe para servir a política e mais nada',
    async (caminho) => {
      const resposta = await middleware(pedido(`https://mta-sts.coreto.org${caminho}`));
      expect(resposta.headers.get('x-middleware-rewrite')).toBe(
        `https://mta-sts.coreto.org/pagina-do-produto/nao-e-endereco`,
      );
      expect(resposta.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    },
  );

  it('um prefixo sobre um domínio que não é de nenhuma região é 404', async () => {
    const resposta = await middleware(
      pedido('https://mta-sts.exemplo-qualquer.pt/.well-known/mta-sts.txt'),
    );
    expect(resposta.headers.get('x-middleware-rewrite')).toContain('/nao-e-endereco');
  });
});

/**
 * A segunda porta da casa, vista de fora.
 *
 * O balanço abre com um segredo na barra do endereço, e por isso o que aqui
 * se verifica não é para onde ele vai — é o que **não** pode acontecer a um
 * endereço que carrega um segredo: ser indexado, ficar numa cache partilhada,
 * ou ser entregue ao primeiro sítio para onde alguém siga a partir dele.
 *
 * E que não é a porta do painel: um segredo de leitura não pode passar pela
 * guarda que serve para escrever.
 */
describe('a porta do balanço', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchDoMapa());
    esquecerMapaDeDominios();
  });

  it.each([
    'https://coreto.mediotejo.pt/balanco?chave=x',
    'https://coreto.org/balanco',
    'https://mediotejo.coreto.org/balanco?chave=x&mes=2026-08',
  ])('%s passa, e não é redirecionada para o domínio canónico', async (url) => {
    const resposta = await middleware(pedido(url));
    expect(resposta.status).not.toBe(308);
    expect(resposta.headers.get('x-middleware-next')).toBe('1');
  });

  it('nunca é indexada nem guardada, seja em que anfitrião for', async () => {
    const resposta = await middleware(pedido('https://coreto.mediotejo.pt/balanco?chave=x'));
    expect(resposta.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
    expect(resposta.headers.get('Cache-Control')).toBe('no-store, must-revalidate');
  });

  /**
   * Com o segredo na barra, um `Referer` completo entregava-o ao primeiro
   * sítio para onde alguém seguisse — e a página tem ligações para fora
   * nenhumas exatamente por isto, mas o cabeçalho é a rede que não depende de
   * ninguém se lembrar.
   */
  it('não deixa o segredo sair no cabeçalho de proveniência', async () => {
    const resposta = await middleware(pedido('https://coreto.org/balanco?chave=x'));
    expect(resposta.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('não passa pela guarda do painel: é uma porta de leitura, não de escrita', async () => {
    const resposta = await middleware(pedido('https://coreto.org/balanco?chave=x'));
    // A `guardAdmin` marca o caminho que guardou. Se este cabeçalho aparecer,
    // o balanço passou a ser servido pela porta onde se escreve.
    expect(resposta.headers.get(ADMIN_PATH_HEADER)).toBeNull();
    expect(resposta.status).not.toBe(307);
  });

  it('o painel continua a ser o painel', async () => {
    const resposta = await middleware(pedido('https://coreto.org/admin'));
    expect(resposta.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
  });
});

/**
 * A terceira porta: a barreira temporária de uma região (0157).
 *
 * É a do meio entre ligada e desligada — uma região de pé, a servir, e só para
 * quem tem a senha. O que aqui se prova é o que o middleware decide, que é
 * tudo o que decide: quem passa, quem vai parar à página da senha, e o que
 * continua a responder na mesma. A senha e o bilhete têm os seus testes em
 * `portao.test.ts` e em `api/portao/route.test.ts`.
 */
describe('a barreira de uma região', () => {
  const SEGREDO = 'um-segredo-só-para-os-testes';
  const COM_BARREIRA = [
    { id: 'medio-tejo', domain: 'coreto.mediotejo.pt', barreira: true },
    { id: 'vale-do-coreto', domain: 'coreto.org', barreira: false },
  ];

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchDoMapa(COM_BARREIRA));
    vi.stubEnv('ADMIN_SESSION_SECRET', SEGREDO);
  });

  it('sem bilhete, a página é a da senha — e o endereço público não muda', async () => {
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/agenda?categoria=musica'),
    );
    const destino = new URL(resposta.headers.get('x-middleware-rewrite') ?? '');
    expect(destino.pathname).toBe('/medio-tejo/portao');
    // De onde se veio viaja para a página poder devolver quem entra ao sítio.
    expect(destino.searchParams.get('de')).toBe('/agenda?categoria=musica');
    // Não é 307 nem 308: um redirecionamento mudava o endereço na barra e
    // dava a uma agenda inteira um segundo endereço.
    expect(resposta.status).toBe(200);
  });

  it('e não se indexa nem se guarda em cache de ninguém', async () => {
    const resposta = await middleware(pedido('https://coreto.mediotejo.pt/agenda'));
    expect(resposta.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');
    expect(resposta.headers.get('cache-control')).toBe('no-store, must-revalidate');
  });

  it('com o bilhete da região, passa como qualquer pedido', async () => {
    const bilhete = await criarBilhete('medio-tejo', SEGREDO);
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/agenda', {
        cookie: `${PORTAO_COOKIE_NAME}=${bilhete}`,
      }),
    );
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.mediotejo.pt/medio-tejo/agenda',
    );
  });

  it('o bilhete de outra região não abre esta', async () => {
    const bilhete = await criarBilhete('vale-do-coreto', SEGREDO);
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/agenda', {
        cookie: `${PORTAO_COOKIE_NAME}=${bilhete}`,
      }),
    );
    expect(new URL(resposta.headers.get('x-middleware-rewrite') ?? '').pathname).toBe(
      '/medio-tejo/portao',
    );
  });

  it('sem o segredo de assinatura, ninguém passa — fecha em vez de abrir', async () => {
    // A mesma regra da guarda do painel, escrita lá com todas as letras: o
    // público degrada, a segurança fecha. Sem segredo não há bilhete que se
    // possa verificar, e deixar passar era desligar a barreira sozinho.
    const bilhete = await criarBilhete('medio-tejo', SEGREDO);
    vi.stubEnv('ADMIN_SESSION_SECRET', undefined);
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/agenda', {
        cookie: `${PORTAO_COOKIE_NAME}=${bilhete}`,
      }),
    );
    expect(new URL(resposta.headers.get('x-middleware-rewrite') ?? '').pathname).toBe(
      '/medio-tejo/portao',
    );
  });

  it('uma região sem barreira não ganha porta nenhuma', async () => {
    const resposta = await middleware(pedido('https://coreto.org/agenda'));
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.org/vale-do-coreto/agenda',
    );
  });

  it('os feeds e os dados continuam a responder — foi a escolha de quem a pediu', async () => {
    // Está escrito no painel a quem liga a barreira, e está aqui, para não
    // deixar de ser verdade sem ninguém dar por isso.
    for (const [caminho, interno] of [
      ['/feed.xml', '/medio-tejo/feed.xml'],
      ['/agenda.ics', '/medio-tejo/agenda.ics'],
      ['/api/events', '/medio-tejo/api/events'],
      ['/robots.txt', '/medio-tejo/robots.txt'],
      ['/sitemap.xml', '/medio-tejo/sitemap-xml'],
    ]) {
      const resposta = await middleware(pedido(`https://coreto.mediotejo.pt${caminho}`));
      expect(new URL(resposta.headers.get('x-middleware-rewrite') ?? '').pathname).toBe(interno);
    }
  });

  it('o painel não fica atrás da barreira da região que administra', async () => {
    // O `/admin` decide-se antes, e ainda bem: com a barreira ligada na região
    // principal, quem a ligou ficava do lado de fora do sítio onde a desliga.
    const token = await createSessionToken('ana', SEGREDO);
    const resposta = await middleware(
      pedido('https://coreto.mediotejo.pt/admin/regioes', {
        cookie: `${ADMIN_COOKIE_NAME}=${token}`,
      }),
    );
    expect(resposta.headers.get(`x-middleware-request-${ADMIN_PATH_HEADER}`)).toBe(
      '/admin/regioes',
    );
  });

  it('a página da senha não se tapa a si própria', async () => {
    const resposta = await middleware(pedido('https://coreto.mediotejo.pt/portao'));
    expect(resposta.headers.get('x-middleware-rewrite')).toBe(
      'https://coreto.mediotejo.pt/medio-tejo/portao',
    );
  });
});
