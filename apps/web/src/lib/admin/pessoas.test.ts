import { describe, expect, it, vi } from 'vitest';

/**
 * Antes de a 0170 chegar a uma base, não há pessoas — e isso não é um erro.
 *
 * O código chega a produção antes da migração, e nesse intervalo a entrada tem
 * de cair na senha do dono, que é o painel de hoje. As respostas do PostgREST
 * a uma tabela que não existe são três, conforme a pergunta, e foram medidas
 * contra um PostgREST a sério: a tabela sozinha dá `42P01` (ou `PGRST205` nas
 * versões novas), e a tabela com os papéis embebidos dá `PGRST200` — «não
 * encontro a relação» —, que foi a que rebentou a entrada de quem se enganava
 * na palavra-passe no primeiro ensaio.
 */

const estado = vi.hoisted(() => ({ resposta: null as unknown }));

function clienteQue(resposta: unknown) {
  const encadeado: Record<string, unknown> = {
    then: (resolve: (valor: unknown) => unknown) => Promise.resolve(resposta).then(resolve),
  };
  for (const metodo of ['select', 'eq', 'order', 'maybeSingle'])
    encadeado[metodo] = () => encadeado;
  return { from: () => encadeado, rpc: () => encadeado };
}

vi.mock('../supabase/server', () => ({
  adminClient: () => clienteQue(estado.resposta),
  requireAdminClient: () => clienteQue(estado.resposta),
}));

const { faltaNoEsquema, lerPessoaPorEmail, listarPessoas, registarAcesso } =
  await import('./pessoas');

describe('sem as tabelas das contas', () => {
  it.each(['42P01', 'PGRST205', 'PGRST200', '42883', 'PGRST202'])(
    '%s quer dizer «ainda não há contas»',
    async (code) => {
      expect(faltaNoEsquema({ code })).toBe(true);
      estado.resposta = { data: null, error: { code, message: 'não existe' } };
      await expect(lerPessoaPorEmail('ana@cim.pt')).resolves.toBeNull();
      await expect(listarPessoas()).resolves.toBeNull();
      await expect(registarAcesso(null, 'dono')).resolves.toBeUndefined();
    },
  );

  it('uma avaria a sério continua a rebentar — «não consegui ler» não é «não há»', async () => {
    estado.resposta = { data: null, error: { code: '57P01', message: 'a base foi abaixo' } };
    expect(faltaNoEsquema({ code: '57P01' })).toBe(false);
    await expect(lerPessoaPorEmail('ana@cim.pt')).rejects.toThrow();
  });
});
