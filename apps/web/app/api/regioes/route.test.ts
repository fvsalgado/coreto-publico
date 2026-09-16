import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';

/**
 * O mapa que o middleware lê para saber de quem é cada Host.
 *
 * É a rota mais pequena do sítio e a que mais custa quando erra: uma região
 * que saia daqui sem domínio, ou com o domínio de outra, é cada pedido a ser
 * reescrito para a agenda errada durante os cinco minutos que o middleware
 * guarda o mapa. O que aqui se prende é a forma da resposta — quatro campos e
 * mais nenhum — e a regra de degradação, que é não degradar: quem sabe
 * recuperar de uma leitura falhada é o middleware, e para isso tem de a ver.
 *
 * O quarto campo é a barreira (0157), e entrou aqui por caber aqui: o
 * middleware precisa de saber que uma região está tapada **antes** de desenhar
 * o que quer que seja, e esta é a leitura que ele já faz. Que uma região tem
 * barreira não é segredo — a página de entrada anuncia-o a quem lá bate; a
 * senha é que não viaja, e vive noutra tabela sem concessões ao público.
 *
 * As leituras estão substituídas. O que se prova é a tradução para o mapa,
 * não a consulta — essa vive em `queries/regioes.ts`.
 */

const listRegioes = vi.hoisted(() => vi.fn<() => Promise<Regiao[]>>());
const aliasesDasRegioes = vi.hoisted(() => vi.fn<() => Promise<Record<string, string[]>>>());

vi.mock('@/src/lib/queries/regioes', () => ({ listRegioes, aliasesDasRegioes }));

const { GET } = await import('./route');

const MEDIO_TEJO: Regiao = {
  ...REGIAO_DE_RECURSO,
  id: 'medio-tejo',
  dominio: 'coreto.mediotejo.pt',
};
const TRAVESSIA: Regiao = {
  ...REGIAO_DE_RECURSO,
  id: 'travessia',
  dominio: 'coreto.travessia.example',
};

async function mapa(): Promise<Array<Record<string, unknown>>> {
  const resposta = await GET();
  expect(resposta.status).toBe(200);
  return (await resposta.json()) as Array<Record<string, unknown>>;
}

describe('GET /api/regioes', () => {
  beforeEach(() => {
    listRegioes.mockReset().mockResolvedValue([MEDIO_TEJO, TRAVESSIA]);
    aliasesDasRegioes.mockReset().mockResolvedValue({ 'medio-tejo': ['mediotejo.coreto.org'] });
  });

  it('dá cada região com o identificador, o domínio canónico e os alias, pela ordem da base', async () => {
    // Uma região sem alias leva a lista vazia: o contrato diz que o campo
    // está sempre lá, e um contrato não se cumpre pelo lado de quem o tolera.
    await expect(mapa()).resolves.toEqual([
      {
        id: 'medio-tejo',
        domain: 'coreto.mediotejo.pt',
        aliases: ['mediotejo.coreto.org'],
        barreira: false,
      },
      { id: 'travessia', domain: 'coreto.travessia.example', aliases: [], barreira: false },
    ]);
  });

  it('diz quais as regiões com barreira, que é o que o middleware precisa de saber', async () => {
    // Sem este campo o middleware não teria como saber que uma região está
    // tapada sem ir à base a cada pedido — e ir à base a cada pedido é o que
    // este mapa existe para não fazer.
    listRegioes.mockResolvedValue([{ ...MEDIO_TEJO, barreiraLigada: true }, TRAVESSIA]);
    const linhas = await mapa();
    expect(linhas.map((linha) => [linha.id, linha.barreira])).toEqual([
      ['medio-tejo', true],
      ['travessia', false],
    ]);
  });

  it('não deixa passar o resto da identidade da região', async () => {
    // Quem encaminha não desenha páginas: o promotor, a prosa e as cores
    // ficam para quem as lê — e o mapa, que viaja em todos os pedidos, leve.
    const [primeira] = await mapa();
    expect(Object.keys(primeira ?? {})).toEqual(['id', 'domain', 'aliases', 'barreira']);
  });

  it('manda a rede guardar uma hora e servir o velho enquanto refaz', async () => {
    expect((await GET()).headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    );
  });

  it('uma leitura falhada rebenta em vez de responder um mapa vazio', async () => {
    // Um mapa vazio guardado uma hora é o Coreto a não conhecer nenhuma CIM
    // durante essa hora. Um erro é o middleware a ficar com o mapa que já
    // tinha e a voltar a perguntar daí a trinta segundos.
    listRegioes.mockRejectedValue(new Error('listRegioes: ligação recusada'));
    await expect(GET()).rejects.toThrow('ligação recusada');
  });
});
