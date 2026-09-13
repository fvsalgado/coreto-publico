import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LACUNAS, LACUNAS_COM_COLUNA, listaDeTrabalho } from './lacunas';

const raiz = fileURLToPath(new URL('../../../../../', import.meta.url));

function ultimaVistaDeQualidade(): string {
  const pasta = `${raiz}supabase/migrations/`;
  const ficheiros = readdirSync(pasta)
    .filter((nome) => nome.endsWith('.sql'))
    .sort();
  // A última migração que redefine a vista é a que está em vigor. As
  // anteriores são história, e a história não se relê para saber o que a base
  // faz hoje.
  const ultima = ficheiros
    .map((nome) => readFileSync(pasta + nome, 'utf8'))
    .filter((texto) =>
      /create (or replace )?view public\.event_quality_by_municipality/.test(texto),
    )
    .pop();
  if (!ultima) throw new Error('nenhuma migração define event_quality_by_municipality');
  return ultima;
}

const queries = readFileSync(`${raiz}apps/web/src/lib/admin/queries.ts`, 'utf8');

/**
 * O contrato que faz da percentagem uma ligação.
 *
 * `/admin/qualidade` mede em percentagem, `/admin/eventos` abre a lista, e a
 * ligação entre as duas só é honesta enquanto contarem a mesma coisa. Antes
 * desta lista única eram duas listas escritas à mão em ficheiros diferentes, e
 * já tinham divergido: o painel media «Preço» e «Mapa», o selector não os
 * conhecia, e quem visse 62% não tinha para onde clicar.
 *
 * Estes testes são o que impede a divergência de voltar — em qualquer das
 * três direções, porque uma coluna nova na base, uma coluna nova no painel e
 * um filtro novo na lista são três alterações diferentes e nenhuma delas
 * arrasta as outras.
 */
describe('as lacunas do catálogo', () => {
  it('cobrem exatamente as colunas que a vista de qualidade conta', () => {
    const sql = ultimaVistaDeQualidade();
    const naVista = [...sql.matchAll(/as\s+(with_[a-z_]+)/g)].map((m) => m[1]);

    expect(
      [...new Set(naVista)].sort(),
      'A vista `event_quality_by_municipality` ganhou ou perdeu uma coluna `with_*`. ' +
        'O painel de qualidade desenha uma coluna por cada uma e cada célula liga à lista ' +
        'de trabalho — uma coluna sem entrada em `lacunas.ts` é uma percentagem sem para ' +
        'onde clicar. Acrescente-a a LACUNAS, com o filtro que a abre em `listEvents`.',
    ).toEqual(LACUNAS_COM_COLUNA.map((l) => l.coluna).sort());
  });

  it('têm todas um filtro que `listEvents` sabe aplicar', () => {
    for (const lacuna of LACUNAS) {
      expect(
        queries.includes(`filter.falta === '${lacuna.chave}'`),
        `A lacuna «${lacuna.chave}» aparece no selector de /admin/eventos e nas ligações do ` +
          'painel, mas `listEvents` não a reconhece: o filtro não se aplica e a lista devolve ' +
          'o catálogo inteiro, como se não faltasse nada a ninguém.',
      ).toBe(true);
    }
  });

  it('não deixam nenhum filtro de `listEvents` fora da lista', () => {
    const naConsulta = [...queries.matchAll(/filter\.falta === '([a-z]+)'/g)].map((m) => m[1]);
    expect(
      naConsulta.sort(),
      'Um filtro `falta=` que `listEvents` aplica mas que não está em `lacunas.ts` não ' +
        'aparece no selector nem em ligação nenhuma: existe e ninguém lhe chega.',
    ).toEqual(LACUNAS.map((l) => l.chave).sort());
  });

  /**
   * O filtro «sem sítio nenhum» esteve no selector a prometer uma lista que a
   * base nunca podia encher: `events_has_location`, da 0004, exige espaço ou
   * texto solto, e a condição `venue_id is null and location_name is null` é
   * falsa para todas as linhas que a base aceita gravar.
   *
   * Zero em produção, e não por o trabalho estar feito — por não poder haver
   * trabalho. Saiu. Este teste é o que decide se pode voltar: o dia em que
   * alguém largar a restrição, a pergunta volta a fazer sentido, e é aqui que
   * fica escrito porquê.
   */
  it('não prometem uma lista que a base não pode encher', () => {
    const pasta = `${raiz}supabase/migrations/`;
    const temGuarda = readdirSync(pasta)
      .filter((nome) => nome.endsWith('.sql'))
      .some((nome) =>
        /constraint events_has_location check/.test(readFileSync(pasta + nome, 'utf8')),
      );

    expect(
      temGuarda,
      'A restrição `events_has_location` desapareceu das migrações. Enquanto ela existia, ' +
        'um evento sem espaço e sem texto solto não podia ser gravado, e por isso o filtro ' +
        '«sem sítio nenhum» saiu de `lacunas.ts` — era uma fila de trabalho que nunca podia ' +
        'ter trabalho. Sem ela, a pergunta volta a fazer sentido e a lacuna pode voltar.',
    ).toBe(true);

    expect(LACUNAS.map((l) => l.chave)).not.toContain('sitio');
  });

  it('não repetem chave nem coluna', () => {
    expect(new Set(LACUNAS.map((l) => l.chave)).size).toBe(LACUNAS.length);
    const colunas = LACUNAS_COM_COLUNA.map((l) => l.coluna);
    expect(new Set(colunas).size).toBe(colunas.length);
  });
});

describe('o endereço da lista de trabalho', () => {
  it('abre o catálogo, e não tudo o que há', () => {
    // `estado=todos` traz escondidos, cancelados e arquivados — decisões de
    // uma pessoa sobre um evento, que a percentagem não conta. A lista abria
    // mais linhas do que o número prometia.
    const url = new URL(listaDeTrabalho('imagem'), 'https://exemplo.pt');
    expect(url.pathname).toBe('/admin/eventos');
    expect(url.searchParams.get('estado')).toBe('catalogo');
    expect(url.searchParams.get('falta')).toBe('imagem');
    expect(url.searchParams.get('concelho')).toBeNull();
    expect(url.searchParams.get('fonte')).toBeNull();
  });

  it('leva o recorte da linha de onde veio', () => {
    const porConcelho = new URL(listaDeTrabalho('hora', { concelho: 'tomar' }), 'https://e.pt');
    expect(porConcelho.searchParams.get('concelho')).toBe('tomar');
    expect(porConcelho.searchParams.get('fonte')).toBeNull();

    const porFonte = new URL(listaDeTrabalho('preco', { fonte: 'cm-tomar' }), 'https://e.pt');
    expect(porFonte.searchParams.get('fonte')).toBe('cm-tomar');
    expect(porFonte.searchParams.get('concelho')).toBeNull();
  });

  it('escapa um id com caracteres de endereço', () => {
    const url = new URL(listaDeTrabalho('mapa', { fonte: 'a&b=c' }), 'https://e.pt');
    expect(url.searchParams.get('fonte')).toBe('a&b=c');
  });
});

/**
 * A ressalva existe para um caso e um só, e o teste guarda-o: a lista de
 * «Hora» abre só os que ainda vão acontecer — a vista da 0118 — enquanto a
 * percentagem conta o catálogo todo. Se alguém alargar a vista ou apertar a
 * percentagem, a frase publicada deixa de ser verdade e este teste cai.
 */
describe('a ressalva da hora', () => {
  it('está escrita, e é a única', () => {
    const comRessalva = LACUNAS.filter((l) => l.ressalva);
    expect(comRessalva.map((l) => l.chave)).toEqual(['hora']);
    expect(comRessalva[0]?.ressalva).toMatch(/ainda vão acontecer/);
  });

  it('corresponde a uma vista que de facto deixa o passado de fora', () => {
    const pasta = `${raiz}supabase/migrations/`;
    const sql = readdirSync(pasta)
      .filter((nome) => nome.endsWith('.sql'))
      .sort()
      .map((nome) => readFileSync(pasta + nome, 'utf8'))
      .filter((texto) => /create (or replace )?view public\.events_without_time/.test(texto))
      .pop();
    expect(sql, 'a vista `events_without_time` desapareceu das migrações').toBeTruthy();
    expect(sql).toMatch(/current_date/);
  });
});
