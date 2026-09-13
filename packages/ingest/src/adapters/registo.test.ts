import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { knownAdapterIds } from './index.js';

/**
 * `sources.adapter` é uma cadeia escrita à mão em SQL.
 *
 * O registo de adaptadores já falha alto quando encontra um nome que não
 * conhece — mas falha de madrugada, dentro da recolha, com o concelho a ficar
 * sem programação até alguém ler o registo de execução. Uma gralha num
 * `update` merece ser apanhada aqui, com o CI a nomeá-la.
 *
 * Isto vale nos dois sentidos: um adaptador escrito e nunca ligado a fonte
 * nenhuma também é notícia, porque quase sempre quer dizer que a migração que
 * o devia ligar não foi escrita.
 */
const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '../../../../supabase/migrations');

/** `adapter = 'algo'` e `adapter, ... values (..., 'algo', ...)` em SQL. */
const ATRIBUICOES = /\badapter\s*=\s*'([a-z0-9-]+)'/g;

function adaptadoresNomeadosEmSql(): Set<string> {
  const nomeados = new Set<string>();

  for (const ficheiro of readdirSync(MIGRATIONS).filter((nome) => nome.endsWith('.sql'))) {
    const sql = readFileSync(join(MIGRATIONS, ficheiro), 'utf8');
    for (const encontrado of sql.matchAll(ATRIBUICOES)) {
      nomeados.add(encontrado[1]!);
    }
  }

  return nomeados;
}

/**
 * Nomes que aparecem em SQL sem lhes corresponder um adaptador, e porquê.
 *
 * Uma migração é história e não se reescreve: a que ligou o `bol-store` em
 * agosto continua a nomeá-lo depois de ele ser apagado, e isso está certo. O
 * que não pode acontecer é um nome novo entrar aqui por descuido — por isso
 * cada um é declarado, com a razão, e acrescentar outro é uma decisão.
 */
const SEM_ADAPTADOR = new Map([
  [
    'bol-store',
    'Retirado pela migração 0024: não se recolhe de bilheteiras de terceiros. ' +
      'A 0019, que o ligou, continua a nomeá-lo porque as migrações não se reescrevem.',
  ],
  [
    'pdf-agenda',
    'Semeado de propósito desligado e por escrever: a fonte existe no registo ' +
      'para não se perder, e só passa a correr quando alguém a terminar.',
  ],
]);

describe('os adaptadores nomeados em SQL e os que existem em código', () => {
  it('não há migração a apontar para um adaptador que não existe nem está declarado', () => {
    const conhecidos = new Set(knownAdapterIds());
    const desconhecidos = [...adaptadoresNomeadosEmSql()].filter(
      (nome) => !conhecidos.has(nome) && !SEM_ADAPTADOR.has(nome),
    );

    expect(desconhecidos, `nomeados em SQL mas sem adaptador: ${desconhecidos.join(', ')}`).toEqual(
      [],
    );
  });

  it('as migrações ligam mesmo os adaptadores que existem', () => {
    const nomeados = [...adaptadoresNomeadosEmSql()].filter((nome) => !SEM_ADAPTADOR.has(nome));

    expect(nomeados.length).toBeGreaterThan(0);
    for (const nome of nomeados) {
      expect(knownAdapterIds()).toContain(nome);
    }
  });

  it('nenhum adaptador declarado como ausente existe afinal em código', () => {
    // Um nome que volte ao registo tem de sair desta lista: uma exceção que
    // sobrevive ao motivo dela deixa de ser exceção e passa a ser um buraco.
    for (const nome of SEM_ADAPTADOR.keys()) {
      expect(knownAdapterIds()).not.toContain(nome);
    }
  });
});
