import { describe, expect, it } from 'vitest';
import { HttpClient, backoffMs, parseRetryAfter, USER_AGENT } from './http.js';

import { comRobots } from './robots-de-teste.js';
interface Recorder {
  urls: string[];
  headers: Array<Record<string, string>>;
  sleeps: number[];
}

/** Uma resposta por descrever, para cada tentativa receber a sua. */
type Reply = { status: number; body?: string; headers?: Record<string, string> } | Error;

/** Cliente com relógio, espera e rede substituídos — nada aqui sai da máquina. */
function makeClient(
  replies: readonly Reply[],
  options: { minHostIntervalMs?: number } = {},
): { client: HttpClient; recorder: Recorder } {
  const recorder: Recorder = { urls: [], headers: [], sleeps: [] };
  let clock = 0;
  let index = 0;

  const client = new HttpClient({
    minHostIntervalMs: options.minHostIntervalMs ?? 0,
    now: () => clock,
    sleep: (ms) => {
      recorder.sleeps.push(ms);
      clock += ms;
      return Promise.resolve();
    },
    fetchImpl: comRobots((input, init) => {
      recorder.urls.push(String(input));
      const headers = init?.headers;
      recorder.headers.push(
        headers && !Array.isArray(headers) ? { ...(headers as Record<string, string>) } : {},
      );
      const next = replies[Math.min(index, replies.length - 1)];
      index += 1;
      if (next instanceof Error) return Promise.reject(next);
      if (!next) return Promise.resolve(new Response('', { status: 500 }));
      // Um `Response` só se lê uma vez: cada tentativa leva o seu.
      return Promise.resolve(
        new Response(next.body ?? '', { status: next.status, headers: next.headers ?? {} }),
      );
    }),
  });

  return { client, recorder };
}

describe('backoffMs', () => {
  it('duplica a cada tentativa', () => {
    expect([backoffMs(1), backoffMs(2), backoffMs(3)]).toEqual([1_000, 2_000, 4_000]);
  });
});

describe('parseRetryAfter', () => {
  it('lê segundos e datas', () => {
    expect(parseRetryAfter('120', 0)).toBe(120_000);
    expect(
      parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT', Date.parse('2026-10-21T07:27:30Z')),
    ).toBe(30_000);
    expect(parseRetryAfter(null, 0)).toBeNull();
    expect(parseRetryAfter('já a seguir', 0)).toBeNull();
  });
});

describe('HttpClient', () => {
  it('identifica-se e pede em português', async () => {
    const { client, recorder } = makeClient([{ status: 200, body: 'olá' }]);
    const response = await client.get('https://www.cm-tomar.pt/pt/agenda');

    expect(response.ok).toBe(true);
    expect(response.body).toBe('olá');
    expect(recorder.headers[0]?.['user-agent']).toBe(USER_AGENT);
    expect(recorder.headers[0]?.['accept-language']).toContain('pt-PT');
    expect(client.counters()).toEqual({ responses: 1, failures: 0 });
  });

  it('repete um 503 com recuo exponencial e desiste ao fim das tentativas', async () => {
    const { client, recorder } = makeClient([{ status: 503 }]);
    const response = await client.get('https://www.cm-tomar.pt/pt/agenda');

    expect(response.ok).toBe(false);
    expect(response.status).toBe(503);
    expect(recorder.urls).toHaveLength(3);
    expect(recorder.sleeps).toEqual([1_000, 2_000]);
    expect(client.counters().responses).toBe(3);
  });

  it('nunca repete um 404', async () => {
    const { client, recorder } = makeClient([{ status: 404 }]);
    const response = await client.get('https://www.cm-tomar.pt/pt/agenda-antiga');

    expect(response.status).toBe(404);
    expect(recorder.urls).toHaveLength(1);
    expect(recorder.sleeps).toEqual([]);
  });

  it('espera o que o servidor pediu num 429', async () => {
    const { client, recorder } = makeClient([
      { status: 429, headers: { 'retry-after': '5' } },
      { status: 200, body: 'agenda' },
    ]);
    const response = await client.get('https://www.cm-tomar.pt/pt/agenda');

    expect(response.ok).toBe(true);
    expect(recorder.sleeps).toEqual([5_000]);
  });

  it('desiste quando o servidor pede uma espera longa de mais', async () => {
    const { client, recorder } = makeClient([{ status: 429, headers: { 'retry-after': '3600' } }]);
    const response = await client.get('https://www.cm-tomar.pt/pt/agenda');

    expect(response.ok).toBe(false);
    expect(response.error).toContain('3600s');
    expect(recorder.urls).toHaveLength(1);
  });

  it('conta como falha um pedido que nem chega a ter resposta', async () => {
    const { client } = makeClient([new Error('getaddrinfo ENOTFOUND')]);
    const response = await client.get('https://nao-existe.cm-exemplo.pt/agenda');

    expect(response.status).toBe(0);
    expect(response.error).toContain('ENOTFOUND');
    expect(client.counters()).toEqual({ responses: 0, failures: 3 });
  });

  /**
   * Um pedido de cada vez por hospedeiro — e o `robots.txt` é um pedido.
   *
   * Este teste esperava uma espera só. Passou a esperar três, e a diferença
   * não é do teste: é da casa. Desde que a recolha cumpre o `robots.txt`, o
   * primeiro pedido a um hospedeiro é sempre o do ficheiro, e esse reserva a
   * primeira janela — a página vem na segunda. É por isso que a espera
   * aparece também antes do `/a`, que antes saía a seco.
   *
   * Custa um segundo por hospedeiro e por recolha, quarenta ao todo. Pagá-lo
   * é o que faz a promessa ser verdade: do outro lado é a mesma máquina, e
   * perguntar-lhe se se pode ler não é menos pedido do que ler.
   */
  it('espaça os pedidos ao mesmo hospedeiro, o robots.txt incluído, e não os do seguinte', async () => {
    const { client, recorder } = makeClient([{ status: 200, body: 'ok' }], {
      minHostIntervalMs: 1_000,
    });

    await client.get('https://www.cm-tomar.pt/a');
    await client.get('https://www.cm-tomar.pt/b');
    await client.get('https://www.cm-ourem.pt/c');

    // Três esperas: a que separa o robots.txt do `/a`, a que separa o `/a` do
    // `/b`, e a que separa o robots.txt do Ourém do `/c`. Nenhuma delas é
    // entre hospedeiros — o Ourém não esperou pelo Tomar.
    expect(recorder.sleeps).toEqual([1_000, 1_000, 1_000]);
    // E o duplo só viu as três páginas: o `comRobots` serve o ficheiro sem
    // gastar uma resposta guionada.
    expect(recorder.urls).toEqual([
      'https://www.cm-tomar.pt/a',
      'https://www.cm-tomar.pt/b',
      'https://www.cm-ourem.pt/c',
    ]);
  });
});

/**
 * O `robots.txt` deixou de ser uma coisa que esta casa não lia.
 *
 * Durante meses a `/fontes` confessava, por escrito, que a recolha não o lia.
 * Era honesto e era pouco. A decisão de o cumprir foi tomada depois de se
 * medir o que custava: a 14 de setembro de 2026, das quarenta fontes, as
 * **trinta e duas alcançáveis deixam ler a agenda**. Zero perdidas. As outras
 * oito estão bloqueadas pela máquina da CIM e não se conseguiu saber — que é
 * resposta diferente de «não há».
 *
 * O que estes testes prendem é a parte que não se vê num ficheiro de regras:
 * o que o cliente faz com elas.
 */
describe('o robots.txt, agora que se cumpre', () => {
  /** Um cliente que serve o `robots.txt` pedido e a página a todo o resto. */
  function comFicheiro(robots: string): { client: HttpClient; pedidos: string[] } {
    const pedidos: string[] = [];
    const client = new HttpClient({
      minHostIntervalMs: 0,
      sleep: () => Promise.resolve(),
      fetchImpl: (input) => {
        const url = String(input);
        pedidos.push(url);
        if (url.endsWith('/robots.txt')) {
          return Promise.resolve(new Response(robots, { status: 200 }));
        }
        return Promise.resolve(new Response('a agenda', { status: 200 }));
      },
    });
    return { client, pedidos };
  }

  it('lê o ficheiro antes da página, e uma vez só por hospedeiro', async () => {
    const { client, pedidos } = comFicheiro('User-agent: *\nDisallow:');

    await client.get('https://www.cm-exemplo.pt/agenda');
    await client.get('https://www.cm-exemplo.pt/agenda/setembro');

    expect(pedidos[0]).toBe('https://www.cm-exemplo.pt/robots.txt');
    // Duas páginas, um só robots.txt: a recolha toca cada hospedeiro dezenas
    // de vezes, e pedir o ficheiro a cada uma seria dobrar o que se pede.
    expect(pedidos.filter((u) => u.endsWith('/robots.txt'))).toHaveLength(1);
    expect(pedidos).toHaveLength(3);
  });

  it('não vai buscar o que o ficheiro proíbe, e diz porquê', async () => {
    const { client, pedidos } = comFicheiro('User-agent: *\nDisallow: /privado/');

    const proibida = await client.get('https://www.cm-exemplo.pt/privado/agenda');
    expect(proibida.ok).toBe(false);
    expect(proibida.error).toContain('não deixa ler');
    expect(proibida.error).toContain('/privado/agenda');

    // E o pedido não chegou a sair: é isso que quer dizer cumprir.
    expect(pedidos).not.toContain('https://www.cm-exemplo.pt/privado/agenda');

    const permitida = await client.get('https://www.cm-exemplo.pt/agenda');
    expect(permitida.ok).toBe(true);
  });

  it('obedece a um grupo escrito para nós, e não ao do «*»', async () => {
    const { client } = comFicheiro(
      ['User-agent: *', 'Disallow:', '', 'User-agent: Coreto', 'Disallow: /agenda'].join('\n'),
    );

    const resposta = await client.get('https://www.cm-exemplo.pt/agenda');
    expect(resposta.ok).toBe(false);
    expect(resposta.error).toContain('grupo «coreto»');
  });

  it('um 404 é ausência de ficheiro, e ausência de ficheiro é ausência de regras', async () => {
    const client = new HttpClient({
      minHostIntervalMs: 0,
      sleep: () => Promise.resolve(),
      fetchImpl: (input) =>
        Promise.resolve(
          String(input).endsWith('/robots.txt')
            ? new Response('não há', { status: 404 })
            : new Response('a agenda', { status: 200 }),
        ),
    });

    const resposta = await client.get('https://servicos.exemplo.pt/api/eventos');
    expect(resposta.ok).toBe(true);
  });

  /**
   * A RFC 9309 manda ler um 5xx como proibição total. **Aqui atira-se, e a
   * diferença é deliberada.**
   *
   * O efeito prático é o mesmo — não se lê nada. O que muda é o que fica
   * escrito. Uma proibição silenciosa é indistinguível de uma agenda vazia, e
   * foi exatamente por aí que dezassete fontes gravaram `success` sem lerem um
   * byte, a 5 e a 9 de setembro de 2026. Nesta casa «não consegui saber» não
   * se arruma como se fosse «não».
   */
  it('um 5xx no ficheiro não passa por permissão nem por proibição calada', async () => {
    const client = new HttpClient({
      minHostIntervalMs: 0,
      sleep: () => Promise.resolve(),
      fetchImpl: (input) =>
        Promise.resolve(
          String(input).endsWith('/robots.txt')
            ? new Response('', { status: 503 })
            : new Response('a agenda', { status: 200 }),
        ),
    });

    await expect(client.get('https://www.cm-exemplo.pt/agenda')).rejects.toThrow(
      /não consegui ler o .*robots\.txt.*503/,
    );
  });

  /**
   * E o erro leva o código de sistema atrás.
   *
   * Sem isto, o pedido do `robots.txt` passava a falhar primeiro e a tapar o
   * diagnóstico do que vinha a seguir. São esses códigos — `ECONNRESET` em
   * sete fontes, `UND_ERR_CONNECT_TIMEOUT` no Mação — que sustentam a carta à
   * Comunidade Intermunicipal do Médio Tejo. Perdê-los aqui era perder a prova.
   */
  it('quando a ligação morre, o código de sistema não se perde pelo caminho', async () => {
    const fora = new Error('fetch failed') as Error & { cause?: unknown };
    const dentro = new Error('read ECONNRESET') as Error & { code: string };
    dentro.code = 'ECONNRESET';
    fora.cause = dentro;

    const client = new HttpClient({
      minHostIntervalMs: 0,
      sleep: () => Promise.resolve(),
      fetchImpl: () => Promise.reject(fora),
    });

    await expect(client.get('https://www.cm-tomar.pt/comunicacao/agenda')).rejects.toThrow(
      /ECONNRESET/,
    );
  });

  it('o próprio robots.txt não se pergunta a si mesmo se pode ser lido', async () => {
    const { client, pedidos } = comFicheiro('User-agent: *\nDisallow: /');
    // Com «Disallow: /» tudo está proibido — menos o ficheiro que o diz, senão
    // a pergunta não tinha fim.
    await client.get('https://www.cm-exemplo.pt/robots.txt');
    expect(pedidos).toEqual(['https://www.cm-exemplo.pt/robots.txt']);
  });
});

/**
 * O agente identifica-se com uma morada que responde, e não com uma que só
 * parece educada.
 *
 * Já falhou duas vezes. A primeira apontava para um domínio que nunca
 * existiu; a segunda para `github.com/fvsalgado/coreto`, que devolve 404
 * porque o repositório é privado — e quem segue este endereço é exatamente
 * quem não tem acesso: o administrador de sistemas que nos vê nos registos
 * dele. Um agente que se identifica com uma morada morta não é identificável,
 * é só educado na aparência.
 *
 * Este teste não consegue medir se o endereço responde — isso é rede, e um
 * teste não vai à rede. O que ele prende é o que se aprendeu: nada de
 * repositórios privados, e uma página do sítio público.
 */
describe('o endereço com que o agente se apresenta', () => {
  it('não é um repositório privado', () => {
    expect(
      USER_AGENT,
      'O endereço do repositório devolve 404 a quem não tem acesso, e é a quem não tem ' +
        'acesso que este endereço se destina. Use uma página do sítio público.',
    ).not.toContain('github.com');
  });

  it('é uma página pública do sítio, e traz o «+» que a convenção pede', () => {
    const url = /\+(https:\/\/[^\s;)]+)/.exec(USER_AGENT)?.[1];
    expect(url, 'o agente tem de trazer um endereço prefixado por «+»').toBeTruthy();
    expect(url).toMatch(/^https:\/\/[a-z.-]+coreto\.org\//);
  });

  it('diz o que é, em português, para quem lê um registo de servidor', () => {
    expect(USER_AGENT).toContain('agenda cultural');
    expect(USER_AGENT).toContain('Portugal');
  });
});

/**
 * O que correu mal tem de chegar à base com o detalhe que serve para agir.
 *
 * O `fetch` do Node põe `fetch failed` em todos os erros de rede. DNS que não
 * resolve, ligação recusada, ligação cortada a meio do TLS e certificado
 * expirado são quatro avarias diferentes, com quatro respostas diferentes, e
 * chegavam todas à base com a mesma frase — porque o `describeError` deitava
 * fora o `error.cause`, que é onde vive o código do sistema.
 *
 * Custou uma noite a descobrir à mão o que estava lá dentro o tempo todo.
 */
describe('a descrição de um erro de rede', () => {
  /** Um erro como o `undici` o entrega: genérico por fora, com a causa dentro. */
  function comoOUndici(code: string, mensagem = 'fetch failed'): Error {
    const fora = new Error(mensagem);
    const dentro = new Error(`${code} ao ligar`) as Error & { code: string };
    dentro.code = code;
    (fora as Error & { cause?: unknown }).cause = dentro;
    return fora;
  }

  /** O que fica no `error` da resposta quando a rede rejeita com este erro. */
  async function descricaoDe(erro: Error): Promise<string> {
    const { client } = makeClient([erro]);
    const resposta = await client.get('https://exemplo.pt/');
    expect(resposta.ok).toBe(false);
    return resposta.error ?? '';
  }

  it('leva o código do sistema à frente, que é o que se procura', async () => {
    expect(await descricaoDe(comoOUndici('ECONNRESET'))).toContain('ECONNRESET');
    expect(await descricaoDe(comoOUndici('ENOTFOUND'))).toContain('ENOTFOUND');
    expect(await descricaoDe(comoOUndici('CERT_HAS_EXPIRED'))).toContain('CERT_HAS_EXPIRED');
  });

  /**
   * O caso exato de 12 e 13 de setembro de 2026: oito fontes do Médio Tejo,
   * duas noites, `fetch failed` e mais nada. Com esta correção, a mesma noite
   * teria gravado o código — e ninguém teria precisado de ir bater aos
   * domínios à mão para saber que a ligação morria no aperto de mão TLS.
   */
  it('já não deixa «fetch failed» sozinho quando há causa', async () => {
    const descricao = await descricaoDe(comoOUndici('ECONNRESET'));
    expect(descricao).not.toBe('fetch failed');
    expect(descricao).toMatch(/^ECONNRESET: /);
  });

  it('sem causa nenhuma, diz o que há, e não inventa', async () => {
    expect(await descricaoDe(new Error('fetch failed'))).toBe('fetch failed');
  });

  it('o tempo esgotado continua a ser dito por palavras', async () => {
    const abortado = new Error('The operation was aborted');
    abortado.name = 'AbortError';
    expect(await descricaoDe(abortado)).toBe('tempo de resposta esgotado');
  });

  it('não entra em ciclo com uma causa que aponta para si própria', async () => {
    const erro = new Error('fetch failed') as Error & { cause?: unknown };
    erro.cause = erro;
    expect(await descricaoDe(erro as Error)).toBeTruthy();
  });

  it('atravessa dois níveis de embrulho', async () => {
    const fundo = new Error('EPROTO no aperto de mão') as Error & { code: string };
    fundo.code = 'EPROTO';
    const meio = new Error('socket hang up') as Error & { cause?: unknown };
    meio.cause = fundo;
    const fora = new Error('fetch failed') as Error & { cause?: unknown };
    fora.cause = meio;
    expect(await descricaoDe(fora)).toContain('EPROTO');
  });
});
