import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractedEventSchema, publicSubmissionSchema } from '@coreto/core';
import { buildSubmissionRow } from '../submissions/build-row';
import {
  CAMPOS_DA_REGIAO,
  camposRecebidos,
  changedFields,
  comAviso,
  destinoDoPainel,
  EDITABLE_FIELDS,
  estadoDaLicenca,
  eventoParaAprovar,
  formaDoPayload,
  proposedFromPayload,
  proposedSessions,
  propostoEmCartaz,
  readEvent,
  readSessions,
} from './fields';

/**
 * O payload que a recolha grava, na forma verdadeira.
 *
 * Copiado de uma submissão real de `cm-ourem` — chaves de topo `event`, `raw`
 * e `sessions`, com o evento em snake_case. É a forma que a página de revisão
 * não sabia ler, e por isso mostrava o formulário inteiro em branco.
 */
const DA_RECOLHA = {
  raw: {
    sourceKey: 'ourem-123',
    sourceUrl: 'https://www.ourem.pt/evento/mercados-ecorurais',
    title: 'Mercados Ecorurais',
    venueName: null,
    dates: [{ date: '2026-09-06', startTime: '14:00' }],
  },
  event: {
    title: 'Mercados Ecorurais',
    subtitle: null,
    description: 'Produtores locais na praça.',
    municipality_id: 'ourem',
    venue_id: null,
    location_name: null,
    parish: null,
    how_to_arrive: null,
    category_slug: 'feiras-e-mercados',
    series_id: null,
    is_free: true,
    price_display: null,
    price_raw: null,
    ticketing_url: null,
    image_url: 'https://www.ourem.pt/cartaz.jpg',
    accessibility_notes: null,
    date_start: '2026-09-06',
    confidence: 0.75,
  },
  sessions: [
    { session_date: '2026-09-06', start_time: '14:00', end_time: null, is_cancelled: false },
  ],
};

/** O que a extração de email propõe: plano e em camelCase. */
const DA_EXTRACAO = {
  title: 'Concerto de Ano Novo',
  description: 'Pela orquestra da casa.',
  municipalityId: 'tomar',
  venueId: 'casa-da-cultura',
  locationName: '',
  categorySlug: 'musica',
  isFree: false,
  priceRaw: '10 €',
  imageUrl: 'https://exemplo.pt/cartaz.jpg',
  dates: [{ date: '2027-01-01', startTime: '21:30' }],
};

describe('proposedFromPayload', () => {
  it('lê o payload aninhado da recolha', () => {
    const proposto = proposedFromPayload(DA_RECOLHA, { municipality_id: 'ourem' });

    expect(proposto.title).toBe('Mercados Ecorurais');
    expect(proposto.description).toBe('Produtores locais na praça.');
    expect(proposto.municipality_id).toBe('ourem');
    expect(proposto.category_slug).toBe('feiras-e-mercados');
    expect(proposto.image_url).toBe('https://www.ourem.pt/cartaz.jpg');
    expect(proposto.is_free).toBe(true);
  });

  it('deixa em branco exatamente o que falta, e mais nada', () => {
    const proposto = proposedFromPayload(DA_RECOLHA, { municipality_id: 'ourem' });

    // É este o campo por preencher — a razão de o candidato estar na fila.
    expect(proposto.venue_id).toBe('');
    expect(proposto.location_name).toBe('');
    // E o resto não está.
    expect(proposto.title).not.toBe('');
  });

  it('continua a ler o payload plano da extração', () => {
    const proposto = proposedFromPayload(DA_EXTRACAO);

    expect(proposto.title).toBe('Concerto de Ano Novo');
    expect(proposto.municipality_id).toBe('tomar');
    expect(proposto.venue_id).toBe('casa-da-cultura');
    // `priceRaw` entra em `price_display`: não é conversão mecânica de nomes.
    expect(proposto.price_display).toBe('10 €');
    expect(proposto.is_free).toBe(false);
  });

  it('as colunas da submissão só valem quando o payload se cala', () => {
    const proposto = proposedFromPayload(DA_EXTRACAO, { municipality_id: 'ourem' });
    expect(proposto.municipality_id).toBe('tomar');

    const vazio = proposedFromPayload({}, { municipality_id: 'ourem', venue_id: 'casa' });
    expect(vazio.municipality_id).toBe('ourem');
    expect(vazio.venue_id).toBe('casa');
  });

  it('um payload vazio dá tudo em branco em vez de rebentar', () => {
    const proposto = proposedFromPayload({});
    expect(proposto.title).toBe('');
    expect(proposto.is_free).toBe(false);
  });

  it('o que sai serve de base a changedFields sem mais nada pelo meio', () => {
    const proposto = proposedFromPayload(DA_RECOLHA, { municipality_id: 'ourem' });
    const editado = { ...proposto, location_name: 'Praça do Município' };
    expect(changedFields(proposto, editado)).toEqual(['location_name']);
  });
});

describe('readEvent', () => {
  function formulario(campos: Record<string, string>): FormData {
    const dados = new FormData();
    for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
    return dados;
  }

  it('lê os campos editáveis aparados, e o que vem vazio fica a nulo', () => {
    const evento = readEvent(formulario({ title: '  Noite de fados ', subtitle: '   ' }));
    expect(evento.title).toBe('Noite de fados');
    expect(evento.subtitle).toBeNull();
    expect(evento.is_free).toBe(false);
  });

  it('«em cartaz» viaja com o evento: ligado é um período, desligado são sessões', () => {
    // Um intervalo que o formulário público guardou como período (build-row)
    // tem de chegar à base como período — a aprovação deixava-o cair.
    expect(readEvent(formulario({ title: 'Exposição', is_ongoing: 'on' })).is_ongoing).toBe(true);
    expect(readEvent(formulario({ title: 'Concerto' })).is_ongoing).toBe(false);
  });

  it('«em cartaz» não é um campo bloqueável: mudá-lo não conta como correção', () => {
    const proposto = { title: 'Exposição', is_free: false };
    const editado = readEvent(formulario({ title: 'Exposição', is_ongoing: 'on' }));
    expect(changedFields(proposto, editado)).toEqual([]);
  });
});

describe('proposedSessions', () => {
  it('lê as linhas que a recolha já gravou, com fim quando o há', () => {
    expect(proposedSessions(DA_RECOLHA)).toEqual([{ date: '2026-09-06', start: '14:00', end: '' }]);
  });

  it('lê as datas da extração', () => {
    expect(proposedSessions(DA_EXTRACAO)).toEqual([
      { date: '2027-01-01', start: '21:30', end: '' },
    ]);
  });

  it('sem sessões nenhumas, uma lista vazia', () => {
    expect(proposedSessions({})).toEqual([]);
  });
});

describe('comAviso', () => {
  it('guarda os filtros de quem estava a trabalhar', () => {
    const volta = comAviso('/admin/eventos?estado=draft&concelho=ourem', '3 eventos publicados.');
    expect(volta).toContain('estado=draft');
    expect(volta).toContain('concelho=ourem');
    expect(volta).toContain('aviso=3+eventos+publicados.');
  });

  it('não empilha avisos de acções seguidas', () => {
    const volta = comAviso('/admin/eventos?aviso=antigo&estado=draft', 'novo');
    expect(volta.match(/aviso=/g)).toHaveLength(1);
    expect(volta).toContain('aviso=novo');
  });

  it('aguenta um destino sem query nenhuma', () => {
    expect(comAviso('/admin/eventos', 'feito')).toBe('/admin/eventos?aviso=feito');
  });
});

describe('estadoDaLicenca', () => {
  const HOJE = '2026-09-01';

  it('sem linhas, diz que não há — e não alarma', () => {
    expect(estadoDaLicenca([], HOJE)).toEqual({ texto: 'Sem licença registada.', alerta: false });
  });

  it('sem prazo é um estado tranquilo, com a data de início à vista', () => {
    const estado = estadoDaLicenca(
      [{ kind: 'demo', starts_on: '2026-09-01', ends_on: null }],
      HOJE,
    );
    expect(estado.alerta).toBe(false);
    expect(estado.texto).toBe('Licença «demo» sem prazo, desde 01/09/2026.');
  });

  it('longe do fim conta os dias sem alarmar; a 30 dias acende', () => {
    const longe = estadoDaLicenca(
      [{ kind: 'contrato', starts_on: '2026-01-01', ends_on: '2027-09-01' }],
      HOJE,
    );
    expect(longe.alerta).toBe(false);
    expect(longe.texto).toContain('até 01/09/2027');

    const perto = estadoDaLicenca(
      [{ kind: 'contrato', starts_on: '2026-01-01', ends_on: '2026-09-30' }],
      HOJE,
    );
    expect(perto.alerta).toBe(true);
    expect(perto.texto).toContain('faltam 29 dias');
  });

  it('expirada alarma e diz desde quando — mas quem desliga é uma pessoa', () => {
    const estado = estadoDaLicenca(
      [{ kind: 'contrato', starts_on: '2025-01-01', ends_on: '2026-08-15' }],
      HOJE,
    );
    expect(estado).toEqual({
      texto: 'Licença «contrato» expirada desde 15/08/2026.',
      alerta: true,
    });
  });

  it('a linha mais recente manda: uma renovação cala a expirada', () => {
    const estado = estadoDaLicenca(
      [
        { kind: 'contrato', starts_on: '2026-08-20', ends_on: '2027-08-20' },
        { kind: 'piloto', starts_on: '2025-08-20', ends_on: '2026-08-20' },
      ],
      HOJE,
    );
    expect(estado.alerta).toBe(false);
    expect(estado.texto).toContain('até 20/08/2027');
  });
});

/**
 * O formulário e a função da base têm de conhecer os mesmos campos.
 *
 * A lista fechada vive no SQL (`v_editaveis`, na 0109) e o formulário tem o
 * espelho dela em `CAMPOS_DA_REGIAO`. Divergirem em silêncio dava um campo que
 * se preenche e a base recusa — ou um que a base aceita e ninguém consegue
 * preencher. O teste lê a ÚLTIMA migração que declara a lista, porque as
 * migrações desta casa nunca se reescrevem: uma coluna nova entra por um
 * `create or replace` numa migração futura, e é essa que passa a valer.
 */
describe('CAMPOS_DA_REGIAO', () => {
  it('espelha a lista fechada da update_region, campo a campo', () => {
    const pasta = fileURLToPath(new URL('../../../../../supabase/migrations/', import.meta.url));
    const comLista = readdirSync(pasta)
      .filter((nome) => nome.endsWith('.sql'))
      .sort()
      .filter((nome) => readFileSync(pasta + nome, 'utf8').includes('v_editaveis'));
    const ultima = comLista.at(-1);
    expect(ultima, 'nenhuma migração declara v_editaveis').toBeDefined();

    const sql = readFileSync(pasta + ultima, 'utf8');
    const bloco = sql.match(/v_editaveis text\[\] := array\[([\s\S]*?)\]/)?.[1] ?? '';
    const naBase = [...bloco.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? '').sort();

    // `is_enabled` edita-se pelo mesmo formulário mas não é um campo de texto:
    // é o checkbox que a ação lê à parte. Na comparação entra como os outros.
    const noFormulario = [...Object.keys(CAMPOS_DA_REGIAO), 'is_enabled'].sort();

    expect(naBase.length).toBeGreaterThan(0);
    expect(noFormulario).toEqual(naBase);
  });
});

/**
 * «Não perguntado» não é «apagado».
 *
 * O formulário de revisão desenha doze dos quinze campos editáveis: faltam-lhe
 * o subtítulo, a freguesia e o ciclo. O `readEvent` percorria os quinze e fazia
 * `formData.get` a todos, por isso uma ausência de pergunta saía de lá como um
 * `null` — que é uma afirmação. O `changedFields` comparava o que a fonte
 * propunha com esse `null`, concluía que o editor mudara o campo, e mandava-o
 * trancar contra a recolha.
 *
 * Medido contra um Postgres com as 129 migrações: o evento saía com os três
 * campos a nulo **e** com três bloqueios manuais de valor nulo. Em produção
 * ainda não aconteceu — a via da moderação produziu um bloqueio em toda a
 * história da base, e as 7 submissões aprovadas não traziam nenhum dos três.
 * A porta é que estava aberta, e o `portal-freguesia` põe `parish` em todos os
 * eventos que devolve, em 26 fontes.
 */
describe('o que o formulário não pergunta não se apaga', () => {
  const formulario = (campos: Record<string, string>): FormData => {
    const dados = new FormData();
    for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
    return dados;
  };

  it('um campo que o formulário não trouxe não vira nulo — fica de fora', () => {
    const evento = readEvent(formulario({ title: 'Noite de fados' }));

    expect('parish' in evento).toBe(false);
    expect('subtitle' in evento).toBe(false);
    expect('series_id' in evento).toBe(false);
  });

  it('e por isso não se tranca contra a recolha', () => {
    // O `is_free` vai no proposto porque o `proposedFromPayload` põe-no
    // sempre: é booleano, e um booleano não tem ausência.
    const proposto = {
      title: 'Noite de fados',
      parish: 'Minde',
      subtitle: 'Um serão',
      is_free: false,
    };
    const editado = readEvent(formulario({ title: 'Noite de fados' }));

    expect(changedFields(proposto, editado)).toEqual([]);
  });

  /*
   * O controlo que separa as duas coisas: um campo que o formulário **trouxe**
   * e o editor esvaziou continua a trancar. Isso é uma decisão de uma pessoa, e
   * a recolha não lha desfaz na noite seguinte.
   */
  it('mas um campo que o editor esvaziou de propósito continua a trancar', () => {
    const proposto = { title: 'Noite de fados', location_name: 'Casa da Cultura', is_free: false };
    const editado = readEvent(formulario({ title: 'Noite de fados', location_name: '  ' }));

    expect(editado.location_name).toBeNull();
    expect(changedFields(proposto, editado)).toEqual(['location_name']);
  });

  /*
   * E a caixa fica de fora da regra, porque em HTML uma caixa por picar não é
   * submetida: a ausência dela é a resposta, não uma pergunta que ninguém fez.
   */
  it('uma caixa por picar continua a ser «não», e não «não perguntei»', () => {
    expect(readEvent(formulario({ title: 'x' })).is_free).toBe(false);
    expect(readEvent(formulario({ title: 'x' })).is_ongoing).toBe(false);
  });
});

/**
 * A caixa «Em cartaz», e as duas formas do payload.
 *
 * O payload chega aninhado quando vem da recolha e liso quando vem da
 * extração. A página lia só a forma lisa — e as 49 submissões que este sistema
 * recebeu são **todas** da recolha, por isso a caixa vinha desmarcada mesmo
 * para os períodos. Quem aprovasse sem reparar transformava três semanas de
 * exposição em dois espetáculos, o de abrir e o de fechar.
 */
describe('propostoEmCartaz', () => {
  it('lê a forma aninhada, que é a da recolha', () => {
    expect(propostoEmCartaz({ event: { is_ongoing: true } })).toBe(true);
    expect(propostoEmCartaz({ ...DA_RECOLHA })).toBe(false);
  });

  it('e a forma lisa, que é a da extração', () => {
    expect(propostoEmCartaz({ is_ongoing: true })).toBe(true);
    expect(propostoEmCartaz({ is_ongoing: false })).toBe(false);
  });

  it('e um payload que não diz nada é «não», e não um talvez', () => {
    expect(propostoEmCartaz({})).toBe(false);
    expect(propostoEmCartaz({ event: {} })).toBe(false);
  });
});

/**
 * Todo o campo editável tem uma caixa no formulário.
 *
 * Este é o guarda que faltava, e é ele que fecha a classe em vez do caso. A
 * lista de campos editáveis e o formulário que os pergunta viviam em ficheiros
 * diferentes, sem nada a ligá-los: acrescentar um a `EDITABLE_FIELDS` sem lhe
 * desenhar a caixa compila, passa nos testes, e faz a aprovação escrever nulo
 * nesse campo — e trancá-lo contra a recolha. Foi o que aconteceu ao subtítulo,
 * à freguesia e ao ciclo.
 *
 * Lê a página do disco, como os testes acima leem as migrações. É grosseiro de
 * propósito: um `name=` é o que o navegador submete, e é exactamente isso que o
 * `readEvent` vai procurar. Um teste mais esperto provaria outra coisa.
 */
describe('o formulário de revisão pergunta por tudo o que se pode editar', () => {
  const pagina = readFileSync(
    fileURLToPath(new URL('../../../app/admin/fila/[id]/page.tsx', import.meta.url)),
    'utf8',
  );
  const comCaixa = new Set(
    [...pagina.matchAll(/name="([a-z_]+)"/g)].map((encontro) => encontro[1]),
  );

  it.each(EDITABLE_FIELDS)('%s tem uma caixa', (campo) => {
    expect(comCaixa.has(campo)).toBe(true);
  });
});

describe('destinoDoPainel', () => {
  it('aceita caminhos do painel, com ou sem consulta', () => {
    expect(destinoDoPainel('/admin/eventos?estado=publicado')).toBe(
      '/admin/eventos?estado=publicado',
    );
    expect(destinoDoPainel('/admin')).toBe('/admin');
    expect(destinoDoPainel('/admin/fila/abc')).toBe('/admin/fila/abc');
  });

  // Um `voltar` vem do corpo do pedido, e o corpo do pedido é do cliente.
  it('recusa o que sai do painel e cai no destino por omissão', () => {
    expect(destinoDoPainel('https://exemplo.pt/')).toBe('/admin/eventos');
    expect(destinoDoPainel('//exemplo.pt/')).toBe('/admin/eventos');
    expect(destinoDoPainel('/agenda')).toBe('/admin/eventos');
    expect(destinoDoPainel('/administracao')).toBe('/admin/eventos');
    expect(destinoDoPainel('', '/admin/fila')).toBe('/admin/fila');
  });
});

/**
 * Aprovar sem mexer em nada não pode perder nada — um caso por canal.
 *
 * É o gesto do C4-010: abrir a proposta na fila e carregar em «Aprovar e
 * publicar». O formulário simula-se como a página o desenha — um campo por
 * editável, a caixa da entrada livre e a do «em cartaz», as sessões em três
 * listas — e o que sai da aprovação compara-se com o que entrou, coluna a
 * coluna.
 *
 * As colunas não estão escritas aqui: leem-se da ÚLTIMA migração que define a
 * `approve_submission`, como o teste da `update_region` lê a dela. Uma coluna
 * que uma migração futura ponha a função a ler entra neste teste sozinha — e
 * se o formulário a deixar cair, é aqui que se sabe.
 */
const PASTA_DAS_MIGRACOES = fileURLToPath(
  new URL('../../../../../supabase/migrations/', import.meta.url),
);

function colunasDaAprovacao(): string[] {
  const comFuncao = readdirSync(PASTA_DAS_MIGRACOES)
    .filter((nome) => nome.endsWith('.sql'))
    .sort()
    .filter((nome) =>
      readFileSync(PASTA_DAS_MIGRACOES + nome, 'utf8').includes(
        'create or replace function public.approve_submission(',
      ),
    );
  const ultima = comFuncao.at(-1);
  if (!ultima) throw new Error('nenhuma migração define a approve_submission');
  const sql = readFileSync(PASTA_DAS_MIGRACOES + ultima, 'utf8');
  const corpo = sql.slice(sql.indexOf('create or replace function public.approve_submission('));
  return [...new Set([...corpo.matchAll(/p_event\s*->>?\s*'([a-z_]+)'/g)].map((m) => m[1] ?? ''))];
}

/**
 * As que a função decide sozinha, e porquê. Não são perdas: são colunas que
 * não se copiam da proposta.
 */
const DECIDIDAS_PELA_FUNCAO = new Set([
  'id', // um evento novo nasce com identificador novo
  'slug', // sai do título aprovado
  'origin', // a função usa o canal da submissão, que é o mesmo
  'confidence', // a função usa a da submissão
  'fingerprint', // a função calcula-a do título, data e concelho aprovados
  'source_key', // a função lê-a do payload da submissão, sem passar por aqui
]);

function formularioDaPagina(
  payload: Record<string, unknown>,
  colunas: { municipality_id?: string | null; venue_id?: string | null } = {},
): FormData {
  const proposto = proposedFromPayload(payload, colunas);
  const dados = new FormData();
  for (const campo of EDITABLE_FIELDS) {
    if (campo === 'is_free') {
      if (proposto.is_free) dados.set('is_free', 'on');
      continue;
    }
    dados.set(campo, proposto[campo]);
  }
  if (propostoEmCartaz(payload)) dados.set('is_ongoing', 'on');
  for (const sessao of proposedSessions(payload)) {
    dados.append('session_date', sessao.date);
    dados.append('session_start', sessao.start);
    dados.append('session_end', sessao.end);
  }
  return dados;
}

function aprovarSemMexer(
  payload: Record<string, unknown>,
  colunas: { municipality_id?: string | null; venue_id?: string | null } = {},
): { evento: Record<string, unknown>; sessoes: Array<Record<string, string>> } {
  const dados = formularioDaPagina(payload, colunas);
  const evento = eventoParaAprovar(
    payload,
    proposedFromPayload(payload, colunas),
    readEvent(dados),
  );
  const sessoes = readSessions(dados);
  if (sessoes[0]) evento.date_start = sessoes[0].session_date;
  return { evento, sessoes };
}

/** Cada coluna que a aprovação lê e o payload traz chega ao evento igual. */
function semPerdas(evento: Record<string, unknown>, proposta: Record<string, unknown>): string[] {
  const perdidas: string[] = [];
  for (const coluna of colunasDaAprovacao()) {
    if (DECIDIDAS_PELA_FUNCAO.has(coluna)) continue;
    const enviado = proposta[coluna];
    if (enviado === undefined || enviado === null) continue;
    if (JSON.stringify(evento[coluna]) !== JSON.stringify(enviado)) {
      perdidas.push(
        `${coluna}: enviado ${JSON.stringify(enviado)}, aprovado ${JSON.stringify(evento[coluna])}`,
      );
    }
  }
  return perdidas;
}

/** O concerto do C4-010, tal como chegou por `POST /api/submissions`. */
function doPrograma(): Record<string, unknown> {
  const construido = buildSubmissionRow(
    publicSubmissionSchema.parse({
      title: 'Concerto de Outono da Orquestra Ligeira do Vale',
      description:
        'Valsas, marchas e bandas sonoras. Cerca de 70 minutos, sem intervalo. Para toda a família, a partir dos 6 anos.',
      municipalityId: 'vila-da-charamela',
      venueId: 'cine-teatro-da-charamela',
      startDate: '2026-10-24',
      startTime: '21:00',
      categorySlug: 'musica',
      priceRaw: '6 €; 3 € até aos 12 anos',
      ticketingUrl: 'https://bilheteira.example/orquestra',
      sourceUrl: 'https://orquestra.example/outono',
      howToArrive: 'Autocarro da carreira 3.',
      accessibilityNotes:
        'Plateia com acesso a cadeira de rodas e sessão com interpretação em língua gestual portuguesa.',
      contactEmail: 'marta@orquestra.example',
      consent: true,
    }),
    { ipHash: null, userAgent: null },
  );
  if (construido.outcome !== 'store') throw new Error('o envio devia ser guardado');
  return construido.row.payload as unknown as Record<string, unknown>;
}

describe('aprovar sem mexer em nada não perde nada', () => {
  it('as colunas vêm da função, e não de uma lista escrita à mão', () => {
    const colunas = colunasDaAprovacao();
    expect(colunas).toContain('category_slug');
    expect(colunas).toContain('wheelchair_accessible');
    expect(colunas).toContain('min_age');
  });

  it('envio por programa: as colunas do envio chegam todas ao evento', () => {
    const payload = doPrograma();
    expect(formaDoPayload(payload)).toBe('programa');

    // O que o C4-010 viu sair a branco, um a um.
    const proposto = proposedFromPayload(payload);
    expect(proposto.category_slug).toBe('musica');
    expect(proposto.price_display).not.toBe('');
    expect(proposto.ticketing_url).toBe('https://bilheteira.example/orquestra');
    expect(proposto.accessibility_notes).toContain('cadeira de rodas');
    expect(proposto.how_to_arrive).toBe('Autocarro da carreira 3.');

    const { evento, sessoes } = aprovarSemMexer(payload);
    expect(semPerdas(evento, payload)).toEqual([]);
    expect(evento.wheelchair_accessible).toBe(true);
    expect(evento.has_sign_language).toBe(true);
    expect(evento.audience).toBe('family');
    expect(evento.min_age).toBe(6);
    expect(sessoes).toEqual([{ session_date: '2026-10-24', start_time: '21:00' }]);
  });

  it('envio por programa sem espaço do catálogo: o local escrito não se perde', () => {
    const construido = buildSubmissionRow(
      publicSubmissionSchema.parse({
        title: 'Magusto da associação',
        municipalityId: 'ponte-do-bombo',
        locationName: 'Largo da Igreja',
        startDate: '2026-11-08',
        contactEmail: 'geral@associacao.example',
        consent: true,
      }),
      { ipHash: null, userAgent: null },
    );
    if (construido.outcome !== 'store') throw new Error('o envio devia ser guardado');
    const payload = construido.row.payload as unknown as Record<string, unknown>;

    expect(proposedFromPayload(payload).location_name).toBe('Largo da Igreja');
    expect(semPerdas(aprovarSemMexer(payload).evento, payload)).toEqual([]);
  });

  it('recolha: o evento harmonizado chega inteiro, mais o que o formulário não mostra', () => {
    const payload = {
      ...DA_RECOLHA,
      event: {
        ...DA_RECOLHA.event,
        location_name: 'Praça do Município',
        title_raw: 'MERCADOS ECORURAIS',
        description_short: 'Produtores locais na praça.',
        latitude: 39.65,
        longitude: -8.58,
        audience: 'all_ages',
        min_age: 3,
        duration_minutes: 240,
        price_raw: 'Entrada livre',
        price_min: 0,
        wheelchair_accessible: true,
        has_subtitles: true,
        image_credit: 'Município de Ourém',
        image_alt: 'Mercados Ecorurais',
        source_url: 'https://www.ourem.pt/evento/mercados-ecorurais',
      },
    };
    expect(formaDoPayload(payload)).toBe('recolha');

    const { evento } = aprovarSemMexer(payload, { municipality_id: 'ourem' });
    expect(semPerdas(evento, payload.event)).toEqual([]);
  });

  it('extração de email: o que o email dizia chega ao evento, e deduz-se como nos outros canais', () => {
    const payload = extractedEventSchema.parse({
      title: 'Hora do conto para famílias',
      description: 'Histórias para os mais pequenos, dos 3 aos 6 anos.',
      municipalityId: 'tomar',
      venueName: 'Sala do Rio',
      parish: 'Serra',
      dates: [{ date: '2026-10-10', startTime: '10:30' }],
      categorySlug: 'infantil',
      audienceRaw: 'para famílias',
      isFree: true,
      priceRaw: 'Entrada livre',
      ticketingUrl: 'https://biblioteca.example/reservas',
      accessibilityNotes: 'Sessão com interpretação em Língua Gestual Portuguesa.',
      confidence: 0.8,
    }) as unknown as Record<string, unknown>;
    expect(formaDoPayload(payload)).toBe('extracao');

    // O espaço que o catálogo não reconheceu fica como local, em vez de cair.
    const { evento, sessoes } = aprovarSemMexer(payload, { municipality_id: 'tomar' });
    expect(evento.location_name).toBe('Sala do Rio');
    expect(evento.parish).toBe('Serra');
    expect(evento.category_slug).toBe('infantil');
    expect(evento.is_free).toBe(true);
    expect(evento.price_display).toBe('Entrada livre');
    expect(evento.price_raw).toBe('Entrada livre');
    expect(evento.price_min).toBe(0);
    expect(evento.ticketing_url).toBe('https://biblioteca.example/reservas');
    expect(evento.has_sign_language).toBe(true);
    expect(evento.audience).toBe('family');
    expect(evento.date_start).toBe('2026-10-10');
    expect(sessoes).toEqual([{ session_date: '2026-10-10', start_time: '10:30' }]);
  });
});

describe('o que o editor muda volta a deduzir-se, e só isso', () => {
  it('trocar o preço refaz os números, em vez de deixar os do preço antigo', () => {
    const payload = doPrograma();
    const proposto = proposedFromPayload(payload);
    const editado = {
      ...readEvent(formularioDaPagina(payload)),
      price_display: 'Entrada livre',
      is_free: true,
    };
    const evento = eventoParaAprovar(payload, proposto, editado);
    expect(evento.price_min).toBe(0);
    expect(evento.price_max).toBeNull();
    // O que a fonte escreveu fica como proveniência.
    expect(evento.price_raw).toBe('6 €; 3 € até aos 12 anos');
  });

  it('acrescentar a audiodescrição às notas acende o eixo, como a recolha o acenderia', () => {
    const payload = doPrograma();
    const proposto = proposedFromPayload(payload);
    const editado = {
      ...readEvent(formularioDaPagina(payload)),
      accessibility_notes: 'Sessão com audiodescrição.',
    };
    const evento = eventoParaAprovar(payload, proposto, editado);
    expect(evento.has_audio_description).toBe(true);
    expect(evento.has_sign_language).toBe(false);
  });

  it('mudar o espaço tira as coordenadas do sítio antigo; mudar o cartaz tira o crédito', () => {
    const payload = {
      ...DA_RECOLHA,
      event: { ...DA_RECOLHA.event, latitude: 39.6, longitude: -8.5, image_credit: 'Câmara' },
    };
    const proposto = proposedFromPayload(payload, { municipality_id: 'ourem' });
    const base = readEvent(formularioDaPagina(payload, { municipality_id: 'ourem' }));
    const evento = eventoParaAprovar(payload, proposto, {
      ...base,
      venue_id: 'outro-espaco',
      image_url: 'https://exemplo.pt/outro.jpg',
    });
    expect(evento.latitude).toBeUndefined();
    expect(evento.longitude).toBeUndefined();
    expect(evento.image_credit).toBeUndefined();
    expect(evento.image_alt).toBe('Mercados Ecorurais');
  });

  it('nenhum herdado passa por cima do que o editor escreveu', () => {
    const payload = doPrograma();
    const proposto = proposedFromPayload(payload);
    const editado = { ...readEvent(formularioDaPagina(payload)), title: 'Outro título' };
    expect(eventoParaAprovar(payload, proposto, editado).title).toBe('Outro título');
  });
});

describe('camposRecebidos', () => {
  it('mostra o que chegou por programa, com nomes em vez de identificadores', () => {
    const campos = camposRecebidos(doPrograma(), {
      municipios: { 'vila-da-charamela': 'Vila da Charamela' },
      categorias: { musica: 'Música' },
      espacos: { 'cine-teatro-da-charamela': 'Cine-Teatro da Charamela' },
    });
    const valor = (rotulo: string) => campos.find((campo) => campo.rotulo === rotulo)?.valor;
    expect(valor('Concelho')).toBe('Vila da Charamela');
    expect(valor('Espaço')).toBe('Cine-Teatro da Charamela');
    expect(valor('Categoria')).toBe('Música');
    expect(valor('Datas')).toBe('2026-10-24 às 21:00');
    expect(valor('Preço, como foi escrito')).toBe('6 €; 3 € até aos 12 anos');
    expect(valor('Língua Gestual Portuguesa')).toBe('sim');
    expect(valor('Idade mínima')).toBe('6 anos');
    // O que não veio não se lista.
    expect(valor('Local')).toBeUndefined();
  });
});
