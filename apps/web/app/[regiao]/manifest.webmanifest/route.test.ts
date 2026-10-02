import type { MetadataRoute } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CORES_DO_TOLDO } from '@/src/lib/marca';
import { REGIAO_DE_RECURSO, descricaoDoSitio, tituloDoSitio, type Regiao } from '@/src/lib/regiao';

/**
 * O manifesto que faz da agenda uma aplicação instalável.
 *
 * O que se prende aqui são as decisões que o comentário da rota diz serem
 * deliberadas — e que ninguém repararia se se perdessem: o nome é o da região
 * em que responde (quem instala a Travessia não fica com o Médio Tejo no
 * ecrã), o toldo é o da região e não o da montra, a orientação não se prende
 * e não há capturas de ecrã com datas que envelhecem. Um manifesto errado
 * não dá erro nenhum: dá um ícone com o nome errado no telemóvel de alguém.
 */

const exigirRegiao = vi.hoisted(() => vi.fn<(id: string) => Promise<Regiao>>());
// A cor vem da base (0167). Aqui faz o que a leitura faz com a coluna vazia —
// o toldo da casa, ou o do produto na montra —, e cada teste que precise de
// uma cor declarada di-la.
const toldoDaRegiao = vi.hoisted(() =>
  vi.fn<(regiao: Pick<Regiao, 'id' | 'tipo'>) => Promise<string>>(),
);

vi.mock('@/src/lib/queries/regioes', () => ({ exigirRegiao, toldoDaRegiao }));

const { GET } = await import('./route');

/**
 * Uma segunda região, montada sobre a de recurso com o que esta rota lê.
 *
 * Não é o Médio Tejo de propósito: qualquer «Médio Tejo» que apareça no
 * manifesto da Travessia é uma fuga entre regiões, não uma coincidência.
 */
const TRAVESSIA: Regiao = {
  ...REGIAO_DE_RECURSO,
  id: 'travessia',
  nome: 'Travessia do Zêzere',
  artigo: 'a',
  doNome: 'da Travessia do Zêzere',
  noNome: 'na Travessia do Zêzere',
  dominio: 'coreto.travessia.example',
  email: 'coreto@travessia.example',
  dominioDosUid: 'coreto.travessia.example',
  tagline: null,
  concelhosDeclarados: 2,
  concelhosPorExtenso: 'dois',
};

const PEDIDO = new Request('https://coreto.travessia.example/manifest.webmanifest');

function contexto(regiao: string): { params: Promise<{ regiao: string }> } {
  return { params: Promise.resolve({ regiao }) };
}

async function manifesto(regiao: Regiao): Promise<MetadataRoute.Manifest> {
  exigirRegiao.mockResolvedValue(regiao);
  const resposta = await GET(PEDIDO, contexto(regiao.id));
  expect(resposta.status).toBe(200);
  return (await resposta.json()) as MetadataRoute.Manifest;
}

describe('GET /manifest.webmanifest', () => {
  beforeEach(() => {
    exigirRegiao.mockReset().mockResolvedValue(TRAVESSIA);
    toldoDaRegiao
      .mockReset()
      .mockImplementation(async (regiao) =>
        regiao.tipo === 'montra' ? CORES_DO_TOLDO.montra : CORES_DO_TOLDO.cim,
      );
  });

  it('serve-se como manifesto e guarda-se uma hora', async () => {
    const resposta = await GET(PEDIDO, contexto('travessia'));

    expect(resposta.headers.get('Content-Type')).toBe('application/manifest+json');
    expect(resposta.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    );
  });

  it('chama-se como o sítio da região em que responde', async () => {
    const dados = await manifesto(TRAVESSIA);

    expect(dados.name).toBe(tituloDoSitio(TRAVESSIA));
    expect(dados.name).toBe('Coreto — a agenda cultural da Travessia do Zêzere');
    // O nome por baixo do ícone é o da região (C4-027): quem instala a agenda
    // da sua terra não fica com o nome do produto no ecrã.
    expect(dados.short_name).toBe('Travessia do Zêzere');
    expect(dados.description).toBe(descricaoDoSitio(TRAVESSIA));
    expect(dados.lang).toBe('pt-PT');
    expect(JSON.stringify(dados)).not.toContain('Médio Tejo');
  });

  it('veste o toldo da região: o que ela declarou, e o da casa enquanto não declara', async () => {
    // A barra do sistema é onde uma agenda instalada se confundia com outra.
    toldoDaRegiao.mockResolvedValueOnce('#1f5c4a');
    expect((await manifesto(TRAVESSIA)).theme_color).toBe('#1f5c4a');
    expect(toldoDaRegiao).toHaveBeenLastCalledWith(TRAVESSIA);

    // Sem cor declarada: turquesa numa CIM, vermelho na montra — as duas
    // existem para a montra não se confundir com a agenda de uma região.
    expect(CORES_DO_TOLDO.cim).not.toBe(CORES_DO_TOLDO.montra);
    expect((await manifesto(TRAVESSIA)).theme_color).toBe(CORES_DO_TOLDO.cim);
    expect((await manifesto({ ...TRAVESSIA, tipo: 'montra' })).theme_color).toBe(
      CORES_DO_TOLDO.montra,
    );
  });

  it('convive com a barra de estado, não prende a orientação e não mostra capturas', async () => {
    const dados = await manifesto(TRAVESSIA);

    expect(dados.display).toBe('standalone');
    expect(dados).not.toHaveProperty('orientation');
    expect(dados).not.toHaveProperty('screenshots');
    // O ícone recortável vai à parte, para o Android não cortar a marca.
    expect(dados.icons?.map((icone) => icone.purpose)).toEqual(['any', 'any', 'maskable']);
    // E os três são desenhados na cor da região, pela rota dela — não os
    // ficheiros fixos da raiz, que eram turquesa em todas.
    expect(dados.icons?.map((icone) => icone.src)).toEqual([
      '/icone-da-aplicacao/192',
      '/icone-da-aplicacao/512',
      '/icone-da-aplicacao/512-mascara',
    ]);
  });

  it('o atalho do mapa conta os concelhos por extenso — e cala a contagem quando não a sabe', async () => {
    const atalhoDoMapa = async (regiao: Regiao) =>
      (await manifesto(regiao)).shortcuts?.find((atalho) => atalho.url === '/mapa')?.description;

    expect(await atalhoDoMapa(TRAVESSIA)).toBe(
      'Os dois concelhos e o que está marcado em cada um.',
    );
    // A região de recurso declara zero concelhos: a frase não pode ficar com
    // um buraco onde estava o número.
    expect(await atalhoDoMapa(REGIAO_DE_RECURSO)).toBe(
      'Os concelhos e o que está marcado em cada um.',
    );
    // E com um concelho só, no singular — nada de «Os um concelhos» (C1-031).
    expect(
      await atalhoDoMapa({ ...TRAVESSIA, concelhosDeclarados: 1, concelhosPorExtenso: 'um' }),
    ).toBe('O concelho e o que está marcado nele.');
  });
});
