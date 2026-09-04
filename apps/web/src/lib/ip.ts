import 'server-only';
import { createHash } from 'node:crypto';
import { env } from './env';

/**
 * Endereços IP nunca são guardados em claro.
 *
 * O que se guarda é um hash com sal — chega para travar abuso (o mesmo
 * visitante produz sempre o mesmo balde) e não permite reconstruir o
 * endereço. É o mínimo que o RGPD pede e o máximo de que precisamos.
 */
export function hashIp(request: Request): string {
  const header = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '';
  const ip = header.split(',')[0]?.trim() || 'desconhecido';
  const salt = env.IP_HASH_SALT ?? 'coreto-sem-sal-configurado';
  return createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 32);
}
