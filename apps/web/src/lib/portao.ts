/**
 * A barreira temporária de uma região: quem entra, e por onde.
 *
 * Uma região podia estar ligada (à vista de toda a gente) ou desligada
 * (invisível). A migração 0157 acrescentou o terceiro estado, que é o de uma
 * região **pronta e ainda não contratada**: de pé, a funcionar, e só para quem
 * tem a senha. O caso que a pediu foi o `mediotejo.coreto.org`.
 *
 * Isto não é autenticação e não se deve parecer com uma. É uma senha
 * partilhada, dita ao telefone ou num email, igual para toda a gente que a
 * receba. Tapa uma região a quem passa; não guarda nada de ninguém. A fila de
 * moderação, os dados pessoais e o painel continuam onde sempre estiveram,
 * atrás da sessão de administração.
 */
import { assinar, base64url, constantTimeEquals, fromBase64url } from './token-assinado';

export const PORTAO_COOKIE_NAME = 'coreto_portao';

/**
 * Vinte e quatro horas, escolhidas por quem a vai usar.
 *
 * Sobrevive a uma reunião e à noite seguinte, e não fica esquecido num portátil
 * emprestado. Renova-se a cada entrada: quem volta no dia seguinte escreve a
 * senha outra vez, o que é o preço certo de uma coisa que é temporária.
 */
export const PORTAO_TTL_SEGUNDOS = 24 * 60 * 60;

/** Tentativas por endereço, e a janela em que contam. Como a entrada do painel. */
export const PORTAO_TENTATIVAS = 10;
export const PORTAO_JANELA_SEGUNDOS = 15 * 60;

/** O caminho da página que pede a senha, dentro do segmento da região. */
export const CAMINHO_DO_PORTAO = '/portao';

export interface BilheteDoPortao {
  /** Distingue este token do da sessão do painel — ver `token-assinado.ts`. */
  tipo: 'portao';
  /** A região que este bilhete abre, e só ela. */
  regiao: string;
  /** Instante de expiração, em segundos desde a época. */
  exp: number;
  /** Ruído, para dois bilhetes seguidos não terem o mesmo valor. */
  jti: string;
}

/**
 * O que **não** leva barreira, e porque é uma lista do que fica aberto.
 *
 * A lista podia ser a das páginas a tapar. Seria a errada: uma página nova
 * nascia destapada, e ninguém dava por isso até alguém a encontrar. Assim, uma
 * página nova nasce **tapada**, e o que pode correr mal é um feed novo ficar
 * fechado — que se vê no dia seguinte e se corrige numa linha.
 *
 * Quem pediu a barreira escolheu cobrir **só as páginas**, por ser o mais
 * simples para uma coisa temporária. Estes endereços continuam a responder a
 * quem os souber de cor, e o painel di-lo à letra a quem liga a barreira: com
 * o `feed.xml` aberto, a agenda continua legível por outra porta.
 */
const SEM_BARREIRA_EXATOS = new Set([
  // A `/fontes` é o cartão de visita da recolha: é o endereço que o agente
  // traz em cada pedido e para onde um administrador de sistemas segue
  // quando nos vê nos registos dele. Com a barreira ligada respondia «Agenda
  // reservada» — a uma pessoa que só queria saber quem lhe batia à porta, no
  // meio de um incidente com oito servidores da CIM. Não mostra a agenda:
  // mostra que fontes se leem, com que regras, e como pedir que se pare.
  '/fontes',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/llms.txt',
  '/feed.xml',
  '/agenda.ics',
  '/dados.json',
  '/dados.csv',
  '/estado.json',
  '/api/events',
  '/.well-known/security.txt',
  '/.well-known/mta-sts.txt',
]);

const SEM_BARREIRA_PREFIXOS = ['/feed/', '/widget/'] as const;

/**
 * Este caminho tem de passar pela barreira?
 *
 * Recebe o caminho **público** — o que o visitante escreveu —, antes de o
 * middleware o reescrever para o segmento da região.
 */
export function temBarreira(pathname: string): boolean {
  // A própria página da senha não se tapa a si própria.
  if (pathname === CAMINHO_DO_PORTAO) return false;
  if (SEM_BARREIRA_EXATOS.has(pathname)) return false;
  if (SEM_BARREIRA_PREFIXOS.some((prefixo) => pathname.startsWith(prefixo))) return false;
  return true;
}

/** Constrói o bilhete: `corpo.assinatura`, ambos em base64url. */
export async function criarBilhete(
  regiao: string,
  secret: string,
  now = Date.now(),
): Promise<string> {
  const bilhete: BilheteDoPortao = {
    tipo: 'portao',
    regiao,
    exp: Math.floor(now / 1000) + PORTAO_TTL_SEGUNDOS,
    jti: base64url(crypto.getRandomValues(new Uint8Array(9))),
  };
  const corpo = base64url(new TextEncoder().encode(JSON.stringify(bilhete)));
  return `${corpo}.${await assinar(corpo, secret)}`;
}

/**
 * Lê um bilhete. `null` para tudo o que não seja um bilhete válido, dentro do
 * prazo, com a assinatura certa **e para esta região**.
 *
 * A região faz parte do que se verifica, e não é detalhe: sem isso, o bilhete
 * de uma região abria todas as outras deste deployment — e o dia em que houver
 * duas regiões com barreira, uma delas era de quem tivesse a senha da outra.
 */
export async function lerBilhete(
  token: string | undefined,
  secret: string,
  regiao: string,
  now = Date.now(),
): Promise<BilheteDoPortao | null> {
  if (!token) return null;
  const separador = token.lastIndexOf('.');
  if (separador <= 0) return null;

  const corpo = token.slice(0, separador);
  const assinatura = token.slice(separador + 1);
  if (!constantTimeEquals(assinatura, await assinar(corpo, secret))) return null;

  try {
    const bilhete = JSON.parse(new TextDecoder().decode(fromBase64url(corpo))) as BilheteDoPortao;
    if (bilhete.tipo !== 'portao') return null;
    if (typeof bilhete.regiao !== 'string' || bilhete.regiao !== regiao) return null;
    if (typeof bilhete.exp !== 'number' || bilhete.exp * 1000 < now) return null;
    return bilhete;
  } catch {
    return null;
  }
}
