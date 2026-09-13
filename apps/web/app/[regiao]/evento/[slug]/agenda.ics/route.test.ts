import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventDetail } from '@/src/lib/queries/types';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';

/**
 * O calendário de um evento só, e a porta que a 0132 abriu sem lhe mexer.
 *
 * Esta rota chama o `getEvent` diretamente. Quando a 0132 fez o `getEvent`
 * devolver também o arquivo, esta rota passou a escrever compromissos em abril
 * para quem os pedisse — sem ninguém lhe ter tocado numa linha. É a única
 * superfície do sítio que alargou por arrasto, e a única que precisa do seu
 * próprio travão.
 *
 * A ficha do mesmo evento continua a responder 200: o que se serve é o registo
 * do que houve, e o que se recusa é o convite.
 */

const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
const getEvent = vi.hoisted(() => vi.fn<(regiao: string, slug: string) => Promise<unknown>>());
const loadEventContext = vi.hoisted(() => vi.fn());

vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao }));
vi.mock('@/src/lib/queries/events', () => ({ getEvent }));
vi.mock('@/src/lib/feeds/load', () => ({ loadEventContext }));

const { GET } = await import('./route');

function evento(status: string): Partial<EventDetail> {
  return {
    id: 'e1',
    slug: 'concerto-no-coreto',
    status,
    title: 'Concerto no coreto',
    date_start: '2026-04-18',
    date_end: null,
    sessions: [],
  };
}

const pedido = () =>
  GET(new Request('https://exemplo.pt/evento/concerto-no-coreto/agenda.ics'), {
    params: Promise.resolve({ regiao: 'medio-tejo', slug: 'concerto-no-coreto' }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  exigirRegiao.mockResolvedValue(REGIAO_DE_RECURSO);
  loadEventContext.mockResolvedValue({
    siteUrl: 'https://exemplo.pt',
    uidDomain: 'mediotejo.coreto.org',
    municipalityNames: {},
    venueNames: {},
    categoryNames: {},
    sessions: {},
    timestamps: {},
  });
});

describe('o calendário de um evento', () => {
  it('não escreve um compromisso para uma coisa que já aconteceu', async () => {
    getEvent.mockResolvedValue(evento('archived'));

    const resposta = await pedido();

    expect(resposta.status).toBe(404);
    expect(loadEventContext).not.toHaveBeenCalled();
  });

  it('e diz porquê, porque a ficha continua lá', async () => {
    getEvent.mockResolvedValue(evento('archived'));

    const resposta = await pedido();

    expect(await resposta.text()).toContain('já aconteceu');
  });

  it('mas um evento por acontecer continua a ter o seu calendário', async () => {
    getEvent.mockResolvedValue(evento('published'));

    const resposta = await pedido();

    expect(resposta.status).toBe(200);
    expect(loadEventContext).toHaveBeenCalled();
  });

  it('e um evento que não existe continua a ser um 404 seu', async () => {
    getEvent.mockResolvedValue(null);

    const resposta = await pedido();

    expect(resposta.status).toBe(404);
    expect(await resposta.text()).toContain('não encontrado');
  });
});
