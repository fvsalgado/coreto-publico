import { z } from 'zod';

/**
 * O vocabulário da medição, partilhado pelo navegador e pelo servidor.
 *
 * Estes quatro nomes são os mesmos que a função `record_event_stat` aceita na
 * base de dados. Estão aqui num só sítio porque uma divergência entre os dois
 * lados não dá erro nenhum: dá contagens que ficam sempre a zero e um gestor
 * a concluir que ninguém carregou no botão.
 *
 * Este ficheiro é importado pelo navegador, por isso não pode ter
 * `server-only` nem tocar em nada do servidor.
 */
export const STAT_KINDS = ['view', 'ticket_click', 'ical_download', 'share'] as const;

export type StatKind = (typeof STAT_KINDS)[number];

/**
 * Atributo que marca no HTML o que é para contar.
 *
 * A alternativa era transformar cada botão medido num componente de cliente.
 * Assim a ficha do evento continua a ser renderizada no servidor — os
 * `<a>` são `<a>` de verdade, funcionam sem JavaScript e continuam a ser
 * ligações que se abrem noutro separador — e um único ouvinte trata de todos.
 */
export const STAT_KIND_ATTRIBUTE = 'data-stat-kind';

export const statKindSchema = z.enum(STAT_KINDS);

export const statRequestSchema = z.object({
  eventId: z.string().uuid(),
  kind: statKindSchema,
});

export type StatRequest = z.infer<typeof statRequestSchema>;

export function isStatKind(value: string | null | undefined): value is StatKind {
  return typeof value === 'string' && STAT_KINDS.some((kind) => kind === value);
}

/** Rótulos das colunas da página de estatísticas. */
export const STAT_KIND_LABELS: Record<StatKind, string> = {
  view: 'Aberturas da ficha',
  ticket_click: 'Cliques na bilhética',
  ical_download: 'Adições ao calendário',
  share: 'Partilhas',
};
