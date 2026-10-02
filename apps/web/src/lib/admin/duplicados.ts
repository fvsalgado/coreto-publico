import { formatTime, formatWeekdayDate } from '../format';
import type { CandidatoADuplicado, SessaoResumida } from './queries';

/**
 * Os duplicados prováveis, ditos a quem modera (C4-014).
 *
 * A página mostrava «73% semelhante · impressão digital igual» — uma medida e
 * um termo de quem escreveu o código — e pedia a seguir um identificador que
 * não mostrava. O que quem modera precisa de ler é porque é que o painel acha
 * que é o mesmo, e de quê: o dia, a hora e o sítio do evento que já existe.
 */

/** Porque é que o painel acha que é o mesmo, numa frase. */
export function fraseDoMotivo(
  candidato: Pick<CandidatoADuplicado, 'motivo' | 'similarity'>,
): string {
  switch (candidato.motivo) {
    case 'mesmo-espaco-dia-e-hora':
      return 'mesmo espaço, mesmo dia e mesma hora';
    case 'mesmo-espaco-e-dia':
      return 'mesmo espaço e mesmo dia';
    case 'mesmo-dia-e-hora':
      return 'mesmo concelho, mesmo dia e mesma hora';
    default:
      return `título parecido (${Math.round(candidato.similarity * 100)}%)`;
  }
}

/** Os motivos fortes: os que não dependem do título, e por isso apanham o que ele esconde. */
export function motivoForte(candidato: Pick<CandidatoADuplicado, 'motivo'>): boolean {
  return candidato.motivo !== 'titulo-parecido';
}

const ESTADOS: Record<string, string> = {
  published: 'publicado',
  draft: 'por publicar',
  hidden: 'escondido',
  cancelled: 'cancelado',
  postponed: 'adiado',
};

/** «publicado · sábado, 10 de outubro, 21h30 · Auditório do Mirante» */
export function resumoDoCandidato(candidato: CandidatoADuplicado): string {
  const partes: string[] = [];
  if (candidato.status) partes.push(ESTADOS[candidato.status] ?? candidato.status);
  if (candidato.date_start) {
    const hora = formatTime(candidato.start_time);
    partes.push(`${formatWeekdayDate(candidato.date_start)}${hora ? `, ${hora}` : ''}`);
  }
  const onde = candidato.venue_name ?? candidato.location_name;
  if (onde) partes.push(onde);
  return partes.join(' · ');
}

/** «domingo, 4 de outubro, 21h30» — o dia e a hora de uma data proposta. */
export function diaEHora(data: string, hora: string | null | undefined): string {
  const h = formatTime(hora ?? null);
  return `${formatWeekdayDate(data)}${h ? `, ${h}` : ''}`;
}

/** A chave com que a base distingue duas sessões do mesmo evento (o índice único da 0004). */
function chaveDaSessao(data: string, hora: string | null | undefined): string {
  return `${data}|${(hora ?? '').slice(0, 5) || '00:00'}`;
}

/**
 * As datas que uma proposta traz e o evento ainda não tem — o que «Fundir com
 * este» lhe acrescenta, para a confirmação o dizer antes de se carregar.
 *
 * A comparação é a do índice único das sessões: o mesmo dia e a mesma hora de
 * início, com «sem hora» igual a meia-noite. É o que a função da base descarta
 * em silêncio, e por isso é o que a página não deve prometer.
 */
export function datasNovas<T extends { date: string; start?: string | null }>(
  propostas: readonly T[],
  existentes: readonly Pick<SessaoResumida, 'session_date' | 'start_time'>[],
): T[] {
  const ja = new Set(existentes.map((s) => chaveDaSessao(s.session_date, s.start_time)));
  const vistas = new Set<string>();
  return propostas.filter((proposta) => {
    if (!proposta.date) return false;
    const chave = chaveDaSessao(proposta.date, proposta.start);
    if (ja.has(chave) || vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}
