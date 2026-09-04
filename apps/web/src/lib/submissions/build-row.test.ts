import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { eventFingerprint, publicSubmissionSchema, type PublicSubmission } from '@coreto/core';
import { FORM_CONFIDENCE, buildSubmissionRow, type SubmissionRow } from './build-row';

const META = { ipHash: 'abc123', userAgent: 'Mozilla/5.0 (telemóvel)' };

/** Uma submissão mínima e válida, validada pelo mesmo schema que a rota usa. */
function submission(overrides: Partial<PublicSubmission> = {}): PublicSubmission {
  return publicSubmissionSchema.parse({
    title: 'Concerto de Ano Novo da Banda',
    municipalityId: 'tomar',
    locationName: 'Coreto do Jardim',
    startDate: '2027-01-01',
    contactEmail: 'Geral@Filarmonica.PT',
    consent: true,
    ...overrides,
  });
}

/** Falha o teste em vez de devolver `undefined` quando a linha não foi criada. */
function storedRow(input: PublicSubmission): SubmissionRow {
  const built = buildSubmissionRow(input, META);
  if (built.outcome !== 'store') throw new Error('esperava uma linha para guardar');
  return built.row;
}

describe('buildSubmissionRow', () => {
  it('guarda uma submissão pendente, no canal do formulário', () => {
    const row = storedRow(submission());

    expect(row.channel).toBe('form');
    expect(row.status).toBe('pending');
    expect(row.extraction_status).toBe('skipped');
    expect(row.payload.origin).toBe('form');
    expect(row.confidence).toBe(FORM_CONFIDENCE);
  });

  it('nunca traz nada que publique por si', () => {
    const row = storedRow(submission());
    // O `status` de uma submissão é o único que existe nesta linha; se algum
    // dia aparecer aqui um `published`, é porque alguém ligou os dois mundos.
    expect(JSON.stringify(row)).not.toContain('published');
  });

  it('guarda o contacto normalizado e o que se sabe do pedido', () => {
    const row = storedRow(
      submission({ contactName: '  Ana Ferreira ', organisation: 'Filarmónica de Tomar' }),
    );

    expect(row.sender_email).toBe('geral@filarmonica.pt');
    expect(row.sender_name).toBe('Ana Ferreira');
    expect(row.sender_organisation).toBe('Filarmónica de Tomar');
    expect(row.ip_hash).toBe('abc123');
    expect(row.user_agent).toBe('Mozilla/5.0 (telemóvel)');
  });

  it('deixa a organização e o nome a nulo quando vêm em branco', () => {
    const row = storedRow(submission({ contactName: '   ', organisation: '' }));

    expect(row.sender_name).toBeNull();
    expect(row.sender_organisation).toBeNull();
  });
});

describe('buildSubmissionRow — armadilha', () => {
  it('deita fora a submissão quando o campo escondido vem preenchido', () => {
    // O schema já rejeita um `website` não vazio; isto é a porta de trás,
    // para o caso de alguém validar noutro sítio e chamar isto na mesma.
    const trapped: PublicSubmission = { ...submission(), website: 'https://spam.example' };

    expect(buildSubmissionRow(trapped, META)).toEqual({ outcome: 'discard' });
  });

  it('deixa passar o campo escondido vazio ou ausente', () => {
    expect(buildSubmissionRow({ ...submission(), website: '' }, META).outcome).toBe('store');
    expect(buildSubmissionRow({ ...submission(), website: '   ' }, META).outcome).toBe('store');
    expect(buildSubmissionRow(submission(), META).outcome).toBe('store');
  });
});

describe('buildSubmissionRow — impressão digital', () => {
  it('é a do núcleo, sobre o título normalizado, a data e o concelho', () => {
    const row = storedRow(submission({ title: 'CONCERTO DE ANO NOVO DA BANDA' }));

    // O título entra normalizado — o cartaz vem gritado e a chave não pode
    // depender disso.
    expect(row.payload.title).toBe('Concerto de Ano Novo da Banda');
    expect(row.fingerprint).toBe(
      eventFingerprint('Concerto de Ano Novo da Banda', '2027-01-01', 'tomar'),
    );
    expect(row.payload.fingerprint).toBe(row.fingerprint);
  });

  it('é a mesma fórmula que o Postgres calcula na aprovação', () => {
    const row = storedRow(submission());
    const expected = createHash('sha256')
      .update('concertodeanonovodabanda|2027-01-01|tomar', 'utf8')
      .digest('hex');

    expect(row.fingerprint).toBe(expected);
  });

  it('separa o mesmo evento em concelhos diferentes', () => {
    const tomar = storedRow(submission());
    const abrantes = storedRow(submission({ municipalityId: 'abrantes' }));

    expect(tomar.fingerprint).not.toBe(abrantes.fingerprint);
  });

  it('ignora a pontuação e os acentos, como a chave em SQL', () => {
    const plain = storedRow(submission({ title: 'Concerto de Ano Novo da Banda' }));
    const fancy = storedRow(submission({ title: '«Concerto de Ano-Novo da Banda»' }));

    expect(fancy.fingerprint).toBe(plain.fingerprint);
  });
});

describe('buildSubmissionRow — datas e sessões', () => {
  it('um dia só dá uma sessão e nenhuma data de fim', () => {
    const row = storedRow(submission({ startTime: '21:30' }));

    expect(row.payload.sessions).toEqual([
      {
        session_date: '2027-01-01',
        start_time: '21:30',
        end_time: null,
        venue_id: null,
        location_override: null,
        is_cancelled: false,
        notes: null,
      },
    ]);
    expect(row.payload.date_end).toBeNull();
    expect(row.payload.is_ongoing).toBe(false);
  });

  it('um intervalo de dois dias é um período: os dois extremos, em cartaz', () => {
    // Dois dias colados são o intervalo mais curto que existe, e continua a
    // ser um intervalo: «sábado e domingo» escrito como «de sábado a domingo»
    // é uma coisa só, com princípio e fim, e não duas sessões.
    const row = storedRow(submission({ startDate: '2027-06-05', endDate: '2027-06-06' }));

    expect(row.payload.sessions.map((session) => session.session_date)).toEqual([
      '2027-06-05',
      '2027-06-06',
    ]);
    expect(row.payload.date_start).toBe('2027-06-05');
    expect(row.payload.date_end).toBe('2027-06-06');
    expect(row.payload.is_ongoing).toBe(true);
  });

  it('não expande um fim de semana em sessões diárias', () => {
    // Saíam três sessões — sexta, sábado e domingo — de um intervalo que a
    // pessoa escreveu como uma coisa só. «Um intervalo não é uma lista»
    // (ARQUITETURA.md): guardam-se os extremos e diz-se que está em cartaz.
    const row = storedRow(submission({ startDate: '2027-06-04', endDate: '2027-06-06' }));

    expect(row.payload.sessions.map((session) => session.session_date)).toEqual([
      '2027-06-04',
      '2027-06-06',
    ]);
    expect(row.payload.is_ongoing).toBe(true);
  });

  it('um intervalo de trinta dias dá duas sessões e fica em cartaz', () => {
    // Trinta dias ficavam abaixo do limite de corrida contínua da recolha
    // (45) e saíam como trinta sessões: trinta factos que ninguém afirmou.
    const row = storedRow(submission({ startDate: '2027-03-01', endDate: '2027-03-30' }));

    expect(row.payload.sessions).toHaveLength(2);
    expect(row.payload.sessions.map((session) => session.session_date)).toEqual([
      '2027-03-01',
      '2027-03-30',
    ]);
    expect(row.payload.date_end).toBe('2027-03-30');
    expect(row.payload.is_ongoing).toBe(true);
  });

  it('uma exposição de dois meses fica em cartaz, não em sessenta sessões', () => {
    const row = storedRow(submission({ startDate: '2027-03-01', endDate: '2027-04-30' }));

    expect(row.payload.sessions).toHaveLength(2);
    expect(row.payload.sessions.map((session) => session.session_date)).toEqual([
      '2027-03-01',
      '2027-04-30',
    ]);
    expect(row.payload.is_ongoing).toBe(true);
  });

  it('a hora declarada vai nos dois extremos do intervalo', () => {
    // Como em `sessionsForRange`, na recolha: é a hora que a pessoa deu ao
    // evento, e não uma leitura da prosa que só valesse para o dia de abrir.
    const row = storedRow(
      submission({ startDate: '2027-07-10', endDate: '2027-07-12', startTime: '21:30' }),
    );

    expect(row.payload.sessions).toEqual([
      {
        session_date: '2027-07-10',
        start_time: '21:30',
        end_time: null,
        venue_id: null,
        location_override: null,
        is_cancelled: false,
        notes: null,
      },
      {
        session_date: '2027-07-12',
        start_time: '21:30',
        end_time: null,
        venue_id: null,
        location_override: null,
        is_cancelled: false,
        notes: null,
      },
    ]);
    expect(row.payload.is_ongoing).toBe(true);
  });

  it('uma lista de datas não entra pelo formulário: o schema deita-a fora', () => {
    // «Uma lista dá uma sessão por dia» é regra da casa, mas o formulário
    // público não tem por onde a receber — só início, fim e hora. Uma lista
    // que alguém mande na mesma não vira sessões nem período: fica o dia de
    // início, como em qualquer submissão de um dia.
    const input = publicSubmissionSchema.parse({
      title: 'Ciclo de Cinema ao Ar Livre',
      municipalityId: 'tomar',
      locationName: 'Mouchão',
      startDate: '2027-07-02',
      contactEmail: 'geral@filarmonica.pt',
      consent: true,
      dates: [{ date: '2027-07-02' }, { date: '2027-07-09' }, { date: '2027-07-16' }],
    });

    expect(input).not.toHaveProperty('dates');
    const row = storedRow(input);
    expect(row.payload.sessions.map((session) => session.session_date)).toEqual(['2027-07-02']);
    expect(row.payload.date_end).toBeNull();
    expect(row.payload.is_ongoing).toBe(false);
  });

  it('um fim igual ao início é um dia só', () => {
    const row = storedRow(submission({ startDate: '2027-06-04', endDate: '2027-06-04' }));

    expect(row.payload.sessions).toHaveLength(1);
    expect(row.payload.date_end).toBeNull();
    expect(row.payload.is_ongoing).toBe(false);
  });
});

describe('buildSubmissionRow — preço, local e acessibilidade', () => {
  it('entrada livre marcada ganha ao que estiver escrito no preço', () => {
    const row = storedRow(submission({ isFree: true, priceRaw: '5 €' }));

    expect(row.payload.is_free).toBe(true);
    expect(row.payload.price_min).toBe(0);
    expect(row.payload.price_display).toBe('Entrada livre');
    expect(row.payload.price_raw).toBe('5 €');
  });

  it('lê o intervalo de preços do que a pessoa escreveu', () => {
    const row = storedRow(submission({ priceRaw: '3 € a 5 €' }));

    expect(row.payload.is_free).toBe(false);
    expect(row.payload.price_min).toBe(3);
    expect(row.payload.price_max).toBe(5);
    expect(row.payload.price_display).toBe('3 € – 5 €');
  });

  it('não vai buscar o preço à descrição', () => {
    // «Entrada livre para sócios» ao lado de um bilhete a sério é corrente
    // demais para se arriscar a ler preços da prosa.
    const row = storedRow(
      submission({ description: 'Entrada livre para os sócios da coletividade.' }),
    );

    expect(row.payload.is_free).toBe(false);
    expect(row.payload.price_min).toBeNull();
  });

  it('guarda o espaço do catálogo quando é escolhido', () => {
    const row = storedRow(submission({ venueId: 'tomar-cine-teatro-paraiso' }));

    expect(row.venue_id).toBe('tomar-cine-teatro-paraiso');
    expect(row.payload.venue_id).toBe('tomar-cine-teatro-paraiso');
  });

  it('lê as bandeiras de acessibilidade das notas', () => {
    const row = storedRow(
      submission({ accessibilityNotes: 'Com interpretação em língua gestual portuguesa.' }),
    );

    expect(row.payload.has_sign_language).toBe(true);
    expect(row.payload.accessibility_notes).toBe('Com interpretação em língua gestual portuguesa.');
  });

  it('classifica pelo título quando a categoria fica em branco', () => {
    const row = storedRow(submission({ title: 'Concerto da Filarmónica' }));

    expect(row.payload.category_slug).toBe('musica');
    expect(row.payload.category_confidence).toBeLessThan(1);
  });

  it('respeita a categoria escolhida', () => {
    const row = storedRow(
      submission({ title: 'Concerto da Filarmónica', categorySlug: 'festas-populares' }),
    );

    expect(row.payload.category_slug).toBe('festas-populares');
    expect(row.payload.category_confidence).toBe(1);
  });
});
