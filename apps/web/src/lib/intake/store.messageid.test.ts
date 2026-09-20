import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../registo', () => ({ reportarErro: vi.fn() }));

const { findEmailSubmissionByMessageId } = await import('./store');

/** Um Supabase que só sabe responder à pergunta que este módulo faz. */
function supabaseQueResponde(resposta: { data: unknown; error: unknown }) {
  const consulta = {
    filtros: [] as Array<[string, string]>,
    select: vi.fn().mockReturnThis(),
    eq(coluna: string, valor: string) {
      this.filtros.push([coluna, valor]);
      return this;
    },
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(resposta),
  };
  return { cliente: { from: vi.fn(() => consulta) }, consulta };
}

describe('findEmailSubmissionByMessageId', () => {
  it('pergunta pelo canal e pelo messageId dentro dos cabeçalhos, e devolve o id', async () => {
    const { cliente, consulta } = supabaseQueResponde({ data: { id: 'sub-1' }, error: null });
    const id = await findEmailSubmissionByMessageId(cliente as never, '<abc@mail.filarmonica.pt>');
    expect(id).toBe('sub-1');
    expect(cliente.from).toHaveBeenCalledWith('submissions');
    expect(consulta.filtros).toEqual([
      ['channel', 'email'],
      ['raw_headers->>messageId', '<abc@mail.filarmonica.pt>'],
    ]);
  });

  it('sem submissão igual, devolve null', async () => {
    const { cliente } = supabaseQueResponde({ data: null, error: null });
    expect(await findEmailSubmissionByMessageId(cliente as never, '<x@y>')).toBeNull();
  });

  // Numa dúvida, aceita-se o email: perder um evento custa mais do que uma
  // repetição que a moderação vê.
  it('um erro de leitura conta como «não existe»', async () => {
    const { cliente } = supabaseQueResponde({ data: null, error: { message: 'em baixo' } });
    expect(await findEmailSubmissionByMessageId(cliente as never, '<x@y>')).toBeNull();
  });
});
