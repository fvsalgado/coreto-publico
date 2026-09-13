import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';
import type { EventDetail } from '@/src/lib/queries/types';

/**
 * O cartão de partilha de um evento sem cartaz.
 *
 * O que este teste tem de provar é que a imagem **desenha**. Um `og:image`
 * declarado nos metadados e a responder 500 é pior do que nenhum: as redes
 * guardam o falhanço e a partilha fica sem imagem durante dias. E o desenho é
 * a parte que nenhum `tsc` verifica — o Satori tem regras próprias (todo o
 * filho de um contentor com mais de um elemento precisa de `display`
 * explícito) que só rebentam ao executar.
 *
 * Por isso o teste vai até ao fim e lê os bytes: um PNG começa por uma
 * assinatura de oito bytes, e é ela que distingue «desenhou» de «devolveu uma
 * página de erro com o tipo certo».
 */

const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
const getEvent = vi.hoisted(() => vi.fn());
const listMunicipalities = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn((): never => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);

vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao }));
vi.mock('@/src/lib/queries/events', () => ({ getEvent, listMunicipalities }));
vi.mock('next/navigation', () => ({ notFound }));

const { GET } = await import('./route');

const EVENTO = {
  id: 'e1',
  slug: 'concerto-no-coreto',
  title: 'Concerto de Ano Novo pela Filarmónica',
  date_start: '2026-07-15',
  date_end: null,
  location_name: 'Coreto do Jardim',
  municipality_id: 'tomar',
  image_url: null,
} as unknown as EventDetail;

function contexto(regiao: string, slug: string) {
  return { params: Promise.resolve({ regiao, slug }) };
}

const PEDIDO = new Request('https://coreto.exemplo.pt/cartaz/concerto-no-coreto');

/** Os oito bytes com que qualquer PNG começa. */
const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('GET /cartaz/[slug]', () => {
  beforeEach(() => {
    exigirRegiao.mockReset().mockResolvedValue(REGIAO_DE_RECURSO);
    getEvent.mockReset().mockResolvedValue(EVENTO);
    listMunicipalities
      .mockReset()
      .mockResolvedValue([{ id: 'tomar', name: 'Tomar', district: 'Santarém' }]);
    notFound.mockClear();
  });

  it('desenha um PNG de verdade, e não uma página de erro', async () => {
    const resposta = await GET(PEDIDO, contexto('medio-tejo', 'concerto-no-coreto'));

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('Content-Type')).toContain('image/png');

    const bytes = new Uint8Array(await resposta.arrayBuffer());
    expect([...bytes.slice(0, 8)]).toEqual(ASSINATURA_PNG);
    // Um PNG de 1200×630 com texto não cabe em dois kilobytes; um erro
    // serializado cabe. É o que separa «desenhou» de «devolveu qualquer coisa».
    expect(bytes.byteLength).toBeGreaterThan(2000);
  }, 30_000);

  it('um título comprido não parte o desenho', async () => {
    getEvent.mockResolvedValue({
      ...EVENTO,
      title:
        'Concerto solidário de Ano Novo pela Banda Filarmónica União e Progresso ' +
        'da Freguesia de Nossa Senhora da Piedade, com a participação do Rancho',
    });

    const resposta = await GET(PEDIDO, contexto('medio-tejo', 'concerto-no-coreto'));
    expect(resposta.status).toBe(200);
  }, 30_000);

  it('sem sítio nem data, ainda assim desenha — um campo em falta não é um erro', async () => {
    getEvent.mockResolvedValue({
      ...EVENTO,
      date_start: null,
      date_end: null,
      location_name: null,
      municipality_id: 'nao-existe',
    });

    const resposta = await GET(PEDIDO, contexto('medio-tejo', 'concerto-no-coreto'));
    expect(resposta.status).toBe(200);
  }, 30_000);

  it('um evento que não existe é 404, e a rota não desenha nada', async () => {
    getEvent.mockResolvedValue(null);

    await expect(GET(PEDIDO, contexto('medio-tejo', 'nao-existe'))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });
});
