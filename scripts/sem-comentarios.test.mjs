import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { semComentarios } from './sem-comentarios.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('semComentarios', () => {
  it('tira um comentário de bloco e deixa o código', () => {
    const saida = semComentarios('const a = 1; /* nota */ const b = 2;');
    expect(saida).toContain('const a = 1;');
    expect(saida).toContain('const b = 2;');
    expect(saida).not.toContain('nota');
  });

  it('tira um comentário de linha', () => {
    expect(semComentarios('const a = 1; // nota\nconst b = 2;')).toContain('const b = 2;');
    expect(semComentarios('const a = 1; // nota\nconst b = 2;')).not.toContain('nota');
  });

  /**
   * Contar linhas é metade do que as asserções desta casa fazem, e citar
   * números de linha é a outra metade. Um ficheiro que encolha ao ser despido
   * faz cada número mentir.
   */
  it('não muda o número de linhas nem as colunas do que fica', () => {
    const fonte = 'a\n/* uma\n   nota\n   comprida */\nb';
    const saida = semComentarios(fonte);
    expect(saida.split('\n')).toHaveLength(fonte.split('\n').length);
    expect(saida.split('\n')[4]).toBe('b');
  });

  /**
   * **O caso que cegou uma asserção, a 14 de setembro de 2026.**
   *
   * Um cabeçalho `Accept` traz `*​/*`, e lá dentro estão, de uma vez, uma
   * abertura de comentário e um fecho. A versão anterior — uma expressão
   * regular — abria um comentário no primeiro e fechava-o no seguinte,
   * apagando todo o código pelo meio. Engoliu o corpo do `get` do
   * `HttpClient`, e a asserção que perguntava se o cliente consulta o
   * `robots.txt` antes de pedir a página respondeu que não. Consultava.
   */
  it('não confunde um cabeçalho Accept com um comentário', () => {
    const fonte = [
      "const a = { accept: 'text/plain,*/*;q=0.8' };",
      'const codigoQueTemDeSobreviver = 1;',
      "const b = { accept: 'text/html,application/json;q=0.9,*/*;q=0.8' };",
      'const tambemEste = 2;',
    ].join('\n');

    const saida = semComentarios(fonte);
    expect(saida).toContain('codigoQueTemDeSobreviver');
    expect(saida).toContain('tambemEste');
    // E a cadeia fica inteira: não é comentário, é valor.
    expect(saida).toContain("'text/plain,*/*;q=0.8'");
  });

  it('não trata como comentário o que está dentro de uma cadeia', () => {
    expect(semComentarios(`const a = '// isto não é comentário';`)).toContain('isto não é');
    expect(semComentarios(`const a = "/* nem isto */";`)).toContain('nem isto');
    expect(semComentarios('const a = `e /* isto */ também não`;')).toContain('também não');
  });

  it('atravessa os escapes sem se perder', () => {
    const fonte = `const a = 'uma plica \\' e depois /* isto não abre nada */'; const b = 1;`;
    const saida = semComentarios(fonte);
    expect(saida).toContain('const b = 1;');
    expect(saida).toContain('isto não abre nada');
  });

  it('segue a interpolação de uma crase, com chavetas aninhadas', () => {
    const fonte = 'const a = `x ${ { y: `z` } } w`; const depois = 1;';
    expect(semComentarios(fonte)).toContain('const depois = 1;');
  });

  it('um comentário de bloco por fechar come o resto e não rebenta', () => {
    const saida = semComentarios('const a = 1;\n/* aberto e nunca fechado\nmais linhas');
    expect(saida).toContain('const a = 1;');
    expect(saida).not.toContain('nunca fechado');
  });
});

/**
 * O limite conhecido, prendido por um teste em vez de escrito e esquecido.
 *
 * Este leitor não sabe distinguir uma barra de divisão de uma barra que abre
 * uma expressão regular — para isso era preciso a gramática toda. Uma
 * expressão regular que traga `/*` lá dentro volta a enganá-lo, exatamente
 * como o cabeçalho `Accept` enganava a versão anterior.
 *
 * Hoje não há nenhuma no código que as asserções varrem. Este teste é o que
 * avisa no dia em que houver a primeira — antes de ela cegar uma guarda em
 * silêncio, que é como a outra cegou.
 */
describe('o limite que se conhece', () => {
  function ficheirosVarridos() {
    const achados = [];
    const andar = (dir) => {
      for (const entrada of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
        if (entrada.name === 'node_modules' || entrada.name.startsWith('.')) continue;
        const caminho = `${dir}/${entrada.name}`;
        if (entrada.isDirectory()) andar(caminho);
        else if (/\.(ts|tsx|mjs)$/.test(entrada.name)) achados.push(caminho);
      }
    };
    andar('packages');
    andar('apps/web/app');
    andar('apps/web/src');
    andar('scripts');
    return achados;
  }

  it('nenhum ficheiro tem uma expressão regular com «/*» lá dentro', () => {
    const suspeitos = [];
    for (const ficheiro of ficheirosVarridos()) {
      const texto = readFileSync(join(RAIZ, ficheiro), 'utf8');
      // Uma barra que abre expressão vem depois de `(`, `,`, `=`, `:` ou de um
      // operador — e não depois de um identificador ou de um fecho.
      //
      // As barras vão escapadas — `*\/` e não `*/` — por uma razão que este
      // teste descobriu contra si próprio: escrita à solta, esta expressão
      // continha o `/*` que ela existe para caçar, e denunciava-se a si mesma.
      // O escape quebra a adjacência sem mudar o que a expressão casa.
      for (const m of texto.matchAll(
        /[(,=:[!&|?+\-*\/%~^]\s*\/(?![*\/])(?:\\.|\[[^\]]*\]|[^\n\/])*\//g,
      )) {
        if (m[0].includes('/*')) suspeitos.push(`${ficheiro}: ${m[0].slice(0, 60)}`);
      }
    }

    expect(
      suspeitos,
      'Uma expressão regular com «/*» engana o semComentarios como o cabeçalho Accept ' +
        'enganava a versão anterior, e cega as asserções em silêncio. Ou se reescreve a ' +
        'expressão, ou o leitor passa a saber distinguir expressões regulares.',
    ).toEqual([]);
  });
});
