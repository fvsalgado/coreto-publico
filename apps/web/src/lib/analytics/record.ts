import 'server-only';
import { reportarErro } from '../registo';
import { adminClient } from '../supabase/server';
import type { StatKind } from './kinds';

/**
 * Escrita de uma contagem.
 *
 * Passa pela chave de serviço e pela função `record_event_stat`, que é a
 * única forma de escrever em `event_stats`: a tabela não tem policy de
 * escrita nenhuma, e é isso que impede que alguém com a chave pública ponha
 * lá o número que lhe apetecer.
 *
 * Devolve sempre sem lançar. Contar é secundário em relação a servir a
 * página, e uma base de dados em baixo não pode transformar uma visita numa
 * mensagem de erro.
 */
export async function recordEventStat(eventId: string, kind: StatKind): Promise<void> {
  const supabase = adminClient();
  if (!supabase) return;

  const { error } = await supabase.rpc('record_event_stat', {
    p_event_id: eventId,
    p_kind: kind,
  });

  if (error) reportarErro('record_event_stat', error);
}
