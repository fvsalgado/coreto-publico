import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegionAdminRow } from '@/src/lib/admin/queries';
import type { RelatorioMensal } from '@/src/lib/admin/relatorio';

/**
 * A primeira rota de servidor debaixo de `/admin`, e o que ela promete: não
 * dá o ficheiro a quem não tem sessão, não inventa um mês nem uma região a
 * partir de um endereço errado, e o que dá vem como descarga com o nome da
 * região e do mês, sem cache. O CSV em si prova-se em `relatorio.test.ts`;
 * aqui o que se prende é a porta e o envelope.
 *
 * A sessão e as leituras estão substituídas: uma rota que exige sessão só se
 * testa fingindo as duas respostas da sessão.
 */

const requireAdmin = vi.hoisted(() => vi.fn<() => Promise<string>>());
const listRegionsAdmin = vi.hoisted(() => vi.fn<() => Promise<RegionAdminRow[]>>());
const monthlyReport = vi.hoisted(() =>
  vi.fn<(regiao: string, mes: string) => Promise<RelatorioMensal>>(),
);
const servico = vi.hoisted(() => ({ ligado: true }));

vi.mock('@/src/lib/admin/auth', () => ({ requireAdmin }));
vi.mock('@/src/lib/admin/queries', () => ({ listRegionsAdmin, monthlyReport }));
vi.mock('@/src/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/src/lib/env')>()),
  get hasServiceRole() {
    return servico.ligado;
  },
}));

const { GET } = await import('./route');

function regiao(id: string, kind = 'cim'): RegionAdminRow {
  return { id, name: id, kind } as RegionAdminRow;
}

const RELATORIO: RelatorioMensal = {
  region: { id: 'medio-tejo', name: 'Médio Tejo' },
  month: '2026-08',
  generated_at: '2026-09-02T09:15:00+00:00',
  events: {
    published_in_month: [],
    happening_in_month: [{ municipality_id: 'tomar', municipality_name: 'Tomar', count: 3 }],
    totals: { published_in_month: 0, happening_in_month: 3, published_now: 40 },
  },
  sources: [],
  territory: {
    municipalities: 2,
    parishes: 8,
    municipal_sources_enabled: 2,
    parish_sources_enabled: 1,
  },
  submissions: {
    received_by_channel: { scraper: 0, email: 1, form: 0 },
    received: 1,
    reviewed: { approved: 0, rejected: 0, other: 0 },
  },
  quality: [],
  visits: { available: false, from: null, to: null, clicks_since: null, by_municipality: [] },
};

function pedido(query = ''): Request {
  return new Request(`https://coreto.mediotejo.pt/admin/relatorios/relatorio.csv${query}`);
}

describe('GET /admin/relatorios/relatorio.csv', () => {
  beforeEach(() => {
    servico.ligado = true;
    requireAdmin.mockReset().mockResolvedValue('fvsalgado');
    listRegionsAdmin
      .mockReset()
      .mockResolvedValue([regiao('vale-do-coreto', 'montra'), regiao('medio-tejo')]);
    monthlyReport.mockReset().mockResolvedValue(RELATORIO);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não dá o ficheiro a quem não tem sessão — um 401, e não um redirecionamento', async () => {
    requireAdmin.mockRejectedValue(new Error('sessão de administração em falta'));

    const resposta = await GET(pedido('?regiao=medio-tejo&mes=2026-08'));

    expect(resposta.status).toBe(401);
    expect(resposta.headers.get('Cache-Control')).toBe('no-store');
    await expect(resposta.json()).resolves.toEqual({ erro: 'sessão de administração em falta' });
    expect(listRegionsAdmin).not.toHaveBeenCalled();
    expect(monthlyReport).not.toHaveBeenCalled();
  });

  it('sem chave de serviço não há relatório que ler', async () => {
    servico.ligado = false;

    expect((await GET(pedido('?regiao=medio-tejo&mes=2026-08'))).status).toBe(503);
    expect(monthlyReport).not.toHaveBeenCalled();
  });

  it('recusa um mês que não se lê e uma região que não existe, em vez de os corrigir', async () => {
    expect((await GET(pedido('?regiao=medio-tejo&mes=agosto'))).status).toBe(400);
    expect((await GET(pedido('?regiao=medio-tejo&mes=2026-8'))).status).toBe(400);
    expect((await GET(pedido('?regiao=beira-baixa&mes=2026-08'))).status).toBe(404);
    expect(monthlyReport).not.toHaveBeenCalled();
  });

  it('entrega o CSV como descarga, com o nome da região e do mês, sem cache', async () => {
    const resposta = await GET(pedido('?regiao=medio-tejo&mes=2026-08'));

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(resposta.headers.get('Content-Disposition')).toBe(
      'attachment; filename="coreto-medio-tejo-2026-08.csv"',
    );
    expect(resposta.headers.get('Cache-Control')).toBe('no-store');
    expect(monthlyReport).toHaveBeenCalledWith('medio-tejo', '2026-08');

    // O BOM vê-se nos bytes: `text()` descodifica em UTF-8 e come-o pelo
    // caminho, como qualquer leitor faz — é por isso que o Excel o quer lá.
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    const corpo = new TextDecoder().decode(bytes);
    expect(corpo.startsWith('seccao;chave;valor')).toBe(true);
    expect(corpo).toContain('relatorio;mes;2026-08');
    expect(corpo).toContain('eventos_a_decorrer_no_mes;tomar;Tomar;3');
  });

  it('sem parâmetros, é o mês passado da primeira região que não é a montra', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T10:00:00Z'));

    const resposta = await GET(pedido());

    expect(resposta.status).toBe(200);
    expect(monthlyReport).toHaveBeenCalledWith('medio-tejo', '2026-08');
    expect(resposta.headers.get('Content-Disposition')).toBe(
      'attachment; filename="coreto-medio-tejo-2026-08.csv"',
    );
  });

  it('uma leitura falhada rebenta em vez de entregar um ficheiro a zeros', async () => {
    monthlyReport.mockRejectedValue(new Error('monthly_report: ligação recusada'));

    await expect(GET(pedido('?regiao=medio-tejo&mes=2026-08'))).rejects.toThrow('ligação recusada');
  });
});
