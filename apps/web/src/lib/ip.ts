import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { env } from './env';

/**
 * Endereços IP nunca são guardados em claro.
 *
 * O que se guarda é um hash com sal — chega para travar abuso (o mesmo
 * visitante produz sempre o mesmo balde) e não permite reconstruir o
 * endereço. É o mínimo que o RGPD pede e o máximo de que precisamos.
 *
 * **Sem sal configurado não se guarda nada.** Até 19 de setembro de 2026 esta
 * função caía num sal literal escrito neste repositório
 * (`'coreto-sem-sal-configurado'`), e um SHA-256 de um IPv4 com um sal que
 * qualquer pessoa pode ler reverte-se em segundos: era um endereço IP com um
 * passo a mais, guardado durante 24 meses na fila de submissões. O comentário
 * em `build-row.ts` dizia «`null` sem sal configurado» e o código fazia o
 * contrário. Agora faz o que o comentário diz.
 */
export function hashIp(request: Request): string | null {
  if (!env.IP_HASH_SALT) return null;
  return resumir(env.IP_HASH_SALT, ipDoPedido(request));
}

/**
 * O balde de limitação de tráfego de um pedido, mesmo sem sal configurado.
 *
 * A limitação de tráfego precisa de distinguir visitantes, e um limitador que
 * desistisse sem sal deixava o login e o portão sem trava — que é pior do que
 * o problema que o sal resolve. Sem `IP_HASH_SALT`, usa-se um sal aleatório
 * gerado no arranque do processo e guardado só em memória: os baldes
 * continuam a separar visitantes durante a vida do processo, e o que fica na
 * tabela `rate_limits` (dois dias) não se reverte porque o sal não está
 * escrito em lado nenhum. Não serve para persistir num registo com prazo
 * longo — para isso é `hashIp`, que sem sal devolve `null`.
 */
export function baldeDoPedido(request: Request): string {
  return resumir(env.IP_HASH_SALT ?? SAL_EFEMERO, ipDoPedido(request));
}

const SAL_EFEMERO = randomBytes(16).toString('hex');

function ipDoPedido(request: Request): string {
  const header = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '';
  return header.split(',')[0]?.trim() || 'desconhecido';
}

function resumir(salt: string, ip: string): string {
  return createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 32);
}
