import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * O limitador sem base de dados: deixa passar onde isso é inofensivo, e
 * conta na memória onde deixar passar é o ataque.
 *
 * O `adminClient` vem substituído por um que não existe, que é o caso de um
 * processo sem `SUPABASE_SERVICE_ROLE_KEY` — e o mesmo caminho que se toma
 * quando a função da base falha.
 */
vi.mock('./supabase/server', () => ({ adminClient: () => null }));
vi.mock('./registo', () => ({ reportarErro: vi.fn() }));

const { checkRateLimit, contarEmMemoria, esquecerMemoriaDeTrafego } = await import('./rate-limit');

function pedido(ip = '198.51.100.7'): Request {
  return new Request('https://exemplo.test/', { headers: { 'x-forwarded-for': ip } });
}

beforeEach(() => esquecerMemoriaDeTrafego());
afterEach(() => vi.useRealTimers());

describe('checkRateLimit sem base', () => {
  it('por omissão deixa passar — uma avaria nossa não fecha o sítio', async () => {
    for (let i = 0; i < 20; i++) {
      const r = await checkRateLimit(pedido(), { route: 'leitura', limit: 3, windowSeconds: 60 });
      expect(r.allowed).toBe(true);
    }
  });

  // O caso que motivou isto: o login do painel sem trava sempre que a chave
  // de serviço faltava. Cinco por quarto de hora tem de ser cinco.
  it('com falhaFechada conta na memória e recusa a partir do limite', async () => {
    const opcoes = { route: 'admin-login', limit: 5, windowSeconds: 900, falhaFechada: true };
    const resultados = [];
    for (let i = 0; i < 6; i++) resultados.push(await checkRateLimit(pedido(), opcoes));
    expect(resultados.map((r) => r.allowed)).toEqual([true, true, true, true, true, false]);
    expect(resultados[5]?.hits).toBe(6);
    expect(resultados[5]?.resetAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('os baldes são por rota e por visitante', async () => {
    const opcoes = { route: 'portao:x', limit: 1, windowSeconds: 900, falhaFechada: true };
    expect((await checkRateLimit(pedido('198.51.100.7'), opcoes)).allowed).toBe(true);
    expect((await checkRateLimit(pedido('198.51.100.7'), opcoes)).allowed).toBe(false);
    expect((await checkRateLimit(pedido('198.51.100.8'), opcoes)).allowed).toBe(true);
    expect(
      (await checkRateLimit(pedido('198.51.100.7'), { ...opcoes, route: 'portao:y' })).allowed,
    ).toBe(true);
  });
});

describe('contarEmMemoria', () => {
  it('a janela fecha e volta a abrir', () => {
    const t0 = Date.parse('2026-09-19T10:00:00Z');
    expect(contarEmMemoria('b', 60, 1, t0).allowed).toBe(true);
    expect(contarEmMemoria('b', 60, 1, t0 + 59_000).allowed).toBe(false);
    expect(contarEmMemoria('b', 60, 1, t0 + 60_000).allowed).toBe(true);
  });

  it('não cresce sem fim: esquece os expirados antes de abrir mais um', () => {
    const t0 = Date.parse('2026-09-19T10:00:00Z');
    for (let i = 0; i < 10_000; i++) contarEmMemoria(`b${i}`, 1, 1, t0);
    // Todos expiraram um segundo depois; o 10 001.º não pode estourar nada.
    const r = contarEmMemoria('novo', 1, 1, t0 + 1_000);
    expect(r.allowed).toBe(true);
    expect(r.hits).toBe(1);
  });
});
