import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `SITE_URL` resolve-se uma vez, no carregamento do módulo. Para exercitar a
 * ordem dos degraus é preciso limpar a cache de módulos entre casos e voltar a
 * importar.
 */
async function siteUrlWith(vars: Record<string, string | undefined>): Promise<string> {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const loaded = await import('./env');
  return loaded.SITE_URL;
}

describe('SITE_URL', () => {
  let original: NodeJS.ProcessEnv;

  beforeEach(() => {
    original = { ...process.env };
  });

  afterEach(() => {
    process.env = original;
    vi.resetModules();
  });

  it('usa NEXT_PUBLIC_SITE_URL quando está configurada', async () => {
    const url = await siteUrlWith({
      NEXT_PUBLIC_SITE_URL: 'https://coreto.mediotejo.pt',
      VERCEL_PROJECT_PRODUCTION_URL: 'coreto-sage.vercel.app',
    });
    expect(url).toBe('https://coreto.mediotejo.pt');
  });

  it('tira a barra final', async () => {
    const url = await siteUrlWith({
      NEXT_PUBLIC_SITE_URL: 'https://agenda.mediotejo.pt/',
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
    });
    expect(url).toBe('https://agenda.mediotejo.pt');
  });

  // O caso que motivou isto: sem configuração, o sítio anunciava como
  // canónico um domínio que ainda não existe.
  it('cai no domínio de produção do Vercel quando não há configuração', async () => {
    const url = await siteUrlWith({
      NEXT_PUBLIC_SITE_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: 'coreto-sage.vercel.app',
    });
    expect(url).toBe('https://coreto-sage.vercel.app');
  });

  it('só usa o domínio próprio quando não há mais nada', async () => {
    const url = await siteUrlWith({
      NEXT_PUBLIC_SITE_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
    });
    expect(url).toBe('https://coreto.mediotejo.pt');
  });

  // Um valor mal formado não deve derrubar o arranque: o campo falha, cai no
  // seu degrau, e o sítio serve.
  it('não rebenta com um endereço inválido', async () => {
    const url = await siteUrlWith({
      NEXT_PUBLIC_SITE_URL: 'isto-não-é-um-endereço',
      VERCEL_PROJECT_PRODUCTION_URL: undefined,
    });
    expect(url).toBe('https://coreto.mediotejo.pt');
  });
});

/**
 * O que se perde quando um valor está mal escrito.
 *
 * Era aqui que doía: a validação era um `safeParse` do ambiente inteiro, e uma
 * variável mal escrita levava consigo todas as outras. A instalação passava a
 * correr com os valores por omissão — sem chave de serviço, portanto sem
 * limitador de tentativas no login; sem sal, portanto com hashes de IP feitos
 * com o sal que está escrito no repositório. Um erro de escrita numa variável
 * decorativa desligava a segurança de outras duas.
 */
describe('configuração campo a campo', () => {
  let original: NodeJS.ProcessEnv;

  beforeEach(() => {
    original = { ...process.env };
    // O `console.error` do módulo é esperado nestes casos — é ele que nomeia
    // o campo perdido. Cala-se para não sujar a saída dos testes.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = original;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  async function carregarCom(vars: Record<string, string | undefined>) {
    vi.resetModules();
    for (const [chave, valor] of Object.entries(vars)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
    return import('./env');
  }

  // O caso que motivou a mudança: um endereço mal escrito não pode levar
  // consigo as credenciais da base.
  it('um campo inválido não arrasta os válidos', async () => {
    const carregado = await carregarCom({
      NEXT_PUBLIC_SITE_URL: 'isto-não-é-um-endereço',
      NEXT_PUBLIC_SUPABASE_URL: 'https://projeto.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'uma-chave-anonima-com-tamanho-que-chegue',
      SUPABASE_SERVICE_ROLE_KEY: 'uma-chave-de-servico-com-tamanho-que-chegue',
      IP_HASH_SALT: 'um-sal-mesmo-configurado',
    });

    expect(carregado.env.NEXT_PUBLIC_SITE_URL).toBeUndefined();
    expect(carregado.hasDatabase).toBe(true);
    // A consequência que interessa: com a chave de serviço de pé, o limitador
    // de tentativas continua a existir, o do login incluído.
    expect(carregado.hasServiceRole).toBe(true);
    expect(carregado.env.IP_HASH_SALT).toBe('um-sal-mesmo-configurado');
  });

  it('diz no registo o nome do campo que ignorou, e só o nome', async () => {
    const carregado = await carregarCom({
      // Curto de mais para o `min(20)`, e é um segredo: não pode aparecer.
      SUPABASE_SERVICE_ROLE_KEY: 'curta',
      NEXT_PUBLIC_SUPABASE_URL: 'https://projeto.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'uma-chave-anonima-com-tamanho-que-chegue',
    });

    expect(carregado.hasServiceRole).toBe(false);
    expect(carregado.hasDatabase).toBe(true);

    const registado = vi.mocked(console.error).mock.calls.flat().join(' ');
    expect(registado).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(registado).not.toContain('curta');
  });

  // Um campo com omissão declarada cai na omissão, não em `undefined` — o
  // resto do código conta com ela e não a verifica.
  it('um campo com omissão declarada volta à omissão', async () => {
    const carregado = await carregarCom({
      NEXT_PUBLIC_POSTHOG_HOST: 'não-é-um-endereço',
      EXTRACTION_MODEL: undefined,
    });

    expect(carregado.env.NEXT_PUBLIC_POSTHOG_HOST).toBe('https://eu.i.posthog.com');
    expect(carregado.env.EXTRACTION_MODEL).toBe('claude-haiku-4-5-20251001');
  });
});
