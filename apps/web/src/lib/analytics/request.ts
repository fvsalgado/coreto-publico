import { z } from 'zod';
import { STAT_KINDS } from './kinds';

/**
 * O corpo de um pedido a `POST /api/stats`, validado.
 *
 * Vive à parte do vocabulário (`kinds.ts`) por uma razão de peso, literalmente:
 * o `kinds.ts` é importado por componentes de cliente que estão no layout da
 * região, e um ficheiro importado pelo navegador arrasta consigo tudo o que
 * importa. Com o Zod lá dentro, catorze quilobytes iam para o navegador em
 * todas as páginas do sítio para validar uma coisa que **só o servidor**
 * valida.
 *
 * O vocabulário continua a ser um só — `STAT_KINDS` é lido daqui — porque o
 * problema que ele resolve não mudou: os nomes têm de coincidir com os que a
 * `record_event_stat` aceita, e uma divergência não dá erro, dá contagens
 * sempre a zero.
 */
export const statKindSchema = z.enum(STAT_KINDS);

export const statRequestSchema = z.object({
  eventId: z.string().uuid(),
  kind: statKindSchema,
});

export type StatRequest = z.infer<typeof statRequestSchema>;
