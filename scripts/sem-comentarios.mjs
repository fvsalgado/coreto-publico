/**
 * Tirar os comentários de um ficheiro, sem tirar código à mistura.
 *
 * **Vive num módulo próprio porque a versão anterior cegava asserções em
 * silêncio, e ninguém dava por isso.** Era uma linha de expressões regulares
 * dentro do `verificar-afirmacoes.mjs`:
 *
 *     texto.replace(/\/\*[\s\S]*?\*\//g, branco)
 *
 * e não sabia distinguir um comentário de uma cadeia de texto. O
 * `packages/ingest/src/http.ts` tem isto, desde sempre:
 *
 *     accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*​/*;q=0.8'
 *
 * O `*​/*` de um cabeçalho `Accept` traz lá dentro, de uma vez, **uma abertura
 * de comentário e um fecho**. A primeira ocorrência abria um comentário que
 * não existia, e a expressão ia fechá-lo na ocorrência seguinte — apagando
 * todo o código pelo meio. A 14 de setembro de 2026 isso engoliu o corpo
 * inteiro do `get`, e uma asserção que perguntava se o cliente consulta o
 * `robots.txt` antes de pedir a página respondeu que não. Consultava.
 *
 * Uma guarda que responde «não» quando a resposta é «sim» é pior do que não
 * existir: manda corrigir o que está certo, e ensina quem a lê a desconfiar
 * dela. É por isso que isto passou a ter testes.
 *
 * **O que este leitor sabe:** cadeias com plica, aspas e crase (com escapes e
 * com interpolação), comentários de linha e comentários de bloco.
 *
 * **O que não sabe, e fica dito:** literais de expressão regular. Distinguir
 * `/` de divisão de `/` de expressão exige saber a gramática toda, e uma
 * expressão que traga `/*` lá dentro volta a enganá-lo. Nenhum ficheiro desta
 * casa tem uma, e há um teste que falha se alguém escrever a primeira.
 */

/**
 * Substitui comentários por espaços, mantendo as linhas e as colunas.
 *
 * Não apaga: embranquece. As asserções desta casa contam linhas e citam
 * números, e um ficheiro que encolhe ao ser despido faz cada número mentir.
 */
export function semComentarios(texto) {
  let saida = '';
  let i = 0;

  while (i < texto.length) {
    const c = texto[i];
    const seguinte = texto[i + 1];

    // Comentário de bloco: some, menos as mudanças de linha.
    if (c === '/' && seguinte === '*') {
      const fim = texto.indexOf('*/', i + 2);
      const bloco = fim === -1 ? texto.slice(i) : texto.slice(i, fim + 2);
      saida += bloco.replace(/[^\n]/g, ' ');
      i += bloco.length;
      continue;
    }

    // Comentário de linha: some até ao fim da linha, a mudança de linha fica.
    if (c === '/' && seguinte === '/') {
      let fim = texto.indexOf('\n', i);
      if (fim === -1) fim = texto.length;
      saida += ' '.repeat(fim - i);
      i = fim;
      continue;
    }

    // Cadeia de texto: passa intacta, e o que vier lá dentro não é comentário.
    if (c === "'" || c === '"' || c === '`') {
      const inicio = i;
      i += 1;
      while (i < texto.length) {
        if (texto[i] === '\\') {
          i += 2;
          continue;
        }
        if (texto[i] === c) {
          i += 1;
          break;
        }
        // Uma crase pode trazer `${…}` com código dentro, e esse código pode
        // trazer outra crase. Seguir as chavetas é o que impede a cadeia de
        // parecer que acaba onde não acaba.
        if (c === '`' && texto[i] === '$' && texto[i + 1] === '{') {
          let prof = 1;
          i += 2;
          while (i < texto.length && prof > 0) {
            if (texto[i] === '{') prof += 1;
            else if (texto[i] === '}') prof -= 1;
            i += 1;
          }
          continue;
        }
        i += 1;
      }
      saida += texto.slice(inicio, i);
      continue;
    }

    saida += c;
    i += 1;
  }

  return saida;
}
