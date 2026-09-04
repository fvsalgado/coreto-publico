import { z } from 'zod';
import { reportarErro } from './registo';

/**
 * Variáveis de ambiente, validadas uma vez.
 *
 * Nada aqui é obrigatório à força. O site tem de conseguir compilar e correr
 * sem base de dados nem chaves — em CI, num fork, num arranque a frio — e
 * degradar em vez de rebentar: uma página sem eventos é um contratempo, uma
 * página que não compila é uma paragem.
 */
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  ADMIN_SESSION_SECRET: z.string().min(32).optional(),
  IP_HASH_SALT: z.string().min(16).optional(),
  REVALIDATE_SECRET: z.string().min(16).optional(),
  INBOUND_MAIL_SECRET: z.string().min(16).optional(),
  EXTRACTION_API_KEY: z.string().optional(),
  EXTRACTION_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  EXTRACTION_DAILY_BUDGET_MICROS: z.coerce.number().int().min(0).default(2_000_000),
  EXTRACTION_SENDER_DAILY_LIMIT: z.coerce.number().int().min(0).default(20),

  // Medição sem cookies. Sem chave, o PostHog não arranca e o sítio funciona
  // na mesma — os contadores por evento são independentes dele.
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(10).optional(),
  // A Europa por omissão: os dados não saem da UE sem uma decisão explícita
  // de quem configura.
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default('https://eu.i.posthog.com'),

  /*
   * MTA-STS: o servidor de correio que recebe, e o rigor com que se exige TLS.
   *
   * `testing` por omissão, e é deliberado — em `enforce`, um MX mal escrito
   * deixa de receber correio e a falha é silenciosa do nosso lado: quem
   * escreve é que recebe a devolução. Passa-se a `enforce` depois de uma
   * semana a ler os relatórios TLS-RPT, e não antes.
   *
   * Sem `MTA_STS_MX` não há política nenhuma para servir, e a rota responde
   * 404: publicar uma política sem MX seria dizer a um servidor de correio
   * «só entrego a estes servidores» e não nomear nenhum.
   */
  MTA_STS_MX: z.string().min(3).optional(),
  MTA_STS_MODO: z.enum(['testing', 'enforce']).default('testing'),
});

/**
 * A validação é campo a campo, e não um `safeParse` sobre `process.env`
 * inteiro, por causa do que a segunda forma faz quando alguma coisa está mal.
 *
 * Um `safeParse` do objeto todo é tudo-ou-nada: um único valor mal escrito —
 * um segredo com um caractere a menos, um endereço sem esquema — falhava a
 * validação inteira e a instalação ficava a correr com os valores por
 * omissão, com todo o resto da configuração calada. E o que se perdia em
 * silêncio não era decorativo: sem `SUPABASE_SERVICE_ROLE_KEY` o `hasServiceRole`
 * fica falso, o limitador de tentativas passa a deixar passar tudo e o login
 * do painel fica sem trava; sem `IP_HASH_SALT` o `ip.ts` cai no sal literal
 * que está escrito neste repositório, e um hash com um sal público é um
 * endereço IP com um passo a mais. Um `console.error` no arranque avisava,
 * mas o arranque é a coisa que ninguém lê.
 *
 * Campo a campo, um valor mau só se perde a si próprio: os vizinhos válidos
 * sobrevivem, e o que se degrada é exatamente o que está errado. Continua a
 * não haver exceção no arranque — um sítio sem base de dados serve na mesma,
 * e uma página que não compila é uma paragem —, mas a degradação passa a ser
 * do tamanho do erro.
 */
type Env = z.infer<typeof schema>;

function validarCampoACampo(fonte: NodeJS.ProcessEnv): Env {
  const valores: Record<string, unknown> = {};
  const invalidos: string[] = [];

  for (const [chave, campo] of Object.entries(schema.shape)) {
    const lido = campo.safeParse(fonte[chave]);
    if (lido.success) {
      valores[chave] = lido.data;
      continue;
    }

    // Sem valor utilizável, vale o que o próprio campo diz de si quando não
    // lhe dão nada: o `default` declarado, ou `undefined` para os opcionais.
    invalidos.push(chave);
    const semValor = campo.safeParse(undefined);
    if (semValor.success) valores[chave] = semValor.data;
  }

  if (invalidos.length > 0) {
    // Regista-se o nome de cada campo que se perdeu, e só o nome: quem lê os
    // registos precisa de saber o que está por corrigir, não do segredo mal
    // copiado que provocou o aviso.
    reportarErro('configuração inválida', `campos ignorados: ${invalidos.join(', ')}`);
  }

  return valores as Env;
}

export const env: Env = validarCampoACampo(process.env);

/** `true` quando há credenciais para ler a base de dados. */
export const hasDatabase = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

/** `true` quando há chave de serviço — só existe no servidor. */
export const hasServiceRole = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
);

/** `true` quando há chave do PostHog. Sem ela, não se carrega nada. */
export const hasAnalytics = Boolean(env.NEXT_PUBLIC_POSTHOG_KEY);

/**
 * O endereço público do sítio — a base de todos os canónicos, do
 * `sitemap.xml`, do `robots.txt`, dos feeds e do widget.
 *
 * A ordem importa, e o último degrau é o que se quer evitar:
 *
 * 1. `NEXT_PUBLIC_SITE_URL`, quando está configurada. É sempre a resposta
 *    certa, e é a única que sabe do domínio próprio.
 * 2. O domínio de produção que o Vercel atribui ao projeto. Uma instalação
 *    ainda sem domínio passa a descrever-se pelo endereço onde realmente
 *    está, em vez de apontar para outro.
 * 3. `coreto.mediotejo.pt`, para quem construir isto fora do Vercel.
 *
 * O domínio do degrau 3 é o que o projeto vai ter, e **ainda não resolve**.
 * É de propósito que ele fica em último: antes de haver o degrau 2, uma
 * instalação por configurar anunciava-o como canónico de todas as páginas, e
 * um motor de busca que passasse por lá ficava a saber que o conteúdo
 * verdadeiro estava noutro sítio — que não respondia. No dia em que o DNS
 * existir, o que muda é uma variável (`NEXT_PUBLIC_SITE_URL`), não este
 * ficheiro.
 *
 * A variável do Vercel não tem prefixo `NEXT_PUBLIC_` e só existe no
 * servidor. Não faz mal: tudo o que usa `SITE_URL` é renderizado no
 * servidor. Se algum dia deixar de ser, isto tem de ser repensado.
 */
function resolveSiteUrl(): string {
  const configured = env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production.replace(/\/$/, '')}`;

  return 'https://coreto.mediotejo.pt';
}

export const SITE_URL = resolveSiteUrl();
