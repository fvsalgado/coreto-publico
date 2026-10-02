import { describe, expect, it } from 'vitest';
import { erroEmPortugues, estadoDaFonte } from './fontes';

describe('as fontes, ditas a quem gere uma região (C4-032)', () => {
  it('o erro do servidor diz-se em português', () => {
    expect(erroEmPortugues('fetch failed: ECONNRESET')).toMatch(/recusou ou cortou a ligação/);
    expect(erroEmPortugues('UND_ERR_CONNECT_TIMEOUT')).toMatch(/demorou de mais/);
    expect(erroEmPortugues('HTTP 403 Forbidden')).toMatch(/recusar os nossos pedidos/);
    expect(erroEmPortugues('HTTP 404')).toMatch(/mudou de sítio/);
    expect(
      erroEmPortugues(
        'contagem suspeita: 0 itens contra uma linha de base de 10 (mínimo esperado 1)',
      ),
    ).toMatch(/mudado de forma/);
    expect(
      erroEmPortugues('a fonte não respondeu a nenhum dos 3 pedidos — não se leu nada'),
    ).toMatch(/não respondeu a nenhum pedido/);
  });

  it('um erro que não se reconhece fica por traduzir, e mostra-se como veio', () => {
    expect(erroEmPortugues('TypeError: x is not a function')).toBeNull();
    expect(erroEmPortugues(null)).toBeNull();
  });

  it('o estado: desligada, em pausa com data, pausa automática, parada', () => {
    const base = {
      is_enabled: true,
      em_pausa: false,
      pausada_ate: null,
      breaker_open: false,
      circuit_open_until: null,
      is_stale: false,
    };
    expect(estadoDaFonte({ ...base, is_enabled: false }).rotulo).toBe('desligada');
    expect(
      estadoDaFonte({ ...base, em_pausa: true, pausada_ate: '2026-10-21T22:59:59Z' }).rotulo,
    ).toBe('em pausa até 21 de outubro de 2026');
    expect(
      estadoDaFonte({ ...base, breaker_open: true, circuit_open_until: '2026-10-03T10:00:00Z' }),
    ).toEqual({
      rotulo: 'em pausa automática até 3 de outubro de 2026',
      alerta: true,
    });
    expect(estadoDaFonte({ ...base, is_stale: true })).toEqual({ rotulo: 'parada', alerta: true });
    expect(estadoDaFonte(base).rotulo).toBe('a ser lida');
  });
});
