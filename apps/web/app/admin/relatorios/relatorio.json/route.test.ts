import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegionAdminRow } from '@/src/lib/admin/queries';
import type { RelatorioMensal } from '@/src/lib/admin/relatorio';

/**
 * A rota em JSON partilha a porta com a do CSV (`exportar-relatorio.ts`), e é
 * lá que a porta se prova. O que aqui se prende é o que só esta promete: o
 * JSON é o da base, sem tradução, e sai como descarga com o nome certo.
 */

const requireAdmin = vi.hoisted(() => vi.fn<() => Promise<string>>());
const listRegionsAdmin = vi.hoisted(() => vi.fn<() => Promise<RegionAdminRow[]>>());
const monthlyReport = vi.hoisted(() =>
  vi.fn<(regiao: string, mes: string) => Promise<RelatorioMensal>>(),
);

vi.mock('@/src/lib/admin/auth', () => ({ requireAdmin }));
vi.mock('@/src/lib/admin/queries', () => ({ listRegionsAdmin, monthlyReport }));
vi.mock('@/src/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/lib/env')>()),
  hasServiceRole: true,
}));

const { GET } = await import('./route');

const RELATORIO: RelatorioMensal = {
  region: { id: 'travessia', name: 'Travessia do Zêzere' },
  month: '2026-08',
  generated_at: '2026-09-02T09:15:00+00:00',
  events: {
    published_in_month: [],
    happening_in_month: [],
    totals: { published_in_month: 0, happening_in_month: 0, published_now: 0 },
  },
  sources: [],
  territory: {
    municipalities: 2,
    parishes: 8,
    municipal_sources_enabled: 2,
    parish_sources_enabled: 1,
  },
  submissions: {
    received_by_channel: { scraper: 0, email: 0, form: 0 },
    received: 0,
    reviewed: { approved: 0, rejected: 0, other: 0 },
  },
  quality: [],
  visits: {
    available: true,
    from: '2026-08-01',
    to: '2026-09-01',
    clicks_since: null,
    by_municipality: [],
  },
};

function pedido(query: string): Request {
  return new Request(`https://coreto.mediotejo.pt/admin/relatorios/relatorio.json${query}`);
}

describe('GET /admin/relatorios/relatorio.json', () => {
  beforeEach(() => {
    requireAdmin.mockReset().mockResolvedValue('fvsalgado');
    listRegionsAdmin
      .mockReset()
      .mockResolvedValue([{ id: 'travessia', name: 'Travessia', kind: 'cim' } as RegionAdminRow]);
    monthlyReport.mockReset().mockResolvedValue(RELATORIO);
  });

  it('sem sessão é um 401 em JSON, sem tocar na base', async () => {
    requireAdmin.mockRejectedValue(new Error('sessão de administração em falta'));

    const resposta = await GET(pedido('?regiao=travessia&mes=2026-08'));

    expect(resposta.status).toBe(401);
    expect(monthlyReport).not.toHaveBeenCalled();
  });

  it('entrega o JSON da base tal e qual, como descarga e sem cache', async () => {
    const resposta = await GET(pedido('?regiao=travessia&mes=2026-08'));

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(resposta.headers.get('Content-Disposition')).toBe(
      'attachment; filename="coreto-travessia-2026-08.json"',
    );
    expect(resposta.headers.get('Cache-Control')).toBe('no-store');
    expect(monthlyReport).toHaveBeenCalledWith('travessia', '2026-08');

    const corpo = await resposta.text();
    // Indentado: também se lê à mão.
    expect(corpo).toContain('\n  "region": {');
    expect(JSON.parse(corpo)).toEqual(RELATORIO);
  });

  it('um mês que não se lê é um 400, e uma região que não existe um 404', async () => {
    expect((await GET(pedido('?regiao=travessia&mes=2026-13'))).status).toBe(400);
    expect((await GET(pedido('?regiao=nao-existe&mes=2026-08'))).status).toBe(404);
    expect(monthlyReport).not.toHaveBeenCalled();
  });
});
