import { describe, expect, it } from 'vitest';
import { COLUNAS_DO_DUMP, construirDump, dumpParaCsv } from './dump';
import type { FeedContext } from './build';
import type { EventCard } from '@/src/lib/queries/types';

const EVENTO: EventCard = {
  id: 'e1',
  slug: 'concerto-de-ano-novo',
  title: 'Concerto de Ano Novo; com "aspas"',
  description_short: 'A Banda abre o ano.',
  municipality_id: 'tomar',
  venue_id: 'cine-teatro-paraiso',
  location_name: null,
  category_slug: 'musica',
  category_confidence: 0.95,
  category_source: 'alias',
  date_start: '2027-01-01',
  date_end: null,
  is_ongoing: false,
  is_free: true,
  price_display: null,
  image_url: 'https://exemplo.pt/cartaz.jpg',
  image_alt: 'O cartaz',
  wheelchair_accessible: true,
  has_sign_language: false,
  has_audio_description: false,
  has_subtitles: false,
  is_relaxed_performance: false,
  audience: 'all_ages',
};

const CONTEXTO: FeedContext = {
  siteUrl: 'https://mediotejo.coreto.org',
  uidDomain: 'mediotejo.coreto.org',
  municipalityNames: { tomar: 'Tomar' },
  venueNames: { 'cine-teatro-paraiso': 'Cine-Teatro Paraíso' },
  categoryNames: { musica: 'Música' },
  sessions: {},
  timestamps: { e1: '2026-12-01T10:00:00Z' },
};

const AGORA = new Date('2026-09-13T20:00:00.000Z');
const REGIAO = { id: 'medio-tejo', nome: 'Médio Tejo' };

describe('construirDump', () => {
  const dump = construirDump(REGIAO, [EVENTO], CONTEXTO, AGORA);

  it('leva a data de geração, a contagem e a licença dentro do próprio ficheiro', () => {
    // Um ficheiro de dados abertos que não diz de quando é obriga quem o recebe
    // a acreditar no nome do anexo.
    expect(dump.gerado_em).toBe('2026-09-13T20:00:00.000Z');
    expect(dump.total).toBe(1);
    expect(dump.licenca.url).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(dump.licenca.atribuicao).toMatch(/CC BY 4\.0/);
  });

  it('diz em português o que inclui, em vez de se chamar «o catálogo inteiro»', () => {
    // Não leva rascunhos, escondidos nem o arquivo. Quem abre o ficheiro tem
    // direito a saber o recorte sem ir ler código nenhum.
    expect(dump.inclui).toMatch(/hoje ou depois/);
    expect(dump.inclui).toMatch(/Não inclui/);
  });

  it('resolve os identificadores e dá a cada evento o seu endereço', () => {
    expect(dump.eventos[0]).toMatchObject({
      municipality_name: 'Tomar',
      venue_name: 'Cine-Teatro Paraíso',
      category_name: 'Música',
      url: 'https://mediotejo.coreto.org/evento/concerto-de-ano-novo',
      updated_at: '2026-12-01T10:00:00Z',
    });
  });

  /**
   * A lista do que nunca pode sair daqui.
   *
   * Este ficheiro é construído a partir das colunas do cartão, e não de um
   * `select` amplo — mas a defesa não pode ser a intenção de quem o escreveu.
   * Um dia alguém acrescenta um campo ao cartão, e o campo sai por aqui para o
   * mundo sem passar por decisão nenhuma.
   */
  it('não leva um único campo de quem submete, nem o caderno da recolha', () => {
    const texto = JSON.stringify(dump);
    for (const proibido of [
      'sender_email',
      'sender_name',
      'ip_hash',
      'user_agent',
      'raw_text',
      'raw_headers',
      'review_notes',
      'notes',
      'config',
      'last_error',
      'reviewed_by',
    ]) {
      expect(texto, `«${proibido}» não pode sair no ficheiro de dados abertos`).not.toContain(
        proibido,
      );
    }
  });
});

describe('dumpParaCsv', () => {
  const csv = dumpParaCsv(construirDump(REGIAO, [EVENTO], CONTEXTO, AGORA));
  const linhas = csv.split('\r\n');

  it('começa com o BOM e leva os metadados em linhas de comentário', () => {
    expect(csv.startsWith('﻿')).toBe(true);
    expect(linhas[1]).toBe('# gerado em: 2026-09-13T20:00:00.000Z');
    expect(linhas.some((l) => l.startsWith('# licença: CC BY 4.0'))).toBe(true);
    expect(linhas.some((l) => l === '# total: 1')).toBe(true);
  });

  it('tem o cabeçalho das colunas logo a seguir aos comentários, e por esta ordem', () => {
    // Um CSV cuja primeira linha de dados muda sozinha parte o leitor de quem o
    // automatizou — e este ficheiro existe para ser automatizado.
    const cabecalho = linhas.find((l) => !l.startsWith('#') && !l.startsWith('﻿#'));
    expect(cabecalho).toBe(COLUNAS_DO_DUMP.join(';'));
  });

  it('escapa as aspas e o ponto e vírgula do título, em vez de partir a coluna', () => {
    const linha = linhas.at(-2);
    expect(linha).toContain('"Concerto de Ano Novo; com ""aspas"""');
  });

  it('escreve os booleanos em português e o vazio como vazio', () => {
    const linha = linhas.at(-2) ?? '';
    // `is_free` verdadeiro, `is_ongoing` falso, `price_display` nulo.
    expect(linha).toContain(';não;sim;;');
  });

  it('acaba com uma quebra de linha, e nunca com um \\n solto', () => {
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).not.toMatch(/[^\r]\n/);
  });
});
