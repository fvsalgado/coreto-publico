import { describe, expect, it } from 'vitest';
import { resolveCategory } from './taxonomy';
import { normalizeForHash } from './text';

const aliases = new Map([
  [normalizeForHash('Música'), 'musica'],
  [normalizeForHash('Exposição'), 'exposicoes'],
  [normalizeForHash('Festas Populares'), 'festas-populares'],
]);

describe('resolveCategory', () => {
  it('usa o alias da fonte, que é a via de maior confiança', () => {
    const result = resolveCategory({ aliases, rawTags: ['Música'] });
    expect(result.categorySlug).toBe('musica');
    expect(result.source).toBe('alias');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('casa o alias sem olhar a acentos nem a caixa', () => {
    expect(resolveCategory({ aliases, rawTags: ['MUSICA'] }).categorySlug).toBe('musica');
    expect(resolveCategory({ aliases, rawTags: ['festas populares'] }).categorySlug).toBe(
      'festas-populares',
    );
  });

  it('regista a etiqueta que não conhece em vez de a adivinhar', () => {
    const result = resolveCategory({ aliases, rawTags: ['Sarau Cultural'] });
    expect(result.categorySlug).toBe(null);
    expect(result.unknownTags).toEqual(['Sarau Cultural']);
  });

  it('cai para palavras do título, com menos confiança', () => {
    const result = resolveCategory({ aliases, title: 'Concerto da Filarmónica' });
    expect(result.categorySlug).toBe('musica');
    expect(result.source).toBe('keyword');
    expect(result.confidence).toBeLessThan(0.9);
  });

  it('não decide a partir da descrição — só do título', () => {
    const result = resolveCategory({
      aliases,
      title: 'Sarau',
      description: 'Haverá um concerto no final.',
    });
    expect(result.categorySlug).toBe(null);
  });

  it('cai para o tipo de espaço em último recurso, com pouca confiança', () => {
    const result = resolveCategory({ aliases, title: 'Sarau', venueKind: 'library' });
    expect(result.categorySlug).toBe('literatura');
    expect(result.source).toBe('venue_kind');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('devolve nada quando não há sinal nenhum', () => {
    const result = resolveCategory({ aliases, title: 'Sarau' });
    expect(result.categorySlug).toBe(null);
    expect(result.source).toBe('none');
    expect(result.confidence).toBe(0);
  });

  it('regista todas as etiquetas desconhecidas antes de encontrar uma boa', () => {
    const result = resolveCategory({ aliases, rawTags: ['Sarau', 'Convívio', 'Música'] });
    expect(result.categorySlug).toBe('musica');
    expect(result.unknownTags).toEqual(['Sarau', 'Convívio']);
  });
});

describe('as palavras que a auditoria de 30 de agosto mostrou faltarem', () => {
  /*
   * Sessenta e cinco dos cento e trinta e nove eventos publicados estavam sem
   * categoria — quase metade da agenda fora de todos os filtros. Estes são os
   * títulos verdadeiros que a base tinha nesse dia, um por cada regra que
   * falhava por morfologia e não por ambiguidade.
   */
  const acertos: Array<[string, string]> = [
    // O plural, que é a forma comum.
    ['Noite de Fados', 'musica'],
    ['Roda de Samba', 'musica'],
    ['Focus Sax Quartet — Quarteto de Saxofones', 'musica'],
    ['Acordeão em Festa!', 'musica'],
    // O diminutivo e o plural de «feira».
    ['18ª Edição da Feirinha de Setembro', 'feiras-mercados'],
    ['Mercados Ecorurais', 'feiras-mercados'],
    ['Mercado de Trocas', 'feiras-mercados'],
    // «Festa … em honra de», com palavras pelo meio.
    ['Festa de Verão em Honra de S. Sebastião', 'festas-populares'],
    ['Festas em Honra de Nossa Senhora da Piedade', 'festas-populares'],
    ['Magusto', 'festas-populares'],
    // A festa da terra sem santo declarado: o que vem depois de «Festa de» é
    // um lugar. Estes são os títulos verdadeiros das juntas de freguesia.
    ['Festa de Águas Belas', 'festas-populares'],
    ['Festa de Cem Soldos', 'festas-populares'],
    ['Festas da Portela, Colmeal e Cabeça Ruiva 2026', 'festas-populares'],
    // A colectividade da aldeia também faz a festa da aldeia.
    ['Festa do Desportivo de Igreja Nova', 'festas-populares'],
    // E o erro de escrita da própria junta — «Hora» por «Honra» — não impede
    // nada, porque o que decide é a âncora e não a palavra que falhou. A
    // fonte escreve assim e o título fica como a fonte o escreve.
    ['Festa de Verão em Hora de S. Miguel', 'festas-populares'],
    ['Procissão na capela de Almogadel', 'festas-populares'],
    // Desporto que não é caminhada.
    ['13º Trail de Fátima', 'desporto-natureza'],
    ['Constância Kayak Trail', 'desporto-natureza'],
    ['IX Downhill Urbano Constância', 'desporto-natureza'],
    ['Torneio de tiro ao alvo', 'desporto-natureza'],
    ['Yoga Sénior - Turma 1', 'desporto-natureza'],
    // Livros e ideias.
    ['Clube de Leitura', 'literatura'],
    ['Congresso do Desporto', 'literatura'],
    // Infância.
    ['Era uma vez outra vez - ciclo de contadores de histórias', 'infantil'],
    // Plurais que já deviam casar e não casavam.
    ['Oficinas de Verão', 'formacao'],
    ['Exposições de Fotografia', 'exposicoes'],
    ['Workshop de Danças, com Dulce Maurício', 'formacao'],
  ];

  for (const [titulo, esperado] of acertos) {
    it(`«${titulo}» → ${esperado}`, () => {
      expect(resolveCategory({ aliases: new Map(), title: titulo }).categorySlug).toBe(esperado);
    });
  }

  /*
   * E o que continua — de propósito — sem categoria. Um título que pode ser
   * tudo não recebe nada: uma categoria errada é pior do que nenhuma, porque
   * desvia o evento do filtro onde as pessoas o procuram.
   */
  const calados = [
    'Comemoração do Dia Internacional da Juventude 26',
    'Cerimónia “Regenerar Alcanena” 2026',
    'Almoço dos Idosos',
    'Raízes de Montalvo',
    'Celebratorium',
    // Um festival é programado por alguém; uma festa da terra acontece
    // porque é aquela semana do ano. Nenhum destes dois é uma festa popular,
    // e é a fronteira de `festas?` que os deixa passar.
    'Festival da Saúde',
    'Festival ao Alto',
    // «Festa do Livro» tem prateleira própria no catálogo, e não é esta. A
    // exclusão existe para que a regra larga não a apanhe; a categoria certa
    // virá de uma etiqueta da fonte ou de outra regra, não daqui.
    'Festa do Livro',
  ];

  for (const titulo of calados) {
    it(`«${titulo}» fica sem categoria, que é a resposta honesta`, () => {
      expect(resolveCategory({ aliases: new Map(), title: titulo }).categorySlug).toBe(null);
    });
  }
});
