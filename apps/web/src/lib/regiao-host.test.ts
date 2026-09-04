import { afterEach, describe, expect, it } from 'vitest';
import {
  REGIAO_PARA_HOSTS_DESCONHECIDOS,
  REGIAO_PRINCIPAL,
  VALIDADE_DO_MAPA_MS,
  dominiosDasRegioes,
  esquecerMapaDeDominios,
  normalizarHost,
  redirecionamentosDosDominios,
  regiaoDoHost,
} from './regiao-host';

const DOMINIOS = {
  'coreto.mediotejo.pt': 'medio-tejo',
  'coreto.travessia.example': 'travessia',
};

describe('normalizarHost', () => {
  it('tira o porto e baixa a caixa', () => {
    expect(normalizarHost('Coreto.MedioTejo.PT:443')).toBe('coreto.mediotejo.pt');
    expect(normalizarHost('localhost:3000')).toBe('localhost');
  });

  it('aguenta um IPv6 entre parêntesis retos', () => {
    expect(normalizarHost('[::1]:3000')).toBe('[::1]');
  });

  it('devolve null ao que não é um host', () => {
    expect(normalizarHost(null)).toBeNull();
    expect(normalizarHost('   ')).toBeNull();
  });
});

describe('regiaoDoHost', () => {
  it('traduz um domínio conhecido para a sua região', () => {
    expect(regiaoDoHost('coreto.mediotejo.pt', DOMINIOS)).toBe('medio-tejo');
    expect(regiaoDoHost('coreto.travessia.example:443', DOMINIOS)).toBe('travessia');
  });

  it('o que não se reconhece não vale região nenhuma', () => {
    // A regra que substituiu «tudo o que não se reconhece cai na região de
    // omissão»: um preview do Vercel, o localhost, um Host esquisito — nenhum
    // deles é o domínio de uma CIM, e por isso nenhum vê a agenda de uma. Sem
    // região, o middleware serve a página estática do produto.
    expect(regiaoDoHost('coreto-abc123.vercel.app', DOMINIOS)).toBeNull();
    expect(regiaoDoHost('localhost:3000', DOMINIOS)).toBeNull();
    expect(regiaoDoHost(null, DOMINIOS)).toBeNull();
  });

  it('com o mapa vazio, nem o domínio da própria região serve outra', () => {
    // O cenário que esta regra fecha: a leitura de `/api/regioes` falha, o
    // mapa fica vazio trinta segundos e TODOS os anfitriões passam a
    // desconhecidos. Com a omissão antiga, quem visitasse a Travessia via o
    // Médio Tejo no domínio da Travessia — servir a agenda de uma CIM no
    // domínio de outra não tem preço que o pague. Agora não vê região nenhuma.
    expect(regiaoDoHost('coreto.mediotejo.pt', {})).toBeNull();
    expect(regiaoDoHost('coreto.travessia.example', {})).toBeNull();
  });

  it('não adivinha subdomínios: www não é o domínio da região', () => {
    expect(regiaoDoHost('www.coreto.mediotejo.pt', DOMINIOS)).toBeNull();
  });

  it('a escotilha do deployment serve os desconhecidos, quando está aberta', () => {
    // Com `REGIAO_DE_OMISSAO` no ambiente volta o comportamento antigo, agora
    // pedido por extenso: é o que mantém o `coreto-sage.vercel.app` e o
    // localhost a mostrar o Médio Tejo enquanto não houver domínio próprio.
    expect(regiaoDoHost('coreto-sage.vercel.app', DOMINIOS, 'medio-tejo')).toBe('medio-tejo');
    expect(regiaoDoHost(null, DOMINIOS, 'medio-tejo')).toBe('medio-tejo');
    expect(regiaoDoHost('coreto.mediotejo.pt', {}, 'vale-do-coreto')).toBe('vale-do-coreto');
  });

  it('a escotilha não rouba um domínio a quem o tem', () => {
    // Aberta ou fechada, um Host que está no mapa é sempre da sua região: a
    // escotilha só responde por quem não está lá.
    expect(regiaoDoHost('coreto.travessia.example', DOMINIOS, 'medio-tejo')).toBe('travessia');
  });

  it('os dois papéis da mesma variável: um tem sempre resposta, o outro pode não ter', () => {
    // A região principal do deployment nomeia sempre alguém — é dela a
    // identidade que o sítio veste, e há meia dúzia de sítios que precisam de
    // um identificador válido. A escotilha, essa, ou está fechada ou nomeia
    // exatamente essa mesma região: sai da mesma variável de ambiente, lida
    // com dois contratos, e é isso que impede um deployment de mostrar aos
    // anfitriões desconhecidos uma região que não é a sua.
    expect(REGIAO_PRINCIPAL.length).toBeGreaterThan(0);
    expect(
      REGIAO_PARA_HOSTS_DESCONHECIDOS === null ||
        REGIAO_PARA_HOSTS_DESCONHECIDOS === REGIAO_PRINCIPAL,
    ).toBe(true);
  });
});

describe('dominiosDasRegioes', () => {
  afterEach(() => {
    esquecerMapaDeDominios();
  });

  function respostaCom(linhas: unknown): typeof fetch {
    return (async () =>
      new Response(JSON.stringify(linhas), { status: 200 })) as unknown as typeof fetch;
  }

  it('lê o mapa de /api/regioes e normaliza os domínios', async () => {
    const dominios = await dominiosDasRegioes(
      'https://exemplo.pt',
      respostaCom([
        { id: 'medio-tejo', domain: 'Coreto.MedioTejo.PT' },
        { id: 'travessia', domain: 'coreto.travessia.example' },
      ]),
    );
    expect(dominios).toEqual(DOMINIOS);
  });

  it('guarda o mapa e não volta a perguntar dentro da validade', async () => {
    let chamadas = 0;
    const buscar = (async () => {
      chamadas += 1;
      return new Response(JSON.stringify([{ id: 'medio-tejo', domain: 'coreto.mediotejo.pt' }]), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    let relogio = 0;
    const agora = () => relogio;

    await dominiosDasRegioes('https://exemplo.pt', buscar, agora);
    relogio += VALIDADE_DO_MAPA_MS - 1;
    await dominiosDasRegioes('https://exemplo.pt', buscar, agora);
    expect(chamadas).toBe(1);

    relogio += 2;
    await dominiosDasRegioes('https://exemplo.pt', buscar, agora);
    expect(chamadas).toBe(2);
  });

  it('numa falha devolve o vazio e volta a tentar depressa — sem martelar', async () => {
    let chamadas = 0;
    const falha = (async () => {
      chamadas += 1;
      throw new Error('rede fora');
    }) as unknown as typeof fetch;

    let relogio = 0;
    const agora = () => relogio;

    expect(await dominiosDasRegioes('https://exemplo.pt', falha, agora)).toEqual({});
    // Dentro da janela curta de falha, não se volta a perguntar.
    relogio += 1000;
    expect(await dominiosDasRegioes('https://exemplo.pt', falha, agora)).toEqual({});
    expect(chamadas).toBe(1);
    // Passada a janela, tenta outra vez.
    relogio += 60 * 1000;
    await dominiosDasRegioes('https://exemplo.pt', falha, agora);
    expect(chamadas).toBe(2);
  });

  it('separa canónicos de alias: o alias redireciona, nunca serve', async () => {
    const buscar = respostaCom([
      {
        id: 'medio-tejo',
        domain: 'coreto.mediotejo.pt',
        aliases: ['MedioTejo.Coreto.ORG:443', 'coreto.mediotejo.pt'],
      },
    ]);

    const dominios = await dominiosDasRegioes('https://exemplo.pt', buscar);
    const redirecionamentos = await redirecionamentosDosDominios('https://exemplo.pt', buscar);

    // O alias não entra no mapa de quem serve…
    expect(dominios).toEqual({ 'coreto.mediotejo.pt': 'medio-tejo' });
    // …entra no de quem redireciona, normalizado — e um alias igual ao
    // canónico é ignorado, que redirecionar para si mesmo era um laço.
    expect(redirecionamentos).toEqual({ 'mediotejo.coreto.org': 'coreto.mediotejo.pt' });
  });

  it('um mapa sem alias continua a ler-se — a chave é opcional', async () => {
    const redirecionamentos = await redirecionamentosDosDominios(
      'https://exemplo.pt',
      respostaCom([{ id: 'medio-tejo', domain: 'coreto.mediotejo.pt' }]),
    );
    expect(redirecionamentos).toEqual({});
  });

  it('uma falha depois de um mapa bom mantém o mapa velho', async () => {
    let relogio = 0;
    const agora = () => relogio;
    await dominiosDasRegioes(
      'https://exemplo.pt',
      respostaCom([{ id: 'medio-tejo', domain: 'coreto.mediotejo.pt' }]),
      agora,
    );
    relogio += VALIDADE_DO_MAPA_MS + 1;
    const falha = (async () => {
      throw new Error('rede fora');
    }) as unknown as typeof fetch;
    const dominios = await dominiosDasRegioes('https://exemplo.pt', falha, agora);
    // Um mapa velho serve melhor do que nenhum: as regiões continuam a
    // responder pelo seu domínio enquanto a leitura não volta.
    expect(dominios).toEqual({ 'coreto.mediotejo.pt': 'medio-tejo' });
  });
});
