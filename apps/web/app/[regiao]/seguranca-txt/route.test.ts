import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUTO } from '@/src/lib/produto';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';

/**
 * O `security.txt` de cada domínio.
 *
 * O que há a provar é pouco e é tudo sobre honestidade do ficheiro: que os
 * contactos não se repetem, que a validade está no futuro, e que a região que
 * responde é a do domínio — um `security.txt` que mande escrever para a caixa
 * de outra CIM é pior do que não ter nenhum.
 */

const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao }));
vi.mock('@/src/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/lib/env')>()),
  SITE_URL: 'https://coreto-de-prova.vercel.app',
}));

const { GET } = await import('./route');

const TRAVESSIA: Regiao = {
  ...REGIAO_DE_RECURSO,
  id: 'travessia',
  nome: 'Travessia do Zêzere',
  dominio: 'coreto.travessia.example',
  email: 'coreto@travessia.example',
};

const PEDIDO = new Request('https://coreto.travessia.example/.well-known/security.txt');

function contexto(regiao: string): { params: Promise<{ regiao: string }> } {
  return { params: Promise.resolve({ regiao }) };
}

function linhas(texto: string): string[] {
  return texto.split('\n').filter((linha) => linha.length > 0 && !linha.startsWith('#'));
}

describe('GET /.well-known/security.txt', () => {
  beforeEach(() => {
    exigirRegiao.mockReset().mockResolvedValue(TRAVESSIA);
  });

  it('traz o contacto do produto e o da região, por essa ordem', async () => {
    const texto = await (await GET(PEDIDO, contexto('travessia'))).text();

    expect(linhas(texto).slice(0, 2)).toEqual([
      `Contact: mailto:${PRODUTO.email}`,
      'Contact: mailto:coreto@travessia.example',
    ]);
  });

  it('quando os dois endereços são o mesmo, a linha não se repete', async () => {
    // É o caso da região montra, onde o contacto da região É o do produto —
    // e onde saía a mesma linha duas vezes, visto em produção.
    exigirRegiao.mockResolvedValue({ ...TRAVESSIA, email: PRODUTO.email });

    const texto = await (await GET(PEDIDO, contexto('travessia'))).text();
    const contactos = linhas(texto).filter((linha) => linha.startsWith('Contact:'));

    expect(contactos).toEqual([`Contact: mailto:${PRODUTO.email}`]);
  });

  it('a validade está no futuro, e é a mesma dentro do mesmo mês', async () => {
    const texto = await (await GET(PEDIDO, contexto('travessia'))).text();
    const expira = linhas(texto)
      .find((linha) => linha.startsWith('Expires:'))
      ?.slice(9);

    expect(expira).toBeDefined();
    expect(Date.parse(expira as string)).toBeGreaterThan(Date.now());
    // Ancorada, não «agora mais seis meses»: duas leituras da mesma hora têm
    // de dar o mesmo ficheiro, senão nenhuma cache o consegue comparar.
    const segunda = await (await GET(PEDIDO, contexto('travessia'))).text();
    expect(segunda).toBe(texto);
  });

  it('o canónico e a política são do domínio desta região, não de outra', async () => {
    const texto = await (await GET(PEDIDO, contexto('travessia'))).text();

    expect(texto).toContain('Canonical: https://coreto.travessia.example/.well-known/security.txt');
    expect(texto).toContain('Policy: https://coreto.travessia.example/privacidade');
    expect(texto).not.toContain('mediotejo');
  });

  it('é texto simples em UTF-8, e guarda-se uma hora na rede', async () => {
    const resposta = await GET(PEDIDO, contexto('travessia'));

    expect(resposta.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(resposta.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    );
  });
});
