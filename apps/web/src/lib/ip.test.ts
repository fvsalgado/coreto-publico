import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * O módulo lê `env` ao carregar, e `env` lê `process.env` ao carregar. Para
 * exercitar «com sal» e «sem sal» é preciso limpar a cache de módulos e voltar
 * a importar com a variável posta ou tirada.
 */
async function carregar(sal: string | undefined) {
  vi.resetModules();
  if (sal === undefined) delete process.env.IP_HASH_SALT;
  else process.env.IP_HASH_SALT = sal;
  return import('./ip');
}

function pedido(ip: string): Request {
  return new Request('https://exemplo.test/', {
    headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` },
  });
}

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  vi.resetModules();
});

describe('hashIp', () => {
  it('com sal, devolve um resumo estável de 32 hexadecimais que muda com o endereço', async () => {
    const { hashIp } = await carregar('um-sal-com-dezasseis-ou-mais');
    const a = hashIp(pedido('198.51.100.7'));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(hashIp(pedido('198.51.100.7'))).toBe(a);
    expect(hashIp(pedido('198.51.100.8'))).not.toBe(a);
  });

  // O caso que motivou isto: sem sal, o código caía num sal literal escrito
  // no repositório, e um hash com sal público é um endereço com um passo a
  // mais. Sem sal não se guarda nada.
  it('sem sal, não devolve hash nenhum', async () => {
    const { hashIp } = await carregar(undefined);
    expect(hashIp(pedido('198.51.100.7'))).toBeNull();
  });

  it('um sal curto de mais conta como ausente', async () => {
    const { hashIp } = await carregar('curto');
    expect(hashIp(pedido('198.51.100.7'))).toBeNull();
  });
});

describe('baldeDoPedido', () => {
  it('sem sal, continua a separar visitantes com um sal efémero do processo', async () => {
    const { baldeDoPedido } = await carregar(undefined);
    const a = baldeDoPedido(pedido('198.51.100.7'));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(baldeDoPedido(pedido('198.51.100.7'))).toBe(a);
    expect(baldeDoPedido(pedido('198.51.100.8'))).not.toBe(a);
  });

  it('com sal, é o mesmo resumo que hashIp', async () => {
    const { baldeDoPedido, hashIp } = await carregar('um-sal-com-dezasseis-ou-mais');
    expect(baldeDoPedido(pedido('198.51.100.7'))).toBe(hashIp(pedido('198.51.100.7')));
  });
});
