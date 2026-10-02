import { describe, expect, it } from 'vitest';
import { datasNovas, diaEHora, fraseDoMotivo, resumoDoCandidato } from './duplicados';
import type { CandidatoADuplicado } from './queries';

const CANDIDATO: CandidatoADuplicado = {
  event_id: '00000000-0000-4000-8000-000000000001',
  title: 'Noite de Fados na Filarmónica',
  slug: 'noite-de-fados-na-filarmonica-abc123',
  status: 'published',
  date_start: '2026-10-04',
  start_time: '21:30:00',
  venue_id: 'sociedade-filarmonica-da-ponte',
  venue_name: 'Sociedade Filarmónica da Ponte',
  location_name: null,
  similarity: 0.31,
  motivo: 'mesmo-espaco-dia-e-hora',
};

describe('os duplicados prováveis, ditos a quem modera', () => {
  it('o motivo diz porquê, sem percentagens quando o título não é a razão', () => {
    expect(fraseDoMotivo(CANDIDATO)).toBe('mesmo espaço, mesmo dia e mesma hora');
    expect(fraseDoMotivo({ motivo: 'titulo-parecido', similarity: 0.824 })).toBe(
      'título parecido (82%)',
    );
  });

  it('o resumo diz o estado, o dia, a hora e o sítio — e nenhuma palavra da casa', () => {
    const resumo = resumoDoCandidato(CANDIDATO);
    expect(resumo).toBe(
      'publicado · domingo, 4 de outubro, 21h30 · Sociedade Filarmónica da Ponte',
    );
    expect(resumo).not.toMatch(/impressão digital|semelhante|[0-9a-f]{8}-/);
  });

  it('o dia e a hora por extenso, e sem hora quando não há', () => {
    expect(diaEHora('2026-10-04', '21:30')).toBe('domingo, 4 de outubro, 21h30');
    expect(diaEHora('2026-10-04', '')).toBe('domingo, 4 de outubro');
  });

  it('«fundir» só promete as datas que o evento não tem, pela regra do índice único', () => {
    const existentes = [
      { session_date: '2026-10-04', start_time: '21:30:00' },
      { session_date: '2026-10-06', start_time: null },
    ];
    const propostas = [
      { date: '2026-10-04', start: '21:30' }, // já lá está
      { date: '2026-10-05', start: '21:30' }, // nova
      { date: '2026-10-05', start: '21:30' }, // repetida na própria proposta
      { date: '2026-10-06', start: '00:00' }, // «sem hora» é meia-noite para a base
      { date: '', start: '10:00' }, // linha sem data não conta
    ];
    expect(datasNovas(propostas, existentes)).toEqual([{ date: '2026-10-05', start: '21:30' }]);
  });
});
