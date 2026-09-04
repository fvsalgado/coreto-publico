import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportarErro } from './registo';

/*
 * O relator de erros, batido pelos lados que interessam.
 *
 * Duas propriedades justificam este ficheiro, e nenhuma delas é «escreve no
 * stderr». A primeira é que **nunca lança**: é chamado de dentro de blocos
 * `catch`, e um relator que rebenta a relatar transforma uma degradação
 * silenciosa num 500. A segunda é que **não escreve segredos**: o contexto é
 * escrito por quem chama, e um dia alguém passa o objeto inteiro em vez do
 * campo.
 */

function ultimoRegisto(): Record<string, unknown> {
  const linha = vi.mocked(console.error).mock.calls.at(-1)?.[0];
  return JSON.parse(String(linha)) as Record<string, unknown>;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('reportarErro', () => {
  it('escreve uma linha só, em JSON, com o nome da operação e a mensagem', () => {
    reportarErro('listSiteSections', new Error('sem rede'));

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(ultimoRegisto()).toMatchObject({
      nivel: 'erro',
      operacao: 'listSiteSections',
      mensagem: 'sem rede',
      tipo: 'Error',
    });
  });

  it('a linha é JSON válido numa linha só — é o que um agregador consegue ler', () => {
    reportarErro('comQuebras', new Error('primeira\nsegunda'));

    const linha = String(vi.mocked(console.error).mock.calls.at(-1)?.[0]);
    expect(linha.split('\n')).toHaveLength(1);
    expect(JSON.parse(linha)).toMatchObject({ mensagem: 'primeira\nsegunda' });
  });

  it.each([
    ['uma string', 'rebentou', 'rebentou'],
    ['um erro do Supabase', { message: 'PGRST116' }, 'PGRST116'],
    ['nada', undefined, 'undefined'],
    ['null', null, 'null'],
  ])('aceita %s como causa', (_titulo, causa, esperado) => {
    expect(() => reportarErro('qualquer', causa)).not.toThrow();
    expect(ultimoRegisto()).toMatchObject({ mensagem: esperado });
  });

  it('nunca lança, nem quando o contexto não é serializável', () => {
    const ciclico: Record<string, unknown> = { nome: 'a' };
    ciclico.ele = ciclico;

    expect(() => reportarErro('ciclico', new Error('x'), ciclico as never)).not.toThrow();
  });

  describe('o contexto não leva segredos', () => {
    it.each(['secret', 'token', 'password', 'passe', 'apiKey', 'chave', 'authorization', 'cookie'])(
      'omite o valor de uma chave chamada %s',
      (chave) => {
        reportarErro('comSegredo', new Error('x'), { [chave]: 'valor-verdadeiro' });

        const contexto = ultimoRegisto().contexto as Record<string, unknown>;
        expect(contexto[chave]).toBe('[omitido]');
        expect(JSON.stringify(ultimoRegisto())).not.toContain('valor-verdadeiro');
      },
    );

    it('trunca valores longos: um registo não é uma cópia do que alguém submeteu', () => {
      reportarErro('comCorpo', new Error('x'), { corpo: 'a'.repeat(500) });

      const contexto = ultimoRegisto().contexto as Record<string, string>;
      expect(contexto.corpo).toHaveLength(201);
      expect(contexto.corpo).toMatch(/…$/);
    });

    it('deixa passar o que é inócuo, e ignora o que não foi dado', () => {
      reportarErro('comIds', new Error('x'), {
        submissionId: 'abc-123',
        tentativas: 3,
        repetivel: false,
        naoDado: undefined,
      });

      expect(ultimoRegisto().contexto).toEqual({
        submissionId: 'abc-123',
        tentativas: 3,
        repetivel: false,
      });
    });

    it('sem contexto nenhum, o campo não aparece', () => {
      reportarErro('semContexto', new Error('x'));
      expect(ultimoRegisto()).not.toHaveProperty('contexto');
    });
  });

  describe('o webhook', () => {
    it('sem ERROS_WEBHOOK_URL configurada, não faz um único pedido', () => {
      const buscar = vi.fn();
      vi.stubGlobal('fetch', buscar);
      vi.stubEnv('ERROS_WEBHOOK_URL', '');

      reportarErro('semDestino', new Error('x'));

      expect(buscar).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });
  });
});
