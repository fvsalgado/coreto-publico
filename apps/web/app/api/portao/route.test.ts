import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PORTAO_COOKIE_NAME, lerBilhete } from '@/src/lib/portao';
import { sha256Hex } from '@/src/lib/token-assinado';

/**
 * A senha da barreira, verificada.
 *
 * O que esta rota decide sozinha é curto e é tudo de segurança: de que região
 * é o pedido (do **anfitrião**, nunca de um campo do formulário), quantas
 * tentativas já houve, e para onde se volta depois. O resto — o que a senha
 * abre, por quanto tempo, e que caminhos leva a barreira — está em
 * `portao.ts`, com os seus testes.
 *
 * As leituras estão substituídas: o que aqui se prova é a decisão, não a
 * consulta.
 */

const checkRateLimit = vi.hoisted(() => vi.fn());
const dominiosDasRegioes = vi.hoisted(() => vi.fn());
const regiaoDoHost = vi.hoisted(() => vi.fn());
const adminClient = vi.hoisted(() => vi.fn());
const reportarErro = vi.hoisted(() => vi.fn());

vi.mock('@/src/lib/rate-limit', () => ({ checkRateLimit }));
vi.mock('@/src/lib/regiao-host', () => ({ dominiosDasRegioes, regiaoDoHost }));
vi.mock('@/src/lib/supabase/server', () => ({ adminClient }));
vi.mock('@/src/lib/registo', () => ({ reportarErro }));

const { POST } = await import('./route');

const SEGREDO = 'um-segredo-de-teste-com-tamanho-que-chegue';
const SENHA = 'a-senha-do-medio-tejo';

/** Um cliente que responde uma linha de `region_gates`, ou um erro. */
function baseQueDevolve(resultado: { data: unknown; error: unknown }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => resultado }),
      }),
    }),
  };
}

function pedido(campos: Record<string, string>, host = 'coreto.mediotejo.pt'): NextRequest {
  const corpo = new URLSearchParams(campos);
  return new NextRequest(`https://${host}/api/portao`, {
    method: 'POST',
    headers: { host, 'content-type': 'application/x-www-form-urlencoded' },
    body: corpo.toString(),
  });
}

describe('POST /api/portao', () => {
  beforeEach(async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', SEGREDO);
    checkRateLimit.mockReset().mockResolvedValue({ allowed: true });
    dominiosDasRegioes.mockReset().mockResolvedValue({ 'coreto.mediotejo.pt': 'medio-tejo' });
    regiaoDoHost.mockReset().mockReturnValue('medio-tejo');
    reportarErro.mockReset();
    adminClient
      .mockReset()
      .mockReturnValue(
        baseQueDevolve({ data: { password_sha256: await sha256Hex(SENHA) }, error: null }),
      );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('com a senha certa, entrega o bilhete e devolve quem entrou ao sítio de onde veio', async () => {
    const resposta = await POST(pedido({ senha: SENHA, de: '/agenda' }));

    expect(resposta.status).toBe(303);
    expect(resposta.headers.get('location')).toBe('https://coreto.mediotejo.pt/agenda');

    const cookie = resposta.cookies.get(PORTAO_COOKIE_NAME);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
    expect(cookie?.secure).toBe(true);
    const bilhete = await lerBilhete(cookie?.value, SEGREDO, 'medio-tejo');
    expect(bilhete?.regiao).toBe('medio-tejo');
  });

  it('a senha vem aparada — um espaço colado de um email não é senha errada', async () => {
    const resposta = await POST(pedido({ senha: `  ${SENHA}\n`, de: '/' }));
    expect(resposta.cookies.get(PORTAO_COOKIE_NAME)?.value).toBeTruthy();
  });

  it('com a senha errada não há bilhete, e volta-se ao portão a dizer porquê', async () => {
    const resposta = await POST(pedido({ senha: 'outra-qualquer', de: '/agenda' }));

    expect(resposta.status).toBe(303);
    const destino = new URL(resposta.headers.get('location') ?? '');
    expect(destino.pathname).toBe('/portao');
    expect(destino.searchParams.get('erro')).toBe('errada');
    // O sítio de onde se veio sobrevive à tentativa falhada.
    expect(destino.searchParams.get('de')).toBe('/agenda');
    expect(resposta.cookies.get(PORTAO_COOKIE_NAME)).toBeUndefined();
  });

  it('um destino que não é desta origem não sai daqui', async () => {
    // Um `de` aberto era um redirecionamento aberto de oferta: a página da
    // senha mandava para fora, com o ar de quem já entrou.
    for (const de of [
      'https://exemplo-mau.example/isca',
      '//exemplo-mau.example/isca',
      '/\\exemplo-mau.example',
      'agenda',
    ]) {
      const resposta = await POST(pedido({ senha: SENHA, de }));
      expect(resposta.headers.get('location')).toBe('https://coreto.mediotejo.pt/');
    }
  });

  it('esgotadas as tentativas, nem se chega a ler a senha guardada', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    const resposta = await POST(pedido({ senha: SENHA, de: '/' }));

    expect(new URL(resposta.headers.get('location') ?? '').searchParams.get('erro')).toBe(
      'demasiadas',
    );
    expect(adminClient).not.toHaveBeenCalled();
  });

  it('o balde é por região: tentar numa não gasta as tentativas de outra', async () => {
    await POST(pedido({ senha: 'errada', de: '/' }));
    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ route: 'portao:medio-tejo' }),
    );
  });

  it('um anfitrião que não é de região nenhuma não abre nada', async () => {
    regiaoDoHost.mockReturnValue(null);
    const resposta = await POST(pedido({ senha: SENHA, de: '/' }, 'exemplo-qualquer.pt'));
    expect(new URL(resposta.headers.get('location') ?? '').searchParams.get('erro')).toBe('regiao');
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('sem chave de serviço, fecha em vez de deixar passar', async () => {
    adminClient.mockReturnValue(null);
    const resposta = await POST(pedido({ senha: SENHA, de: '/' }));
    expect(new URL(resposta.headers.get('location') ?? '').searchParams.get('erro')).toBe(
      'por-configurar',
    );
    expect(resposta.cookies.get(PORTAO_COOKIE_NAME)).toBeUndefined();
  });

  it('sem segredo de assinatura, também fecha', async () => {
    // Sem ele não há bilhete que se possa verificar depois. Deixar passar era
    // entregar uma chave que nenhuma fechadura reconhece.
    vi.stubEnv('ADMIN_SESSION_SECRET', undefined);
    const resposta = await POST(pedido({ senha: SENHA, de: '/' }));
    expect(new URL(resposta.headers.get('location') ?? '').searchParams.get('erro')).toBe(
      'por-configurar',
    );
  });

  it('sem senha guardada não se entra, mesmo com a senha em branco', async () => {
    // A base já recusa ligar uma barreira sem senha (0157); isto é a segunda
    // tranca, para o caso de alguém ter mexido na tabela à mão.
    adminClient.mockReturnValue(baseQueDevolve({ data: null, error: null }));
    const resposta = await POST(pedido({ senha: '', de: '/' }));
    expect(new URL(resposta.headers.get('location') ?? '').searchParams.get('erro')).toBe(
      'por-configurar',
    );
  });

  it('uma leitura falhada fecha e fica no registo, em vez de deixar entrar', async () => {
    adminClient.mockReturnValue(
      baseQueDevolve({ data: null, error: { message: 'ligação recusada' } }),
    );
    const resposta = await POST(pedido({ senha: SENHA, de: '/' }));
    expect(new URL(resposta.headers.get('location') ?? '').searchParams.get('erro')).toBe(
      'por-configurar',
    );
    expect(reportarErro).toHaveBeenCalledWith('portao', expect.anything());
  });

  it('nenhuma resposta desta rota se guarda em cache', async () => {
    for (const resposta of [
      await POST(pedido({ senha: SENHA, de: '/' })),
      await POST(pedido({ senha: 'errada', de: '/' })),
    ]) {
      expect(resposta.headers.get('Cache-Control')).toBe('no-store, must-revalidate');
    }
  });
});
