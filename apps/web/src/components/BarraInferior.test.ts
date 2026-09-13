import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BarraInferior } from './BarraInferior';

// A barra é de cliente e lê o caminho aberto para acender o destino de agora.
// Fora do Next não há caminho nenhum: dá-se-lhe um.
vi.mock('next/navigation', () => ({ usePathname: () => '/agenda' }));

function marcacao(): string {
  return renderToStaticMarkup(
    createElement(BarraInferior, { desligadas: [], email: 'geral@exemplo.pt', regiao: 'recurso' }),
  );
}

/** O nome de cada `<nav>` da marcação, pela ordem em que aparece. */
function nomes(html: string): string[] {
  return [...html.matchAll(/<nav[^>]*aria-label="([^"]*)"/g)].map((achado) => achado[1] ?? '');
}

/**
 * Os nomes das navegações do toldo, lidos do ficheiro do layout.
 *
 * Ler outro ficheiro num teste não é hábito da casa, e aqui é o que a
 * verificação exige: o defeito não está em nenhuma das duas navegações — está
 * em **serem duas com o mesmo nome**, e uma delas vive no layout, que é de
 * servidor e não se renderiza aqui. Guardar de fora a lista de nomes do toldo
 * era garantir que um dia divergia da real.
 */
function nomesDoToldo(): string[] {
  const layout = readFileSync(new URL('../../app/[regiao]/layout.tsx', import.meta.url), 'utf8');
  return [...layout.matchAll(/<nav[^>]*aria-label="([^"]*)"/g)].map((achado) => achado[1] ?? '');
}

describe('a barra do fundo', () => {
  it('tem nome acessível', () => {
    expect(nomes(marcacao())).toEqual(['Principal, no fundo do ecrã']);
  });

  /*
   * A cicatriz: esta barra e a navegação do toldo chamavam-se ambas
   * «Principal». As duas coexistem no documento — o toldo leva o botão de
   * enviar e o tema, que também no telemóvel se veem —, e quem percorre a
   * página por marcos ouvia duas navegações iguais. Não viola critério AA
   * nenhum: a regra chama-se `landmark-unique` e é boa prática, que o axe do
   * CI não corre.
   */
  it('não repete o nome de nenhuma navegação do toldo', () => {
    const doToldo = nomesDoToldo();

    // Sem isto, a guarda passava a verde no dia em que a navegação do toldo
    // mudasse de sítio — e ninguém dava por ela.
    expect(doToldo.length).toBeGreaterThan(0);
    for (const nome of nomes(marcacao())) {
      expect(doToldo).not.toContain(nome);
    }
  });
});
