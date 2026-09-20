import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SeccaoOpcional } from '@/src/lib/navegacao';
import { REGIAO_DE_RECURSO, type Regiao } from '@/src/lib/regiao';
import { RodapeDoSitio } from './RodapeDoSitio';

/*
 * A banda dos concelhos vem da base; aqui não há base nenhuma, e o que se
 * quer ver é o rodapé, não a consulta. O módulo é substituído inteiro porque
 * `unstable_cache` pede o contexto de um pedido do Next, que num teste de
 * Node não existe.
 */
vi.mock('@/src/lib/queries/events', () => ({ listMunicipalities: async () => [] }));

const COM_EMAIL: Regiao = { ...REGIAO_DE_RECURSO, email: 'geral@exemplo.pt' };

/**
 * As combinações onde o rodapé muda de forma.
 *
 * Quantas colunas há — e com que títulos — decide-se em `colunasDoRodape`, e
 * já lá tem testes. O que aqui se guarda é outra coisa: que **qualquer** que
 * seja a combinação, nenhuma navegação sai anónima.
 */
const CENARIOS: ReadonlyArray<{
  nome: string;
  desligadas: readonly SeccaoOpcional[];
  regiao: Regiao;
}> = [
  { nome: 'tudo ligado', desligadas: [], regiao: COM_EMAIL },
  {
    nome: 'tudo desligado',
    desligadas: ['coretos', 'ciclos', 'fontes', 'informacoes'],
    regiao: COM_EMAIL,
  },
  { nome: 'região sem email', desligadas: [], regiao: REGIAO_DE_RECURSO },
];

async function marcacao(
  desligadas: readonly SeccaoOpcional[],
  regiao: Regiao = COM_EMAIL,
): Promise<string> {
  return renderToStaticMarkup(await RodapeDoSitio({ desligadas, regiao }));
}

/** Cada `<nav>` do rodapé, com o valor cru do seu `aria-labelledby`. */
function navegacoes(html: string): string[] {
  return [...html.matchAll(/<nav[^>]*aria-labelledby="([^"]*)"/g)].map((achado) => achado[1] ?? '');
}

/**
 * O nome que um leitor de ecrã anuncia, ou `null` quando não há nome nenhum.
 *
 * `aria-labelledby` é uma **lista** de identificadores separada por espaços:
 * basta um deles não existir no documento para o nome se desfazer por
 * inteiro. É a conta que o navegador faz, e a que aqui se repete.
 */
function nomeAcessivel(html: string, labelledby: string): string | null {
  const referencias = labelledby.split(/\s+/).filter(Boolean);
  if (referencias.length === 0) return null;
  const textos = referencias.map(
    (id) => html.match(new RegExp(`<[^>]*\\bid="${id}"[^>]*>([^<]*)<`))?.[1] ?? null,
  );
  return textos.every((texto) => texto !== null) ? textos.join(' ') : null;
}

describe('as navegações do rodapé', () => {
  /*
   * A cicatriz: o `id` saía do título por escrever — «rodape-Para quem
   * programa» — e um `aria-labelledby` com espaços é lido como quatro
   * referências que não existem. As duas navegações do rodapé estiveram
   * meses anónimas em produção sem nada disparar: não é violação de critério
   * AA, é `landmark-unique`, e o axe do CI só corre as etiquetas WCAG.
   */
  it.each(CENARIOS)('têm nome — $nome', async ({ desligadas, regiao }) => {
    const html = await marcacao(desligadas, regiao);
    const referencias = navegacoes(html);

    expect(referencias.length).toBeGreaterThan(0);
    for (const referencia of referencias) {
      expect(nomeAcessivel(html, referencia)).not.toBeNull();
    }
  });

  it('dão a cada navegação o título da sua coluna', async () => {
    const html = await marcacao([]);

    expect(navegacoes(html).map((referencia) => nomeAcessivel(html, referencia))).toEqual([
      'Para si',
      'Para quem programa',
      'O projeto',
    ]);
  });

  /*
   * Um identificador com espaços parte a referência; um com acentos não a
   * parte, mas a coluna única do rodapé chama-se «No sítio» e um `id` só se
   * lê bem quando é o mesmo em toda a casa. O slug é o utilitário que já
   * gera os endereços — não há aqui um segundo feitio de slug.
   */
  it.each(CENARIOS)('usam identificadores de slug — $nome', async ({ desligadas, regiao }) => {
    const html = await marcacao(desligadas, regiao);

    for (const referencia of navegacoes(html)) {
      expect(referencia).toMatch(/^rodape-[a-z0-9-]+$/);
    }
  });

  it.each(CENARIOS)('não repetem nomes entre si — $nome', async ({ desligadas, regiao }) => {
    const html = await marcacao(desligadas, regiao);
    const nomes = navegacoes(html).map((referencia) => nomeAcessivel(html, referencia));

    expect(new Set(nomes).size).toBe(nomes.length);
  });
});
