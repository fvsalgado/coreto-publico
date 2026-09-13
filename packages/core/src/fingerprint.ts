import { createHash } from 'node:crypto';
import { normalizeForHash, slugify } from './text';

/**
 * Impressão digital de deduplicação: título normalizado + data + concelho.
 *
 * Espelha `public.event_fingerprint`. É a chave com que a recolha noturna
 * reconhece um evento que já cá está. Mudar esta fórmula reescreve a chave de
 * todo o catálogo e faz entrar tudo outra vez como novo — se um dia for
 * preciso outro critério, escreve-se uma função nova ao lado desta.
 *
 * O concelho entra na chave (e não o espaço) porque a mesma coisa acontece
 * muitas vezes em sítios diferentes do mesmo concelho — e porque metade da
 * programação destes onze concelhos não tem espaço no catálogo, tem um largo.
 */
export function eventFingerprint(
  title: string,
  date: string | null,
  municipalityId: string | null,
): string {
  const blob = `${normalizeForHash(title)}|${date ?? ''}|${municipalityId ?? ''}`;
  return createHash('sha256').update(blob, 'utf8').digest('hex');
}

/**
 * Impressão digital de conteúdo, para detetar alterações na fonte.
 *
 * Independente da data: serve para saber se vale a pena reescrever a linha,
 * não para saber se é o mesmo evento.
 */
export function contentHash(parts: Array<string | null | undefined>): string {
  const blob = parts.map((part) => normalizeForHash(part).slice(0, 500)).join('|');
  return createHash('sha256').update(blob, 'utf8').digest('hex');
}

/** Prefixo hexadecimal de 6 caracteres — usado para desambiguar slugs. */
export function shortId(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 6);
}

/**
 * Slug público de um evento: legível, estável e único.
 *
 * O sufixo curto vem da identidade do evento, não do título: dois concertos
 * com o mesmo nome em concelhos diferentes têm de conviver, e o slug não pode
 * mudar quando alguém corrige uma gralha no título.
 */
export function eventSlug(title: string, id: string): string {
  const base = slugify(title).slice(0, 80).replace(/-+$/, '');
  return `${base || 'evento'}-${id.replace(/-/g, '').slice(0, 6)}`;
}
