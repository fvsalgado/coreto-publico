import { describe, expect, it } from 'vitest';
import { avisoDeFontesPorLer, vazioDoConcelho } from './EmptyState';
import type { LeituraDoConcelho } from '@/src/lib/estado';

/**
 * As frases que a página de um concelho diz quando não tem o que mostrar.
 *
 * É o sítio onde o produto mais facilmente mente sem ninguém dar por isso, e
 * já mentiu: até 16 de setembro de 2026 dizia «Ainda não há programação
 * publicada em Mação» com a fonte da câmara bloqueada desde o dia 11. O que
 * se prova aqui não é a redação — é que **só um dos quatro casos afirma que
 * não há nada**, e é aquele em que todas as fontes foram lidas.
 */

const DATA = (iso: string) => `${iso.split('-').reverse().join(' de ')}`;

function fonte(id: string, ultima: string | null) {
  return {
    id,
    name: id,
    is_enabled: true,
    last_success_at: ultima,
    last_run_at: ultima,
    saude: 'parada' as const,
    dias: 20,
  };
}

const CASOS: LeituraDoConcelho[] = [
  { tipo: 'nao-sei' },
  { tipo: 'sem-vigilancia' },
  { tipo: 'por-ler', fontes: [fonte('cm-macao', '2026-09-11T03:00:00Z')] },
];

describe('vazioDoConcelho', () => {
  it('só afirma que não há nada quando leu tudo o que havia para ler', () => {
    const emDia = vazioDoConcelho('Mação', { tipo: 'em-dia' }, DATA);
    expect(emDia.title).toBe('Não há nada marcado em Mação.');
    expect(emDia.description).toContain('Lemos todas as noites');
  });

  it('nos outros três casos, o título fala de nós e nunca do concelho', () => {
    // A regra por extenso: «não temos nada publicado» verifica-se; «não há
    // programação» é uma afirmação sobre a vida de um território.
    for (const leitura of CASOS) {
      const { title } = vazioDoConcelho('Mação', leitura, DATA);
      expect(title).not.toContain('Não há nada marcado');
      expect(title).toContain('Mação');
    }
  });

  it('com uma fonte por ler, diz quantas são e desde quando', () => {
    const { title, description } = vazioDoConcelho('Mação', CASOS[2]!, DATA);
    expect(title).toBe('Não conseguimos ler tudo o que se publica em Mação.');
    expect(description).toContain('uma fonte deste concelho');
    expect(description).toContain('11 de 09 de 2026');
    expect(description).toContain('não dizemos que não há nada');
  });

  it('com duas, o plural sai certo', () => {
    const duas: LeituraDoConcelho = {
      tipo: 'por-ler',
      fontes: [fonte('a', '2026-09-01T03:00:00Z'), fonte('b', '2026-09-11T03:00:00Z')],
    };
    // E a data é a da leitura boa MAIS RECENTE: é até aí que isto foi verdade.
    expect(vazioDoConcelho('Mação', duas, DATA).description).toContain(
      'Há 2 fontes deste concelho sem uma leitura com sucesso desde 11 de 09 de 2026',
    );
  });

  it('uma fonte que nunca foi lida não ganha uma data inventada', () => {
    const nunca: LeituraDoConcelho = { tipo: 'por-ler', fontes: [fonte('nova', null)] };
    const { description } = vazioDoConcelho('Mação', nunca, DATA);
    expect(description).toContain('ainda não conseguimos ler uma única vez');
    expect(description).not.toContain('desde');
  });

  it('sem fontes ligadas, diz que não há de onde ler — e que isso não é o mesmo', () => {
    const { description } = vazioDoConcelho('Mação', { tipo: 'sem-vigilancia' }, DATA);
    expect(description).toContain('Não quer dizer que não haja programação');
  });

  it('sem saber, diz que não sabe', () => {
    const { description } = vazioDoConcelho('Mação', { tipo: 'nao-sei' }, DATA);
    expect(description).toContain('Dizemos que não sabemos.');
  });
});

describe('avisoDeFontesPorLer', () => {
  it('avisa quando a lista tem eventos e há fontes por ler', () => {
    expect(avisoDeFontesPorLer(CASOS[2]!, DATA)).toBe(
      'O que está aqui pode não ser tudo: uma fonte deste concelho está sem uma leitura com ' +
        'sucesso desde 11 de 09 de 2026.',
    );
  });

  it('cala-se nos outros três casos, e é de propósito', () => {
    // Uma ressalva que aparece todos os dias em todas as páginas é uma
    // ressalva que ninguém lê — e com as fontes em dia não há nada a ressalvar.
    expect(avisoDeFontesPorLer({ tipo: 'em-dia' }, DATA)).toBeNull();
    expect(avisoDeFontesPorLer({ tipo: 'sem-vigilancia' }, DATA)).toBeNull();
    expect(avisoDeFontesPorLer({ tipo: 'nao-sei' }, DATA)).toBeNull();
  });
});
